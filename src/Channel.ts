/**
 * Channel is a simple value object representing a peer-to-peer channel identifier
 * All channel operations should be performed via Peer.via(channel)
 */
export class Channel<MessageType = any> {
  __type!: MessageType;
  readonly id: string;
  readonly roomId: string;
  readonly peerIds: readonly [string, string];

  constructor(roomId: string, peerId1: string, peerId2: string) {
    // Sort peer IDs to ensure consistent channel ID
    const sortedPeerIds = [peerId1, peerId2].sort();
    this.id = `${roomId}:${sortedPeerIds[0]}-${sortedPeerIds[1]}`;
    this.roomId = roomId;
    this.peerIds = [sortedPeerIds[0], sortedPeerIds[1]] as const;
  }

  /**
   * Check if a peer ID belongs to this channel
   */
  hasPeerId(peerId: string): boolean {
    return this.peerIds.includes(peerId);
  }

  /**
   * Get the other peer ID in this channel (given one peer ID)
   */
  getOtherPeerId(peerId: string): string | null {
    if (!this.hasPeerId(peerId)) {
      return null;
    }
    return this.peerIds[0] === peerId ? this.peerIds[1] : this.peerIds[0];
  }
}