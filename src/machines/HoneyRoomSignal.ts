import * as x from 'xstate';
import { Room } from '../Room';
import { Channel } from '../Channel';
import { Peer } from '../Peer';
import { SignalingAdapter } from '../adapters/_base';

interface HoneyRoomSignalContext {
  room?: Room; // Room for presence signaling (join/leave/alive)
  channel?: Channel; // Channel for presence signaling
  signalingAdapter: SignalingAdapter; // Signaling adapter for push/pull operations
  peer: Peer;
  lastSeenIndex: number;
  currentPollingDelay: number;
  aliveInterval: number;
  parentRef: any;
  pollCount: number;
}

interface HoneyRoomSignalInput {
  room?: Room; // Room for presence signaling (join/leave/alive)
  channel?: Channel; // Channel for presence signaling
  signalingAdapter?: SignalingAdapter; // Optional signaling adapter (required if using channel)
  peer: Peer;
  parentRef: any;
  aliveInterval?: number; // milliseconds between alive signals, default 30000 (30s)
}

export type PresenceEvent =
  | { type: 'join'; peerId: string }
  | { type: 'leave'; peerId: string }
  | { type: 'alive'; peerId: string };

export const HoneyRoomSignal = x.setup({
  types: {
    context: {} as HoneyRoomSignalContext,
    events: {} as any,
    input: {} as HoneyRoomSignalInput,
  },
  delays: {
    ALIVE_INTERVAL: ({ context }) => context.aliveInterval,
    POLLING_INTERVAL: ({ context }) => context.currentPollingDelay,
  },
  actors: {
    signalPolling: x.fromPromise(async ({ input }: { input: HoneyRoomSignalContext }) => {
      const { room, channel, signalingAdapter, lastSeenIndex } = input;

      const allEvents = await signalingAdapter.pull({
        roomId: room.id,
        offsetIndex: lastSeenIndex,
      });

      return {
        events: allEvents,
        newLastSeenIndex: lastSeenIndex + allEvents.length // Update index based on all events, not just presence
      };
    }),
  },
  actions: {
    sendJoinEvent: async ({ context }) => {
      // Presence events only work with rooms, not channels
      if (context.room) {
        await context.signalingAdapter.push({
          peerId: context.peer.id,
          roomId: context.room.id,
          type: 'join'
        });
      }
    },
    sendLeaveEvent: async ({ context }) => {
      // Presence events only work with rooms, not channels
      if (context.room) {
        await context.signalingAdapter.push({
          peerId: context.peer.id,
          roomId: context.room.id,
          type: 'leave'
        });
      }
    },
    sendAliveEvent: async ({ context }) => {
      // Presence events only work with rooms, not channels
      if (context.room) {
        await context.signalingAdapter.push({
          peerId: context.peer.id,
          roomId: context.room.id,
          type: 'alive'
        });
      }
    },
  },
}).createMachine({
  id: 'HoneyRoomSignal',
  initial: 'inactive',
  context: ({ input }) => {
    // Validate input - must have either room or channel with signaling adapter
    if (!input.room && !input.channel) {
      throw new Error('HoneyRoomSignal requires either a room or channel');
    }
    if (input.channel && !input.signalingAdapter) {
      throw new Error('HoneyRoomSignal requires a signalingAdapter when using channel');
    }

    const signalingAdapter = input.room ? input.room.signalingAdapter : input.signalingAdapter!;

    return {
      room: input.room,
      channel: input.channel,
      signalingAdapter,
      peer: input.peer,
      lastSeenIndex: 0,
      currentPollingDelay: 1000, // Start with 1s polling for presence
      aliveInterval: input.aliveInterval || 30000, // Default 30s alive interval
      parentRef: input.parentRef,
      pollCount: 0,
    };
  },
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
                src: 'signalPolling',
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