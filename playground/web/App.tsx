import React, { useState } from 'react';
import * as Nuqs from "nuqs";
import { ConfigUI } from './ConfigUI';
import { createGlobalStyle } from 'styled-components';

const backgroundColor = '#0a0a0a';
const gridColor = 'rgba(255, 255, 255, 0.03)';
const gridSize = '20px';

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    background-color: ${backgroundColor};
    background-image: 
      linear-gradient(${gridColor} 1px, transparent 1px),
      linear-gradient(90deg, ${gridColor} 1px, transparent 1px);
    background-size: ${gridSize} ${gridSize};
    background-position: -1px -1px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    min-height: 100vh;
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
      <ConfigUI onConfigChange={handleConfigChange} />
    </>
  );
}