import express from 'express'
import { SignalingEvent } from '../src/adapters/_base'

export const app = express()
const api = express.Router()

// Middleware to parse JSON bodies
app.use(express.json())
app.use('/api', api);

// In-memory storage for signaling events
interface EventStore {
  events: SignalingEvent[];
}

const roomTimelines = new Map<string, EventStore>();
const channelTimelines = new Map<string, EventStore>();

// Helper to get or create timeline
function getTimeline(isChannel: boolean, id: string): EventStore {
  const store = isChannel ? channelTimelines : roomTimelines;
  if (!store.has(id)) {
    store.set(id, { events: [] });
  }
  return store.get(id)!;
}

// POST /api/signaling/push - Push a signaling event
api.post('/signaling/push', (req, res) => {
  try {
    const event = req.body as SignalingEvent;
    
    // Validate event
    if (!event || !event.peerId) {
      return res.status(400).json({ error: 'Invalid event: missing peerId' });
    }

    // Determine if it's a channel or room event
    const isChannel = 'channelId' in event;
    const id = isChannel ? event.channelId : event.roomId;
    
    if (!id) {
      return res.status(400).json({ error: 'Invalid event: missing channelId or roomId' });
    }

    // Get timeline and push event
    const timeline = getTimeline(isChannel, id);
    timeline.events.push(event);
    
    // Return the new index (length - 1) 
    const index = timeline.events.length - 1;
    
    console.log(`[Signaling] Pushed event to ${isChannel ? 'channel' : 'room'} ${id}:`, event.type, 'index:', index);
    
    res.json({ index, length: timeline.events.length });
  } catch (error) {
    console.error('[Signaling] Push error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/signaling/pull - Pull signaling events
api.get('/signaling/pull', (req, res) => {
  try {
    const { channelId, roomId, offsetIndex } = req.query;
    
    // Validate request
    if (!channelId && !roomId) {
      return res.status(400).json({ error: 'Missing channelId or roomId' });
    }
    
    if (channelId && roomId) {
      return res.status(400).json({ error: 'Cannot specify both channelId and roomId' });
    }

    const isChannel = !!channelId;
    const id = (isChannel ? channelId : roomId) as string;
    const offset = offsetIndex ? parseInt(offsetIndex as string) : 0;
    
    // Validate offset
    if (isNaN(offset) || offset < 0) {
      return res.status(400).json({ error: 'Invalid offsetIndex' });
    }

    // Get timeline
    const timeline = getTimeline(isChannel, id);
    
    // Return events from offset
    const events = timeline.events.slice(offset);
    
    console.log(`[Signaling] Pulled ${events.length} events from ${isChannel ? 'channel' : 'room'} ${id} (offset: ${offset})`);
    
    res.json(events);
  } catch (error) {
    console.error('[Signaling] Pull error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Optional: Debug endpoint to view all timelines
api.get('/signaling/debug', (req, res) => {
  const debug = {
    rooms: {} as Record<string, any>,
    channels: {} as Record<string, any>
  };
  
  roomTimelines.forEach((timeline, roomId) => {
    debug.rooms[roomId] = {
      eventCount: timeline.events.length,
      events: timeline.events
    };
  });
  
  channelTimelines.forEach((timeline, channelId) => {
    debug.channels[channelId] = {
      eventCount: timeline.events.length,
      events: timeline.events
    };
  });
  
  res.json(debug);
});

// Optional: Clear all events (useful for testing)
api.post('/signaling/clear', (req, res) => {
  roomTimelines.clear();
  channelTimelines.clear();
  console.log('[Signaling] Cleared all timelines');
  res.json({ message: 'All timelines cleared' });
});
