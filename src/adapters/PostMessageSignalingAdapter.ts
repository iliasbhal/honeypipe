export type SignalingEvent = {
  peerId: string;
  roomId: string;
  type: 'join' | 'leave' | 'alive';
} | {
  peerId: string;
  channelId: string;
  type: 'sdpOffer' | 'sdpAnswer';
  data: RTCSessionDescriptionInit;
} | {
  peerId: string;
  channelId: string;
  type: 'iceCandidate';
  data: RTCIceCandidateInit;
}

type SignalPullRequest = {
  roomId: string;
  offsetIndex: number;
} | {
  channelId: string;
  offsetIndex: number;
}

interface StoredEvent {
  event: SignalingEvent;
  index: number;
}

/**
 * PostMessage-based signaling adapter for cross-iframe communication
 * 
 * This adapter uses window.postMessage to communicate between iframes
 * and the parent window, simulating a signaling server.
 */
export class PostMessageSignalingAdapter {
  private targetWindow: Window;
  private origin: string;
  private events: Map<string, StoredEvent[]> = new Map(); // key -> events
  private eventIndexCounter: Map<string, number> = new Map(); // key -> next index
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private pendingRequests: Map<string, (value: any) => void> = new Map();
  private requestCounter = 0;

  constructor(targetWindow: Window = window.parent, origin: string = '*') {
    this.targetWindow = targetWindow;
    this.origin = origin;

    // Listen for messages
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  private handleMessage(event: MessageEvent) {
    if (this.origin !== '*' && event.origin !== this.origin) {
      return;
    }

    const { type, requestId, data } = event.data;

    // Handle responses to our requests
    if (type === 'signaling-response' && requestId) {
      const resolver = this.pendingRequests.get(requestId);
      if (resolver) {
        resolver(data);
        this.pendingRequests.delete(requestId);
      }
      return;
    }

    // Handle incoming requests (when acting as server)
    if (type === 'signaling-push') {
      this.handlePush(data.event);
      this.sendResponse(event, requestId, { success: true });
    } else if (type === 'signaling-pull') {
      const events = this.handlePull(data.request);
      this.sendResponse(event, requestId, { events });
    }
  }

  private sendResponse(originalEvent: MessageEvent, requestId: string, data: any) {
    if (originalEvent.source && originalEvent.source !== window) {
      (originalEvent.source as Window).postMessage({
        type: 'signaling-response',
        requestId,
        data
      }, this.origin);
    }
  }

  private getKey(event: SignalingEvent | SignalPullRequest): string {
    if ('roomId' in event) {
      return `room:${event.roomId}`;
    } else {
      return `channel:${event.channelId}`;
    }
  }

  private handlePush(event: SignalingEvent): void {
    const key = this.getKey(event);

    if (!this.events.has(key)) {
      this.events.set(key, []);
      this.eventIndexCounter.set(key, 0);
    }

    const index = this.eventIndexCounter.get(key)!;
    this.events.get(key)!.push({ event, index });
    this.eventIndexCounter.set(key, index + 1);
  }

  private handlePull(request: SignalPullRequest): SignalingEvent[] {
    const key = this.getKey(request);
    const storedEvents = this.events.get(key) || [];
    const offsetIndex = request.offsetIndex || 0;

    return storedEvents
      .filter(stored => stored.index >= offsetIndex)
      .map(stored => stored.event);
  }

  private async sendRequest(type: string, data: any): Promise<any> {
    const requestId = `req-${this.requestCounter++}`;

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve);

      this.targetWindow.postMessage({
        __HONEYPIPE: true,
        type,
        requestId,
        data
      }, this.origin);

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve(null);
        }
      }, 5000);
    });
  }

  /**
   * Push an event to a channel timeline
   */
  async push(event: SignalingEvent): Promise<number> {
    // If we're in an iframe, send to parent
    if (window !== window.parent) {
      await this.sendRequest('signaling-push', { event });
      return 1; // Return dummy value
    }

    // If we're the parent, handle locally
    this.handlePush(event);
    const key = this.getKey(event);
    return this.eventIndexCounter.get(key) || 0;
  }

  /**
   * Pull all events from a channel timeline since a given offset
   */
  async pull(request: SignalPullRequest): Promise<SignalingEvent[]> {
    // If we're in an iframe, request from parent
    if (window !== window.parent) {
      const response = await this.sendRequest('signaling-pull', { request });
      return response?.events || [];
    }

    // If we're the parent, handle locally
    return this.handlePull(request);
  }

  /**
   * Helper method to close and cleanup
   */
  async close(): Promise<void> {
    window.removeEventListener('message', this.handleMessage.bind(this));
    this.events.clear();
    this.eventIndexCounter.clear();
    this.pendingRequests.clear();
  }

  /**
   * Clear all events (useful for testing)
   */
  clearAll(): void {
    this.events.clear();
    this.eventIndexCounter.clear();
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
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };
  }
}