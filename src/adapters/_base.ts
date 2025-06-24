export type SignalingEvent = {
  id: string;
  peerId: string;
} & ({
  roomId: string;
  type: 'join' | 'leave' | 'alive';
} | {
  channelId: string;
  type: 'sdpOffer' | 'sdpAnswer';
  data: RTCSessionDescriptionInit;
} | {
  channelId: string;
  type: 'sdpRestart';
} | {
  channelId: string;
  type: 'iceCandidate';
  data: RTCIceCandidateInit;
})

export type SignalPullRequest = {
  roomId: string;
  offsetIndex: number;
} | {
  channelId: string;
  offsetIndex: number;
}

export interface SignalingAdapter {
  push(event: SignalingEvent): Promise<void>;
  pull(request: SignalPullRequest): Promise<SignalingEvent[]>;
  close(): Promise<void>;
  getRtcConfiguration(): RTCConfiguration;
}

export interface RemotePeerData {
  peerId: string;
  sdp?: RTCSessionDescriptionInit;
  iceCandidates?: RTCIceCandidateInit[];
} 