import { SignalingAdapter } from './adapters/_base';
import { Peer } from './Peer';
import { RemotePeer } from './RemotePeer';
import { EventEmitter } from './utils/EventEmitter';

interface RoomEvents<MessageType = any> {
  presence: (event: { peer: RemotePeer | Peer, type: 'join' | 'alive' | 'leave' }) => void,
  message: (event: { peer: RemotePeer | Peer, message: MessageType }) => void,
}

/**
 * Room is a simple value object representing a room identifier
 * All room operations should be performed via Peer.via(room)
 */
export class Room<MessageType = any> {
  __types = {} as {
    MessageType: MessageType,
  };

  readonly id: string;
  readonly signalingAdapter: SignalingAdapter;

  constructor(id: string, signalingAdapter: SignalingAdapter) {
    this.id = id;
    this.signalingAdapter = signalingAdapter;
  }

  private eventEmitter = new EventEmitter<RoomEvents<MessageType>>();
  get on() { return this.eventEmitter.on.bind(this.eventEmitter); }
  get off() { return this.eventEmitter.off.bind(this.eventEmitter); }
  get emit() { return this.eventEmitter.emit.bind(this.eventEmitter); }
}