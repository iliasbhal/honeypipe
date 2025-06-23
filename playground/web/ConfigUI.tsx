import React, { useState } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  background: #0a0a0a;
  border: 1px solid #1a1a1a;
  border-radius: 8px;
  padding: 24px;
  max-width: 600px;
  margin: 20px;
  color: #e0e0e0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
`;

const Header = styled.h2`
  font-size: 14px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #666;
  margin: 0 0 24px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &::before {
    content: '◆';
    color: #00ff88;
  }
`;

const Section = styled.div`
  margin-bottom: 24px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.label`
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #666;
  margin-bottom: 8px;
  font-weight: 500;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 16px;
  background: #0f0f0f;
  border: 1px solid #222;
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
  color: #e0e0e0;
  box-sizing: border-box;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #333;
  }
  
  &:focus {
    outline: none;
    border-color: #00ff88;
    background: #0a0a0a;
    box-shadow: 0 0 0 3px rgba(0, 255, 136, 0.1);
  }
  
  &::placeholder {
    color: #444;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const InputGroup = styled.div`
  display: flex;
  gap: 8px;
  align-items: stretch;
`;

const InputField = styled(Input)`
  flex: 1;
`;

const Button = styled.button`
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  padding: 10px 16px;
  background: transparent;
  color: #00ff88;
  border: 1px solid #00ff88;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  
  &:hover:not(:disabled) {
    background: #00ff88;
    color: #000;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 255, 136, 0.3);
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const DangerButton = styled(Button)`
  color: #ff4444;
  border-color: #ff4444;
  
  &:hover:not(:disabled) {
    background: #ff4444;
    color: #000;
    box-shadow: 0 2px 8px rgba(255, 68, 68, 0.3);
  }
`;

const PeerIdContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: stretch;
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    left: -12px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: linear-gradient(to bottom, #00ff88, transparent);
    opacity: 0.3;
  }
`;

const PeerIndex = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #444;
  min-width: 24px;
  user-select: none;
`;

const PeerIdField = styled(Input)`
  flex: 1;
`;

const RandomButton = styled(Button)`
  padding: 10px 12px;
  font-size: 11px;
`;

const AddButton = styled(Button)`
  width: 100%;
  margin-top: 16px;
  border-style: dashed;
  
  &:hover:not(:disabled) {
    border-style: solid;
  }
`;

const StatusBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #1a1a1a;
  font-size: 11px;
  color: #444;
`;

const StatusItem = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  
  &::before {
    content: '●';
    color: #00ff88;
  }
`;

interface ConfigUIProps {
  onConfigChange?: (config: {
    roomId: string;
    peerCount: number;
    peerIds: string[];
    autoGenerateIds: boolean;
  }) => void;
}

export const ConfigUI: React.FC<ConfigUIProps> = ({ onConfigChange }) => {
  const [roomId, setRoomId] = useState('');
  const [peerIds, setPeerIds] = useState<string[]>(['', '']);

  const handleAddPeer = () => {
    const newPeerIds = [...peerIds];
    const newPeerId = `peer-${peerIds.length + 1}`;
    newPeerIds.push(newPeerId);
    setPeerIds(newPeerIds);
    
    triggerConfigChange({ peerCount: newPeerIds.length, peerIds: newPeerIds });
  };

  const handleRemovePeer = (index: number) => {
    if (peerIds.length > 1) {
      const newPeerIds = peerIds.filter((_, i) => i !== index);
      setPeerIds(newPeerIds);
      triggerConfigChange({ peerCount: newPeerIds.length, peerIds: newPeerIds });
    }
  };

  const handlePeerIdChange = (index: number, value: string) => {
    const newPeerIds = [...peerIds];
    newPeerIds[index] = value;
    setPeerIds(newPeerIds);
    triggerConfigChange({ peerIds: newPeerIds });
  };

  const generateRandomRoomId = () => {
    return `room-${Math.random().toString(36).substring(2, 9)}`;
  };

  const handleGenerateRoomId = () => {
    const newRoomId = generateRandomRoomId();
    setRoomId(newRoomId);
    triggerConfigChange({ roomId: newRoomId });
  };

  const triggerConfigChange = (updates: Partial<{
    roomId: string;
    peerCount: number;
    peerIds: string[];
    autoGenerateIds: boolean;
  }>) => {
    if (onConfigChange) {
      onConfigChange({
        roomId,
        peerCount: peerIds.length,
        peerIds,
        autoGenerateIds: false,
        ...updates
      });
    }
  };

  return (
    <Container>
      <Header>Playground Configuration</Header>
      
      <Section>
        <Label htmlFor="roomId">Room Identifier</Label>
        <InputGroup>
          <InputField
            id="roomId"
            value={roomId}
            onChange={(e) => {
              setRoomId(e.target.value);
              triggerConfigChange({ roomId: e.target.value });
            }}
            placeholder="e.g., room-7x9a2b"
            spellCheck={false}
          />
          <RandomButton onClick={handleGenerateRoomId}>
            Random
          </RandomButton>
        </InputGroup>
      </Section>

      <Section>
        <Label>Peer Configuration</Label>

        {peerIds.map((peerId, index) => (
          <PeerIdContainer key={index}>
            <PeerIndex>{String(index).padStart(2, '0')}</PeerIndex>
            <PeerIdField
              value={peerId}
              onChange={(e) => handlePeerIdChange(index, e.target.value)}
              placeholder={`peer-${index + 1}`}
              disabled={true}
              spellCheck={false}
            />
            {peerIds.length > 1 && (
              <DangerButton onClick={() => handleRemovePeer(index)}>
                ×
              </DangerButton>
            )}
          </PeerIdContainer>
        ))}
        
        <AddButton onClick={handleAddPeer}>
          + Add Peer
        </AddButton>
      </Section>
      
      <StatusBar>
        <StatusItem>Ready</StatusItem>
        <StatusItem>{peerIds.length} peers configured</StatusItem>
      </StatusBar>
    </Container>
  );
};