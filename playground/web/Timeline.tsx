import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, Circle, CheckCircle, WarningCircle, Wifi, WifiOff, NavArrowDown, NavArrowRight, Send } from 'iconoir-react';
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
  padding: 20px;
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
`;

const EventContent = styled.div`
  background: #0f0f0f;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  padding: 12px 16px;
  margin-left: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #121212;
    border-color: #3a3a3a;
  }
`;

const EventHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
`;

const EventHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
`;

const SourceTag = styled.div<{ source: string }>`
  font-size: 9px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: ${props => {
    switch(props.source) {
      case 'DataChannel': return '#00ff8820';
      case 'PeerConnection': return '#00aaff20';
      case 'Room': return '#ffaa0020';
      case 'System': return '#80808020';
      default: return '#80808020';
    }
  }};
  color: ${props => {
    switch(props.source) {
      case 'DataChannel': return '#00ff88';
      case 'PeerConnection': return '#00aaff';
      case 'Room': return '#ffaa00';
      case 'System': return '#808080';
      default: return '#808080';
    }
  }};
  border: 1px solid ${props => {
    switch(props.source) {
      case 'DataChannel': return '#00ff8840';
      case 'PeerConnection': return '#00aaff40';
      case 'Room': return '#ffaa0040';
      case 'System': return '#80808040';
      default: return '#80808040';
    }
  }};
`;

const ExpandIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  color: #606060;
  transition: transform 0.2s ease;
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

const EventData = styled.pre<{ isExpanded: boolean }>`
  font-size: 11px;
  color: #808080;
  margin-top: 8px;
  padding: 8px;
  background: #0a0a0a;
  border-radius: 4px;
  overflow-x: auto;
  max-width: 100%;
  max-height: ${props => props.isExpanded ? '400px' : '60px'};
  overflow-y: ${props => props.isExpanded ? 'auto' : 'hidden'};
  position: relative;
  transition: max-height 0.3s ease;
  
  ${props => !props.isExpanded && `
    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 20px;
      background: linear-gradient(transparent, #0a0a0a);
      pointer-events: none;
    }
  `}
  
  &::-webkit-scrollbar {
    height: 6px;
    width: 6px;
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

const DataChannelZone = styled.div`
  background: #0f0f0f;
  border-top: 1px solid #2a2a2a;
  padding: 16px 20px;
  flex-shrink: 0;
`;

const DataChannelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const DataChannelTitle = styled.h3`
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #f0f0f0;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &::before {
    content: '▪';
    color: #00aaff;
  }
`;

const ConnectionStatusList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
`;

const ConnectionStatus = styled.div<{ state: string }>`
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  background: ${props => {
    switch(props.state) {
      case 'connected': return '#00ff8820';
      case 'connecting': return '#ffaa0020';
      case 'failed': 
      case 'closed': return '#ff555520';
      default: return '#80808020';
    }
  }};
  border: 1px solid ${props => {
    switch(props.state) {
      case 'connected': return '#00ff8840';
      case 'connecting': return '#ffaa0040';
      case 'failed':
      case 'closed': return '#ff555540';
      default: return '#80808040';
    }
  }};
  color: ${props => {
    switch(props.state) {
      case 'connected': return '#00ff88';
      case 'connecting': return '#ffaa00';
      case 'failed':
      case 'closed': return '#ff5555';
      default: return '#808080';
    }
  }};
`;

const MessageInputContainer = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const MessageInput = styled.input`
  flex: 1;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  color: #f0f0f0;
  font-family: inherit;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #00aaff;
    background: #1e1e1e;
  }
  
  &::placeholder {
    color: #606060;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SendButton = styled.button`
  background: #00aaff;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #0a0a0a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background: #00ccff;
    transform: translateY(-1px);
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ChannelSelector = styled.select`
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  color: #f0f0f0;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 200px;
  
  &:focus {
    outline: none;
    border-color: #00aaff;
    background: #1e1e1e;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  option {
    background: #1a1a1a;
    color: #f0f0f0;
    padding: 8px;
  }
`;

interface TimelineEvent {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  eventType: string;
  source: 'DataChannel' | 'PeerConnection' | 'Room' | 'System';
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
  const [expandedEvents, setExpandedEvents] = React.useState<Set<string>>(new Set());
  const [peer] = React.useState(() => new Peer({ peerId }));
  const [room] = React.useState(() => new Peer.Room(roomId, new BroadcastChannelAdapter()));
  const eventIdCounter = React.useRef(0);
  const [messageInput, setMessageInput] = React.useState('');
  const [dataChannels, setDataChannels] = React.useState<Map<string, { channel: RTCDataChannel, state: string, peer: RemotePeer, label?: string }>>(new Map());
  const [selectedChannelId, setSelectedChannelId] = React.useState<string>('all');

  // Helper function to add events to timeline
  const addEvent = (type: 'success' | 'error' | 'warning' | 'info', eventType: string, source: 'DataChannel' | 'PeerConnection' | 'Room' | 'System', message: string, data?: any) => {
    const event: TimelineEvent = {
      id: String(++eventIdCounter.current),
      type,
      eventType,
      source,
      message,
      timestamp: new Date(),
      data
    };
    setEvents(prev => [...prev, event]);
  };

  React.useEffect(() => {
    const otherPeers = new Set<RemotePeer>();
    
    addEvent('info', 'init', 'System', 'Initializing peer connection', { peerId, roomId });
    
    peer.join(room);

    room.on('presence', (event) => {
      const remotePeer = event.peer;


      // addEvent('info', 'presence', 'Room', `${remotePeer.id} ${event.type}ed the room`, { peerId: remotePeer.id, type: event.type });
      
      if (remotePeer instanceof RemotePeer) {
        const alreadySeen = otherPeers.has(remotePeer);
        otherPeers.add(remotePeer);
        if (alreadySeen) return;

        remotePeer.on('receivedSignal', (event: any) => {
          addEvent('info', 'signal (received)', 'Room', `Signal received from ${event.peerId}`, { peerId: event.peerId, type: event.type, event });
        });

        remotePeer.on('sentSignal', (event: any) => {
          addEvent('info', 'signal (sent)', 'Room', `Signal sent to ${event.peerId}`, { peerId: event.peerId, type: event.type, event });
        });

        // DataChannel events
        remotePeer.on('dataChannel', ({ type, event }: any) => {
          const eventTypeMap: Record<string, 'success' | 'error' | 'warning' | 'info'> = {
            'open': 'success',
            'close': 'warning',
            'error': 'error',
            'message': 'info'
          };
          
          const eventType = eventTypeMap[type] || 'info';
          const message = type === 'error' 
            ? `Data channel error with ${remotePeer.id}: ${event.error?.message || 'Unknown error'}`
            : type === 'message'
            ? `Message received from ${remotePeer.id}`
            : `Data channel ${type} with ${remotePeer.id}`;

          console.log('DATACHANNEL EVENT', event);
          
          // Track data channel state
          if (type === 'open') {
            const channel = event.target || event;
            const label = channel.label || 'default';
            setDataChannels(prev => new Map(prev).set(remotePeer.id, { 
              channel, 
              state: 'open', 
              peer: remotePeer,
              label 
            }));
          } else if (type === 'close') {
            setDataChannels(prev => {
              const newMap = new Map(prev);
              newMap.delete(remotePeer.id);
              return newMap;
            });
          }
            
          addEvent(eventType, type.toUpperCase(), 'DataChannel', message, { 
            peerId: remotePeer.id, 
            type, 
            event,
            ...(type === 'message' && { data: { data: event.data, label: event.label } })
          });
        });

        // PeerConnection events
        remotePeer.on('peerConnection', ({ type, event }: any) => {
          let eventLevel: 'success' | 'error' | 'warning' | 'info' = 'info';
          let message = `${type} with ${remotePeer.id}`;
          let additionalData: any = { peerId: remotePeer.id, type, event };
          
          switch (type) {
            case 'connectionstatechange':
              const state = event.target?.connectionState || 'unknown';
              eventLevel = state === 'connected' ? 'success' : state === 'failed' ? 'error' : 'info';
              message = `Connection state with ${remotePeer.id}: ${state}`;
              additionalData.state = state;
              
              // Update data channel connection state
              setDataChannels(prev => {
                const newMap = new Map(prev);
                const channel = newMap.get(remotePeer.id);
                if (channel) {
                  newMap.set(remotePeer.id, { ...channel, state });
                }
                return newMap;
              });
              break;
            case 'iceconnectionstatechange':
              const iceState = event.target?.iceConnectionState || 'unknown';
              eventLevel = iceState === 'connected' || iceState === 'completed' ? 'success' : iceState === 'failed' ? 'error' : 'info';
              message = `ICE connection state with ${remotePeer.id}: ${iceState}`;
              additionalData.iceState = iceState;
              break;
            case 'icegatheringstatechange':
              const gatheringState = event.target?.iceGatheringState || 'unknown';
              message = `ICE gathering state with ${remotePeer.id}: ${gatheringState}`;
              additionalData.gatheringState = gatheringState;
              break;
            case 'icecandidate':
              if (event.candidate) {
                message = `ICE candidate found for ${remotePeer.id}`;
                additionalData.candidate = event.candidate;
              } else {
                message = `ICE gathering complete for ${remotePeer.id}`;
              }
              break;
            case 'signalingstatechange':
              const signalingState = event.target?.signalingState || 'unknown';
              message = `Signaling state with ${remotePeer.id}: ${signalingState}`;
              additionalData.signalingState = signalingState;
              break;
            case 'negotiationneeded':
              message = `Negotiation needed with ${remotePeer.id}`;
              break;
          }
          
          addEvent(eventLevel, type, 'PeerConnection', message, additionalData);
        });
      } else {
        if (event.type === 'join') {
          setIsConnected(true);
          addEvent('success', 'joined', 'Room', 'Successfully joined room');
        }
      }
    });
    
    // Room message events
    room.on('message', (event: any) => {
      addEvent('info', 'message', 'Room', `Message from ${event.peer.id}`, { 
        peerId: event.peer.id,
        message: event.message,
        timestamp: event.timestamp,
        event 
      });
    });
    
    // Room error events
    room.on('error', (event: any) => {
      addEvent('error', 'error', 'Room', `Room error: ${event.message || event.error?.message || 'Unknown error'}`, { 
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
      // DataChannel events
      case 'open':
      case 'connectionstatechange':
      case 'iceconnectionstatechange':
        return <Wifi width={10} height={10} />;
      case 'close':
        return <WifiOff width={10} height={10} />;
      case 'message':
        return <ArrowDown width={10} height={10} />;
      case 'error':
        return <WarningCircle width={10} height={10} />;
      // Room events
      case 'joined':
      case 'presence':
        return <CheckCircle width={10} height={10} />;
      // PeerConnection events
      case 'icecandidate':
      case 'icegatheringstatechange':
      case 'signalingstatechange':
      case 'negotiationneeded':
        return <Circle width={10} height={10} />;
      // System events
      case 'init':
      case 'join':
        return <Circle width={10} height={10} />;
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
  
  const sendMessage = () => {
    if (!messageInput.trim()) return;
    
    // Determine which channels to send to
    const channelsToSend = selectedChannelId === 'all' 
      ? Array.from(dataChannels.entries())
      : Array.from(dataChannels.entries()).filter(([id]) => id === selectedChannelId);
    
    let sentCount = 0;
    channelsToSend.forEach(([peerId, channelInfo]) => {
      channelInfo.peer.sendMessage(messageInput);
    });
    
    
    setMessageInput('');
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
        <AnimatePresence>
          {[...events].reverse().map((event) => (
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
              <EventContent 
                onClick={(e) => {
                  e.stopPropagation();
                  const newExpanded = new Set(expandedEvents);
                  if (expandedEvents.has(event.id)) {
                    newExpanded.delete(event.id);
                  } else {
                    newExpanded.add(event.id);
                  }
                  setExpandedEvents(newExpanded);
                }}
              >
                <EventHeader>
                  <EventHeaderLeft>
                    <SourceTag source={event.source}>{event.source}</SourceTag>
                    <EventType type={event.type}>{event.eventType}</EventType>
                  </EventHeaderLeft>
                  <EventTime>{formatTime(event.timestamp)}</EventTime>
                  {event.data && (
                    <ExpandIcon>
                      {expandedEvents.has(event.id) ? (
                        <NavArrowDown width={14} height={14} />
                      ) : (
                        <NavArrowRight width={14} height={14} />
                      )}
                    </ExpandIcon>
                  )}
                </EventHeader>
                <EventMessage>{event.message}</EventMessage>
                {event.data && (
                  <EventData isExpanded={expandedEvents.has(event.id)}>
                    {JSON.stringify(event.data, null, 2)}
                  </EventData>
                )}
              </EventContent>
            </EventItem>
          ))}
        </AnimatePresence>
      </TimelineContainer>
      
      <DataChannelZone>
        <DataChannelHeader>
          <DataChannelTitle>Data Channel Status</DataChannelTitle>
          <ConnectionStatusList>
            {dataChannels.size === 0 ? (
              <ConnectionStatus state="closed">No active channels</ConnectionStatus>
            ) : (
              Array.from(dataChannels.entries()).map(([peerId, info]) => (
                <ConnectionStatus key={peerId} state={info.state}>
                  {peerId.slice(0, 8)}... - {info.state}
                </ConnectionStatus>
              ))
            )}
          </ConnectionStatusList>
        </DataChannelHeader>
        
        <MessageInputContainer>
          <ChannelSelector
            value={selectedChannelId}
            onChange={(e) => setSelectedChannelId(e.target.value)}
            disabled={dataChannels.size === 0}
          >
            <option value="all">All Channels</option>
            {Array.from(dataChannels.entries()).map(([peerId, info]) => (
              <option key={peerId} value={peerId}>
                {info.label || 'default'} - {peerId.slice(0, 8)}...
              </option>
            ))}
          </ChannelSelector>
          <MessageInput
            type="text"
            placeholder="Type a message to send via data channel..."
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            disabled={dataChannels.size === 0}
          />
          <SendButton
            onClick={sendMessage}
            disabled={dataChannels.size === 0 || !messageInput.trim()}
          >
            <Send width={14} height={14} />
            Send
          </SendButton>
        </MessageInputContainer>
      </DataChannelZone>
    </Container>
  );
};