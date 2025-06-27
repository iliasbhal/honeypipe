import React, { useState } from 'react';
import styled from 'styled-components';
import { User, Plus, Xmark } from 'iconoir-react';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 32px;
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

const IframesSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #2a2a2a;
`;

const IframesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  height: 100%;
  gap: 16px;
  margin-top: 16px;
`;

const IframeContainer = styled.div`
  display: flex;
  flex-direction: column;
  background: #0f0f0f;
  border: 2px solid #2a2a2a;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
`;

const IframeHeader = styled.div`
  background: #1a1a1a;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #2a2a2a;
`;

const IframeTitle = styled.div`
  font-size: 12px;
  color: #e0e0e0;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const IframeUrl = styled.div`
  font-size: 11px;
  color: #606060;
  font-family: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
`;

const StyledIframe = styled.iframe`
  flex: 1;
  width: 100%;
  border: none;
  background: #0a0a0a;
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
  const [roomId, setRoomId] = useState(() => `room-${Math.random().toString(36).substring(2, 9)}`);
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

  const getIframeUrl = (peerId: string) => {
    if (!roomId || !peerId) return '';
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?roomId=${encodeURIComponent(roomId)}&peerId=${encodeURIComponent(peerId)}`;
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'row', gap: '30px', padding: '30px', height: '100vh' }}>
      
      <Container style={{ flex: 3}}>
          <Section style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
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
                disabled
              />
            </InputGroup>
          <PeersGrid style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: '10px' }}>
              {peerIds.map((peerId, index) => (
                <PeerBlock key={index}>
                  {peerIds.length > 1 && (
                    <RemoveButton onClick={() => handleRemovePeer(index)}>
                      <Xmark width={10} height={10} />
                    </RemoveButton>
                  )}
                  <PeerIcon>
                    <User width={20} height={20} />
                  </PeerIcon>
                  <PeerId>{peerId || `peer-${index + 1}`}</PeerId>
                </PeerBlock>
              ))}
              
              <AddPeerBlock onClick={handleAddPeer}>
                <AddIcon>
                  <Plus width={24} height={24} />
                </AddIcon>
                <AddLabel>Add Peer</AddLabel>
              </AddPeerBlock>
            </PeersGrid>
          </Section>
    
          <IframesSection>
            <IframesGrid>
              {peerIds.map((peerId, index) => {
                const actualPeerId = peerId || `peer-${index + 1}`;
                const iframeUrl = getIframeUrl(actualPeerId);
                
                return (
                  <IframeContainer key={index}>
                    <IframeHeader>
                      <IframeTitle>
                        <User width={14} height={14} />
                        {actualPeerId}
                      </IframeTitle>
                      <IframeUrl title={iframeUrl}>{iframeUrl}</IframeUrl>
                    </IframeHeader>
                    <StyledIframe
                      src={iframeUrl}
                      title={`Peer ${actualPeerId} Timeline`}
                      sandbox="allow-same-origin allow-scripts"
                    />
                  </IframeContainer>
                );
              })}
            </IframesGrid>
          </IframesSection>
      </Container>
      </div>
    </>
  );
};