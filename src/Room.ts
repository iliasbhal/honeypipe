import { InMemorySignalingAdapter } from './adapters/InMemorySignalingAdapter';
import { RedisSignalingAdapter } from './adapters/RedisSignalingAdapter';
import { createActor, Actor } from 'xstate';

export type RoomMessageHandler = (message: string, fromPeerId: string) => void;
export type RoomPresenceHandler = (event: { type: 'join' | 'leave' | 'alive'; peerId: string; roomId: string }) => void;

export class Room {
  id: string;
  signalingAdapter: InMemorySignalingAdapter | RedisSignalingAdapter;
  rtcConfiguration: RTCConfiguration;
  private connectedPeerIds: Set<string> = new Set(); // Track peer IDs only
  private isActive: boolean = true;
  private messageHandlers: Set<RoomMessageHandler> = new Set();
  private presenceHandlers: Set<RoomPresenceHandler> = new Set();
  roomConnectionActors: Map<string, any> = new Map(); // peerId -> actor (made public for Channel access)

  constructor(id: string, signalingAdapter: InMemorySignalingAdapter | RedisSignalingAdapter, rtcConfiguration?: RTCConfiguration) {
    this.id = id;
    this.signalingAdapter = signalingAdapter;
    this.rtcConfiguration = rtcConfiguration;
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
   * Add a peer to the room and create room connection
   */
  async addPeerConnection(peer: any): Promise<void> {
    if (!this.isActive) {
      throw new Error(`Cannot join stopped room ${this.id}`);
    }

    if (this.roomConnectionActors.has(peer.peerId)) {
      console.log(`[Room ${this.id}] Peer ${peer.peerId} already connected`);
      return;
    }

    console.log(`[Room ${this.id}] Adding peer ${peer.peerId}`);

    // Dynamic import to avoid circular dependency
    const { HoneyRoomConnection } = await import('./machines/HoneyRoomConnection');

    // Create room connection actor for this peer
    const roomConnectionActor = createActor(HoneyRoomConnection, {
      input: {
        room: this,
        localPeer: peer,
        rtcConfiguration: this.rtcConfiguration,
        parentRef: {
          send: (event: any) => {
            this.handleRoomConnectionEvent(event, peer.peerId);
          }
        }
      },
    });

    this.roomConnectionActors.set(peer.peerId, roomConnectionActor);
    this.connectedPeerIds.add(peer.peerId);

    // Start the room connection actor
    roomConnectionActor.start();

    // Join the room
    roomConnectionActor.send({ type: 'JOIN_ROOM' });

    console.log(`[Room ${this.id}] Started connection for peer ${peer.peerId}`);
  }

  /**
   * Remove a peer from the room
   */
  async removePeerConnection(peerId: string): Promise<void> {
    const roomConnectionActor = this.roomConnectionActors.get(peerId);
    if (!roomConnectionActor) {
      console.warn(`[Room ${this.id}] Peer ${peerId} not connected`);
      return;
    }

    console.log(`[Room ${this.id}] Removing peer ${peerId}`);

    // Send leave room event and wait for machine to reach final state
    roomConnectionActor.send({ type: 'LEAVE_ROOM' });

    // Wait for the state machine to properly close
    await new Promise<void>((resolve) => {
      const subscription = roomConnectionActor.subscribe((state) => {
        if (state.value === 'disconnected') {
          subscription.unsubscribe();
          this.roomConnectionActors.delete(peerId);
          this.connectedPeerIds.delete(peerId);
          resolve();
        }
      });

      // Fallback timeout
      setTimeout(() => {
        subscription.unsubscribe();
        roomConnectionActor.stop();
        this.roomConnectionActors.delete(peerId);
        this.connectedPeerIds.delete(peerId);
        resolve();
      }, 1000);
    });

    console.log(`[Room ${this.id}] Removed peer ${peerId}`);
  }

  /**
   * Send message to all peers in the room
   */
  sendMessage(message: string): void {
    if (this.roomConnectionActors.size === 0) {
      console.warn(`[Room ${this.id}] No connected peers to send message`);
      return;
    }

    // Send to all connected peers
    this.roomConnectionActors.forEach((actor) => {
      actor.send({
        type: 'SEND_MESSAGE_TO_ALL',
        message: message,
        broadcast: true
      } as any);
    });
  }

  /**
   * Get a channel for communication between two peers in this room
   */
  getChannel(peerId1: string, peerId2: string): any {
    const { Channel } = require('./Channel');
    const sortedPeerIds = [peerId1, peerId2].sort();
    const channelId = `${this.id}:${sortedPeerIds[0]}-${sortedPeerIds[1]}`;

    const channel = new Channel(channelId, this.signalingAdapter, this.id);
    channel.setRoom(this);

    // Try to set the peer connection actor if available
    const peerConnectionActor = this.getPeerConnectionActor(peerId1, peerId2);
    if (peerConnectionActor) {
      channel.setPeerConnectionActor(peerConnectionActor);
    }

    return channel;
  }

  /**
   * Get the HoneyPeerConnection actor for a specific peer pair
   */
  getPeerConnectionActor(peerId1: string, peerId2: string): any {
    // Check if either peer has the connection to the other
    for (const [connectedPeerId, roomConnectionActor] of this.roomConnectionActors) {
      if (connectedPeerId === peerId1) {
        // Look for peer connection to peerId2
        const snapshot = roomConnectionActor.getSnapshot();
        const peerConnection = snapshot.context.peerConnections?.get(peerId2);
        if (peerConnection) {
          return peerConnection;
        }
      } else if (connectedPeerId === peerId2) {
        // Look for peer connection to peerId1
        const snapshot = roomConnectionActor.getSnapshot();
        const peerConnection = snapshot.context.peerConnections?.get(peerId1);
        if (peerConnection) {
          return peerConnection;
        }
      }
    }
    return null;
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
   * Handle events from room connection actors
   */
  private handleRoomConnectionEvent(event: any, fromPeerId: string): void {
    console.log(`[Room ${this.id}] Event from ${fromPeerId}:`, event);

    switch (event.type) {
      case 'ROOM_MESSAGE_RECEIVED':
        if (event.broadcast) {
          // Route to room message handlers
          this.notifyMessageHandlers(event.message, event.fromPeerId);
        }
        // Note: non-broadcast messages will be routed to channels directly
        break;
      case 'ROOM_PEER_CONNECTED':
        this.notifyPresenceHandlers({ type: 'join', peerId: event.peerId, roomId: event.roomId });
        break;
      case 'ROOM_PEER_DISCONNECTED':
        this.notifyPresenceHandlers({ type: 'leave', peerId: event.peerId, roomId: event.roomId });
        break;
    }
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

  /**
   * Notify all presence handlers of presence event
   */
  notifyPresenceHandlers(event: { type: 'join' | 'leave' | 'alive'; peerId: string; roomId: string }): void {
    this.presenceHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`[Room ${this.id}] Error in presence handler:`, error);
      }
    });
  }
}