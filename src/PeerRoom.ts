import { Peer } from './Peer';
import { Room } from './Room';
import { SignalingEvent } from './adapters/RedisSignalingAdapter';
import { PeerChannel } from './PeerChannel';
import { wait } from './utils/wait';

export type RoomMessageHandler = (message: string, fromPeerId: string) => void;
export type RoomPresenceHandler = (event: SignalingEvent) => void;

/**
 * PeerRoom provides room-specific operations for a peer
 * Created via peer.via(room)
 */
export class PeerRoom {
  private peer: Peer;
  private room: Room;
  private messageHandlers: Set<RoomMessageHandler> = new Set();
  private presenceHandlers: Set<RoomPresenceHandler> = new Set();
  private peerChannels = new Map<string, PeerChannel>();

  constructor(peer: Peer, room: Room) {
    this.peer = peer;
    this.room = room;
  }

  static createPeerSignalLoop() {
    return {
      started: false,
      abortController: new AbortController(),
      joinSignalCount: 0,
      pullOffsetIndex: 0,
    };
  }


  peerSingalLoop = PeerRoom.createPeerSignalLoop()

  private startPeerSignalLoop() {
    if (this.peerSingalLoop.started) {
      return;
    }

    this.peerSingalLoop = PeerRoom.createPeerSignalLoop();
    this.peerSingalLoop.started = true;
    const abortSignal = this.peerSingalLoop.abortController.signal;

    // Keep sending join/alive signals
    Promise.resolve().then(async () => {
      while (!abortSignal.aborted) {
        const isJoin = this.peerSingalLoop.joinSignalCount === 0;

        this.peerSingalLoop.joinSignalCount += 1;
        this.room.signalingAdapter.push({
          roomId: this.room.id,
          peerId: this.peer.id,
          type: isJoin ? 'join' : 'alive',
        })

        await wait(5000);
      }
    })

    // Keep pulling events from the room
    // To ensure we know who is in the room
    // In order to create direct webRTC connections
    // with each member of the room
    Promise.resolve().then(async () => {
      let waitTime = 100; // Start with 100ms wait
      const maxWaitTime = 5000; // Cap at 5 seconds

      while (!abortSignal.aborted) {
        const events = await this.room.signalingAdapter.pull({
          roomId: this.room.id,
          offsetIndex: this.peerSingalLoop.pullOffsetIndex,
        });

        for (const event of events) {
          this.processSignalingEvent(event);
          this.peerSingalLoop.pullOffsetIndex += 1;
        }

        const hasEvents = events.length > 0;
        waitTime = hasEvents ? 100 : Math.min(waitTime * 2, maxWaitTime);
        await wait(waitTime);
      }
    })
  }

  private stopPeerSignalLoop() {
    this.peerSingalLoop.abortController.abort();
    this.peerSingalLoop.started = false;
  }

  processSignalingEvent(event: SignalingEvent) {
    const isSelfEvent = event.peerId === this.peer.id;
    const isJoinOrAlive = event.type === 'join' || event.type === 'alive';

    if (isSelfEvent) {
      return;
    }

    if (isJoinOrAlive) {
      const peerChannelId = PeerChannel.getChannelId(this.peer.id, event.peerId, this.room);
      if (!this.peerChannels.has(peerChannelId)) {
        const peerChannel = new PeerChannel({
          room: this.room,
          peer: this.peer,
          otherPeerId: event.peerId,
        });

        this.peerChannels.set(peerChannelId, peerChannel);
      }

      const peerChannel = this.peerChannels.get(peerChannelId);
      peerChannel.startPeerSignalLoop();

      // this.presenceHandlers.forEach((handler) => {
      //   handler(event);
      // });
    }
  }

  onPresenceChange(handler: RoomPresenceHandler) {
    this.presenceHandlers.add(handler);
    return {
      dispose: () => {
        this.presenceHandlers.delete(handler);
      }
    }
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
   * Join the room
   */
  join() {
    this.startPeerSignalLoop();
    return;
  }

  /**
   * Leave the room
   */
  leave() {
    this.stopPeerSignalLoop();
  }
}