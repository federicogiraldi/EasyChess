/** Riconoscimento del dispositivo e piccole funzioni specifiche per iPhone/iPad. */

const nav = (typeof navigator !== 'undefined' ? navigator : undefined) as
  | (Navigator & { standalone?: boolean })
  | undefined;

/** iPhone, iPod o iPad (anche iPadOS 13+, che si presenta come un Mac con il touch). */
export function isIOS(): boolean {
  if (!nav) return false;
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
}

/** L'app è aperta dalla schermata Home (o installata), non in una scheda del browser. */
export function isStandalone(): boolean {
  if (!nav) return false;
  return nav.standalone === true || (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches);
}

/** Telefono: schermo touch e stretto. Usato per alleggerire Stockfish. */
export function isPhone(): boolean {
  if (typeof matchMedia === 'undefined') return false;
  return matchMedia('(pointer: coarse) and (max-width: 760px), (pointer: coarse) and (max-height: 500px)').matches;
}

/**
 * Chiede al browser di non cancellare i dati salvati (progressi in localStorage).
 * Safari può ripulire i siti non usati da giorni; l'app sulla schermata Home e lo storage persistente lo evitano.
 */
export function requestPersistentStorage(): void {
  void nav?.storage?.persist?.().catch(() => {});
}

/**
 * Salva un file. Su iPhone/iPad apre il foglio di condivisione (Salva su File, AirDrop, Mail…),
 * perché nell'app a schermo intero il download classico non ha un posto dove finire.
 */
export async function saveFile(name: string, content: string, type: string): Promise<void> {
  const blob = new Blob([content], { type });
  if (isIOS() && nav?.canShare) {
    const file = new File([blob], name, { type });
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file] });
        return;
      } catch (e) {
        // Annullato dall'utente: non scaricare comunque.
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
