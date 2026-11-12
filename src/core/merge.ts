import type { CardState } from './srs';

/**
 * Unione dei progressi di due dispositivi dello stesso account.
 * Regola generale: vince la modifica più recente. Per i dati in cui si può fare di meglio
 * (schede del ripasso, problemi visti, lezioni completate) si uniscono i due lati,
 * così giocare offline su entrambi i dispositivi non fa perdere niente.
 */
export function mergeValue(key: string, local: unknown, localAt: number, remote: unknown, remoteAt: number): unknown {
  const newer = remoteAt > localAt ? remote : local;
  if (local === undefined) return remote;
  if (remote === undefined) return local;

  if (key === 'cards') return mergeCards(local as Cards, remote as Cards);
  if (key === 'cards:resets') return maxPerKey(local as Record<string, number>, remote as Record<string, number>);
  if (key === 'puzzles:seen') return union(local as string[], remote as string[]);
  if (key === 'puzzles:stats') {
    const l = local as { games: number };
    const r = remote as { games: number };
    return l.games === r.games ? newer : l.games > r.games ? l : r;
  }
  if (key === 'mates:progress' || key.startsWith('course:')) {
    const n = newer as { done: unknown[]; lesson: number };
    return { ...n, done: union((local as { done: unknown[] }).done ?? [], (remote as { done: unknown[] }).done ?? []) };
  }
  return newer;
}

type Cards = Record<string, CardState>;

/** Scheda per scheda: tiene quella ripassata più di recente (o, per i dati vecchi, quella vista più volte). */
export function mergeCards(a: Cards, b: Cards): Cards {
  const out: Cards = { ...a };
  for (const [k, card] of Object.entries(b)) {
    const mine = out[k];
    if (!mine || newerCard(card, mine)) out[k] = card;
  }
  return out;
}

function newerCard(x: CardState, y: CardState): boolean {
  if ((x.at ?? 0) !== (y.at ?? 0)) return (x.at ?? 0) > (y.at ?? 0);
  return x.seen > y.seen;
}

/** Toglie le schede delle aperture azzerate dopo il loro ultimo ripasso. */
export function applyResets(cards: Cards, resets: Record<string, number>): Cards {
  return Object.fromEntries(
    Object.entries(cards).filter(([k, c]) => {
      const reset = resets[k.split('|')[0]];
      return !reset || (c.at ?? 0) > reset;
    }),
  );
}

function maxPerKey(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
}

function union<T>(a: T[], b: T[]): T[] {
  return [...new Set([...a, ...b])];
}
