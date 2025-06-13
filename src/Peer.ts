import { createActor, Actor } from 'xstate';
import { HoneyRoomConnection } from './machines/HoneyRoomConnection';
import { Room } from './Room';
import { Channel } from './Channel';

export interface PeerOptions {
  peerId: string;
}

export type PresenceHandler = (event: { type: 'join' | 'leave' | 'alive'; peerId: string; roomId: string }) => void;

// Helper function to generate channel ID for peer-to-peer communication
function generateChannelId(roomId: string, peerId1: string, peerId2: string): string {
  const sortedPeerIds = [peerId1, peerId2].sort();
  return `${roomId}:${sortedPeerIds[0]}-${sortedPeerIds[1]}`;
}

interface RoomConnection {
  room: Room;
  roomConnectionActor: Actor<typeof HoneyRoomConnection>;
}

export class Peer {
  static Room = Room;
  static Channel = Channel;

  peerId: string;
  roomConnections: Map<string, RoomConnection> = new Map(); // roomId -> room connection
  channels: Map<string, Channel<any>> = new Map(); // channelId -> channel for peer-to-peer
  presenceHandlers: Set<PresenceHandler> = new Set();

  constructor(options: PeerOptions) {
    this.peerId = options.peerId;
  }

  get id(): string {
    return this.peerId;
  }

  async joinRoom(room: Room): Promise<void> {
    console.log(`[${this.peerId}] Joining room ${room.id}...`);

    // Check if room is active
    if (!room.isRoomActive()) {
      throw new Error(`Cannot join stopped room ${room.id}`);
    }

    // Check if already connected to this room
    if (this.roomConnections.has(room.id)) {
      console.log(`[${this.peerId}] Already connected to room ${room.id}`);
      return;
    }

    // Create room connection actor
    const roomConnectionActor = createActor(HoneyRoomConnection, {
      input: {
        room: room,
        localPeer: this,
        rtcConfiguration: room.rtcConfiguration,
        parentRef: {
          send: (event: any) => {
            this.handleRoomConnectionEvent(event);
          }
        }
      },
    });

    // Store room connection
    this.roomConnections.set(room.id, {
      room,
      roomConnectionActor
    });

    // Add this peer's ID to the room's peer list
    room.addPeer(this.peerId);
    
    // Set this peer as the connected peer for Room messaging
    room.setConnectedPeer(this);

    // Start the room connection actor
    roomConnectionActor.start();
    
    // Join the room
    roomConnectionActor.send({ type: 'JOIN_ROOM' });

    console.log(`[${this.peerId}] Started connection to room ${room.id}`);
  }

  async leaveRoom(room: Room): Promise<void> {
    const roomConnection = this.roomConnections.get(room.id);
    if (!roomConnection) {
      console.warn(`[${this.peerId}] Not connected to room ${room.id}`);
      return;
    }

    console.log(`[${this.peerId}] Leaving room ${room.id}`);

    // Remove this peer from the room
    room.removePeer(this.peerId);

    // Send leave room event and wait for machine to reach final state
    roomConnection.roomConnectionActor.send({ type: 'LEAVE_ROOM' });

    // Wait for the state machine to properly close
    await new Promise<void>((resolve) => {
      const subscription = roomConnection.roomConnectionActor.subscribe((state) => {
        if (state.value === 'disconnected') {
          subscription.unsubscribe();
          this.roomConnections.delete(room.id);
          resolve();
        }
      });

      // Fallback timeout
      setTimeout(() => {
        subscription.unsubscribe();
        roomConnection.roomConnectionActor.stop();
        this.roomConnections.delete(room.id);
        resolve();
      }, 1000);
    });

    console.log(`[${this.peerId}] Left room ${room.id}`);
  }

  sendMessageToPeer(roomId: string, peerId: string, message: string): void {
    const roomConnection = this.roomConnections.get(roomId);
    if (!roomConnection) {
      console.warn(`[${this.peerId}] No connection found for room ${roomId}`);
      return;
    }

    roomConnection.roomConnectionActor.send({
      type: 'SEND_MESSAGE_TO_PEER',
      peerId: peerId,
      message: message
    });
  }

  sendMessageToAll(roomId: string, message: string): void {
    const roomConnection = this.roomConnections.get(roomId);
    if (!roomConnection) {
      console.warn(`[${this.peerId}] No connection found for room ${roomId}`);
      return;
    }

    roomConnection.roomConnectionActor.send({
      type: 'SEND_MESSAGE_TO_ALL',
      message: message,
      broadcast: true
    } as any);
  }

  sendMessageToDataChannel(roomId: string, peerId: string, label: string, message: string): void {
    const roomConnection = this.roomConnections.get(roomId);
    if (!roomConnection) {
      console.warn(`[${this.peerId}] No connection found for room ${roomId}`);
      return;
    }

    roomConnection.roomConnectionActor.send({
      type: 'SEND_MESSAGE_TO_DATACHANNEL',
      peerId: peerId,
      label: label,
      message: message
    });
  }

  getRoomConnectionState(roomId: string): string {
    const roomConnection = this.roomConnections.get(roomId);
    if (!roomConnection) return 'disconnected';

    const snapshot = roomConnection.roomConnectionActor.getSnapshot();
    return snapshot.value as string;
  }

  getAllRoomStates(): Record<string, { connectionState: string; alivePeers: string[] }> {
    const states: Record<string, any> = {};
    this.roomConnections.forEach((roomConnection, roomId) => {
      const snapshot = roomConnection.roomConnectionActor.getSnapshot();
      states[roomId] = {
        connectionState: snapshot.value,
        alivePeers: Array.from(snapshot.context.alivePeers),
      };
    });
    return states;
  }

  async close(): Promise<void> {
    console.log(`[${this.peerId}] Closing all room connections`);

    const leavePromises: Promise<void>[] = [];
    this.roomConnections.forEach((roomConnection) => {
      leavePromises.push(this.leaveRoom(roomConnection.room));
    });

    await Promise.all(leavePromises);
    
    // Clear all handlers and channels
    this.presenceHandlers.clear();
    this.channels.clear();
    
    console.log(`[${this.peerId}] Closed all connections`);
  }

  // ============================================================================
  // NEW IMPROVED API
  // ============================================================================


  /**
   * Get or create a Channel for communicating with another peer within a specific room
   */
  getChannelWith(peerId: string, roomId?: string, signalingAdapter = this.getDefaultSignalingAdapter()): Channel<any> {
    // If no roomId provided, use the first available room
    if (!roomId) {
      const firstRoom = Array.from(this.roomConnections.keys())[0];
      if (!firstRoom) {
        throw new Error('No room connections available. Peer must join a room before creating channels.');
      }
      roomId = firstRoom;
    }
    
    const channelId = generateChannelId(roomId, this.peerId, peerId);
    
    if (!this.channels.has(channelId)) {
      const channel = new Channel<any>(channelId, signalingAdapter, roomId);
      channel.setConnectedPeer(this);
      this.channels.set(channelId, channel);
    }
    
    return this.channels.get(channelId)!;
  }


  /**
   * Register a handler for room presence updates
   */
  onPresence(handler: PresenceHandler): () => void {
    this.presenceHandlers.add(handler);
    
    // Return cleanup function  
    return () => {
      this.presenceHandlers.delete(handler);
    };
  }

  // ============================================================================
  // INTERNAL METHODS
  // ============================================================================

  private handleRoomConnectionEvent(event: any): void {
    console.log(`[${this.peerId}] Room connection event:`, event);
    
    switch (event.type) {
      case 'ROOM_MESSAGE_RECEIVED':
        if (event.broadcast) {
          // Route to room message handlers
          const room = this.getRoom(event.roomId);
          if (room) {
            room.notifyMessageHandlers(event.message, event.fromPeerId);
          }
        } else {
          // Route to channel message handlers
          const channelId = generateChannelId(event.roomId, this.peerId, event.fromPeerId);
          const channel = this.channels.get(channelId);
          if (channel) {
            channel.notifyMessageHandlers(event.message, event.fromPeerId);
          }
        }
        break;
      case 'ROOM_PEER_CONNECTED':
        this.notifyPresenceHandlers({ type: 'join', peerId: event.peerId, roomId: event.roomId });
        break;
      case 'ROOM_PEER_DISCONNECTED':
        this.notifyPresenceHandlers({ type: 'leave', peerId: event.peerId, roomId: event.roomId });
        break;
    }
  }


  private notifyPresenceHandlers(event: { type: 'join' | 'leave' | 'alive'; peerId: string; roomId: string }): void {
    this.presenceHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`[${this.peerId}] Error in presence handler:`, error);
      }
    });
  }

  private getRoom(roomId: string): Room | undefined {
    const roomConnection = this.roomConnections.get(roomId);
    return roomConnection?.room;
  }

  private getDefaultSignalingAdapter() {
    // Get signaling adapter from first available room
    const firstRoom = Array.from(this.roomConnections.values())[0]?.room;
    if (!firstRoom) {
      throw new Error('No room connections available to get signaling adapter');
    }
    return firstRoom.signalingAdapter;
  }
}