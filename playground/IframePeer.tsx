import React, { useEffect, useState } from 'react';
import { initializePeerInRoom } from './scripts/initalizePeer';

interface Message {
  from: string;
  content: string;
  timestamp: number;
  type: 'room' | 'direct';
}


const params = new URLSearchParams(window.location.search);
const roomId = params.get('room')!;

const { peer, room } = initializePeerInRoom(roomId);
const peerRoom = peer.via(room);



/**
 * IframePeer component - runs inside an iframe and represents a single peer
 */
export function IframePeer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  

  // Connect to room
  useEffect(() => {
    if (!roomId) return;

      console.log(`[${peer.id}] Connecting to room ${roomId}...`);

      // Setup message handlers
      peerRoom.onMessage((message, fromPeerId) => {
        setMessages(prev => [...prev, {
          from: fromPeerId,
          content: message,
          timestamp: Date.now(),
          type: 'room'
        }]);
      });

      // Setup presence handlers
      peerRoom.onPresence((event) => {
        console.log(`[${peer.id}] Presence event:`, event);
        
        if (event.type === 'join') {
          setConnectedPeers(prev => [...prev.filter(p => p !== event.peerId), event.peerId]);
        } else if (event.type === 'leave') {
          setConnectedPeers(prev => prev.filter(p => p !== event.peerId));
        }
      });

      // Join room
      peerRoom.join().then(() => {
        setIsConnected(true);
      }).catch(err => {
        console.error(`Failed to join room:`, err);
        setIsConnected(false);
      });
  }, []);

  const sendMessage = () => {
    peerRoom.broadcast(inputMessage);
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
          <strong>Peer ID:</strong> {peer.id}
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
              backgroundColor: msg.from === peer.id ? '#e3f2fd' : '#f5f5f5',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#666' }}>
              {msg.from === peer.id ? 'You' : msg.from}
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