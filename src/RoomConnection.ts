import superJSON from 'superjson';
import { Peer } from './Peer';
import { Room } from './Room';
import { RemotePeer } from './RemotePeer';
import { SignalingEvent } from './adapters/_base';
import { wait } from './utils/wait';

export type RoomMessageHandler = (message: { from: RemotePeer, content: string }) => void;
export type RoomPresenceHandler = (remotePeer: RemotePeer) => void;

/**
 * PeerRoom provides room-specific operations for a peer
 * Created via peer.via(room)
 */
export class RoomConnection<MessageType = any> {
  peer: Peer;
  room: Room;
  private remotePeers = new Map<string, RemotePeer>();
  private stateByPeer = new Map<Peer | RemotePeer, SignalingEvent['type']>();

  get joined() {
    const state = this.stateByPeer.get(this.peer);
    return state === 'join' || state === 'alive';
  }

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


  peerSingalLoop = RoomConnection.createPeerSignalLoop()

  private startPeerSignalLoop() {
    if (this.peerSingalLoop.started) {
      return;
    }

    this.peerSingalLoop = RoomConnection.createPeerSignalLoop();
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
    const peer = this.getPeer(event.peerId, {
      createIfNotExists: true,
      connectOnCreate: false,
    });

    const isRemotePeer = peer instanceof RemotePeer;
    const isJoinEvent = event.type === 'join';
    const isLeaveEvent = event.type === 'leave';

    if (isRemotePeer) {
      if (isLeaveEvent) {
        peer.disconnect();
      }

      if (isJoinEvent) {
        peer.connect();
      }
    }

    this.stateByPeer.set(peer, event.type);
    this.room.emit('presence', {
      peer: peer,
      type: event.type
    });
  }

  getPeer(peerId: string, config?: { createIfNotExists: boolean, connectOnCreate: boolean }): RemotePeer | Peer | undefined {
    if (peerId === this.peer.id) {
      return this.peer;
    }

    const remotePeerId = RemotePeer.getChannelId(this.peer.id, peerId, this.room.id);
    if (!this.remotePeers.has(remotePeerId)) {
      if (!config?.createIfNotExists) {
        return undefined;
      }

      const remotePeer = new RemotePeer({
        roomConnection: this,
        localPeerId: this.peer.id,
        otherPeerId: peerId,
      });

      if (config?.connectOnCreate) {
        remotePeer.connect();
      }

      this.remotePeers.set(remotePeerId, remotePeer);
    }

    const remotePeer = this.remotePeers.get(remotePeerId);
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
    return this.waitForJoin();
  }

  /**
   * Leave the room
   */
  leave() {
    this.stopPeerSignalLoop();
    this.remotePeers.forEach(remotePeer => {
      remotePeer.disconnect();
    });

    this.remotePeers.clear();
    this.stateByPeer.clear();

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
    console.log('sendMessage', message, this.getPeers().length);
    this.getPeers().forEach(remotePeer => {
      remotePeer.sendMessage(message);
    });

    const serialized = superJSON.stringify(message);
    this.emitMessage(this.peer.id, serialized);
  }

  emitMessage(peerId: string, rawMessage: string) {
    const peer = this.getPeer(peerId)

    const message = superJSON.parse(rawMessage) as MessageType;
    this.room.emit('message', {
      peer: peer,
      message,
    });
  }

  /**
   * Wait for the local peer to join the room
   * @returns Promise that resolves when the local peer joins the room
   */
  async waitForJoin(): Promise<void> {

    const abortController = new AbortController();
    return new Promise<void>((_resolve, _reject) => {
      const resolve = () => {
        abortController.abort();
        _resolve();
      }
      const reject = () => {
        abortController.abort();
        _reject();
      }

      if (this.joined) {
        resolve();
        return;
      }

      this.room.on('presence', (event) => {
        const isLocalPeer = event.peer.id === this.peer.id;
        if (!isLocalPeer) return;

        if (event.type === 'join') resolve();
        if (event.type === 'alive') resolve();
        if (event.type === 'leave') reject();
      }, {
        signal: abortController.signal,
      })
    });
  }

  /**
   * Wait for at least one peer to have an active data channel
   * Resolves immediately if there's already an active data channel
   */
  async waitForOtherPeers(): Promise<void> {
    return new Promise((_resolve) => {
      const abortController = new AbortController();

      const waitForPeerReady = async (peer: RemotePeer) => {
        await peer.waitForConnectionReady();
        abortController.abort();
        _resolve()
      }

      const existingPeers = Array.from(this.remotePeers.values());
      existingPeers.forEach(waitForPeerReady);

      this.room.on('presence', async (event) => {
        const isRemotePeerJoin = event.type === 'join' && event.peer instanceof RemotePeer;
        if (!isRemotePeerJoin) return;

        waitForPeerReady(event.peer)
      }, { signal: abortController.signal });
    });
  }
}