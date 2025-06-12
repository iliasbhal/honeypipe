import { createActor, Actor } from 'xstate';
import { WebRTCConnection } from './machines/WebRTCConnection';
import { Channel } from './Channel';

export interface PeerOptions {
  peerId: string;
}

interface ChannelConnection<ChannelType = Channel<any>> {
  channel: ChannelType;
  nachine: Actor<typeof WebRTCConnection>;
}

export class Peer {
  static Channel = Channel;

  peerId: string;
  connections: Map<string, ChannelConnection<any>> = new Map(); // channelId -> connection

  constructor(options: PeerOptions) {
    this.peerId = options.peerId;
  }

  get id(): string {
    return this.peerId;
  }

  async connect<C extends Channel<any>>(channel: C): Promise<void> {
    console.log(`[${this.peerId}] Connecting to channel ${channel.id}...`);

    // Check if channel is active
    if (!channel.isChannelActive()) {
      throw new Error(`Cannot connect to stopped channel ${channel.id}`);
    }

    // Check if already connected to this channel
    if (this.connections.has(channel.id)) {
      console.log(`[${this.peerId}] Already connected to channel ${channel.id}`);
      return;
    }

    // Create state machine for this connection
    const nachine = createActor(WebRTCConnection, {
      input: {
        channel,
        peer: this,
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

    // Store connection
    this.connections.set(channel.id, {
      channel,
      nachine
    });

    // Add this peer to the channel's peer list
    channel.addPeer(this);

    // Start the state machine - it handles everything including polling
    nachine.start();

    console.log(`[${this.peerId}] Started connection to channel ${channel.id}`);
  }



  send<C extends Channel<any>>(channel: C, message: C['__type']): void {
    const connection = this.connections.get(channel.id);
    if (!connection) {
      console.warn(`[${this.peerId}] No connection found for channel ${channel.id}`);
      return;
    }

    const messageStr = JSON.stringify(message);
    connection.nachine.send({ type: 'SEND_MESSAGE', message: messageStr, origin: 'main' });
  }


  getConnectionState(channelId: string): string {
    const connection = this.connections.get(channelId);
    if (!connection) return 'new';

    const snapshot = connection.nachine.getSnapshot();
    const peerConnection = snapshot.context.peerConnection;
    return peerConnection?.connectionState || 'new';
  }

  getIceConnectionState(channelId: string): string {
    const connection = this.connections.get(channelId);
    if (!connection) return 'new';

    const snapshot = connection.nachine.getSnapshot();
    const peerConnection = snapshot.context.peerConnection;
    return peerConnection?.iceConnectionState || 'new';
  }

  getDataChannelState(channelId: string): string | undefined {
    const connection = this.connections.get(channelId);
    if (!connection) return 'new';

    const snapshot = connection.nachine.getSnapshot();
    const dataChannel = snapshot.context.dataChannel;
    return dataChannel?.readyState;
  }

  getAllConnectionStates(): Record<string, { connectionState: string; iceConnectionState: string; dataChannelState?: string }> {
    const states: Record<string, any> = {};
    this.connections.forEach((connection, channelId) => {
      states[channelId] = {
        connectionState: this.getConnectionState(channelId),
        iceConnectionState: this.getIceConnectionState(channelId),
        dataChannelState: this.getDataChannelState(channelId),
        eventHistory: connection.nachine.getSnapshot().context.eventHistory,
      };
    });
    return states;
  }

  async close(): Promise<void> {
    console.log(`[${this.peerId}] Closing all connections`);

    this.connections.forEach((connection) => {
      // Remove this peer from the channel
      connection.channel.removePeer(this.peerId);

      // Send close connection event to state machine
      connection.nachine.send({ type: 'CLOSE_CONNECTION', origin: 'main' });

      // Stop the state machine
      connection.nachine.stop();
    });

    this.connections.clear();
  }

  // Disconnect from a specific channel
  async disconnect<C extends Channel<any>>(channel: C): Promise<void> {
    const connection = this.connections.get(channel.id);
    if (!connection) {
      console.warn(`[${this.peerId}] Not connected to channel ${channel.id}`);
      return;
    }

    console.log(`[${this.peerId}] Disconnecting from channel ${channel.id}`);

    // Remove this peer from the channel
    channel.removePeer(this.peerId);

    // Send close connection event and wait for machine to reach final state
    connection.nachine.send({ type: 'CLOSE_CONNECTION', origin: 'main' });

    // Wait for the state machine to properly close
    await new Promise<void>((resolve) => {
      const subscription = connection.nachine.subscribe((state) => {
        if (state.status === 'done') {
          subscription.unsubscribe();
          this.connections.delete(channel.id);
          resolve();
        }
      });

      // Fallback timeout
      setTimeout(() => {
        subscription.unsubscribe();
        connection.nachine.stop();
        this.connections.delete(channel.id);
        resolve();
      }, 1000);
    });

    console.log(`[${this.peerId}] Disconnected from channel ${channel.id}`);
  }
}