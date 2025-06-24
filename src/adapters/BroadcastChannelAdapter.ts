import { SignalingEvent, SignalingAdapter, SignalPullRequest } from './_base';
import { wait } from '../utils/wait';



export class BroadcastChannelAdapter implements SignalingAdapter {
  static channel = new BroadcastChannel('honeypipe');
  private channel = BroadcastChannelAdapter.channel;
  eventsByKey = new Map<string, SignalingEvent[]>();

  constructor() {
    this.channel.addEventListener('message', (event) => {
      console.log('received message', event.data);
      const signal = event.data as SignalingEvent;
      this.pushLocalSignal(signal);
    })
  }

  private getSignalKey(signal: SignalingEvent | SignalPullRequest) {
    return 'channelId' in signal ? signal.channelId : signal.roomId;
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

    await wait(100);
  }

  /**
   * Pull all events from a channel timeline since a given offset
   */
  async pull(request: SignalPullRequest): Promise<SignalingEvent[]> {
    await wait(500);

    const events = this.getEventsBucketFor(request);
    const eventsToReturn = events.slice(request.offsetIndex || 0);
    console.log('pullpull', request, this.eventsByKey);
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