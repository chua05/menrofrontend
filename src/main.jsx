import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import "./styles/auth.css";
import App from './App.jsx'
import './styles/leaflet-containment.css'
import { registerServiceWorker } from './pwaRegistration.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerServiceWorker()
