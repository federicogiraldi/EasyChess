import { useSyncExternalStore } from 'react';
import { grade, type CardState } from './srs';
import { load, save } from './storage';
import { bumpActivity } from './daily';
import { playSound } from './sound';

/** Stato SRS di tutte le card, condiviso fra le modalità e salvato in localStorage. */
let cards: Record<string, CardState> = load('cards', {});
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  save('cards', cards);
  listeners.forEach((l) => l());
}

export function getCard(key: string): CardState | undefined {
  return cards[key];
}

export function recordAnswer(key: string, correct: boolean) {
  cards = { ...cards, [key]: grade(cards[key], correct) };
  bumpActivity();
  if (!correct) playSound('wrong');
  emit();
}

/** Mette queste schede nel ripasso di oggi (le nuove nascono già in scadenza), senza toccare le statistiche. */
export function markForReview(keys: string[], now = Date.now()) {
  if (keys.length === 0) return;
  const next = { ...cards };
  for (const key of keys) {
    const s = next[key];
    next[key] = s
      ? { ...s, due: now, interval: 0, reps: 0, at: now }
      : { due: now, interval: 0, ease: 2.5, reps: 0, lapses: 0, seen: 0, correct: 0, at: now };
  }
  cards = next;
  emit();
}

export function exportCards(): Record<string, CardState> {
  return cards;
}

export function replaceCards(next: Record<string, CardState>) {
  cards = next;
  emit();
}

/** Rilegge le schede salvate (arrivate da un altro dispositivo) senza risalvarle. */
export function reloadCards() {
  cards = load('cards', {});
  version++;
  listeners.forEach((l) => l());
}

export function resetOpening(openingId: string) {
  cards = Object.fromEntries(Object.entries(cards).filter(([k]) => !k.startsWith(openingId + '|')));
  // Ricorda l'azzeramento, così la sincronizzazione non riporta le schede dall'altro dispositivo.
  save('cards:resets', { ...load<Record<string, number>>('cards:resets', {}), [openingId]: Date.now() });
  emit();
}

/** Fa ri-renderizzare il componente quando cambiano i progressi. */
export function useProgress(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
}
