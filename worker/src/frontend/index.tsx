import React from 'react'
import { createRoot } from 'react-dom/client'
import { Root } from './Root';

const rootNode = document.getElementById('root')!
const root = createRoot(rootNode)
root.render(<Root />)