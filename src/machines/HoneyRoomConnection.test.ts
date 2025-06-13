import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createActor } from 'xstate'
import { HoneyRoomConnection } from './HoneyRoomConnection'
import { Channel } from '../Channel'
import { Peer } from '../Peer'
import { InMemorySignalingAdapter } from '../adapters/InMemorySignalingAdapter'
import wrtc from 'wrtc'

describe('HoneyRoomConnection', () => {
  let room: Channel<any>
  let localPeer: Peer
  let signalingAdapter: InMemorySignalingAdapter
  let rtcConfiguration: RTCConfiguration
  let parentRef: any
  let testId: number = 0

  beforeEach(() => {
    testId++
    signalingAdapter = new InMemorySignalingAdapter()
    room = new Channel(`test-room-${testId}`, signalingAdapter)
    localPeer = new Peer({ peerId: 'local-peer' })
    rtcConfiguration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    }
    parentRef = {
      send: vi.fn()
    }

    // Use real WebRTC classes from wrtc
    global.RTCPeerConnection = wrtc.RTCPeerConnection
    global.RTCSessionDescription = wrtc.RTCSessionDescription
    global.RTCIceCandidate = wrtc.RTCIceCandidate

    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('should start in disconnected state', () => {
    const actor = createActor(HoneyRoomConnection, {
      input: {
        room,
        localPeer,
        rtcConfiguration,
        parentRef
      }
    })

    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('disconnected')
    expect(snapshot.context.room).toBe(room)
    expect(snapshot.context.localPeer).toBe(localPeer)
    expect(snapshot.context.peerConnections.size).toBe(0)
    expect(snapshot.context.alivePeers.size).toBe(0)
  })

  it('should transition to connecting when JOIN_ROOM is sent', () => {
    const actor = createActor(HoneyRoomConnection, {
      input: {
        room,
        localPeer,
        rtcConfiguration,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'JOIN_ROOM' })

    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('connecting')
    expect(snapshot.context.presenceSignalActorRef).toBeDefined()
  })

  it('should transition to connected when presence events are received', () => {
    const actor = createActor(HoneyRoomConnection, {
      input: {
        room,
        localPeer,
        rtcConfiguration,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'JOIN_ROOM' })

    // Simulate presence events
    actor.send({
      type: 'PRESENCE_EVENTS',
      data: {
        events: [
          { peerId: 'local-peer', type: 'join' },
          { peerId: 'remote-peer-1', type: 'join' }
        ],
        newLastSeenIndex: 2
      },
      origin: 'presence-polling'
    })

    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('connected')
    expect(snapshot.context.alivePeers.has('remote-peer-1')).toBe(true)
    expect(snapshot.context.alivePeers.has('local-peer')).toBe(false) // Should not include own peer
  })

  it('should spawn peer connections for alive peers', () => {
    const actor = createActor(HoneyRoomConnection, {
      input: {
        room,
        localPeer,
        rtcConfiguration,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'JOIN_ROOM' })

    // Add multiple peers
    actor.send({
      type: 'PRESENCE_EVENTS',
      data: {
        events: [
          { peerId: 'local-peer', type: 'join' },
          { peerId: 'remote-peer-1', type: 'join' },
          { peerId: 'remote-peer-2', type: 'join' }
        ],
        newLastSeenIndex: 3
      },
      origin: 'presence-polling'
    })


    const snapshot = actor.getSnapshot()
    expect(snapshot.context.peerConnections.size).toBe(2) // Should not include connection to self
    expect(snapshot.context.peerConnections.has('remote-peer-1')).toBe(true)
    expect(snapshot.context.peerConnections.has('remote-peer-2')).toBe(true)
    expect(snapshot.context.peerConnections.has('local-peer')).toBe(false)
  })

  it('should remove peer connections when peers leave', () => {
    const actor = createActor(HoneyRoomConnection, {
      input: {
        room,
        localPeer,
        rtcConfiguration,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'JOIN_ROOM' })

    // Add peers
    actor.send({
      type: 'PRESENCE_EVENTS',
      data: {
        events: [
          { peerId: 'remote-peer-1', type: 'join' },
          { peerId: 'remote-peer-2', type: 'join' }
        ],
        newLastSeenIndex: 2
      },
      origin: 'presence-polling'
    })


    expect(actor.getSnapshot().context.peerConnections.size).toBe(2)

    // One peer leaves
    actor.send({
      type: 'PRESENCE_EVENTS',
      data: {
        events: [
          { peerId: 'remote-peer-1', type: 'leave' }
        ],
        newLastSeenIndex: 3
      },
      origin: 'presence-polling'
    })


    const snapshot = actor.getSnapshot()
    expect(snapshot.context.peerConnections.size).toBe(1)
    expect(snapshot.context.peerConnections.has('remote-peer-2')).toBe(true)
    expect(snapshot.context.peerConnections.has('remote-peer-1')).toBe(false)
    expect(snapshot.context.alivePeers.has('remote-peer-1')).toBe(false)
  })

  it('should send message to specific peer', () => {
    const actor = createActor(HoneyRoomConnection, {
      input: {
        room,
        localPeer,
        rtcConfiguration,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'JOIN_ROOM' })

    // Add a peer
    actor.send({
      type: 'PRESENCE_EVENTS',
      data: {
        events: [{ peerId: 'remote-peer-1', type: 'join' }],
        newLastSeenIndex: 1
      },
      origin: 'presence-polling'
    })


    const peerConnection = actor.getSnapshot().context.peerConnections.get('remote-peer-1')
    expect(peerConnection).toBeDefined()

    const sendSpy = vi.spyOn(peerConnection, 'send')

    actor.send({
      type: 'SEND_MESSAGE_TO_PEER',
      peerId: 'remote-peer-1',
      message: 'Hello peer 1'
    })

    expect(sendSpy).toHaveBeenCalledWith({
      type: 'SEND_MESSAGE',
      message: 'Hello peer 1'
    })
  })

  it('should send message to all peers', () => {
    const actor = createActor(HoneyRoomConnection, {
      input: {
        room,
        localPeer,
        rtcConfiguration,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'JOIN_ROOM' })

    // Add multiple peers
    actor.send({
      type: 'PRESENCE_EVENTS',
      data: {
        events: [
          { peerId: 'remote-peer-1', type: 'join' },
          { peerId: 'remote-peer-2', type: 'join' }
        ],
        newLastSeenIndex: 2
      },
      origin: 'presence-polling'
    })


    const peerConnection1 = actor.getSnapshot().context.peerConnections.get('remote-peer-1')
    const peerConnection2 = actor.getSnapshot().context.peerConnections.get('remote-peer-2')
    
    const sendSpy1 = vi.spyOn(peerConnection1, 'send')
    const sendSpy2 = vi.spyOn(peerConnection2, 'send')

    actor.send({
      type: 'SEND_MESSAGE_TO_ALL',
      message: 'Hello everyone'
    })

    expect(sendSpy1).toHaveBeenCalledWith({
      type: 'SEND_MESSAGE',
      message: 'Hello everyone'
    })
    expect(sendSpy2).toHaveBeenCalledWith({
      type: 'SEND_MESSAGE',
      message: 'Hello everyone'
    })
  })

  it('should send message to specific data channel', () => {
    const actor = createActor(HoneyRoomConnection, {
      input: {
        room,
        localPeer,
        rtcConfiguration,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'JOIN_ROOM' })

    // Add a peer
    actor.send({
      type: 'PRESENCE_EVENTS',
      data: {
        events: [{ peerId: 'remote-peer-1', type: 'join' }],
        newLastSeenIndex: 1
      },
      origin: 'presence-polling'
    })


    const peerConnection = actor.getSnapshot().context.peerConnections.get('remote-peer-1')
    const sendSpy = vi.spyOn(peerConnection, 'send')

    actor.send({
      type: 'SEND_MESSAGE_TO_DATACHANNEL',
      peerId: 'remote-peer-1',
      label: 'custom-channel',
      message: 'Hello custom channel'
    })

    expect(sendSpy).toHaveBeenCalledWith({
      type: 'SEND_DATA_CHANNEL_MESSAGE',
      label: 'custom-channel',
      message: 'Hello custom channel'
    })
  })

  it('should ignore messages to non-alive peers', () => {
    const actor = createActor(HoneyRoomConnection, {
      input: {
        room,
        localPeer,
        rtcConfiguration,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'JOIN_ROOM' })
    actor.send({
      type: 'PRESENCE_EVENTS',
      data: { events: [], newLastSeenIndex: 0 },
      origin: 'presence-polling'
    })


    // Try to send message to non-existent peer
    actor.send({
      type: 'SEND_MESSAGE_TO_PEER',
      peerId: 'non-existent-peer',
      message: 'Hello'
    })

    // Should not throw or cause issues
    expect(actor.getSnapshot().value).toBe('connected')
  })

  it('should notify parent when peer connections are established', () => {
    const actor = createActor(HoneyRoomConnection, {
      input: {
        room,
        localPeer,
        rtcConfiguration,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'JOIN_ROOM' })
    actor.send({
      type: 'PRESENCE_EVENTS',
      data: { events: [], newLastSeenIndex: 0 },
      origin: 'presence-polling'
    })


    actor.send({
      type: 'PEER_CONNECTION_ESTABLISHED',
      remotePeerId: 'remote-peer-1'
    })

    expect(parentRef.send).toHaveBeenCalledWith({
      type: 'ROOM_PEER_CONNECTED',
      roomId: room.id,
      peerId: 'remote-peer-1'
    })
  })

  it('should notify parent when messages are received', () => {
    const actor = createActor(HoneyRoomConnection, {
      input: {
        room,
        localPeer,
        rtcConfiguration,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'JOIN_ROOM' })
    actor.send({
      type: 'PRESENCE_EVENTS',
      data: { events: [], newLastSeenIndex: 0 },
      origin: 'presence-polling'
    })


    actor.send({
      type: 'PEER_MESSAGE_RECEIVED',
      remotePeerId: 'remote-peer-1',
      message: 'Hello from remote'
    })

    expect(parentRef.send).toHaveBeenCalledWith({
      type: 'ROOM_MESSAGE_RECEIVED',
      roomId: room.id,
      fromPeerId: 'remote-peer-1',
      message: 'Hello from remote'
    })
  })

  it('should cleanup when leaving room', () => {
    const actor = createActor(HoneyRoomConnection, {
      input: {
        room,
        localPeer,
        rtcConfiguration,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'JOIN_ROOM' })

    // Add peers
    actor.send({
      type: 'PRESENCE_EVENTS',
      data: {
        events: [{ peerId: 'remote-peer-1', type: 'join' }],
        newLastSeenIndex: 1
      },
      origin: 'presence-polling'
    })


    expect(actor.getSnapshot().context.peerConnections.size).toBe(1)

    // Leave room
    actor.send({ type: 'LEAVE_ROOM' })

    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('disconnected')
  })

  it('should handle alive events to maintain peer presence', () => {
    const actor = createActor(HoneyRoomConnection, {
      input: {
        room,
        localPeer,
        rtcConfiguration,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'JOIN_ROOM' })

    // Initial join
    actor.send({
      type: 'PRESENCE_EVENTS',
      data: {
        events: [{ peerId: 'remote-peer-1', type: 'join' }],
        newLastSeenIndex: 1
      },
      origin: 'presence-polling'
    })


    expect(actor.getSnapshot().context.alivePeers.has('remote-peer-1')).toBe(true)

    // Alive event
    actor.send({
      type: 'PRESENCE_EVENTS',
      data: {
        events: [{ peerId: 'remote-peer-1', type: 'alive' }],
        newLastSeenIndex: 2
      },
      origin: 'presence-polling'
    })

    const snapshot = actor.getSnapshot()
    expect(snapshot.context.alivePeers.has('remote-peer-1')).toBe(true)
    expect(snapshot.context.peerConnections.size).toBe(1) // Should not create duplicate connections
  })
})