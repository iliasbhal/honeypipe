import { Room } from '../src/Room';
import { Peer } from '../src/Peer';
import { InMemorySignalingAdapter } from '../src/adapters/InMemorySignalingAdapter';

/**
 * Example demonstrating the new API where sendMessage and onMessage 
 * are methods on Room and Channel objects directly
 */

async function newApiExample() {
  console.log('=== New API Example ===\n');

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
  // STEP 1: Setup Room message and presence handlers
  // ============================================================================

  // Room handles message broadcasting - each peer can listen
  const aliceRoomCleanup = gameRoom.onMessage((message, fromPeerId) => {
    console.log(`[Alice] 📢 Room broadcast from ${fromPeerId}: "${message}"`);
  });

  const bobRoomCleanup = gameRoom.onMessage((message, fromPeerId) => {
    console.log(`[Bob] 📢 Room broadcast from ${fromPeerId}: "${message}"`);
  });

  // Room also handles presence updates
  const alicePresenceCleanup = gameRoom.onPresence((event) => {
    console.log(`[Alice] 👥 ${event.peerId} ${event.type}ed room ${event.roomId}`);
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
  
  // Room has sendMessage method that broadcasts to all
  gameRoom.sendMessage('Welcome to the game lobby!');
  
  // Wait for messages to propagate
  await new Promise(resolve => setTimeout(resolve, 100));

  // ============================================================================
  // STEP 4: Direct peer-to-peer messaging via Channels
  // ============================================================================

  console.log('\n--- Direct Peer-to-Peer Messaging ---');
  
  // Peer gets a channel via the room they're both connected to
  const aliceToBobChannel = alice.getChannelWith('bob', gameRoom);
  
  // Bob gets the same channel (deterministic channel ID with room prefix)
  const bobToAliceChannel = bob.getChannelWith('alice', gameRoom);
  
  console.log(`Alice's channel ID: ${aliceToBobChannel.id}`);
  console.log(`Bob's channel ID: ${bobToAliceChannel.id}`);
  console.log(`Channels are the same: ${aliceToBobChannel.id === bobToAliceChannel.id}`);
  
  // Setup channel message handlers
  aliceToBobChannel.onMessage((message, fromPeerId) => {
    console.log(`[Alice] 💬 Private message from ${fromPeerId}: "${message}"`);
  });
  
  bobToAliceChannel.onMessage((message, fromPeerId) => {
    console.log(`[Bob] 💬 Private message from ${fromPeerId}: "${message}"`);
  });
  
  // Channel has sendMessage method for peer-to-peer
  aliceToBobChannel.sendMessage('Hey Bob, want to team up?');
  bobToAliceChannel.sendMessage('Sure Alice, let\'s do it!');

  // ============================================================================
  // STEP 5: Data channel messaging for game data
  // ============================================================================

  console.log('\n--- Data Channel Messaging ---');
  
  // Alice sends game data via specific data channel
  aliceToBobChannel.sendMessage('player-position:x=100,y=200', 'game-data');
  
  // Bob sends game action via data channel
  bobToAliceChannel.sendMessage('action:shoot,target=enemy1', 'game-actions');

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
  aliceRoomCleanup();
  bobRoomCleanup();
  alicePresenceCleanup();
  
  // Close connections
  await alice.close();
  await bob.close();
  
  console.log('\n=== Demo Complete ===');
}

/**
 * Key Improvements in the New API:
 * 
 * 1. **Room-based messaging**:
 *    - `room.sendMessage(message)` → broadcasts to all peers
 *    - `room.onMessage((message, fromPeerId) => ...)` for room messages
 * 
 * 2. **Channel-based messaging**:
 *    - `channel.sendMessage(message, dataChannelLabel?)` → sends to specific peer
 *    - `channel.onMessage((message, fromPeerId) => ...)` for private messages
 * 
 * 3. **Room-prefixed Channel IDs**:
 *    - Channel IDs now include room: `"roomId:peerId1-peerId2"`
 *    - Allows same peers to have different channels in different rooms
 * 
 * 4. **Broadcast flag differentiation**:
 *    - Room messages have `broadcast: true` flag internally
 *    - Channel messages have `broadcast: false` flag
 *    - Messages are automatically routed to correct handlers
 * 
 * 5. **Lightweight Peer class**:
 *    - Peer tracks connected rooms
 *    - Most functionality moved to Room and Channel classes
 *    - Clean separation of concerns: Room (presence/broadcasting), Channel (P2P), Peer (connections)
 * 
 * 6. **Simplified API**:
 *    - `peer.getChannelWith(peerId, room)` gets channel via room
 *    - `room.onMessage()` and `room.onPresence()` for room events
 *    - `channel.onMessage()` for peer-to-peer messages
 */

export { newApiExample };