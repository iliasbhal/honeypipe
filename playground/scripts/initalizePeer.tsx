import { FetchSignalingAdapter } from "../../src/adapters/FetchSignalingAdapter";
import { Peer } from "../../src/Peer";
import { Room } from "../../src/Room";

export const initializePeerInRoom = (roomId: string) => {  
  const httpSignalAdapter = new FetchSignalingAdapter({
    pullUrl: window.location.origin + '/api/pull',
    pushUrl: window.location.origin + '/api/push',
  });

  const peerId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

  const peer = new Peer({ peerId });
  const room = new Room(roomId!, httpSignalAdapter, {
    iceServers: [{
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302'
      ]
    }],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  });

  return { peer, room };
}