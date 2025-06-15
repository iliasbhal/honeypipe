import { Room } from './Room';
import { Channel } from './Channel';
import { PeerRoom } from './PeerRoom';
import { PeerChannel } from './PeerChannel';
import { createActor } from 'xstate';

export interface PeerOptions {
  peerId: string;
}

/**
 * Peer represents a WebRTC peer with all actors managed internally
 * Use peer.via(room) or peer.via(channel) to interact with rooms and channels
 */
export class Peer {
  static Room = Room;
  static Channel = Channel;

  readonly peerId: string;
  private roomConnectionActors: Map<string, any> = new Map(); // roomId -> HoneyRoomConnection actor
  private peerRooms: Map<string, PeerRoom> = new Map(); // roomId -> PeerRoom instance
  private peerChannels: Map<string, PeerChannel> = new Map(); // channelId -> PeerChannel instance

  constructor(options: PeerOptions) {
    this.peerId = options.peerId;
  }

  get id(): string {
    return this.peerId;
  }

  /**
   * Get a PeerRoom or PeerChannel interface for a Room or Channel
   */
  via<T extends Room | Channel>(target: T): T extends Room ? PeerRoom : PeerChannel<any> {
    if (target instanceof Room) {
      let peerRoom = this.peerRooms.get(target.id);
      if (!peerRoom) {
        peerRoom = new PeerRoom(this, target);
        this.peerRooms.set(target.id, peerRoom);
      }
      return peerRoom as any;
    } else if (target instanceof Channel) {
      let peerChannel = this.peerChannels.get(target.id);
      if (!peerChannel) {
        peerChannel = new PeerChannel(this, target);
        this.peerChannels.set(target.id, peerChannel);
      }
      return peerChannel as any;
    }
    throw new Error('Target must be a Room or Channel instance');
  }

  /**
   * Get room connection actor for a specific room (internal use)
   */
  getRoomConnectionActor(roomId: string): any {
    return this.roomConnectionActors.get(roomId);
  }

  /**
   * Join a room (internal use by PeerRoom)
   */
  async joinRoom(room: Room): Promise<void> {
    if (this.roomConnectionActors.has(room.id)) {
      console.log(`[${this.peerId}] Already connected to room ${room.id}`);
      return;
    }

    // Dynamic import to avoid circular dependency
    const { HoneyRoomConnection } = await import('./machines/HoneyRoomConnection');

    // Create room connection actor
    const roomConnectionActor = createActor(HoneyRoomConnection, {
      input: {
        room: room,
        localPeer: this,
        rtcConfiguration: room.rtcConfiguration,
        parentRef: {
          send: (event: any) => {
            this.handleRoomConnectionEvent(event, room.id);
          }
        }
      },
    });

    this.roomConnectionActors.set(room.id, roomConnectionActor);

    // Start the room connection actor
    roomConnectionActor.start();

    // Join the room
    roomConnectionActor.send({ type: 'JOIN_ROOM' });

    console.log(`[${this.peerId}] Joined room ${room.id}`);
  }

  /**
   * Leave a room (internal use by PeerRoom)
   */
  async leaveRoom(room: Room): Promise<void> {
    const roomConnectionActor = this.roomConnectionActors.get(room.id);
    if (!roomConnectionActor) {
      console.warn(`[${this.peerId}] Not connected to room ${room.id}`);
      return;
    }

    // Send leave room event
    roomConnectionActor.send({ type: 'LEAVE_ROOM' });

    // Wait for disconnection
    await new Promise<void>((resolve) => {
      const subscription = roomConnectionActor.subscribe((state) => {
        if (state.value === 'disconnected') {
          subscription.unsubscribe();
          this.roomConnectionActors.delete(room.id);
          this.peerRooms.delete(room.id);
          resolve();
        }
      });

      // Fallback timeout
      setTimeout(() => {
        subscription.unsubscribe();
        roomConnectionActor.stop();
        this.roomConnectionActors.delete(room.id);
        this.peerRooms.delete(room.id);
        resolve();
      }, 1000);
    });

    console.log(`[${this.peerId}] Left room ${room.id}`);
  }

  /**
   * Handle events from room connection actors
   */
  private handleRoomConnectionEvent(event: any, roomId: string): void {
    const peerRoom = this.peerRooms.get(roomId);
    if (!peerRoom) {
      return;
    }

    switch (event.type) {
      case 'ROOM_MESSAGE_RECEIVED':
        if (event.broadcast) {
          peerRoom.notifyMessageHandlers(event.message, event.fromPeerId);
        } else {
          // Route to channel handlers
          const channelId = `${roomId}:${[this.peerId, event.fromPeerId].sort().join('-')}`;
          const peerChannel = this.peerChannels.get(channelId);
          if (peerChannel) {
            peerChannel.notifyMessageHandlers(event.message, event.fromPeerId);
          }
        }
        break;
      case 'ROOM_PEER_CONNECTED':
        peerRoom.notifyPresenceHandlers({ type: 'join', peerId: event.peerId, roomId: event.roomId });
        break;
      case 'ROOM_PEER_DISCONNECTED':
        peerRoom.notifyPresenceHandlers({ type: 'leave', peerId: event.peerId, roomId: event.roomId });
        break;
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    console.log(`[${this.peerId}] Closing all connections`);

    const leavePromises: Promise<void>[] = [];
    for (const [roomId, peerRoom] of this.peerRooms) {
      leavePromises.push(peerRoom.leave());
    }

    await Promise.all(leavePromises);
    
    console.log(`[${this.peerId}] All connections closed`);
  }
}