import { SignalingAdapter } from './adapters/_base';
import { Peer } from './Peer';
import { RemotePeer } from './RemotePeer';

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

  private eventHandlers = {
    presence: new Set<(event: { peer: RemotePeer | Peer, type: 'join' | 'alive' | 'leave' }) => void>(),
    message: new Set<(event: { peer: RemotePeer | Peer, message: MessageType }) => void>(),
  };

  on<K extends keyof typeof this.eventHandlers>(event: K, handler: (event: Parameters<Parameters<typeof this.eventHandlers[K]['add']>[0]>[0]) => void) {
    this.eventHandlers[event]?.add(handler);

    return {
      dispose: () => {
        this.eventHandlers[event]?.delete(handler);
      }
    }
  }

  emit<K extends keyof typeof this.eventHandlers>(event: K, ...args: Parameters<Parameters<typeof this.eventHandlers[K]['add']>[0]>) {
    this.eventHandlers[event]?.forEach((handler: any) => {
      return handler(...args);
    });
  }
}