import type { Opening } from '../model/types';
import type { CardState } from './srs';
import { isDue, isMastered } from './srs';
import { cardPositions, countLeaves } from './tree';
import type { AnalyzedGame } from './analysis';
import type { SimGame } from './simulation';

/** Nuove posizioni proposte in ogni sessione di Ripasso (come in Review). */
export const NEW_PER_SESSION = 10;

export interface OpeningSummary {
  id: string;
  name: string;
  color: 'white' | 'black';
  lines: number;
  total: number;
  mastered: number;
  /** Posizioni già viste e in scadenza. */
  due: number;
  fresh: number;
  /** Quello che il Ripasso propone oggi: le scadute più al massimo 10 nuove. */
  toReview: number;
  /** Ultima risposta data in questa apertura (ms), se c'è. */
  lastAt?: number;
  courseDone: number;
  courseTotal: number;
}

export function summarizeOpening(
  opening: Opening,
  cards: Record<string, CardState>,
  courseDone: number,
  now = Date.now(),
): OpeningSummary {
  const states = cardPositions(opening).map((c) => cards[c.key]);
  const due = states.filter((s) => isDue(s, now)).length;
  const fresh = states.filter((s) => !s).length;
  const lastAt = states.reduce<number | undefined>((m, s) => (s?.at && (!m || s.at > m) ? s.at : m), undefined);
  return {
    id: opening.id,
    name: opening.name,
    color: opening.color,
    lines: countLeaves(opening.root),
    total: states.length,
    mastered: states.filter(isMastered).length,
    due,
    fresh,
    toReview: due + Math.min(fresh, NEW_PER_SESSION),
    lastAt,
    courseDone: Math.min(courseDone, opening.course?.lessons.length ?? 0),
    courseTotal: opening.course?.lessons.length ?? 0,
  };
}

export const pct = (part: number, total: number) => (total ? Math.round((100 * part) / total) : 0);

/** Posizioni allenate (risposta data) negli ultimi `days` giorni, su tutte le aperture. */
export function trainedSince(cards: Record<string, CardState>, days: number, now = Date.now()): number {
  const from = now - days * 24 * 60 * 60 * 1000;
  return Object.values(cards).filter((c) => (c.at ?? 0) >= from).length;
}

// ---------------------------------------------------------------------------
// Storico del punteggio dei problemi: un punto al giorno (l'ultimo punteggio della giornata).

export interface RatingPoint {
  /** AAAA-MM-GG, nel fuso orario locale. */
  d: string;
  r: number;
  /** Problemi classificati giocati fino a quel momento: serve a unire due dispositivi. */
  n: number;
}

const HISTORY_MAX = 365;

export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addRatingPoint(history: RatingPoint[], rating: number, games: number, now = Date.now()): RatingPoint[] {
  const d = dayKey(now);
  const rest = history.filter((p) => p.d !== d);
  return [...rest, { d, r: rating, n: games }].sort((a, b) => a.d.localeCompare(b.d)).slice(-HISTORY_MAX);
}

/** Unione di due storici: per ogni giorno vince il punto con più problemi giocati. */
export function mergeRatingHistory(a: RatingPoint[], b: RatingPoint[]): RatingPoint[] {
  const byDay = new Map<string, RatingPoint>();
  for (const p of [...a, ...b]) {
    const cur = byDay.get(p.d);
    if (!cur || p.n > cur.n) byDay.set(p.d, p);
  }
  return [...byDay.values()].sort((x, y) => x.d.localeCompare(y.d)).slice(-HISTORY_MAX);
}

// ---------------------------------------------------------------------------
// Precisione nelle partite (Simulatore + partite analizzate in cui so con che colore giocavo).

export interface AccuracyPoint {
  id: string;
  /** AAAA-MM-GG */
  date: string;
  accuracy: number;
  source: 'sim' | 'analysis';
  label: string;
}

export function accuracySeries(sim: SimGame[], analyzed: AnalyzedGame[], names: Record<string, string> = {}): AccuracyPoint[] {
  const out: AccuracyPoint[] = [];
  for (const g of sim) {
    if (g.accuracy?.me === undefined) continue;
    const opening = names[g.openingId] ?? g.openingId;
    out.push({ id: g.id, date: g.date.slice(0, 10), accuracy: g.accuracy.me, source: 'sim', label: `Simulatore · ${opening} · Elo ${g.elo}` });
  }
  for (const g of analyzed) {
    if (g.myWhite === undefined) continue;
    const acc = g.myWhite ? g.accuracy?.white : g.accuracy?.black;
    if (acc === undefined) continue;
    const opp = g.myWhite ? g.black : g.white;
    out.push({ id: g.id, date: (g.date ?? g.analyzedAt ?? '').replace(/\./g, '-').slice(0, 10), accuracy: acc, source: 'analysis', label: `Partita contro ${opp}` });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function average(xs: number[]): number | undefined {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined;
}
