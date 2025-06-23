import React, { useState } from 'react';
import * as Nuqs from "nuqs";
import { ConfigUI } from './ConfigUI';
import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    background: #000000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  }
  
  * {
    box-sizing: border-box;
  }
`;

export const App = () => {
  const [roomId, setRoomId] = Nuqs.useQueryState('roomId', 
    Nuqs.parseAsString.withOptions({
      history: 'replace',
    }),
  );

  const [config, setConfig] = useState({
    roomId: roomId || '',
    peerCount: 2,
    peerIds: ['', ''],
    autoGenerateIds: false
  });

  const handleConfigChange = (newConfig: {
    roomId: string;
    peerCount: number;
    peerIds: string[];
    autoGenerateIds: boolean;
  }) => {
    setConfig(newConfig);
    if (newConfig.roomId !== roomId) {
      setRoomId(newConfig.roomId || null);
    }
  };

  return (
    <>
      <GlobalStyle />
      <div style={{ 
        minHeight: '100vh', 
        background: '#000000',
        padding: '20px 0'
      }}>
        <ConfigUI onConfigChange={handleConfigChange} />
      </div>
    </>
  );
}