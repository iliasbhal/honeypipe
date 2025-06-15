import { Peer } from './Peer';
import { Room } from './Room';
import { Channel } from './Channel';

export type RoomMessageHandler = (message: string, fromPeerId: string) => void;
export type RoomPresenceHandler = (event: { type: 'join' | 'leave' | 'alive'; peerId: string; roomId: string }) => void;

/**
 * PeerRoom provides room-specific operations for a peer
 * Created via peer.via(room)
 */
export class PeerRoom {
  private peer: Peer;
  private room: Room;
  private messageHandlers: Set<RoomMessageHandler> = new Set();
  private presenceHandlers: Set<RoomPresenceHandler> = new Set();

  constructor(peer: Peer, room: Room) {
    this.peer = peer;
    this.room = room;
  }

  /**
   * Get the room ID
   */
  get id(): string {
    return this.room.id;
  }

  /**
   * Get the underlying room
   */
  getRoom(): Room {
    return this.room;
  }

  /**
   * Get the room connection actor
   */
  getActor(): any {
    return this.peer.getRoomConnectionActor(this.room.id);
  }

  /**
   * Check if connected to this room
   */
  isConnected(): boolean {
    return !!this.getActor();
  }

  /**
   * Join the room
   */
  async join(): Promise<void> {
    await this.peer.joinRoom(this.room);
  }

  /**
   * Leave the room
   */
  async leave(): Promise<void> {
    await this.peer.leaveRoom(this.room);
  }

  /**
   * Send a broadcast message to all peers in the room
   */
  broadcast(message: string): void {
    const actor = this.getActor();
    if (!actor) {
      throw new Error(`Not connected to room ${this.room.id}`);
    }

    actor.send({
      type: 'SEND_MESSAGE_TO_ALL',
      message: message,
      broadcast: true
    });
  }

  /**
   * Send a message to a specific peer in the room
   */
  sendTo(peerId: string, message: string): void {
    const actor = this.getActor();
    if (!actor) {
      throw new Error(`Not connected to room ${this.room.id}`);
    }

    actor.send({
      type: 'SEND_MESSAGE_TO_PEER',
      peerId: peerId,
      message: message
    });
  }

  /**
   * Send a message to a specific data channel of a peer
   */
  sendToDataChannel(peerId: string, label: string, message: string): void {
    const actor = this.getActor();
    if (!actor) {
      throw new Error(`Not connected to room ${this.room.id}`);
    }

    actor.send({
      type: 'SEND_MESSAGE_TO_DATACHANNEL',
      peerId: peerId,
      label: label,
      message: message
    });
  }

  /**
   * Get a channel for communication with another peer
   */
  getChannel(otherPeerId: string): Channel {
    return new Channel(this.room.id, this.peer.peerId, otherPeerId);
  }

  /**
   * Register a handler for incoming room messages
   */
  onMessage(handler: RoomMessageHandler): () => void {
    this.messageHandlers.add(handler);
    
    // Return cleanup function
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Register a handler for room presence updates
   */
  onPresence(handler: RoomPresenceHandler): () => void {
    this.presenceHandlers.add(handler);
    
    // Return cleanup function
    return () => {
      this.presenceHandlers.delete(handler);
    };
  }

  /**
   * Get connected peer IDs in this room
   */
  getConnectedPeerIds(): string[] {
    const actor = this.getActor();
    if (!actor) {
      return [];
    }

    const snapshot = actor.getSnapshot();
    return Array.from(snapshot.context.alivePeers || new Set());
  }

  /**
   * Notify message handlers (called by Peer)
   */
  notifyMessageHandlers(message: string, fromPeerId: string): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message, fromPeerId);
      } catch (error) {
        console.error(`[PeerRoom ${this.room.id}] Error in message handler:`, error);
      }
    });
  }

  /**
   * Notify presence handlers (called by Peer)
   */
  notifyPresenceHandlers(event: { type: 'join' | 'leave' | 'alive'; peerId: string; roomId: string }): void {
    this.presenceHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`[PeerRoom ${this.room.id}] Error in presence handler:`, error);
      }
    });
  }
}