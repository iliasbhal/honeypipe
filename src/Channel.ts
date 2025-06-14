import { InMemorySignalingAdapter } from './adapters/InMemorySignalingAdapter';
import { PostMessageSignalingAdapter } from './adapters/PostMessageSignalingAdapter';
import { RedisSignalingAdapter } from './adapters/RedisSignalingAdapter';
import { Peer } from './Peer';
import { Room } from './Room';

export type ChannelMessageHandler = (message: string, fromPeerId: string) => void;

/**
 * Channel represents a peer-to-peer communication channel between exactly two peers.
 * It handles SDP/ICE signaling and message passing for WebRTC connections.
 */
export class Channel<MessageType> {
  __type!: MessageType;
  id: string; // Format: "roomId:peerId1-peerId2" (alphabetically sorted)
  roomId: string;
  peerIds: [string, string]; // The two peer IDs in this channel
  signalingAdapter: InMemorySignalingAdapter | PostMessageSignalingAdapter | RedisSignalingAdapter;
  private messageHandlers: Set<ChannelMessageHandler> = new Set();
  private connectedPeers: Map<string, Peer> = new Map(); // Should only have 2 peers max
  private room: Room; // Reference to the room for message routing
  private peerConnectionActor: any; // HoneyPeerConnection actor for this channel
  private isActive: boolean = true;

  constructor(id: string, signalingAdapter: InMemorySignalingAdapter | PostMessageSignalingAdapter | RedisSignalingAdapter, roomId?: string) {
    this.id = id;
    this.roomId = roomId || id.split(':')[0]; // Extract roomId from id if not provided
    this.signalingAdapter = signalingAdapter;
    
    // Extract peer IDs from channel ID
    const channelPart = id.includes(':') ? id.split(':')[1] : id;
    const [peerId1, peerId2] = channelPart.split('-');
    this.peerIds = [peerId1, peerId2];
    
    if (!peerId1 || !peerId2) {
      throw new Error(`Invalid channel ID format: ${id}. Expected "roomId:peerId1-peerId2"`);
    }
  }

  notifyMessageRecevied(messageStr: string): void {
    if (!this.isActive) {
      console.warn(`Channel ${this.id} is stopped, ignoring message`);
      return;
    }

    try {
      const message = JSON.parse(messageStr) as MessageType;
      // This is the old generic message handler - keeping for backward compatibility
      // New string-based handlers are used for the improved API
    } catch (e) {
      console.error(`Failed to parse message on channel ${this.id}:`, e);
    }
  }

  /**
   * Set the room reference for message routing
   */
  setRoom(room: Room): void {
    this.room = room;
  }

  /**
   * Set the HoneyPeerConnection actor for this channel
   */
  setPeerConnectionActor(actor: any): void {
    this.peerConnectionActor = actor;
  }

  /**
   * Get the HoneyPeerConnection actor for this channel
   */
  getPeerConnectionActor(): any {
    return this.peerConnectionActor;
  }

  /**
   * Check if this channel has a peer connection actor
   */
  hasPeerConnectionActor(): boolean {
    return !!this.peerConnectionActor;
  }

  /**
   * Check if a peer ID belongs to this channel
   */
  hasPeerId(peerId: string): boolean {
    return this.peerIds.includes(peerId);
  }

  /**
   * Get the other peer ID in this channel (given one peer ID)
   */
  getOtherPeerId(peerId: string): string | null {
    if (!this.hasPeerId(peerId)) {
      return null;
    }
    return this.peerIds[0] === peerId ? this.peerIds[1] : this.peerIds[0];
  }

  /**
   * Get both peer IDs in this channel
   */
  getPeerIds(): [string, string] {
    return [...this.peerIds] as [string, string];
  }

  /**
   * Send message to the other peer in this channel
   */
  sendMessage(message: string, dataChannelLabel?: string): void {
    // First try to use the direct peer connection actor
    if (this.peerConnectionActor) {
      if (dataChannelLabel) {
        this.peerConnectionActor.send({
          type: 'SEND_DATA_CHANNEL_MESSAGE',
          label: dataChannelLabel,
          message: message
        });
      } else {
        this.peerConnectionActor.send({
          type: 'SEND_MESSAGE',
          message: message
        });
      }
      return;
    }

    // Fallback to room-based messaging if no direct peer connection
    if (!this.room) {
      console.warn(`[Channel ${this.id}] No peer connection actor or room available to send message`);
      return;
    }

    // Try to get peer connection actor from room
    const roomPeerConnectionActor = this.room.getPeerConnectionActor?.(this.peerIds[0], this.peerIds[1]);
    if (roomPeerConnectionActor) {
      this.setPeerConnectionActor(roomPeerConnectionActor);
      this.sendMessage(message, dataChannelLabel); // Retry with the actor
      return;
    }

    // Ultimate fallback: use room connection actors
    const roomConnectionActors = this.room.roomConnectionActors;
    if (!roomConnectionActors || roomConnectionActors.size === 0) {
      console.warn(`[Channel ${this.id}] No messaging path available`);
      return;
    }

    // Find which peer's room connection can send the message
    const senderPeerId = Array.from(roomConnectionActors.keys()).find(id => this.hasPeerId(id));
    if (!senderPeerId) {
      console.warn(`[Channel ${this.id}] No channel peers found in room connections`);
      return;
    }

    const targetPeerId = this.getOtherPeerId(senderPeerId);
    const senderActor = roomConnectionActors.get(senderPeerId);
    
    if (!senderActor || !targetPeerId) {
      console.warn(`[Channel ${this.id}] Cannot determine message routing`);
      return;
    }

    // Send via room connection actor
    if (dataChannelLabel) {
      senderActor.send({
        type: 'SEND_MESSAGE_TO_DATACHANNEL',
        peerId: targetPeerId,
        label: dataChannelLabel,
        message: message
      });
    } else {
      senderActor.send({
        type: 'SEND_MESSAGE_TO_PEER',
        peerId: targetPeerId,
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
   * Notify all message handlers of incoming message
   */
  notifyMessageHandlers(message: string, fromPeerId: string): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message, fromPeerId);
      } catch (error) {
        console.error(`[Channel ${this.id}] Error in message handler:`, error);
      }
    });
  }

  /**
   * Track a peer that has connected to this channel
   */
  addPeer(peer: Peer): void {
    if (!this.isActive) {
      console.warn(`[Channel ${this.id}] Channel is stopped, cannot add peer ${peer.id}`);
      return;
    }

    if (!this.hasPeerId(peer.id)) {
      console.warn(`[Channel ${this.id}] Peer ${peer.id} does not belong to this channel. Expected: ${this.peerIds.join(' or ')}`);
      return;
    }

    console.log(`[Channel ${this.id}] Adding peer ${peer.id}`);
    this.connectedPeers.set(peer.id, peer);
  }

  /**
   * Remove a peer from this channel
   */
  removePeer(peerId: string): void {
    if (this.connectedPeers.has(peerId)) {
      console.log(`[Channel ${this.id}] Removing peer ${peerId}`);
      this.connectedPeers.delete(peerId);
    }
  }

  /**
   * Get all connected peer instances
   */
  getConnectedPeers(): Peer[] {
    return Array.from(this.connectedPeers.values());
  }

  /**
   * Get connected peer count
   */
  getConnectedPeerCount(): number {
    return this.connectedPeers.size;
  }

  /**
   * Check if a specific peer is currently connected to this channel
   */
  isPeerConnected(peerId: string): boolean {
    return this.connectedPeers.has(peerId);
  }

  /**
   * Check if both channel peers are connected
   */
  isBothPeersConnected(): boolean {
    return this.peerIds.every(peerId => this.connectedPeers.has(peerId));
  }

  /**
   * Get the peer instance for a given peer ID (if connected)
   */
  getPeer(peerId: string): Peer | null {
    return this.connectedPeers.get(peerId) || null;
  }

  // Stop the channel and disconnect all peers
  async stop(): Promise<void> {
    if (!this.isActive) {
      console.warn(`Channel ${this.id} is already stopped`);
      return;
    }

    console.log(`[Channel ${this.id}] Stopping channel with ${this.connectedPeers.size} peers`);
    this.isActive = false;

    // Disconnect all peers from this channel
    const disconnectPromises: Promise<void>[] = [];
    for (const [peerId, peer] of this.connectedPeers) {
      console.log(`[Channel ${this.id}] Disconnecting peer ${peerId}`);
      // Call peer's internal disconnect method for this channel
      const connection = (peer as any).connections.get(this.id);
      if (connection) {
        disconnectPromises.push(
          new Promise<void>((resolve) => {
            // Send CLOSE_CONNECTION and wait for machine to reach final state
            connection.stateMachine.send({ type: 'CLOSE_CONNECTION', origin: 'main' });

            // Subscribe to state changes to know when machine reaches final state
            const subscription = connection.stateMachine.subscribe((state) => {
              if (state.status === 'done') {
                subscription.unsubscribe();
                (peer as any).connections.delete(this.id);
                resolve();
              }
            });

            // Fallback timeout in case something goes wrong
            setTimeout(() => {
              subscription.unsubscribe();
              connection.stateMachine.stop();
              (peer as any).connections.delete(this.id);
              resolve();
            }, 1000);
          })
        );
      }
    }

    // Wait for all disconnections
    await Promise.all(disconnectPromises);

    // Clear all handlers and peers
    this.messageHandlers.clear();
    this.connectedPeers.clear();

    console.log(`[Channel ${this.id}] Channel stopped successfully`);
  }

  // Check if channel is active
  isChannelActive(): boolean {
    return this.isActive;
  }
}