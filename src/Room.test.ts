import { describe, it, expect, beforeEach } from 'vitest'
import { Room } from './Room'
import { Peer } from './Peer'
import { InMemorySignalingAdapter } from './adapters/InMemorySignalingAdapter'

describe('Room Integration', () => {
  let room: Room
  let signalingAdapter: InMemorySignalingAdapter
  let peer1: Peer
  let peer2: Peer
  let rtcConfiguration: RTCConfiguration

  beforeEach(() => {
    signalingAdapter = new InMemorySignalingAdapter()
    rtcConfiguration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    }
    room = new Room('test-room', signalingAdapter, rtcConfiguration)
    peer1 = new Peer({ peerId: 'alice' })
    peer2 = new Peer({ peerId: 'bob' })
  })

  it('should allow peers to join and leave rooms', async () => {
    expect(room.getPeerCount()).toBe(0)
    expect(room.isRoomActive()).toBe(true)

    // Join room
    await peer1.joinRoom(room)
    expect(room.getPeerCount()).toBe(1)
    expect(room.hasPeer('alice')).toBe(true)
    expect(peer1.getRoomConnectionState(room.id)).toBe('connecting')

    // Second peer joins
    await peer2.joinRoom(room)
    expect(room.getPeerCount()).toBe(2)
    expect(room.hasPeer('bob')).toBe(true)

    // Leave room
    await peer1.leaveRoom(room)
    expect(room.getPeerCount()).toBe(1)
    expect(room.hasPeer('alice')).toBe(false)
    expect(room.hasPeer('bob')).toBe(true)
  })

  it('should prevent joining stopped rooms', async () => {
    room.stop()
    expect(room.isRoomActive()).toBe(false)

    await expect(peer1.joinRoom(room)).rejects.toThrow('Cannot join stopped room test-room')
  })

  it('should provide messaging capabilities', async () => {
    await peer1.joinRoom(room)

    // These should not throw errors even if no connections are established yet
    peer1.sendMessageToPeer(room.id, 'bob', 'Hello Bob!')
    peer1.sendMessageToAll(room.id, 'Hello everyone!')
    peer1.sendMessageToDataChannel(room.id, 'bob', 'custom-channel', 'Custom message')
  })

  it('should track room states', async () => {
    await peer1.joinRoom(room)
    
    const states = peer1.getAllRoomStates()
    expect(states[room.id]).toBeDefined()
    expect(states[room.id].connectionState).toBeDefined()
    expect(states[room.id].alivePeers).toEqual([])
  })

  it('should cleanup properly when peer closes', async () => {
    await peer1.joinRoom(room)
    await peer2.joinRoom(room)
    
    expect(room.getPeerCount()).toBe(2)
    
    await peer1.close()
    expect(room.getPeerCount()).toBe(1)
    expect(room.hasPeer('alice')).toBe(false)
    expect(room.hasPeer('bob')).toBe(true)
  })

  it('should handle room stopping with connected peers', async () => {
    await peer1.joinRoom(room)
    await peer2.joinRoom(room)
    
    expect(room.getPeerCount()).toBe(2)
    
    // When room stops, it clears peer IDs but doesn't directly disconnect peers
    // (In a real distributed system, peers would detect room closure through signaling)
    room.stop()
    expect(room.getPeerCount()).toBe(0)
    expect(room.isRoomActive()).toBe(false)
  })

  it('should use the provided rtcConfiguration', () => {
    expect(room.rtcConfiguration).toBe(rtcConfiguration)
    expect(room.rtcConfiguration.iceServers).toEqual([{ urls: 'stun:stun.l.google.com:19302' }])
  })

  it('should use default rtcConfiguration when none provided', () => {
    const roomWithDefaults = new Room('default-room', signalingAdapter)
    expect(roomWithDefaults.rtcConfiguration).toBeDefined()
    expect(roomWithDefaults.rtcConfiguration.iceServers).toEqual([
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" }
    ])
    expect(roomWithDefaults.rtcConfiguration.iceCandidatePoolSize).toBe(10)
  })

  it('should track peer IDs only (not instances)', async () => {
    expect(room.getConnectedPeerIds()).toEqual([])
    
    await peer1.joinRoom(room)
    await peer2.joinRoom(room)
    
    const peerIds = room.getConnectedPeerIds()
    expect(peerIds).toContain('alice')
    expect(peerIds).toContain('bob')
    expect(peerIds.length).toBe(2)
    
    await peer1.leaveRoom(room)
    
    const remainingPeerIds = room.getConnectedPeerIds()
    expect(remainingPeerIds).toContain('bob')
    expect(remainingPeerIds).not.toContain('alice')
    expect(remainingPeerIds.length).toBe(1)
  })
});