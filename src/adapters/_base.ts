export interface SignalingAdapter {
  /**
   * Join a room with the specified roomId and peerId
   */
  joinChannel(channelId: string, peerId: string): Promise<void>;

  /**
   * Send an ICE candidate to the signaling server
   */
  sendIceCandidate(channelId: string, peerId: string, candidate: RTCIceCandidate): Promise<void>;

  /**
   * Send SDP (Session Description Protocol) to the signaling server
   */
  sendSDP(channelId: string, peerId: string, sdp: RTCSessionDescriptionInit): Promise<void>;

  /**
   * Start the signaling loop to listen for remote peer data
   * @param channelId The channel to listen on
   * @param callback Function called with remote peer data
   * @returns Cleanup function to stop listening
   */
  onPeerData(channelId: string, callback: (remotePeer: RemotePeerData) => void): () => void;

  /**
   * Poll for pending messages for a specific peer in a channel
   * @param channelId The channel ID to poll from
   * @param peerId The peer ID to get messages for
   * @returns Array of remote peer data messages
   */
  pollMessages?(channelId: string, peerId: string): Promise<RemotePeerData[]>;

  /**
   * Clean up resources and stop signaling
   */
  cleanup(channelId: string): Promise<void> | void;
}

export interface RemotePeerData {
  peerId: string;
  sdp?: RTCSessionDescriptionInit;
  iceCandidates?: RTCIceCandidateInit[];
} 