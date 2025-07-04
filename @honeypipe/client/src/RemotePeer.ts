import { SignalingEvent } from './SignalingAdapter';
import { RoomConnection } from './RoomConnection';
import { Room } from './Room';
import { wait } from './utils/wait';
import * as superJSON from 'superjson'
import { EventEmitter } from './utils/EventEmitter';
import { DEFAULT_RTC_CONFIGURATION } from './config';
import { uuid } from './utils/uuid';

/**
 * RemotePeer provides channel-specific operations for a peer
 * Created via peer.via(channel)
 */
export class RemotePeer<MessageType = any> extends EventEmitter<RemotePeerEvents> {
  __type!: MessageType;
  private roomConnection: RemotePeerConfig['roomConnection'];
  private localPeerId: RemotePeerConfig['localPeerId'];
  private otherPeerId: RemotePeerConfig['otherPeerId'];

  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;

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
    super();

    this.localPeerId = config.localPeerId;
    this.otherPeerId = config.otherPeerId;
    this.roomConnection = config.roomConnection;

    this.getChannelPeerConnection();
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers using the event emitter pattern
   */
  private setupEventHandlers() {
    // Peer connection event handlers
    this.on('peerConnection', ({ type, event, peerConnection }) => {
      // console.log('peerConnection', type, this.localPeerId, '->', this.otherPeerId);
      switch (type) {
        case 'connectionstatechange':

          break;
        case 'datachannel':
          this.dataChannel = event.channel;
          this.setupDataChannel(this.dataChannel);
          break;
        case 'icecandidate':
          if (!event.candidate) return;
          this.sendSignal({
            id: uuid(),
            peerId: this.localPeerId,
            channelId: this.channelId,
            type: 'iceCandidate',
            data: event.candidate,
          });
          break;
        case 'icecandidateerror':
          break;
        case 'iceconnectionstatechange':

          break;
        case 'icegatheringstatechange':
          break;
        case 'negotiationneeded':
          break;
        case 'signalingstatechange':
          break;
        case 'track':
          break;
      }
    });

    // Data channel event handlers
    this.on('dataChannel', ({ type, event }) => {
      // console.log('dataChannel', type, this.localPeerId, '->', this.otherPeerId);
      switch (type) {
        case 'message':
          this.roomConnection.emitMessage(this.id, event.data);
          break;
        case 'open':
          break;
        case 'close':
          break;
        case 'error':
          break;
        case 'closing':
          break;
        case 'bufferedamountlow':
          break;
      }
    });
  }

  /**
   * Get the ID of the other peer
   */
  get id(): string {
    return this.otherPeerId;
  }

  get room(): Room {
    return this.roomConnection.room;
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
  connectionInitialized = false;
  connect() {
    if (this.connectionInitialized) return;

    this.listenToPeerSignals();

    const isInitiator = this.isInitiator();
    if (isInitiator) {
      this.sendSdpOffer();
    }

    this.connectionInitialized = true;
  }

  ensureConnected() {
    return this.connect();
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
      lastEventId: null,
    };
  }

  getChannelPeerConnection() {
    if (this.peerConnection) return this.peerConnection;

    const rtcConfiguration = this.room.config.rtcConfiguration || DEFAULT_RTC_CONFIGURATION;
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
    this.roomConnection.emitMessage(this.id, serialized);
  }

  /**
   * Check if the data channel is active and ready for communication
   */
  isDataChannelActive(): boolean {
    return this.dataChannel !== null && this.dataChannel.readyState === 'open';
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  async reconnect() {
    // console.log('reconnect', this.localPeerId, '->', this.otherPeerId);
    const abortController = new AbortController();
    const reconnect = {
      abortSignal: abortController.signal,
      attempts: 0,
    };

    return new Promise(async (resolve) => {
      while (!reconnect.abortSignal.aborted) {
        if (reconnect.attempts > 5) {
          break;
        }

        const delay = Math.min(10 * Math.pow(2, reconnect.attempts++), 3000);
        await wait(delay);
        this.disconnect();
        this.sendSdpRestart();
        this.connect();
      }
    });
  }

  /**
   * Wait for the data channel to be ready
   * Resolves immediately if the data channel is already open
   */
  waitForConnectionReady(): Promise<void> {
    // If already ready, resolve immediately
    if (this.isDataChannelActive()) {
      return Promise.resolve();
    }

    // Wait for the data channel to open
    return new Promise<void>((resolve) => {
      const onDataChannel = this.on('dataChannel', ({ dataChannel }) => {
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


  listenToPeerSignals() {
    // console.log('Pulling signals', this.localPeerId, '->', this.otherPeerId);
    if (this.peerSingalLoop.started) {
      return;
    }

    this.peerSingalLoop = RemotePeer.createPeerSignalLoop();
    this.peerSingalLoop.started = true;
    const abortSignal = this.peerSingalLoop.abortController.signal;

    // Keep pulling events from the room
    // To ensure we know who is in the room
    // In order to create direct webRTC connections
    // with each member of the room
    Promise.resolve().then(async () => {
      let waitTime = 100; // Start with 100ms wait
      const maxWaitTime = 5000; // Cap at 5 seconds

      while (!abortSignal.aborted) {

        const lastEventId = this.peerSingalLoop.lastEventId;
        const events = await this.room.config.adapter.pull({
          channelId: this.channelId,
          after: lastEventId,
        });

        // console.log('pulling events (channel)', this.localPeerId, '->', this.otherPeerId, events);
        for (const event of events) {
          this.processSignalingEvent(event);
          this.peerSingalLoop.lastEventId = event.id;
        }

        const hasEvents = events.length > 0;
        waitTime = hasEvents ? 100 : Math.min(waitTime * 2, maxWaitTime);
        await wait(waitTime);
      }
    })

    // setInterval(() => {
    //   if (!this.isInitiator()) {
    //     return;
    //   }

    //   console.log('INTERVAL', {
    //     dataChannel: {
    //       readyState: this.dataChannel?.readyState,
    //     },
    //     peerConnection: {
    //       iceConnectionState: this.peerConnection?.iceConnectionState,
    //       iceGatheringState: this.peerConnection?.iceGatheringState,
    //       signalingState: this.peerConnection?.signalingState,
    //       connectionState: this.peerConnection?.connectionState,
    //     },
    //   });
    // }, 1000);
  }

  private stopPeerSignalLoop() {
    this.peerSingalLoop.abortController.abort();
    this.peerSingalLoop.started = false;
  }

  dataChannelAbortController = new AbortController();
  setupDataChannel(dataChannel: RTCDataChannel) {
    dataChannelEventsTypes.forEach(eventType => {
      dataChannel.addEventListener(eventType, (event) => {
        // @ts-expect-error
        this.emit('dataChannel', {
          dataChannel,
          type: eventType,
          event,
        });
      }, {
        signal: this.dataChannelAbortController.signal,
      });
    });
  }

  peerConnectionAbortController = new AbortController();
  setupPeerConnection(peerConnection: RTCPeerConnection) {
    peerConnectionEventsTypes.forEach(eventType => {
      peerConnection.addEventListener(eventType, (event) => {
        // @ts-expect-error
        this.emit('peerConnection', {
          peerConnection,
          type: eventType,
          event
        });
      }, {
        signal: this.peerConnectionAbortController.signal,
      });
    });
  }

  async processSignalingEvent(event: SignalingEvent) {

    const isOwnEvent = event.peerId === this.localPeerId;
    if (isOwnEvent) return;

    // Show all received signals in the timeline
    if (event.type === 'iceCandidate') return this.handleIceCandidate(event.data);
    if (event.type === 'sdpOffer') return this.handleSdpOffer(event.data);
    if (event.type === 'sdpAnswer') return this.handleSdpAnswer(event.data);
    if (event.type === 'sdpRestart') return this.reconnect();

    this.emit('receivedSignal', event);
  }

  async sendSdpOffer() {
    const peerConnection = this.getChannelPeerConnection();
    this.dataChannel = peerConnection.createDataChannel('default');
    this.setupDataChannel(this.dataChannel);

    const offer = await peerConnection.createOffer({});
    peerConnection.setLocalDescription(offer);

    this.sendSignal({
      id: uuid(),
      peerId: this.localPeerId,
      channelId: this.channelId,
      type: 'sdpOffer',
      data: offer,
    });
  }

  async sendSdpRestart() {
    this.sendSignal({
      id: uuid(),
      peerId: this.localPeerId,
      channelId: this.channelId,
      type: 'sdpRestart'
    })
  }

  sendSignal(signalEvent: SignalingEvent) {
    this.emit('sentSignal', signalEvent);
    this.room.config.adapter.push(signalEvent)
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
    await peerConnection.setRemoteDescription(sdpOffer);

    const answer = await peerConnection.createAnswer({});
    await peerConnection.setLocalDescription(answer);

    this.sendSignal({
      id: uuid(),
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


    // If the peer connection is new, we need to re-send an offer
    const isNewConnection = this.peerConnection?.connectionState === 'new';
    if (isNewConnection) {
      this.sendSdpOffer();
    };

    // console.log(this.localPeerId, 'handle sdpAnswer done');
  }

}




export type ChannelMessageHandler<Msg> = (message: { fromPeer: RemotePeer, message: Msg }) => void;

interface RemotePeerConfig {
  roomConnection: RoomConnection
  localPeerId: string;
  otherPeerId: string;
}

const dataChannelEventsTypes = [
  'message',
  'open',
  'close',
  'error',
  'closing',
  'bufferedamountlow'
] as const;

const peerConnectionEventsTypes = [
  'connectionstatechange',
  'datachannel',
  'icecandidate',
  'icecandidateerror',
  'iceconnectionstatechange',
  'icegatheringstatechange',
  'negotiationneeded',
  'signalingstatechange',
  'track',
] as const;

type DataChannelEvent<U extends keyof RTCDataChannelEventMap> = U extends any ? {
  type: U;
  event: RTCDataChannelEventMap[U]
  dataChannel: RTCDataChannel;
} : never;

type PeerConnectionEvent<U extends keyof RTCPeerConnectionEventMap> = U extends any ? {
  type: U;
  event: RTCPeerConnectionEventMap[U]
  peerConnection: RTCPeerConnection;
} : never;

interface RemotePeerEvents {
  receivedSignal: SignalingEvent;
  sentSignal: SignalingEvent;
  dataChannel: DataChannelEvent<keyof RTCDataChannelEventMap>;
  peerConnection: PeerConnectionEvent<keyof RTCPeerConnectionEventMap>;
}