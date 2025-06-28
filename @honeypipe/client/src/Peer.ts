import { Room } from './Room';
import { RoomConnection } from './RoomConnection';
import { uuid } from './utils/uuid';

export interface PeerOptions {
  peerId: string;
}

/**
 * Peer represents a WebRTC peer with all actors managed internally
 * Use peer.via(room) or peer.via(channel) to interact with rooms and channels
 */
export class Peer {
  static GlobalId = uuid();
  readonly peerId: string;
  private roomConnections = new WeakMap<Room, RoomConnection>(); // roomId -> PeerRoom instance

  constructor(options?: PeerOptions) {
    this.peerId = this.createPeerId(options?.peerId);
  }


  /**
   * Create a peer id (internal use)
   * this is used to ensure that the peer id changes when user reloads the page
   * Otherwise, the peer id will be the same as the previous one and the peer will not be able to connect
   * to other peers in the room.
   * @param peerId - The peer id to create
   * @returns The peer id
   */
  private createPeerId(peerId?: string) {
    return (peerId || uuid()) + '-' + Peer.GlobalId;
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
  async join(room: Room) {
    const peerRoom = this.in(room);
    await peerRoom.join();
  }

  /**
   * Leave a room (internal use by PeerRoom)
   */
  async leave(room: Room) {
    const peerRoom = this.in(room);
    await peerRoom.leave();
  }
}