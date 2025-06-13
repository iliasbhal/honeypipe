import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createActor } from 'xstate'
import { HoneyPresenceSignal } from './HoneyPresenceSignal'
import { Room } from '../Room'
import { Peer } from '../Peer'
import { InMemorySignalingAdapter } from '../adapters/InMemorySignalingAdapter'

describe('HoneyPresenceSignal', () => {
  let room: Room
  let peer: Peer
  let signalingAdapter: InMemorySignalingAdapter
  let parentRef: any
  let testId: number = 0

  beforeEach(() => {
    // Create fresh instances for each test with unique room ID
    testId++
    signalingAdapter = new InMemorySignalingAdapter()
    room = new Room(`test-room-${testId}`, signalingAdapter)
    peer = new Peer({ peerId: 'test-peer-1' })
    parentRef = {
      send: vi.fn()
    }
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('should start in inactive state', () => {
    const actor = createActor(HoneyPresenceSignal, {
      input: {
        room,
        peer,
        parentRef
      }
    })

    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('inactive')
    expect(snapshot.context.room).toBe(room)
    expect(snapshot.context.peer).toBe(peer)
    expect(snapshot.context.aliveInterval).toBe(30000) // Default 30s
  })

  it('should use custom alive interval when provided', () => {
    const actor = createActor(HoneyPresenceSignal, {
      input: {
        room,
        peer,
        parentRef,
        aliveInterval: 60000 // 60s
      }
    })

    const snapshot = actor.getSnapshot()
    expect(snapshot.context.aliveInterval).toBe(60000)
  })

  it('should transition to active state and send join event when START is sent', async () => {
    const pushSpy = vi.spyOn(signalingAdapter, 'push')

    const actor = createActor(HoneyPresenceSignal, {
      input: {
        room,
        peer,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'START' })

    // Wait for async actions to complete
    await new Promise(resolve => setTimeout(resolve, 10))

    // Wait a bit more for the initial poll to complete and transition to wait
    await new Promise(resolve => setTimeout(resolve, 100))

    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toEqual({
      active: {
        polling: 'wait',
        aliveHeartbeat: 'waiting'
      }
    })

    // Should send join event
    expect(pushSpy).toHaveBeenCalledWith({
      peerId: 'test-peer-1',
      roomId: room.id,
      type: 'join'
    })
  })

  it('should send leave event when transitioning from active to inactive', async () => {
    const pushSpy = vi.spyOn(signalingAdapter, 'push')

    const actor = createActor(HoneyPresenceSignal, {
      input: {
        room,
        peer,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'START' })

    // Wait for start actions
    await new Promise(resolve => setTimeout(resolve, 10))

    // Clear the spy to ignore the join event
    pushSpy.mockClear()

    // Send STOP event
    actor.send({ type: 'STOP' })

    // Wait for async actions to complete
    await new Promise(resolve => setTimeout(resolve, 10))

    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('inactive')

    // Should send leave event
    expect(pushSpy).toHaveBeenCalledWith({
      peerId: 'test-peer-1',
      roomId: room.id,
      type: 'leave'
    })
  })

  it('should setup alive interval when entering active state', async () => {
    vi.useFakeTimers()
    const pushSpy = vi.spyOn(signalingAdapter, 'push')

    const actor = createActor(HoneyPresenceSignal, {
      input: {
        room,
        peer,
        parentRef,
        aliveInterval: 1000 // 1s for testing
      }
    })

    actor.start()
    actor.send({ type: 'START' })

    // Clear the spy to ignore the join event
    await vi.runOnlyPendingTimersAsync()
    pushSpy.mockClear()

    // Advance time by 1 second
    await vi.advanceTimersByTimeAsync(1000)

    // Should have sent alive event
    expect(pushSpy).toHaveBeenCalledWith({
      peerId: 'test-peer-1',
      roomId: room.id,
      type: 'alive'
    })

    // Advance time by another second
    pushSpy.mockClear()
    await vi.advanceTimersByTimeAsync(1000)

    // Should have sent another alive event
    expect(pushSpy).toHaveBeenCalledWith({
      peerId: 'test-peer-1',
      roomId: room.id,
      type: 'alive'
    })

    actor.stop()
  })

  it('should poll for presence events and notify parent', async () => {
    // Add some test events to the signaling adapter
    await signalingAdapter.push({ peerId: 'test-peer-2', roomId: room.id, type: 'join' })
    await signalingAdapter.push({ peerId: 'test-peer-3', roomId: room.id, type: 'join' })
    await signalingAdapter.push({ peerId: 'test-peer-2', roomId: room.id, type: 'leave' })
    await signalingAdapter.push({ peerId: 'test-peer-4', roomId: room.id, type: 'alive' })

    const actor = createActor(HoneyPresenceSignal, {
      input: {
        room,
        peer,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'START' })

    // Wait for polling to complete
    await new Promise(resolve => setTimeout(resolve, 1100)) // Wait for first poll

    // Should have notified parent about presence events (including our own join event)
    expect(parentRef.send).toHaveBeenCalledWith({
      type: 'PRESENCE_EVENTS',
      data: {
        events: [
          { peerId: 'test-peer-2', roomId: room.id, type: 'join' },
          { peerId: 'test-peer-3', roomId: room.id, type: 'join' },
          { peerId: 'test-peer-2', roomId: room.id, type: 'leave' },
          { peerId: 'test-peer-4', roomId: room.id, type: 'alive' },
          { peerId: 'test-peer-1', roomId: room.id, type: 'join' } // Our actor's join event
        ],
        newLastSeenIndex: 5
      },
      origin: 'presence-polling'
    })

    actor.stop()
  })

  it('should filter out non-presence events when polling', async () => {
    // Add mixed events to the signaling adapter
    await signalingAdapter.push({ peerId: 'test-peer-2', roomId: room.id, type: 'join' })
    await signalingAdapter.push({
      peerId: 'test-peer-2',
      channelId: 'some-channel-id',
      type: 'sdpOffer',
      data: { type: 'offer', sdp: 'mock' }
    })
    await signalingAdapter.push({
      peerId: 'test-peer-2',
      channelId: 'some-channel-id',
      type: 'iceCandidate',
      data: { candidate: '', sdpMLineIndex: 0, sdpMid: '' }
    })
    await signalingAdapter.push({ peerId: 'test-peer-2', roomId: room.id, type: 'leave' })

    const actor = createActor(HoneyPresenceSignal, {
      input: {
        room,
        peer,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'START' })

    // Wait for polling to complete
    await new Promise(resolve => setTimeout(resolve, 1100))

    // Should only notify about join and leave events, not sdp or ice (including our own join event)
    expect(parentRef.send).toHaveBeenCalledWith({
      type: 'PRESENCE_EVENTS',
      data: {
        events: [
          { peerId: 'test-peer-2', roomId: room.id, type: 'join' },
          { peerId: 'test-peer-2', roomId: room.id, type: 'leave' },
          { peerId: 'test-peer-1', roomId: room.id, type: 'join' } // Our actor's join event
        ],
        newLastSeenIndex: 3 // Only presence events: join, leave, our join
      },
      origin: 'presence-polling'
    })

    actor.stop()
  })

  it('should handle SEND_ALIVE event manually', async () => {
    const pushSpy = vi.spyOn(signalingAdapter, 'push')

    const actor = createActor(HoneyPresenceSignal, {
      input: {
        room,
        peer,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'START' })

    // Wait for start actions
    await new Promise(resolve => setTimeout(resolve, 10))

    // Clear the spy to ignore the join event
    pushSpy.mockClear()

    // Manually send alive event
    actor.send({ type: 'SEND_ALIVE' })

    // Wait for async action
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(pushSpy).toHaveBeenCalledWith({
      peerId: 'test-peer-1',
      roomId: room.id,
      type: 'alive'
    })

    actor.stop()
  })

  it('should use exponential backoff for polling delay when no events', async () => {
    vi.useFakeTimers()

    // Create a separate adapter and room for this test to avoid interference
    const testAdapter = new InMemorySignalingAdapter()
    const testRoom = new Room(`test-backoff-${Date.now()}`, testAdapter)
    const pullSpy = vi.spyOn(testAdapter, 'pull')

    const actor = createActor(HoneyPresenceSignal, {
      input: {
        room: testRoom,
        peer,
        parentRef,
        aliveInterval: 60000 // Long alive interval to avoid interference
      }
    })

    actor.start()
    actor.send({ type: 'START' })

    // First poll happens immediately on start
    await vi.advanceTimersByTimeAsync(0)
    expect(pullSpy).toHaveBeenCalledTimes(1)

    // Second poll should happen after 1s (initial delay)
    await vi.advanceTimersByTimeAsync(1000)
    expect(pullSpy).toHaveBeenCalledTimes(2)

    // Third poll should happen after 1.5s (backoff)
    await vi.advanceTimersByTimeAsync(1500)
    expect(pullSpy).toHaveBeenCalledTimes(3)

    actor.stop()
  })

  it('should reset polling delay when presence events are found', async () => {
    vi.useFakeTimers()
    const pullSpy = vi.spyOn(signalingAdapter, 'pull')

    const actor = createActor(HoneyPresenceSignal, {
      input: {
        room,
        peer,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'START' })

    // First few polls with no events (increasing delay)
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(1500)
    await vi.advanceTimersByTimeAsync(2250)

    // Add a presence event
    await signalingAdapter.push({ peerId: 'test-peer-2', roomId: room.id, type: 'join' })

    // Next poll should find the event and reset delay to base (1s)
    pullSpy.mockClear()
    await vi.advanceTimersByTimeAsync(3375) // Previous delay was 3.375s

    // The poll may happen multiple times during this period
    expect(pullSpy).toHaveBeenCalled()

    // Store current call count
    const callCountAfterReset = pullSpy.mock.calls.length

    // Next poll should happen after just 1s (reset to base)
    await vi.advanceTimersByTimeAsync(1000)
    expect(pullSpy).toHaveBeenCalledTimes(callCountAfterReset + 1)

    actor.stop()
  })

  it('should stop alive heartbeat when transitioning to inactive', async () => {
    vi.useFakeTimers()
    const pushSpy = vi.spyOn(signalingAdapter, 'push')

    const actor = createActor(HoneyPresenceSignal, {
      input: {
        room,
        peer,
        parentRef,
        aliveInterval: 1000
      }
    })

    actor.start()
    actor.send({ type: 'START' })

    // Wait for start actions
    await vi.runOnlyPendingTimersAsync()

    // Clear spy and advance time to trigger alive event
    pushSpy.mockClear()
    await vi.advanceTimersByTimeAsync(1000)

    // Should have sent alive event
    expect(pushSpy).toHaveBeenCalledWith({
      peerId: 'test-peer-1',
      roomId: room.id,
      type: 'alive'
    })

    // Stop the actor
    actor.send({ type: 'STOP' })

    // Clear spy and advance time again
    pushSpy.mockClear()
    await vi.advanceTimersByTimeAsync(2000)

    // Should NOT send any more alive events after stopping
    expect(pushSpy).not.toHaveBeenCalled()

    actor.stop()
  })
})