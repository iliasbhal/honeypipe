import * as x from 'xstate';
import { Channel } from '../Channel';
import { Peer } from '../Peer';
import { SignalingEvent } from '../adapters/_base';
import { RTCPeerConnectionMachine } from './RTCPeerConnection';

interface HoneyPeerConnectionContext {
  localPeer: Peer;
  remotePeerId: string;
  channel: Channel<any>;
  rtcConfiguration: RTCConfiguration;
  rtcPeerConnectionActorRef?: any;
  isInitiator?: boolean;
  eventHistory: SignalingEvent[];
  parentRef: any;
}

interface HoneyPeerConnectionInput {
  localPeer: Peer;
  remotePeerId: string;
  channel: Channel<any>;
  rtcConfiguration: RTCConfiguration;
  parentRef: any;
}

export type PeerConnectionEvent =
  | { type: 'START' }
  | { type: 'SIGNALING_EVENTS'; events: SignalingEvent[] }
  | { type: 'SEND_MESSAGE'; message: string }
  | { type: 'CLOSE' }
  | { type: 'RTC_ICE_CANDIDATE'; candidate: RTCIceCandidate | null }
  | { type: 'RTC_CONNECTION_STATE_CHANGE'; state: RTCPeerConnectionState }
  | { type: 'RTC_DATA_CHANNEL_CREATED'; label: string }
  | { type: 'RTC_OFFER_CREATED'; offer: RTCSessionDescriptionInit }
  | { type: 'RTC_ANSWER_CREATED'; answer: RTCSessionDescriptionInit }
  | { type: 'RTC_LOCAL_DESCRIPTION_SET' }
  | { type: 'RTC_REMOTE_DESCRIPTION_SET' }
  | { type: 'RTC_ICE_CANDIDATE_ADDED' }
  | { type: 'DATA_CHANNEL_OPEN'; label: string }
  | { type: 'DATA_CHANNEL_MESSAGE'; label: string; data: string }
  | { type: 'DATA_CHANNEL_CLOSED'; label: string }
  | { type: 'DATA_CHANNEL_ERROR'; label: string; error: any };

export const HoneyPeerConnection = x.setup({
  types: {
    context: {} as HoneyPeerConnectionContext,
    events: {} as PeerConnectionEvent,
    input: {} as HoneyPeerConnectionInput,
  },
  actors: {
    rtcPeerConnection: RTCPeerConnectionMachine,
  },
  guards: {
    shouldInitiate: ({ context }) => {
      // Check event history to see if anyone has already sent an offer
      const hasExistingOffer = context.eventHistory.some(event => {
        if (event.type !== 'sdpOffer') return false;
        return event.peerId === context.localPeer.id
          || event.peerId === context.remotePeerId;
      });

      if (hasExistingOffer) {
        // Someone already initiated, don't initiate again
        return false;
      }

      // Use lexicographical comparison as fallback
      return context.localPeer.id < context.remotePeerId;
    },
    isOfferForUs: ({ event }) => {
      if (event.type !== 'SIGNALING_EVENTS') return false;
      return event.events.some(signalingEvent => signalingEvent.type === 'sdpOffer');
    },
    isAnswerForUs: ({ event }) => {
      if (event.type !== 'SIGNALING_EVENTS') return false;
      return event.events.some(signalingEvent => signalingEvent.type === 'sdpAnswer');
    },
  },
  actions: {
    spawnRTCPeerConnection: x.assign({
      rtcPeerConnectionActorRef: ({ context, spawn, self }) => {
        return spawn('rtcPeerConnection', {
          id: 'rtcPeerConnection',
          input: {
            configuration: context.rtcConfiguration,
            parentRef: self
          }
        });
      }
    }),
    determineInitiator: x.assign({
      isInitiator: ({ context }) => {
        // Look for the first SDP offer in event history
        const firstOffer = context.eventHistory.find(event => event.type === 'sdpOffer');

        if (firstOffer) {
          // If there's already an offer, we're the initiator if we sent it
          return firstOffer.peerId === context.localPeer.id;
        }

        // No offers yet, use lexicographical comparison
        return context.localPeer.id < context.remotePeerId;
      }
    }),
    createDataChannel: ({ context }) => {
      if (context.rtcPeerConnectionActorRef) {
        context.rtcPeerConnectionActorRef.send({
          type: 'CREATE_DATA_CHANNEL',
          label: 'peer-connection',
          options: { ordered: true }
        });
      }
    },
    updateEventHistory: x.assign({
      eventHistory: ({ context, event }) => {
        if (event.type !== 'SIGNALING_EVENTS') return context.eventHistory;

        // Add new events to history, filtering for relevant events
        const relevantEvents = event.events.filter(signalingEvent =>
          signalingEvent.peerId === context.remotePeerId ||
          signalingEvent.peerId === context.localPeer.id
        );

        return [...context.eventHistory, ...relevantEvents];
      }
    }),
    sendOffer: async ({ context, event }) => {
      if (event.type === 'RTC_OFFER_CREATED') {
        await context.channel.signalingAdapter.push({
          channelId: context.channel.id,
          peerId: context.localPeer.id,
          type: 'sdpOffer',
          data: event.offer,
        });
      }
    },
    sendAnswer: async ({ context, event }) => {
      if (event.type === 'RTC_ANSWER_CREATED') {
        await context.channel.signalingAdapter.push({
          channelId: context.channel.id,
          peerId: context.localPeer.id,
          type: 'sdpAnswer',
          data: event.answer,
        });
      }
    },
    sendIceCandidate: async ({ context, event }) => {
      if (event.type === 'RTC_ICE_CANDIDATE' && event.candidate) {
        await context.channel.signalingAdapter.push({
          channelId: context.channel.id,
          peerId: context.localPeer.id,
          type: 'iceCandidate',
          data: event.candidate,
        });
      }
    },
    processSignalingEvents: ({ context, event }) => {
      if (event.type !== 'SIGNALING_EVENTS') return;

      for (const signalingEvent of event.events) {
        // Only process events from our target peer
        if (signalingEvent.peerId !== context.remotePeerId) continue;

        if ('iceCandidate' in signalingEvent) {
          context.rtcPeerConnectionActorRef?.send({
            type: 'ADD_ICE_CANDIDATE',
            candidate: signalingEvent.iceCandidate
          });
        }
      }
    },
    sendMessage: ({ context, event }) => {
      if (event.type !== 'SEND_MESSAGE') return;

      // Send to the default peer-connection data channel
      context.rtcPeerConnectionActorRef?.send({
        type: 'SEND_DATA_CHANNEL_MESSAGE',
        label: 'peer-connection',
        message: event.message
      });
    },
    notifyConnectionEstablished: ({ context }) => {
      context.parentRef.send({
        type: 'PEER_CONNECTION_ESTABLISHED',
        remotePeerId: context.remotePeerId
      });
    },
    notifyMessageReceived: ({ context, event }) => {
      if (event.type !== 'DATA_CHANNEL_MESSAGE') return;

      context.parentRef.send({
        type: 'PEER_MESSAGE_RECEIVED',
        remotePeerId: context.remotePeerId,
        message: event.data
      });
    },
    notifyConnectionClosed: ({ context }) => {
      context.parentRef.send({
        type: 'PEER_CONNECTION_CLOSED',
        remotePeerId: context.remotePeerId
      });
    },
    cleanup: ({ context }) => {
      if (context.rtcPeerConnectionActorRef) {
        context.rtcPeerConnectionActorRef.send({ type: 'CLOSE' });
      }
    },
  },
}).createMachine({
  id: 'honeyPeerConnection',
  initial: 'idle',
  context: ({ input }) => ({
    localPeer: input.localPeer,
    remotePeerId: input.remotePeerId,
    channel: input.channel,
    rtcConfiguration: input.rtcConfiguration,
    parentRef: input.parentRef,
    eventHistory: [],
  }),
  states: {
    idle: {
      on: {
        START: {
          target: 'connecting',
          actions: ['spawnRTCPeerConnection']
        }
      }
    },
    connecting: {
      entry: ['determineInitiator'],
      always: [
        {
          target: 'initiating',
          guard: ({ context }) => context.isInitiator === true
        },
        {
          target: 'waiting',
          guard: ({ context }) => context.isInitiator === false
        }
      ],
      on: {
        SIGNALING_EVENTS: {
          actions: ['updateEventHistory', 'processSignalingEvents', 'determineInitiator']
        }
      }
    },
    initiating: {
      entry: [
        'createDataChannel',
        ({ context }) => {
          // Create offer immediately
          context.rtcPeerConnectionActorRef?.send({ type: 'CREATE_OFFER' });
        }
      ],
      on: {
        RTC_OFFER_CREATED: {
          target: 'waitingForAnswer',
          actions: ['sendOffer']
        },
        SIGNALING_EVENTS: {
          actions: ['updateEventHistory', 'processSignalingEvents']
        }
      }
    },
    waiting: {
      on: {
        SIGNALING_EVENTS: [
          {
            target: 'processingOffer',
            guard: 'isOfferForUs',
            actions: ['updateEventHistory', 'processSignalingEvents']
          },
          {
            actions: ['updateEventHistory', 'processSignalingEvents']
          }
        ]
      }
    },
    waitingForAnswer: {
      on: {
        SIGNALING_EVENTS: [
          {
            target: 'connected',
            guard: 'isAnswerForUs',
            actions: [
              'updateEventHistory',
              'processSignalingEvents',
              ({ event, context }) => {
                // Process incoming answer
                const signalingEvents = event.events;
                const answerEvent = signalingEvents.find((e: any) => e.type === 'sdpAnswer')

                if ('sdpAnswer' in answerEvent) {
                  if (context.rtcPeerConnectionActorRef) {
                    context.rtcPeerConnectionActorRef.send({
                      type: 'SET_REMOTE_DESCRIPTION',
                      description: answerEvent.sdpAnswer
                    });
                  }
                }
              }
            ]
          },
          {
            actions: ['updateEventHistory', 'processSignalingEvents']
          }
        ]
      }
    },
    processingOffer: {
      entry: [
        ({ event, context }) => {
          // Find the offer in the signaling events
          const signalingEvents = (event as any).events;
          const offerEvent = signalingEvents.find((e: any) =>
            e.type === 'sdp' && e.data?.sdp?.type === 'offer'
          );

          if (offerEvent && context.rtcPeerConnectionActorRef) {
            // Set remote description first
            context.rtcPeerConnectionActorRef.send({
              type: 'SET_REMOTE_DESCRIPTION',
              description: offerEvent.data.sdp
            });
            // Then create answer
            context.rtcPeerConnectionActorRef.send({
              type: 'CREATE_ANSWER',
              offer: offerEvent.data.sdp
            });
          }
        }
      ],
      on: {
        RTC_ANSWER_CREATED: {
          target: 'connected',
          actions: ['sendAnswer']
        },
        SIGNALING_EVENTS: {
          actions: ['updateEventHistory', 'processSignalingEvents']
        }
      }
    },
    connected: {
      on: {
        DATA_CHANNEL_OPEN: {
          actions: ['notifyConnectionEstablished']
        },
        DATA_CHANNEL_MESSAGE: {
          actions: ['notifyMessageReceived']
        },
        DATA_CHANNEL_CLOSED: {
          target: 'disconnected'
        },
        DATA_CHANNEL_ERROR: {
          target: 'failed'
        },
        SEND_MESSAGE: {
          actions: ['sendMessage']
        },
        RTC_CONNECTION_STATE_CHANGE: [
          {
            target: 'failed',
            guard: ({ event }) => event.state === 'failed'
          },
          {
            target: 'disconnected',
            guard: ({ event }) => event.state === 'disconnected'
          }
        ],
        RTC_ICE_CANDIDATE: {
          actions: ['sendIceCandidate']
        },
        SIGNALING_EVENTS: {
          actions: ['updateEventHistory', 'processSignalingEvents']
        },
        CLOSE: {
          target: 'disconnected'
        }
      },
    },
    disconnected: {
      entry: ['cleanup', 'notifyConnectionClosed'],
      type: 'final'
    },
    failed: {
      entry: ['cleanup', 'notifyConnectionClosed'],
      type: 'final'
    }
  },
  on: {
    CLOSE: {
      target: '.disconnected'
    },
    RTC_ICE_CANDIDATE: {
      actions: ['sendIceCandidate']
    }
  }
});