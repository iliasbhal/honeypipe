<img src="./assets/readme-hero.svg" />
<div style="margin-bottom: 30px"></div>

# 🍯 HoneyPipe

> _Sweet, smooth, and surprisingly simple WebRTC connections_

## 🐝 What's the Buzz?

Ever tried to set up WebRTC and felt like you were wrestling with a swarm of angry bees? Well, grab your beekeeper suit no more! HoneyPipe makes WebRTC connections as smooth as honey sliding off a warm spoon.

### ✨ Why HoneyPipe?

- **🚀 Zero Config Magic** - Just like bees know how to make honey, HoneyPipe knows how to make connections
- **🎯 Straight to the Point** - No more drowning in boilerplate. We handle the sticky stuff
- **🔧 Type-Safe** - TypeScript support out of the box
- **📦 Room-Based** - Organize your connections like a well-structured hive
- **🌐 P2P Messaging** - Direct peer-to-peer communication with automatic connection management

## 📦 Installation

```bash
npm install @honeypipe/client
# or
yarn add @honeypipe/client
# or
pnpm add @honeypipe/client
```

## 🛠️ Usage as a Library

### Basic Setup

```typescript
import { Peer } from "@honeypipe@/client"
import { InMemorySignalingAdapter } from "honeypipe/adapters"

// Create a signaling adapter (you can also implement your own!)
const signalingAdapter = new InMemorySignalingAdapter()

// Create a room - think of it as a space where peers can meet
const room = new Peer.Room<{ type: "chat"; message: string }>("room-123", signalingAdapter)

// Create peers - each peer is like a bee in the hive
const alice = new Peer({ peerId: "alice" })
const bob = new Peer({ peerId: "bob" })

// Listen for room events
room.on("presence", (event) => {
  console.log(`${event.peer.id} ${event.type}ed the room`)
})

room.on("message", (event) => {
  console.log(`${event.peer.id}:`, event.message)
})

// Join the room
await alice.join(room)
await bob.join(room)

// Get room connection for sending messages
const aliceConnection = alice.in(room)
const bobConnection = bob.in(room)

// Wait for peers to be ready
await aliceConnection.waitForOtherPeers()

// Send messages to all peers in the room
aliceConnection.sendMessage({ type: "chat", message: "Hello from Alice! 🐝" })
bobConnection.sendMessage({ type: "chat", message: "Hey Alice! 👋" })
```

### Type-Safe Rooms

```typescript
// Define your message types
interface GameMessage {
  type: "move" | "shoot" | "score"
  playerId: string
  data: any
}

// Create a typed room
const gameRoom = new Peer.Room<GameMessage>("game-session", signalingAdapter)

// TypeScript knows the message shape!
const connection = player.in(gameRoom)
connection.sendMessage({
  type: "move",
  playerId: "alice",
  data: { x: 100, y: 200 },
})
```

### Managing Connections

```typescript
// Get room connection
const connection = peer.in(room)

// Get all connected peers in the room
const peers = connection.getPeers()

// Get a specific peer
const remotePeer = connection.getPeer("bob")

// Check if a peer's data channel is active
if (remotePeer?.isDataChannelActive()) {
  console.log("Bob is ready to receive messages!")
}

// Wait for a peer to be ready
await remotePeer?.waitForConnectionReady()

// Leave a room
peer.leave(room)
```

### Room Events

```typescript
// Listen for peer presence changes
room.on("presence", (event) => {
  switch (event.type) {
    case "join":
      console.log(`${event.peer.id} joined the room`)
      break
    case "alive":
      console.log(`${event.peer.id} is still active`)
      break
    case "leave":
      console.log(`${event.peer.id} left the room`)
      break
  }
})

// Listen for messages
room.on("message", (event) => {
  console.log(`Message from ${event.peer.id}:`, event.message)
})
```

### Real-World Example: Chat Room

```typescript
import { Peer } from "@honeypipe"
import { InMemorySignalingAdapter } from "honeypipe/adapters"

interface ChatMessage {
  type: "message" | "typing" | "reaction"
  userId: string
  content?: string
  timestamp: number
}

class ChatRoom {
  private peer: Peer
  private room: Peer.Room<ChatMessage>
  private connection: any // RoomConnection<ChatMessage>

  constructor(userId: string, roomId: string) {
    const signalingAdapter = new InMemorySignalingAdapter()

    this.peer = new Peer({ peerId: userId })
    this.room = new Peer.Room<ChatMessage>(roomId, signalingAdapter)

    // Set up event handling
    this.room.on("presence", (event) => {
      if (event.type === "join") {
        console.log(`${event.peer.id} joined the hive! 🐝`)
      } else if (event.type === "leave") {
        console.log(`${event.peer.id} flew away 👋`)
      }
    })

    this.room.on("message", (event) => {
      const message = event.message
      switch (message.type) {
        case "message":
          console.log(`${message.userId}: ${message.content}`)
          break
        case "typing":
          console.log(`${message.userId} is typing...`)
          break
        case "reaction":
          console.log(`${message.userId} reacted: ${message.content}`)
          break
      }
    })
  }

  async join() {
    await this.peer.join(this.room)
    this.connection = this.peer.in(this.room)

    // Wait for other peers before sending messages
    await this.connection.waitForOtherPeers()
  }

  sendMessage(content: string) {
    this.connection.sendMessage({
      type: "message",
      userId: this.peer.id,
      content,
      timestamp: Date.now(),
    })
  }

  sendTypingIndicator() {
    this.connection.sendMessage({
      type: "typing",
      userId: this.peer.id,
      timestamp: Date.now(),
    })
  }

  async leave() {
    this.peer.leave(this.room)
  }
}

// Usage
const chatRoom = new ChatRoom("alice", "general-chat")
await chatRoom.join()
chatRoom.sendMessage("Hello everyone! 🍯")
```

## 🏃‍♂️ Development Setup

```bash
# Clone the hive
git clone https://github.com/yourusername/honeypipe.git

# Enter the colony
cd honeypipe

# Gather the nectar (install dependencies)
yarn install

# Start the development playground
yarn dev
```

## 🍯 Signaling Adapters

HoneyPipe uses signaling adapters to facilitate peer discovery. Choose the one that fits your architecture:

### InMemorySignalingAdapter

Perfect for local development and testing. All peers must share the same adapter instance.

```typescript
import { InMemorySignalingAdapter } from "honeypipe/adapters"

const adapter = new InMemorySignalingAdapter()
```

### FetchSignalingAdapter

For client-server architectures using HTTP polling.

```typescript
import { FetchSignalingAdapter } from "honeypipe/adapters"

const adapter = new FetchSignalingAdapter({
  serverUrl: "https://your-signaling-server.com",
})
```

### PostMessageSignalingAdapter

For iframe-based communication or web workers.

```typescript
import { PostMessageSignalingAdapter } from "honeypipe/adapters"

const adapter = new PostMessageSignalingAdapter({
  target: window.parent,
})
```

### RedisSignalingAdapter

For server-side applications using Redis as a message broker.

```typescript
import { RedisSignalingAdapter } from "honeypipe/adapters"

const adapter = new RedisSignalingAdapter({
  redis: redisClient,
})
```

### Custom Signaling Adapter

Create your own adapter by extending the base class:

```typescript
import { SignalingAdapter } from "honeypipe/adapters"

class CustomSignalingAdapter extends SignalingAdapter {
  async push(event: SignalingEvent): Promise<void> {
    // Send the event to your signaling server
  }

  async pull(config: PullConfig): Promise<SignalingEvent[]> {
    // Retrieve events from your signaling server
  }

  getRtcConfiguration(): RTCConfiguration {
    return {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    }
  }
}
```

## 🎮 Playground

The `/playground` directory is your experimental garden! 🌻

- **WebRTC Debugger** - See your connections in real-time
- **Live Examples** - Copy, paste, and modify to your heart's content
- **Visual Tools** - Because seeing is bee-lieving

## 🏗️ Project Structure

```
honeypipe/
├── 📁 src/                    # The queen's chamber (core library)
│   ├── Peer.ts               # Peer class - manages connections
│   ├── Room.ts               # Room class - spaces for peers
│   ├── RoomConnection.ts     # Room connection manager
│   ├── RemotePeer.ts         # Remote peer connections
│   └── adapters/             # Signaling adapters
│       ├── InMemorySignalingAdapter.ts
│       ├── FetchSignalingAdapter.ts
│       ├── PostMessageSignalingAdapter.ts
│       └── RedisSignalingAdapter.ts
├── 📁 playground/            # Your experimental garden
│   ├── components/           # React components for testing
│   └── debug/               # WebRTC debugging tools
├── 📁 tests/                # Test suites
│   └── index.test.ts        # Core functionality tests
└── 🍯 package.json          # The recipe book
```

## 🐛 Debugging

Having trouble? Check the hive:

1. **Connection Issues?**

   - Ensure peers are using the same room ID and signaling adapter
   - Check if `remotePeer.isDataChannelActive()` returns true before sending messages
   - Use `connection.waitForOtherPeers()` to ensure peers are ready

2. **Messages not arriving?**

   - Verify both peers have joined the same room
   - Check room events with `room.on('message', ...)`
   - Ensure message types match your TypeScript definitions

3. **Peer discovery problems?**

   - Verify your signaling adapter is configured correctly
   - Check `room.on('presence', ...)` events to see peer join/leave activity
   - For production, ensure STUN/TURN servers are configured

4. **TypeScript errors?**

   - Make sure your message types are consistent across all peers
   - Use the generic type parameter: `new Peer.Room<YourMessageType>()`

5. **Still stuck?** - Create an issue, we don't sting! 🐝

## 🤝 Contributing

Found a bug? Got a sweet idea? We love contributions!

1. Fork the hive 🍴
2. Create your feature branch (`git checkout -b feature/amazing-honey`)
3. Commit your changes (`git commit -m 'Add some sweet feature'`)
4. Push to the branch (`git push origin feature/amazing-honey`)
5. Open a Pull Request and let's make this sweeter together!

## 📜 License

MIT - Free as a bee! 🐝

---

<div align="center">
  <h3>🍯 Made with honey and love 🍯</h3>
  <p>Remember: It's actually very very easy to do WebRTC!</p>
  <p>⭐ Star us on GitHub if this made your day sweeter!</p>
</div>
