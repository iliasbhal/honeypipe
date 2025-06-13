import { InMemorySignalingAdapter } from './adapters/InMemorySignalingAdapter';
import { Peer } from './Peer';

export class Room {
  id: string;
  signalingAdapter: InMemorySignalingAdapter;
  rtcConfiguration: RTCConfiguration;
  private connectedPeers: Map<string, Peer> = new Map();
  private isActive: boolean = true;

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
   * Add a peer to the room (for tracking purposes)
   */
  addPeer(peer: Peer): void {
    if (!this.isActive) {
      throw new Error(`Cannot add peer to stopped room ${this.id}`);
    }
    this.connectedPeers.set(peer.id, peer);
    console.log(`[Room ${this.id}] Added peer ${peer.id}`);
  }

  /**
   * Remove a peer from the room
   */
  removePeer(peerId: string): void {
    if (this.connectedPeers.delete(peerId)) {
      console.log(`[Room ${this.id}] Removed peer ${peerId}`);
    }
  }

  /**
   * Get all connected peers
   */
  getConnectedPeers(): Peer[] {
    return Array.from(this.connectedPeers.values());
  }

  /**
   * Get peer by ID
   */
  getPeer(peerId: string): Peer | undefined {
    return this.connectedPeers.get(peerId);
  }

  /**
   * Check if peer is connected to this room
   */
  hasPeer(peerId: string): boolean {
    return this.connectedPeers.has(peerId);
  }

  /**
   * Get the number of connected peers
   */
  getPeerCount(): number {
    return this.connectedPeers.size;
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
    
    // Disconnect all peers
    this.connectedPeers.forEach((peer) => {
      peer.leaveRoom(this);
    });
    
    this.connectedPeers.clear();
  }

  /**
   * Start the room (allows new connections)
   */
  start(): void {
    console.log(`[Room ${this.id}] Starting room`);
    this.isActive = true;
  }
}