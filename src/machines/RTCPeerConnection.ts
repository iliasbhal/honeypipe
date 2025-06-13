import * as x from 'xstate';
import { RTCDataChannelMachine } from './RTCDataChannel';

interface RTCPeerConnectionContext {
  peerConnection: RTCPeerConnection;
  configuration: RTCConfiguration;
  parentRef: any;
  dataChannels: Map<string, any>; // Map of data channel labels to actor refs
}

interface RTCPeerConnectionInput {
  configuration: RTCConfiguration;
  parentRef: any;
}

export type RTCPeerConnectionEvent =
  | { type: 'CREATE_OFFER' }
  | { type: 'CREATE_ANSWER'; offer: RTCSessionDescriptionInit }
  | { type: 'SET_LOCAL_DESCRIPTION'; description: RTCSessionDescriptionInit }
  | { type: 'SET_REMOTE_DESCRIPTION'; description: RTCSessionDescriptionInit }
  | { type: 'ADD_ICE_CANDIDATE'; candidate: RTCIceCandidateInit }
  | { type: 'CREATE_DATA_CHANNEL'; label: string; options?: RTCDataChannelInit }
  | { type: 'SEND_DATA_CHANNEL_MESSAGE'; label: string; message: string }
  | { type: 'CLOSE' }
  | { type: 'DATA_CHANNEL_CREATED'; dataChannel: RTCDataChannel }
  | { type: 'DATA_CHANNEL_CLOSED'; label: string };

export const RTCPeerConnectionMachine = x.setup({
  types: {
    context: {} as RTCPeerConnectionContext,
    events: {} as RTCPeerConnectionEvent,
    input: {} as RTCPeerConnectionInput,
  },
  actors: {
    createOffer: x.fromPromise(async ({ input }: { input: { pc: RTCPeerConnection } }) => {
      const offer = await input.pc.createOffer();
      return offer;
    }),
    createAnswer: x.fromPromise(async ({ input }: { input: { pc: RTCPeerConnection; offer: RTCSessionDescriptionInit } }) => {
      const answer = await input.pc.createAnswer();
      return answer;
    }),
    setLocalDescription: x.fromPromise(async ({ input }: { input: { pc: RTCPeerConnection; description: RTCSessionDescriptionInit } }) => {
      await input.pc.setLocalDescription(input.description);
    }),
    setRemoteDescription: x.fromPromise(async ({ input }: { input: { pc: RTCPeerConnection; description: RTCSessionDescriptionInit } }) => {
      await input.pc.setRemoteDescription(input.description);
    }),
    addIceCandidate: x.fromPromise(async ({ input }: { input: { pc: RTCPeerConnection; candidate: RTCIceCandidateInit } }) => {
      await input.pc.addIceCandidate(new RTCIceCandidate(input.candidate));
    }),
    rtcDataChannel: RTCDataChannelMachine,
  },
  actions: {
    setupPeerConnection: ({ context, self }) => {
      const pc = context.peerConnection;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          context.parentRef.send({
            type: 'RTC_ICE_CANDIDATE',
            candidate: event.candidate
          });
        }
      };

      pc.onconnectionstatechange = () => {
        context.parentRef.send({
          type: 'RTC_CONNECTION_STATE_CHANGE',
          state: pc.connectionState
        });
      };

      pc.ondatachannel = (event) => {
        self.send({
          type: 'DATA_CHANNEL_CREATED',
          dataChannel: event.channel
        });
      };
    },
    createDataChannel: x.assign({
      dataChannels: ({ context, event, spawn }) => {
        if (event.type !== 'CREATE_DATA_CHANNEL') return context.dataChannels;

        const dataChannel = context.peerConnection.createDataChannel(event.label, event.options);
        const newDataChannels = new Map(context.dataChannels);

        // Spawn RTCDataChannelMachine actor
        const dataChannelActor = spawn('rtcDataChannel', {
          id: `dataChannel-${event.label}`,
          input: {
            dataChannel: dataChannel,
            parentRef: context.parentRef
          }
        });

        newDataChannels.set(event.label, dataChannelActor);

        // Notify parent about new data channel
        context.parentRef.send({
          type: 'RTC_DATA_CHANNEL_CREATED',
          label: event.label,
          dataChannel: dataChannel
        });

        return newDataChannels;
      }
    }),
    handleIncomingDataChannel: x.assign({
      dataChannels: ({ context, event, spawn }) => {
        if (event.type !== 'DATA_CHANNEL_CREATED') return context.dataChannels;

        const dataChannel = event.dataChannel;
        const newDataChannels = new Map(context.dataChannels);

        // Spawn RTCDataChannelMachine for incoming data channel
        const dataChannelActor = spawn('rtcDataChannel', {
          id: `dataChannel-${dataChannel.label}`,
          input: {
            dataChannel: dataChannel,
            parentRef: context.parentRef
          }
        });

        newDataChannels.set(dataChannel.label, dataChannelActor);

        // Notify parent about new data channel
        context.parentRef.send({
          type: 'RTC_DATA_CHANNEL_CREATED',
          label: dataChannel.label,
          dataChannel: dataChannel
        });

        return newDataChannels;
      }
    }),
    notifyOfferCreated: ({ event, context }) => {
      context.parentRef.send({
        type: 'RTC_OFFER_CREATED',
        offer: (event as any).output
      });
    },
    notifyAnswerCreated: ({ event, context }) => {
      context.parentRef.send({
        type: 'RTC_ANSWER_CREATED',
        answer: (event as any).output
      });
    },
    notifyLocalDescriptionSet: ({ context }) => {
      context.parentRef.send({
        type: 'RTC_LOCAL_DESCRIPTION_SET'
      });
    },
    notifyRemoteDescriptionSet: ({ context }) => {
      context.parentRef.send({
        type: 'RTC_REMOTE_DESCRIPTION_SET'
      });
    },
    notifyIceCandidateAdded: ({ context }) => {
      context.parentRef.send({
        type: 'RTC_ICE_CANDIDATE_ADDED'
      });
    },
    sendDataChannelMessage: ({ context, event }) => {
      if (event.type !== 'SEND_DATA_CHANNEL_MESSAGE') return;

      const dataChannelActor = context.dataChannels.get(event.label);
      if (dataChannelActor) {
        dataChannelActor.send({
          type: 'SEND_MESSAGE',
          message: event.message
        });
      }
    },
    cleanup: ({ context }) => {
      // Stop all data channel actors
      context.dataChannels.forEach((dataChannelActor) => {
        dataChannelActor.send({ type: 'CLOSE' });
      });

      // Clean up peer connection event listeners
      const pc = context.peerConnection;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.ondatachannel = null;

      // Close peer connection
      if (pc.connectionState !== 'closed') {
        pc.close();
      }
    },
  },
}).createMachine({
  id: 'rtcPeerConnection',
  initial: 'initializing',
  context: ({ input }) => ({
    peerConnection: new RTCPeerConnection(input.configuration),
    configuration: input.configuration,
    parentRef: input.parentRef,
    dataChannels: new Map(),
  }),
  states: {
    initializing: {
      entry: 'setupPeerConnection',
      on: {
        CREATE_OFFER: {
          target: 'creatingOffer'
        },
        CREATE_ANSWER: {
          target: 'creatingAnswer'
        },
        SET_LOCAL_DESCRIPTION: {
          target: 'settingLocalDescription'
        },
        SET_REMOTE_DESCRIPTION: {
          target: 'settingRemoteDescription'
        },
        ADD_ICE_CANDIDATE: {
          target: 'addingIceCandidate'
        },
        CREATE_DATA_CHANNEL: {
          actions: 'createDataChannel'
        },
        SEND_DATA_CHANNEL_MESSAGE: {
          actions: 'sendDataChannelMessage'
        },
        DATA_CHANNEL_CREATED: {
          actions: 'handleIncomingDataChannel'
        },
        CLOSE: {
          target: 'closed'
        }
      }
    },
    creatingOffer: {
      invoke: {
        src: 'createOffer',
        input: ({ context }) => ({ pc: context.peerConnection }),
        onDone: {
          target: 'ready',
          actions: 'notifyOfferCreated'
        },
        onError: {
          target: 'failed'
        }
      }
    },
    creatingAnswer: {
      invoke: {
        src: 'createAnswer',
        input: ({ context, event }) => ({
          pc: context.peerConnection,
          offer: (event as any).offer
        }),
        onDone: {
          target: 'ready',
          actions: 'notifyAnswerCreated'
        },
        onError: {
          target: 'failed'
        }
      }
    },
    settingLocalDescription: {
      invoke: {
        src: 'setLocalDescription',
        input: ({ context, event }) => ({
          pc: context.peerConnection,
          description: (event as any).description
        }),
        onDone: {
          target: 'ready',
          actions: 'notifyLocalDescriptionSet'
        },
        onError: {
          target: 'failed'
        }
      }
    },
    settingRemoteDescription: {
      invoke: {
        src: 'setRemoteDescription',
        input: ({ context, event }) => ({
          pc: context.peerConnection,
          description: (event as any).description
        }),
        onDone: {
          target: 'ready',
          actions: 'notifyRemoteDescriptionSet'
        },
        onError: {
          target: 'failed'
        }
      }
    },
    addingIceCandidate: {
      invoke: {
        src: 'addIceCandidate',
        input: ({ context, event }) => ({
          pc: context.peerConnection,
          candidate: (event as any).candidate
        }),
        onDone: {
          target: 'ready',
          actions: 'notifyIceCandidateAdded'
        },
        onError: {
          target: 'ready' // Continue even if ICE candidate fails
        }
      }
    },
    ready: {
      on: {
        CREATE_OFFER: {
          target: 'creatingOffer'
        },
        CREATE_ANSWER: {
          target: 'creatingAnswer'
        },
        SET_LOCAL_DESCRIPTION: {
          target: 'settingLocalDescription'
        },
        SET_REMOTE_DESCRIPTION: {
          target: 'settingRemoteDescription'
        },
        ADD_ICE_CANDIDATE: {
          target: 'addingIceCandidate'
        },
        CREATE_DATA_CHANNEL: {
          actions: 'createDataChannel'
        },
        SEND_DATA_CHANNEL_MESSAGE: {
          actions: 'sendDataChannelMessage'
        },
        DATA_CHANNEL_CREATED: {
          actions: 'handleIncomingDataChannel'
        },
        CLOSE: {
          target: 'closed'
        }
      }
    },
    failed: {
      entry: 'cleanup',
      type: 'final'
    },
    closed: {
      entry: 'cleanup',
      type: 'final'
    }
  }
});