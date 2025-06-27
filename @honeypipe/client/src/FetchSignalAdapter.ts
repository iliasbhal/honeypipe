import { SignalingEvent, SignalingAdapter, SignalPullRequest } from './SignalingAdapter';

export interface FetchSignalAdapterConfig {
  baseUrl: string;
}

export class FetchSignalAdapter implements SignalingAdapter {
  private baseUrl: string;

  constructor(config: FetchSignalAdapterConfig) {
    this.baseUrl = config.baseUrl?.replace(/\/$/, '');
  }

  /**
   * Push an event to the signaling server
   */
  async push(event: SignalingEvent): Promise<void> {
    const url = `${this.baseUrl}/push?data=${encodeURIComponent(JSON.stringify(event))}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP push failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Pull events from the signaling server
   */
  async pull(request: SignalPullRequest): Promise<SignalingEvent[]> {
    const url = `${this.baseUrl}/pull?data=${encodeURIComponent(JSON.stringify(request))}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP pull failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as SignalingEvent[];
  }

} 