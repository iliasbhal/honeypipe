import { createActor, Actor } from 'xstate';
import { HoneyRoomConnection } from './machines/HoneyRoomConnection';
import { Room } from './Room';

export interface PeerOptions {
  peerId: string;
}

interface RoomConnection {
  room: Room;
  roomConnectionActor: Actor<typeof HoneyRoomConnection>;
}

export class Peer {
  static Room = Room;

  peerId: string;
  roomConnections: Map<string, RoomConnection> = new Map(); // roomId -> room connection

  constructor(options: PeerOptions) {
    this.peerId = options.peerId;
  }

  get id(): string {
    return this.peerId;
  }

  async joinRoom(room: Room): Promise<void> {
    console.log(`[${this.peerId}] Joining room ${room.id}...`);

    // Check if room is active
    if (!room.isRoomActive()) {
      throw new Error(`Cannot join stopped room ${room.id}`);
    }

    // Check if already connected to this room
    if (this.roomConnections.has(room.id)) {
      console.log(`[${this.peerId}] Already connected to room ${room.id}`);
      return;
    }

    // Create room connection actor
    const roomConnectionActor = createActor(HoneyRoomConnection, {
      input: {
        room: room,
        localPeer: this,
        rtcConfiguration: room.rtcConfiguration,
        parentRef: {
          send: (event: any) => {
            console.log(`[${this.peerId}] Room connection event:`, event);
            // Handle room connection events here
          }
        }
      },
    });

    // Store room connection
    this.roomConnections.set(room.id, {
      room,
      roomConnectionActor
    });

    // Add this peer to the room's peer list
    room.addPeer(this);

    // Start the room connection actor
    roomConnectionActor.start();
    
    // Join the room
    roomConnectionActor.send({ type: 'JOIN_ROOM' });

    console.log(`[${this.peerId}] Started connection to room ${room.id}`);
  }

  async leaveRoom(room: Room): Promise<void> {
    const roomConnection = this.roomConnections.get(room.id);
    if (!roomConnection) {
      console.warn(`[${this.peerId}] Not connected to room ${room.id}`);
      return;
    }

    console.log(`[${this.peerId}] Leaving room ${room.id}`);

    // Remove this peer from the room
    room.removePeer(this.peerId);

    // Send leave room event and wait for machine to reach final state
    roomConnection.roomConnectionActor.send({ type: 'LEAVE_ROOM' });

    // Wait for the state machine to properly close
    await new Promise<void>((resolve) => {
      const subscription = roomConnection.roomConnectionActor.subscribe((state) => {
        if (state.value === 'disconnected') {
          subscription.unsubscribe();
          this.roomConnections.delete(room.id);
          resolve();
        }
      });

      // Fallback timeout
      setTimeout(() => {
        subscription.unsubscribe();
        roomConnection.roomConnectionActor.stop();
        this.roomConnections.delete(room.id);
        resolve();
      }, 1000);
    });

    console.log(`[${this.peerId}] Left room ${room.id}`);
  }

  sendMessageToPeer(roomId: string, peerId: string, message: string): void {
    const roomConnection = this.roomConnections.get(roomId);
    if (!roomConnection) {
      console.warn(`[${this.peerId}] No connection found for room ${roomId}`);
      return;
    }

    roomConnection.roomConnectionActor.send({
      type: 'SEND_MESSAGE_TO_PEER',
      peerId: peerId,
      message: message
    });
  }

  sendMessageToAll(roomId: string, message: string): void {
    const roomConnection = this.roomConnections.get(roomId);
    if (!roomConnection) {
      console.warn(`[${this.peerId}] No connection found for room ${roomId}`);
      return;
    }

    roomConnection.roomConnectionActor.send({
      type: 'SEND_MESSAGE_TO_ALL',
      message: message
    });
  }

  sendMessageToDataChannel(roomId: string, peerId: string, label: string, message: string): void {
    const roomConnection = this.roomConnections.get(roomId);
    if (!roomConnection) {
      console.warn(`[${this.peerId}] No connection found for room ${roomId}`);
      return;
    }

    roomConnection.roomConnectionActor.send({
      type: 'SEND_MESSAGE_TO_DATACHANNEL',
      peerId: peerId,
      label: label,
      message: message
    });
  }

  getRoomConnectionState(roomId: string): string {
    const roomConnection = this.roomConnections.get(roomId);
    if (!roomConnection) return 'disconnected';

    const snapshot = roomConnection.roomConnectionActor.getSnapshot();
    return snapshot.value as string;
  }

  getAllRoomStates(): Record<string, { connectionState: string; alivePeers: string[] }> {
    const states: Record<string, any> = {};
    this.roomConnections.forEach((roomConnection, roomId) => {
      const snapshot = roomConnection.roomConnectionActor.getSnapshot();
      states[roomId] = {
        connectionState: snapshot.value,
        alivePeers: Array.from(snapshot.context.alivePeers),
      };
    });
    return states;
  }

  async close(): Promise<void> {
    console.log(`[${this.peerId}] Closing all room connections`);

    const leavePromises: Promise<void>[] = [];
    this.roomConnections.forEach((roomConnection) => {
      leavePromises.push(this.leaveRoom(roomConnection.room));
    });

    await Promise.all(leavePromises);
    console.log(`[${this.peerId}] Closed all connections`);
  }
}