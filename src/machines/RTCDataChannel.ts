import * as x from 'xstate';

interface RTCDataChannelContext {
  dataChannel: RTCDataChannel;
  parentRef: any;
  label: string;
}

interface RTCDataChannelInput {
  dataChannel: RTCDataChannel;
  parentRef: any;
}

export type RTCDataChannelEvent =
  | { type: 'SEND_MESSAGE'; message: string }
  | { type: 'CLOSE' };

export const RTCDataChannelMachine = x.setup({
  types: {
    context: {} as RTCDataChannelContext,
    events: {} as RTCDataChannelEvent,
    input: {} as RTCDataChannelInput,
  },
  actions: {
    setupDataChannel: ({ context, self }) => {
      const dc = context.dataChannel;

      dc.onopen = () => {
        context.parentRef.send({
          type: 'DATA_CHANNEL_OPEN',
          label: context.label
        });
      };

      dc.onmessage = (event) => {
        // Try to parse message as JSON to extract metadata
        let messageData = event.data;
        let broadcast = false;
        
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && typeof parsed === 'object' && 'message' in parsed) {
            messageData = parsed.message;
            broadcast = parsed.broadcast || false;
          }
        } catch {
          // If parsing fails, treat as plain string message
        }

        context.parentRef.send({
          type: 'DATA_CHANNEL_MESSAGE',
          label: context.label,
          data: messageData,
          broadcast: broadcast
        });
      };

      dc.onerror = (error) => {
        context.parentRef.send({
          type: 'DATA_CHANNEL_ERROR',
          label: context.label,
          error: error
        });
      };

      dc.onclose = () => {
        context.parentRef.send({
          type: 'DATA_CHANNEL_CLOSED',
          label: context.label
        });
        self.send({ type: 'CLOSE' });
      };
    },
    sendMessage: ({ context, event }) => {
      if (event.type !== 'SEND_MESSAGE') return;
      
      const dc = context.dataChannel;
      if (dc.readyState === 'open') {
        // Encode broadcast flag in message
        const messageToSend = event.broadcast ? 
          JSON.stringify({ message: event.message, broadcast: true }) :
          event.message;
        
        dc.send(messageToSend);
      }
    },
    cleanup: ({ context }) => {
      const dc = context.dataChannel;
      
      // Clear event handlers
      dc.onopen = null;
      dc.onmessage = null;
      dc.onerror = null;
      dc.onclose = null;
      
      // Close data channel if not already closed
      if (dc.readyState !== 'closed') {
        dc.close();
      }
    },
  },
}).createMachine({
  id: 'rtcDataChannel',
  initial: 'connecting',
  context: ({ input }) => ({
    dataChannel: input.dataChannel,
    parentRef: input.parentRef,
    label: input.dataChannel.label,
  }),
  states: {
    connecting: {
      entry: 'setupDataChannel',
      on: {
        DATA_CHANNEL_OPEN: {
          target: 'open'
        },
        DATA_CHANNEL_ERROR: {
          target: 'failed'
        },
        DATA_CHANNEL_CLOSED: {
          target: 'closed'
        },
        CLOSE: {
          target: 'closed'
        }
      }
    },
    open: {
      on: {
        SEND_MESSAGE: {
          actions: 'sendMessage'
        },
        DATA_CHANNEL_ERROR: {
          target: 'failed'
        },
        DATA_CHANNEL_CLOSED: {
          target: 'closed'
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