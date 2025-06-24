import React, { useEffect, useState, useMemo } from 'react';
import { Peer } from '@honeypipe/client';
import { InMemorySignalingAdapter } from '@honeypipe/client';
import { WebRTCDebugger } from './WebRTCDebugger';
import { motion, AnimatePresence } from 'framer-motion';
  
interface PeerInfo {
  id: string;
  peer: Peer;
  position: { x: number; y: number };
}

interface ChannelInfo {
  id: string;
  channel: Channel<any>;
  peer1Id: string;
  peer2Id: string;
  signalingAdapter: InMemorySignalingAdapter;
}

export const WebRTCDebuggerTest: React.FC = () => {
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [, forceUpdate] = useState({});

  // Calculate peer positions in a circle
  const calculatePeerPositions = (peerCount: number, radius: number = 200) => {
    const centerX = 300;
    const centerY = 300;
    const angleStep = (2 * Math.PI) / Math.max(peerCount, 1);
    
    return Array.from({ length: peerCount }, (_, index) => ({
      x: centerX + radius * Math.cos(index * angleStep - Math.PI / 2),
      y: centerY + radius * Math.sin(index * angleStep - Math.PI / 2)
    }));
  };

  // Generate channels for every pair of peers
  const generateChannels = (peerList: PeerInfo[]): ChannelInfo[] => {
    const newChannels: ChannelInfo[] = [];
    
    for (let i = 0; i < peerList.length; i++) {
      for (let j = i + 1; j < peerList.length; j++) {
        const peer1 = peerList[i];
        const peer2 = peerList[j];
        const channelId = `channel-${peer1.id}-${peer2.id}`;
        const signalingAdapter = new InMemorySignalingAdapter();
        const channel = new Peer.Channel(channelId, signalingAdapter);
        
        newChannels.push({
          id: channelId,
          channel,
          peer1Id: peer1.id,
          peer2Id: peer2.id,
          signalingAdapter
        });
      }
    }
    
    return newChannels;
  };

  // Update peer positions when count changes
  const updatePeerPositions = (peerList: PeerInfo[]) => {
    const positions = calculatePeerPositions(peerList.length);
    return peerList.map((peer, index) => ({
      ...peer,
      position: positions[index]
    }));
  };

  // Add a new peer
  const addPeer = () => {
    const newPeerId = `peer${peers.length + 1}`;
    const newPeer = new Peer({ peerId: newPeerId });
    
    const newPeerInfo: PeerInfo = {
      id: newPeerId,
      peer: newPeer,
      position: { x: 0, y: 0 } // Will be updated below
    };
    
    const updatedPeers = updatePeerPositions([...peers, newPeerInfo]);
    setPeers(updatedPeers);
    
    // Cleanup old channels
    channels.forEach(channelInfo => {
      channelInfo.signalingAdapter.close();
    });
    
    // Generate new channels for all peer pairs
    const newChannels = generateChannels(updatedPeers);
    setChannels(newChannels);
  };

  // Remove the last peer
  const removePeer = () => {
    if (peers.length === 0) return;
    
    const peerToRemove = peers[peers.length - 1];
    peerToRemove.peer.close();
    
    const updatedPeers = updatePeerPositions(peers.slice(0, -1));
    setPeers(updatedPeers);
    
    // Cleanup old channels
    channels.forEach(channelInfo => {
      channelInfo.signalingAdapter.close();
    });
    
    // Generate new channels for remaining peers
    const newChannels = generateChannels(updatedPeers);
    setChannels(newChannels);
  };

  // Initialize with 2 peers
  useEffect(() => {
    // Create initial peers directly to avoid dependency issues
    const createInitialPeers = () => {
      const initialPeers: PeerInfo[] = [
        {
          id: 'peer1',
          peer: new Peer({ peerId: 'peer1' }),
          position: { x: 0, y: 0 }
        },
        {
          id: 'peer2',
          peer: new Peer({ peerId: 'peer2' }),
          position: { x: 0, y: 0 }
        }
      ];
      
      const updatedPeers = updatePeerPositions(initialPeers);
      setPeers(updatedPeers);
      
      const newChannels = generateChannels(updatedPeers);
      setChannels(newChannels);
    };
    
    createInitialPeers();
  }, []);

  useEffect(() => {
    // Set up interval to refresh UI
    const interval = setInterval(() => {
      forceUpdate({});
    }, 500);

    return () => {
      clearInterval(interval);
      // Cleanup all peers and channels
      peers.forEach(peerInfo => peerInfo.peer.close());
      channels.forEach(channelInfo => channelInfo.signalingAdapter.close());
    };
  }, [peers, channels]);

  // Connect all peers to all channels
  const connectAllPeers = async () => {
    if (channels.length === 0 || peers.length < 2) return;
    
    setIsConnecting(true);
    
    try {
      console.log('Starting connections for all peer pairs...');
      
      for (const channelInfo of channels) {
        const peer1 = peers.find(p => p.id === channelInfo.peer1Id);
        const peer2 = peers.find(p => p.id === channelInfo.peer2Id);
        
        if (peer1 && peer2) {
          console.log(`Connecting ${peer1.id} and ${peer2.id} to ${channelInfo.id}`);
          await peer1.peer.connect(channelInfo.channel);
          await peer2.peer.connect(channelInfo.channel);
        }
      }
      
      setIsConnecting(false);
    } catch (error) {
      console.error('Connection failed:', error);
      setIsConnecting(false);
    }
  };

  // Send a test message from the first peer to all channels
  const sendTestMessage = () => {
    if (peers.length === 0 || channels.length === 0) return;
    
    const firstPeer = peers[0];
    channels.forEach(channelInfo => {
      if (channelInfo.peer1Id === firstPeer.id || channelInfo.peer2Id === firstPeer.id) {
        firstPeer.peer.send(channelInfo.channel, { 
          type: 'test', 
          message: `Hello from ${firstPeer.id} at ${new Date().toLocaleTimeString()}` 
        });
      }
    });
  };

  // Stop all channels
  const stopAllChannels = async () => {
    console.log('Stopping all channels...');
    for (const channelInfo of channels) {
      await channelInfo.channel.stop();
    }
    console.log('All channels stopped');
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#111827', 
      color: 'white', 
      padding: '32px',
      position: 'relative'
    }}>
      <div style={{ maxWidth: '100%', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '32px', textAlign: 'center' }}>
          WebRTC Multi-Peer Network Visualizer
        </h1>

        {/* Controls */}
        <div style={{ 
          display: 'flex',
          justifyContent: 'center',
          gap: '16px',
          marginBottom: '32px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={addPeer}
            style={{
              backgroundColor: '#059669',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            + Add Peer
          </button>
          
          <button
            onClick={removePeer}
            disabled={peers.length === 0}
            style={{
              backgroundColor: peers.length === 0 ? '#4b5563' : '#dc2626',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              cursor: peers.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            - Remove Peer
          </button>
          
          <button
            onClick={connectAllPeers}
            disabled={isConnecting || peers.length < 2}
            style={{
              backgroundColor: isConnecting || peers.length < 2 ? '#4b5563' : '#2563eb',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              cursor: isConnecting || peers.length < 2 ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {isConnecting ? 'Connecting...' : 'Connect All'}
          </button>
          
          <button
            onClick={sendTestMessage}
            disabled={peers.length === 0 || channels.length === 0}
            style={{
              backgroundColor: peers.length === 0 || channels.length === 0 ? '#4b5563' : '#7c3aed',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              cursor: peers.length === 0 || channels.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            Send Test Message
          </button>
          
          <button
            onClick={stopAllChannels}
            disabled={channels.length === 0}
            style={{
              backgroundColor: channels.length === 0 ? '#4b5563' : '#f59e0b',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              cursor: channels.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            Stop All Channels
          </button>
        </div>

        {/* Network Stats */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '32px',
          marginBottom: '32px',
          fontSize: '14px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#60a5fa', fontSize: '24px', fontWeight: 'bold' }}>{peers.length}</div>
            <div style={{ color: '#9ca3af' }}>Peers</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#34d399', fontSize: '24px', fontWeight: 'bold' }}>{channels.length}</div>
            <div style={{ color: '#9ca3af' }}>Channels</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#f59e0b', fontSize: '24px', fontWeight: 'bold' }}>
              {channels.reduce((sum, ch) => sum + ch.channel.getPeerCount(), 0)}
            </div>
            <div style={{ color: '#9ca3af' }}>Active Connections</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'row', gap: '20px' }}>
                {/* Network Visualization */}
                <div style={{ 
          display: 'flex',
          justifyContent: 'center',
          position: 'relative'
        }}>
          <svg 
            width="600" 
            height="600" 
            style={{ 
              backgroundColor: '#1f2937', 
              borderRadius: '16px',
              border: '2px solid #374151'
            }}
          >
            {/* Render channels as lines */}
            {channels.map(channelInfo => {
              const peer1 = peers.find(p => p.id === channelInfo.peer1Id);
              const peer2 = peers.find(p => p.id === channelInfo.peer2Id);
              
              if (!peer1 || !peer2) return null;
              
              const isSelected = selectedChannel === channelInfo.id;
              const isActive = channelInfo.channel.getPeerCount() > 0;
              
              return (
                <motion.line
                  key={channelInfo.id}
                  x1={peer1.position.x}
                  y1={peer1.position.y}
                  x2={peer2.position.x}
                  y2={peer2.position.y}
                  stroke={isActive ? '#22c55e' : '#6b7280'}
                  strokeWidth={isSelected ? 4 : 2}
                  strokeDasharray={isActive ? 'none' : '5,5'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedChannel(channelInfo.id)}
                  animate={{
                    strokeWidth: isSelected ? 4 : 2,
                    stroke: isActive ? (isSelected ? '#16a34a' : '#22c55e') : '#6b7280'
                  }}
                  transition={{ duration: 0.2 }}
                />
              );
            })}
            
            {/* Render peers as circles */}
            <AnimatePresence>
              {peers.map((peerInfo, index) => (
                <motion.g
                  key={peerInfo.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <circle
                    cx={peerInfo.position.x}
                    cy={peerInfo.position.y}
                    r="20"
                    fill="#3b82f6"
                    stroke="#1e40af"
                    strokeWidth="3"
                  />
                  <text
                    x={peerInfo.position.x}
                    y={peerInfo.position.y + 35}
                    textAnchor="middle"
                    fill="white"
                    fontSize="12"
                    fontWeight="bold"
                  >
                    {peerInfo.id}
                  </text>
                </motion.g>
              ))}
            </AnimatePresence>
          </svg>
        </div>

        {/* WebRTC Debuggers - Show when hovering over a channel */}
        <AnimatePresence>
          {selectedChannel && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              style={{
                display: 'flex',
                gap: '20px',
                justifyContent: 'center',
                zIndex: 1000,
                pointerEvents: 'none'
              }}
            >
              {(() => {
                const channelInfo = channels.find(ch => ch.id === selectedChannel);
                if (!channelInfo) return null;
                
                const peer1 = peers.find(p => p.id === channelInfo.peer1Id);
                const peer2 = peers.find(p => p.id === channelInfo.peer2Id);
                
                return (
                  <div style={{ display: 'flex', gap: '20px', flexDirection: 'row', alignItems: 'center', maxHeight: '600px', overflowY: 'auto' }}>
                    {peer1 && (
                      <WebRTCDebugger 
                        peer={peer1.peer} 
                        channelId={channelInfo.id} 
                      />
                    )}
                    {peer2 && (
                      <WebRTCDebugger 
                        peer={peer2.peer} 
                        channelId={channelInfo.id} 
                      />
                    )}
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
        </div>

      </div>
    </div>
  );
};