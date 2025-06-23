import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, ArrowUp, Circle, CheckCircle, WarningCircle, Wifi, WifiOff } from 'iconoir-react';
import { Peer, BroadcastChannelAdapter, RemotePeer } from '../../src';

const Container = styled.div`
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  background: #1a1a1a;
  color: #f0f0f0;
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 12px 20px;
  border-bottom: 1px solid #2a2a2a;
  flex-shrink: 0;
  background: #1a1a1a;
`;

const Title = styled.h2`
  font-size: 16px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #f0f0f0;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &::before {
    content: '◆';
    color: #00ff88;
  }
`;

const ConnectionInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 12px;
  color: #808080;
`;

const InfoItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  
  span {
    color: #e0e0e0;
    font-weight: 500;
  }
`;

const TimelineContainer = styled.div`
  position: relative;
  padding: 20px 20px 20px 44px;
  flex: 1;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: #0f0f0f;
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #3a3a3a;
    border-radius: 4px;
    
    &:hover {
      background: #4a4a4a;
    }
  }
`;

const TimelineLine = styled.div`
  position: absolute;
  left: 31px;
  top: 20px;
  bottom: 20px;
  width: 2px;
  background: linear-gradient(to bottom, #00ff88, #00ff8850, transparent);
`;

const EventItem = styled(motion.div)<{ type: string }>`
  position: relative;
  margin-bottom: 16px;
  padding-left: 24px;
`;

const EventDot = styled.div<{ type: string }>`
  position: absolute;
  left: -12px;
  top: 4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #1a1a1a;
  border: 2px solid ${props => {
    switch(props.type) {
      case 'success': return '#00ff88';
      case 'error': return '#ff5555';
      case 'warning': return '#ffaa00';
      case 'info': return '#00aaff';
      default: return '#808080';
    }
  }};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const EventContent = styled.div`
  background: #0f0f0f;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  padding: 12px 16px;
  margin-left: 8px;
`;

const EventHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
`;

const EventType = styled.div<{ type: string }>`
  font-size: 13px;
  font-weight: 600;
  color: ${props => {
    switch(props.type) {
      case 'success': return '#00ff88';
      case 'error': return '#ff5555';
      case 'warning': return '#ffaa00';
      case 'info': return '#00aaff';
      default: return '#808080';
    }
  }};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const EventTime = styled.div`
  font-size: 11px;
  color: #606060;
`;

const EventMessage = styled.div`
  font-size: 13px;
  color: #e0e0e0;
  line-height: 1.5;
`;

const EventData = styled.pre`
  font-size: 11px;
  color: #808080;
  margin-top: 8px;
  padding: 8px;
  background: #0a0a0a;
  border-radius: 4px;
  overflow-x: auto;
  max-width: 100%;
  
  &::-webkit-scrollbar {
    height: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: #0f0f0f;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #3a3a3a;
    border-radius: 3px;
  }
`;

const StatusIndicator = styled.div<{ connected: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: ${props => props.connected ? '#00ff8820' : '#ff555520'};
  border: 1px solid ${props => props.connected ? '#00ff88' : '#ff5555'};
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  color: ${props => props.connected ? '#00ff88' : '#ff5555'};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

interface TimelineEvent {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  eventType: string;
  message: string;
  timestamp: Date;
  data?: any;
}

interface TimelineProps {
  roomId: string;
  peerId: string;
}

export const Timeline: React.FC<TimelineProps> = ({ roomId, peerId }) => {
  const [events, setEvents] = React.useState<TimelineEvent[]>([]);
  const [isConnected, setIsConnected] = React.useState(false);
  const [peer] = React.useState(() => new Peer({ peerId }));
  const [room] = React.useState(() => new Peer.Room(roomId, new BroadcastChannelAdapter()));
  const eventIdCounter = React.useRef(0);

  // Helper function to add events to timeline
  const addEvent = (type: 'success' | 'error' | 'warning' | 'info', eventType: string, message: string, data?: any) => {
    const event: TimelineEvent = {
      id: String(++eventIdCounter.current),
      type,
      eventType,
      message,
      timestamp: new Date(),
      data
    };
    setEvents(prev => [event, ...prev]);
  };

  React.useEffect(() => {
    const otherPeers = new Set<RemotePeer>();
    
    addEvent('info', 'INIT', 'Initializing peer connection', { peerId, roomId });
    addEvent('info', 'ROOM_JOIN', `Joining room: ${roomId}`);
    
    peer.join(room);
    setIsConnected(true);
    addEvent('success', 'ROOM_JOINED', 'Successfully joined room');

    room.on('presence', (event: any) => {
      const remotePeer = event.peer;
      addEvent('info', 'PRESENCE_EVENT', `${remotePeer.id} ${event.type}ed the room`, { peerId: remotePeer.id, type: event.type });
      
      if (remotePeer instanceof RemotePeer) {
        const alreadySeen = otherPeers.has(remotePeer);
        otherPeers.add(remotePeer);
        if (alreadySeen) return;
        
        // DataChannel events
        remotePeer.on('dataChannel', ({ type, event }: any) => {
          switch (type) {
            case 'open':
              addEvent('success', 'DATACHANNEL_OPEN', `Data channel opened with ${remotePeer.id}`, { peerId: remotePeer.id, event });
              break;
            case 'close':
              addEvent('warning', 'DATACHANNEL_CLOSE', `Data channel closed with ${remotePeer.id}`, { peerId: remotePeer.id, event });
              break;
            case 'error':
              addEvent('error', 'DATACHANNEL_ERROR', `Data channel error with ${remotePeer.id}: ${event.error?.message || 'Unknown error'}`, { peerId: remotePeer.id, event });
              break;
            case 'message':
              addEvent('info', 'DATACHANNEL_MESSAGE', `Message received from ${remotePeer.id}`, { peerId: remotePeer.id, data: event.data, event });
              break;
            default:
              addEvent('info', 'DATACHANNEL_EVENT', `Data channel event (${type}) with ${remotePeer.id}`, { peerId: remotePeer.id, type, event });
          }
        });

        // PeerConnection events
        remotePeer.on('peerConnection', ({ type, event }: any) => {
          switch (type) {
            case 'connectionstatechange':
              const state = event.target?.connectionState || 'unknown';
              const eventType = state === 'connected' ? 'success' : state === 'failed' ? 'error' : 'info';
              addEvent(eventType, 'PEER_CONNECTION_STATE', `Connection state with ${remotePeer.id}: ${state}`, { peerId: remotePeer.id, state, event });
              break;
            case 'iceconnectionstatechange':
              const iceState = event.target?.iceConnectionState || 'unknown';
              const iceEventType = iceState === 'connected' || iceState === 'completed' ? 'success' : iceState === 'failed' ? 'error' : 'info';
              addEvent(iceEventType, 'ICE_CONNECTION_STATE', `ICE connection state with ${remotePeer.id}: ${iceState}`, { peerId: remotePeer.id, iceState, event });
              break;
            case 'icegatheringstatechange':
              const gatheringState = event.target?.iceGatheringState || 'unknown';
              addEvent('info', 'ICE_GATHERING_STATE', `ICE gathering state with ${remotePeer.id}: ${gatheringState}`, { peerId: remotePeer.id, gatheringState, event });
              break;
            case 'icecandidate':
              if (event.candidate) {
                addEvent('info', 'ICE_CANDIDATE', `ICE candidate found for ${remotePeer.id}`, { peerId: remotePeer.id, candidate: event.candidate, event });
              } else {
                addEvent('info', 'ICE_GATHERING_COMPLETE', `ICE gathering complete for ${remotePeer.id}`, { peerId: remotePeer.id, event });
              }
              break;
            case 'signalingstatechange':
              const signalingState = event.target?.signalingState || 'unknown';
              addEvent('info', 'SIGNALING_STATE', `Signaling state with ${remotePeer.id}: ${signalingState}`, { peerId: remotePeer.id, signalingState, event });
              break;
            case 'negotiationneeded':
              addEvent('info', 'NEGOTIATION_NEEDED', `Negotiation needed with ${remotePeer.id}`, { peerId: remotePeer.id, event });
              break;
            default:
              addEvent('info', 'PEER_CONNECTION_EVENT', `Peer connection event (${type}) with ${remotePeer.id}`, { peerId: remotePeer.id, type, event });
          }
        });
      }
    });
    
    // Room message events
    room.on('message', (event: any) => {
      addEvent('info', 'ROOM_MESSAGE', `Message from ${event.peer.id}`, { 
        peerId: event.peer.id,
        message: event.message,
        timestamp: event.timestamp,
        event 
      });
    });
    
    // Room error events
    room.on('error', (event: any) => {
      addEvent('error', 'ROOM_ERROR', `Room error: ${event.message || event.error?.message || 'Unknown error'}`, { 
        error: event.error || event,
        event 
      });
    });

    // Cleanup function
    return () => {
      setIsConnected(false);
    };
  }, [roomId, peerId, peer, room]);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'DATACHANNEL_OPEN':
      case 'PEER_CONNECTION_STATE':
      case 'ICE_CONNECTION_STATE':
        return <Wifi width={10} height={10} />;
      case 'DATACHANNEL_CLOSE':
      case 'PEER_DISCONNECTED':
        return <WifiOff width={10} height={10} />;
      case 'DATACHANNEL_MESSAGE':
      case 'ROOM_MESSAGE':
        return <ArrowDown width={10} height={10} />;
      case 'MESSAGE_SENT':
        return <ArrowUp width={10} height={10} />;
      case 'ROOM_JOINED':
      case 'PRESENCE_EVENT':
        return <CheckCircle width={10} height={10} />;
      case 'ROOM_ERROR':
      case 'DATACHANNEL_ERROR':
        return <WarningCircle width={10} height={10} />;
      default:
        return <Circle width={10} height={10} />;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  return (
    <Container>
      <Header>
        <Title>Honeypipe Event Timeline</Title>
        <ConnectionInfo>
          <InfoItem>Room: <span>{roomId}</span></InfoItem>
          <InfoItem>Peer: <span>{peerId}</span></InfoItem>
          <StatusIndicator connected={isConnected}>
            {isConnected ? (
              <>
                <Wifi width={12} height={12} />
                Connected
              </>
            ) : (
              <>
                <WifiOff width={12} height={12} />
                Disconnected
              </>
            )}
          </StatusIndicator>
        </ConnectionInfo>
      </Header>
      
      <TimelineContainer>
        <TimelineLine />
        <AnimatePresence>
          {events.map((event) => (
            <EventItem 
              key={event.id} 
              type={event.type}
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ 
                duration: 0.3, 
                ease: "easeOut",
                scale: { duration: 0.2 }
              }}
              layout
            >
              <EventDot type={event.type}>
                {getEventIcon(event.eventType)}
              </EventDot>
              <EventContent>
                <EventHeader>
                  <EventType type={event.type}>{event.eventType}</EventType>
                  <EventTime>{formatTime(event.timestamp)}</EventTime>
                </EventHeader>
                <EventMessage>{event.message}</EventMessage>
                {event.data && (
                  <EventData>{JSON.stringify(event.data, null, 2)}</EventData>
                )}
              </EventContent>
            </EventItem>
          ))}
        </AnimatePresence>
      </TimelineContainer>
    </Container>
  );
};