import { SignalingAdapter } from "../../src/adapters/_base";
import { Peer } from "../../src/Peer";
import { Room } from "../../src/Room";

export const initializePeerInRoom = (roomId: string, signalingAdapter: SignalingAdapter) => {  

  const peer = new Peer();
  const room = new Room(roomId, signalingAdapter);

  peer.joinRoom(room);

  peer.via(room).onPresence((event) => {
    console.log('Presence event:', event);
  });

  peer.via(room).onMessage((message) => {
    console.log('Message:', message);
  });

  peer.joinRoom(room);

  return { peer, room };
}