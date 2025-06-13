import { createActor, Actor } from 'xstate';
import { PeerChannelMachine } from './machines/PeerChannelMachine';
import { Channel } from './Channel';
import { Peer } from './Peer';

export interface PeerChannelOptions {
  peer: Peer;
  channel: Channel<any>;
}

export class PeerChannel {
  private actor: Actor<typeof PeerChannelMachine>;
  private peer: Peer;
  private channel: Channel<any>;

  constructor(options: PeerChannelOptions) {
    this.peer = options.peer;
    this.channel = options.channel;

    this.actor = createActor(PeerChannelMachine, {
      input: {
        peer: this.peer,
        channel: this.channel,
        rtcConfiguration: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
          ],
          iceCandidatePoolSize: 10,
          bundlePolicy: 'balanced' as RTCBundlePolicy,
          rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy
        },
      },
    });
  }

  start() {
    console.log(`[PeerChannel ${this.peer.id}] Starting PeerChannel for channel ${this.channel.id}`);
    this.actor.start();
  }

  stop() {
    console.log(`[PeerChannel ${this.peer.id}] Stopping PeerChannel for channel ${this.channel.id}`);
    this.actor.stop();
  }

  send<C extends Channel<any>>(message: C['__type']): void {
    const messageStr = JSON.stringify(message);
    this.actor.send({ type: 'SEND_MESSAGE', message: messageStr });
  }

  getSnapshot() {
    return this.actor.getSnapshot();
  }

  getMeshConnections() {
    const snapshot = this.getSnapshot();
    return snapshot.context.meshConnections;
  }

  getConnectionState(remotePeerId: string): string {
    const snapshot = this.getSnapshot();
    const connection = snapshot.context.meshConnections.get(remotePeerId);
    if (!connection) return 'new';
    
    const connectionSnapshot = connection.getSnapshot();
    return connectionSnapshot.context.peerConnection?.connectionState || 'new';
  }

  getAllConnectionStates(): Record<string, { connectionState: string; iceConnectionState: string; dataChannelState?: string }> {
    const states: Record<string, any> = {};
    const snapshot = this.getSnapshot();
    
    snapshot.context.meshConnections.forEach((connection, remotePeerId) => {
      const connectionSnapshot = connection.getSnapshot();
      const pc = connectionSnapshot.context.peerConnection;
      const dc = connectionSnapshot.context.dataChannel;
      
      states[remotePeerId] = {
        connectionState: pc?.connectionState || 'new',
        iceConnectionState: pc?.iceConnectionState || 'new',
        dataChannelState: dc?.readyState,
      };
    });
    
    return states;
  }
}