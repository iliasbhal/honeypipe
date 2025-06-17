import * as x from 'xstate';
import { Channel } from '../Channel';
import { Peer } from '../Peer';
import { SignalingAdapter, SignalingEvent } from '../adapters/_base';

interface HoneyPeerSignalContext {
  channel: Channel;
  signalingAdapter: SignalingAdapter;
  localPeer: Peer;
  remotePeerId: string;
  lastSeenIndex: number;
  currentPollingDelay: number;
  parentRef: any;
  pollCount: number;
}

interface HoneyPeerSignalInput {
  channel: Channel;
  signalingAdapter: SignalingAdapter;
  localPeer: Peer;
  remotePeerId: string;
  parentRef: any;
}

export type PeerSignalEvent =
  | { type: 'PUSH_SDP_OFFER'; offer: RTCSessionDescriptionInit }
  | { type: 'PUSH_SDP_ANSWER'; answer: RTCSessionDescriptionInit }
  | { type: 'PUSH_ICE_CANDIDATE'; candidate: RTCIceCandidateInit }
  | { type: 'START' }
  | { type: 'STOP' };

export const HoneyPeerSignal = x.setup({
  types: {
    context: {} as HoneyPeerSignalContext,
    events: {} as PeerSignalEvent,
    input: {} as HoneyPeerSignalInput,
  },
  delays: {
    POLLING_INTERVAL: ({ context }) => context.currentPollingDelay,
  },
  actors: {
    peerSignalPolling: x.fromPromise(async ({ input }: { input: HoneyPeerSignalContext }) => {
      const { channel, signalingAdapter, lastSeenIndex, remotePeerId } = input;

      // Pull events from the channel
      const allEvents = await signalingAdapter.pull({
        channelId: channel.id,
        offsetIndex: lastSeenIndex
      });

      console.log('HoneyPeerSignal (PULL)', input.localPeer.id, allEvents);
      return {
        events: allEvents,
        newLastSeenIndex: lastSeenIndex + allEvents.length
      };
    }),
  },
  actions: {
    pushSdpOffer: async ({ context, event }) => {
      if (event.type === 'PUSH_SDP_OFFER') {
        await context.signalingAdapter.push({
          channelId: context.channel.id,
          peerId: context.localPeer.id,
          type: 'sdpOffer',
          data: event.offer,
        });
      }
    },
    pushSdpAnswer: async ({ context, event }) => {
      if (event.type === 'PUSH_SDP_ANSWER') {
        await context.signalingAdapter.push({
          channelId: context.channel.id,
          peerId: context.localPeer.id,
          type: 'sdpAnswer',
          data: event.answer,
        });
      }
    },
    pushIceCandidate: async ({ context, event }) => {
      if (event.type === 'PUSH_ICE_CANDIDATE') {
        await context.signalingAdapter.push({
          channelId: context.channel.id,
          peerId: context.localPeer.id,
          type: 'iceCandidate',
          data: event.candidate,
        });
      }
    },
  },
}).createMachine({
  id: 'honeyPeerSignal',
  initial: 'inactive',
  context: ({ input }) => ({
    channel: input.channel,
    signalingAdapter: input.signalingAdapter,
    localPeer: input.localPeer,
    remotePeerId: input.remotePeerId,
    parentRef: input.parentRef,
    lastSeenIndex: 0,
    currentPollingDelay: 500, // Start with 500ms polling for peer signaling
    pollCount: 0,
  }),
  states: {
    inactive: {
      on: {
        START: {
          target: 'active'
        },
        PUSH_SDP_OFFER: {
          actions: ['pushSdpOffer']
        },
        PUSH_SDP_ANSWER: {
          actions: ['pushSdpAnswer']
        },
        PUSH_ICE_CANDIDATE: {
          actions: ['pushIceCandidate']
        }
      }
    },
    active: {
      type: 'parallel',
      states: {
        polling: {
          initial: 'poll',
          states: {
            poll: {
              invoke: {
                src: 'peerSignalPolling',
                input: ({ context }) => context,
                onDone: {
                  target: 'wait',
                  actions: [
                    x.assign({
                      lastSeenIndex: ({ event }) => event.output.newLastSeenIndex,
                      pollCount: ({ context }) => context.pollCount + 1,
                      currentPollingDelay: ({ event, context }) => {
                        const baseDelay = 500; // 500ms base for peer signaling
                        const maxDelay = 5000; // 5s max for peer signaling
                        const backoffMultiplier = 1.5;

                        const isEmpty = event.output.events.length === 0;
                        if (!isEmpty) return baseDelay;

                        const newDelay = Math.min(context.currentPollingDelay * backoffMultiplier, maxDelay);
                        return newDelay;
                      }
                    }),
                    ({ event, context }) => {
                      const { events } = event.output;
                      // Send peer signaling events to parent
                      if (events.length > 0) {
                        context.parentRef.send({
                          type: 'PEER_SIGNAL_EVENTS',
                          data: { events, newLastSeenIndex: event.output.newLastSeenIndex },
                          origin: 'peer-signal-polling'
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
        }
      },
      on: {
        STOP: {
          target: 'inactive'
        },
        PUSH_SDP_OFFER: {
          actions: ['pushSdpOffer']
        },
        PUSH_SDP_ANSWER: {
          actions: ['pushSdpAnswer']
        },
        PUSH_ICE_CANDIDATE: {
          actions: ['pushIceCandidate']
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