import { Room } from '../src/Room';
import { Peer } from '../src/Peer';
import { InMemorySignalingAdapter } from '../src/adapters/InMemorySignalingAdapter';

/**
 * Example demonstrating the new improved Developer Experience (DX)
 * with intuitive sendMessage API and event handlers
 */

async function improvedDxExample() {
  console.log('=== Improved Developer Experience Demo ===\n');

  const signalingAdapter = new InMemorySignalingAdapter();
  
  // Create a game room with custom RTC config
  const gameRoom = new Room('game-lobby', signalingAdapter, {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  // Create players
  const alice = new Peer({ peerId: 'alice' });
  const bob = new Peer({ peerId: 'bob' });
  const charlie = new Peer({ peerId: 'charlie' });

  // ============================================================================
  // STEP 1: Setup event handlers with great DX
  // ============================================================================

  // Alice listens for messages
  const aliceMessageCleanup = alice.onMessage((message, fromPeerId, context) => {
    if (context instanceof Room) {
      console.log(`[Alice] 📢 Room message from ${fromPeerId}: "${message}"`);
    } else {
      console.log(`[Alice] 💬 Direct message from ${fromPeerId}: "${message}"`);
    }
  });

  // Alice listens for presence updates
  const alicePresenceCleanup = alice.onPresence((event) => {
    console.log(`[Alice] 👥 ${event.peerId} ${event.type}ed room ${event.roomId}`);
  });

  // Bob listens for messages
  bob.onMessage((message, fromPeerId, context) => {
    if (context instanceof Room) {
      console.log(`[Bob] 📢 Room message from ${fromPeerId}: "${message}"`);
    } else {
      console.log(`[Bob] 💬 Direct message from ${fromPeerId}: "${message}"`);
    }
  });

  // Bob listens for presence
  bob.onPresence((event) => {
    console.log(`[Bob] 👥 ${event.peerId} ${event.type}ed room ${event.roomId}`);
  });

  // ============================================================================
  // STEP 2: Join room and see presence events
  // ============================================================================

  console.log('--- Players joining game lobby ---');
  await alice.joinRoom(gameRoom);
  await bob.joinRoom(gameRoom);
  await charlie.joinRoom(gameRoom);

  // Wait a bit for presence events to propagate
  await new Promise(resolve => setTimeout(resolve, 100));

  // ============================================================================
  // STEP 3: Room messaging (broadcast to all)
  // ============================================================================

  console.log('\n--- Room Broadcasting ---');
  
  // Alice broadcasts to everyone in the room
  alice.sendMessage(gameRoom, 'Hello everyone! Let\'s start the game!');
  
  // Bob broadcasts to the room
  bob.sendMessage(gameRoom, 'Ready to play!');

  // Wait for messages to propagate
  await new Promise(resolve => setTimeout(resolve, 100));

  // ============================================================================
  // STEP 4: Direct peer-to-peer messaging via Channels
  // ============================================================================

  console.log('\n--- Direct Peer-to-Peer Messaging ---');
  
  // Alice gets a direct channel to Bob
  const aliceToBobChannel = alice.getChannelWith('bob');
  
  // Bob gets the same channel (deterministic channel ID)
  const bobToAliceChannel = bob.getChannelWith('alice');
  
  console.log(`Alice's channel ID: ${aliceToBobChannel.id}`);
  console.log(`Bob's channel ID: ${bobToAliceChannel.id}`);
  console.log(`Channels are the same: ${aliceToBobChannel.id === bobToAliceChannel.id}`);
  
  // Alice sends a private message to Bob
  alice.sendMessage(aliceToBobChannel, 'Hey Bob, want to team up?');
  
  // Bob sends a private message back to Alice
  bob.sendMessage(bobToAliceChannel, 'Sure Alice, let\'s do it!');

  // ============================================================================
  // STEP 5: Data channel messaging for game data
  // ============================================================================

  console.log('\n--- Data Channel Messaging ---');
  
  // Alice sends game data via specific data channel
  alice.sendMessage(aliceToBobChannel, 'player-position:x=100,y=200', 'game-data');
  
  // Bob sends game action via data channel
  bob.sendMessage(bobToAliceChannel, 'action:shoot,target=enemy1', 'game-actions');

  // Wait for messages
  await new Promise(resolve => setTimeout(resolve, 100));

  // ============================================================================
  // STEP 6: Cleanup and leave
  // ============================================================================

  console.log('\n--- Game Over ---');
  
  // Charlie leaves the game
  await charlie.leaveRoom(gameRoom);
  
  // Wait for presence events
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Clean up event handlers
  aliceMessageCleanup();
  alicePresenceCleanup();
  
  // Close connections
  await alice.close();
  await bob.close();
  
  console.log('\n=== Demo Complete ===');
}

/**
 * Key DX Improvements:
 * 
 * 1. **Intuitive sendMessage API**:
 *    - `peer.sendMessage(room, message)` → broadcasts to all
 *    - `peer.sendMessage(channel, message)` → sends to specific peer
 *    - Optional dataChannelLabel for structured data
 * 
 * 2. **Event-driven messaging**:
 *    - `peer.onMessage((message, fromPeerId, context) => ...)` 
 *    - Context tells you if it's from Room or Channel
 * 
 * 3. **Presence awareness**:
 *    - `peer.onPresence((event) => ...)` for join/leave events
 *    - Real-time updates when peers connect/disconnect
 * 
 * 4. **Channel management**:
 *    - `peer.getChannelWith(peerId)` creates/gets deterministic channels
 *    - Same channel ID regardless of who calls it first
 * 
 * 5. **Cleanup functions**:
 *    - Event handlers return cleanup functions
 *    - Proper resource management
 */

export { improvedDxExample };