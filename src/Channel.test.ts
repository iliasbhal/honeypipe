import { describe, it, expect, beforeEach } from 'vitest';
import { Channel } from './Channel';
import { Peer } from './Peer';
import { Room } from './Room';
import { InMemorySignalingAdapter } from './adapters/InMemorySignalingAdapter';

describe('Channel', () => {
  let channel: Channel<any>;
  let room: Room;
  let signalingAdapter: InMemorySignalingAdapter;
  let peer1: Peer;
  let peer2: Peer;

  beforeEach(() => {
    signalingAdapter = new InMemorySignalingAdapter();
    room = new Room('test-room', signalingAdapter);
    channel = new Channel('test-room:alice-bob', signalingAdapter, 'test-room');
    channel.setRoom(room);
    
    peer1 = new Peer({ peerId: 'alice' });
    peer2 = new Peer({ peerId: 'bob' });
  });

  describe('constructor and peer ID management', () => {
    it('should extract peer IDs from channel ID', () => {
      expect(channel.getPeerIds()).toEqual(['alice', 'bob']);
      expect(channel.roomId).toBe('test-room');
    });

    it('should handle channel ID with room prefix', () => {
      const channel2 = new Channel('room123:charlie-dave', signalingAdapter);
      expect(channel2.getPeerIds()).toEqual(['charlie', 'dave']);
      expect(channel2.roomId).toBe('room123');
    });

    it('should handle channel ID without room prefix', () => {
      const channel3 = new Channel('eve-frank', signalingAdapter);
      expect(channel3.getPeerIds()).toEqual(['eve', 'frank']);
    });

    it('should throw error for invalid channel ID format', () => {
      expect(() => {
        new Channel('invalid', signalingAdapter);
      }).toThrow('Invalid channel ID format');
      
      expect(() => {
        new Channel('room:', signalingAdapter);
      }).toThrow('Invalid channel ID format');
      
      expect(() => {
        new Channel('room:single-peer-only', signalingAdapter);
      }).not.toThrow(); // This should be valid (single-peer-only gets split)
    });
  });

  describe('peer ID utilities', () => {
    it('should check if peer ID belongs to channel', () => {
      expect(channel.hasPeerId('alice')).toBe(true);
      expect(channel.hasPeerId('bob')).toBe(true);
      expect(channel.hasPeerId('charlie')).toBe(false);
    });

    it('should get other peer ID', () => {
      expect(channel.getOtherPeerId('alice')).toBe('bob');
      expect(channel.getOtherPeerId('bob')).toBe('alice');
      expect(channel.getOtherPeerId('charlie')).toBe(null);
    });
  });

  describe('peer connection tracking', () => {
    it('should add and track connected peers', () => {
      expect(channel.getConnectedPeerCount()).toBe(0);
      expect(channel.isBothPeersConnected()).toBe(false);

      channel.addPeer(peer1);
      expect(channel.getConnectedPeerCount()).toBe(1);
      expect(channel.isPeerConnected('alice')).toBe(true);
      expect(channel.isPeerConnected('bob')).toBe(false);
      expect(channel.isBothPeersConnected()).toBe(false);

      channel.addPeer(peer2);
      expect(channel.getConnectedPeerCount()).toBe(2);
      expect(channel.isPeerConnected('alice')).toBe(true);
      expect(channel.isPeerConnected('bob')).toBe(true);
      expect(channel.isBothPeersConnected()).toBe(true);
    });

    it('should not add peers that do not belong to channel', () => {
      const outsidePeer = new Peer({ peerId: 'charlie' });
      
      channel.addPeer(outsidePeer);
      expect(channel.getConnectedPeerCount()).toBe(0);
      expect(channel.isPeerConnected('charlie')).toBe(false);
    });

    it('should remove peers', () => {
      channel.addPeer(peer1);
      channel.addPeer(peer2);
      expect(channel.getConnectedPeerCount()).toBe(2);

      channel.removePeer('alice');
      expect(channel.getConnectedPeerCount()).toBe(1);
      expect(channel.isPeerConnected('alice')).toBe(false);
      expect(channel.isPeerConnected('bob')).toBe(true);
    });

    it('should get peer instances', () => {
      channel.addPeer(peer1);
      
      expect(channel.getPeer('alice')).toBe(peer1);
      expect(channel.getPeer('bob')).toBe(null);
      expect(channel.getPeer('charlie')).toBe(null);
    });

    it('should return connected peers list', () => {
      channel.addPeer(peer1);
      channel.addPeer(peer2);
      
      const connectedPeers = channel.getConnectedPeers();
      expect(connectedPeers).toHaveLength(2);
      expect(connectedPeers).toContain(peer1);
      expect(connectedPeers).toContain(peer2);
    });
  });

  describe('message handling', () => {
    it('should register and call message handlers', () => {
      const handler = vi.fn();
      
      const cleanup = channel.onMessage(handler);
      expect(channel['messageHandlers'].size).toBe(1);
      
      channel.notifyMessageHandlers('Hello!', 'alice');
      expect(handler).toHaveBeenCalledWith('Hello!', 'alice');
      
      cleanup();
      expect(channel['messageHandlers'].size).toBe(0);
    });

    it('should handle multiple message handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      channel.onMessage(handler1);
      channel.onMessage(handler2);
      
      channel.notifyMessageHandlers('Test', 'bob');
      
      expect(handler1).toHaveBeenCalledWith('Test', 'bob');
      expect(handler2).toHaveBeenCalledWith('Test', 'bob');
    });
  });

  describe('channel information', () => {
    it('should provide channel metadata', () => {
      expect(channel.id).toBe('test-room:alice-bob');
      expect(channel.roomId).toBe('test-room');
      expect(channel.getPeerIds()).toEqual(['alice', 'bob']);
    });

    it('should check if channel is active', () => {
      expect(channel.isChannelActive()).toBe(true);
    });
  });

  describe('peer connection actor management', () => {
    it('should manage peer connection actor', () => {
      expect(channel.hasPeerConnectionActor()).toBe(false);
      expect(channel.getPeerConnectionActor()).toBe(undefined);

      const mockActor = { send: vi.fn() };
      channel.setPeerConnectionActor(mockActor);

      expect(channel.hasPeerConnectionActor()).toBe(true);
      expect(channel.getPeerConnectionActor()).toBe(mockActor);
    });

    it('should send messages through peer connection actor', () => {
      const mockActor = { send: vi.fn() };
      channel.setPeerConnectionActor(mockActor);

      // Send regular message
      channel.sendMessage('Hello peer!');
      expect(mockActor.send).toHaveBeenCalledWith({
        type: 'SEND_MESSAGE',
        message: 'Hello peer!'
      });

      // Send data channel message
      channel.sendMessage('Game data', 'game-channel');
      expect(mockActor.send).toHaveBeenCalledWith({
        type: 'SEND_DATA_CHANNEL_MESSAGE',
        label: 'game-channel',
        message: 'Game data'
      });
    });

    it('should fallback to room messaging without peer connection actor', () => {
      // Mock room connection actors with getSnapshot
      const mockActor = { 
        send: vi.fn(),
        getSnapshot: vi.fn().mockReturnValue({
          context: { peerConnections: new Map() }
        })
      };
      room.roomConnectionActors.set('alice', mockActor);
      
      channel.sendMessage('Fallback message');

      expect(mockActor.send).toHaveBeenCalledWith({
        type: 'SEND_MESSAGE_TO_PEER',
        peerId: 'bob',
        message: 'Fallback message'
      });
    });
  });
});