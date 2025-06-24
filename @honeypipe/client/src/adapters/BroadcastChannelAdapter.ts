import { SignalingEvent, SignalingAdapter, SignalPullRequest } from './_base';
import { wait } from '../utils/wait';

export class BroadcastChannelAdapter implements SignalingAdapter {
  private channel = new BroadcastChannel('honeypipe')
  private eventsByKey = new Map<string, SignalingEvent[]>();
  private syncByKey = new Map<string, Promise<void>>();

  constructor() {
    this.channel.addEventListener('message', (event) => {
      console.log('received message', event.data);
      if (event.data.type == 'sync_request') {
        const key = event.data.key;
        const events = this.eventsByKey.get(key) || [];
        return this.channel.postMessage({
          type: 'sync_response',
          key,
          events,
        });
      }

      const signal = event.data as SignalingEvent;
      this.pushLocalSignal(signal);
    });
  }

  private getSignalKey(signal: SignalingEvent | SignalPullRequest) {
    return 'channelId' in signal ? signal.channelId : signal.roomId;
  }

  private waitUntilKeyIsSynced(key: string): Promise<void> {
    if (this.syncByKey.has(key)) {
      return this.syncByKey.get(key)!;
    }

    const syncPromise = new Promise<void>((resolve) => {
      this.channel.postMessage({ type: 'sync_request', key });
      setTimeout(resolve, 500);
      this.channel.addEventListener('message', (event) => {
        if (event.data.type != 'sync_response') return;
        if (event.data.key != key) return;

        event.data.events.forEach((event) => {
          this.pushLocalSignal(event);
        });
      });
    });

    this.syncByKey.set(key, syncPromise);
    return syncPromise;
  }

  private pushLocalSignal(signal: SignalingEvent) {
    const events = this.getEventsBucketFor(signal);
    events.push(signal);
  }

  private getEventsBucketFor(signal: SignalingEvent | SignalPullRequest) {
    const key = this.getSignalKey(signal);
    const events = this.eventsByKey.get(key) || [];
    this.eventsByKey.set(key, events);
    return events;
  }

  /**
   * Push an event to a channel timeline
   */
  async push(event: SignalingEvent) {
    this.channel.postMessage(event);
    this.pushLocalSignal(event);
  }

  /**
   * Pull all events from a channel timeline since a given offset
   */
  async pull(request: SignalPullRequest): Promise<SignalingEvent[]> {
    const key = this.getSignalKey(request);
    await this.waitUntilKeyIsSynced(key);

    const events = this.getEventsBucketFor(request);
    const eventsToReturn = events.slice(request.offsetIndex || 0);
    return eventsToReturn;
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