import { useSyncExternalStore } from 'react';
import { grade, type CardState } from './srs';
import { load, save } from './storage';

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
