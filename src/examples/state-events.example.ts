import { Peer } from '../Peer';
import { InMemorySignalingAdapter } from '../adapters/InMemorySignalingAdapter';

/**
 * Example demonstrating the new state change event system
 */
export async function stateEventsExample() {
  // Create signaling adapter and room
  const signalingAdapter = new InMemorySignalingAdapter();
  const room = new Peer.Room('demo-room', signalingAdapter);
  
  // Create peers
  const alice = new Peer({ peerId: 'Alice' });
  const bob = new Peer({ peerId: 'Bob' });

  // 1. Listen to Peer-level events
  alice.on('roomJoined', ({ room, peerRoom }) => {
    console.log(`Alice joined room: ${room.id}, state: ${peerRoom.state}`);
  });

  alice.on('roomLeft', ({ room, peerRoom }) => {
    console.log(`Alice left room: ${room.id}, state: ${peerRoom.state}`);
  });

  // 2. Listen to Room-level events
  room.on('presence', ({ peer, type }) => {
    console.log(`Room presence: ${peer.id} ${type}`);
  });

  room.on('message', ({ peer, message }) => {
    console.log(`Room message from ${peer.id}:`, message);
  });

  room.on('stateChanged', ({ state }) => {
    console.log(`Room state changed to: ${state}`);
  });

  // 3. Listen to PeerRoom-level events
  const alicePeerRoom = alice.in(room);
  
  alicePeerRoom.on('stateChanged', ({ state }) => {
    console.log(`Alice's PeerRoom state: ${state}`);
  });

  alicePeerRoom.on('peerAdded', ({ peer }) => {
    console.log(`Alice detected new peer: ${peer.id}`);
  });

  alicePeerRoom.on('messageSent', ({ to, message }) => {
    console.log(`Alice sent message to ${to.length} peers:`, message);
  });

  // 4. Listen to RemotePeer-level events (for specific peer connections)
  alicePeerRoom.on('peerAdded', ({ peer }) => {
    // When Alice detects Bob, listen to their connection events
    if (peer.id === 'Bob') {
      peer.on('connectionStateChanged', ({ state }) => {
        console.log(`Alice -> Bob connection state: ${state}`);
      });

      peer.on('dataChannelStateChanged', ({ state }) => {
        console.log(`Alice -> Bob data channel state: ${state}`);
      });

      peer.on('messageReceived', ({ message }) => {
        console.log(`Alice received from Bob:`, message);
      });

      peer.on('messageSent', ({ message }) => {
        console.log(`Alice sent to Bob:`, message);
      });
    }
  });

  // 5. Demonstrate the events by performing actions
  console.log('\n=== Starting Demo ===\n');

  // Join the room
  alice.join(room);
  bob.join(room);

  // Wait for connections to establish
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Send messages
  alice.in(room).sendMessage({ text: 'Hello from Alice!' });
  bob.in(room).sendMessage({ text: 'Hello from Bob!' });

  // Wait for message delivery
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Leave the room
  alice.leave(room);
  bob.leave(room);

  // Mark room as inactive
  room.markInactive();

  console.log('\n=== Demo Complete ===\n');
}

/**
 * Example showing how to use the events for building reactive UIs
 */
export function reactiveUIExample() {
  const signalingAdapter = new InMemorySignalingAdapter();
  const room = new Peer.Room('ui-room', signalingAdapter);
  const peer = new Peer({ peerId: 'UIUser' });

  // Simulate a UI state object
  const uiState = {
    connectionStatus: 'disconnected' as 'disconnected' | 'connecting' | 'connected',
    peers: [] as string[],
    messages: [] as { from: string; text: string; timestamp: Date }[],
    errors: [] as string[]
  };

  // Update UI state based on events
  const peerRoom = peer.in(room);

  // Connection state tracking
  peerRoom.on('stateChanged', ({ state }) => {
    switch (state) {
      case 'joining':
        uiState.connectionStatus = 'connecting';
        break;
      case 'joined':
        uiState.connectionStatus = 'connected';
        break;
      case 'left':
        uiState.connectionStatus = 'disconnected';
        uiState.peers = [];
        break;
    }
    console.log('UI: Connection status:', uiState.connectionStatus);
  });

  // Peer list management
  room.on('presence', ({ peer: eventPeer, type }) => {
    if (eventPeer.id === peer.id) return; // Skip self

    switch (type) {
      case 'join':
      case 'alive':
        if (!uiState.peers.includes(eventPeer.id)) {
          uiState.peers.push(eventPeer.id);
        }
        break;
      case 'leave':
        uiState.peers = uiState.peers.filter(id => id !== eventPeer.id);
        break;
    }
    console.log('UI: Peer list:', uiState.peers);
  });

  // Message handling
  room.on('message', ({ peer: sender, message }) => {
    uiState.messages.push({
      from: sender.id,
      text: (message as any).text || String(message),
      timestamp: new Date()
    });
    console.log('UI: New message from', sender.id);
  });

  // Error handling
  peerRoom.on('peerAdded', ({ peer: remotePeer }) => {
    remotePeer.on('connectionStateChanged', ({ state }) => {
      if (state === 'failed') {
        uiState.errors.push(`Connection to ${remotePeer.id} failed`);
        console.log('UI: Connection error with', remotePeer.id);
      }
    });
  });

  return {
    uiState,
    peerRoom,
    room,
    peer
  };
}

// Usage example:
// const ui = reactiveUIExample();
// ui.peer.join(ui.room);
// ui.peerRoom.sendMessage({ text: 'Hello World!' });