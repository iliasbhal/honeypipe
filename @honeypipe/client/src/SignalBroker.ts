import { SignalingEvent, SignalPullRequest } from "./SignalingAdapter";

interface SignalQueue {
  queue: Array<{ signal: SignalingEvent; timestamp: number }>,
  lastCleanupTime: number,
  timer: NodeJS.Timeout | null,
}

export class SignalBroker {
  private queues: Map<string, SignalQueue> = new Map();

  async push(signal: SignalingEvent) {
    const signalKey = 'channelId' in signal ? signal.channelId : signal.roomId;
    if (!signalKey) {
      throw new Error('Signal key is required');
    }

    // Clean up old signals for this key before adding new ones
    this.cleanupOldSignals(signalKey);

    // Get or create queue for this signal key
    if (!this.queues.has(signalKey)) {
      this.queues.set(signalKey, {
        queue: [],
        lastCleanupTime: 0,
        timer: null,
      });
    }

    this.queues.get(signalKey)!.queue.push({
      signal,
      timestamp: Date.now()
    });
  }

  async pull(request: SignalPullRequest): Promise<SignalingEvent[]> {
    const signalKey = 'channelId' in request ? request.channelId : request.roomId;
    if (!signalKey) {
      throw new Error('Signal key is required');
    }

    // Return signals from the specific queue
    const queue = this.queues.get(signalKey)?.queue;
    if (!queue) {
      return [];
    }

    const afterIndex = queue.findIndex(item => item.signal.id === request.after);
    const startIndex = afterIndex === -1 ? 0 : afterIndex + 1;
    return queue
      .slice(startIndex)
      .map(item => item.signal);
  }

  private cleanupOldSignals(key: string) {
    const now = Date.now();
    const signalQueue = this.queues.get(key);
    if (!signalQueue) {
      return;
    }

    const lastCleanup = signalQueue.lastCleanupTime || 0;
    const cleanupInterval = 2 * 60 * 1000; // 2 minutes

    // Only cleanup if enough time has passed since last cleanup
    if (now - lastCleanup < cleanupInterval) {
      return;
    }

    const twoMinutesAgo = now - cleanupInterval;
    const filteredQueue = signalQueue.queue.filter(item => item.timestamp > twoMinutesAgo);
    if (filteredQueue.length === 0) {
      // Remove empty queue to save memory
      this.queues.delete(key);
    } else {
      // Schedule next cleanup in 2 minutes
      const nextCleanupTimer = setTimeout(() => this.cleanupOldSignals(key), cleanupInterval);
      if (signalQueue.timer) {
        clearTimeout(signalQueue.timer);
      }

      this.queues.set(key, {
        queue: filteredQueue,
        lastCleanupTime: now,
        timer: nextCleanupTimer,
      });
    }
  }
}