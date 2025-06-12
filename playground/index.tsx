import React from 'react';
import ReactDOM from 'react-dom/client';
import { WebRTCDebuggerTest } from './components/WebRTCDebuggerTest';

// Mount the WebRTC Debugger Test
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <WebRTCDebuggerTest />
    </React.StrictMode>
  );
} else {
  console.error('Root element not found!');
}