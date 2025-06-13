import { InMemorySignalingAdapter } from './adapters/InMemorySignalingAdapter';
import { Peer } from './Peer';

/**
 * Channel represents a peer-to-peer communication channel between exactly two peers.
 * It handles SDP/ICE signaling and message passing for WebRTC connections.
 */
export class Channel<MessageType> {
  __type!: MessageType;
  id: string; // Format: "peerId1-peerId2" (alphabetically sorted)
  signalingAdapter: InMemorySignalingAdapter;
  private messageHandlers: Set<(message: MessageType) => void> = new Set();
  private connectedPeers: Map<string, Peer> = new Map(); // Should only have 2 peers max
  private isActive: boolean = true;

  constructor(id: string, signalingAdapter: InMemorySignalingAdapter) {
    this.id = id;
    this.signalingAdapter = signalingAdapter;
  }

  notifyMessageRecevied(messageStr: string): void {
    if (!this.isActive) {
      console.warn(`Channel ${this.id} is stopped, ignoring message`);
      return;
    }

    try {
      const message = JSON.parse(messageStr) as MessageType;
      this.messageHandlers.forEach(handler => handler(message));
    } catch (e) {
      console.error(`Failed to parse message on channel ${this.id}:`, e);
    }
  }

  onMessage(callback: (message: MessageType) => void): () => void {
    this.messageHandlers.add(callback);

    // Return cleanup function
    return () => {
      this.messageHandlers.delete(callback);
    };
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