import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../src/utils/polyfill';
import { Peer } from '../src/Peer';
import { SignalBroker } from '../src/SignalBroker';
import { wait } from '../src/utils/wait';
import { Room } from '../src/Room';

describe('Basic Connection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const signalingAdapter = new SignalBroker();
  const roomId = 'test-room-1';

  type MessageContent = {
    content: string;
  };

  const aliceSpy = vi.fn();
  const roomAlice = new Room<MessageContent>(roomId, { adapter: signalingAdapter });
  const alice = new Peer({ peerId: 'Alice' });
  roomAlice.on('presence', (event) => aliceSpy({ type: event.type, peerId: event.peer.id }));

  const bobSpy = vi.fn();
  const roomBob = new Room<MessageContent>(roomId, { adapter: signalingAdapter });
  const bob = new Peer({ peerId: 'Bob' });
  roomBob.on('presence', (event) => bobSpy({ type: event.type, peerId: event.peer.id }));

  const charlieSpy = vi.fn();
  const roomCharlie = new Room<MessageContent>(roomId, { adapter: signalingAdapter });
  const charlie = new Peer({ peerId: 'Charlie' });
  roomCharlie.on('presence', (event) => charlieSpy({ type: event.type, peerId: event.peer.id }));


  it('should detect people that joined a room', async () => {
    await Promise.all([
      alice.join(roomAlice),
      bob.join(roomBob),
      charlie.join(roomCharlie),
    ]);

    await wait(500);

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
      alice.in(roomAlice).waitForOtherPeers(),
      bob.in(roomBob).waitForOtherPeers(),
      charlie.in(roomCharlie).waitForOtherPeers(),
    ]);

    alice.in(roomAlice).sendMessage('Hello everyone! (Alice)');
    bob.in(roomBob).sendMessage('Hello everyone! (Bob)');
    charlie.in(roomCharlie).sendMessage('Hello everyone! (Charlie)');


    await wait(500);

    expect(hasBeenCalledWith(bobSpy, bob.id, 'Hello everyone! (Bob)')).toBe(true);
    expect(hasBeenCalledWith(bobSpy, alice.id, 'Hello everyone! (Alice)')).toBe(true);
    expect(hasBeenCalledWith(bobSpy, charlie.id, 'Hello everyone! (Charlie)')).toBe(true);

    expect(hasBeenCalledWith(aliceSpy, bob.id, 'Hello everyone! (Bob)')).toBe(true);
    expect(hasBeenCalledWith(aliceSpy, alice.id, 'Hello everyone! (Alice)')).toBe(true);
    expect(hasBeenCalledWith(aliceSpy, charlie.id, 'Hello everyone! (Charlie)')).toBe(true);

    expect(hasBeenCalledWith(charlieSpy, bob.id, 'Hello everyone! (Bob)')).toBe(true);
    expect(hasBeenCalledWith(charlieSpy, alice.id, 'Hello everyone! (Alice)')).toBe(true);
    expect(hasBeenCalledWith(charlieSpy, charlie.id, 'Hello everyone! (Charlie)')).toBe(true);
  });

  it('should allow newcomer to joing the room', async () => {
    const roomDan = new Room<MessageContent>(roomId, { adapter: signalingAdapter });
    const dan = new Peer({ peerId: 'Dan' });
    const danSpy = vi.fn();
    roomDan.on('presence', (event) => danSpy({ type: event.type, peerId: event.peer.id }));

    await dan.join(roomDan);
    await wait(1000);

    dan.in(roomDan).sendMessage('Hello everyone! (Dan)');

    await wait(1000);

    expect(hasBeenCalledWith(bobSpy, dan.id, 'Hello everyone! (Dan)')).toBe(true);
    expect(hasBeenCalledWith(aliceSpy, dan.id, 'Hello everyone! (Dan)')).toBe(true);
    expect(hasBeenCalledWith(charlieSpy, dan.id, 'Hello everyone! (Dan)')).toBe(true);
  })

  it('should detect people that left a room', async () => {
    await bob.leave(roomBob);
    await wait(1000);

    await alice.leave(roomAlice);
    await wait(1000);

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

const hasBeenCalledWith = (spy: any, peerId: string, message: string) => {
  return spy.mock.calls.some(call => call[0].peerId === peerId && call[0].message === message);
};