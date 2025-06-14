import React, { useEffect, useState, useRef } from 'react';
import { Room } from '../src/Room';
import { Peer } from '../src/Peer';
import { PostMessageSignalingAdapter } from '../src/adapters/PostMessageSignalingAdapter';

interface Message {
  from: string;
  content: string;
  timestamp: number;
  type: 'room' | 'direct';
}

/**
 * IframePeer component - runs inside an iframe and represents a single peer
 */
export function IframePeer() {
  const [peerId] = useState(() => `peer-${Math.random().toString(36).substring(2, 8)}`);
  const [messages, setMessages] = useState<Message[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  
  const peerRef = useRef<Peer | null>(null);
  const roomRef = useRef<Room | null>(null);
  const adapterRef = useRef<PostMessageSignalingAdapter | null>(null);

  // Initialize from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setRoomId(room);
    }
  }, []);

  // Connect to room
  useEffect(() => {
    if (!roomId) return;

    async function connect() {
      console.log(`[${peerId}] Connecting to room ${roomId}...`);
      
      // Create PostMessage signaling adapter (communicates with parent)
      const adapter = new PostMessageSignalingAdapter(window.parent, '*');
      adapterRef.current = adapter;

      // Create room
      const room = new Room(roomId!, adapter, {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      roomRef.current = room;

      // Create peer
      const peer = new Peer({ peerId });
      peerRef.current = peer;

      // Setup message handlers
      room.onMessage((message, fromPeerId) => {
        setMessages(prev => [...prev, {
          from: fromPeerId,
          content: message,
          timestamp: Date.now(),
          type: 'room'
        }]);
      });

      // Setup presence handlers
      room.onPresence((event) => {
        console.log(`[${peerId}] Presence event:`, event);
        
        if (event.type === 'join') {
          setConnectedPeers(prev => [...prev.filter(p => p !== event.peerId), event.peerId]);
        } else if (event.type === 'leave') {
          setConnectedPeers(prev => prev.filter(p => p !== event.peerId));
        }
      });

      // Join room
      await peer.joinRoom(room);
      setIsConnected(true);
      
      // Send join message
      room.sendMessage(`${peerId} joined the room!`);
    }

    connect().catch(console.error);

    // Cleanup
    return () => {
      if (peerRef.current && roomRef.current) {
        peerRef.current.leaveRoom(roomRef.current).then(() => {
          peerRef.current?.close();
          adapterRef.current?.close();
        });
      }
    };
  }, [roomId, peerId]);

  const sendMessage = () => {
    if (!inputMessage.trim() || !roomRef.current || !isConnected) return;
    
    roomRef.current.sendMessage(inputMessage);
    
    // Add own message to list
    setMessages(prev => [...prev, {
      from: peerId,
      content: inputMessage,
      timestamp: Date.now(),
      type: 'room'
    }]);
    
    setInputMessage('');
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#f5f5f5',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 15px',
        backgroundColor: '#333',
        color: 'white',
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <strong>Peer ID:</strong> {peerId}
        </div>
        <div>
          <strong>Room:</strong> {roomId || 'Not connected'}
        </div>
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: isConnected ? '#4CAF50' : '#f44336'
        }} />
      </div>

      {/* Connected Peers */}
      <div style={{
        padding: '10px 15px',
        backgroundColor: '#e0e0e0',
        borderBottom: '1px solid #ccc',
        fontSize: '12px'
      }}>
        <strong>Connected Peers:</strong> {connectedPeers.length > 0 ? connectedPeers.join(', ') : 'None'}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        padding: '15px',
        overflowY: 'auto',
        backgroundColor: 'white'
      }}>
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            style={{
              marginBottom: '10px',
              padding: '8px 12px',
              backgroundColor: msg.from === peerId ? '#e3f2fd' : '#f5f5f5',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#666' }}>
              {msg.from === peerId ? 'You' : msg.from}
            </div>
            <div>{msg.content}</div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{
        padding: '15px',
        borderTop: '1px solid #ccc',
        display: 'flex',
        gap: '10px'
      }}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
          disabled={!isConnected}
        />
        <button
          onClick={sendMessage}
          disabled={!isConnected || !inputMessage.trim()}
          style={{
            padding: '8px 20px',
            backgroundColor: isConnected ? '#2196F3' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isConnected ? 'pointer' : 'not-allowed',
            fontSize: '14px'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}