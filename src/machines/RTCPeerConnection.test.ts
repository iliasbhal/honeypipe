import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createActor } from 'xstate'
import { RTCPeerConnectionMachine } from './RTCPeerConnection'
import wrtc from 'wrtc'

describe('RTCPeerConnectionMachine', () => {
  let parentRef: any
  let rtcConfiguration: RTCConfiguration

  beforeEach(() => {
    parentRef = {
      send: vi.fn()
    }

    rtcConfiguration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    }

    // Use real WebRTC classes from wrtc
    global.RTCPeerConnection = wrtc.RTCPeerConnection
    global.RTCSessionDescription = wrtc.RTCSessionDescription
    global.RTCIceCandidate = wrtc.RTCIceCandidate
  })

  it('should start in initializing state', () => {
    const actor = createActor(RTCPeerConnectionMachine, {
      input: {
        configuration: rtcConfiguration,
        parentRef
      }
    })

    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('initializing')
  })

  it('should create offer and notify parent', async () => {
    const actor = createActor(RTCPeerConnectionMachine, {
      input: {
        configuration: rtcConfiguration,
        parentRef
      }
    })

    actor.start()
    actor.send({ type: 'CREATE_OFFER' })

    // Wait for offer creation
    await new Promise(resolve => setTimeout(resolve, 100))

    // Should have notified parent about offer creation
    expect(parentRef.send).toHaveBeenCalledWith({
      type: 'RTC_OFFER_CREATED',
      offer: expect.objectContaining({ type: 'offer' })
    })
  })

  it('should create data channel and notify parent', () => {
    const actor = createActor(RTCPeerConnectionMachine, {
      input: {
        configuration: rtcConfiguration,
        parentRef
      }
    })

    actor.start()
    actor.send({
      type: 'CREATE_DATA_CHANNEL',
      label: 'test-channel',
      options: { ordered: true }
    })

    // Should have notified parent about data channel creation
    expect(parentRef.send).toHaveBeenCalledWith({
      type: 'RTC_DATA_CHANNEL_CREATED',
      label: 'test-channel',
      dataChannel: expect.any(Object)
    })
  })
})