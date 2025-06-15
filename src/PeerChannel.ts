import { Peer } from './Peer';
import { Channel } from './Channel';

export type ChannelMessageHandler = (message: string, fromPeerId: string) => void;

/**
 * PeerChannel provides channel-specific operations for a peer
 * Created via peer.via(channel)
 */
export class PeerChannel<MessageType = any> {
  __type!: MessageType;
  private peer: Peer;
  private channel: Channel<MessageType>;
  private messageHandlers: Set<ChannelMessageHandler> = new Set();

  constructor(peer: Peer, channel: Channel<MessageType>) {
    this.peer = peer;
    this.channel = channel;
  }

  /**
   * Get the channel ID
   */
  get id(): string {
    return this.channel.id;
  }

  /**
   * Get the underlying channel
   */
  getChannel(): Channel<MessageType> {
    return this.channel;
  }

  /**
   * Get the peer connection actor for this channel
   */
  getActor(): any {
    // First check if we have a room connection for this channel
    const roomActor = this.peer.getRoomConnectionActor(this.channel.roomId);
    if (!roomActor) {
      return null;
    }

    // Get the peer connection from the room connection
    const snapshot = roomActor.getSnapshot();
    const otherPeerId = this.channel.getOtherPeerId(this.peer.peerId);
    if (!otherPeerId) {
      return null;
    }

    return snapshot.context.peerConnections?.get(otherPeerId);
  }

  /**
   * Check if connected to the other peer
   */
  isConnected(): boolean {
    return !!this.getActor();
  }

  /**
   * Send a message to the other peer
   */
  send(message: string): void {
    const actor = this.getActor();
    if (actor) {
      // Direct peer connection available
      actor.send({
        type: 'SEND_MESSAGE',
        message: message
      });
    } else {
      // Fallback to room-based messaging
      const roomActor = this.peer.getRoomConnectionActor(this.channel.roomId);
      if (!roomActor) {
        throw new Error(`Not connected to room ${this.channel.roomId} for channel ${this.channel.id}`);
      }

      const otherPeerId = this.channel.getOtherPeerId(this.peer.peerId);
      if (!otherPeerId) {
        throw new Error(`Cannot determine target peer for channel ${this.channel.id}`);
      }

      roomActor.send({
        type: 'SEND_MESSAGE_TO_PEER',
        peerId: otherPeerId,
        message: message
      });
    }
  }

  /**
   * Send a message to a specific data channel
   */
  sendToDataChannel(label: string, message: string): void {
    const actor = this.getActor();
    if (actor) {
      // Direct peer connection available
      actor.send({
        type: 'SEND_DATA_CHANNEL_MESSAGE',
        label: label,
        message: message
      });
    } else {
      // Fallback to room-based messaging
      const roomActor = this.peer.getRoomConnectionActor(this.channel.roomId);
      if (!roomActor) {
        throw new Error(`Not connected to room ${this.channel.roomId} for channel ${this.channel.id}`);
      }

      const otherPeerId = this.channel.getOtherPeerId(this.peer.peerId);
      if (!otherPeerId) {
        throw new Error(`Cannot determine target peer for channel ${this.channel.id}`);
      }

      roomActor.send({
        type: 'SEND_MESSAGE_TO_DATACHANNEL',
        peerId: otherPeerId,
        label: label,
        message: message
      });
    }
  }

  /**
   * Register a handler for incoming channel messages
   */
  onMessage(handler: ChannelMessageHandler): () => void {
    this.messageHandlers.add(handler);
    
    // Return cleanup function
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Notify message handlers (called by Peer)
   */
  notifyMessageHandlers(message: string, fromPeerId: string): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message, fromPeerId);
      } catch (error) {
        console.error(`[PeerChannel ${this.channel.id}] Error in message handler:`, error);
      }
    });
  }

  /**
   * Get the other peer ID in this channel
   */
  getOtherPeerId(): string | null {
    return this.channel.getOtherPeerId(this.peer.peerId);
  }

  /**
   * Get both peer IDs in this channel
   */
  getPeerIds(): readonly [string, string] {
    return this.channel.peerIds;
  }
}