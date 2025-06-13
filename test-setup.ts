// Test setup for vitest
import { vi } from 'vitest'

// Mock WebRTC APIs
global.RTCPeerConnection = vi.fn().mockImplementation(() => ({
  createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-offer' }),
  createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-answer' }),
  setLocalDescription: vi.fn().mockResolvedValue(undefined),
  setRemoteDescription: vi.fn().mockResolvedValue(undefined),
  addIceCandidate: vi.fn().mockResolvedValue(undefined),
  createDataChannel: vi.fn().mockReturnValue({
    label: 'test',
    readyState: 'connecting',
    send: vi.fn(),
    close: vi.fn(),
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
  }),
  close: vi.fn(),
  connectionState: 'new',
  iceConnectionState: 'new',
  signalingState: 'stable',
  onicecandidate: null,
  onconnectionstatechange: null,
  oniceconnectionstatechange: null,
  onsignalingstatechange: null,
  ondatachannel: null,
  ontrack: null,
  getTransceivers: vi.fn().mockReturnValue([]),
}))

global.RTCSessionDescription = vi.fn().mockImplementation((init) => init)
global.RTCIceCandidate = vi.fn().mockImplementation((init) => init)