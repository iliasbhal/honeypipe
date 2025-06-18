import '../src/utils/polyfill';
import { Peer } from '../src/Peer';
import { InMemorySignalingAdapter } from '../src/adapters/InMemorySignalingAdapter';

const main = async () => {

  const signalingAdapter = new InMemorySignalingAdapter();
  const alice = new Peer({ peerId: 'Alice' });
  const marc = new Peer({ peerId: 'Marc' });

  const room = new Peer.Room('meeting-room-123', signalingAdapter);

  alice.join(room);
  marc.join(room);

  alice.in(room).onPresenceChange((event) => {
    console.log('alice (onPresence)', event);
  });

  marc.in(room).onPresenceChange((event) => {
    console.log('marc (onPresence)', event);
  });
}

main()
  .then(() => { console.log('DONE'); })
  .catch((err) => { console.error(err); });
