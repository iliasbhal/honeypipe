import React, { useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { motion, AnimatePresence } from 'framer-motion'
import { InMemorySignalingAdapter } from '../src/adapters/InMemorySignalingAdapter'
import { Peer } from '../src/Peer'
import { Room } from '../src/Room'

const ROOM_ID = 'demo-room'

interface ActorSnapshot {
  id: string
  state: string
  context?: any
  children?: ActorSnapshot[]
}

interface PeerDebuggerProps {
  peer: Peer
  room: Room
  name: string
  color: string
}

interface SignalingDebuggerProps {
  signalingAdapter: InMemorySignalingAdapter
}

const SignalingDebugger: React.FC<SignalingDebuggerProps> = ({ signalingAdapter }) => {
  const [roomEvents, setRoomEvents] = useState<any[]>([])
  const [channelEvents, setChannelEvents] = useState<any[]>([])

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const redis = (signalingAdapter as any).redis
        if (redis) {
          const keys = await redis.keys('*:timeline')
          const roomEventsData: any[] = []
          const channelEventsData: any[] = []
          
          for (const key of keys) {
            const eventStrings = await redis.lrange(key, 0, -1)
            const events = eventStrings.map((str: string, index: number) => {
              const event = JSON.parse(str)
              return { ...event, index }
            })
            
            // Separate room events from channel events based on the redis key
            if (key.startsWith('room:')) {
              roomEventsData.push(...events)
            } else if (key.startsWith('channel:')) {
              channelEventsData.push(...events)
            }
          }
          
          // // Sort by timestamp
          // roomEventsData.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
          // channelEventsData.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
          
          setRoomEvents(roomEventsData)
          setChannelEvents(channelEventsData)
        }
      } catch (error) {
        console.warn('Could not access signaling events:', error)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [signalingAdapter])

  const getEventTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      'sdpOffer': '#f59e0b',
      'sdpAnswer': '#10b981',
      'iceCandidate': '#06b6d4',
      'join': '#3b82f6',
      'leave': '#ef4444',
      'presence': '#8b5cf6'
    }
    return colors[type] || '#6b7280'
  }

  const renderEventsList = (events: any[], title: string, emptyMessage: string) => (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0
    }}>
      <h4 style={{
        fontWeight: '600',
        color: '#d1d5db',
        fontSize: '14px',
        margin: '0 0 8px 0',
        padding: '0 16px'
      }}>
        {title} ({events.length})
      </h4>
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '0 16px 16px 16px'
      }}>
        {/* <AnimatePresence> */}
          {events.reverse().map((event, idx) => (
            <motion.div
              key={`${event.timestamp}-${idx}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              style={{
                marginBottom: '6px',
                padding: '6px',
                backgroundColor: '#1f2937',
                borderRadius: '4px',
                border: `1px solid ${getEventTypeColor(event.type)}`,
                boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <motion.div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: getEventTypeColor(event.type)
                  }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <span style={{
                  color: getEventTypeColor(event.type),
                  fontWeight: 'bold',
                  fontSize: '10px'
                }}>
                  {event.type}
                </span>
                <span style={{ color: '#6b7280', fontSize: '9px', marginLeft: 'auto' }}>
                  {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : 'now'}
                </span>
              </div>
              
              <div style={{ fontSize: '9px', color: '#9ca3af' }}>
                {event.channelId && (
                  <div style={{ marginBottom: '1px' }}>
                    <span style={{ color: '#6b7280' }}>Channel:</span>{' '}
                    <span style={{ color: '#d1d5db' }}>{event.channelId}</span>
                  </div>
                )}
                {event.roomId && (
                  <div style={{ marginBottom: '1px' }}>
                    <span style={{ color: '#6b7280' }}>Room:</span>{' '}
                    <span style={{ color: '#d1d5db' }}>{event.roomId}</span>
                  </div>
                )}
                <div style={{ marginBottom: '1px' }}>
                  <span style={{ color: '#6b7280' }}>From:</span>{' '}
                  <span style={{ color: '#d1d5db' }}>{event.peerId}</span>
                </div>
                {event.index !== undefined && (
                  <div>
                    <span style={{ color: '#6b7280' }}>Index:</span>{' '}
                    <span style={{ color: '#d1d5db' }}>{event.index}</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {events.length === 0 && (
            <div style={{
              textAlign: 'center',
              color: '#6b7280',
              padding: '16px',
              fontSize: '10px'
            }}>
              {emptyMessage}
            </div>
          )}
        {/* </AnimatePresence> */}
      </div>
    </div>
  )

  return (
    <div style={{
      width: '300px',
      backgroundColor: '#111827',
      borderRadius: '8px',
      border: '2px solid #fbbf24',
      overflow: 'hidden',
      margin: '10px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #374151',
        backgroundColor: '#1f2937'
      }}>
        <h3 style={{
          fontWeight: 'bold',
          fontSize: '18px',
          margin: 0,
          color: '#fbbf24',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          📡 Signaling Events
        </h3>
        <p style={{ color: '#9ca3af', margin: '4px 0 0 0', fontSize: '12px' }}>
          Room: {roomEvents.length} | Channel: {channelEvents.length}
        </p>
      </div>

      {/* Room Events */}
      {renderEventsList(roomEvents, "🏠 Room Events", "No room events yet")}
      
      {/* Divider */}
      <div style={{ borderTop: '1px solid #374151', margin: '0 16px' }} />
      
      {/* Channel Events */}
      {renderEventsList(channelEvents, "🔗 Channel Events", "No channel events yet")}
    </div>
  )
}

const PeerDebugger: React.FC<PeerDebuggerProps> = ({ peer, room, name, color }) => {
  const [actors, setActors] = useState<ActorSnapshot[]>([])
  const [messages, setMessages] = useState<string[]>([])
  const [eventHistory, setEventHistory] = useState<any[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const peerRoom = peer.via(room)
    
    // Set up message handlers
    peerRoom.onMessage((message, fromPeerId) => {
      setMessages(prev => [...prev, `📨 Room msg from ${fromPeerId}: "${message}"`])
    })

    peerRoom.onPresence((event) => {
      if (event.peerId !== peer.id) {
        setMessages(prev => [...prev, `👥 ${event.peerId} ${event.type}ed the room`])
        
        if (event.type === 'join') {
          // Create channel for direct communication
          const channel = peerRoom.getChannel(event.peerId)
          const peerChannel = peer.via(channel)
          
          peerChannel.onMessage((message, fromPeerId) => {
            setMessages(prev => [...prev, `📱 Direct from ${fromPeerId}: "${message}"`])
          })
        }
      }
    })

    // Join the room
    peerRoom.join().then(() => {
      setIsConnected(true)
      setMessages(prev => [...prev, '✅ Joined room successfully'])
    })

    // Update actors state periodically
    const interval = setInterval(() => {
      const roomActor = (peer as any).getRoomConnectionActor(ROOM_ID)
      if (roomActor) {
        const snapshot = roomActor.getSnapshot()
        const actorTree: ActorSnapshot[] = [{
          id: 'HoneyRoomConnection',
          state: String(snapshot.value),
          context: {
            alivePeers: Array.from(snapshot.context.alivePeers || []),
            peerConnections: Array.from(snapshot.context.peerConnections?.keys() || [])
          },
          children: []
        }]

        // Add peer connection actors and collect event history
        let allEventHistory: any[] = []
        if (snapshot.context.peerConnections) {
          snapshot.context.peerConnections.forEach((peerActor: any, peerId: string) => {
            const peerSnapshot = peerActor.getSnapshot()
            
            // Collect event history from this peer connection
            if (peerSnapshot.context.eventHistory) {
              allEventHistory = [...allEventHistory, ...peerSnapshot.context.eventHistory]
            }
            
            actorTree.push({
              id: `HoneyPeerConnection:${peerId}`,
              state: String(peerSnapshot.value),
              context: {
                remotePeerId: peerSnapshot.context.remotePeerId,
                isInitiator: peerSnapshot.context.isInitiator,
                eventHistoryCount: peerSnapshot.context.eventHistory?.length || 0
              }
            })
          })
        }

        // Update event history state
        setEventHistory(allEventHistory)

        // Add presence signal actor
        if (snapshot.context.presenceSignalActorRef) {
          const presenceSnapshot = snapshot.context.presenceSignalActorRef.getSnapshot()
          actorTree[0].children?.push({
            id: 'HoneyRoomSignal',
            state: String(presenceSnapshot.value),
            context: {
              lastSeenIndex: presenceSnapshot.context.lastSeenIndex
            }
          })
        }

        setActors(actorTree)
      }
    }, 100)

    return () => {
      clearInterval(interval)
      peerRoom.leave()
    }
  }, [peer, room])

  const getStateColor = (state: string): string => {
    const stateColors: Record<string, string> = {
      connected: '#22c55e',
      connecting: '#fbbf24',
      disconnected: '#f97316',
      failed: '#ef4444',
      idle: '#6b7280',
      initializing: '#3b82f6',
      initiating: '#8b5cf6',
      waitingForOffer: '#fbbf24',
      waitingForAnswer: '#f59e0b',
      processingOffer: '#3b82f6',
      active: '#22c55e',
      polling: '#3b82f6',
      stopped: '#6b7280'
    }
    return stateColors[state] || '#9ca3af'
  }

  const renderActor = (actor: ActorSnapshot, depth: number = 0) => (
    <motion.div
      key={actor.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        // marginLeft: `${depth * 20}px`,
        // marginBottom: '8px',
        backgroundColor: '#1f2937',
        borderRadius: '6px',
        padding: '12px',
        border: `1px solid ${getStateColor(actor.state)}`,
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <motion.div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: getStateColor(actor.state)
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
        <span style={{ fontWeight: 'bold', color: '#e5e7eb', fontSize: '13px' }}>{actor.id}</span>
        <span style={{ color: '#9ca3af' }}>→</span>
        <span style={{ color: getStateColor(actor.state), fontWeight: '600' }}>
          {JSON.stringify(actor.state)}
        </span>
      </div>
      
      {actor.context && (
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
          {Object.entries(actor.context).map(([key, value]) => (
            <div key={key} style={{ marginBottom: '2px' }}>
              <span style={{ color: '#6b7280' }}>{key}:</span>{' '}
              <span style={{ color: '#d1d5db' }}>
                {Array.isArray(value) ? `[${value.join(', ')}]` : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {actor.children && actor.children.map(child => renderActor(child, depth + 1))}
    </motion.div>
  )

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#111827',
      borderRadius: '8px',
      border: `2px solid ${color}`,
      overflow: 'hidden',
      margin: '10px'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #374151',
        backgroundColor: '#1f2937'
      }}>
        <h3 style={{
          fontWeight: 'bold',
          fontSize: '18px',
          margin: 0,
          color: color,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {name}
          {isConnected && (
            <span style={{
              fontSize: '12px',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: '#065f46',
              color: '#34d399'
            }}>
              CONNECTED
            </span>
          )}
        </h3>
        <p style={{ color: '#9ca3af', margin: '4px 0 0 0', fontSize: '12px' }}>
          Peer ID: {peer.id}
        </p>
      </div>

      {/* State Machines */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px',
        minHeight: '300px'
      }}>
        <h4 style={{
          fontWeight: '600',
          color: '#d1d5db',
          fontSize: '14px',
          marginBottom: '12px'
        }}>
          State Machines
        </h4>
        <AnimatePresence>
          {actors.map(actor => renderActor(actor))}
        </AnimatePresence>
      </div>

      {/* Event History */}
      <div style={{
        borderTop: '1px solid #374151',
        padding: '16px',
        backgroundColor: '#0f172a',
        maxHeight: '150px',
        overflow: 'auto'
      }}>
        <h4 style={{
          fontWeight: '600',
          color: '#d1d5db',
          fontSize: '14px',
          marginBottom: '8px'
        }}>
          Event History ({eventHistory.length})
        </h4>
        <div style={{ fontSize: '11px', fontFamily: 'monospace' }}>
          {eventHistory.map((event, idx) => (
            <div key={idx} style={{ 
              marginBottom: '4px', 
              padding: '4px 8px',
              backgroundColor: '#1f2937',
              borderRadius: '3px',
              border: `1px solid ${event.type === 'sdpOffer' ? '#f59e0b' : event.type === 'sdpAnswer' ? '#10b981' : '#6b7280'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ 
                  color: event.type === 'sdpOffer' ? '#fbbf24' : event.type === 'sdpAnswer' ? '#34d399' : '#9ca3af',
                  fontWeight: 'bold'
                }}>
                  {event.type}
                </span>
                <span style={{ color: '#6b7280', fontSize: '10px' }}>
                  from: {event.peerId}
                </span>
              </div>
              {event.index && (
                <div style={{ color: '#6b7280', fontSize: '10px' }}>
                  index: {event.index}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        borderTop: '1px solid #374151',
        padding: '16px',
        backgroundColor: '#0f172a',
        maxHeight: '150px',
        overflow: 'auto'
      }}>
        <h4 style={{
          fontWeight: '600',
          color: '#d1d5db',
          fontSize: '14px',
          marginBottom: '8px'
        }}>
          Messages
        </h4>
        <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ marginBottom: '4px', color: '#e5e7eb' }}>
              {new Date().toLocaleTimeString()} {msg}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  )
}

function App() {
  const [peer1] = useState(() => new Peer({ peerId: 'alice' }))
  const [peer2] = useState(() => new Peer({ peerId: 'bob' }))
  const [signalingAdapter] = useState(() => new InMemorySignalingAdapter())
  const [room1] = useState(() => new Room(ROOM_ID, signalingAdapter))
  const [room2] = useState(() => new Room(ROOM_ID, signalingAdapter))
  const [showDemo, setShowDemo] = useState(false)

  React.useEffect(() => {
    setShowDemo(true);
  },[])

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#030712',
      color: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>

      {/* Main Content */}
      {showDemo && (
        <div style={{
          flex: 1,
          display: 'flex',
          padding: '20px',
          gap: '20px',
          overflow: 'hidden'
        }}>
          <PeerDebugger
            peer={peer1}
            room={room1}
            name="Alice"
            color="#22c55e"
          />
          <SignalingDebugger
            signalingAdapter={signalingAdapter}
          />
          <PeerDebugger
            peer={peer2}
            room={room2}
            name="Bob"
            color="#3b82f6"
          />
        </div>
      )}
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)