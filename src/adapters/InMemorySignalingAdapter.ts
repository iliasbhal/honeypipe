import Redis from 'ioredis-mock';
import { SignalingEvent, SignalingAdapter, SignalPullRequest } from './_base';

export class InMemorySignalingAdapter implements SignalingAdapter {
  private redis: InstanceType<typeof Redis>;

  constructor() {
    this.redis = new Redis();
  }

  /**
   * Push an event to a channel timeline
   */
  async push(event: SignalingEvent): Promise<number> {

    const redisKey = 'channelId' in event
      ? `channel:${event.channelId}:timeline`
      : `room:${event.roomId}:timeline`;

    // Push event to the end of the list and get the new length (which becomes the index)
    const newLength = await this.redis.rpush(redisKey, JSON.stringify(event));
    return newLength;
  }

  /**
   * Pull all events from a channel timeline since a given offset
   */
  async pull(request: SignalPullRequest): Promise<SignalingEvent[]> {

    const redisKey = 'channelId' in request
      ? `channel:${request.channelId}:timeline`
      : `room:${request.roomId}:timeline`;

    // Get events from the list (in reverse order since lpush puts newest first)
    const offsetIndex = request.offsetIndex || 0;
    const eventStrings = await this.redis.lrange(redisKey, offsetIndex, -1);

    const events: SignalingEvent[] = eventStrings
      .map((str: string) => JSON.parse(str) as SignalingEvent);

    return events;
  }

  /**
   * Helper method to close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
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
      iceCandidatePoolSize: 10,
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require'
    };
  }
}