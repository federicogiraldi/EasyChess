import { Chess } from 'chess.js';
import { load, save } from './storage';

/** Un problema della banca (dal database pubblico di Lichess). */
export interface Puzzle {
  id: string;
  /** Posizione prima della mossa dell'avversario che apre il problema. */
  fen: string;
  /** Mosse UCI: la prima è dell'avversario, poi si alternano tu e lui. */
  moves: string[];
  rating: number;
  themes: string[];
}

export interface PuzzleIndex {
  buckets: { rating: number; count: number }[];
  themes: string[];
  themeCounts: Record<string, number>;
}

export interface PuzzleStats {
  rating: number;
  /** Problemi classificati giocati: all'inizio il punteggio si muove di più. */
  games: number;
  solved: number;
  failed: number;
  streak: number;
  bestStreak: number;
}

export interface Mistake {
  id: string;
  rating: number;
}

const BASE = `${import.meta.env?.BASE_URL ?? './'}puzzles/`;

let indexPromise: Promise<PuzzleIndex> | null = null;
const bucketCache = new Map<number, Promise<Puzzle[]>>();

export function loadIndex(): Promise<PuzzleIndex> {
  indexPromise ??= fetch(`${BASE}index.json`).then((r) => {
    if (!r.ok) throw new Error(`banca problemi non trovata (${r.status})`);
    return r.json() as Promise<PuzzleIndex>;
  });
  indexPromise.catch(() => (indexPromise = null));
  return indexPromise;
}

/** Riga del file di una fascia: id, FEN, mosse, punteggio, temi (indici base 36 separati da punto). */
export function parseBucket(text: string, themes: string[]): Puzzle[] {
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [id, fen, moves, rating, codes] = line.split('\t');
      return {
        id,
        fen,
        moves: moves.split(' '),
        rating: Number(rating),
        themes: codes ? codes.split('.').map((c) => themes[parseInt(c, 36)]) : [],
      };
    });
}

export function loadBucket(rating: number): Promise<Puzzle[]> {
  let p = bucketCache.get(rating);
  if (!p) {
    p = Promise.all([loadIndex(), fetch(`${BASE}p${rating}.txt`).then((r) => {
      if (!r.ok) throw new Error(`fascia ${rating} non trovata (${r.status})`);
      return r.text();
    })]).then(([index, text]) => parseBucket(text, index.themes));
    p.catch(() => bucketCache.delete(rating));
    bucketCache.set(rating, p);
  }
  return p;
}

/** Fasce ordinate per vicinanza al punteggio cercato. */
export function bucketsNear(index: PuzzleIndex, target: number): number[] {
  return index.buckets
    .map((b) => b.rating)
    .sort((a, b) => Math.abs(a + 50 - target) - Math.abs(b + 50 - target));
}

export interface PickOptions {
  target: number;
  theme?: string;
  seen: Set<string>;
}

/**
 * Sceglie un problema non ancora visto vicino al punteggio cercato (con il tema richiesto),
 * allargando la ricerca alle fasce vicine se in quella giusta non ne restano.
 */
export async function pickPuzzle({ target, theme, seen }: PickOptions): Promise<Puzzle | null> {
  const index = await loadIndex();
  const order = bucketsNear(index, target);
  for (let i = 0; i < order.length; i++) {
    const all = await loadBucket(order[i]);
    const ok = all.filter((p) => !seen.has(p.id) && (!theme || p.themes.includes(theme)));
    if (ok.length === 0) continue;
    // Preferisci quelli entro 100 punti dal bersaglio, se ce ne sono.
    const close = ok.filter((p) => Math.abs(p.rating - target) <= 100);
    const pool = close.length > 0 ? close : ok;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}

export async function findPuzzle(id: string, rating: number): Promise<Puzzle | null> {
  const index = await loadIndex();
  for (const b of bucketsNear(index, rating).slice(0, 3)) {
    const hit = (await loadBucket(b)).find((p) => p.id === id);
    if (hit) return hit;
  }
  return null;
}

/** Colore di chi risolve: muove dopo la prima mossa (dell'avversario). */
export function solverColor(p: Puzzle): 'white' | 'black' {
  return p.fen.split(' ')[1] === 'w' ? 'black' : 'white';
}

/** Posizioni dopo ogni mossa della soluzione: fens[0] è la posizione di partenza. */
export function puzzleFens(p: Puzzle): string[] {
  const chess = new Chess(p.fen);
  const out = [chess.fen()];
  for (const m of p.moves) {
    chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
    out.push(chess.fen());
  }
  return out;
}

/**
 * Controlla la mossa del giocatore nella posizione `fen`, dove era attesa `expected` (UCI).
 * Come su Lichess, all'ultima mossa vale anche un altro matto.
 */
export function checkPuzzleMove(fen: string, from: string, to: string, expected: string, last: boolean): 'right' | 'wrong' | 'illegal' {
  if (from === expected.slice(0, 2) && to === expected.slice(2, 4)) return 'right';
  const chess = new Chess(fen);
  try {
    chess.move({ from, to, promotion: 'q' });
  } catch {
    return 'illegal';
  }
  return last && chess.isCheckmate() ? 'right' : 'wrong';
}

/** Elo semplice: nei primi problemi il punteggio si assesta in fretta. */
export function updateRating(stats: PuzzleStats, puzzleRating: number, win: boolean): PuzzleStats {
  const k = stats.games < 15 ? 60 : stats.games < 50 ? 32 : 20;
  const expected = 1 / (1 + 10 ** ((puzzleRating - stats.rating) / 400));
  const rating = Math.round(Math.max(400, Math.min(3200, stats.rating + k * ((win ? 1 : 0) - expected))));
  const streak = win ? stats.streak + 1 : 0;
  return {
    rating,
    games: stats.games + 1,
    solved: stats.solved + (win ? 1 : 0),
    failed: stats.failed + (win ? 0 : 1),
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
  };
}

export const DEFAULT_STATS: PuzzleStats = { rating: 1500, games: 0, solved: 0, failed: 0, streak: 0, bestStreak: 0 };

export const loadStats = () => load<PuzzleStats>('puzzles:stats', DEFAULT_STATS);
export const saveStats = (s: PuzzleStats) => save('puzzles:stats', s);
export const loadSeen = () => new Set(load<string[]>('puzzles:seen', []));
export const saveSeen = (s: Set<string>) => save('puzzles:seen', [...s]);
export const loadMistakes = () => load<Mistake[]>('puzzles:mistakes', []);
export const saveMistakes = (m: Mistake[]) => save('puzzles:mistakes', m);
