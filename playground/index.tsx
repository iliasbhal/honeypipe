import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { IframePeer } from './IframePeer'
import { FetchAdapterDemo } from './FetchAdapterDemo'

// This will be detected via URL params instead

function PeerView() {
  return <IframePeer />;
}

function MainPlayground() {
  const [activeTab, setActiveTab] = useState<'iframe' | 'fetch'>('iframe');
  const [roomId] = useState(() => `room-${Math.random().toString(36).substring(2, 8)}`);
  const [messages, setMessages] = useState<Array<{ source: string; data: any }>>([]);

  useEffect(() => {
    // Listen for messages from iframes
    const handleMessage = (event: MessageEvent) => {
      // Log all messages for debugging
      setMessages(prev => [...prev, {
        source: event.origin,
        data: event.data
      }]);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div style={{ 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #ddd',
        padding: '0'
      }}>
        <button
          onClick={() => setActiveTab('iframe')}
          style={{
            padding: '15px 30px',
            border: 'none',
            backgroundColor: activeTab === 'iframe' ? 'white' : 'transparent',
            borderBottom: activeTab === 'iframe' ? '2px solid #1976d2' : 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'iframe' ? 'bold' : 'normal',
            color: activeTab === 'iframe' ? '#1976d2' : '#666'
          }}
        >
          Iframe Demo
        </button>
        <button
          onClick={() => setActiveTab('fetch')}
          style={{
            padding: '15px 30px',
            border: 'none',
            backgroundColor: activeTab === 'fetch' ? 'white' : 'transparent',
            borderBottom: activeTab === 'fetch' ? '2px solid #1976d2' : 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'fetch' ? 'bold' : 'normal',
            color: activeTab === 'fetch' ? '#1976d2' : '#666'
          }}
        >
          Fetch Adapter Demo
        </button>
      </div>

      {/* Content */}
      {activeTab === 'iframe' ? (
        <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#f0f0f0',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        backgroundColor: '#2196F3',
        color: 'white',
        textAlign: 'center'
      }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>
          🍯 HoneyPipe Cross-Iframe Demo
        </h1>
        <p style={{ margin: '10px 0 0 0', opacity: 0.9 }}>
          Room ID: <strong>{roomId}</strong>
        </p>
      </div>

      {/* Main Content */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        gap: '20px', 
        padding: '20px' 
      }}>
        {/* Peer 1 */}
        <div style={{ 
          flex: 1, 
          backgroundColor: 'white', 
          borderRadius: '8px', 
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '15px',
            backgroundColor: '#4CAF50',
            color: 'white',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            Peer 1
          </div>
          <iframe
            src={`?room=${roomId}&iframe=true`}
            style={{
              width: '100%',
              height: 'calc(100% - 50px)',
              border: 'none'
            }}
            title="Peer 1"
          />
        </div>

        {/* Peer 2 */}
        <div style={{ 
          flex: 1, 
          backgroundColor: 'white', 
          borderRadius: '8px', 
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '15px',
            backgroundColor: '#FF9800',
            color: 'white',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            Peer 2
          </div>
          <iframe
            src={`?room=${roomId}&iframe=true`}
            style={{
              width: '100%',
              height: 'calc(100% - 50px)',
              border: 'none'
            }}
            title="Peer 2"
          />
        </div>
      </div>

      {/* Debug Panel */}
      <div style={{
        height: '200px',
        backgroundColor: '#333',
        color: 'white',
        padding: '15px',
        overflowY: 'auto',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}>
        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
          📡 SignalingAdapter Messages ({messages.length})
        </div>
        {messages.slice(-50).map((msg, idx) => (
          <div key={idx} style={{ marginBottom: '5px', opacity: 0.8 }}>
            <span style={{ color: '#4CAF50' }}>{new Date().toLocaleTimeString()}</span> {' '}
            <span style={{ color: '#81C784' }}>{msg.source}</span> {' '}
            {JSON.stringify(msg.data)}
          </div>
        ))}
      </div>
    </div>
      ) : (
        <FetchAdapterDemo />
      )}
    </div>
  );
}

function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const isInIframe = urlParams.has('iframe');
  
  if (isInIframe) {
    return <PeerView />;
  }
  
  return <MainPlayground />;
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)