import { SignalingEvent, SignalPullRequest } from "./SignalingAdapter";

export class SignalBroker {
  private queues: Map<string, SignalQueue> = new Map();

  async push(signal: SignalingEvent) {
    const signalKey = 'channelId' in signal ? signal.channelId : signal.roomId;
    if (!signalKey) {
      throw new Error('Signal key is required');
    }

    // Get or create queue for this signal key
    if (!this.queues.has(signalKey)) {
      this.queues.set(signalKey, new SignalQueue());
    }

    this.queues.get(signalKey)!.push(signal);
  }

  async pull(request: SignalPullRequest): Promise<SignalingEvent[]> {
    const signalKey = 'channelId' in request ? request.channelId : request.roomId;
    if (!signalKey) {
      throw new Error('Signal key is required');
    }

    // Return signals from the specific queue
    const queue = this.queues.get(signalKey);
    if (!queue) {
      return [];
    }

    return queue.pull(request.after);
  }
}

interface QueueItem {
  signal: SignalingEvent;
  timestamp: number;
}

class SignalQueue {
  private static readonly MAX_QUEUE_SIZE = 200;
  private static readonly CLEANUP_INTERVAL = 2 * 60 * 1000; // 2 minutes

  private queue: QueueItem[] = [];
  private lastCleanupTime: number = 0;
  private timer: NodeJS.Timeout | null = null;

  push(signal: SignalingEvent) {
    // Clean up old signals before adding new ones
    this.cleanupOldSignals();

    // Add new signal to queue
    this.queue.push({
      signal,
      timestamp: Date.now()
    });

    // Implement FIFO behavior: remove oldest message if queue exceeds maximum size
    if (this.queue.length > SignalQueue.MAX_QUEUE_SIZE) {
      this.queue.shift(); // Remove the oldest message (FIFO)
    }
  }

  pull(afterId?: string): SignalingEvent[] {
    if (!afterId) {
      return this.queue.map(item => item.signal);
    }

    const afterIndex = this.queue.findIndex(item => item.signal.id === afterId);
    const startIndex = afterIndex === -1 ? 0 : afterIndex + 1;
    return this.queue
      .slice(startIndex)
      .map(item => item.signal);
  }

  cleanupOldSignals() {
    const now = Date.now();
    const lastCleanup = this.lastCleanupTime || 0;

    // Only cleanup if enough time has passed since last cleanup
    if (now - lastCleanup < SignalQueue.CLEANUP_INTERVAL) {
      return;
    }

    const twoMinutesAgo = now - SignalQueue.CLEANUP_INTERVAL;
    this.queue = this.queue.filter(item => item.timestamp > twoMinutesAgo);
    this.lastCleanupTime = now;

    // Schedule next cleanup in 2 minutes
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.cleanupOldSignals(), SignalQueue.CLEANUP_INTERVAL);
  }

  destroy() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }
}