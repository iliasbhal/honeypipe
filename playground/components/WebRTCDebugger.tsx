import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Peer } from '../../src/Peer';

interface Message {
  id: string;
  type: string;
  from: string;
  to: string;
  timestamp: number;
  data?: any;
}

interface ActorState {
  id: string;
  state: string;
  context?: any;
  lastUpdate: number;
  isActive: boolean;
}

interface WebRTCDebuggerProps {
  peer?: Peer;
  channelId?: string;
}

export const WebRTCDebugger: React.FC<WebRTCDebuggerProps> = ({ peer, channelId }) => {
  const [actors, setActors] = useState<ActorState[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectionStates, setConnectionStates] = useState<any>({});
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({
    total: 0,
    SIGNAL_JOIN_EVENT: 0,
    SIGNAL_SDP_OFFER_EVENT: 0,
    SIGNAL_SDP_ANSWER_EVENT: 0,
    SIGNAL_ICE_EVENT: 0,
    PC_ICE_CANDIDATE: 0,
    PC_CONNECTION_STATE_CHANGE: 0,
    PC_ICE_CONNECTION_STATE_CHANGE: 0,
    PC_SIGNALING_STATE_CHANGE: 0,
    DC_OPEN: 0,
    DC_MESSAGE: 0,
    DC_ERROR: 0,
    DC_CLOSE: 0,
    SETUP_DATA_CHANNEL: 0,
    SEND_MESSAGE: 0,
    CLOSE_CONNECTION: 0,
    ERROR: 0
  });
  const [eventsPerSecond, setEventsPerSecond] = useState(0);
  const [lastEventCount, setLastEventCount] = useState(0);
  const [lastEventTime, setLastEventTime] = useState(Date.now());
  const [selectedEventType, setSelectedEventType] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [activeFilters, setActiveFilters] = useState<{
    eventTypes: Set<string>;
    sources: Set<'local' | 'remote'>;
    categories: Set<'SIG' | 'RTC' | 'INT'>;
    origins: Set<'main' | 'polling' | 'internals'>;
  }>({
    eventTypes: new Set(),
    sources: new Set(),
    categories: new Set(),
    origins: new Set()
  });

  useEffect(() => {
    if (!peer || !channelId) return;

    const interval = setInterval(() => {
      // Get connection states
      const states = peer.getAllConnectionStates();
      setConnectionStates(states);

      // Update actors state
      const connection = (peer as any).connections.get(channelId);
      if (connection) {
        const mainSnapshot = connection.stateMachine.getSnapshot();
        const pollingSnapshot = mainSnapshot.context.pollingActor?.getSnapshot();

        const newActors: ActorState[] = [
          {
            id: 'main',
            state: String(mainSnapshot.value),
            context: {
              peerInitiatorId: mainSnapshot.context.peerInitiatorId,
              connectionState: mainSnapshot.context.peerConnection?.connectionState,
              iceConnectionState: mainSnapshot.context.peerConnection?.iceConnectionState,
              dataChannelState: mainSnapshot.context.dataChannel?.readyState,
            },
            lastUpdate: Date.now(),
            isActive: mainSnapshot.status === 'active'
          }
        ];

        if (pollingSnapshot) {
          newActors.push({
            id: 'polling',
            state: String(pollingSnapshot.value),
            context: {
              lastSeenIndex: pollingSnapshot.context.lastSeenIndex,
              currentPollingDelay: pollingSnapshot.context.currentPollingDelay,
              pollCount: pollingSnapshot.context.pollCount,
              channel: pollingSnapshot.context.channel?.id,
            },
            lastUpdate: Date.now(),
            isActive: pollingSnapshot.status === 'active'
          });
        }

        setActors(newActors);

        // Extract recent events from event history
        const eventHistory = mainSnapshot.context.eventHistory || [];
        const recentEvents = eventHistory.map((event: any, index: number) => ({
          id: `${event.timestamp}-${index}`,
          type: event.event.type,
          from: event.event.origin || 'unknown',
          to: 'main',
          timestamp: event.timestamp,
          data: event.event
        }));

        setMessages(recentEvents);

        // Count events by type
        const counts: Record<string, number> = { total: eventHistory.length };
        eventHistory.forEach((event: any) => {
          const eventType = event.event.type;
          counts[eventType] = (counts[eventType] || 0) + 1;
        });
        setEventCounts(counts);

        // Calculate events per second
        const now = Date.now();
        const timeDiff = (now - lastEventTime) / 1000; // in seconds
        if (timeDiff >= 1) {
          const eventDiff = counts.total - lastEventCount;
          const rate = eventDiff / timeDiff;
          setEventsPerSecond(Math.round(rate * 10) / 10); // Round to 1 decimal
          setLastEventCount(counts.total);
          setLastEventTime(now);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [peer, channelId]);

  const getStateColor = (state: string) => {
    switch (state) {
      case 'waitingForPeers': return '#fbbf24';
      case 'creatingOffer': return '#3b82f6';
      case 'waitingForAnswer': return '#8b5cf6';
      case 'waitingForOffer': return '#06b6d4';
      case 'creatingAnswer': return '#10b981';
      case 'processingAnswer': return '#f59e0b';
      case 'connected': return '#22c55e';
      case 'closing': return '#f97316';
      case 'error': return '#ef4444';
      case 'polling': return '#64748b';
      default: return '#6b7280';
    }
  };

  const getMessageColor = (type: string) => {
    switch (type) {
      case 'SIGNAL_JOIN_EVENT': return '#3b82f6';
      case 'SIGNAL_SDP_OFFER_EVENT': return '#8b5cf6';
      case 'SIGNAL_SDP_ANSWER_EVENT': return '#a855f7';
      case 'SIGNAL_ICE_EVENT': return '#06b6d4';
      case 'PC_ICE_CANDIDATE': return '#10b981';
      case 'PC_CONNECTION_STATE_CHANGE': return '#f59e0b';
      case 'DC_OPEN': return '#22c55e';
      case 'DC_MESSAGE': return '#ec4899';
      default: return '#6b7280';
    }
  };

    // Helper functions - defined first to avoid hoisting issues
    const getEventSource = (message: Message): 'local' | 'remote' => {
      // Check if this is a signaling event with peer data
      if (message.data && typeof message.data === 'object' && 'peerId' in message.data) {
        return message.data.peerId === peer?.id ? 'local' : 'remote';
      }
      // For non-signaling events (PC_, DC_, etc.), they are generated locally
      if (message.type.startsWith('PC_') || message.type.startsWith('DC_') || 
          message.type.startsWith('SETUP_') || message.type.startsWith('SEND_') ||
          message.type.startsWith('CLOSE_') || message.type.startsWith('ERROR')) {
        return 'local';
      }
      // Default fallback
      return message.from === 'external' ? 'remote' : 'local';
    };
  
    const isSignalEvent = (eventType: string): boolean => {
      return eventType.startsWith('SIGNAL_');
    };
  
    const isInternalEvent = (eventType: string): boolean => {
      return eventType === 'POLLING_EVENTS' || eventType.startsWith('xstate.done.actor.');
    };

    // Helper function to get colors for connection states
    const getConnectionStateColor = (state: string, type: 'connection' | 'ice' | 'dataChannel'): string => {
      if (type === 'connection') {
        switch (state) {
          case 'connected': return '#22c55e';
          case 'connecting': return '#fbbf24';
          case 'disconnected': return '#f97316';
          case 'failed': return '#ef4444';
          case 'closed': return '#6b7280';
          default: return '#9ca3af';
        }
      } else if (type === 'ice') {
        switch (state) {
          case 'connected': return '#22c55e';
          case 'completed': return '#10b981';
          case 'checking': return '#3b82f6';
          case 'gathering': return '#fbbf24';
          case 'disconnected': return '#f97316';
          case 'failed': return '#ef4444';
          case 'closed': return '#6b7280';
          default: return '#9ca3af';
        }
      } else if (type === 'dataChannel') {
        switch (state) {
          case 'open': return '#22c55e';
          case 'connecting': return '#fbbf24';
          case 'closing': return '#f97316';
          case 'closed': return '#6b7280';
          default: return '#9ca3af';
        }
      }
      return '#9ca3af';
    };

  // Apply all active filters to messages
  const filteredMessages = messages.filter(message => {
    // Event type filter
    if (selectedEventType && message.type !== selectedEventType) {
      return false;
    }

    // Source filter (LOCAL/REMOTE)
    if (activeFilters.sources.size > 0) {
      const source = getEventSource(message);
      if (!activeFilters.sources.has(source)) {
        return false;
      }
    }

    // Category filter (SIG/RTC/INT)
    if (activeFilters.categories.size > 0) {
      let category: 'SIG' | 'RTC' | 'INT';
      if (isInternalEvent(message.type)) {
        category = 'INT';
      } else if (isSignalEvent(message.type)) {
        category = 'SIG';
      } else {
        category = 'RTC';
      }
      
      if (!activeFilters.categories.has(category)) {
        return false;
      }
    }

    // Origin filter (main/polling/internals)
    if (activeFilters.origins.size > 0) {
      const origin = message.from as 'main' | 'polling' | 'internals';
      if (!activeFilters.origins.has(origin)) {
        return false;
      }
    }

    // Event type filter (specific event types)
    if (activeFilters.eventTypes.size > 0) {
      if (!activeFilters.eventTypes.has(message.type)) {
        return false;
      }
    }

    return true;
  });



  // Toggle message expansion
  const toggleMessageExpansion = (messageId: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedMessages(newExpanded);
  };

  // Helper functions for filter management
  const toggleSourceFilter = (source: 'local' | 'remote') => {
    const newSources = new Set(activeFilters.sources);
    if (newSources.has(source)) {
      newSources.delete(source);
    } else {
      newSources.add(source);
    }
    setActiveFilters(prev => ({ ...prev, sources: newSources }));
  };

  const toggleCategoryFilter = (category: 'SIG' | 'RTC' | 'INT') => {
    const newCategories = new Set(activeFilters.categories);
    if (newCategories.has(category)) {
      newCategories.delete(category);
    } else {
      newCategories.add(category);
    }
    setActiveFilters(prev => ({ ...prev, categories: newCategories }));
  };

  const toggleOriginFilter = (origin: 'main' | 'polling' | 'internals') => {
    const newOrigins = new Set(activeFilters.origins);
    if (newOrigins.has(origin)) {
      newOrigins.delete(origin);
    } else {
      newOrigins.add(origin);
    }
    setActiveFilters(prev => ({ ...prev, origins: newOrigins }));
  };

  const toggleEventTypeFilter = (eventType: string) => {
    const newEventTypes = new Set(activeFilters.eventTypes);
    if (newEventTypes.has(eventType)) {
      newEventTypes.delete(eventType);
    } else {
      newEventTypes.add(eventType);
    }
    setActiveFilters(prev => ({ ...prev, eventTypes: newEventTypes }));
  };

  const clearAllFilters = () => {
    setActiveFilters({
      eventTypes: new Set(),
      sources: new Set(),
      categories: new Set(),
      origins: new Set()
    });
    setSelectedEventType(null);
  };

  // Calculate counts based on current filters
  const getCounts = () => {
    const counts = {
      total: filteredMessages.length,
      bySource: { local: 0, remote: 0 },
      byCategory: { SIG: 0, RTC: 0, INT: 0 },
      byOrigin: { main: 0, polling: 0, internals: 0 },
      byEventType: {} as Record<string, number>
    };

    filteredMessages.forEach(message => {
      // Source counts
      const source = getEventSource(message);
      counts.bySource[source]++;

      // Category counts
      let category: 'SIG' | 'RTC' | 'INT';
      if (isInternalEvent(message.type)) {
        category = 'INT';
      } else if (isSignalEvent(message.type)) {
        category = 'SIG';
      } else {
        category = 'RTC';
      }
      counts.byCategory[category]++;

      // Origin counts
      const origin = message.from as 'main' | 'polling' | 'internals';
      if (origin && counts.byOrigin[origin] !== undefined) {
        counts.byOrigin[origin]++;
      }

      // Event type counts
      counts.byEventType[message.type] = (counts.byEventType[message.type] || 0) + 1;
    });

    return counts;
  };

  const counts = getCounts();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '384px',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      backdropFilter: 'blur(8px)',
      color: 'white',
      borderRadius: '8px',
      border: '1px solid #374151',
      fontFamily: 'monospace',
      fontSize: '12px',
      zIndex: 1000
    }}>
      <div style={{ padding: '12px', borderBottom: '1px solid #374151' }}>
        <h3 style={{ fontWeight: 'bold', fontSize: '14px', margin: 0 }}>WebRTC State Debugger ({peer.id})</h3>
        <p style={{ color: '#9ca3af', margin: '4px 0 0 0', fontSize: '12px' }}>Channel: {channelId || 'None'}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <p style={{ color: '#60a5fa', margin: 0, fontSize: '12px', fontWeight: 'bold' }}>
            Total Events: {eventCounts.total}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ 
              color: eventsPerSecond > 0 ? '#34d399' : '#6b7280', 
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              {eventsPerSecond} events/s
            </span>
            {eventsPerSecond > 0 && (
              <motion.div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#34d399'
                }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            )}
          </div>
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {/* Actors Section */}
        <div style={{ padding: '12px', borderBottom: '1px solid #374151' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontWeight: '600', color: '#d1d5db', fontSize: '12px', margin: 0 }}>Actors & States</h4>
            <div style={{ display: 'flex', gap: '8px', fontSize: '10px' }}>
              <span style={{ color: '#6b7280' }}>
                Active: {actors.filter(a => a.isActive).length}/{actors.length}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {actors.map((actor) => (
              <motion.div
                key={actor.id}
                layout
                style={{ 
                  backgroundColor: actor.isActive ? '#1f2937' : '#1a1a1a', 
                  borderRadius: '4px', 
                  padding: '8px', 
                  border: `1px solid ${actor.isActive ? getStateColor(actor.state) : '#4b5563'}`,
                  opacity: actor.isActive ? 1 : 0.7
                }}
                animate={{ scale: actor.isActive ? [1, 1.02, 1] : 1 }}
                transition={{ duration: 0.3 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <motion.div
                    style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      backgroundColor: actor.isActive ? getStateColor(actor.state) : '#6b7280'
                    }}
                    animate={{ opacity: actor.isActive ? [0.5, 1, 0.5] : 1 }}
                    transition={{ duration: 1, repeat: actor.isActive ? Infinity : 0 }}
                  />
                  <span style={{ fontWeight: 'bold' }}>{actor.id}</span>
                  <span style={{ 
                    fontSize: '10px', 
                    padding: '1px 4px', 
                    borderRadius: '3px',
                    backgroundColor: actor.isActive ? '#065f46' : '#7f1d1d',
                    color: actor.isActive ? '#34d399' : '#ef4444',
                    fontWeight: 'bold'
                  }}>
                    {actor.isActive ? 'ACTIVE' : 'STOPPED'}
                  </span>
                  <span style={{ color: '#9ca3af' }}>→</span>
                  <span style={{ color: actor.isActive ? getStateColor(actor.state) : '#6b7280' }}>
                    {actor.state}
                  </span>
                </div>
                
                {actor.context && (
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                    {Object.entries(actor.context).map(([key, value]) => {
                      let valueColor = 'white';
                      let displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                      
                      // Apply color coding for connection states
                      if (key === 'connectionState') {
                        valueColor = getConnectionStateColor(String(value), 'connection');
                      } else if (key === 'iceConnectionState') {
                        valueColor = getConnectionStateColor(String(value), 'ice');
                      } else if (key === 'dataChannelState') {
                        valueColor = getConnectionStateColor(String(value), 'dataChannel');
                      }
                      
                      return (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span>{key}:</span>
                          <span style={{ color: valueColor }}>
                            {displayValue}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>


        {/* Event Filters Section */}
        <div style={{ padding: '12px', borderBottom: '1px solid #374151' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontWeight: '600', color: '#d1d5db', fontSize: '12px', margin: 0 }}>
              Event Filters ({counts.total} events)
            </h4>
            {(activeFilters.sources.size > 0 || activeFilters.categories.size > 0 || activeFilters.origins.size > 0 || activeFilters.eventTypes.size > 0 || selectedEventType) && (
              <button
                onClick={clearAllFilters}
                style={{
                  backgroundColor: '#374151',
                  color: '#d1d5db',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '10px',
                  cursor: 'pointer'
                }}
              >
                Clear All
              </button>
            )}
          </div>

          {/* Source Filters */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>Source:</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['local', 'remote'] as const).map(source => (
                <button
                  key={source}
                  onClick={() => toggleSourceFilter(source)}
                  style={{
                    fontSize: '8px',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: activeFilters.sources.has(source) 
                      ? (source === 'local' ? '#065f46' : '#7c2d12')
                      : '#374151',
                    color: activeFilters.sources.has(source)
                      ? (source === 'local' ? '#34d399' : '#fb923c')
                      : '#9ca3af',
                    fontWeight: 'bold'
                  }}
                >
                  {source.toUpperCase()} ({counts.bySource[source]})
                </button>
              ))}
            </div>
          </div>

          {/* Category Filters */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>Category:</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['SIG', 'RTC', 'INT'] as const).map(category => (
                <button
                  key={category}
                  onClick={() => toggleCategoryFilter(category)}
                  style={{
                    fontSize: '8px',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: activeFilters.categories.has(category)
                      ? (category === 'INT' ? '#7c2d12' : category === 'SIG' ? '#312e81' : '#374151')
                      : '#374151',
                    color: activeFilters.categories.has(category)
                      ? (category === 'INT' ? '#fdba74' : category === 'SIG' ? '#a5b4fc' : '#9ca3af')
                      : '#9ca3af',
                    fontWeight: 'bold'
                  }}
                >
                  {category} ({counts.byCategory[category]})
                </button>
              ))}
            </div>
          </div>

          {/* Origin Filters */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>Origin:</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['main', 'polling', 'internals'] as const).map(origin => (
                <button
                  key={origin}
                  onClick={() => toggleOriginFilter(origin)}
                  style={{
                    fontSize: '8px',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: activeFilters.origins.has(origin)
                      ? (origin === 'main' ? '#1e40af' : origin === 'polling' ? '#0369a1' : '#059669')
                      : '#374151',
                    color: activeFilters.origins.has(origin)
                      ? (origin === 'main' ? '#93c5fd' : origin === 'polling' ? '#7dd3fc' : '#6ee7b7')
                      : '#9ca3af',
                    fontWeight: 'bold'
                  }}
                >
                  {origin.toUpperCase()} ({counts.byOrigin[origin]})
                </button>
              ))}
            </div>
          </div>

          {/* Event Type Filters */}
          <div>
            <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>Event Types:</div>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'row', 
              flexWrap: 'wrap',
              fontSize: '10px',
              maxHeight: '120px',
              overflowY: 'auto'
            }}>
              {Object.entries(counts.byEventType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <button
                    key={type} 
                    onClick={() => toggleEventTypeFilter(type)}
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      padding: '4px 8px',
                      backgroundColor: activeFilters.eventTypes.has(type) ? '#374151' : '#1f2937',
                      borderRadius: '4px',
                      borderTop: 'none',
                      borderRight: 'none',
                      borderBottom: 'none',
                      borderLeft: `2px solid ${getMessageColor(type)}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      textAlign: 'left',
                      width: 'calc(50% - 8px)',
                      marginBottom: '4px',
                      marginRight: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'

                    }}
                  >
                    <span style={{ color: getMessageColor(type), fontSize: '9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{type}</span>
                    <span style={{ color: 'white', fontWeight: 'bold', fontSize: '9px', marginLeft: 4 }}>{count}</span>
                  </button>
                ))
              }
              {Object.keys(counts.byEventType).length === 0 && (
                <div style={{ 
                  gridColumn: 'span 2', 
                  textAlign: 'center', 
                  color: '#6b7280',
                  padding: '8px'
                }}>
                  No events match current filters
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages Section */}
        <div style={{ padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontWeight: '600', color: '#d1d5db', fontSize: '12px', margin: 0 }}>
              {(activeFilters.sources.size > 0 || activeFilters.categories.size > 0 || activeFilters.origins.size > 0 || activeFilters.eventTypes.size > 0 || selectedEventType) 
                ? 'Filtered Messages' 
                : 'Recent Messages'}
            </h4>
            <span style={{ fontSize: '10px', color: '#6b7280' }}>
              {filteredMessages.length} of {messages.length}
            </span>
          </div>
          <div style={{ flex:1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <AnimatePresence mode="popLayout">
              {filteredMessages.slice().reverse().map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, x: 20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20, scale: 0.95 }}
                  style={{ 
                    backgroundColor: '#1f2937', 
                    borderRadius: '4px', 
                    padding: '8px', 
                    borderLeft: `2px solid ${getMessageColor(message.type)}`,
                    marginBottom: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <motion.div
                      style={{ 
                        width: '6px', 
                        height: '6px', 
                        borderRadius: '50%', 
                        backgroundColor: getMessageColor(message.type) 
                      }}
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.5 }}
                    />
                    <span style={{ color: getMessageColor(message.type) }}>
                      {message.type}
                    </span>
                    <span style={{ color: '#6b7280', fontSize: '10px' }}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                    
                    {/* Tags container */}
                    <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                      {/* Source tag */}
                      <span style={{
                        fontSize: '8px',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        backgroundColor: getEventSource(message) === 'local' ? '#065f46' : '#7c2d12',
                        color: getEventSource(message) === 'local' ? '#34d399' : '#fb923c',
                        fontWeight: 'bold'
                      }}>
                        {getEventSource(message).toUpperCase()}
                      </span>
                      
                      {/* Event type tag */}
                      <span style={{
                        fontSize: '8px',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        backgroundColor: isInternalEvent(message.type) ? '#7c2d12' : isSignalEvent(message.type) ? '#312e81' : '#374151',
                        color: isInternalEvent(message.type) ? '#fdba74' : isSignalEvent(message.type) ? '#a5b4fc' : '#9ca3af',
                        fontWeight: 'bold'
                      }}>
                        {isInternalEvent(message.type) ? 'INT' : isSignalEvent(message.type) ? 'SIG' : 'RTC'}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                    <span>{message.from}</span>
                    <span style={{ margin: '0 4px' }}>→</span>
                    <span>{message.to}</span>
                  </div>
                  
                  {message.data && (
                    <motion.div 
                      style={{ 
                        fontSize: '10px', 
                        color: '#d1d5db', 
                        marginTop: '4px', 
                        backgroundColor: '#111827', 
                        borderRadius: '4px', 
                        padding: '4px',
                        cursor: 'pointer',
                        border: '1px solid transparent',
                        transition: 'border-color 0.2s'
                      }}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMessageExpansion(message.id);
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.borderColor = '#374151';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.borderColor = 'transparent';
                      }}
                    >
                      {expandedMessages.has(message.id) ? (
                        <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                          {typeof message.data === 'object' 
                            ? JSON.stringify(message.data, null, 2)
                            : String(message.data)
                          }
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>
                            {typeof message.data === 'object' 
                              ? JSON.stringify(message.data, null, 1).substring(0, 80) + '...'
                              : String(message.data).substring(0, 80) + (String(message.data).length > 80 ? '...' : '')
                            }
                          </span>
                          <span style={{ 
                            color: '#6b7280', 
                            fontSize: '9px', 
                            marginLeft: '8px',
                            flexShrink: 0
                          }}>
                            click to expand
                          </span>
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Message Flow Visualization */}
      <div style={{ position: 'absolute', left: '-80px', top: '80px', width: '64px', height: '384px' }}>
        <AnimatePresence>
          {messages.slice(-5).map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ y: 0, opacity: 1 }}
              animate={{ y: -400, opacity: 0 }}
              transition={{ duration: 2, delay: index * 0.1 }}
              style={{ 
                position: 'absolute',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: getMessageColor(message.type),
                left: message.from === 'polling' ? 0 : 32
              }}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};