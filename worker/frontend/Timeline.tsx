import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, NavArrowRight, Send, Filter, User } from 'iconoir-react';
import { Peer, RemotePeer, Room } from '@honeypipe/client';

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
  flex-wrap: wrap;
`;

const FilterLabel = styled.div`
  color: #808080;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
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

const PeerFilterTag = styled(FilterTag)`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  
  svg {
    width: 10px;
    height: 10px;
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
      case 'Signal': return '#ffaa0015';
      case 'Room': return '#60606015';
      case 'System': return '#60606015';
      default: return '#60606015';
    }
  }};
  color: ${props => {
    switch(props.source) {
      case 'DataChannel': return '#00ff88';
      case 'PeerConnection': return '#00aaff';
      case 'Signal': return '#ffaa00';
      case 'Room': return '#808080';
      case 'System': return '#808080';
      default: return '#808080';
    }
  }};
  border: 1px solid ${props => {
    switch(props.source) {
      case 'DataChannel': return '#00ff8830';
      case 'PeerConnection': return '#00aaff30';
      case 'Signal': return '#ffaa0030';
      case 'Room': return '#60606030';
      case 'System': return '#60606030';
      default: return '#60606030';
    }
  }};
`;

const PeerTag = styled.div`
  font-size: 9px;
  font-weight: 500;
  padding: 2px 5px;
  border-radius: 2px;
  background: #1a1a1a;
  color: #a0a0a0;
  border: 1px solid #2a2a2a;
  display: flex;
  align-items: center;
  gap: 3px;
  
  svg {
    width: 8px;
    height: 8px;
  }
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

const PeerConnectionsZone = styled.div`
  background: #0f0f0f;
  border-top: 1px solid #1a1a1a;
  padding: 10px 16px;
  flex-shrink: 0;
`;

const PeerConnectionsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const PeerConnectionsTitle = styled.h3`
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

const PeersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const PeerItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background: #0a0a0a;
  border: 1px solid #1a1a1a;
  border-radius: 4px;
  padding: 6px 8px;
`;

const PeerInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const PeerName = styled.div`
  font-size: 11px;
  font-weight: 500;
  color: #e0e0e0;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const PeerState = styled.span<{ state: string }>`
  font-size: 9px;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 2px;
  text-transform: uppercase;
  background: ${props => {
    switch(props.state) {
      case 'connected': return '#00ff8820';
      case 'connecting': return '#ffaa0020';
      case 'failed': case 'closed': return '#ff555520';
      default: return '#60606020';
    }
  }};
  color: ${props => {
    switch(props.state) {
      case 'connected': return '#00ff88';
      case 'connecting': return '#ffaa00';
      case 'failed': case 'closed': return '#ff5555';
      default: return '#808080';
    }
  }};
`;

const PeerStats = styled.div`
  font-size: 10px;
  color: #606060;
`;

const ChannelControls = styled.div`
  display: flex;
  gap: 4px;
  align-items: center;
`;

const MessageInput = styled.input`
  background: #080808;
  border: 1px solid #2a2a2a;
  border-radius: 3px;
  padding: 4px 6px;
  font-size: 10px;
  color: #f0f0f0;
  font-family: inherit;
  width: 150px;
  
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

const NoPeersMessage = styled.div`
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
  source: 'DataChannel' | 'PeerConnection' | 'Signal' | 'Room' | 'System';
  message: string;
  timestamp: Date;
  peerId?: string;
  data?: any;
}

interface PeerConnectionData {
  peer: RemotePeer;
  connectionState: string;
  dataChannel?: {
    channel: any;
    state: string;
    label: string;
  };
}

interface TimelineProps {
  roomId: string;
  peerId: string;
}

const sourceColors = {
  'Messages': '#00ff88',
  'Connection': '#00aaff',
  'Signal': '#ffaa00',
  'Room': '#808080',
  'System': '#808080'
};

export const Timeline: React.FC<TimelineProps> = ({ roomId, peerId }) => {
  const [events, setEvents] = React.useState<TimelineEvent[]>([]);
  const [isConnected, setIsConnected] = React.useState(false);
  const [expandedEvents, setExpandedEvents] = React.useState<Set<string>>(new Set());
  const [activeSourceFilters, setActiveSourceFilters] = React.useState<Set<string>>(new Set(['DataChannel', 'PeerConnection', 'Signal', 'Room', 'System']));
  const [activePeerFilters, setActivePeerFilters] = React.useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = React.useState('');
  const [peerConnections, setPeerConnections] = React.useState<Map<string, PeerConnectionData>>(new Map());
  const [channelInputs, setChannelInputs] = React.useState<Map<string, string>>(new Map());

  const [peer] = React.useState(() => new Peer({ peerId }));
  const [room] = React.useState(() => new Room(roomId, {
    adapter: new FetchSignalAdapter({ 
      baseUrl: 'http://localhost:8080',
    }),
  }));

  const eventIdCounter = React.useRef(0);

  // Helper function to add events to timeline
  const addEvent = (type: 'success' | 'error' | 'warning' | 'info', eventType: string, source: 'DataChannel' | 'PeerConnection' | 'Signal' | 'Room' | 'System', message: string, data?: any & { peerId?: string }) => {
    const event: TimelineEvent = {
      id: String(++eventIdCounter.current),
      type,
      eventType,
      source,
      message,
      timestamp: new Date(),
      peerId: data?.peerId,
      data
    };
    setEvents(prev => [...prev, event]);
  };

  // Filter events based on active filters and search query
  const filteredEvents = React.useMemo(() => {
    return events.filter(event => {
      // Source filter
      if (!activeSourceFilters.has(event.source)) return false;
      
      // Peer filter - if any peer filters are active, only show events from those peers
      if (activePeerFilters.size > 0) {
        // Always show Room and System events when peer filters are active
        if (event.source !== 'Room' && event.source !== 'System') {
          if (!event.peerId || !activePeerFilters.has(event.peerId)) return false;
        }
      }
      
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          event.message.toLowerCase().includes(query) ||
          event.eventType.toLowerCase().includes(query) ||
          event.source.toLowerCase().includes(query) ||
          (event.peerId && event.peerId.toLowerCase().includes(query)) ||
          (event.data && JSON.stringify(event.data).toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [events, activeSourceFilters, activePeerFilters, searchQuery]);

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

  const toggleSourceFilter = (source: string) => {
    setActiveSourceFilters(prev => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  };

  const togglePeerFilter = (peerId: string) => {
    setActivePeerFilters(prev => {
      const next = new Set(prev);
      if (next.has(peerId)) {
        next.delete(peerId);
      } else {
        next.add(peerId);
      }
      return next;
    });
  };

  React.useEffect(() => {
    const otherPeers = new Set<RemotePeer>();
    
    addEvent('info', 'init', 'System', 'Initializing peer connection', { peerId: peer.id, roomId });
    
    peer.join(room);

    room.on('presence', (event: any) => {
      const remotePeer = event.peer;

      if (remotePeer instanceof RemotePeer) {
        const alreadySeen = otherPeers.has(remotePeer);
        otherPeers.add(remotePeer);
        if (alreadySeen) return;

        // Initialize peer connection data
        setPeerConnections(prev => new Map(prev).set(remotePeer.id, {
          peer: remotePeer,
          connectionState: 'new'
        }));

        addEvent('info', 'presence', 'Room', `Peer ${remotePeer.id} ${event.type}ed`, { 
          peerId: remotePeer.id, 
          type: event.type 
        });

        // Signal events
        remotePeer.on('receivedSignal', (signalEvent: any) => {
          addEvent('info', 'signal-received', 'Signal', `Signal received: ${signalEvent.type}`, { 
            peerId: remotePeer.id,
            signal: signalEvent 
          });
        });

        remotePeer.on('sentSignal', (signalEvent: any) => {
          addEvent('info', 'signal-sent', 'Signal', `Signal sent: ${signalEvent.type}`, { 
            peerId: remotePeer.id,
            signal: signalEvent 
          });
        });

        // DataChannel events
        remotePeer.on('dataChannel', ({ type, event: dcEvent, dataChannel }: any) => {
          const eventTypeMap: Record<string, 'success' | 'error' | 'warning' | 'info'> = {
            'open': 'success',
            'close': 'warning',
            'error': 'error',
            'message': 'info'
          };
          
          const eventLevel = eventTypeMap[type] || 'info';
          let message = '';
          
          switch (type) {
            case 'open':
              message = 'Data channel opened';
              setPeerConnections(prev => {
                const newMap = new Map(prev);
                const peerData = newMap.get(remotePeer.id);
                if (peerData) {
                  newMap.set(remotePeer.id, {
                    ...peerData,
                    dataChannel: {
                      channel: dataChannel || dcEvent.target || dcEvent,
                      state: 'open',
                      label: dataChannel?.label || 'default'
                    }
                  });
                }
                return newMap;
              });
              break;
            case 'close':
              message = 'Data channel closed';
              setPeerConnections(prev => {
                const newMap = new Map(prev);
                const peerData = newMap.get(remotePeer.id);
                if (peerData && peerData.dataChannel) {
                  newMap.set(remotePeer.id, {
                    ...peerData,
                    dataChannel: {
                      ...peerData.dataChannel,
                      state: 'closed'
                    }
                  });
                }
                return newMap;
              });
              break;
            case 'error':
              message = `Data channel error: ${dcEvent.error?.message || 'Unknown error'}`;
              break;
            case 'message':
              message = `Message received: ${dcEvent.data}`;
              break;
            default:
              message = `Data channel ${type}`;
          }
          
          addEvent(eventLevel, type, 'DataChannel', message, { 
            peerId: remotePeer.id,
            type,
            ...(type === 'message' && { data: dcEvent.data })
          });
        });

        // PeerConnection events
        remotePeer.on('peerConnection', ({ type, event: pcEvent }: any) => {
          let eventLevel: 'success' | 'error' | 'warning' | 'info' = 'info';
          let message = '';
          let additionalData: any = { peerId: remotePeer.id, type };
          
          switch (type) {
            case 'connectionstatechange':
              const state = pcEvent.target?.connectionState || 'unknown';
              eventLevel = state === 'connected' ? 'success' : state === 'failed' ? 'error' : 'info';
              message = `Connection state: ${state}`;
              additionalData.state = state;
              
              setPeerConnections(prev => {
                const newMap = new Map(prev);
                const peerData = newMap.get(remotePeer.id);
                if (peerData) {
                  newMap.set(remotePeer.id, {
                    ...peerData,
                    connectionState: state
                  });
                }
                return newMap;
              });
              
              if (state === 'connected') {
                setIsConnected(true);
              } else if (state === 'failed' || state === 'closed') {
                setIsConnected(false);
              }
              break;
            case 'iceconnectionstatechange':
              const iceState = pcEvent.target?.iceConnectionState || 'unknown';
              eventLevel = iceState === 'connected' || iceState === 'completed' ? 'success' : iceState === 'failed' ? 'error' : 'info';
              message = `ICE connection state: ${iceState}`;
              additionalData.iceState = iceState;
              break;
            case 'icegatheringstatechange':
              const gatheringState = pcEvent.target?.iceGatheringState || 'unknown';
              message = `ICE gathering state: ${gatheringState}`;
              additionalData.gatheringState = gatheringState;
              break;
            case 'icecandidate':
              if (pcEvent.candidate) {
                message = 'ICE candidate found';
                additionalData.candidate = pcEvent.candidate;
              } else {
                message = 'ICE gathering complete';
              }
              break;
            case 'signalingstatechange':
              const signalingState = pcEvent.target?.signalingState || 'unknown';
              message = `Signaling state: ${signalingState}`;
              additionalData.signalingState = signalingState;
              break;
            case 'negotiationneeded':
              message = 'Negotiation needed';
              break;
            default:
              message = type;
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

    room.on('error', (error: Error) => {
      addEvent('error', 'room', 'Room', `Room error: ${error.message}`, { error });
    });


    return () => {
      // Clean up
      peer.leave(room);
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

  const handleSendMessage = (peerId: string, e: React.FormEvent) => {
    e.preventDefault();
    const peerData = peerConnections.get(peerId);
    const message = channelInputs.get(peerId) || '';
    
    if (peerData?.dataChannel && message.trim()) {
      try {
        peerData.dataChannel.channel.send(message);
        addEvent('success', 'message', 'DataChannel', `Sent: ${message}`, { 
          peerId,
          channel: peerData.dataChannel.label,
          sent: true,
          data: message 
        });
        setChannelInputs(prev => new Map(prev).set(peerId, ''));
      } catch (error: any) {
        addEvent('error', 'message', 'DataChannel', `Failed to send message: ${error.message}`, { peerId, error });
      }
    }
  };

  return (
    <Container>

<PeerConnectionsZone>
        <PeerConnectionsHeader>
          <PeerConnectionsTitle>Peer Connections</PeerConnectionsTitle>
        </PeerConnectionsHeader>
        {peerConnections.size > 0 ? (
          <PeersList>
            {Array.from(peerConnections.entries()).map(([peerId, peerData]) => (
              <PeerItem key={peerId}>
                <PeerInfo>
                  <PeerName>
                    <User width={12} height={12} />
                    {peerId}
                    <PeerState state={peerData.connectionState}>
                      {peerData.connectionState}
                    </PeerState>
                  </PeerName>
                  <PeerStats>
                    {peerData.dataChannel ? `Channel: ${peerData.dataChannel.label} (${peerData.dataChannel.state})` : 'No data channel'}
                  </PeerStats>
                </PeerInfo>
                {peerData.dataChannel && peerData.dataChannel.state === 'open' && (
                  <ChannelControls>
                    <MessageInput
                      type="text"
                      placeholder="Type a message..."
                      value={channelInputs.get(peerId) || ''}
                      onChange={(e) => setChannelInputs(prev => new Map(prev).set(peerId, e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSendMessage(peerId, e);
                        }
                      }}
                    />
                    <SendButton
                      onClick={(e) => handleSendMessage(peerId, e)}
                      disabled={!(channelInputs.get(peerId) || '').trim()}
                    >
                      <Send width={12} height={12} />
                    </SendButton>
                  </ChannelControls>
                )}
              </PeerItem>
            ))}
          </PeersList>
        ) : (
          <NoPeersMessage>No peer connections established yet</NoPeersMessage>
        )}
      </PeerConnectionsZone>
      <FilterSection>
        <FilterGroup>
          <FilterLabel>
            <Filter width={12} height={12} />
            Sources:
          </FilterLabel>
          {Object.entries(sourceColors).map(([source, color]) => (
            <FilterTag
              key={source}
              active={activeSourceFilters.has(source)}
              color={color}
              onClick={() => toggleSourceFilter(source)}
            >
              {source}
            </FilterTag>
          ))}
        </FilterGroup>
        
        {peerConnections.size > 0 && (
          <FilterGroup>
            <FilterLabel>
              <User width={12} height={12} />
              Peers:
            </FilterLabel>
            {Array.from(peerConnections.entries()).map(([peerId, peerData]) => (
              <PeerFilterTag
                key={peerId}
                active={activePeerFilters.has(peerId)}
                color="#00aaff"
                onClick={() => togglePeerFilter(peerId)}
              >
                <User />
                {peerId.slice(0, 8)}...
              </PeerFilterTag>
            ))}
          </FilterGroup>
        )}
        
        <EventStats>
          <StatItem>Total: <strong>{eventStats.total}</strong></StatItem>
          <StatItem>Errors: <strong>{eventStats.errors}</strong></StatItem>
        </EventStats>
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
                    {event.peerId && (
                      <PeerTag>
                        <User />
                        {event.peerId.slice(0, 8)}...
                      </PeerTag>
                    )}
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
    </Container>
  );
};