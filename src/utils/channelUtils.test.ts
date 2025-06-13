import { describe, it, expect } from 'vitest'

// Helper function to generate channel ID for peer-to-peer communication
function generateChannelId(peerId1: string, peerId2: string): string {
  const sortedPeerIds = [peerId1, peerId2].sort();
  return `${sortedPeerIds[0]}-${sortedPeerIds[1]}`;
}

describe('generateChannelId', () => {
  it('should generate consistent channel ID regardless of peer order', () => {
    const peerId1 = 'alice';
    const peerId2 = 'bob';
    
    const channelId1 = generateChannelId(peerId1, peerId2);
    const channelId2 = generateChannelId(peerId2, peerId1);
    
    expect(channelId1).toBe(channelId2);
    expect(channelId1).toBe('alice-bob');
  });

  it('should sort peer IDs alphabetically', () => {
    const channelId1 = generateChannelId('zebra', 'apple');
    const channelId2 = generateChannelId('charlie', 'alice');
    const channelId3 = generateChannelId('peer-1', 'peer-10');
    
    expect(channelId1).toBe('apple-zebra');
    expect(channelId2).toBe('alice-charlie');
    expect(channelId3).toBe('peer-1-peer-10');
  });

  it('should handle same peer ID', () => {
    const channelId = generateChannelId('alice', 'alice');
    expect(channelId).toBe('alice-alice');
  });

  it('should handle complex peer IDs', () => {
    const channelId = generateChannelId('user-123-abc', 'user-456-def');
    expect(channelId).toBe('user-123-abc-user-456-def');
  });
});