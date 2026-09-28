import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts — bundled at build time so they work on closed networks
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
// Leaflet's base styles load before index.css so our dark overrides win the cascade
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
