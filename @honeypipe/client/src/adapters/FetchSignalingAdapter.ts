import { SignalingEvent, SignalingAdapter, SignalPullRequest } from './_base';

export interface FetchSignalingAdapterConfig {
  pushUrl: string;
  pullUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
  rtcConfiguration?: RTCConfiguration;
}

export class FetchSignalingAdapter implements SignalingAdapter {
  private config: FetchSignalingAdapterConfig;

  constructor(config: FetchSignalingAdapterConfig) {
    this.config = {
      timeout: 5000,
      rtcConfiguration: {
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
      },
      ...config
    };
  }

  /**
   * Push an event to the signaling server
   */
  async push(event: SignalingEvent): Promise<number> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.config.pushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers
        },
        body: JSON.stringify(event),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Push failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      // Expect the server to return the new index/length
      if (typeof result.index === 'number') {
        return result.index;
      } else if (typeof result.length === 'number') {
        return result.length;
      } else if (typeof result === 'number') {
        return result;
      } else {
        throw new Error('Server response missing index/length field');
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Push request timed out after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Pull events from the signaling server since a given offset
   */
  async pull(request: SignalPullRequest): Promise<SignalingEvent[]> {
    const queryParams = new URLSearchParams();

    if ('channelId' in request) {
      queryParams.set('channelId', request.channelId);
    } else {
      queryParams.set('roomId', request.roomId);
    }

    if (request.offsetIndex !== undefined) {
      queryParams.set('offsetIndex', request.offsetIndex.toString());
    }

    const url = `${this.config.pullUrl}?${queryParams.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      },
    });

    if (!response.ok) {
      throw new Error(`Pull failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    // Expect the server to return an array of events
    if (Array.isArray(result)) {
      return result as SignalingEvent[];
    } else if (result.events && Array.isArray(result.events)) {
      return result.events as SignalingEvent[];
    } else {
      throw new Error('Server response is not an array of events');
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FetchSignalingAdapterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): FetchSignalingAdapterConfig {
    return { ...this.config };
  }

  async close(): Promise<void> {
    // No-op
  }

  /**
   * Get RTC configuration for WebRTC connections
   */
  getRtcConfiguration(): RTCConfiguration {
    return this.config.rtcConfiguration!;
  }
}