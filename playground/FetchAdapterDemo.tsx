import React, { useState, useEffect, useRef } from 'react';
import { Peer } from '../src/Peer';
import { Room } from '../src/Room';
import { FetchSignalingAdapter } from '../src/adapters/FetchSignalingAdapter';

export function FetchAdapterDemo() {
  const [messages, setMessages] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, string>>({});
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const roomRef = useRef<Room | null>(null);
  
  useEffect(() => {
    // Initialize the demo
    initializeDemo();
    
    return () => {
      // Cleanup
      peersRef.current.forEach(peer => peer.close());
    };
  }, []);
  
  const initializeDemo = async () => {
    try {
      // Clear any existing events on the server
      await fetch('/api/signaling/clear', { method: 'POST' });
      
      // Create a fetch signaling adapter
      const signalingAdapter = new FetchSignalingAdapter({
        pushUrl: 'http://localhost:5173/api/signaling/push',
        pullUrl: 'http://localhost:5173/api/signaling/pull',
        timeout: 5000
      });
      
      // Create a room
      const room = new Room('demo-room', signalingAdapter);
      roomRef.current = room;
      
      // Create Alice
      const alice = new Peer({ peerId: 'alice' });
      peersRef.current.set('alice', alice);
      
      // Set up message handler for room broadcasts
      room.onMessage((message, fromPeerId) => {
        setMessages(prev => [...prev, `[Room] ${fromPeerId}: ${message}`]);
      });
      
      // Set up presence handler
      room.onPresence((event) => {
        setMessages(prev => [...prev, `[Presence] ${event.peerId} ${event.type}`]);
        setConnectionStatus(prev => ({
          ...prev,
          [event.peerId]: event.type === 'leave' ? 'disconnected' : 'connected'
        }));
      });
      
      // Alice joins the room
      await alice.joinRoom(room);
      setConnectionStatus(prev => ({ ...prev, alice: 'connected' }));
      
      // Create Bob after a delay
      setTimeout(async () => {
        const bob = new Peer({ peerId: 'bob' });
        peersRef.current.set('bob', bob);
        
        await bob.joinRoom(room);
        setConnectionStatus(prev => ({ ...prev, bob: 'connected' }));
        
        // Bob sends a broadcast message
        setTimeout(() => {
          bob.sendMessage(room, 'Hello everyone from Bob!', { broadcast: true });
        }, 1000);
        
        // Alice responds with a direct message
        setTimeout(() => {
          alice.sendMessage(room, 'Hi Bob, this is Alice!', { peerId: 'bob' });
          setMessages(prev => [...prev, '[Direct] alice -> bob: Hi Bob, this is Alice!']);
        }, 2000);
        
        // Create a channel between Alice and Bob
        setTimeout(async () => {
          const channel = alice.getChannelWith('bob', room);
          
          // Set up channel message handler
          channel.onMessage((message, fromPeerId) => {
            setMessages(prev => [...prev, `[Channel] ${fromPeerId}: ${message}`]);
          });
          
          // Send messages through the channel
          alice.sendMessage(channel, 'Private message to Bob via channel');
          
          setTimeout(() => {
            bob.sendMessage(channel, 'Private reply from Bob via channel');
          }, 500);
        }, 3000);
      }, 1000);
      
    } catch (error) {
      console.error('Demo initialization error:', error);
      setMessages(prev => [...prev, `Error: ${error.message}`]);
    }
  };
  
  const viewDebugInfo = async () => {
    try {
      const response = await fetch('/api/signaling/debug');
      const debug = await response.json();
      console.log('Signaling Debug Info:', debug);
      setMessages(prev => [...prev, `[Debug] Check console for signaling timeline`]);
    } catch (error) {
      console.error('Debug fetch error:', error);
    }
  };
  
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>Fetch Signaling Adapter Demo</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Connection Status</h3>
        {Object.entries(connectionStatus).map(([peerId, status]) => (
          <div key={peerId}>
            {peerId}: <span style={{ color: status === 'connected' ? 'green' : 'red' }}>{status}</span>
          </div>
        ))}
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={viewDebugInfo}>View Debug Info (Console)</button>
      </div>
      
      <div>
        <h3>Messages</h3>
        <div style={{ 
          border: '1px solid #ccc', 
          padding: '10px', 
          height: '300px', 
          overflowY: 'auto',
          backgroundColor: '#f5f5f5'
        }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ marginBottom: '5px' }}>{msg}</div>
          ))}
        </div>
      </div>
    </div>
  );
}