import type { Opening } from '../model/types';
import type { CardState } from './srs';
import { isDue } from './srs';
import { cardPositions, type CardPosition } from './tree';
import { dayKey } from './dashboard';
import { load, save } from './storage';

/**
 * Il "Ripasso di oggi": un'unica sessione con le posizioni in scadenza di tutte le aperture,
 * più un obiettivo giornaliero (risposte date) e la serie di giorni in cui l'hai raggiunto.
 */

export interface DailyItem {
  opening: Opening;
  card: CardPosition;
}

export const GOAL_OPTIONS = [10, 20, 30, 50];
export const DEFAULT_GOAL = 20;

/** Risposte date per giorno (AAAA-MM-GG): posizioni delle aperture e problemi. */
export type Activity = Record<string, number>;

const KEEP_DAYS = 400;

export function addActivity(activity: Activity, n: number, now = Date.now()): Activity {
  const d = dayKey(now);
  const next = { ...activity, [d]: (activity[d] ?? 0) + n };
  const days = Object.keys(next).sort();
  return days.length > KEEP_DAYS ? Object.fromEntries(days.slice(-KEEP_DAYS).map((k) => [k, next[k]])) : next;
}

/** Giorni consecutivi con l'obiettivo raggiunto, fino a oggi (o fino a ieri, se oggi non è ancora raggiunto). */
export function streak(activity: Activity, goal: number, now = Date.now()): number {
  const day = new Date(now);
  day.setHours(12, 0, 0, 0);
  if ((activity[dayKey(day.getTime())] ?? 0) < goal) day.setDate(day.getDate() - 1);
  let n = 0;
  while ((activity[dayKey(day.getTime())] ?? 0) >= goal) {
    n++;
    day.setDate(day.getDate() - 1);
  }
  return n;
}

/**
 * Coda della sessione: tutte le posizioni in scadenza (le più vecchie prima), poi, se non bastano
 * per l'obiettivo di oggi, posizioni nuove prese a turno dalle aperture che hai già iniziato.
 */
export function dailyQueue(
  openings: Opening[],
  cards: Record<string, CardState>,
  goalLeft: number,
  now = Date.now(),
): { items: DailyItem[]; due: number; fresh: number } {
  const due: (DailyItem & { at: number })[] = [];
  const freshByOpening: DailyItem[][] = [];
  for (const opening of openings) {
    const positions = cardPositions(opening);
    const started = positions.some((c) => cards[c.key]);
    const fresh: DailyItem[] = [];
    for (const card of positions) {
      const s = cards[card.key];
      if (isDue(s, now)) due.push({ opening, card, at: s!.due });
      else if (!s && started) fresh.push({ opening, card });
    }
    if (fresh.length) freshByOpening.push(fresh);
  }
  due.sort((a, b) => a.at - b.at);
  const want = Math.max(0, goalLeft - due.length);
  const fresh: DailyItem[] = [];
  for (let i = 0; fresh.length < want && freshByOpening.some((f) => f.length > i); i++) {
    for (const list of freshByOpening) if (list[i] && fresh.length < want) fresh.push(list[i]);
  }
  return { items: [...due.map(({ opening, card }) => ({ opening, card })), ...fresh], due: due.length, fresh: fresh.length };
}

// ---------------------------------------------------------------------------
// Salvataggio

export const loadActivity = () => load<Activity>('activity', {});
export const loadGoal = () => load<number>('dailyGoal', DEFAULT_GOAL);
export const saveGoal = (goal: number) => save('dailyGoal', goal);

/** Una risposta in più per oggi (chiamata da ogni posizione ripassata e da ogni problema concluso). */
export function bumpActivity(n = 1) {
  save('activity', addActivity(loadActivity(), n));
}

export const doneToday = (activity: Activity = loadActivity(), now = Date.now()) => activity[dayKey(now)] ?? 0;
