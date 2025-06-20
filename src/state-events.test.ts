import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Peer } from './Peer';
import { InMemorySignalingAdapter } from './adapters/InMemorySignalingAdapter';
import { wait } from './utils/wait';

describe('State Events System', () => {
  beforeEach(() => {
    // Suppress console logs
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should emit peer-level events when joining and leaving rooms', async () => {
    const signalingAdapter = new InMemorySignalingAdapter();
    const room = new Peer.Room('test-room', signalingAdapter);
    const peer = new Peer({ peerId: 'TestPeer' });

    const joinedEvents: any[] = [];
    const leftEvents: any[] = [];

    peer.on('roomJoined', (event) => joinedEvents.push(event));
    peer.on('roomLeft', (event) => leftEvents.push(event));

    // Join room
    peer.join(room);
    
    expect(joinedEvents).toHaveLength(1);
    expect(joinedEvents[0].room).toBe(room);
    expect(joinedEvents[0].peerRoom).toBeDefined();

    // Leave room
    peer.leave(room);
    
    expect(leftEvents).toHaveLength(1);
    expect(leftEvents[0].room).toBe(room);

    await signalingAdapter.close();
  });

  it('should emit room-level presence events', async () => {
    const signalingAdapter = new InMemorySignalingAdapter();
    const room = new Peer.Room('test-room', signalingAdapter);
    const alice = new Peer({ peerId: 'Alice' });
    const bob = new Peer({ peerId: 'Bob' });

    const presenceEvents: any[] = [];

    room.on('presence', (event) => presenceEvents.push(event));

    // Join room
    alice.join(room);
    bob.join(room);

    await wait(500);

    // Check presence events
    expect(presenceEvents.length).toBeGreaterThan(0);
    
    // Verify we have join events for both peers
    const joinEvents = presenceEvents.filter(e => e.type === 'join');
    expect(joinEvents.length).toBeGreaterThanOrEqual(2);

    await signalingAdapter.close();
  });

  it('should emit peerRoom-level state change events', async () => {
    const signalingAdapter = new InMemorySignalingAdapter();
    const room = new Peer.Room('test-room', signalingAdapter);
    const peer = new Peer({ peerId: 'TestPeer' });

    const stateEvents: any[] = [];
    const peerRoom = peer.in(room);

    peerRoom.on('stateChanged', (event) => stateEvents.push(event));

    expect(peerRoom.state).toBe('idle');

    // Join room
    peerRoom.join();
    
    expect(stateEvents).toContainEqual({ state: 'joining' });
    expect(stateEvents).toContainEqual({ state: 'joined' });
    expect(peerRoom.state).toBe('joined');

    // Leave room
    peerRoom.leave();
    
    expect(stateEvents).toContainEqual({ state: 'leaving' });
    expect(stateEvents).toContainEqual({ state: 'left' });
    expect(peerRoom.state).toBe('left');

    await signalingAdapter.close();
  });

  it('should emit room state change events', async () => {
    const signalingAdapter = new InMemorySignalingAdapter();
    const room = new Peer.Room('test-room', signalingAdapter);

    const stateEvents: any[] = [];
    room.on('stateChanged', (event) => stateEvents.push(event));

    expect(room.state).toBe('active');

    // Mark inactive
    room.markInactive();
    
    expect(stateEvents).toContainEqual({ state: 'inactive' });
    expect(room.state).toBe('inactive');

    // Mark active again
    room.markActive();
    
    expect(stateEvents).toContainEqual({ state: 'active' });
    expect(room.state).toBe('active');

    await signalingAdapter.close();
  });

  it('should emit messageSent events even when data channel is not ready', async () => {
    const signalingAdapter = new InMemorySignalingAdapter();
    const room = new Peer.Room('test-room', signalingAdapter);
    const alice = new Peer({ peerId: 'Alice' });
    const bob = new Peer({ peerId: 'Bob' });

    const sentEvents: any[] = [];
    const alicePeerRoom = alice.in(room);

    alicePeerRoom.on('messageSent', (event) => sentEvents.push(event));

    // Join rooms
    alice.join(room);
    bob.join(room);

    await wait(500);

    // Try to send message (will fail but should still emit messageSent event)
    const message = { text: 'Hello Bob!' };
    try {
      alicePeerRoom.sendMessage(message);
    } catch (error) {
      // Expected to fail due to data channel not being ready
      expect(error.message).toBe('Data channel not ready!');
    }

    // messageSent event should still be emitted
    expect(sentEvents).toHaveLength(1);
    expect(sentEvents[0].message).toEqual(message);
    expect(sentEvents[0].to).toBeInstanceOf(Array);

    await signalingAdapter.close();
  });

  it('should support event disposal', async () => {
    const signalingAdapter = new InMemorySignalingAdapter();
    const room = new Peer.Room('test-room', signalingAdapter);
    const peer = new Peer({ peerId: 'TestPeer' });

    const events: any[] = [];
    const subscription = peer.on('roomJoined', (event) => events.push(event));

    // Join room - should receive event
    peer.join(room);
    expect(events).toHaveLength(1);

    // Dispose subscription
    subscription.dispose();

    // Leave and join again - should not receive event
    peer.leave(room);
    peer.join(room);
    expect(events).toHaveLength(1); // Still only 1 event

    await signalingAdapter.close();
  });

  it('should support once() for one-time subscriptions', async () => {
    const signalingAdapter = new InMemorySignalingAdapter();
    const room = new Peer.Room('test-room', signalingAdapter);
    const peer = new Peer({ peerId: 'TestPeer' });

    const events: any[] = [];
    peer.once('roomJoined', (event) => events.push(event));

    // Join room - should receive event
    peer.join(room);
    expect(events).toHaveLength(1);

    // Leave and join again - should not receive event
    peer.leave(room);
    peer.join(room);
    expect(events).toHaveLength(1); // Still only 1 event

    await signalingAdapter.close();
  });
});