import { InMemorySignalingAdapter } from './adapters/InMemorySignalingAdapter';
import { Peer } from './Peer';

export type ChannelMessageHandler = (message: string, fromPeerId: string) => void;

/**
 * Channel represents a peer-to-peer communication channel between exactly two peers.
 * It handles SDP/ICE signaling and message passing for WebRTC connections.
 */
export class Channel<MessageType> {
  __type!: MessageType;
  id: string; // Format: "roomId:peerId1-peerId2" (alphabetically sorted)
  roomId: string;
  signalingAdapter: InMemorySignalingAdapter;
  private messageHandlers: Set<ChannelMessageHandler> = new Set();
  private connectedPeers: Map<string, Peer> = new Map(); // Should only have 2 peers max
  private room: any; // Reference to the room for message routing
  private isActive: boolean = true;

  constructor(id: string, signalingAdapter: InMemorySignalingAdapter, roomId?: string) {
    this.id = id;
    this.roomId = roomId || id.split(':')[0]; // Extract roomId from id if not provided
    this.signalingAdapter = signalingAdapter;
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
  setRoom(room: any): void {
    this.room = room;
  }

  /**
   * Send message to the other peer in this channel
   */
  sendMessage(message: string, dataChannelLabel?: string): void {
    if (!this.room) {
      console.warn(`[Channel ${this.id}] No room connection to send message`);
      return;
    }
    
    const [peerId1, peerId2] = this.id.split(':')[1].split('-');
    
    // Find which room connection actor should handle this message
    // We need to send via any peer's room connection actor
    const roomConnectionActors = this.room.roomConnectionActors;
    if (roomConnectionActors.size === 0) {
      console.warn(`[Channel ${this.id}] No room connection actors available`);
      return;
    }

    // Use the first available room connection actor to send the message
    const firstActor = Array.from(roomConnectionActors.values())[0];
    
    // Determine target peer ID
    const senderPeerId = Array.from(roomConnectionActors.keys())[0];
    const targetPeerId = peerId1 === senderPeerId ? peerId2 : peerId1;
    
    if (dataChannelLabel) {
      firstActor.send({
        type: 'SEND_MESSAGE_TO_DATACHANNEL',
        peerId: targetPeerId,
        label: dataChannelLabel,
        message: message
      });
    } else {
      firstActor.send({
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

  // Track a peer that has connected to this channel
  addPeer(peer: Peer): void {
    if (!this.isActive) {
      console.warn(`Channel ${this.id} is stopped, cannot add peer ${peer.id}`);
      return;
    }

    console.log(`[Channel ${this.id}] Adding peer ${peer.id}`);
    this.connectedPeers.set(peer.id, peer);
  }

  // Remove a peer from this channel
  removePeer(peerId: string): void {
    console.log(`[Channel ${this.id}] Removing peer ${peerId}`);
    this.connectedPeers.delete(peerId);
  }

  // Get all connected peers
  getPeers(): Peer[] {
    return Array.from(this.connectedPeers.values());
  }

  // Get peer count
  getPeerCount(): number {
    return this.connectedPeers.size;
  }

  // Check if a specific peer is connected
  hasPeer(peerId: string): boolean {
    return this.connectedPeers.has(peerId);
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