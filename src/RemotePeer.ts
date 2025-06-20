import { SignalingEvent } from './adapters/_base';
import { PeerRoom } from './RoomConnection';
import { Room } from './Room';
import { wait } from './utils/wait';
import * as superJSON from 'superjson'
import { EventEmitter } from './utils/EventEmitter';

export type ChannelMessageHandler<Msg> = (message: { fromPeer: RemotePeer, message: Msg }) => void;

interface RemotePeerConfig {
  peerRoom: PeerRoom
  localPeerId: string;
  otherPeerId: string;
}

type DataChannelEventHandler = Exclude<Parameters<RTCDataChannel['addEventListener']>[1], EventListenerObject>
type PeerConnectionEventHandler = Exclude<Parameters<RTCPeerConnection['addEventListener']>[1], EventListenerObject>

interface RemotePeerEvents {
  dataChannel: {
    dataChannel: RTCDataChannel;
    event: Parameters<DataChannelEventHandler>[0];
  };
  peerConnection: {
    peerConnection: RTCPeerConnection;
    event: Parameters<PeerConnectionEventHandler>[0];
  };
}

/**
 * RemotePeer provides channel-specific operations for a peer
 * Created via peer.via(channel)
 */
export class RemotePeer<MessageType = any> {
  __type!: MessageType;
  private peerRoom: RemotePeerConfig['peerRoom'];
  private localPeerId: RemotePeerConfig['localPeerId'];
  private otherPeerId: RemotePeerConfig['otherPeerId'];

  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private signalingEvents: SignalingEvent[] = [];

  private eventEmitter = new EventEmitter<RemotePeerEvents>();
  get on() { return this.eventEmitter.on.bind(this.eventEmitter); }
  get emit() { return this.eventEmitter.emit.bind(this.eventEmitter); }

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

  constructor(config: RemotePeerConfig) {
    this.localPeerId = config.localPeerId;
    this.otherPeerId = config.otherPeerId;
    this.peerRoom = config.peerRoom;

    this.getChannelPeerConnection();
  }

  /**
   * Get the ID of the other peer
   */
  get id(): string {
    return this.otherPeerId;
  }

  get room(): Room {
    return this.peerRoom.room;
  }

  /**
   * Get the channel ID
   */
  get channelId(): string {
    return RemotePeer.getChannelId(this.localPeerId, this.otherPeerId, this.room.id);
  }


  /**
 * Join the room
 */
  connect() {
    this.startPeerSignalLoop();
    return;
  }

  /**
   * Leave the room
   */
  disconnect() {
    this.stopPeerSignalLoop();
    this.peerConnection?.close();
    this.dataChannel?.close();
    this.peerConnectionAbortController.abort();
    this.dataChannelAbortController.abort();
    this.peerConnection = null;
    this.dataChannel = null;
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
    this.setupPeerConnection(this.peerConnection);
    return this.peerConnection;
  }

  sendMessage(message: MessageType) {
    const serialized = superJSON.stringify(message);
    if (!this.dataChannel) {
      throw new Error('Data channel not ready!');
    }

    this.dataChannel.send(serialized);
  }

  /**
   * Check if the data channel is active and ready for communication
   */
  isDataChannelActive(): boolean {
    return this.dataChannel !== null && this.dataChannel.readyState === 'open';
  }

  /**
   * Wait for the data channel to be ready
   * Resolves immediately if the data channel is already open
   */
  waitForReady(): Promise<void> {
    // If already ready, resolve immediately
    if (this.isDataChannelActive()) {
      return Promise.resolve();
    }

    // Wait for the data channel to open
    return new Promise<void>((resolve) => {
      const onDataChannel = this.eventEmitter.on('dataChannel', ({ dataChannel }) => {
        const isOpen = dataChannel.readyState === 'open';
        if (isOpen) {
          resolve();
          onDataChannel.dispose();
        }
      });
    });
  }

  peerSingalLoop = RemotePeer.createPeerSignalLoop();

  isInitiator(): boolean {
    const sortedPeerIds = [this.localPeerId, this.otherPeerId].sort((a, b) => a.localeCompare(b));
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
        const events = await this.room.signalingAdapter.pull({
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

  dataChannelAbortController = new AbortController();
  setupDataChannel(dataChannel: RTCDataChannel) {
    const eventListenerConfig = {
      signal: this.dataChannelAbortController.signal,
    }

    dataChannel.addEventListener('message', (event) => {
      // console.log(this.localPeerId, 'dataChannel.onmessage', event);
      this.peerRoom.emitMessage(this.id, event.data);
    }, eventListenerConfig);

    dataChannel.addEventListener('open', (event) => {
      // console.log(this.localPeerId, 'dataChannel.onopen', event);
    }, eventListenerConfig);

    dataChannel.addEventListener('close', (event) => {
      // console.log(this.localPeerId, 'dataChannel.onclose', event);
    }, eventListenerConfig);

    dataChannel.addEventListener('error', (event) => {
      // console.log(this.localPeerId, 'dataChannel.onerror', event);
    }, eventListenerConfig);

    dataChannel.addEventListener('closing', (event) => {
      // console.log(this.localPeerId, 'dataChannel.onclosing', event);
    }, eventListenerConfig);

    dataChannel.addEventListener('bufferedamountlow', (event) => {
      // console.log(this.localPeerId, 'dataChannel.onbufferedamountlow', event);
    }, eventListenerConfig);
  }

  peerConnectionAbortController = new AbortController();
  setupPeerConnection(peerConnection: RTCPeerConnection) {
    const eventListenerConfig = {
      signal: this.peerConnectionAbortController.signal,
    };

    peerConnection.addEventListener('connectionstatechange', (event) => {
      // console.log(this.localPeerId, '/', this.otherPeerId, 'onconnectionstatechange', this.peerConnection?.connectionState);
    }, eventListenerConfig);


    peerConnection.addEventListener('datachannel', (event) => {
      // console.log(this.localPeerId, 'ondatachannel', this.otherPeerId);
      this.dataChannel = event.channel;
      this.setupDataChannel(this.dataChannel);
    }, eventListenerConfig);

    peerConnection.addEventListener('icecandidate', (event) => {
      // console.log(this.localPeerId, 'onicecandidate', this.otherPeerId);
      if (!event.candidate) return;

      this.room.signalingAdapter.push({
        peerId: this.localPeerId,
        channelId: this.channelId,
        type: 'iceCandidate',
        data: event.candidate,
      });
    }, eventListenerConfig);

    peerConnection.addEventListener('icecandidateerror', (event) => {
      // console.log(this.localPeerId, 'onicecandidateerror', this.otherPeerId);
    }, eventListenerConfig)

    peerConnection.addEventListener('iceconnectionstatechange', (event) => {
      // console.log(this.localPeerId, 'oniceconnectionstatechange', this.otherPeerId);
    }, eventListenerConfig);

    peerConnection.addEventListener('icegatheringstatechange', (event) => {
      // console.log(this.localPeerId, 'onicegatheringstatechange', this.otherPeerId);
    }, eventListenerConfig);

    peerConnection.addEventListener('negotiationneeded', (event) => {
      // console.log(this.localPeerId, 'onnegotiationneeded', this.otherPeerId);
    }, eventListenerConfig);

    peerConnection.addEventListener('signalingstatechange', (event) => {
      // console.log(this.localPeerId, 'onsignalingstatechange', this.otherPeerId);
    }, eventListenerConfig);

    peerConnection.addEventListener('track', (event) => {
      // console.log(this.localPeerId, 'ontrack', this.otherPeerId);
    }, eventListenerConfig);


  }

  async processSignalingEvent(event: SignalingEvent) {
    const isOwnEvent = event.peerId === this.localPeerId;
    if (isOwnEvent) return;

    if (event.type === 'iceCandidate') return this.handleIceCandidate(event.data);
    if (event.type === 'sdpOffer') return this.handleSdpOffer(event.data);
    if (event.type === 'sdpAnswer') return this.handleSdpAnswer(event.data);
  }

  async sendSdpOffer() {
    // console.log(this.localPeerId, 'sendSdpOffer', this.otherPeerId);
    const peerConnection = this.getChannelPeerConnection();
    this.dataChannel = peerConnection.createDataChannel('default');
    this.setupDataChannel(this.dataChannel);

    const offer = await peerConnection.createOffer({});
    peerConnection.setLocalDescription(offer);

    this.room.signalingAdapter.push({
      peerId: this.localPeerId,
      channelId: this.channelId,
      type: 'sdpOffer',
      data: offer,
    })
  }

  async handleIceCandidate(iceCandidate: RTCIceCandidateInit) {
    // console.log(this.localPeerId, 'handle iceCandidate', this.otherPeerId);
    const peerConnection = this.getChannelPeerConnection();

    if (iceCandidate) {
      peerConnection.addIceCandidate(iceCandidate);
    }

    // console.log(this.localPeerId, 'handle iceCandidate done');
  }

  async handleSdpOffer(sdpOffer: RTCSessionDescriptionInit) {
    // console.log(this.localPeerId, 'handle sdpOffer', this.otherPeerId);
    const peerConnection = this.getChannelPeerConnection();
    peerConnection.setRemoteDescription(sdpOffer);

    const answer = await peerConnection.createAnswer({});
    peerConnection.setLocalDescription(answer);

    this.room.signalingAdapter.push({
      peerId: this.localPeerId,
      channelId: this.channelId,
      type: 'sdpAnswer',
      data: answer,
    });

    // console.log(this.localPeerId, 'handle sdpOffer done');
  }

  async handleSdpAnswer(sdpAnswer: RTCSessionDescriptionInit) {
    // console.log(this.localPeerId, 'handle sdpAnswer', this.otherPeerId);
    const peerConnection = this.getChannelPeerConnection();
    peerConnection.setRemoteDescription(sdpAnswer);
    // console.log(this.localPeerId, 'handle sdpAnswer done');
  }

}