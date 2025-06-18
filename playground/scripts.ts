import '../src/utils/polyfill';
import { Peer } from '../src/Peer';
import { InMemorySignalingAdapter } from '../src/adapters/InMemorySignalingAdapter';
import { wait } from '../src/utils/wait';
import { SignalingAdapter } from '../src/adapters/_base';

const initPeerScript = async (config: { peerId: string, roomId: string, signalingAdapter: SignalingAdapter }) => {
  const peer = new Peer({ peerId: config.peerId });
  const room = new Peer.Room(config.roomId, config.signalingAdapter);
  peer.join(room);
  peer.in(room).onPresenceChange((remotePeer) => {
    console.log(`${config.peerId} (onPresence)`, remotePeer.id);
  });

  peer.in(room).onMessage((message) => {
    console.log(`${config.peerId} (onMessage)`, message.from.id, message.content);
  });

  await wait(5000);

  peer.in(room).sendMessage(`Hello from ${config.peerId}`);
}

const main = async () => {

  const signalingAdapter = new InMemorySignalingAdapter();

  initPeerScript({ peerId: 'Alice', roomId: 'meeting-room-123', signalingAdapter });
  initPeerScript({ peerId: 'Marc', roomId: 'meeting-room-123', signalingAdapter });

}

main()
  .then(() => { console.log('DONE'); })
  .catch((err) => { console.error(err); });
