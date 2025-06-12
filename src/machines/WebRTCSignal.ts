import * as x from 'xstate';
import { Channel } from '../Channel';


interface PollingActorContext {
  channel: Channel<any>;
  lastSeenIndex: number;
  currentPollingDelay: number;
  parentRef: any;
  pollCount: number;
}

export const WebRTCSignal = x.setup({
  types: {
    context: {} as PollingActorContext,
    events: {} as any,
    input: {} as any,
  },
  actors: {
    polling: x.fromPromise(async ({ input, signal }: { input: PollingActorContext; signal: AbortSignal }) => {
      const { channel, lastSeenIndex, currentPollingDelay } = input;

      // Wait for the current delay before polling
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, currentPollingDelay);
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      if (signal.aborted) {
        throw new Error('Polling aborted');
      }

      // Pull events from signaling adapter
      const events = await channel.signalingAdapter.pull(channel.id, lastSeenIndex);
      return { events, newLastSeenIndex: lastSeenIndex + events.length };
    }),
  }

}).createMachine({
  id: 'polling',
  initial: 'polling',
  context: ({ input }: { input: PollingActorContext }) => ({
    channel: input.channel,
    lastSeenIndex: 0,
    currentPollingDelay: 100,
    parentRef: input.parentRef,
    pollCount: 0,
  }),
  states: {
    polling: {
      invoke: {
        src: 'polling',
        input: ({ context }) => ({
          channel: context.channel,
          lastSeenIndex: context.lastSeenIndex,
          currentPollingDelay: context.currentPollingDelay,
          parentRef: context.parentRef,
          pollCount: context.pollCount
        }),
        onDone: {
          target: 'polling',
          actions: [
            x.assign({
              lastSeenIndex: ({ event }) => event.output.newLastSeenIndex,
              pollCount: ({ context }) => context.pollCount + 1,
              currentPollingDelay: ({ event, context }) => {
                const baseDelay = 100;
                const maxDelay = 5000;
                const backoffMultiplier = 1.5;

                if (event.output.events.length > 0) {
                  console.log(`[Polling] Events found, reset polling delay to ${baseDelay}ms`);
                  return baseDelay;
                } else {
                  const newDelay = Math.min(context.currentPollingDelay * backoffMultiplier, maxDelay);
                  console.log(`[Polling] No new events, increased polling delay to ${newDelay}ms`);
                  return newDelay;
                }
              }
            }),
            ({ event, context }) => {
              const { events } = event.output;
              console.log(`[Polling] Polled ${events.length} events, sending to parent`);

              // Send events directly to parent using sendTo
              if (events.length > 0) {
                context.parentRef.send({
                  type: 'POLLING_EVENTS',
                  data: { events, newLastSeenIndex: event.output.newLastSeenIndex },
                  origin: 'polling'
                });
              }
            }
          ],
          reenter: true
        },
        onError: {
          target: 'polling',
          actions: ({ event }) => {
            console.error('[Polling] Polling error:', event.error);
          },
          reenter: true
        }
      }
    }
  }
});