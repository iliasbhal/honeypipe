import { SignalingEvent } from './adapters/RedisSignalingAdapter';
import { Peer } from './Peer';
import { PeerRoom } from './PeerRoom';
import { Room } from './Room';
import { wait } from './utils/wait';

export type ChannelMessageHandler = (message: { from: RemotePeer, content: string }) => void;

/**
 * RemotePeer provides channel-specific operations for a peer
 * Created via peer.via(channel)
 */
export class RemotePeer<MessageType = any> {
  __type!: MessageType;
  private peerRoom: PeerRoom;
  private localPeerId: string;
  private otherPeerId: string;
  private messageHandlers: Set<ChannelMessageHandler> = new Set();

  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private signalingEvents: SignalingEvent[] = [];

  static getChannelId(peerId1: string, peerId2: string, roomId: string) {
    if (peerId1 === peerId2) {
      throw new Error('peerId1 and peerId2 cannot be the same');
    }

    if (!peerId1 || !peerId2) {
      throw new Error('peerId1 and peerId2 cannot be empty');
    }

    const sortedPeerIds = [peerId1, peerId2].sort((a, b) => a.localeCompare(b));
    return `${roomId}:${sortedPeerIds[0]}-${sortedPeerIds[1]}`;
  }

  constructor(config: { peerRoom: PeerRoom, localPeerId: string, otherPeerId: string }) {
    this.localPeerId = config.localPeerId;
    this.otherPeerId = config.otherPeerId;
    this.peerRoom = config.peerRoom;
  }

  /**
   * Get the ID of the other peer
   */
  get id(): string {
    return this.otherPeerId;
  }

  /**
   * Get the channel ID
   */
  get channelId(): string {
    const room = this.peerRoom.getRoom();
    return RemotePeer.getChannelId(this.localPeerId, this.otherPeerId, room.id);
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

    const room = this.peerRoom.getRoom();

    const rtcConfiguration = room.signalingAdapter.getRtcConfiguration()
    this.peerConnection = new RTCPeerConnection(rtcConfiguration);

    this.peerConnection.onicecandidate = (event) => {
      room.signalingAdapter.push({
        peerId: this.localPeerId,
        channelId: this.channelId,
        type: 'iceCandidate',
        data: event.candidate,
      });
    }


    return this.peerConnection;
  }

  sendMessage(message: string) {
    this.dataChannel?.send(message);
  }

  peerSingalLoop = RemotePeer.createPeerSignalLoop();

  isInitiator(): boolean {
    const sortedPeerIds = [this.localPeerId, this.otherPeerId].sort((a, b) => a.localeCompare(b));
    console.log('sortedPeerIds', sortedPeerIds);
    return sortedPeerIds[0] === this.localPeerId;
  }

  startPeerSignalLoop() {
    if (this.peerSingalLoop.started) {
      return;
    }

    this.peerSingalLoop = RemotePeer.createPeerSignalLoop();
    this.peerSingalLoop.started = true;
    const abortSignal = this.peerSingalLoop.abortController.signal;

    // Keep sending join/alive signals
    Promise.resolve().then(async () => {
      const isInitiator = this.isInitiator();
      if (!isInitiator) return;

      console.log('isInitiator', this.localPeerId, isInitiator);
      this.sendSdpOffer();
    })

    // Keep pulling events from the room
    // To ensure we know who is in the room
    // In order to create direct webRTC connections
    // with each member of the room
    Promise.resolve().then(async () => {
      let waitTime = 100; // Start with 100ms wait
      const maxWaitTime = 5000; // Cap at 5 seconds

      while (!abortSignal.aborted) {
        const room = this.peerRoom.getRoom();
        const events = await room.signalingAdapter.pull({
          channelId: this.channelId,
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
      const message = {
        from: this,
        content: event.data,
      };

      this.peerRoom.handleMessage(message);
      this.messageHandlers.forEach(handler => {
        handler({
          from: this,
          content: event.data,
        });
      });
      console.log(this.localPeerId, 'dataChannel.onmessage', event);
    }
    dataChannel.onopen = () => {
      console.log(this.localPeerId, 'dataChannel.onopen');
    }
    dataChannel.onclose = () => {
      console.log(this.localPeerId, 'dataChannel.onclose');
    }
  }

  async processSignalingEvent(event: SignalingEvent) {
    console.log(this.localPeerId, 'processSignalingEvent', event);
    const isOwnEvent = event.peerId === this.localPeerId;
    if (isOwnEvent) return;

    if (event.type === 'iceCandidate') return this.handleIceCandidate(event.data);
    if (event.type === 'sdpOffer') return this.handleSdpOffer(event.data);
    if (event.type === 'sdpAnswer') return this.handleSdpAnswer(event.data);
  }

  async sendSdpOffer() {
    console.log(this.localPeerId, 'sendSdpOffer');
    const peerConnection = this.getChannelPeerConnection();
    const datachannel = peerConnection.createDataChannel('default');
    this.setupDataChannel(datachannel);

    const offer = await peerConnection.createOffer({});
    peerConnection.setLocalDescription(offer);

    const room = this.peerRoom.getRoom();
    room.signalingAdapter.push({
      peerId: this.localPeerId,
      channelId: this.channelId,
      type: 'sdpOffer',
      data: offer,
    })
  }

  async handleIceCandidate(iceCandidate: RTCIceCandidateInit) {
    console.log(this.localPeerId, 'handle iceCandidate', typeof iceCandidate, !!iceCandidate);
    const peerConnection = this.getChannelPeerConnection();

    if (iceCandidate) {
      peerConnection.addIceCandidate(iceCandidate);
    }

    console.log(this.localPeerId, 'handle iceCandidate done');
  }

  async handleSdpOffer(sdpOffer: RTCSessionDescriptionInit) {
    console.log(this.localPeerId, 'handle sdpOffer');
    const peerConnection = this.getChannelPeerConnection();
    peerConnection.setRemoteDescription(sdpOffer);

    const answer = await peerConnection.createAnswer({});
    peerConnection.setLocalDescription(answer);

    peerConnection.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    }

    const room = this.peerRoom.getRoom();
    room.signalingAdapter.push({
      peerId: this.localPeerId,
      channelId: this.channelId,
      type: 'sdpAnswer',
      data: answer,
    });

    console.log(this.localPeerId, 'handle sdpOffer done');
  }

  async handleSdpAnswer(sdpAnswer: RTCSessionDescriptionInit) {
    console.log(this.localPeerId, 'handle sdpAnswer');
    const peerConnection = this.getChannelPeerConnection();
    peerConnection.setRemoteDescription(sdpAnswer);
    console.log(this.localPeerId, 'handle sdpAnswer done');
  }

}