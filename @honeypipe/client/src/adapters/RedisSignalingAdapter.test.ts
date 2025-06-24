import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RedisSignalingAdapter } from './RedisSignalingAdapter';

describe('RedisSignalingAdapter', () => {
  let adapter: RedisSignalingAdapter;

  beforeEach(() => {
    adapter = new RedisSignalingAdapter();
  });

  afterEach(async () => {
    await adapter.close();
  });

  it('should push and pull room events', async () => {
    const roomId = 'test-room';
    
    // Push some events
    await adapter.push({
      roomId,
      peerId: 'peer1',
      type: 'join'
    });

    await adapter.push({
      roomId,
      peerId: 'peer2',
      type: 'join'
    });

    await adapter.push({
      roomId,
      peerId: 'peer1',
      type: 'alive'
    });

    // Pull events
    const events = await adapter.pull({
      roomId,
      offsetIndex: 0
    });

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      roomId,
      peerId: 'peer1',
      type: 'join'
    });
    expect(events[1]).toMatchObject({
      roomId,
      peerId: 'peer2',
      type: 'join'
    });
    expect(events[2]).toMatchObject({
      roomId,
      peerId: 'peer1',
      type: 'alive'
    });
  });

  it('should push and pull channel events', async () => {
    const channelId = 'test-channel';
    
    // Push SDP offer
    await adapter.push({
      channelId,
      peerId: 'peer1',
      type: 'sdpOffer',
      data: {
        type: 'offer',
        sdp: 'fake-sdp-offer'
      }
    });

    // Push SDP answer
    await adapter.push({
      channelId,
      peerId: 'peer2',
      type: 'sdpAnswer',
      data: {
        type: 'answer',
        sdp: 'fake-sdp-answer'
      }
    });

    // Pull events
    const events = await adapter.pull({
      channelId,
      offsetIndex: 0
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      channelId,
      peerId: 'peer1',
      type: 'sdpOffer'
    });
    expect(events[1]).toMatchObject({
      channelId,
      peerId: 'peer2',
      type: 'sdpAnswer'
    });
  });

  it('should pull events from specific offset', async () => {
    const roomId = 'test-room-offset';
    
    // Push 5 events
    for (let i = 1; i <= 5; i++) {
      await adapter.push({
        roomId,
        peerId: `peer${i}`,
        type: 'join'
      });
    }

    // Pull from offset 2 (should get events 3, 4, 5)
    const events = await adapter.pull({
      roomId,
      offsetIndex: 2
    });

    expect(events).toHaveLength(3);
    expect(events[0].peerId).toBe('peer3');
    expect(events[1].peerId).toBe('peer4');
    expect(events[2].peerId).toBe('peer5');
  });

  it('should handle empty pull results', async () => {
    const events = await adapter.pull({
      roomId: 'non-existent-room',
      offsetIndex: 0
    });

    expect(events).toHaveLength(0);
  });
});