import { SignalingAdapter } from './adapters/_base';

/**
 * Room is a simple value object representing a room identifier
 * All room operations should be performed via Peer.via(room)
 */
export class Room {
  readonly id: string;
  readonly signalingAdapter: SignalingAdapter;

  constructor(id: string, signalingAdapter: SignalingAdapter) {
    this.id = id;
    this.signalingAdapter = signalingAdapter;
  }
}