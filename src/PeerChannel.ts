import { SignalingEvent } from './adapters/RedisSignalingAdapter';
import { Peer } from './Peer';
import { Room } from './Room';
import { wait } from './utils/wait';

export type ChannelMessageHandler = (message: string, fromPeerId: string) => void;

/**
 * PeerChannel provides channel-specific operations for a peer
 * Created via peer.via(channel)
 */
export class PeerChannel<MessageType = any> {
  __type!: MessageType;
  private peer: Peer;
  private room: Room;
  private otherPeerId: string;
  private messageHandlers: Set<ChannelMessageHandler> = new Set();

  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private signalingEvents: SignalingEvent[] = [];

  static getChannelId(peerId1: string, peerId2: string, room: Room) {
    const sortedPeerIds = [peerId1, peerId2].sort();
    return `${room.id}:${sortedPeerIds[0]}-${sortedPeerIds[1]}`;
  }

  constructor(config: { room: Room, peer: Peer, otherPeerId: string }) {
    this.peer = config.peer;
    this.otherPeerId = config.otherPeerId;
    this.room = config.room;
  }

  /**
   * Get the channel ID
   */
  get id(): string {
    return PeerChannel.getChannelId(this.peer.id, this.otherPeerId, this.room);
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

  static createPeerSignalLoop() {
    return {
      started: false,
      abortController: new AbortController(),
      offerSignalCount: 0,
      pullOffsetIndex: 0,
    };
  }

  getChannelPeerConnection() {
    if (this.peerConnection) return this.peerConnection;

    const rtcConfiguration = this.room.signalingAdapter.getRtcConfiguration()
    this.peerConnection = new RTCPeerConnection(rtcConfiguration);

    this.peerConnection.onicecandidate = (event) => {
      this.room.signalingAdapter.push({
        peerId: this.peer.id,
        channelId: this.id,
        type: 'iceCandidate',
        data: event.candidate,
      });
    }


    return this.peerConnection;
  }


  peerSingalLoop = PeerChannel.createPeerSignalLoop();

  isInitiator() {

  }

  startPeerSignalLoop() {
    if (this.peerSingalLoop.started) {
      return;
    }

    this.peerSingalLoop = PeerChannel.createPeerSignalLoop();
    this.peerSingalLoop.started = true;
    const abortSignal = this.peerSingalLoop.abortController.signal;

    // Keep sending join/alive signals
    Promise.resolve().then(async () => {

      if (this.peer.id === 'Alice') {
        this.sendSdpOffer();
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
          channelId: this.id,
          offsetIndex: this.peerSingalLoop.pullOffsetIndex,
        });

        for (const event of events) {
          this.signalingEvents.push(event);
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

  setupDataChannel(dataChannel: RTCDataChannel) {
    this.dataChannel = dataChannel;

    dataChannel.onmessage = (event) => {
      console.log(this.peer.id, 'dataChannel.onmessage', event);
    }
    dataChannel.onopen = () => {
      console.log(this.peer.id, 'dataChannel.onopen');
    }
    dataChannel.onclose = () => {
      console.log(this.peer.id, 'dataChannel.onclose');
    }
  }

  async processSignalingEvent(event: SignalingEvent) {
    const isOwnEvent = event.peerId === this.peer.id;
    if (isOwnEvent) return;

    if (event.type === 'iceCandidate') return this.handleIceCandidate(event.data);
    if (event.type === 'sdpOffer') return this.handleSdpOffer(event.data);
    if (event.type === 'sdpAnswer') return this.handleSdpAnswer(event.data);
  }

  async sendSdpOffer() {
    console.log(this.peer.id, 'sendSdpOffer');
    const peerConnection = this.getChannelPeerConnection();
    const datachannel = peerConnection.createDataChannel('default');
    this.setupDataChannel(datachannel);

    const offer = await peerConnection.createOffer({});
    peerConnection.setLocalDescription(offer);

    this.room.signalingAdapter.push({
      peerId: this.peer.id,
      channelId: this.id,
      type: 'sdpOffer',
      data: offer,
    })
  }

  async handleIceCandidate(iceCandidate: RTCIceCandidateInit) {
    console.log(this.peer.id, 'handle iceCandidate', typeof iceCandidate, !!iceCandidate);
    const peerConnection = this.getChannelPeerConnection();

    if (iceCandidate) {
      peerConnection.addIceCandidate(iceCandidate);
    }

    console.log(this.peer.id, 'handle iceCandidate done');
  }

  async handleSdpOffer(sdpOffer: RTCSessionDescriptionInit) {
    console.log(this.peer.id, 'handle sdpOffer');
    const peerConnection = this.getChannelPeerConnection();
    peerConnection.setRemoteDescription(sdpOffer);

    const answer = await peerConnection.createAnswer({});
    peerConnection.setLocalDescription(answer);

    peerConnection.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    }

    this.room.signalingAdapter.push({
      peerId: this.peer.id,
      channelId: this.id,
      type: 'sdpAnswer',
      data: answer,
    });

    console.log(this.peer.id, 'handle sdpOffer done');
  }

  async handleSdpAnswer(sdpAnswer: RTCSessionDescriptionInit) {
    console.log(this.peer.id, 'handle sdpAnswer');
    const peerConnection = this.getChannelPeerConnection();
    peerConnection.setRemoteDescription(sdpAnswer);
    console.log(this.peer.id, 'handle sdpAnswer done');
  }

}