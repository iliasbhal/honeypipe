import '../src/utils/polyfill';
// import { vi } from 'vitest';
import { Peer } from '../src/Peer';
import { InMemorySignalingAdapter } from '../src/adapters/InMemorySignalingAdapter';
import { wait } from '../src/utils/wait';
import { SignalingAdapter } from '../src/adapters/_base';

const main = async () => {

  const signalingAdapter = new InMemorySignalingAdapter();
  const roomId = 'test-room-1';

  type MessageContent = {
    content: string;
  };

  // const aliceSpy = vi.fn();
  const roomAlice = new Peer.Room<MessageContent>(roomId, signalingAdapter);
  const alice = new Peer({ peerId: 'Alice' });
  // roomAlice.on('presence', (event) => aliceSpy({ type: event.type, peerId: event.peer.id }));

  // const bobSpy = vi.fn();
  const roomBob = new Peer.Room<MessageContent>(roomId, signalingAdapter);
  const bob = new Peer({ peerId: 'Bob' });
  // roomBob.on('presence', (event) => bobSpy({ type: event.type, peerId: event.peer.id }));

  // const charlieSpy = vi.fn();
  const roomCharlie = new Peer.Room<MessageContent>(roomId, signalingAdapter);
  const charlie = new Peer({ peerId: 'Charlie' });
  // roomCharlie.on('presence', (event) => charlieSpy({ type: event.type, peerId: event.peer.id }));

  alice.join(roomAlice);
  bob.join(roomBob);
  charlie.join(roomCharlie);

  await wait(3000);



  await wait(3000);

}

main()
  .then(() => { console.log('DONE'); })
  .catch((err) => { console.error(err); });
