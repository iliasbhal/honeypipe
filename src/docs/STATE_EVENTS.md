# State Events System

The Honeypipe library now includes a comprehensive state events system that allows you to react to state changes across all major classes: `Room`, `Peer`, `PeerRoom`, and `RemotePeer`.

## Overview

The event system is built on a type-safe `EventEmitter` base class that provides:

- **Type Safety**: Each event has a specific payload type
- **Clear Intent**: Event names describe exactly what changed
- **Easy Consumption**: Developers know exactly what events are available
- **Consistent API**: Same pattern across all classes
- **Memory Management**: Easy subscription disposal and cleanup

## API Methods

All event-enabled classes support these methods:

```typescript
// Subscribe to events
const subscription = object.on('eventName', (event) => {
  console.log('Event received:', event);
});

// Subscribe once (auto-unsubscribe after first call)
object.once('eventName', (event) => {
  console.log('One-time event:', event);
});

// Unsubscribe
subscription.dispose();

// Remove all listeners for an event
object.off('eventName');

// Remove all listeners
object.removeAllListeners();

// Get listener count
const count = object.listenerCount('eventName');

// Get all event names with listeners
const eventNames = object.eventNames();
```

## Events by Class

### Peer Events

```typescript
interface PeerEvents {
  roomJoined: { room: Room; peerRoom: PeerRoom };
  roomLeft: { room: Room; peerRoom: PeerRoom };
  connectionStateChanged: { room: Room; state: 'connecting' | 'connected' | 'disconnected' | 'failed' };
}

// Usage
const peer = new Peer({ peerId: 'alice' });

peer.on('roomJoined', ({ room, peerRoom }) => {
  console.log(`Joined room: ${room.id}, state: ${peerRoom.state}`);
});

peer.on('roomLeft', ({ room, peerRoom }) => {
  console.log(`Left room: ${room.id}`);
});
```

### Room Events

```typescript
interface RoomEvents<MessageType = any> {
  presence: { peer: RemotePeer | Peer; type: 'join' | 'alive' | 'leave' };
  message: { peer: RemotePeer | Peer; message: MessageType };
  stateChanged: { state: 'active' | 'inactive' };
}

// Usage
const room = new Peer.Room('my-room', signalingAdapter);

room.on('presence', ({ peer, type }) => {
  console.log(`${peer.id} ${type} the room`);
});

room.on('message', ({ peer, message }) => {
  console.log(`Message from ${peer.id}:`, message);
});

room.on('stateChanged', ({ state }) => {
  console.log(`Room is now ${state}`);
});
```

### PeerRoom Events

```typescript
interface PeerRoomEvents<MessageType = any> {
  stateChanged: { state: 'idle' | 'joining' | 'joined' | 'leaving' | 'left' };
  peerAdded: { peer: RemotePeer };
  peerRemoved: { peer: RemotePeer };
  connectionEstablished: { peer: RemotePeer };
  connectionLost: { peer: RemotePeer };
  messageReceived: { from: RemotePeer; message: MessageType };
  messageSent: { to: RemotePeer[]; message: MessageType };
}

// Usage
const peerRoom = peer.in(room);

peerRoom.on('stateChanged', ({ state }) => {
  console.log(`PeerRoom state: ${state}`);
});

peerRoom.on('peerAdded', ({ peer }) => {
  console.log(`New peer detected: ${peer.id}`);
});

peerRoom.on('messageSent', ({ to, message }) => {
  console.log(`Sent message to ${to.length} peers`);
});
```

### RemotePeer Events

```typescript
interface RemotePeerEvents<MessageType = any> {
  connectionStateChanged: { state: RTCPeerConnectionState };
  dataChannelStateChanged: { state: RTCDataChannelState };
  messageReceived: { message: MessageType };
  messageSent: { message: MessageType };
  iceConnectionStateChanged: { state: RTCIceConnectionState };
  signalingStateChanged: { state: RTCSignalingState };
}

// Usage
peerRoom.on('peerAdded', ({ peer }) => {
  peer.on('connectionStateChanged', ({ state }) => {
    console.log(`Connection to ${peer.id}: ${state}`);
  });

  peer.on('messageReceived', ({ message }) => {
    console.log(`Message from ${peer.id}:`, message);
  });
});
```

## Real-World Examples

### Building a Reactive UI

```typescript
function createReactiveUI() {
  const signalingAdapter = new InMemorySignalingAdapter();
  const room = new Peer.Room('chat-room', signalingAdapter);
  const peer = new Peer({ peerId: 'user-123' });

  // UI state
  const uiState = {
    connectionStatus: 'disconnected',
    peers: [],
    messages: [],
    errors: []
  };

  // React to state changes
  const peerRoom = peer.in(room);

  peerRoom.on('stateChanged', ({ state }) => {
    uiState.connectionStatus = state === 'joined' ? 'connected' : 'disconnected';
    updateUI();
  });

  room.on('presence', ({ peer, type }) => {
    if (type === 'join') {
      uiState.peers.push(peer.id);
    } else if (type === 'leave') {
      uiState.peers = uiState.peers.filter(id => id !== peer.id);
    }
    updateUI();
  });

  room.on('message', ({ peer, message }) => {
    uiState.messages.push({ from: peer.id, text: message.text, timestamp: new Date() });
    updateUI();
  });

  return { peer, room, peerRoom, uiState };
}
```

### Connection Monitoring

```typescript
function setupConnectionMonitoring(peerRoom) {
  peerRoom.on('peerAdded', ({ peer }) => {
    console.log(`📡 Connecting to ${peer.id}...`);

    peer.on('connectionStateChanged', ({ state }) => {
      switch (state) {
        case 'connecting':
          console.log(`🔄 Connecting to ${peer.id}...`);
          break;
        case 'connected':
          console.log(`✅ Connected to ${peer.id}`);
          break;
        case 'disconnected':
          console.log(`❌ Disconnected from ${peer.id}`);
          break;
        case 'failed':
          console.log(`💥 Connection failed with ${peer.id}`);
          break;
      }
    });

    peer.on('dataChannelStateChanged', ({ state }) => {
      if (state === 'open') {
        console.log(`💬 Ready to chat with ${peer.id}`);
      }
    });
  });
}
```

### Debug Logging

```typescript
function setupDebugLogging(peer, room) {
  // Log all peer events
  peer.on('roomJoined', ({ room }) => console.log(`🚪 Joined ${room.id}`));
  peer.on('roomLeft', ({ room }) => console.log(`🚪 Left ${room.id}`));

  // Log all room events
  room.on('presence', ({ peer, type }) => console.log(`👥 ${peer.id} ${type}`));
  room.on('message', ({ peer, message }) => console.log(`💬 ${peer.id}: ${JSON.stringify(message)}`));

  // Log peerRoom state changes
  const peerRoom = peer.in(room);
  peerRoom.on('stateChanged', ({ state }) => console.log(`📊 PeerRoom: ${state}`));
}
```

## Best Practices

1. **Always dispose subscriptions** when no longer needed to prevent memory leaks
2. **Use specific event names** rather than generic "change" events for better type safety
3. **Handle errors** in event handlers to prevent uncaught exceptions
4. **Use `once()`** for one-time actions like initial connection setup
5. **Group related subscriptions** and dispose them together
6. **Be mindful of async operations** in event handlers

## Migration from Manual Polling

Before:
```typescript
// Manual polling approach
setInterval(async () => {
  const events = await signalingAdapter.pull({ roomId: room.id, offsetIndex: lastIndex });
  // Process events manually...
}, 1000);
```

After:
```typescript
// Event-driven approach
room.on('presence', ({ peer, type }) => {
  // Automatically notified of presence changes
});

room.on('message', ({ peer, message }) => {
  // Automatically notified of new messages
});
```

This event system provides a much more ergonomic and reactive way to build applications with Honeypipe, allowing you to respond to state changes in real-time without manual polling or state checking.