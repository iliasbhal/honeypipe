import { Room } from './Room';
import { RoomConnection } from './RoomConnection';

export interface PeerOptions {
  peerId: string;
}

const uuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Peer represents a WebRTC peer with all actors managed internally
 * Use peer.via(room) or peer.via(channel) to interact with rooms and channels
 */
export class Peer {
  static Room = Room;

  readonly peerId: string;
  private roomConnections = new WeakMap<Room, RoomConnection>(); // roomId -> PeerRoom instance

  constructor(options?: PeerOptions) {
    this.peerId = options?.peerId || uuid();
  }

  get id(): string {
    return this.peerId;
  }

  /**
   * Get a RoomConnection or PeerChannel interface for a Room or Channel
   */
  in<T extends Room>(room: T): RoomConnection {
    const peerRoom = this.roomConnections.get(room);
    if (!peerRoom) {
      const newRoom = new RoomConnection(this, room);
      this.roomConnections.set(room, newRoom);
      return newRoom;
    }

    return peerRoom;
  }

  /**
   * Join a room (internal use by PeerRoom)
   */
  join(room: Room) {
    const peerRoom = this.in(room);
    return peerRoom.join();
  }

  /**
   * Leave a room (internal use by PeerRoom)
   */
  leave(room: Room) {
    const peerRoom = this.in(room);
    return peerRoom.leave();
  }
}