import { InMemorySignalingAdapter } from "../src/adapters/InMemorySignalingAdapter";
import { Peer } from "../src/Peer";
import { Room } from "../src/Room";

// Setup WebRTC for Node.js environment
import wrtc from 'wrtc';

// Make WebRTC APIs available globally for Node.js
declare global {
  var RTCPeerConnection: typeof wrtc.RTCPeerConnection;
  var RTCSessionDescription: typeof wrtc.RTCSessionDescription;
  var RTCIceCandidate: typeof wrtc.RTCIceCandidate;
  var RTCDataChannel: typeof wrtc.RTCDataChannel;
}

globalThis.RTCPeerConnection = wrtc.RTCPeerConnection;
globalThis.RTCSessionDescription = wrtc.RTCSessionDescription;
globalThis.RTCIceCandidate = wrtc.RTCIceCandidate;
globalThis.RTCDataChannel = wrtc.RTCDataChannel;

const ROOM_ID = 'test-room-id';

// Simulate independent peer processes
async function createPeerProcess(peerName: string, signalingAdapter: InMemorySignalingAdapter) {
  const peer = new Peer();
  const room = new Room(ROOM_ID, signalingAdapter);
  const peerRoom = peer.via(room);
  
  console.log(`🤖 ${peerName} (${peer.id}) starting up...`);

  // Track discovered peers and their channels
  const discoveredPeers = new Set<string>();
  const channels = new Map<string, any>();

  // Set up presence handler to discover other peers
  peerRoom.onPresence((event) => {
    if (event.peerId === peer.id) return; // Ignore own events

    console.log(`👥 ${peerName} detected presence: ${event.peerId} ${event.type}ed`);

    if (event.type === 'join' && !discoveredPeers.has(event.peerId)) {
      discoveredPeers.add(event.peerId);
      console.log(`🔗 ${peerName} discovered new peer: ${event.peerId}`);
      
      // Create channel for direct communication
      const channel = peerRoom.getChannel(event.peerId);
      const peerChannel = peer.via(channel);
      channels.set(event.peerId, peerChannel);

      // Set up channel message handler
      peerChannel.onMessage((message, fromPeerId) => {
        console.log(`💬 ${peerName} received direct message: "${message}" from ${fromPeerId}`);
      });

      console.log(`📡 ${peerName} established channel with ${event.peerId}`);

      // Send a direct message after establishing channel
      setTimeout(() => {
        peerChannel.send(`Hello ${event.peerId}! This is ${peerName} via direct channel 📡`);
      }, 1000);
    }

    if (event.type === 'leave') {
      discoveredPeers.delete(event.peerId);
      channels.delete(event.peerId);
      console.log(`👋 ${peerName} noted ${event.peerId} left the room`);
    }
  });

  // Set up room message handler
  peerRoom.onMessage((message, fromPeerId) => {
    console.log(`📨 ${peerName} received room message: "${message}" from ${fromPeerId}`);
    
    // Respond to specific messages
    if (message.includes('Hello everyone')) {
      setTimeout(() => {
        peerRoom.broadcast(`Hi there! ${peerName} here! 👋`);
      }, 500);
    }
  });

  // Join the room
  await peerRoom.join();
  console.log(`✅ ${peerName} joined room ${ROOM_ID}`);
  

  return {
    peer,
    peerRoom,
    discoveredPeers,
    channels,
    getName: () => peerName
  };
}

const main = async () => {
  console.log('🚀 Starting independent peer processes simulation...\n');

  // Create shared signaling adapter (simulates signaling server)
  const signalingAdapter = new InMemorySignalingAdapter();

  console.log('🏭 Creating peer processes...');
  
  // Create two independent peer processes with staggered joining
  console.log('👩 Starting Alice...');
  const process1 = await createPeerProcess('Alice', signalingAdapter);
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('👨 Starting Bob...');
  const process2 = await createPeerProcess('Bob', signalingAdapter);
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n⏳ Waiting for peer discovery and connection establishment...');
  

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Check what peers each process discovered
  console.log(`\n🔍 ${process1.getName()} discovered peers: ${Array.from(process1.discoveredPeers).join(', ') || 'none'}`);
  console.log(`🔍 ${process2.getName()} discovered peers: ${Array.from(process2.discoveredPeers).join(', ') || 'none'}`);

  // Simulate independent behaviors
  console.log('\n📢 Simulating independent peer behaviors...');

  // Alice broadcasts a message
  process1.peerRoom.broadcast('Hello everyone! Alice is ready to communicate! 🌟');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Bob responds and then sends a direct message if he knows Alice
  const alicePeerId = process1.peer.id;
  if (process2.discoveredPeers.has(alicePeerId)) {
    console.log(`🎯 ${process2.getName()} sending direct message to Alice...`);
    const aliceChannel = process2.channels.get(alicePeerId);
    if (aliceChannel) {
      aliceChannel.send('Hey Alice! This is Bob sending you a private message! 🤫');
    }
  }
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Alice sends a direct message back to Bob
  const bobPeerId = process2.peer.id;
  if (process1.discoveredPeers.has(bobPeerId)) {
    console.log(`🎯 ${process1.getName()} responding directly to Bob...`);
    const bobChannel = process1.channels.get(bobPeerId);
    if (bobChannel) {
      bobChannel.send('Nice to meet you Bob! Private communication established! ✅');
    }
  }
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Simulate some rapid exchanges
  console.log('\n⚡ Simulating rapid peer-to-peer exchanges...');
  for (let i = 1; i <= 3; i++) {
    // Alice sends via room
    process1.peerRoom.broadcast(`Public message ${i} from Alice 📢`);
    await new Promise(resolve => setTimeout(resolve, 300));

    // Bob responds via direct channel if available
    if (process2.channels.has(alicePeerId)) {
      process2.channels.get(alicePeerId).send(`Private response ${i} from Bob 🔒`);
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Final exchange
  console.log('\n🎊 Final coordination...');
  process1.peerRoom.broadcast('Great demo everyone! Alice signing off 👋');
  await new Promise(resolve => setTimeout(resolve, 500));

  process2.peerRoom.broadcast('Awesome work! Bob signing off too 👋');
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('\n🏁 Simulation completed! Shutting down processes...');

  // Shut down processes independently
  console.log(`🔌 Shutting down ${process1.getName()}...`);
  await process1.peer.close();

  console.log(`🔌 Shutting down ${process2.getName()}...`);
  await process2.peer.close();

  await signalingAdapter.close();
  console.log('✅ All processes terminated successfully!');
};

main()
  .then(() => console.log("\n🎯 SIMULATION COMPLETED!"))
  .catch((error) => console.error('❌ ERROR!', error));