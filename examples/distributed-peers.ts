import { Room } from '../src/Room';
import { Peer } from '../src/Peer';
import { InMemorySignalingAdapter } from '../src/adapters/InMemorySignalingAdapter';

/**
 * Example demonstrating how the architecture works with distributed peers
 * In reality, these peers would be in different browsers/processes
 */

// Shared signaling adapter (in reality, this would be a server)
const signalingAdapter = new InMemorySignalingAdapter();

// Room configuration (defined once, used by all peers)
const gameRoom = new Room('multiplayer-game', signalingAdapter, {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:game-server.com', username: 'player', credential: 'secret' }
  ],
  iceCandidatePoolSize: 15,
  bundlePolicy: 'max-bundle' as RTCBundlePolicy
});

// Browser 1: Alice's peer instance
class Browser1 {
  static async run() {
    const alice = new Peer({ peerId: 'alice-browser-1' });
    
    console.log('[Browser 1] Alice joining game room...');
    await alice.joinRoom(gameRoom);
    
    // Room now tracks alice's peer ID
    console.log('[Room] Connected peers:', gameRoom.getConnectedPeerIds());
    
    // Alice can send messages to other peers (by ID)
    alice.sendMessageToPeer(gameRoom.id, 'bob-browser-2', 'Hello Bob!');
    alice.sendMessageToAll(gameRoom.id, 'Hello everyone from Alice!');
    
    return alice;
  }
}

// Browser 2: Bob's peer instance (completely separate runtime)
class Browser2 {
  static async run() {
    const bob = new Peer({ peerId: 'bob-browser-2' });
    
    console.log('[Browser 2] Bob joining game room...');
    await bob.joinRoom(gameRoom);
    
    // Room now tracks both peer IDs
    console.log('[Room] Connected peers:', gameRoom.getConnectedPeerIds());
    
    // Bob can send messages to other peers (by ID)
    bob.sendMessageToPeer(gameRoom.id, 'alice-browser-1', 'Hi Alice!');
    bob.sendMessageToDataChannel(gameRoom.id, 'alice-browser-1', 'game-data', 'move:x=10,y=20');
    
    return bob;
  }
}

// Browser 3: Charlie's peer instance (another separate runtime)
class Browser3 {
  static async run() {
    const charlie = new Peer({ peerId: 'charlie-mobile' });
    
    console.log('[Browser 3] Charlie joining game room...');
    await charlie.joinRoom(gameRoom);
    
    // Room now tracks all three peer IDs
    console.log('[Room] Connected peers:', gameRoom.getConnectedPeerIds());
    
    // Charlie can check room state without knowing other peer instances
    const roomStates = charlie.getAllRoomStates();
    console.log('[Browser 3] Charlie sees room state:', roomStates);
    
    return charlie;
  }
}

async function simulateDistributedGame() {
  console.log('=== Simulating Distributed Multiplayer Game ===');
  
  // These would run in completely separate browser tabs/processes
  const alice = await Browser1.run();
  const bob = await Browser2.run();
  const charlie = await Browser3.run();
  
  // Room tracks all peers by ID only (no direct references)
  console.log('\n[Final Room State]');
  console.log('Peer count:', gameRoom.getPeerCount());
  console.log('Connected peer IDs:', gameRoom.getConnectedPeerIds());
  console.log('Room is active:', gameRoom.isRoomActive());
  
  // Peers can leave independently
  console.log('\n[Alice leaves the game]');
  await alice.leaveRoom(gameRoom);
  console.log('Remaining peers:', gameRoom.getConnectedPeerIds());
  
  // Cleanup
  await bob.leaveRoom(gameRoom);
  await charlie.leaveRoom(gameRoom);
  
  console.log('\n[Game Over]');
  console.log('Final peer count:', gameRoom.getPeerCount());
}

/**
 * Key Benefits of this Architecture:
 * 
 * 1. **Distributed by Design**: Peers can be in different browsers/processes
 * 2. **ID-Based Communication**: No need for direct object references
 * 3. **Signaling Independence**: Peers communicate through signaling adapter
 * 4. **Room-Level Configuration**: WebRTC settings defined once per room
 * 5. **Scalable**: Works with any number of peers across any number of clients
 */

export { simulateDistributedGame };