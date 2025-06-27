import { SignalingAdapter } from './SignalingAdapter';
import { Peer } from './Peer';
import { RemotePeer } from './RemotePeer';
import { EventEmitter } from './utils/EventEmitter';
import { FetchSignalAdapter } from './FetchSignalAdapter';

interface RoomEvents<MessageType = any> {
  presence: { peer: RemotePeer | Peer, type: 'join' | 'alive' | 'leave' },
  message: { peer: RemotePeer | Peer, message: MessageType },
}

interface RoomConfig {
  adapter?: SignalingAdapter;
  rtcConfiguration?: RTCConfiguration;
}

/**
 * Room is a simple value object representing a room identifier
 * All room operations should be performed via Peer.via(room)
 */
export class Room<MessageType = any> extends EventEmitter<RoomEvents<MessageType>> {
  __types = {} as {
    MessageType: MessageType,
  };

  readonly id: string;
  readonly config: RoomConfig;

  constructor(id: string, config?: RoomConfig) {
    super();

    this.id = id;

    const baseUrl = 'https://honeypipe.wasmer.app';
    this.config = {
      adapter: new FetchSignalAdapter({ baseUrl }),
      ...config,
    };
  }
}