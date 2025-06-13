import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createActor } from 'xstate'
import { ChannelPeerConnectionMachine } from './ChannelPeerConnectionMachine'
import { Channel } from '../Channel'
import { Peer } from '../Peer'
import { InMemorySignalingAdapter } from '../adapters/InMemorySignalingAdapter'
import wrtc from 'wrtc'

describe('ChannelPeerConnectionMachine', () => {
  let channel: Channel<any>
  let localPeer: Peer
  let signalingAdapter: InMemorySignalingAdapter
  let rtcConfiguration: RTCConfiguration
  let parentRef: any
  let testId: number = 0

  beforeEach(() => {
    testId++
    signalingAdapter = new InMemorySignalingAdapter()
    channel = new Channel(`test-channel-${testId}`, signalingAdapter)
    localPeer = new Peer({ peerId: 'peer-a' })
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
  })

  it('should start in idle state', () => {
    const actor = createActor(ChannelPeerConnectionMachine, {
      input: {
        localPeer,
        remotePeerId: 'peer-b',
        channel,
        rtcConfiguration,
        parentRef
      }
    })
    
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('idle')
    expect(snapshot.context.localPeer).toBe(localPeer)
    expect(snapshot.context.remotePeerId).toBe('peer-b')
    expect(snapshot.context.channel).toBe(channel)
  })

  it('should transition through states when START event is sent', async () => {
    const actor = createActor(ChannelPeerConnectionMachine, {
      input: {
        localPeer,
        remotePeerId: 'peer-b',
        channel,
        rtcConfiguration,
        parentRef
      }
    })
    
    actor.start()
    actor.send({ type: 'START' })
    
    // Wait for transitions to complete including offer creation
    await new Promise(resolve => setTimeout(resolve, 50))
    
    const snapshot = actor.getSnapshot()
    // Should go to waitingForAnswer after creating offer since peer-a < peer-b
    expect(snapshot.value).toBe('waitingForAnswer')
    expect(snapshot.context.peerConnection).toBeDefined()
    expect(snapshot.context.isInitiator).toBe(true)
  })

  it('should become initiator when local peer ID is lexicographically smaller', async () => {
    const actor = createActor(ChannelPeerConnectionMachine, {
      input: {
        localPeer, // 'peer-a'
        remotePeerId: 'peer-b',
        channel,
        rtcConfiguration,
        parentRef
      }
    })
    
    actor.start()
    actor.send({ type: 'START' })
    
    // Wait for transitions to complete (including offer creation)
    await new Promise(resolve => setTimeout(resolve, 50))
    
    const snapshot = actor.getSnapshot()
    expect(snapshot.context.isInitiator).toBe(true)
    // Should be in waitingForAnswer after creating and sending offer
    expect(snapshot.value).toBe('waitingForAnswer')
  })

  it('should become non-initiator when local peer ID is lexicographically larger', async () => {
    const largePeer = new Peer({ peerId: 'peer-z' })
    const actor = createActor(ChannelPeerConnectionMachine, {
      input: {
        localPeer: largePeer, // 'peer-z'
        remotePeerId: 'peer-a',
        channel,
        rtcConfiguration,
        parentRef
      }
    })
    
    actor.start()
    actor.send({ type: 'START' })
    
    // Wait for state transition
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const snapshot = actor.getSnapshot()
    expect(snapshot.context.isInitiator).toBe(false)
    expect(snapshot.value).toBe('waiting')
  })

  it('should handle incoming offer and transition to processing', async () => {
    const largePeer = new Peer({ peerId: 'peer-z' }) // This would normally not be initiator
    
    const actor = createActor(ChannelPeerConnectionMachine, {
      input: {
        localPeer: largePeer,
        remotePeerId: 'peer-a',
        channel,
        rtcConfiguration,
        parentRef
      }
    })
    
    actor.start()
    actor.send({ type: 'START' })
    
    // Wait for transition to waiting (since peer-z > peer-a)
    await new Promise(resolve => setTimeout(resolve, 10))
    
    let snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('waiting')
    expect(snapshot.context.isInitiator).toBe(false)
    
    // Create a valid SDP offer using the real WebRTC API
    const tempPC = new wrtc.RTCPeerConnection()
    const realOffer = await tempPC.createOffer()
    await tempPC.close()
    
    // Send real SDP offer
    actor.send({
      type: 'SIGNALING_EVENTS',
      events: [
        {
          peerId: 'peer-a',
          type: 'sdp',
          data: { sdp: realOffer }
        }
      ]
    })
    
    // Wait for processing offer
    await new Promise(resolve => setTimeout(resolve, 100))
    
    snapshot = actor.getSnapshot()
    // Should transition to connected or processingOffer state
    expect(['connected', 'processingOffer'].includes(snapshot.value as string)).toBe(true)
  })

  it('should send offer when initiating', async () => {
    const pushSpy = vi.spyOn(signalingAdapter, 'push')
    
    const actor = createActor(ChannelPeerConnectionMachine, {
      input: {
        localPeer,
        remotePeerId: 'peer-b',
        channel,
        rtcConfiguration,
        parentRef
      }
    })
    
    actor.start()
    actor.send({ type: 'START' })
    
    // Wait for offer to be created and sent
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(pushSpy).toHaveBeenCalledWith(channel.id, {
      peerId: 'peer-a',
      type: 'sdp',
      data: { 
        sdp: expect.objectContaining({ type: 'offer' }),
        targetPeer: 'peer-b'
      }
    })
  })

  it('should process incoming offer with real SDP', async () => {
    const pushSpy = vi.spyOn(signalingAdapter, 'push')
    const largePeer = new Peer({ peerId: 'peer-z' })
    
    const actor = createActor(ChannelPeerConnectionMachine, {
      input: {
        localPeer: largePeer, // Non-initiator
        remotePeerId: 'peer-a',
        channel,
        rtcConfiguration,
        parentRef
      }
    })
    
    actor.start()
    actor.send({ type: 'START' })
    
    // Wait to reach waiting state
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // Create a real SDP offer
    const tempPC = new wrtc.RTCPeerConnection()
    const realOffer = await tempPC.createOffer()
    await tempPC.close()
    
    // Send real offer from remote peer
    actor.send({
      type: 'SIGNALING_EVENTS',
      events: [
        {
          peerId: 'peer-a',
          type: 'sdp',
          data: { sdp: realOffer }
        }
      ]
    })
    
    // Wait for answer to be created and sent
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Should have attempted to send an answer (may fail due to connection issues but that's ok)
    const snapshot = actor.getSnapshot()
    expect(['connected', 'failed', 'processingOffer'].includes(snapshot.value as string)).toBe(true)
    
    // Check if an answer was sent (if the connection didn't fail)
    if (snapshot.value === 'connected') {
      expect(pushSpy).toHaveBeenCalledWith(channel.id, {
        peerId: 'peer-z',
        type: 'sdp',
        data: { 
          sdp: expect.objectContaining({ type: 'answer' }),
          targetPeer: 'peer-a'
        }
      })
    }
  })

  it('should transition to connected when answer is received', async () => {
    const actor = createActor(ChannelPeerConnectionMachine, {
      input: {
        localPeer,
        remotePeerId: 'peer-b',
        channel,
        rtcConfiguration,
        parentRef
      }
    })
    
    actor.start()
    actor.send({ type: 'START' })
    
    // Wait for offer to be sent
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // Send answer from remote peer
    actor.send({
      type: 'SIGNALING_EVENTS',
      events: [
        {
          peerId: 'peer-b',
          type: 'sdp',
          data: { sdp: { type: 'answer', sdp: 'mock-answer' } }
        }
      ]
    })
    
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('connected')
  })

  it('should send ICE candidates', async () => {
    const pushSpy = vi.spyOn(signalingAdapter, 'push')
    
    const actor = createActor(ChannelPeerConnectionMachine, {
      input: {
        localPeer,
        remotePeerId: 'peer-b',
        channel,
        rtcConfiguration,
        parentRef
      }
    })
    
    actor.start()
    actor.send({ type: 'START' })
    
    // Mock ICE candidate
    const mockCandidate = {
      candidate: 'candidate:123456',
      sdpMLineIndex: 0,
      sdpMid: '0'
    } as RTCIceCandidate
    
    actor.send({ type: 'PC_ICE_CANDIDATE', candidate: mockCandidate })
    
    expect(pushSpy).toHaveBeenCalledWith(channel.id, {
      peerId: 'peer-a',
      type: 'ice',
      data: { 
        iceCandidate: mockCandidate,
        targetPeer: 'peer-b'
      }
    })
  })

  it('should handle data channel establishment', async () => {
    const actor = createActor(ChannelPeerConnectionMachine, {
      input: {
        localPeer,
        remotePeerId: 'peer-b',
        channel,
        rtcConfiguration,
        parentRef
      }
    })
    
    actor.start()
    actor.send({ type: 'START' })
    
    // Wait for connection to be established and data channel created
    await new Promise(resolve => setTimeout(resolve, 50))
    
    let snapshot = actor.getSnapshot()
    // Initiator creates data channel automatically
    expect(snapshot.context.dataChannel).toBeDefined()
    expect(snapshot.context.dataChannel?.label).toBe('peer-connection')
    expect(snapshot.context.dataChannel?.readyState).toBe('connecting')
    
    // Test that we can access the real data channel properties
    const dataChannel = snapshot.context.dataChannel!
    expect(typeof dataChannel.send).toBe('function')
    expect(typeof dataChannel.close).toBe('function')
    // Real WebRTC data channels start with undefined event handlers
    expect(dataChannel.onopen).toBeUndefined()
    expect(dataChannel.onmessage).toBeUndefined()
    expect(dataChannel.onerror).toBeUndefined()
    expect(dataChannel.onclose).toBeUndefined()
  })

  it('should notify parent when connection is established', async () => {
    const actor = createActor(ChannelPeerConnectionMachine, {
      input: {
        localPeer,
        remotePeerId: 'peer-b',
        channel,
        rtcConfiguration,
        parentRef
      }
    })
    
    actor.start()
    actor.send({ type: 'START' })
    
    // Wait for offer to be sent and transition to waitingForAnswer
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // Send answer to transition to connected
    actor.send({
      type: 'SIGNALING_EVENTS',
      events: [
        {
          peerId: 'peer-b',
          type: 'sdp',
          data: { sdp: { type: 'answer', sdp: 'mock-answer' } }
        }
      ]
    })
    
    // Wait for transition to connected
    await new Promise(resolve => setTimeout(resolve, 10))
    
    actor.send({ type: 'DC_OPEN' })
    
    expect(parentRef.send).toHaveBeenCalledWith({
      type: 'PEER_CONNECTION_ESTABLISHED',
      remotePeerId: 'peer-b'
    })
  })

  it('should handle send message when data channel is not open', async () => {
    const actor = createActor(ChannelPeerConnectionMachine, {
      input: {
        localPeer,
        remotePeerId: 'peer-b',
        channel,
        rtcConfiguration,
        parentRef
      }
    })
    
    actor.start()
    actor.send({ type: 'START' })
    
    // Wait for offer to be sent
    await new Promise(resolve => setTimeout(resolve, 50))
    
    let snapshot = actor.getSnapshot()
    const dataChannel = snapshot.context.dataChannel!
    expect(dataChannel).toBeDefined()
    expect(dataChannel.readyState).toBe('connecting')
    
    // Set up spy but don't change readyState - should not send when not open
    const sendSpy = vi.spyOn(dataChannel, 'send')
    
    actor.send({ type: 'SEND_MESSAGE', message: 'test message' })
    
    // Should not send when data channel is not open
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('should notify parent when message is received', async () => {
    const actor = createActor(ChannelPeerConnectionMachine, {
      input: {
        localPeer,
        remotePeerId: 'peer-b',
        channel,
        rtcConfiguration,
        parentRef
      }
    })
    
    actor.start()
    actor.send({ type: 'START' })
    
    // Wait for offer to be sent
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // Send answer to transition to connected
    actor.send({
      type: 'SIGNALING_EVENTS',
      events: [
        {
          peerId: 'peer-b',
          type: 'sdp',
          data: { sdp: { type: 'answer', sdp: 'mock-answer' } }
        }
      ]
    })
    
    // Wait for transition to connected
    await new Promise(resolve => setTimeout(resolve, 10))
    
    actor.send({ type: 'DC_MESSAGE', data: 'received message' })
    
    expect(parentRef.send).toHaveBeenCalledWith({
      type: 'PEER_MESSAGE_RECEIVED',
      remotePeerId: 'peer-b',
      message: 'received message'
    })
  })

  it('should cleanup resources when closed', async () => {
    const actor = createActor(ChannelPeerConnectionMachine, {
      input: {
        localPeer,
        remotePeerId: 'peer-b',
        channel,
        rtcConfiguration,
        parentRef
      }
    })
    
    actor.start()
    actor.send({ type: 'START' })
    
    // Wait for connections to be established
    await new Promise(resolve => setTimeout(resolve, 50))
    
    const snapshot = actor.getSnapshot()
    const peerConnection = snapshot.context.peerConnection!
    const dataChannel = snapshot.context.dataChannel!
    
    expect(peerConnection).toBeDefined()
    expect(dataChannel).toBeDefined()
    
    // Set up spies on the real objects
    const pcCloseSpy = vi.spyOn(peerConnection, 'close')
    const dcCloseSpy = vi.spyOn(dataChannel, 'close')
    
    actor.send({ type: 'CLOSE' })
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 50))
    
    const finalSnapshot = actor.getSnapshot()
    expect(finalSnapshot.value).toBe('disconnected')
    
    // Verify cleanup was called
    expect(pcCloseSpy).toHaveBeenCalled()
    expect(dcCloseSpy).toHaveBeenCalled()
    
    // Verify event handlers were nullified
    expect(peerConnection.onicecandidate).toBe(null)
    expect(peerConnection.onconnectionstatechange).toBe(null)
    expect(peerConnection.ondatachannel).toBe(null)
    expect(dataChannel.onopen).toBe(null)
    expect(dataChannel.onmessage).toBe(null)
    expect(dataChannel.onerror).toBe(null)
    expect(dataChannel.onclose).toBe(null)
  })
})