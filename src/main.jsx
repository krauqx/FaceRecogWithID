/**
 * application entry point
 * mounts the react app into the #root dom element with strictmode enabled.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'       // tailwindcss + custom animations
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
