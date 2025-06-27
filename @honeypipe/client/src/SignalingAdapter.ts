export type SignalingEvent = {
  id: string;
  peerId: string;
} & ({
  roomId: string;
  type: 'join';
  sdpOffer?: RTCSessionDescriptionInit; // SDP offer included in join
} | {
  roomId: string;
  type: 'leave' | 'alive';
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
  after: string;
} & ({
  roomId: string;
} | {
  channelId: string;
});

export interface SignalingAdapter {
  push(event: SignalingEvent): Promise<void>;
  pull(request: SignalPullRequest): Promise<SignalingEvent[]>;
}

export interface RemotePeerData {
  peerId: string;
  sdp?: RTCSessionDescriptionInit;
  iceCandidates?: RTCIceCandidateInit[];
} 
