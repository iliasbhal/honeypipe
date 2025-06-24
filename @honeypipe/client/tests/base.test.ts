import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../src/utils/polyfill';
import { Peer } from '../src/Peer';
import { InMemorySignalingAdapter } from '../src/adapters/InMemorySignalingAdapter';
import { wait } from '../src/utils/wait';

describe('Basic Connection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const signalingAdapter = new InMemorySignalingAdapter();
  const roomId = 'test-room-1';

  type MessageContent = {
    content: string;
  };

  const aliceSpy = vi.fn();
  const roomAlice = new Peer.Room<MessageContent>(roomId, signalingAdapter);
  const alice = new Peer({ peerId: 'Alice' });
  roomAlice.on('presence', (event) => aliceSpy({ type: event.type, peerId: event.peer.id }));

  const bobSpy = vi.fn();
  const roomBob = new Peer.Room<MessageContent>(roomId, signalingAdapter);
  const bob = new Peer({ peerId: 'Bob' });
  roomBob.on('presence', (event) => bobSpy({ type: event.type, peerId: event.peer.id }));

  const charlieSpy = vi.fn();
  const roomCharlie = new Peer.Room<MessageContent>(roomId, signalingAdapter);
  const charlie = new Peer({ peerId: 'Charlie' });
  roomCharlie.on('presence', (event) => charlieSpy({ type: event.type, peerId: event.peer.id }));


  it('should detect people that joined a room', async () => {
    alice.join(roomAlice);
    bob.join(roomBob);
    charlie.join(roomCharlie);

    await wait(1000);

    const expected1 = [
      [{ type: 'join', peerId: alice.id }],
      [{ type: 'join', peerId: bob.id }],
      [{ type: 'join', peerId: charlie.id }],
    ];

    expect(aliceSpy.mock.calls).toEqual(expected1);
    expect(bobSpy.mock.calls).toEqual(expected1);
    expect(charlieSpy.mock.calls).toEqual(expected1);
  });


  it('peers can send messages to everyone in the room', async () => {
    roomAlice.on('message', (event) => aliceSpy({ peerId: event.peer.id, message: event.message }));
    roomBob.on('message', (event) => bobSpy({ peerId: event.peer.id, message: event.message }));
    roomCharlie.on('message', (event) => charlieSpy({ peerId: event.peer.id, message: event.message }));

    await Promise.all([
      await alice.in(roomAlice).waitForOtherPeers(),
      await bob.in(roomBob).waitForOtherPeers(),
      await charlie.in(roomCharlie).waitForOtherPeers(),
    ]);

    alice.in(roomAlice).sendMessage('Hello everyone! (Alice)');
    bob.in(roomBob).sendMessage('Hello everyone! (Bob)');
    charlie.in(roomCharlie).sendMessage('Hello everyone! (Charlie)');


    await wait(1000);
    const hasBeenCalledWith = (spy: any, peerId: string, message: string) => {
      return spy.mock.calls.some(call => call[0].peerId === peerId && call[0].message === message);
    };

    expect(hasBeenCalledWith(bobSpy, bob.id, 'Hello everyone! (Bob)')).toBe(true);
    expect(hasBeenCalledWith(bobSpy, alice.id, 'Hello everyone! (Alice)')).toBe(true);
    expect(hasBeenCalledWith(bobSpy, charlie.id, 'Hello everyone! (Charlie)')).toBe(true);

    expect(hasBeenCalledWith(aliceSpy, bob.id, 'Hello everyone! (Bob)')).toBe(true);
    expect(hasBeenCalledWith(aliceSpy, alice.id, 'Hello everyone! (Alice)')).toBe(true);
    expect(hasBeenCalledWith(aliceSpy, charlie.id, 'Hello everyone! (Charlie)')).toBe(true);

    expect(hasBeenCalledWith(charlieSpy, bob.id, 'Hello everyone! (Bob)')).toBe(true);
    expect(hasBeenCalledWith(charlieSpy, alice.id, 'Hello everyone! (Alice)')).toBe(true);
    expect(hasBeenCalledWith(charlieSpy, charlie.id, 'Hello everyone! (Charlie)')).toBe(true);
  })

  it('should detect people that left a room', async () => {
    bob.leave(roomBob);

    await wait(2000);

    alice.leave(roomAlice);

    await wait(2000);

    const getLeaveEvents = (spy: any) => {
      return spy.mock.calls.filter(call => call[0].type === 'leave');
    }

    expect(getLeaveEvents(aliceSpy)).toEqual([
      [{ type: 'leave', peerId: bob.id }],
      [{ type: 'leave', peerId: alice.id }],
    ]);

    // Bob doesn't see alice leave because he left 
    // Before it happened, he only sees himself leave.
    expect(getLeaveEvents(bobSpy)).toEqual([
      [{ type: 'leave', peerId: bob.id }],
    ]);

    expect(getLeaveEvents(charlieSpy)).toEqual([
      [{ type: 'leave', peerId: bob.id }],
      [{ type: 'leave', peerId: alice.id }],
    ]);
  })

});