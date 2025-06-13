import * as x from 'xstate';
import { Channel } from '../Channel';
import { Peer } from '../Peer';
import { SignalingEvent } from '../adapters/InMemorySignalingAdapter';

interface ChannelPeerConnectionContext {
  localPeer: Peer;
  remotePeerId: string;
  channel: Channel<any>;
  rtcConfiguration: RTCConfiguration;
  peerConnection?: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  isInitiator?: boolean;
  eventHistory: SignalingEvent[];
  parentRef: any;
}

interface ChannelPeerConnectionInput {
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
  | { type: 'PC_ICE_CANDIDATE'; candidate: RTCIceCandidate | null }
  | { type: 'PC_CONNECTION_STATE_CHANGE'; state: RTCPeerConnectionState }
  | { type: 'PC_DATA_CHANNEL'; channel: RTCDataChannel }
  | { type: 'DC_OPEN' }
  | { type: 'DC_MESSAGE'; data: string }
  | { type: 'DC_CLOSE' }
  | { type: 'DC_ERROR'; error: any };

export const ChannelPeerConnectionMachine = x.setup({
  types: {
    context: {} as ChannelPeerConnectionContext,
    events: {} as PeerConnectionEvent,
    input: {} as ChannelPeerConnectionInput,
  },
  actors: {
    createOffer: x.fromPromise(async ({ input }: { input: { pc: RTCPeerConnection } }) => {
      const offer = await input.pc.createOffer();
      await input.pc.setLocalDescription(offer);
      return offer;
    }),
    createAnswer: x.fromPromise(async ({ input }: { input: { pc: RTCPeerConnection; offer: RTCSessionDescriptionInit } }) => {
      await input.pc.setRemoteDescription(new RTCSessionDescription(input.offer));
      const answer = await input.pc.createAnswer();
      await input.pc.setLocalDescription(answer);
      return answer;
    }),
    processRemoteSDP: x.fromPromise(async ({ input }: { input: { pc: RTCPeerConnection; sdp: RTCSessionDescriptionInit } }) => {
      await input.pc.setRemoteDescription(new RTCSessionDescription(input.sdp));
    }),
  },
  guards: {
    shouldInitiate: ({ context }) => {
      // Check event history to see if anyone has already sent an offer
      const hasExistingOffer = context.eventHistory.some(event => 
        event.type === 'sdp' && 
        event.data?.sdp?.type === 'offer' &&
        (event.peerId === context.localPeer.id || event.peerId === context.remotePeerId)
      );
      
      if (hasExistingOffer) {
        // Someone already initiated, don't initiate again
        return false;
      }
      
      // Use lexicographical comparison as fallback
      return context.localPeer.id < context.remotePeerId;
    },
    isOfferForUs: ({ event }) => {
      if (event.type !== 'SIGNALING_EVENTS') return false;
      
      return event.events.some(signalingEvent => 
        signalingEvent.type === 'sdp' && 
        signalingEvent.data?.sdp?.type === 'offer'
      );
    },
    isAnswerForUs: ({ event }) => {
      if (event.type !== 'SIGNALING_EVENTS') return false;
      
      return event.events.some(signalingEvent => 
        signalingEvent.type === 'sdp' && 
        signalingEvent.data?.sdp?.type === 'answer'
      );
    },
  },
  actions: {
    createPeerConnection: x.assign({
      peerConnection: ({ context }) => {
        const pc = new RTCPeerConnection(context.rtcConfiguration);
        return pc;
      }
    }),
    setupPeerConnection: ({ context, self }) => {
      const pc = context.peerConnection;
      if (!pc) return;

      pc.onicecandidate = (event) => {
        self.send({ type: 'PC_ICE_CANDIDATE', candidate: event.candidate });
      };

      pc.onconnectionstatechange = () => {
        self.send({ type: 'PC_CONNECTION_STATE_CHANGE', state: pc.connectionState });
      };

      pc.ondatachannel = (event) => {
        self.send({ type: 'PC_DATA_CHANNEL', channel: event.channel });
      };
    },
    determineInitiator: x.assign({
      isInitiator: ({ context }) => {
        // Look for the first SDP offer in event history
        const firstOffer = context.eventHistory.find(event => 
          event.type === 'sdp' && event.data?.sdp?.type === 'offer'
        );
        
        if (firstOffer) {
          // If there's already an offer, we're the initiator if we sent it
          return firstOffer.peerId === context.localPeer.id;
        }
        
        // No offers yet, use lexicographical comparison
        return context.localPeer.id < context.remotePeerId;
      }
    }),
    createDataChannel: x.assign({
      dataChannel: ({ context }) => {
        const pc = context.peerConnection;
        if (!pc) return undefined;
        
        const dataChannel = pc.createDataChannel('peer-connection', { ordered: true });
        return dataChannel;
      }
    }),
    setupDataChannel: x.assign({
      dataChannel: ({ event }) => {
        const dataChannel = (event as any).channel as RTCDataChannel;
        return dataChannel;
      }
    }),
    setupDataChannelHandlers: ({ context, self }) => {
      const dataChannel = context.dataChannel;
      if (!dataChannel) return;

      dataChannel.onopen = () => {
        self.send({ type: 'DC_OPEN' });
      };

      dataChannel.onmessage = (event) => {
        self.send({ type: 'DC_MESSAGE', data: event.data });
      };

      dataChannel.onerror = (error) => {
        self.send({ type: 'DC_ERROR', error });
      };

      dataChannel.onclose = () => {
        self.send({ type: 'DC_CLOSE' });
      };
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
      const offer = (event as any).output;
      await context.channel.signalingAdapter.push(context.channel.id, {
        peerId: context.localPeer.id,
        type: 'sdp',
        data: { sdp: offer, targetPeer: context.remotePeerId }
      });
    },
    sendAnswer: async ({ context, event }) => {
      const answer = (event as any).output;
      await context.channel.signalingAdapter.push(context.channel.id, {
        peerId: context.localPeer.id,
        type: 'sdp',
        data: { sdp: answer, targetPeer: context.remotePeerId }
      });
    },
    sendIceCandidate: async ({ context, event }) => {
      if (event.type === 'PC_ICE_CANDIDATE' && event.candidate) {
        await context.channel.signalingAdapter.push(context.channel.id, {
          peerId: context.localPeer.id,
          type: 'ice',
          data: { iceCandidate: event.candidate, targetPeer: context.remotePeerId }
        });
      }
    },
    processSignalingEvents: async ({ context, event }) => {
      if (event.type !== 'SIGNALING_EVENTS') return;
      
      for (const signalingEvent of event.events) {
        // Only process events from our target peer
        if (signalingEvent.peerId !== context.remotePeerId) continue;
        
        if (signalingEvent.type === 'ice' && signalingEvent.data?.iceCandidate) {
          await context.peerConnection?.addIceCandidate(
            new RTCIceCandidate(signalingEvent.data.iceCandidate)
          );
        }
      }
    },
    sendMessage: ({ context, event }) => {
      if (event.type !== 'SEND_MESSAGE') return;
      
      const dataChannel = context.dataChannel;
      if (!dataChannel || dataChannel.readyState !== 'open') {
        return;
      }
      
      dataChannel.send(event.message);
    },
    notifyConnectionEstablished: ({ context }) => {
      context.parentRef.send({
        type: 'PEER_CONNECTION_ESTABLISHED',
        remotePeerId: context.remotePeerId
      });
    },
    notifyMessageReceived: ({ context, event }) => {
      if (event.type !== 'DC_MESSAGE') return;
      
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
      if (context.dataChannel) {
        context.dataChannel.onopen = null;
        context.dataChannel.onmessage = null;
        context.dataChannel.onerror = null;
        context.dataChannel.onclose = null;
        
        if (context.dataChannel.readyState !== 'closed') {
          context.dataChannel.close();
        }
      }
      
      if (context.peerConnection) {
        context.peerConnection.onicecandidate = null;
        context.peerConnection.onconnectionstatechange = null;
        context.peerConnection.ondatachannel = null;
        
        if (context.peerConnection.connectionState !== 'closed') {
          context.peerConnection.close();
        }
      }
    },
  },
}).createMachine({
  id: 'channelPeerConnection',
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
          actions: ['createPeerConnection', 'setupPeerConnection']
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
      entry: ['createDataChannel'],
      invoke: {
        src: 'createOffer',
        input: ({ context }) => ({ pc: context.peerConnection! }),
        onDone: {
          target: 'waitingForAnswer',
          actions: ['sendOffer']
        },
        onError: {
          target: 'failed'
        }
      },
      on: {
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
            actions: ['updateEventHistory', 'processSignalingEvents']
          },
          {
            actions: ['updateEventHistory', 'processSignalingEvents']
          }
        ]
      }
    },
    processingOffer: {
      invoke: {
        src: 'createAnswer',
        input: ({ event, context }) => {
          // Find the offer in the signaling events
          const signalingEvents = (event as any).events;
          const offerEvent = signalingEvents.find((e: any) => 
            e.type === 'sdp' && e.data?.sdp?.type === 'offer'
          );
          
          return {
            pc: context.peerConnection!,
            offer: offerEvent.data.sdp
          };
        },
        onDone: {
          target: 'connected',
          actions: ['sendAnswer']
        },
        onError: {
          target: 'failed'
        }
      },
      on: {
        SIGNALING_EVENTS: {
          actions: ['updateEventHistory', 'processSignalingEvents']
        }
      }
    },
    connected: {
      on: {
        PC_DATA_CHANNEL: {
          actions: ['setupDataChannel', 'setupDataChannelHandlers']
        },
        DC_OPEN: {
          actions: ['notifyConnectionEstablished']
        },
        DC_MESSAGE: {
          actions: ['notifyMessageReceived']
        },
        DC_CLOSE: {
          target: 'disconnected'
        },
        DC_ERROR: {
          target: 'failed'
        },
        SEND_MESSAGE: {
          actions: ['sendMessage']
        },
        PC_CONNECTION_STATE_CHANGE: [
          {
            target: 'failed',
            guard: ({ event }) => event.state === 'failed'
          },
          {
            target: 'disconnected',
            guard: ({ event }) => event.state === 'disconnected'
          }
        ],
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
    PC_ICE_CANDIDATE: {
      actions: ['sendIceCandidate']
    }
  }
});