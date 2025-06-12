import Redis from 'ioredis-mock';

export interface SignalingEvent {
  peerId: string;
  type: 'join' | 'sdp' | 'ice';
  data?: {
    sdp?: RTCSessionDescriptionInit;
    iceCandidate?: RTCIceCandidateInit;
  };
}

export class InMemorySignalingAdapter {
  private redis: Redis;

  constructor() {
    this.redis = new Redis();
  }

  /**
   * Push an event to a channel timeline
   */
  async push(channelId: string, event: SignalingEvent): Promise<number> {
    const redisKey = `channel:${channelId}:timeline`;

    // Push event to the end of the list and get the new length (which becomes the index)
    const newLength = await this.redis.rpush(redisKey, JSON.stringify(event));

    console.log(`[InMemory] ${event.peerId} pushing ${event.type} event #${newLength} to channel ${channelId}`);

    return newLength;
  }

  /**
   * Pull all events from a channel timeline since a given offset
   */
  async pull(channelId: string, offsetIndex: number = 0): Promise<SignalingEvent[]> {
    const redisKey = `channel:${channelId}:timeline`;

    // Get events from the list (in reverse order since lpush puts newest first)
    const eventStrings = await this.redis.lrange(redisKey, offsetIndex, -1);

    const events: SignalingEvent[] = eventStrings
      .map((str: string) => JSON.parse(str) as SignalingEvent)

    if (events.length > 0) {
      console.log(`[InMemory] Pulled ${events.length} events from channel ${channelId} since index ${offsetIndex}`);
    }

    return events;
  }

  /**
   * Helper method to close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}