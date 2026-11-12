const PREFIX = 'easychess:';
/** Quando è stata modificata ogni chiave su questo dispositivo (ms): serve alla sincronizzazione. */
const META = '__meta';

/** Chiavi che restano su questo dispositivo e non vanno sincronizzate. */
const LOCAL_ONLY = new Set([META, 'installHintClosed']);

export const isSyncedKey = (key: string) => !LOCAL_ONLY.has(key);

type Listener = (key: string) => void;
const listeners = new Set<Listener>();

/** Avvisa quando l'app salva qualcosa (la sincronizzazione lo usa per inviare le modifiche). */
export function onSave(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Scrive senza segnare la modifica (usato quando i dati arrivano dal cloud). */
export function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage non disponibile (es. finestra privata): i progressi restano in memoria
  }
}

export function save(key: string, value: unknown): void {
  write(key, value);
  if (!isSyncedKey(key)) return;
  setStamp(key, Date.now());
  listeners.forEach((l) => l(key));
}

export function getStamps(): Record<string, number> {
  return load<Record<string, number>>(META, {});
}

export function setStamp(key: string, t: number): void {
  write(META, { ...getStamps(), [key]: t });
}

/** Tutte le chiavi dell'app salvate su questo dispositivo (senza prefisso). */
export function localKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k.slice(PREFIX.length));
    }
  } catch {
    // storage non disponibile
  }
  return keys;
}
