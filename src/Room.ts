import { InMemorySignalingAdapter } from './adapters/InMemorySignalingAdapter';

export type RoomMessageHandler = (message: string, fromPeerId: string) => void;

export class Room {
  id: string;
  signalingAdapter: InMemorySignalingAdapter;
  rtcConfiguration: RTCConfiguration;
  private connectedPeerIds: Set<string> = new Set(); // Track peer IDs only
  private isActive: boolean = true;
  private messageHandlers: Set<RoomMessageHandler> = new Set();
  private connectedPeer: any; // Reference to the peer that owns this room connection

  constructor(id: string, signalingAdapter: InMemorySignalingAdapter, rtcConfiguration?: RTCConfiguration) {
    this.id = id;
    this.signalingAdapter = signalingAdapter;
    this.rtcConfiguration = rtcConfiguration || {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'balanced' as RTCBundlePolicy,
      rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy
    };
  }

  /**
   * Add a peer ID to the room (for tracking purposes)
   */
  addPeer(peerId: string): void {
    if (!this.isActive) {
      throw new Error(`Cannot add peer to stopped room ${this.id}`);
    }
    this.connectedPeerIds.add(peerId);
    console.log(`[Room ${this.id}] Added peer ${peerId}`);
  }

  /**
   * Remove a peer from the room
   */
  removePeer(peerId: string): void {
    if (this.connectedPeerIds.delete(peerId)) {
      console.log(`[Room ${this.id}] Removed peer ${peerId}`);
    }
  }

  /**
   * Get all connected peer IDs
   */
  getConnectedPeerIds(): string[] {
    return Array.from(this.connectedPeerIds);
  }

  /**
   * Check if peer is connected to this room
   */
  hasPeer(peerId: string): boolean {
    return this.connectedPeerIds.has(peerId);
  }


  /**
   * Get the number of connected peers
   */
  getPeerCount(): number {
    return this.connectedPeerIds.size;
  }

  /**
   * Check if the room is active
   */
  isRoomActive(): boolean {
    return this.isActive;
  }

  /**
   * Stop the room (prevents new connections)
   */
  stop(): void {
    console.log(`[Room ${this.id}] Stopping room`);
    this.isActive = false;
    
    // Clear all peer IDs (individual peers will handle their own cleanup)
    this.connectedPeerIds.clear();
  }

  /**
   * Start the room (allows new connections)
   */
  start(): void {
    console.log(`[Room ${this.id}] Starting room`);
    this.isActive = true;
  }

  /**
   * Set the connected peer reference (used for sending messages)
   */
  setConnectedPeer(peer: any): void {
    this.connectedPeer = peer;
  }

  /**
   * Send message to all peers in the room
   */
  sendMessage(message: string): void {
    if (!this.connectedPeer) {
      console.warn(`[Room ${this.id}] No connected peer to send message`);
      return;
    }
    
    this.connectedPeer.sendMessageToAll(this.id, message);
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
   * Notify all message handlers of incoming message
   */
  notifyMessageHandlers(message: string, fromPeerId: string): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message, fromPeerId);
      } catch (error) {
        console.error(`[Room ${this.id}] Error in message handler:`, error);
      }
    });
  }
}