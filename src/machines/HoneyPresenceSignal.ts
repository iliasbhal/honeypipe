import * as x from 'xstate';
import { Channel } from '../Channel';
import { Peer } from '../Peer';

interface HoneyPresenceSignalContext {
  channel: Channel<any>;
  peer: Peer;
  lastSeenIndex: number;
  currentPollingDelay: number;
  aliveInterval: number;
  parentRef: any;
  pollCount: number;
}

interface HoneyPresenceSignalInput {
  channel: Channel<any>;
  peer: Peer;
  parentRef: any;
  aliveInterval?: number; // milliseconds between alive signals, default 30000 (30s)
}

export type PresenceEvent =
  | { type: 'join'; peerId: string }
  | { type: 'leave'; peerId: string }
  | { type: 'alive'; peerId: string };

export const HoneyPresenceSignal = x.setup({
  types: {
    context: {} as HoneyPresenceSignalContext,
    events: {} as any,
    input: {} as HoneyPresenceSignalInput,
  },
  delays: {
    ALIVE_INTERVAL: ({ context }) => context.aliveInterval,
    POLLING_INTERVAL: ({ context }) => context.currentPollingDelay,
  },
  actors: {
    presencePolling: x.fromPromise(async ({ input }: { input: HoneyPresenceSignalContext }) => {
      const { channel, lastSeenIndex } = input;

      // Pull only presence events from signaling adapter
      const allEvents = await channel.signalingAdapter.pull({
        roomId: channel.id,
        offsetIndex: lastSeenIndex
      });

      // Filter only presence events (join, leave, alive)
      const presenceEvents = allEvents.filter(event =>
        event.type === 'join' || event.type === 'leave' || event.type === 'alive'
      );

      return {
        events: presenceEvents,
        newLastSeenIndex: lastSeenIndex + allEvents.length // Update index based on all events, not just presence
      };
    }),
  },
  actions: {
    sendJoinEvent: async ({ context }) => {
      await context.channel.signalingAdapter.push({
        peerId: context.peer.id,
        roomId: context.channel.id,
        type: 'join'
      });
    },
    sendLeaveEvent: async ({ context }) => {
      await context.channel.signalingAdapter.push({
        peerId: context.peer.id,
        roomId: context.channel.id,
        type: 'leave'
      });
    },
    sendAliveEvent: async ({ context }) => {
      await context.channel.signalingAdapter.push({
        peerId: context.peer.id,
        roomId: context.channel.id,
        type: 'alive'
      });
    },
  },
}).createMachine({
  id: 'honeyPresenceSignal',
  initial: 'inactive',
  context: ({ input }) => ({
    channel: input.channel,
    peer: input.peer,
    lastSeenIndex: 0,
    currentPollingDelay: 1000, // Start with 1s polling for presence
    aliveInterval: input.aliveInterval || 30000, // Default 30s alive interval
    parentRef: input.parentRef,
    pollCount: 0,
  }),
  states: {
    inactive: {
      on: {
        START: {
          target: 'active'
        }
      }
    },
    active: {
      entry: ['sendJoinEvent'],
      exit: ['sendLeaveEvent'],
      type: 'parallel',
      states: {
        polling: {
          initial: 'poll',
          states: {
            poll: {
              invoke: {
                src: 'presencePolling',
                input: ({ context }) => context,
                onDone: {
                  target: 'wait',
                  actions: [
                    x.assign({
                      lastSeenIndex: ({ event }) => event.output.newLastSeenIndex,
                      pollCount: ({ context }) => context.pollCount + 1,
                      currentPollingDelay: ({ event, context }) => {
                        const baseDelay = 1000; // 1s base for presence
                        const maxDelay = 10000; // 10s max for presence
                        const backoffMultiplier = 1.5;

                        const isEmpty = event.output.events.length === 0;
                        if (!isEmpty) return baseDelay;

                        const newDelay = Math.min(context.currentPollingDelay * backoffMultiplier, maxDelay);
                        return newDelay;
                      }
                    }),
                    ({ event, context }) => {
                      const { events } = event.output;
                      // Send presence events directly to parent
                      if (events.length > 0) {
                        context.parentRef.send({
                          type: 'PRESENCE_EVENTS',
                          data: { events, newLastSeenIndex: event.output.newLastSeenIndex },
                          origin: 'presence-polling'
                        });
                      }
                    }
                  ]
                },
                onError: {
                  target: 'wait'
                }
              }
            },
            wait: {
              after: {
                POLLING_INTERVAL: {
                  target: 'poll'
                }
              }
            }
          }
        },
        aliveHeartbeat: {
          initial: 'waiting',
          states: {
            waiting: {
              after: {
                ALIVE_INTERVAL: {
                  target: 'waiting',
                  actions: ['sendAliveEvent'],
                  reenter: true
                }
              }
            }
          }
        }
      },
      on: {
        STOP: {
          target: 'inactive'
        },
        SEND_ALIVE: {
          actions: 'sendAliveEvent'
        }
      }
    }
  },
  on: {
    // Allow START/STOP from any state
    START: {
      target: '.active'
    },
    STOP: {
      target: '.inactive'
    }
  }
});