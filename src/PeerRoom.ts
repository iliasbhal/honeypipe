import { Peer } from './Peer';
import { Room } from './Room';
import { SignalingEvent } from './adapters/RedisSignalingAdapter';
import { RemotePeer } from './RemotePeer';
import { wait } from './utils/wait';
import SuperJSON from 'superjson';

export type RoomMessageHandler = (message: { from: RemotePeer, content: string }) => void;
export type RoomPresenceHandler = (remotePeer: RemotePeer) => void;

/**
 * PeerRoom provides room-specific operations for a peer
 * Created via peer.via(room)
 */
export class PeerRoom<MessageType = any> {
  peer: Peer;
  room: Room;
  private remotePeers = new Map<string, RemotePeer>();

  constructor(peer: Peer, room: Room) {
    this.peer = peer;
    this.room = room;
  }

  getPeers(): RemotePeer[] {
    return Array.from(this.remotePeers.values());
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
        }

        this.peerSingalLoop.pullOffsetIndex += events.length;
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
    if (this.peer.id === 'Alice') {
      console.log('processSignalingEvent', event);
    }
    const peer = this.getPeer(event.peerId, { createIfNotExists: true });
    const isJoinOrAlive = event.type === 'join' || event.type === 'alive';
    const isLeave = event.type === 'leave';

    const isPresenceEvent = isLeave || isJoinOrAlive;
    if (!isPresenceEvent) {
      return;
    }

    if (!event.peerId) {
      console.log('event.peerId', event);
    }
    if (peer instanceof RemotePeer) {
      if (isJoinOrAlive) peer.startPeerSignalLoop();
    }

    this.room.emit('presence', {
      peer: peer,
      type: event.type
    });
  }

  getPeer(peerId: string, config?: { createIfNotExists: boolean }): RemotePeer | Peer | undefined {
    if (peerId === this.peer.id) {
      console.log('getPeer', peerId, this.peer.id, !!this.peer);
      return this.peer;
    }

    const remotePeerId = RemotePeer.getChannelId(this.peer.id, peerId, this.room.id);
    if (!this.remotePeers.has(remotePeerId)) {
      if (!config?.createIfNotExists) {
        return undefined;
      }

      const remotePeer = new RemotePeer({
        peerRoom: this,
        localPeerId: this.peer.id,
        otherPeerId: peerId,
      });

      this.remotePeers.set(remotePeerId, remotePeer);
    }

    const remotePeer = this.remotePeers.get(remotePeerId);
    console.log('getPeer 2', peerId, this.peer.id, !!remotePeer);
    return remotePeer;
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
    return this;
  }

  /**
   * Leave the room
   */
  leave() {
    this.stopPeerSignalLoop();
    this.remotePeers.forEach(remotePeer => {
      remotePeer.leave();
    });

    this.remotePeers.clear();

    this.room.signalingAdapter.push({
      roomId: this.room.id,
      peerId: this.peer.id,
      type: 'leave',
    });

    this.room.emit('presence', {
      peer: this.peer,
      type: 'leave',
    });
  }

  sendMessage(message: MessageType) {
    this.getPeers().forEach(remotePeer => {
      remotePeer.sendMessage(message);
    });

    const serialized = SuperJSON.stringify(message);
    this.emitMessage(this.peer.id, serialized);
  }

  emitMessage(peerId: string, rawMessage: string) {

    console.log('--------------------------------');
    const peer = this.getPeer(peerId)

    console.log('emitMessage', !!peer, peerId, rawMessage);
    const message = SuperJSON.parse(rawMessage) as MessageType;
    this.room.emit('message', {
      peer: peer,
      message,
    });
  }
}