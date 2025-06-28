import React from 'react' 
import { NuqsAdapter } from 'nuqs/adapters/react'
import { App } from './App'
export const Root : React.FC<React.PropsWithChildren> = (props) => {
  return (
    <NuqsAdapter>
      <App />
    </NuqsAdapter>
  )
}