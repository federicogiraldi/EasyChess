import { useState } from 'react';
import { isIOS, isStandalone } from '../core/device';
import { load, save } from '../core/storage';

/**
 * Su iPhone/iPad, se l'app è aperta in Safari e non dalla schermata Home, spiega come installarla.
 * Safari non ha un pulsante "Installa": si passa dal menu Condividi.
 */
export function InstallHint() {
  const [hidden, setHidden] = useState(() => !isIOS() || isStandalone() || load('installHintClosed', false));
  if (hidden) return null;
  const close = () => {
    save('installHintClosed', true);
    setHidden(true);
  };
  return (
    <div className="install-hint" role="note">
      <span className="install-icon" aria-hidden>
        📲
      </span>
      <div>
        <strong>Installa EasyChess su questo dispositivo</strong>
        <p className="small">
          Tocca <ShareIcon /> <b>Condividi</b> nella barra di Safari, poi <b>Aggiungi alla schermata Home</b>. Si apre a
          schermo intero, come un'app, e funziona anche senza internet.
        </p>
      </div>
      <button className="install-close" onClick={close} aria-label="Chiudi">
        ✕
      </button>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg className="share-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        d="M12 3v12M7.5 7.5 12 3l4.5 4.5M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
