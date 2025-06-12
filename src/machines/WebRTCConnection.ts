import { createMachine, assign, fromPromise, setup } from 'xstate';
import { SignalingEvent } from '../adapters/InMemorySignalingAdapter';
import { Channel } from '../Channel';
import { WebRTCSignal } from './WebRTCSignal';

export interface ConnectionContext {
  peerInitiatorId?: string;
  connectionInput: ConnectionInput;
  peerConnection?: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  error?: string;
  eventHistory: Array<{
    timestamp: number;
    event: ConnectionEvent;
    state: string;
  }>;
  webRTCSignalActor?: any;
}

export interface ConnectionInput {
  channel: Channel<any>;
  peer: {
    id: string;
  };
  rtcConfiguration: RTCConfiguration;
}

export type ConnectionEvent =
  | { type: 'SIGNAL_JOIN_EVENT'; event: SignalingEvent; origin: 'main' | 'polling' | 'internals' }
  | { type: 'SIGNAL_SDP_OFFER_EVENT'; event: SignalingEvent; origin: 'main' | 'polling' | 'internals' }
  | { type: 'SIGNAL_SDP_ANSWER_EVENT'; event: SignalingEvent; origin: 'main' | 'polling' | 'internals' }
  | { type: 'SIGNAL_ICE_EVENT'; event: SignalingEvent; origin: 'main' | 'polling' | 'internals' }
  | { type: 'PC_ICE_CANDIDATE'; candidate: RTCIceCandidate | null; origin: 'main' | 'polling' | 'internals' }
  | { type: 'PC_CONNECTION_STATE_CHANGE'; state: RTCPeerConnectionState; origin: 'main' | 'polling' | 'internals' }
  | { type: 'PC_ICE_CONNECTION_STATE_CHANGE'; state: RTCIceConnectionState; origin: 'main' | 'polling' | 'internals' }
  | { type: 'PC_SIGNALING_STATE_CHANGE'; state: RTCSignalingState; origin: 'main' | 'polling' | 'internals' }
  | { type: 'PC_DATA_CHANNEL'; channel: RTCDataChannel; origin: 'main' | 'polling' | 'internals' }
  | { type: 'DC_OPEN'; origin: 'main' | 'polling' | 'internals' }
  | { type: 'DC_MESSAGE'; data: string; origin: 'main' | 'polling' | 'internals' }
  | { type: 'DC_ERROR'; error: any; origin: 'main' | 'polling' | 'internals' }
  | { type: 'DC_CLOSE'; origin: 'main' | 'polling' | 'internals' }
  | { type: 'SETUP_DATA_CHANNEL'; channel: RTCDataChannel; origin: 'main' | 'polling' | 'internals' }
  | { type: 'SEND_MESSAGE'; message: string; origin: 'main' | 'polling' | 'internals' }
  | { type: 'CLOSE_CONNECTION'; origin: 'main' | 'polling' | 'internals' }
  | { type: 'ERROR'; error: string; origin: 'main' | 'polling' | 'internals' }
  | { type: 'POLLING_EVENTS'; data: { events: SignalingEvent[]; newLastSeenIndex: number }; origin: 'main' | 'polling' | 'internals' }

export const WebRTCConnection = setup({
  types: {
    context: {} as ConnectionContext,
    events: {} as ConnectionEvent,
    input: {} as ConnectionInput,
  },
  actors: {
    createOfferActor: fromPromise(async ({ input }: { input: { pc: RTCPeerConnection } }) => {
      console.log(`[CreateOfferActor] Creating offer...`);
      console.log(`[CreateOfferActor] Peer connection state:`, input.pc.connectionState);
      console.log(`[CreateOfferActor] Signaling state:`, input.pc.signalingState);

      try {
        const offer = await input.pc.createOffer();
        console.log(`[CreateOfferActor] Offer created:`, offer.type);
        await input.pc.setLocalDescription(offer);
        console.log(`[CreateOfferActor] Local description set successfully`);
        return offer;
      } catch (error) {
        console.error(`[CreateOfferActor] Error creating offer:`, error);
        throw error;
      }
    }),
    createAnswerActor: fromPromise(async ({ input }: { input: { pc: RTCPeerConnection; offer: RTCSessionDescriptionInit } }) => {
      console.log(`Creating answer...`);
      await input.pc.setRemoteDescription(new RTCSessionDescription(input.offer));
      const answer = await input.pc.createAnswer();
      await input.pc.setLocalDescription(answer);
      return answer;
    }),
    handleRemoteSDPActor: fromPromise(async ({ input }: { input: { pc: RTCPeerConnection; sdp: RTCSessionDescriptionInit } }) => {
      console.log(`Processing remote SDP:`, input.sdp.type);
      await input.pc.setRemoteDescription(new RTCSessionDescription(input.sdp));
    }),
    WebRTCSignal: WebRTCSignal,
  },
  guards: {
    isInitiator: ({ context, event }) => {
      // We're the initiator if:
      // 1. This is our own join event AND
      // 2. Either no initiator is set OR we are the initiator
      return event.type === 'SIGNAL_JOIN_EVENT' &&
        event.event.peerId === context.connectionInput.peer.id &&
        (!context.peerInitiatorId || context.peerInitiatorId === context.connectionInput.peer.id);
    },
    isNonInitiator: ({ context, event }) => {
      // We're not the initiator if:
      // 1. This is our own join event AND
      // 2. Someone else is already the initiator
      return event.type === 'SIGNAL_JOIN_EVENT' &&
        event.event.peerId === context.connectionInput.peer.id &&
        context.peerInitiatorId &&
        context.peerInitiatorId !== context.connectionInput.peer.id;
    },
  },
  actions: {
    trackEvent: assign({
      eventHistory: ({ context, event, self }) => {
        const currentState = self.getSnapshot().value;
        return [...context.eventHistory, {
          timestamp: Date.now(),
          event: event as ConnectionEvent,
          state: String(currentState)
        }];
      }
    }),
    createPeerConnection: assign({
      peerConnection: ({ context }) => {
        console.log(`[${context.connectionInput.peer.id}] Creating RTCPeerConnection for channel ${context.connectionInput.channel.id}...`);
        console.log(`[${context.connectionInput.peer.id}] RTC Configuration:`, context.connectionInput.rtcConfiguration);

        try {
          const pc = new RTCPeerConnection(context.connectionInput.rtcConfiguration);
          console.log(`[${context.connectionInput.peer.id}] RTCPeerConnection created successfully`);
          console.log(`[${context.connectionInput.peer.id}] Initial connection state:`, pc.connectionState);
          console.log(`[${context.connectionInput.peer.id}] Initial signaling state:`, pc.signalingState);
          return pc;
        } catch (error) {
          console.error(`[${context.connectionInput.peer.id}] Failed to create RTCPeerConnection:`, error);
          throw error;
        }
      }
    }),
    setupPeerConnection: ({ context, self }) => {
      const pc = context.peerConnection;
      if (!pc) return;

      console.log(`[${context.connectionInput.peer.id}] Setting up peer connection event handlers for channel ${context.connectionInput.channel.id}...`);

      // Connection state monitoring
      pc.onconnectionstatechange = () => {
        self.send({ type: 'PC_CONNECTION_STATE_CHANGE', state: pc.connectionState, origin: 'internals' });
      };

      pc.oniceconnectionstatechange = () => {
        self.send({ type: 'PC_ICE_CONNECTION_STATE_CHANGE', state: pc.iceConnectionState, origin: 'internals' });
      };

      pc.onsignalingstatechange = () => {
        self.send({ type: 'PC_SIGNALING_STATE_CHANGE', state: pc.signalingState, origin: 'internals' });
      };

      // ICE candidate handling
      pc.onicecandidate = (event) => {
        self.send({ type: 'PC_ICE_CANDIDATE', candidate: event.candidate, origin: 'internals' });
      };

      // Handle incoming data channels (for non-initiators)
      pc.ondatachannel = (event) => {
        self.send({ type: 'PC_DATA_CHANNEL', channel: event.channel, origin: 'internals' });
      };
    },
    setupDataChannel: assign({
      dataChannel: ({ event }) => {
        const dataChannel = (event as any).channel as RTCDataChannel;
        if (!dataChannel) return undefined;

        return dataChannel;
      }
    }),
    setupDataChannelHandlers: ({ context, self }) => {
      const dataChannel = context.dataChannel;
      if (!dataChannel) return;

      console.log(`[${context.connectionInput.peer.id}] Setting up data channel event handlers for channel ${context.connectionInput.channel.id}`);

      dataChannel.onopen = () => {
        self.send({ type: 'DC_OPEN', origin: 'internals' });
      };

      dataChannel.onmessage = (event) => {
        self.send({ type: 'DC_MESSAGE', data: event.data, origin: 'internals' });
      };

      dataChannel.onerror = (error) => {
        self.send({ type: 'DC_ERROR', error, origin: 'internals' });
      };

      dataChannel.onclose = () => {
        self.send({ type: 'DC_CLOSE', origin: 'internals' });
      };
    },
    sendMessage: ({ context, event }) => {
      if (event.type !== 'SEND_MESSAGE') return;

      const dataChannel = context.dataChannel;
      if (!dataChannel || dataChannel.readyState !== 'open') {
        console.warn(`[${context.connectionInput.peer.id}] Data channel not ready for sending on channel ${context.connectionInput.channel.id}`);
        return;
      }

      dataChannel.send(event.message);
      console.log(`[${context.connectionInput.peer.id}] 📤 Sent message on channel ${context.connectionInput.channel.id}:`, event.message);
    },
    sendJoinEvent: async ({ context }) => {
      console.log(`[${context.connectionInput.peer.id}] Sending join event to channel ${context.connectionInput.channel.id}`);
      await context.connectionInput.channel.signalingAdapter.push(context.connectionInput.channel.id, {
        peerId: context.connectionInput.peer.id,
        type: 'join'
      });
    },
    logInitiator: ({ context }) => {
      console.log(`[${context.connectionInput.peer.id}] I am the initiator, will create offer`);
    },
    logNonInitiator: ({ context }) => {
      console.log(`[${context.connectionInput.peer.id}] I am not the initiator, waiting for offer`);
    },
    createDataChannel: ({ context, self }) => {
      console.log(`[${context.connectionInput.peer.id}] Creating data channel as initiator`);
      const pc = context.peerConnection;
      if (!pc) {
        console.error(`[${context.connectionInput.peer.id}] No peer connection available for data channel creation!`);
        return;
      }

      console.log(`[${context.connectionInput.peer.id}] Peer connection state:`, pc.connectionState);
      const dataChannel = pc.createDataChannel("chat", { ordered: true });
      console.log(`[${context.connectionInput.peer.id}] Data channel created:`, dataChannel.label, dataChannel.readyState);
      // Store it in context by sending a setup event
      self.send({ type: 'SETUP_DATA_CHANNEL', channel: dataChannel, origin: 'main' });
    },
    sendOfferToSignaling: async ({ context, event }) => {
      const offer = (event as any).output;
      console.log(`[${context.connectionInput.peer.id}] Sending offer via signaling:`, offer.type);
      await context.connectionInput.channel.signalingAdapter.push(context.connectionInput.channel.id, {
        peerId: context.connectionInput.peer.id,
        type: 'sdp',
        data: { sdp: offer }
      });
      console.log(`[${context.connectionInput.peer.id}] Offer sent successfully to signaling adapter`);
    },
    sendAnswerToSignaling: async ({ context, event }) => {
      console.log(`[${context.connectionInput.peer.id}] Sending answer via signaling`);
      await context.connectionInput.channel.signalingAdapter.push(context.connectionInput.channel.id, {
        peerId: context.connectionInput.peer.id,
        type: 'sdp',
        data: { sdp: (event as any).output }
      });
    },
    handlePeerConnectionIceCandidate: async ({ context, event }) => {
      if (event.type === 'PC_ICE_CANDIDATE' && event.candidate) {
        console.log(`[${context.connectionInput.peer.id}] Sending ICE candidate for channel ${context.connectionInput.channel.id}`);
        await context.connectionInput.channel.signalingAdapter.push(context.connectionInput.channel.id, {
          peerId: context.connectionInput.peer.id,
          type: 'ice',
          data: { iceCandidate: event.candidate }
        });
      } else if (event.type === 'PC_ICE_CANDIDATE') {
        console.log(`[${context.connectionInput.peer.id}] ICE gathering complete for channel ${context.connectionInput.channel.id}`);
      }
    },
    logConnectionStateChange: ({ context, event }) => {
      if (event.type === 'PC_CONNECTION_STATE_CHANGE') {
        console.log(`[${context.connectionInput.peer.id}] Connection state for channel ${context.connectionInput.channel.id}:`, event.state);
      }
    },
    logIceConnectionStateChange: ({ context, event }) => {
      if (event.type === 'PC_ICE_CONNECTION_STATE_CHANGE') {
        console.log(`[${context.connectionInput.peer.id}] ICE connection state for channel ${context.connectionInput.channel.id}:`, event.state);
      }
    },
    logSignalingStateChange: ({ context, event }) => {
      if (event.type === 'PC_SIGNALING_STATE_CHANGE') {
        console.log(`[${context.connectionInput.peer.id}] Signaling state for channel ${context.connectionInput.channel.id}:`, event.state);
      }
    },
    handleIncomingDataChannel: ({ context, event, self }) => {
      if (event.type === 'PC_DATA_CHANNEL') {
        console.log(`[${context.connectionInput.peer.id}] Received data channel for channel ${context.connectionInput.channel.id}`);
        // Set up the data channel event handlers
        self.send({ type: 'SETUP_DATA_CHANNEL', channel: event.channel, origin: 'main' });
      }
    },
    handleDataChannelOpen: ({ context }) => {
      console.log(`[${context.connectionInput.peer.id}] ✅ Data channel opened for channel ${context.connectionInput.channel.id}!`);
    },
    notifyMessageRecevied: ({ context, event }) => {
      if (event.type === 'DC_MESSAGE') {
        console.log(`[${context.connectionInput.peer.id}] 📨 Received message on channel ${context.connectionInput.channel.id}:`, event.data);
        context.connectionInput.channel.notifyMessageRecevied(event.data);
      }
    },
    handleDataChannelError: ({ context, event }) => {
      if (event.type === 'DC_ERROR') {
        console.error(`[${context.connectionInput.peer.id}] Data channel error for channel ${context.connectionInput.channel.id}:`, event.error);
      }
    },
    handleDataChannelClose: ({ context }) => {
      console.log(`[${context.connectionInput.peer.id}] Data channel closed for channel ${context.connectionInput.channel.id}`);
    },
    handleIceCandidateEvent: async ({ event, context, self }) => {
      // Only process ICE candidates immediately if we're in connected state
      if (event.type === 'SIGNAL_ICE_EVENT' &&
        event.event.data?.iceCandidate &&
        self.getSnapshot().value === 'connected' &&
        context.peerConnection) {
        console.log(`[${context.connectionInput.peer.id}] Processing ICE candidate immediately (connected state)`);
        await context.peerConnection.addIceCandidate(new RTCIceCandidate(event.event.data.iceCandidate));
      } else if (event.type === 'SIGNAL_ICE_EVENT') {
        console.log(`[${context.connectionInput.peer.id}] ICE candidate stored in event history (not connected yet)`);
      }
    },
    processBufferedIceCandidates: async ({ context }) => {
      // Filter ICE candidates from event history, excluding self events
      const iceEvents = context.eventHistory
        .filter(entry =>
          entry.event.type === 'SIGNAL_ICE_EVENT' &&
          (entry.event as any).event.peerId !== context.connectionInput.peer.id
        )
        .map(entry => (entry.event as any).event);

      console.log(`[${context.connectionInput.peer.id}] Processing ${iceEvents.length} ICE candidates from event history (excluding self)`);
      const pc = context.peerConnection;
      if (!pc) return;

      for (const event of iceEvents) {
        if (event.data?.iceCandidate) {
          await pc.addIceCandidate(new RTCIceCandidate(event.data.iceCandidate));
        }
      }
    },
    closeConnection: ({ context }) => {
      console.log(`[${context.connectionInput.peer.id}] Closing connection for channel ${context.connectionInput.channel.id}`);

      try {
        // Stop polling actor
        if (context.webRTCSignalActor) {
          console.log(`[${context.connectionInput.peer.id}] Stopping polling actor for channel ${context.connectionInput.channel.id}`);
          context.webRTCSignalActor.stop();
        }

        // Remove all event listeners from data channel
        if (context.dataChannel) {
          console.log(`[${context.connectionInput.peer.id}] Closing data channel for channel ${context.connectionInput.channel.id}`);

          // Remove event listeners
          context.dataChannel.onopen = null;
          context.dataChannel.onmessage = null;
          context.dataChannel.onerror = null;
          context.dataChannel.onclose = null;

          // Close the channel
          if (context.dataChannel.readyState !== 'closed') {
            context.dataChannel.close();
          }
        }

        // Remove all event listeners from peer connection
        if (context.peerConnection) {
          console.log(`[${context.connectionInput.peer.id}] Closing peer connection for channel ${context.connectionInput.channel.id}`);

          // Remove event listeners
          context.peerConnection.onicecandidate = null;
          context.peerConnection.onconnectionstatechange = null;
          context.peerConnection.oniceconnectionstatechange = null;
          context.peerConnection.onsignalingstatechange = null;
          context.peerConnection.ondatachannel = null;
          context.peerConnection.ontrack = null;

          // Close all transceivers
          const transceivers = context.peerConnection.getTransceivers();
          transceivers.forEach(transceiver => {
            if (transceiver.stop) {
              transceiver.stop();
            }
          });

          // Close the connection
          if (context.peerConnection.connectionState !== 'closed') {
            context.peerConnection.close();
          }
        }

        // Event history will be cleared when state machine stops

        console.log(`[${context.connectionInput.peer.id}] All resources cleaned up for channel ${context.connectionInput.channel.id}`);
      } catch (error) {
        console.error(`[${context.connectionInput.peer.id}] Error during cleanup:`, error);
      }
    },
    processPollingEvents: ({ context, event, self }) => {
      if (event.type === 'POLLING_EVENTS') {
        const { events } = event.data;
        console.log(`[${context.connectionInput.peer.id}] Processing ${events.length} polled events from polling actor`);

        // Log all events before filtering
        events.forEach(signalingEvent => {
          console.log(`[${context.connectionInput.peer.id}] Raw event: ${signalingEvent.type} from ${signalingEvent.peerId}`);
        });

        // Filter out SDP and ICE events from self to prevent self-connection
        // But keep JOIN events as they're needed for initiator determination
        const filteredEvents = events.filter(signalingEvent => {
          if (signalingEvent.type === 'join') {
            return true; // Always process JOIN events, even from self
          }
          // Filter out SDP and ICE events from self
          const shouldKeep = signalingEvent.peerId !== context.connectionInput.peer.id;
          if (!shouldKeep) {
            console.log(`[${context.connectionInput.peer.id}] Filtering out ${signalingEvent.type} event from self`);
          }
          return shouldKeep;
        });

        console.log(`[${context.connectionInput.peer.id}] Processing ${filteredEvents.length} events after filtering (original: ${events.length})`);

        // Process each event by sending it to the state machine
        for (const signalingEvent of filteredEvents) {
          const currentState = self.getSnapshot().value;
          console.log(`[${context.connectionInput.peer.id}] State: ${currentState}, Processing ${signalingEvent.type} event from ${signalingEvent.peerId}`);

          try {
            if (signalingEvent.type === 'join') {
              self.send({ type: 'SIGNAL_JOIN_EVENT', event: signalingEvent, origin: 'main' });
            } else if (signalingEvent.type === 'sdp') {
              const sdpType = signalingEvent.data?.sdp?.type;
              if (sdpType === 'offer') {
                self.send({ type: 'SIGNAL_SDP_OFFER_EVENT', event: signalingEvent, origin: 'main' });
              } else if (sdpType === 'answer') {
                self.send({ type: 'SIGNAL_SDP_ANSWER_EVENT', event: signalingEvent, origin: 'main' });
              }
            } else if (signalingEvent.type === 'ice') {
              self.send({ type: 'SIGNAL_ICE_EVENT', event: signalingEvent, origin: 'main' });
            }
          } catch (error) {
            console.error(`[${context.connectionInput.peer.id}] Error processing polled event:`, error);
            self.send({ type: 'ERROR', error: String(error), origin: 'main' });
          }
        }
      }
    }
  }
}).createMachine({
  id: 'webrtcConnection',
  initial: 'waitingForPeers',
  entry: ['createPeerConnection', 'setupPeerConnection', 'sendJoinEvent'],
  exit: ['closeConnection'],
  context: ({ input, spawn, self }) => {
    const webRTCSignalActor = spawn('WebRTCSignal', {
      id: 'polling',
      input: {
        channel: input.channel,
        parentRef: self,
        pollCount: 0,
      }
    });

    return {
      connectionInput: input,
      eventHistory: [],
      webRTCSignalActor
    };
  },
  on: {
    // Global ICE event handler - works in all states
    SIGNAL_ICE_EVENT: {
      actions: [
        'trackEvent',
        'handleIceCandidateEvent'
      ]
    },
    // WebRTC Peer Connection Events
    PC_ICE_CANDIDATE: {
      actions: ['trackEvent', 'handlePeerConnectionIceCandidate']
    },
    PC_CONNECTION_STATE_CHANGE: {
      actions: ['trackEvent', 'logConnectionStateChange']
    },
    PC_ICE_CONNECTION_STATE_CHANGE: {
      actions: ['trackEvent', 'logIceConnectionStateChange']
    },
    PC_SIGNALING_STATE_CHANGE: {
      actions: ['trackEvent', 'logSignalingStateChange']
    },
    PC_DATA_CHANNEL: {
      actions: ['trackEvent', 'handleIncomingDataChannel']
    },
    // Data Channel Events
    DC_OPEN: {
      actions: ['trackEvent', 'handleDataChannelOpen']
    },
    DC_MESSAGE: {
      actions: ['trackEvent', 'notifyMessageRecevied']
    },
    DC_ERROR: {
      actions: ['trackEvent', 'handleDataChannelError']
    },
    DC_CLOSE: {
      actions: ['trackEvent', 'handleDataChannelClose']
    },
    SETUP_DATA_CHANNEL: {
      actions: ['trackEvent', 'setupDataChannel', 'setupDataChannelHandlers']
    },
    SEND_MESSAGE: {
      actions: ['trackEvent', 'sendMessage']
    },
    CLOSE_CONNECTION: {
      target: '.closing',
      actions: ['trackEvent']
    },
    POLLING_EVENTS: {
      actions: ['trackEvent', 'processPollingEvents']
    },
    // Track all other events globally
    '*': {
      actions: ['trackEvent']
    }
  },
  states: {
    waitingForPeers: {
      on: {
        CLOSE_CONNECTION: {
          target: 'closing'
        },
        SIGNAL_JOIN_EVENT: [
          {
            target: 'creatingOffer',
            guard: 'isInitiator',
            actions: [
              assign({
                peerInitiatorId: ({ context, event }) => {
                  return context.peerInitiatorId || event.event.peerId;
                }
              }),
              'logInitiator'
            ]
          },
          {
            target: 'waitingForOffer',
            guard: 'isNonInitiator',
            actions: [
              assign({
                peerInitiatorId: ({ context, event }) => {
                  return context.peerInitiatorId || event.event.peerId;
                }
              }),
              'logNonInitiator'
            ]
          },
          {
            actions: assign({
              peerInitiatorId: ({ context, event }) => {
                return context.peerInitiatorId || event.event.peerId;
              }
            })
          }
        ]
      }
    },

    creatingOffer: {
      entry: [
        'createDataChannel',
        ({ context }) => {
          console.log(`[${context.connectionInput.peer.id}] Entered creatingOffer state`);
        }
      ],
      on: {
        CLOSE_CONNECTION: {
          target: 'closing'
        }
      },
      invoke: {
        src: 'createOfferActor',
        input: ({ context }) => {
          console.log(`[${context.connectionInput.peer.id}] Invoking createOfferActor with peer connection`);
          if (!context.peerConnection) {
            console.error(`[${context.connectionInput.peer.id}] ERROR: No peer connection available!`);
          }
          return { pc: context.peerConnection! };
        },
        onDone: {
          target: 'waitingForAnswer',
          actions: [
            ({ context }) => {
              console.log(`[${context.connectionInput.peer.id}] CreateOfferActor completed successfully, sending offer`);
            },
            'sendOfferToSignaling'
          ]
        },
        onError: {
          target: 'error',
          actions: [
            ({ context, event }) => {
              console.error(`[${context.connectionInput.peer.id}] CreateOfferActor failed:`, event.error);
            },
            assign({ error: ({ event }) => String(event.error) })
          ]
        }
      }
    },

    waitingForAnswer: {
      entry: [
        ({ context }) => {
          console.log(`[${context.connectionInput.peer.id}] Entered waitingForAnswer state - offer sent, waiting for answer`);
        },
        ({ context, self }) => {
          // Check if there's already an answer in the event history
          const answerEvent = context.eventHistory.find(entry =>
            entry.event.type === 'SIGNAL_SDP_ANSWER_EVENT' &&
            (entry.event as any).event.peerId !== context.connectionInput.peer.id
          );

          if (answerEvent) {
            console.log(`[${context.connectionInput.peer.id}] Found existing answer in event history, processing it`);
            // Re-send the answer event to trigger state transition
            self.send({
              type: 'SIGNAL_SDP_ANSWER_EVENT',
              event: (answerEvent.event as any).event,
              origin: 'main'
            });
          } else {
            console.log(`[${context.connectionInput.peer.id}] No existing answer found in event history`);
          }
        }
      ],
      on: {
        CLOSE_CONNECTION: {
          target: 'closing'
        },
        SIGNAL_SDP_ANSWER_EVENT: {
          target: 'processingAnswer',
          actions: [
            ({ context }) => {
              console.log(`[${context.connectionInput.peer.id}] Received SDP answer, transitioning to processingAnswer`);
            }
          ]
        }
      }
    },

    waitingForOffer: {
      entry: [
        ({ context }) => {
          console.log(`[${context.connectionInput.peer.id}] Entered waitingForOffer state - waiting for SDP offer from initiator`);
        },
        ({ context, self }) => {
          // Check if there's already an offer in the event history
          const offerEvent = context.eventHistory.find(entry =>
            entry.event.type === 'SIGNAL_SDP_OFFER_EVENT' &&
            (entry.event as any).event.peerId !== context.connectionInput.peer.id
          );

          if (offerEvent) {
            console.log(`[${context.connectionInput.peer.id}] Found existing offer in event history, processing it`);
            // Re-send the offer event to trigger state transition
            self.send({
              type: 'SIGNAL_SDP_OFFER_EVENT',
              event: (offerEvent.event as any).event,
              origin: 'main'
            });
          } else {
            console.log(`[${context.connectionInput.peer.id}] No existing offer found in event history`);
          }
        }
      ],
      on: {
        CLOSE_CONNECTION: {
          target: 'closing'
        },
        SIGNAL_SDP_OFFER_EVENT: {
          target: 'creatingAnswer',
          actions: [
            ({ context }) => {
              console.log(`[${context.connectionInput.peer.id}] Received SDP offer, transitioning to creatingAnswer`);
            }
          ]
        }
      }
    },

    creatingAnswer: {
      on: {
        CLOSE_CONNECTION: {
          target: 'closing'
        }
      },
      invoke: {
        src: 'createAnswerActor',
        input: ({ event, context }) => ({
          pc: context.peerConnection!,
          offer: event.type === 'SIGNAL_SDP_OFFER_EVENT' ? event.event.data?.sdp : null
        }),
        onDone: {
          target: 'connected',
          actions: 'sendAnswerToSignaling'
        },
        onError: {
          target: 'error',
          actions: assign({ error: ({ event }) => String(event.error) })
        }
      }
    },

    processingAnswer: {
      on: {
        CLOSE_CONNECTION: {
          target: 'closing'
        }
      },
      invoke: {
        src: 'handleRemoteSDPActor',
        input: ({ event, context }) => ({
          pc: context.peerConnection!,
          sdp: event.type === 'SIGNAL_SDP_ANSWER_EVENT' ? event.event.data?.sdp : null
        }),
        onDone: {
          target: 'connected'
        },
        onError: {
          target: 'error',
          actions: assign({ error: ({ event }) => String(event.error) })
        }
      }
    },

    connected: {
      entry: ['processBufferedIceCandidates'],
      on: {
        CLOSE_CONNECTION: {
          target: 'closing'
        }
      }
    },

    closing: {
      entry: ['closeConnection'],
      type: 'final'
    },

    error: {
      type: 'final',
      entry: ['closeConnection']
    }
  }
});

