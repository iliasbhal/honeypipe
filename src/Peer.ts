import { Room } from './Room';
import { Channel } from './Channel';

export interface PeerOptions {
  peerId: string;
}

export class Peer {
  static Room = Room;
  static Channel = Channel;

  peerId: string;
  private connectedRooms: Set<Room> = new Set(); // Track rooms this peer is connected to

  constructor(options: PeerOptions) {
    this.peerId = options.peerId;
  }

  get id(): string {
    return this.peerId;
  }

  async joinRoom(room: Room): Promise<void> {
    console.log(`[${this.peerId}] Joining room ${room.id}...`);
    
    if (this.connectedRooms.has(room)) {
      console.log(`[${this.peerId}] Already connected to room ${room.id}`);
      return;
    }
    
    await room.addPeerConnection(this);
    this.connectedRooms.add(room);
  }

  async leaveRoom(room: Room): Promise<void> {
    console.log(`[${this.peerId}] Leaving room ${room.id}`);
    
    if (!this.connectedRooms.has(room)) {
      console.warn(`[${this.peerId}] Not connected to room ${room.id}`);
      return;
    }
    
    await room.removePeerConnection(this.peerId);
    this.connectedRooms.delete(room);
  }

  /**
   * Get all rooms this peer is connected to
   */
  getConnectedRooms(): Room[] {
    return Array.from(this.connectedRooms);
  }

  /**
   * Check if peer is connected to a specific room
   */
  isConnectedToRoom(room: Room): boolean {
    return this.connectedRooms.has(room);
  }

  /**
   * Get a channel for communicating with another peer within a specific room
   */
  getChannelWith(peerId: string, room?: Room): Channel<any> {
    // If no room provided, use the first available room
    if (!room) {
      const firstRoom = Array.from(this.connectedRooms)[0];
      if (!firstRoom) {
        throw new Error('No room connections available. Peer must join a room before creating channels.');
      }
      room = firstRoom;
    }
    
    return room.getChannel(this.peerId, peerId);
  }

  /**
   * Close all room connections
   */
  async close(): Promise<void> {
    console.log(`[${this.peerId}] Closing all room connections`);

    const leavePromises: Promise<void>[] = [];
    this.connectedRooms.forEach((room) => {
      leavePromises.push(this.leaveRoom(room));
    });

    await Promise.all(leavePromises);
    
    console.log(`[${this.peerId}] Closed all connections`);
  }
}