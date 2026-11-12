import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';
import { requestPersistentStorage } from './core/device';
import { initSync } from './core/sync';
import './styles.css';

// Service worker: rende l'app installabile e utilizzabile offline (anche Stockfish).
registerSW({ immediate: true });
requestPersistentStorage();

// Prima di mostrare l'app scarica i progressi dell'account (se c'è rete, al massimo ~3 secondi):
// così i moduli leggono già i dati aggiornati. Offline o senza account parte subito.
const ready = Promise.race([initSync().catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);

void ready.then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
