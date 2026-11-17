import { useSyncExternalStore } from 'react';
import { load, save } from './storage';

/** Preferenze dell'app: salvate come le altre chiavi, quindi si sincronizzano fra i dispositivi. */
export interface Settings {
  boardTheme: BoardThemeId;
  /** auto = come il sistema operativo. */
  theme: 'auto' | 'light' | 'dark';
  sound: boolean;
  /** 0–1 */
  volume: number;
  /** Lettere e numeri ai bordi della scacchiera. */
  coordinates: boolean;
  animation: 'off' | 'fast' | 'normal';
}

export type BoardThemeId = 'classic' | 'green' | 'blue' | 'gray' | 'wood';

export const BOARD_THEMES: { id: BoardThemeId; name: string; light: string; dark: string }[] = [
  { id: 'classic', name: 'Classica', light: '#f0d9b5', dark: '#b58863' },
  { id: 'green', name: 'Verde', light: '#eeeed2', dark: '#769656' },
  { id: 'blue', name: 'Azzurra', light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'gray', name: 'Grigia', light: '#dcdcdc', dark: '#8f8f8f' },
  { id: 'wood', name: 'Legno scuro', light: '#e3c193', dark: '#8b5a2b' },
];

export const ANIMATION_MS: Record<Settings['animation'], number> = { off: 0, fast: 120, normal: 200 };

export const DEFAULT_SETTINGS: Settings = {
  boardTheme: 'classic',
  theme: 'auto',
  sound: true,
  volume: 0.6,
  coordinates: true,
  animation: 'normal',
};

/** Unisce i valori salvati con quelli predefiniti (le versioni vecchie non hanno tutti i campi). */
export function normalize(raw: Partial<Settings> | null | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  if (!BOARD_THEMES.some((t) => t.id === s.boardTheme)) s.boardTheme = DEFAULT_SETTINGS.boardTheme;
  if (!['auto', 'light', 'dark'].includes(s.theme)) s.theme = 'auto';
  if (!(s.animation in ANIMATION_MS)) s.animation = 'normal';
  s.volume = Math.min(1, Math.max(0, Number(s.volume) || 0));
  return s;
}

let current = normalize(load<Partial<Settings>>('settings', {}));
let version = 0;
const listeners = new Set<() => void>();

export const getSettings = () => current;

export function updateSettings(patch: Partial<Settings>) {
  current = normalize({ ...current, ...patch });
  save('settings', current);
  applySettings();
  version++;
  listeners.forEach((l) => l());
}

/** Rilegge le impostazioni (arrivate da un altro dispositivo con la sincronizzazione). */
export function reloadSettings() {
  current = normalize(load<Partial<Settings>>('settings', {}));
  applySettings();
  version++;
  listeners.forEach((l) => l());
}

/** Applica tema e colori della scacchiera alla pagina (variabili CSS su <html>). */
export function applySettings(s: Settings = current) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (s.theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = s.theme;
  // Colore della barra del browser/telefono: segue il tema scelto, non solo quello del sistema.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.dataset.original ??= m.content;
    m.content = s.theme === 'light' ? '#ffffff' : s.theme === 'dark' ? '#272420' : m.dataset.original;
  });
  const board = BOARD_THEMES.find((t) => t.id === s.boardTheme) ?? BOARD_THEMES[0];
  root.style.setProperty('--sq-light', board.light);
  root.style.setProperty('--sq-dark', board.dark);
}

export function useSettings(): Settings {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
  return current;
}
