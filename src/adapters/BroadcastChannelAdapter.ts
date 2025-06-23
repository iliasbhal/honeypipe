import { SignalingEvent, SignalingAdapter, SignalPullRequest } from './_base';

export class BroadcastChannelAdapter implements SignalingAdapter {
  private channel = new BroadcastChannel('honeypipe');
  items: SignalingEvent[] = [];

  constructor() {
    this.channel.addEventListener('message', (event) => {
      this.items.push(event.data);
    })
  }

  /**
   * Push an event to a channel timeline
   */
  async push(event: SignalingEvent): Promise<number> {
    this.items.push(event);
    this.channel.postMessage(event);
    return this.items.length;
  }

  /**
   * Pull all events from a channel timeline since a given offset
   */
  async pull(request: SignalPullRequest): Promise<SignalingEvent[]> {
    const events = this.items.slice(request.offsetIndex || 0);
    return events;
  }

  /**
   * Helper method to close Redis connection
   */
  async close(): Promise<void> {
    this.channel.close();
  }

  /**
   * Get RTC configuration for WebRTC connections
   */
  getRtcConfiguration(): RTCConfiguration {
    return {
      iceServers: [
        {
          urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302'
          ]
        }
      ],
    };
  }
}