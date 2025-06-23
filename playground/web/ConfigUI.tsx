import React, { useState } from 'react';
import styled from 'styled-components';
import { User, Plus, Xmark } from 'iconoir-react';

const Container = styled.div`
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 32px;
  max-width: 600px;
  margin: 20px;
  color: #f0f0f0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
`;

const Header = styled.h2`
  font-size: 16px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #f0f0f0;
  margin: 0 0 28px 0;
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
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #a0a0a0;
  margin-bottom: 10px;
  font-weight: 600;
`;

const Input = styled.input`
  width: 100%;
  padding: 14px 18px;
  background: #0f0f0f;
  border: 2px solid #2a2a2a;
  border-radius: 8px;
  font-family: inherit;
  font-size: 15px;
  color: #f0f0f0;
  box-sizing: border-box;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #3a3a3a;
    background: #121212;
  }
  
  &:focus {
    outline: none;
    border-color: #00ff88;
    background: #0a0a0a;
    box-shadow: 0 0 0 3px rgba(0, 255, 136, 0.15);
  }
  
  &::placeholder {
    color: #606060;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #0a0a0a;
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
  font-size: 13px;
  font-weight: 600;
  padding: 12px 20px;
  background: transparent;
  color: #00ff88;
  border: 2px solid #00ff88;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  
  &:hover:not(:disabled) {
    background: #00ff88;
    color: #000000;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;


const PeersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  margin-top: 16px;
`;

const PeerBlock = styled.div`
  background: #0f0f0f;
  border: 2px solid #2a2a2a;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  position: relative;
  transition: all 0.2s ease;
  cursor: default;
  
  &:hover {
    border-color: #3a3a3a;
    background: #121212;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
`;

const PeerIcon = styled.div`
  width: 48px;
  height: 48px;
  background: #1a1a1a;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #00ff88;
`;

const PeerId = styled.div`
  font-size: 13px;
  color: #e0e0e0;
  text-align: center;
  font-weight: 500;
  word-break: break-all;
`;

const RemoveButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: #2a2a2a;
  color: #ff5555;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;
  
  ${PeerBlock}:hover & {
    opacity: 1;
  }
  
  &:hover {
    background: #ff5555;
    color: #000000;
  }
`;

const RandomButton = styled(Button)`
  padding: 12px 16px;
  font-size: 12px;
`;

const AddPeerBlock = styled(PeerBlock)`
  border-style: dashed;
  cursor: pointer;
  background: #0a0a0a;
  
  &:hover {
    border-style: solid;
    border-color: #00ff88;
    background: #0f0f0f;
  }
`;

const AddIcon = styled.div`
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #00ff88;
`;

const AddLabel = styled.div`
  font-size: 12px;
  color: #808080;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
`;

const StatusBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid #2a2a2a;
  font-size: 12px;
  color: #808080;
`;

const StatusItem = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  
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

  // Peer IDs are now auto-generated and not editable

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

        <PeersGrid>
          {peerIds.map((peerId, index) => (
            <PeerBlock key={index}>
              {peerIds.length > 1 && (
                <RemoveButton onClick={() => handleRemovePeer(index)}>
                  <Xmark width={14} height={14} />
                </RemoveButton>
              )}
              <PeerIcon>
                <User width={28} height={28} />
              </PeerIcon>
              <PeerId>{peerId || `peer-${index + 1}`}</PeerId>
            </PeerBlock>
          ))}
          
          <AddPeerBlock onClick={handleAddPeer}>
            <AddIcon>
              <Plus width={32} height={32} />
            </AddIcon>
            <AddLabel>Add Peer</AddLabel>
          </AddPeerBlock>
        </PeersGrid>
      </Section>
      
      <StatusBar>
        <StatusItem>Ready</StatusItem>
        <StatusItem>{peerIds.length} peers configured</StatusItem>
      </StatusBar>
    </Container>
  );
};