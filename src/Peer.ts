import { Room } from './Room';
import { PeerRoom } from './PeerRoom';

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
  static PeerRoom = PeerRoom;

  readonly peerId: string;
  private peerRooms = new WeakMap<Room, PeerRoom>(); // roomId -> PeerRoom instance

  constructor(options?: PeerOptions) {
    this.peerId = options?.peerId || uuid();
  }

  get id(): string {
    return this.peerId;
  }

  /**
   * Get a PeerRoom or PeerChannel interface for a Room or Channel
   */
  in<T extends Room>(room: T): PeerRoom {
    const peerRoom = this.peerRooms.get(room);
    if (!peerRoom) {
      const newRoom = new PeerRoom(this, room);
      this.peerRooms.set(room, newRoom);
      return newRoom;
    }

    return peerRoom;
  }

  /**
   * Join a room (internal use by PeerRoom)
   */
  join(room: Room): PeerRoom {
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