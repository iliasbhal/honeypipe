import { Room } from '../src/Room';
import { Peer } from '../src/Peer';
import { InMemorySignalingAdapter } from '../src/adapters/InMemorySignalingAdapter';

// Example showing how rtcConfiguration is now defined at the Room level

async function example() {
  const signalingAdapter = new InMemorySignalingAdapter();

  // Room with custom RTC configuration
  const gameRoom = new Room('game-room-1', signalingAdapter, {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'turn:your-turn-server.com', username: 'user', credential: 'pass' }
    ],
    iceCandidatePoolSize: 20,
    bundlePolicy: 'max-bundle' as RTCBundlePolicy,
    rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy
  });

  // Room with default RTC configuration
  const chatRoom = new Room('chat-room-1', signalingAdapter);

  // Create peers
  const alice = new Peer({ peerId: 'alice' });
  const bob = new Peer({ peerId: 'bob' });

  console.log('Game room RTC config:', gameRoom.rtcConfiguration);
  console.log('Chat room RTC config (default):', chatRoom.rtcConfiguration);

  // Peers join rooms and automatically use the room's RTC configuration
  await alice.joinRoom(gameRoom);  // Uses custom config with TURN server
  await bob.joinRoom(chatRoom);    // Uses default config

  // All peer connections in gameRoom will use the custom configuration
  // All peer connections in chatRoom will use the default configuration

  // Cleanup
  await alice.leaveRoom(gameRoom);
  await bob.leaveRoom(chatRoom);
}

// This demonstrates the architectural improvements:
// - RTC configuration is defined at the room level
// - All peers in a room use the same RTC configuration  
// - Different rooms can have different RTC configurations
// - Peer class is now simpler and focused on peer behavior
// - Room tracks peer IDs only (not instances) for distributed systems
// - Peers in different browsers/runtimes can connect via peer IDs
export { example };