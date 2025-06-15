#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Box, Text, Newline } from 'ink';
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

const ROOM_ID = 'demo-room';

interface LogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'presence' | 'message' | 'channel';
}

interface PeerLogs {
  alice: LogEntry[];
  bob: LogEntry[];
}

// Logger class to capture logs for each peer
class PeerLogger {
  private logs: LogEntry[] = [];
  private onLogUpdate: (logs: LogEntry[]) => void;

  constructor(onLogUpdate: (logs: LogEntry[]) => void) {
    this.onLogUpdate = onLogUpdate;
  }

  log(message: string, type: LogEntry['type'] = 'info') {
    const entry: LogEntry = {
      timestamp: Date.now(),
      message,
      type
    };
    this.logs.push(entry);
    this.onLogUpdate([...this.logs]);
  }

  getLogs() {
    return [...this.logs];
  }
}

const PeerColumn: React.FC<{ title: string; logs: LogEntry[]; color: string }> = ({ title, logs, color }) => {
  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'green';
      case 'warning': return 'yellow';
      case 'presence': return 'blue';
      case 'message': return 'magenta';
      case 'channel': return 'cyan';
      default: return 'white';
    }
  };

  const getTypeIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'presence': return '👥';
      case 'message': return '💬';
      case 'channel': return '📡';
      default: return '🔹';
    }
  };

  return (
    <Box flexDirection="column" width="50%" paddingX={1} borderStyle="round" borderColor={color}>
      <Box>
        <Text bold color={color}>
          {title}
        </Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {logs.slice(-10).map((log, index) => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          return (
            <Box key={index} marginBottom={0}>
              <Text color="gray">{time}</Text>
              <Text> {getTypeIcon(log.type)} </Text>
              <Text color={getLogColor(log.type)}>{log.message}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

const App: React.FC = () => {
  const [logs, setLogs] = useState<PeerLogs>({ alice: [], bob: [] });
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    let aliceLogger: PeerLogger;
    let bobLogger: PeerLogger;

    const startDemo = async () => {
      setStatus('🚀 Starting peer simulation...');

      // Create loggers
      aliceLogger = new PeerLogger((logs) => {
        setLogs(prev => ({ ...prev, alice: logs }));
      });

      bobLogger = new PeerLogger((logs) => {
        setLogs(prev => ({ ...prev, bob: logs }));
      });

      // Create signaling adapter
      const signalingAdapter = new InMemorySignalingAdapter();

      // Create Alice
      aliceLogger.log('Starting Alice...', 'info');
      const alice = new Peer();
      const aliceRoom = new Room(ROOM_ID, signalingAdapter);
      const alicePeerRoom = alice.via(aliceRoom);

      aliceLogger.log(`Peer ID: ${alice.id}`, 'info');

      // Set up Alice's handlers
      alicePeerRoom.onPresence((event) => {
        if (event.peerId === alice.id) return;
        aliceLogger.log(`${event.peerId} ${event.type}ed the room`, 'presence');

        if (event.type === 'join') {
          // Create channel for direct communication
          const channel = alicePeerRoom.getChannel(event.peerId);
          const peerChannel = alice.via(channel);
          
          aliceLogger.log(`Established channel with ${event.peerId}`, 'channel');

          peerChannel.onMessage((message, fromPeerId) => {
            aliceLogger.log(`Direct from ${fromPeerId}: "${message}"`, 'message');
          });

          // Send a welcome message
          setTimeout(() => {
            peerChannel.send(`Hello from Alice! 👋`);
            aliceLogger.log(`Sent direct message to ${event.peerId}`, 'channel');
          }, 1000);
        }
      });

      alicePeerRoom.onMessage((message, fromPeerId) => {
        aliceLogger.log(`Room message from ${fromPeerId}: "${message}"`, 'message');
      });

      // Join Alice to room
      await alicePeerRoom.join();
      aliceLogger.log('Joined room successfully', 'success');

      // Wait a bit before starting Bob
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create Bob
      bobLogger.log('Starting Bob...', 'info');
      const bob = new Peer();
      const bobRoom = new Room(ROOM_ID, signalingAdapter);
      const bobPeerRoom = bob.via(bobRoom);

      bobLogger.log(`Peer ID: ${bob.id}`, 'info');

      // Set up Bob's handlers
      bobPeerRoom.onPresence((event) => {
        if (event.peerId === bob.id) return;
        bobLogger.log(`${event.peerId} ${event.type}ed the room`, 'presence');

        if (event.type === 'join') {
          // Create channel for direct communication
          const channel = bobPeerRoom.getChannel(event.peerId);
          const peerChannel = bob.via(channel);
          
          bobLogger.log(`Established channel with ${event.peerId}`, 'channel');

          peerChannel.onMessage((message, fromPeerId) => {
            bobLogger.log(`Direct from ${fromPeerId}: "${message}"`, 'message');
            
            // Auto-reply to Alice's messages
            setTimeout(() => {
              peerChannel.send(`Thanks Alice! Bob here 🤖`);
              bobLogger.log(`Replied to ${fromPeerId}`, 'channel');
            }, 500);
          });
        }
      });

      bobPeerRoom.onMessage((message, fromPeerId) => {
        bobLogger.log(`Room message from ${fromPeerId}: "${message}"`, 'message');
      });

      // Join Bob to room
      await bobPeerRoom.join();
      bobLogger.log('Joined room successfully', 'success');

      setStatus('🔄 Peers connected, exchanging messages...');

      // Simulate some activity
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Alice broadcasts a message
      alicePeerRoom.broadcast('Hello everyone! 📢');
      aliceLogger.log('Broadcast message sent', 'message');

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Bob responds with broadcast
      bobPeerRoom.broadcast('Hey Alice! Great to meet you! 🎉');
      bobLogger.log('Broadcast response sent', 'message');

      await new Promise(resolve => setTimeout(resolve, 2000));

      // More direct exchanges
      const aliceChannel = alicePeerRoom.getChannel(bob.id);
      const alicePeerChannel = alice.via(aliceChannel);

      alicePeerChannel.send('Want to exchange some more messages? 💬');
      aliceLogger.log('Sent follow-up direct message', 'channel');

      await new Promise(resolve => setTimeout(resolve, 1000));

      const bobChannel = bobPeerRoom.getChannel(alice.id);
      const bobPeerChannel = bob.via(bobChannel);

      bobPeerChannel.send('Absolutely! This is working great! ⚡');
      bobLogger.log('Sent enthusiastic response', 'channel');

      await new Promise(resolve => setTimeout(resolve, 2000));

      setStatus('✅ Demo completed successfully!');

      // Cleanup
      setTimeout(async () => {
        aliceLogger.log('Disconnecting...', 'warning');
        bobLogger.log('Disconnecting...', 'warning');
        
        await alice.close();
        await bob.close();
        await signalingAdapter.close();
        
        aliceLogger.log('Disconnected', 'success');
        bobLogger.log('Disconnected', 'success');
        
        setStatus('🏁 All peers disconnected');
      }, 3000);
    };

    startDemo().catch((error) => {
      setStatus(`❌ Error: ${error.message}`);
    });
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold>🚀 Honeypipe Peer-to-Peer Communication Demo</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text color="blue">{status}</Text>
      </Box>

      <Box flexDirection="row" height={20}>
        <PeerColumn 
          title="👩 Alice" 
          logs={logs.alice} 
          color="green"
        />
        <PeerColumn 
          title="👨 Bob" 
          logs={logs.bob} 
          color="blue"
        />
      </Box>

      <Box marginTop={1}>
        <Text color="gray">
          Watch as peers discover each other through presence events and establish direct communication channels!
        </Text>
      </Box>
    </Box>
  );
};

render(<App />);