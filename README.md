# 🍯 HoneyPipe

> *Sweet, smooth, and surprisingly simple WebRTC connections*

## 🐝 What's the Buzz?

Ever tried to set up WebRTC and felt like you were wrestling with a swarm of angry bees? Well, grab your beekeeper suit no more! HoneyPipe makes WebRTC connections as smooth as honey sliding off a warm spoon.

### ✨ Why HoneyPipe?

- **🚀 Zero Config Magic** - Just like bees know how to make honey, HoneyPipe knows how to make connections
- **🎯 Straight to the Point** - No more drowning in boilerplate. We handle the sticky stuff
- **🔧 Type-Safe** - TypeScript support out of the box
- **📦 Channel-Based** - Organize your connections like a well-structured hive

## 📦 Installation

```bash
npm install honeypipe
# or
yarn add honeypipe
# or
pnpm add honeypipe
```

## 🛠️ Usage as a Library

### Basic Setup

```typescript
import { Peer, Channel } from 'honeypipe'
import { InMemorySignalingAdapter } from 'honeypipe/adapters'

// Create a signaling adapter (you can also implement your own!)
const signalingAdapter = new InMemorySignalingAdapter()

// Create a channel - think of it as a room where peers can meet
const channel = new Channel<{ type: 'chat', message: string }>('room-123', signalingAdapter)

// Create peers - each peer is like a bee in the hive
const peer1 = new Peer({ peerId: 'alice' })
const peer2 = new Peer({ peerId: 'bob' })

// Connect peers to the channel
await peer1.connect(channel)
await peer2.connect(channel)

// Listen for messages on the channel
channel.onMessage((message) => {
  console.log('Received:', message)
})

// Send messages through the peer
peer1.send(channel, { type: 'chat', message: 'Hello from Alice! 🐝' })
peer2.send(channel, { type: 'chat', message: 'Hey Alice! 👋' })
```

### Type-Safe Channels

```typescript
// Define your message types
interface GameMessage {
  type: 'move' | 'shoot' | 'score'
  playerId: string
  data: any
}

// Create a typed channel
const gameChannel = new Channel<GameMessage>('game-session', signalingAdapter)

// TypeScript knows the message shape!
peer.send(gameChannel, {
  type: 'move',
  playerId: 'alice',
  data: { x: 100, y: 200 }
})
```

### Managing Connections

```typescript
// Check connection states
const connectionState = peer.getConnectionState(channel.id)
const iceState = peer.getIceConnectionState(channel.id)
const dataChannelState = peer.getDataChannelState(channel.id)

// Get all connection states at once
const allStates = peer.getAllConnectionStates()

// Disconnect from a specific channel
await peer.disconnect(channel)

// Or close all connections
await peer.close()
```

### Channel Management

```typescript
// Check how many peers are in a channel
const peerCount = channel.getPeerCount()
console.log(`${peerCount} bees in the hive!`)

// Get all connected peers
const peers = channel.getPeers()

// Check if a specific peer is connected
if (channel.hasPeer('alice')) {
  console.log('Alice is in the channel!')
}

// Stop a channel (disconnects all peers)
await channel.stop()
```

### Real-World Example: Chat Room

```typescript
import { Peer, Channel } from 'honeypipe'
import { InMemorySignalingAdapter } from 'honeypipe/adapters'

interface ChatMessage {
  type: 'message' | 'join' | 'leave'
  userId: string
  content?: string
  timestamp: number
}

class ChatRoom {
  private peer: Peer
  private channel: Channel<ChatMessage>
  
  constructor(userId: string, roomId: string) {
    const signalingAdapter = new InMemorySignalingAdapter()
    
    this.peer = new Peer({ peerId: userId })
    this.channel = new Channel<ChatMessage>(roomId, signalingAdapter)
    
    // Set up message handling
    this.channel.onMessage((message) => {
      switch (message.type) {
        case 'join':
          console.log(`${message.userId} joined the hive! 🐝`)
          break
        case 'message':
          console.log(`${message.userId}: ${message.content}`)
          break
        case 'leave':
          console.log(`${message.userId} flew away 👋`)
          break
      }
    })
  }
  
  async join() {
    await this.peer.connect(this.channel)
    this.broadcast({
      type: 'join',
      userId: this.peer.id,
      timestamp: Date.now()
    })
  }
  
  sendMessage(content: string) {
    this.broadcast({
      type: 'message',
      userId: this.peer.id,
      content,
      timestamp: Date.now()
    })
  }
  
  private broadcast(message: ChatMessage) {
    this.peer.send(this.channel, message)
  }
  
  async leave() {
    this.broadcast({
      type: 'leave',
      userId: this.peer.id,
      timestamp: Date.now()
    })
    await this.peer.disconnect(this.channel)
  }
}

// Usage
const chatRoom = new ChatRoom('alice', 'general-chat')
await chatRoom.join()
chatRoom.sendMessage('Hello everyone! 🍯')
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

## 🍯 API Sweetness

### Custom API Routes

Want to add your own API endpoints? Easy as spreading honey on toast:

```javascript
// playground/server.js
import express from 'express'

export const app = express()

app.get('/buzz', (req, res) => {
  res.json({ message: 'Bzzzzzz! 🐝' })
})

app.post('/collect-nectar', (req, res) => {
  // Your sweet logic here
  res.json({ collected: true, sweetness: 100 })
})
```

### Custom API Prefix

Don't like `/api`? No problem! Configure your own:

```javascript
// vite.config.ts
import { apiPlugin } from './plugins/apiPlugin'

export default defineConfig({
  plugins: [
    apiPlugin({
      prefix: '/hive',  // Now all your APIs live at /hive/*
      app: yourExpressApp
    })
  ]
})
```

## 🎮 Playground

The `/playground` directory is your experimental garden! 🌻

- **WebRTC Debugger** - See your connections in real-time
- **Live Examples** - Copy, paste, and modify to your heart's content
- **Visual Tools** - Because seeing is bee-lieving

## 🏗️ Project Structure

```
honeypipe/
├── 📁 src/              # The queen's chamber (core library)
│   ├── Peer.ts          # Peer class - manages connections
│   ├── Channel.ts       # Channel class - rooms for peers
│   └── adapters/        # Signaling adapters
├── 📁 playground/       # Your experimental garden
│   ├── components/      # React components for testing
│   └── server.js        # Express server for API routes
├── 📁 plugins/          # Vite plugin magic
│   └── apiPlugin.ts     # API integration sorcery
└── 🍯 package.json      # The recipe book
```

## 🐛 Debugging

Having trouble? Check the hive:

1. **Connection Issues?** - Check `peer.getAllConnectionStates()` for diagnostics
2. **Messages not arriving?** - Ensure both peers are connected to the same channel
3. **TypeScript errors?** - Make sure your message types match across peers
4. **Still stuck?** - Create an issue, we don't sting! 🐝

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