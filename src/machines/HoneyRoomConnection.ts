import * as x from 'xstate';
import { Channel } from '../Channel';
import { Peer } from '../Peer';
import { HoneyPresenceSignal } from './HoneyPresenceSignal';
import { HoneyPeerConnection } from './HoneyPeerConnection';

interface HoneyRoomConnectionContext {
  room: Channel<any>;
  localPeer: Peer;
  rtcConfiguration: RTCConfiguration;
  presenceSignalActorRef?: any;
  peerConnections: Map<string, any>; // peerId -> HoneyPeerConnection actor ref
  alivePeers: Set<string>; // Set of peer IDs that are currently alive
  parentRef: any;
}

interface HoneyRoomConnectionInput {
  room: Channel<any>;
  localPeer: Peer;
  rtcConfiguration: RTCConfiguration;
  parentRef: any;
}

export type HoneyRoomConnectionEvent =
  | { type: 'JOIN_ROOM' }
  | { type: 'LEAVE_ROOM' }
  | { type: 'PRESENCE_EVENTS'; data: { events: any[], newLastSeenIndex: number }; origin: string }
  | { type: 'SEND_MESSAGE_TO_PEER'; peerId: string; message: string }
  | { type: 'SEND_MESSAGE_TO_ALL'; message: string }
  | { type: 'SEND_MESSAGE_TO_DATACHANNEL'; peerId: string; label: string; message: string }
  | { type: 'PEER_CONNECTION_ESTABLISHED'; remotePeerId: string }
  | { type: 'PEER_CONNECTION_CLOSED'; remotePeerId: string }
  | { type: 'PEER_MESSAGE_RECEIVED'; remotePeerId: string; message: string }
  | { type: 'CLOSE' };

export const HoneyRoomConnection = x.setup({
  types: {
    context: {} as HoneyRoomConnectionContext,
    events: {} as HoneyRoomConnectionEvent,
    input: {} as HoneyRoomConnectionInput,
  },
  actors: {
    honeyPresenceSignal: HoneyPresenceSignal,
    honeyPeerConnection: HoneyPeerConnection,
  },
  guards: {
    hasAlivePeers: ({ context }) => context.alivePeers.size > 0,
    isNewPeer: ({ context, event }) => {
      if (event.type !== 'PRESENCE_EVENTS') return false;
      // Check if any join events are for peers we don't have connections to
      return event.data.events.some(presenceEvent => 
        presenceEvent.type === 'join' && 
        presenceEvent.peerId !== context.localPeer.id &&
        !context.peerConnections.has(presenceEvent.peerId)
      );
    },
    isTargetPeerAlive: ({ context, event }) => {
      if (event.type !== 'SEND_MESSAGE_TO_PEER' && event.type !== 'SEND_MESSAGE_TO_DATACHANNEL') return false;
      return context.alivePeers.has(event.peerId);
    },
  },
  actions: {
    spawnPresenceSignal: x.assign({
      presenceSignalActorRef: ({ context, spawn, self }) => {
        return spawn('honeyPresenceSignal', {
          id: 'presenceSignal',
          input: {
            channel: context.room,
            peer: context.localPeer,
            parentRef: self,
            aliveInterval: 30000 // 30 seconds
          }
        });
      }
    }),
    updateAlivePeers: x.assign({
      alivePeers: ({ context, event }) => {
        if (event.type !== 'PRESENCE_EVENTS') return context.alivePeers;
        
        const newAlivePeers = new Set(context.alivePeers);
        
        for (const presenceEvent of event.data.events) {
          if (presenceEvent.peerId === context.localPeer.id) continue; // Skip our own events
          
          switch (presenceEvent.type) {
            case 'join':
            case 'alive':
              newAlivePeers.add(presenceEvent.peerId);
              break;
            case 'leave':
              newAlivePeers.delete(presenceEvent.peerId);
              break;
          }
        }
        
        return newAlivePeers;
      }
    }),
    spawnPeerConnections: x.assign({
      peerConnections: ({ context, event, spawn, self }) => {
        if (event.type !== 'PRESENCE_EVENTS') return context.peerConnections;
        
        const newPeerConnections = new Map(context.peerConnections);
        
        // Create connections for new alive peers
        for (const presenceEvent of event.data.events) {
          if (presenceEvent.type === 'join' || presenceEvent.type === 'alive') {
            const peerId = presenceEvent.peerId;
            
            // Skip if it's our own peer or we already have a connection
            if (peerId === context.localPeer.id || newPeerConnections.has(peerId)) {
              continue;
            }
            
            // Spawn new peer connection
            const peerConnectionActor = spawn('honeyPeerConnection', {
              id: `peerConnection-${peerId}`,
              input: {
                localPeer: context.localPeer,
                remotePeerId: peerId,
                channel: context.room,
                rtcConfiguration: context.rtcConfiguration,
                parentRef: self
              }
            });
            
            newPeerConnections.set(peerId, peerConnectionActor);
            
            // Start the connection
            peerConnectionActor.send({ type: 'START' });
          }
        }
        
        return newPeerConnections;
      }
    }),
    cleanupDeadPeerConnections: x.assign({
      peerConnections: ({ context, event }) => {
        if (event.type !== 'PRESENCE_EVENTS') return context.peerConnections;
        
        const newPeerConnections = new Map(context.peerConnections);
        
        // Remove connections for peers that left
        for (const presenceEvent of event.data.events) {
          if (presenceEvent.type === 'leave') {
            const peerId = presenceEvent.peerId;
            const peerConnection = newPeerConnections.get(peerId);
            
            if (peerConnection) {
              peerConnection.send({ type: 'CLOSE' });
              newPeerConnections.delete(peerId);
            }
          }
        }
        
        return newPeerConnections;
      }
    }),
    sendMessageToPeer: ({ context, event }) => {
      if (event.type !== 'SEND_MESSAGE_TO_PEER') return;
      
      const peerConnection = context.peerConnections.get(event.peerId);
      if (peerConnection) {
        peerConnection.send({
          type: 'SEND_MESSAGE',
          message: event.message
        });
      }
    },
    sendMessageToAll: ({ context, event }) => {
      if (event.type !== 'SEND_MESSAGE_TO_ALL') return;
      
      // Send message to all connected peers
      context.peerConnections.forEach((peerConnection) => {
        peerConnection.send({
          type: 'SEND_MESSAGE',
          message: event.message
        });
      });
    },
    sendMessageToDataChannel: ({ context, event }) => {
      if (event.type !== 'SEND_MESSAGE_TO_DATACHANNEL') return;
      
      const peerConnection = context.peerConnections.get(event.peerId);
      if (peerConnection) {
        peerConnection.send({
          type: 'SEND_DATA_CHANNEL_MESSAGE',
          label: event.label,
          message: event.message
        });
      }
    },
    notifyPeerConnectionEstablished: ({ context, event }) => {
      if (event.type !== 'PEER_CONNECTION_ESTABLISHED') return;
      
      context.parentRef.send({
        type: 'ROOM_PEER_CONNECTED',
        roomId: context.room.id,
        peerId: event.remotePeerId
      });
    },
    notifyPeerConnectionClosed: ({ context, event }) => {
      if (event.type !== 'PEER_CONNECTION_CLOSED') return;
      
      context.parentRef.send({
        type: 'ROOM_PEER_DISCONNECTED',
        roomId: context.room.id,
        peerId: event.remotePeerId
      });
    },
    notifyMessageReceived: ({ context, event }) => {
      if (event.type !== 'PEER_MESSAGE_RECEIVED') return;
      
      context.parentRef.send({
        type: 'ROOM_MESSAGE_RECEIVED',
        roomId: context.room.id,
        fromPeerId: event.remotePeerId,
        message: event.message
      });
    },
    startPresenceSignal: ({ context }) => {
      if (context.presenceSignalActorRef) {
        context.presenceSignalActorRef.send({ type: 'START' });
      }
    },
    stopPresenceSignal: ({ context }) => {
      if (context.presenceSignalActorRef) {
        context.presenceSignalActorRef.send({ type: 'STOP' });
      }
    },
    cleanup: ({ context }) => {
      // Stop presence signal
      if (context.presenceSignalActorRef) {
        context.presenceSignalActorRef.send({ type: 'STOP' });
      }
      
      // Close all peer connections
      context.peerConnections.forEach((peerConnection) => {
        peerConnection.send({ type: 'CLOSE' });
      });
    },
  },
}).createMachine({
  id: 'honeyRoomConnection',
  initial: 'disconnected',
  context: ({ input }) => ({
    room: input.room,
    localPeer: input.localPeer,
    rtcConfiguration: input.rtcConfiguration,
    parentRef: input.parentRef,
    peerConnections: new Map(),
    alivePeers: new Set(),
  }),
  states: {
    disconnected: {
      on: {
        JOIN_ROOM: {
          target: 'connecting'
        }
      }
    },
    connecting: {
      entry: ['spawnPresenceSignal', 'startPresenceSignal'],
      on: {
        PRESENCE_EVENTS: {
          target: 'connected',
          actions: ['updateAlivePeers', 'spawnPeerConnections']
        },
        LEAVE_ROOM: {
          target: 'disconnecting'
        }
      }
    },
    connected: {
      on: {
        PRESENCE_EVENTS: {
          actions: [
            'updateAlivePeers',
            'spawnPeerConnections',
            'cleanupDeadPeerConnections'
          ]
        },
        SEND_MESSAGE_TO_PEER: [
          {
            guard: 'isTargetPeerAlive',
            actions: 'sendMessageToPeer'
          }
          // If peer is not alive, silently ignore
        ],
        SEND_MESSAGE_TO_ALL: {
          actions: 'sendMessageToAll'
        },
        SEND_MESSAGE_TO_DATACHANNEL: [
          {
            guard: 'isTargetPeerAlive',
            actions: 'sendMessageToDataChannel'
          }
          // If peer is not alive, silently ignore
        ],
        PEER_CONNECTION_ESTABLISHED: {
          actions: 'notifyPeerConnectionEstablished'
        },
        PEER_CONNECTION_CLOSED: {
          actions: 'notifyPeerConnectionClosed'
        },
        PEER_MESSAGE_RECEIVED: {
          actions: 'notifyMessageReceived'
        },
        LEAVE_ROOM: {
          target: 'disconnecting'
        },
        CLOSE: {
          target: 'disconnecting'
        }
      }
    },
    disconnecting: {
      entry: ['cleanup'],
      always: {
        target: 'disconnected'
      }
    }
  }
});