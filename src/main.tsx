import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';
import { requestPersistentStorage } from './core/device';
import './styles.css';

// Service worker: rende l'app installabile e utilizzabile offline (anche Stockfish).
registerSW({ immediate: true });
requestPersistentStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
