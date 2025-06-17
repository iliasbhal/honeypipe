import * as x from 'xstate';
import { Channel } from '../Channel';
import { Peer } from '../Peer';
import { SignalingAdapter, SignalingEvent } from '../adapters/_base';
import { RTCPeerConnectionMachine } from './RTCPeerConnection';
import { HoneyRoomSignal } from './HoneyRoomSignal';
import { HoneyPeerSignal } from './HoneyPeerSignal';

interface HoneyPeerConnectionContext {
  localPeer: Peer;
  remotePeerId: string;
  channel: Channel<any>;
  rtcConfiguration: RTCConfiguration;
  signalingAdapter: SignalingAdapter;
  isInitiator?: boolean;
  eventHistory: SignalingEvent[];

  presenceSignalActorRef: x.ActorRefFromLogic<typeof HoneyRoomSignal>;
  peerSignalActorRef: x.ActorRefFromLogic<typeof HoneyPeerSignal>;
  rtcPeerConnectionActorRef?: x.ActorRefFromLogic<typeof RTCPeerConnectionMachine>;
  parentRef: x.ActorRefFromLogic<any>;
}

interface HoneyPeerConnectionInput {
  localPeer: Peer;
  remotePeerId: string;
  channel: Channel<any>;
  rtcConfiguration: RTCConfiguration;
  signalingAdapter: SignalingAdapter;
  parentRef: any;
}

export type PeerConnectionEvent =
  | { type: 'START' }
  | { type: 'SIGNALING_EVENTS'; events: SignalingEvent[] }
  | { type: 'SEND_MESSAGE'; message: string; broadcast?: boolean }
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
  | { type: 'DATA_CHANNEL_MESSAGE'; label: string; data: string; broadcast?: boolean }
  | { type: 'DATA_CHANNEL_CLOSED'; label: string }
  | { type: 'DATA_CHANNEL_ERROR'; label: string; error: any };

export const HoneyPeerConnection = x.setup({
  types: {
    context: {} as HoneyPeerConnectionContext,
    events: {} as PeerConnectionEvent | { type: 'PRESENCE_EVENTS'; data: { events: SignalingEvent[]; newLastSeenIndex: number }; origin: string } | { type: 'PEER_SIGNAL_EVENTS'; data: { events: SignalingEvent[]; newLastSeenIndex: number }; origin: string },
    input: {} as HoneyPeerConnectionInput,
  },
  actors: {
    rtcPeerConnection: RTCPeerConnectionMachine,
    HoneyRoomSignal: HoneyRoomSignal,
    honeyPeerSignal: HoneyPeerSignal,
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
    startPresenceSignal: ({ context }) => {
      context.presenceSignalActorRef?.send({ type: 'START' });
    },
    startPeerSignal: ({ context }) => {
      context.peerSignalActorRef?.send({ type: 'START' });
    },
    stopPresenceSignal: ({ context }) => {
      context.presenceSignalActorRef?.send({ type: 'STOP' });
    },
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
      context.rtcPeerConnectionActorRef?.send({
        type: 'CREATE_DATA_CHANNEL',
        label: 'peer-connection',
        options: { ordered: true }
      });
    },
    updateEventHistory: x.assign({
      eventHistory: ({ context, event }) => {
        console.log('updateEventHistory', context, event);
        if (event.type !== 'SIGNALING_EVENTS') return context.eventHistory;

        // Add new events to history, filtering for relevant events
        const relevantEvents = event.events.filter(signalingEvent =>
          signalingEvent.peerId === context.remotePeerId ||
          signalingEvent.peerId === context.localPeer.id
        );

        return [...context.eventHistory, ...relevantEvents];
      }
    }),
    sendOffer: ({ context, event }) => {
      console.log('sendOffer', context, event);
      if (event.type === 'RTC_OFFER_CREATED') {
        context.peerSignalActorRef?.send({
          type: 'PUSH_SDP_OFFER',
          offer: event.offer
        });
      }
    },
    sendAnswer: ({ context, event }) => {
      if (event.type === 'RTC_ANSWER_CREATED') {
        context.peerSignalActorRef?.send({
          type: 'PUSH_SDP_ANSWER',
          answer: event.answer
        });
      }
    },
    sendIceCandidate: ({ context, event }) => {
      if (event.type === 'RTC_ICE_CANDIDATE' && event.candidate) {
        context.peerSignalActorRef?.send({
          type: 'PUSH_ICE_CANDIDATE',
          candidate: event.candidate
        });
      }
    },
    processSignalingEvents: ({ context, event }) => {
      if (event.type !== 'SIGNALING_EVENTS') return;

      event.events
        .filter(signalingEvent => signalingEvent.peerId === context.remotePeerId)
        .forEach(signalingEvent => {
          if ('iceCandidate' in signalingEvent) {
            context.rtcPeerConnectionActorRef?.send({
              type: 'ADD_ICE_CANDIDATE',
              candidate: signalingEvent.iceCandidate
            });
          }

          if ('sdpOffer' in signalingEvent) {
            context.rtcPeerConnectionActorRef?.send({
              type: 'SET_REMOTE_DESCRIPTION',
              description: signalingEvent.data.sdp
            });
          }
        })
    },
    sendMessage: ({ context, event }) => {
      if (event.type !== 'SEND_MESSAGE') return;

      // Send to the default peer-connection data channel
      context.rtcPeerConnectionActorRef?.send({
        type: 'SEND_DATA_CHANNEL_MESSAGE',
        label: 'peer-connection',
        message: event.message,
        broadcast: event.broadcast || false  // Pass through broadcast flag
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
        message: event.data,
        broadcast: event.broadcast || false  // Pass through broadcast flag
      });
    },
    notifyConnectionClosed: ({ context }) => {
      context.parentRef.send({
        type: 'PEER_CONNECTION_CLOSED',
        remotePeerId: context.remotePeerId
      });
    },
    cleanup: ({ context }) => {
      // Stop presence signal
      if (context.presenceSignalActorRef) {
        context.presenceSignalActorRef.send({ type: 'STOP' });
      }
      // Stop peer signal
      if (context.peerSignalActorRef) {
        context.peerSignalActorRef.send({ type: 'STOP' });
      }
      // Close RTC peer connection
      if (context.rtcPeerConnectionActorRef) {
        context.rtcPeerConnectionActorRef.send({ type: 'CLOSE' });
      }
    },
    checkForExistingOffer: ({ context, self }) => {

      console.log('context.eventHistory', context);
      // Check if there's already an offer in the event history
      const existingOffer = context.eventHistory.find(event =>
        event.type === 'sdpOffer' && event.peerId === context.remotePeerId
      );

      if (existingOffer) {
        // If we found an existing offer, process it immediately
        self.send({
          type: 'SIGNALING_EVENTS',
          events: [existingOffer]
        });
      }
    },
  },
}).createMachine({
  id: 'honeyPeerConnection',
  initial: 'idle',
  context: ({ input, spawn, self }) => ({
    localPeer: input.localPeer,
    remotePeerId: input.remotePeerId,
    channel: input.channel,
    rtcConfiguration: input.rtcConfiguration,
    signalingAdapter: input.signalingAdapter,
    parentRef: input.parentRef,
    eventHistory: [],
    presenceSignalActorRef: spawn('HoneyRoomSignal', {
      id: 'presenceSignal',
      input: {
        channel: input.channel,
        signalingAdapter: input.signalingAdapter,
        peer: input.localPeer,
        parentRef: self,
        aliveInterval: 30000
      }
    }),
    peerSignalActorRef: spawn('honeyPeerSignal', {
      id: 'peerSignal',
      input: {
        channel: input.channel,
        signalingAdapter: input.signalingAdapter,
        localPeer: input.localPeer,
        remotePeerId: input.remotePeerId,
        parentRef: self
      }
    }),
  }),
  states: {
    idle: {
      on: {
        START: {
          target: 'connecting',
          actions: ['spawnRTCPeerConnection', 'startPresenceSignal', 'startPeerSignal']
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
          target: 'waitingForOffer',
          guard: ({ context }) => context.isInitiator === false
        }
      ],
      on: {
        SIGNALING_EVENTS: {
          actions: ['updateEventHistory', 'processSignalingEvents', 'determineInitiator']
        },
        PRESENCE_EVENTS: {
          actions: [({ self, event }) => {
            // Forward presence events as signaling events
            self.send({ type: 'SIGNALING_EVENTS', events: event.data.events });
          }]
        },
        PEER_SIGNAL_EVENTS: {
          actions: [({ self, event }) => {
            // Forward peer signal events as signaling events
            self.send({ type: 'SIGNALING_EVENTS', events: event.data.events });
          }]
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
        },
        PRESENCE_EVENTS: {
          actions: [({ self, event }) => {
            // Forward presence events as signaling events
            self.send({ type: 'SIGNALING_EVENTS', events: event.data.events });
          }]
        },
        PEER_SIGNAL_EVENTS: {
          actions: [({ self, event }) => {
            // Forward peer signal events as signaling events
            self.send({ type: 'SIGNALING_EVENTS', events: event.data.events });
          }]
        }
      }
    },
    waitingForOffer: {
      entry: ['checkForExistingOffer'],
      on: {
        SIGNALING_EVENTS: [
          {
            target: 'processingOffer',
            actions: ['updateEventHistory', 'processSignalingEvents']
          },
          {
            actions: ['updateEventHistory', 'processSignalingEvents']
          }
        ],
        PRESENCE_EVENTS: {
          actions: [({ self, event }) => {
            // Forward presence events as signaling events
            self.send({ type: 'SIGNALING_EVENTS', events: event.data.events });
          }]
        },
        PEER_SIGNAL_EVENTS: {
          actions: [({ self, event }) => {
            // Forward peer signal events as signaling events
            self.send({ type: 'SIGNALING_EVENTS', events: event.data.events });
          }]
        }
      }
    },
    waitingForAnswer: {
      on: {
        SIGNALING_EVENTS: [
          {
            target: 'connected',
            actions: [
              'updateEventHistory',
              'processSignalingEvents',
              ({ event, context }) => {
                // Process incoming answer
                const signalingEvents = event.events;
                const answerEvent = signalingEvents.find((e: any) => e.type === 'sdpAnswer')

                if ('sdpAnswer' in answerEvent) {
                  context.rtcPeerConnectionActorRef?.send({
                    type: 'SET_REMOTE_DESCRIPTION',
                    description: answerEvent.sdpAnswer,
                  });
                }
              }
            ]
          },
          {
            actions: ['updateEventHistory', 'processSignalingEvents']
          }
        ],
        PRESENCE_EVENTS: {
          actions: [({ self, event }) => {
            // Forward presence events as signaling events
            self.send({ type: 'SIGNALING_EVENTS', events: event.data.events });
          }]
        },
        PEER_SIGNAL_EVENTS: {
          actions: [({ self, event }) => {
            // Forward peer signal events as signaling events
            self.send({ type: 'SIGNALING_EVENTS', events: event.data.events });
          }]
        }
      }
    },
    processingOffer: {
      entry: [
        ({ event, context }) => {
          // Find the offer in the signaling events

          const signalingEvents = event.events;
          const offerEvent = signalingEvents.find((e: any) => e.type === 'sdpOffer');
          console.log('Processing offer', { event, context, signalingEvents, offerEvent });

          if (offerEvent && context.rtcPeerConnectionActorRef) {
            // Set remote description first
            context.rtcPeerConnectionActorRef?.send({
              type: 'SET_REMOTE_DESCRIPTION',
              description: offerEvent.data
            });
            // Then create answer
            context.rtcPeerConnectionActorRef?.send({
              type: 'CREATE_ANSWER',
              offer: offerEvent.data
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
        },
        PRESENCE_EVENTS: {
          actions: [({ self, event }) => {
            // Forward presence events as signaling events
            self.send({ type: 'SIGNALING_EVENTS', events: event.data.events });
          }]
        },
        PEER_SIGNAL_EVENTS: {
          actions: [({ self, event }) => {
            // Forward peer signal events as signaling events
            self.send({ type: 'SIGNALING_EVENTS', events: event.data.events });
          }]
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
        PRESENCE_EVENTS: {
          actions: [({ self, event }) => {
            // Forward presence events as signaling events
            self.send({ type: 'SIGNALING_EVENTS', events: event.data.events });
          }]
        },
        PEER_SIGNAL_EVENTS: {
          actions: [({ self, event }) => {
            // Forward peer signal events as signaling events
            self.send({ type: 'SIGNALING_EVENTS', events: event.data.events });
          }]
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