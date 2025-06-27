import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, Circle, CheckCircle, WarningCircle, Wifi, WifiOff, NavArrowDown, NavArrowRight, Send, Filter, X } from 'iconoir-react';
import { Peer,  RemotePeer, Room } from '@honeypipe/client';

import { HTTPSignalingAdapter } from './HttpSignalingAdapter';

const Container = styled.div`
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  background: #0a0a0a;
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
  padding: 10px 16px;
  border-bottom: 1px solid #1a1a1a;
  flex-shrink: 0;
  background: #0f0f0f;
`;

const Title = styled.h2`
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #f0f0f0;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  
  &::before {
    content: '◆';
    color: #00ff88;
    font-size: 10px;
  }
`;

const ConnectionInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 11px;
  color: #606060;
`;

const InfoItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  
  span {
    color: #d0d0d0;
    font-weight: 500;
  }
`;

const FilterSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #0f0f0f;
  border-bottom: 1px solid #1a1a1a;
  flex-shrink: 0;
  font-size: 11px;
`;

const FilterLabel = styled.div`
  color: #808080;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const FilterTag = styled.button<{ active: boolean; color: string }>`
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid ${props => props.active ? props.color + '60' : '#2a2a2a'};
  background: ${props => props.active ? props.color + '20' : 'transparent'};
  color: ${props => props.active ? props.color : '#606060'};
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    border-color: ${props => props.color + '60'};
    color: ${props => props.color};
  }
`;

const SearchInput = styled.input`
  background: #0a0a0a;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  color: #f0f0f0;
  margin-left: auto;
  width: 200px;
  
  &::placeholder {
    color: #505050;
  }
  
  &:focus {
    outline: none;
    border-color: #3a3a3a;
  }
`;

const TimelineContainer = styled.div`
  position: relative;
  padding: 12px;
  flex: 1;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: #0a0a0a;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #2a2a2a;
    border-radius: 3px;
    
    &:hover {
      background: #3a3a3a;
    }
  }
`;

const TimelineLine = styled.div`
  position: absolute;
  left: 20px;
  top: 12px;
  bottom: 12px;
  width: 1px;
  background: linear-gradient(to bottom, #00ff88, #00ff8850, transparent);
`;

const EventItem = styled(motion.div)<{ type: string }>`
  position: relative;
  margin-bottom: 8px;
`;

const EventDot = styled.div<{ type: string }>`
  position: absolute;
  left: -24px;
  top: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => {
    switch(props.type) {
      case 'success': return '#00ff88';
      case 'error': return '#ff5555';
      case 'warning': return '#ffaa00';
      case 'info': return '#00aaff';
      default: return '#606060';
    }
  }};
  border: 2px solid #0a0a0a;
  z-index: 1;
`;

const EventContent = styled.div`
  background: #0f0f0f;
  border: 1px solid #1a1a1a;
  border-radius: 4px;
  padding: 8px 10px;
  margin-left: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: #111111;
    border-color: #2a2a2a;
  }
`;

const EventHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
`;

const EventHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
`;

const SourceTag = styled.div<{ source: string }>`
  font-size: 9px;
  font-weight: 600;
  padding: 2px 5px;
  border-radius: 2px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: ${props => {
    switch(props.source) {
      case 'DataChannel': return '#00ff8815';
      case 'PeerConnection': return '#00aaff15';
      case 'Room': return '#ffaa0015';
      case 'System': return '#60606015';
      default: return '#60606015';
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
      case 'DataChannel': return '#00ff8830';
      case 'PeerConnection': return '#00aaff30';
      case 'Room': return '#ffaa0030';
      case 'System': return '#60606030';
      default: return '#60606030';
    }
  }};
`;

const ExpandIcon = styled.div<{ expanded: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  color: #505050;
  transition: transform 0.15s ease;
  transform: ${props => props.expanded ? 'rotate(90deg)' : 'rotate(0)'};
`;

const EventType = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: #d0d0d0;
  flex: 1;
`;

const EventTime = styled.div`
  font-size: 10px;
  color: #505050;
  margin-left: auto;
`;

const EventMessage = styled.div`
  font-size: 11px;
  color: #b0b0b0;
  line-height: 1.4;
  margin-top: 4px;
`;

const EventData = styled.pre<{ isExpanded: boolean }>`
  font-size: 10px;
  color: #707070;
  margin-top: 6px;
  padding: 6px;
  background: #080808;
  border-radius: 3px;
  overflow-x: auto;
  max-width: 100%;
  max-height: ${props => props.isExpanded ? '300px' : '0'};
  overflow-y: ${props => props.isExpanded ? 'auto' : 'hidden'};
  opacity: ${props => props.isExpanded ? '1' : '0'};
  transition: all 0.2s ease;
  
  &::-webkit-scrollbar {
    height: 4px;
    width: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: #0a0a0a;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #2a2a2a;
    border-radius: 2px;
  }
`;

const StatusIndicator = styled.div<{ connected: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: ${props => props.connected ? '#00ff8815' : '#ff555515'};
  border: 1px solid ${props => props.connected ? '#00ff8860' : '#ff555560'};
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  color: ${props => props.connected ? '#00ff88' : '#ff5555'};
  text-transform: uppercase;
  letter-spacing: 0.03em;
`;

const DataChannelZone = styled.div`
  background: #0f0f0f;
  border-top: 1px solid #1a1a1a;
  padding: 10px 16px;
  flex-shrink: 0;
`;

const DataChannelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const DataChannelTitle = styled.h3`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #f0f0f0;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  
  &::before {
    content: '▪';
    color: #00aaff;
    font-size: 8px;
  }
`;

const ChannelsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const ChannelItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background: #0a0a0a;
  border: 1px solid #1a1a1a;
  border-radius: 4px;
  padding: 6px 8px;
`;

const ChannelInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const ChannelName = styled.div`
  font-size: 11px;
  font-weight: 500;
  color: #e0e0e0;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ChannelState = styled.span<{ state: string }>`
  font-size: 9px;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 2px;
  text-transform: uppercase;
  background: ${props => {
    switch(props.state) {
      case 'open': return '#00ff8820';
      case 'connecting': return '#ffaa0020';
      case 'closing': case 'closed': return '#ff555520';
      default: return '#60606020';
    }
  }};
  color: ${props => {
    switch(props.state) {
      case 'open': return '#00ff88';
      case 'connecting': return '#ffaa00';
      case 'closing': case 'closed': return '#ff5555';
      default: return '#808080';
    }
  }};
`;

const ChannelPeer = styled.div`
  font-size: 10px;
  color: #606060;
`;

const MessageForm = styled.form`
  display: flex;
  gap: 4px;
  margin-top: 4px;
`;

const MessageInput = styled.input`
  flex: 1;
  background: #080808;
  border: 1px solid #2a2a2a;
  border-radius: 3px;
  padding: 4px 6px;
  font-size: 10px;
  color: #f0f0f0;
  font-family: inherit;
  
  &::placeholder {
    color: #404040;
  }
  
  &:focus {
    outline: none;
    border-color: #3a3a3a;
  }
`;

const SendButton = styled.button`
  background: #00aaff;
  border: none;
  border-radius: 3px;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  color: #0a0a0a;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover:not(:disabled) {
    background: #00ccff;
  }
  
  &:active:not(:disabled) {
    transform: scale(0.95);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const NoChannelsMessage = styled.div`
  text-align: center;
  padding: 16px;
  color: #505050;
  font-size: 11px;
`;

const EventStats = styled.div`
  display: flex;
  gap: 12px;
  font-size: 10px;
  color: #606060;
  margin-left: auto;
`;

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  
  strong {
    color: #909090;
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

const sourceColors = {
  'DataChannel': '#00ff88',
  'PeerConnection': '#00aaff',
  'Room': '#ffaa00',
  'System': '#808080'
};

export const Timeline: React.FC<TimelineProps> = ({ roomId, peerId }) => {
  const [events, setEvents] = React.useState<TimelineEvent[]>([]);
  const [isConnected, setIsConnected] = React.useState(false);
  const [expandedEvents, setExpandedEvents] = React.useState<Set<string>>(new Set());
  const [activeFilters, setActiveFilters] = React.useState<Set<string>>(new Set(['DataChannel', 'PeerConnection', 'Room', 'System']));
  const [searchQuery, setSearchQuery] = React.useState('');

  const [peer] = React.useState(() => new Peer({ peerId }));
  const [room] = React.useState(() => new Room(roomId, {
    adapter: new HTTPSignalingAdapter({ 
      baseUrl: '/api',
    })
  }));

  const eventIdCounter = React.useRef(0);
  const [channelInputs, setChannelInputs] = React.useState<Map<string, string>>(new Map());
  const [dataChannels, setDataChannels] = React.useState<Map<string, { channel: RTCDataChannel, state: string, peer: RemotePeer, label?: string }>>(new Map());

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

  // Filter events based on active filters and search query
  const filteredEvents = React.useMemo(() => {
    return events.filter(event => {
      if (!activeFilters.has(event.source)) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          event.message.toLowerCase().includes(query) ||
          event.eventType.toLowerCase().includes(query) ||
          event.source.toLowerCase().includes(query) ||
          (event.data && JSON.stringify(event.data).toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [events, activeFilters, searchQuery]);

  // Event statistics
  const eventStats = React.useMemo(() => {
    const stats = {
      total: events.length,
      errors: events.filter(e => e.type === 'error').length,
      bySource: {} as Record<string, number>
    };
    events.forEach(event => {
      stats.bySource[event.source] = (stats.bySource[event.source] || 0) + 1;
    });
    return stats;
  }, [events]);

  const toggleFilter = (source: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  };

  React.useEffect(() => {
    const otherPeers = new Set<RemotePeer>();
    
    addEvent('info', 'init', 'System', 'Initializing peer connection', { peerId, roomId });
    
    peer.join(room);

    room.on('presence', (event) => {
      const remotePeer = event.peer;

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
          console.log('DATACHANNEL EVENT', `${peer.id} <> ${remotePeer.id}`, type, event);
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

    return () => {
      // peer.disconnect();
    };
  }, []);

  const toggleEventExpansion = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const handleSendMessage = (channelKey: string) => {
    const channelData = dataChannels.get(channelKey);
    const message = channelInputs.get(channelKey) || '';
    
    if (channelData && message.trim()) {
      try {
        channelData.channel.send(message);
        addEvent('success', 'message', 'DataChannel', `Sent: ${message}`, { 
          channel: channelData.label,
          sent: true,
          data: message 
        });
        setChannelInputs(prev => new Map(prev).set(channelKey, ''));
      } catch (error) {
        addEvent('error', 'message', 'DataChannel', `Failed to send message: ${error}`, { error });
      }
    }
  };

  return (
    <Container>
      <Header>
        <ConnectionInfo>
          <InfoItem>Room: <span>{roomId}</span></InfoItem>
          <InfoItem>Peer: <span>{peer.id}</span></InfoItem>
          <StatusIndicator connected={isConnected}>
            {isConnected ? <Wifi width={12} height={12} /> : <WifiOff width={12} height={12} />}
            {isConnected ? 'Connected' : 'Disconnected'}
          </StatusIndicator>
        </ConnectionInfo>
      </Header>

      <FilterSection>
        <FilterLabel>
          <Filter width={12} height={12} />
          Filters:
        </FilterLabel>
        {Object.entries(sourceColors).map(([source, color]) => (
          <FilterTag
            key={source}
            active={activeFilters.has(source)}
            color={color}
            onClick={() => toggleFilter(source)}
          >
            {source} ({eventStats.bySource[source] || 0})
          </FilterTag>
        ))}
        <EventStats>
          <StatItem>Total: <strong>{eventStats.total}</strong></StatItem>
          <StatItem>Errors: <strong>{eventStats.errors}</strong></StatItem>
        </EventStats>
        <SearchInput
          type="text"
          placeholder="Search events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </FilterSection>

      <TimelineContainer>
        <AnimatePresence>
          {[...filteredEvents].reverse().map((event) => (
            <EventItem
              key={event.id}
              type={event.type}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <EventDot type={event.type} />
              <EventContent onClick={() => toggleEventExpansion(event.id)}>
                <EventHeader>
                  <EventHeaderLeft>
                    <SourceTag source={event.source}>{event.source}</SourceTag>
                    <EventType>{event.eventType}</EventType>
                    <ExpandIcon expanded={expandedEvents.has(event.id)}>
                      <NavArrowRight width={12} height={12} />
                    </ExpandIcon>
                  </EventHeaderLeft>
                  <EventTime>
                    {event.timestamp.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit', 
                      second: '2-digit',
                      fractionalSecondDigits: 3 
                    })}
                  </EventTime>
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
          <DataChannelTitle>Data Channels</DataChannelTitle>
        </DataChannelHeader>
        {dataChannels.size > 0 ? (
          <ChannelsList>
            {Array.from(dataChannels.entries()).map(([key, { channel, state, peer, label }]) => (
              <ChannelItem key={key}>
                <ChannelInfo>
                  <ChannelName>
                    {label || 'unnamed'} 
                    <ChannelState state={state}>
                      {state}
                      {channel.readyState}
                    </ChannelState>
                  </ChannelName>
                  <ChannelPeer>with {peer.id}</ChannelPeer>
                </ChannelInfo>
                  <MessageInput
                    type="text"
                    placeholder="Type a message..."
                    value={channelInputs.get(key) || ''}
                    onChange={(e) => setChannelInputs(prev => new Map(prev).set(key, e.target.value))}
                  />
                  <SendButton
                    disabled={channel.readyState !== 'open'}
                    onClick={() => {
                      console.log('channel', channel);
                      handleSendMessage(key)
                    }}
                  >
                    <Send width={12} height={12} />
                  </SendButton>
              </ChannelItem>
            ))}
          </ChannelsList>
        ) : (
          <NoChannelsMessage>No data channels established yet</NoChannelsMessage>
        )}
      </DataChannelZone>
    </Container>
  );
};