import { Chess } from 'chess.js';
import type { Opening, OpeningNode } from '../model/types';
import { findInBook, nextMoves, normalizeFen, pathFromRoot } from './tree';
import { pickOpponentMove } from './training';
import { qualityFromLoss, type Quality } from '../engine/judge';
import { winChance, type EngineLine } from '../engine/stockfish';
import { load, save } from './storage';

/** Come su chess.com: le mosse di teoria hanno la loro categoria. */
export type SimQuality = Quality | 'libro';

export const SIM_QUALITY: Record<SimQuality, { label: string; symbol: string; icon: string; color: string }> = {
  libro: { label: 'Libro', symbol: '', icon: '📖', color: '#a8865c' },
  migliore: { label: 'Migliore', symbol: '!', icon: '★', color: '#5c9b2f' },
  buona: { label: 'Buona', symbol: '', icon: '✓', color: '#77915f' },
  imprecisione: { label: 'Imprecisione', symbol: '?!', icon: '?!', color: '#e0a82e' },
  errore: { label: 'Errore', symbol: '?', icon: '?', color: '#e5762c' },
  grave: { label: 'Errore grave', symbol: '??', icon: '??', color: '#d43a2f' },
};

export const SIM_QUALITY_ORDER: SimQuality[] = ['libro', 'migliore', 'buona', 'imprecisione', 'errore', 'grave'];

/** Valutazione di una posizione dal punto di vista del Bianco, con la mossa migliore. */
export interface PosEval {
  scoreWhite: number;
  mateWhite?: number;
  best?: string;
  line?: string;
}

// ---------------------------------------------------------------------------
// Precisione (stessa formula di Lichess, molto simile a quella di chess.com)

/** Probabilità di vittoria del Bianco in percentuale (0-100). */
export function winPercent(scoreWhite: number): number {
  return 50 + 50 * winChance(scoreWhite);
}

/** Precisione di una singola mossa (0-100) dalla percentuale di vittoria di chi muove, prima e dopo. */
export function moveAccuracy(wpBefore: number, wpAfter: number): number {
  if (wpAfter >= wpBefore) return 100;
  const acc = 103.1668100711649 * Math.exp(-0.04354415386753951 * (wpBefore - wpAfter)) - 3.166924740191411;
  return Math.max(0, Math.min(100, acc));
}

/** Precisione della partita: media tra media aritmetica e armonica (punisce di più gli errori gravi). */
export function gameAccuracy(accuracies: number[]): number | undefined {
  if (accuracies.length === 0) return undefined;
  const mean = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
  const harmonic = accuracies.length / accuracies.reduce((a, b) => a + 1 / Math.max(b, 1), 0);
  return (mean + harmonic) / 2;
}

/** Classifica la mossa `uci` giocata da `moverWhite` tra le due valutazioni. */
export function classifyMove(before: PosEval, after: PosEval, uci: string, moverWhite: boolean): SimQuality {
  const sign = moverWhite ? 1 : -1;
  const loss = winChance(sign * before.scoreWhite) - winChance(sign * after.scoreWhite);
  return qualityFromLoss(Math.max(0, loss), before.best === uci);
}

// ---------------------------------------------------------------------------
// Partita

export interface SimPly {
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  white: boolean;
  /** Mossa del repertorio (fino a qui la partita è rimasta nel libro). */
  book: boolean;
}

/** Ricostruisce le semimosse, segnando quelle "da libro" (prefisso della partita dentro il repertorio). */
export function buildPlies(opening: Opening, moves: string[]): SimPly[] {
  const chess = new Chess(opening.root.fen);
  const out: SimPly[] = [];
  let inBook = true;
  for (const san of moves) {
    const fenBefore = chess.fen();
    const node: OpeningNode | undefined = inBook ? findInBook(opening.root, fenBefore) : undefined;
    inBook = !!node && nextMoves(node).some((c) => c.san === san);
    const m = chess.move(san);
    out.push({ san: m.san, uci: m.from + m.to + (m.promotion ?? ''), fenBefore, fenAfter: chess.fen(), white: m.color === 'w', book: inBook });
  }
  return out;
}

/** Nodo del repertorio della posizione corrente, se la partita è ancora tutta nel libro. */
export function bookNode(opening: Opening, plies: SimPly[]): OpeningNode | undefined {
  if (plies.some((p) => !p.book)) return undefined;
  const fen = plies.length ? plies[plies.length - 1].fenAfter : opening.root.fen;
  const node = findInBook(opening.root, fen);
  return node && nextMoves(node).length > 0 ? node : undefined;
}

/**
 * Risposta dell'avversario dal repertorio. Se è stata scelta una linea, la segue finché non la raggiunge;
 * poi (o senza linea) sceglie tra le varianti preferendo quelle che conosci meno.
 */
export function bookReply(opening: Opening, node: OpeningNode, target?: OpeningNode): OpeningNode {
  const options = nextMoves(node);
  if (target) {
    const onPath = new Set(pathFromRoot(target).map((n) => normalizeFen(n.fen)));
    const towards = options.find((o) => onPath.has(normalizeFen(o.fen)));
    if (towards) return towards;
  }
  return pickOpponentMove(opening, options);
}

export interface Outcome {
  over: boolean;
  text?: string;
  /** 1 vince il Bianco, 0 patta, -1 vince il Nero. */
  score?: 1 | 0 | -1;
}

export function outcomeOf(startFen: string, moves: string[]): Outcome {
  const chess = new Chess(startFen);
  moves.forEach((m) => chess.move(m));
  if (chess.isCheckmate()) {
    const whiteWins = chess.turn() === 'b';
    return { over: true, text: `Scacco matto: vince il ${whiteWins ? 'Bianco' : 'Nero'}`, score: whiteWins ? 1 : -1 };
  }
  if (chess.isStalemate()) return { over: true, text: 'Patta per stallo', score: 0 };
  if (chess.isThreefoldRepetition()) return { over: true, text: 'Patta per triplice ripetizione', score: 0 };
  if (chess.isInsufficientMaterial()) return { over: true, text: 'Patta per materiale insufficiente', score: 0 };
  if (chess.isDraw()) return { over: true, text: 'Patta (regola delle 50 mosse)', score: 0 };
  return { over: false };
}

// ---------------------------------------------------------------------------
// Forza dell'avversario

export const SIM_ELO_MIN = 400;
export const SIM_ELO_MAX = 3000;

export function eloLabel(elo: number): string {
  if (elo < 800) return 'Principiante';
  if (elo < 1200) return 'Principiante avanzato';
  if (elo < 1600) return 'Intermedio';
  if (elo < 2000) return 'Giocatore di club';
  if (elo < 2400) return 'Esperto';
  return 'Maestro';
}

/**
 * Sotto i 1320 Elo Stockfish non sa giocare più debole da solo: usiamo Skill Level 0
 * e ogni tanto scegliamo apposta una mossa peggiore tra le sue alternative.
 * Restituisce la probabilità di una mossa "umana" sbagliata.
 */
export function weakMoveChance(elo: number): number {
  return Math.max(0, Math.min(0.6, (1320 - elo) / 1600));
}

/** Sceglie la mossa dell'avversario debole tra le linee di Stockfish. `rand` in [0,1). */
export function pickWeakMove(lines: EngineLine[], bestmove: string | undefined, elo: number, rand: () => number = Math.random): string | undefined {
  const best = bestmove ?? lines[0]?.move;
  const alternatives = lines.slice(1).filter((l) => l.move !== best);
  if (alternatives.length === 0 || rand() >= weakMoveChance(elo)) return best;
  return alternatives[Math.floor(rand() * alternatives.length)].move;
}

/** Tempo di riflessione dell'avversario (ms): più forte = pensa di più. */
export function thinkTime(elo: number, phone: boolean): number {
  const t = elo < 1320 ? 250 : Math.min(1200, 300 + (elo - 1320) / 2);
  return Math.round(phone ? t * 0.6 : t);
}

// ---------------------------------------------------------------------------
// Impostazioni e storico

export type HintMode = 'off' | 'request' | 'always';

export interface SimSettings {
  elo: number;
  hints: HintMode;
  evalBar: boolean;
  /** Frecce sulla scacchiera per le mosse consigliate (come l'engine di chess.com). */
  arrows: boolean;
}

export const DEFAULT_SETTINGS: SimSettings = { elo: 1200, hints: 'request', evalBar: true, arrows: true };

export function loadSettings(): SimSettings {
  return { ...DEFAULT_SETTINGS, ...load<Partial<SimSettings>>('simSettings', {}) };
}

export function saveSettings(s: SimSettings) {
  save('simSettings', s);
}

export interface SimGame {
  id: string;
  date: string;
  openingId: string;
  lineName?: string;
  elo: number;
  moves: string[];
  result: string;
  accuracy?: { me?: number; opp?: number };
}

const HISTORY_MAX = 30;

export function loadHistory(): SimGame[] {
  return load<SimGame[]>('simGames', []);
}

export function saveGame(game: SimGame) {
  const rest = loadHistory().filter((g) => g.id !== game.id);
  save('simGames', [game, ...rest].slice(0, HISTORY_MAX));
}

export function toPgn(opening: Opening, game: SimGame, myWhite: boolean): string {
  const chess = new Chess(opening.root.fen);
  game.moves.forEach((m) => chess.move(m));
  const me = 'EasyChess';
  const bot = `Stockfish (${game.elo})`;
  const result = /vince il Bianco/.test(game.result) ? '1-0' : /vince il Nero/.test(game.result) ? '0-1' : /Patta/.test(game.result) ? '1/2-1/2' : '*';
  const headers: Record<string, string> = {
    Event: `EasyChess Simulatore${game.lineName ? ` - ${game.lineName}` : ''}`,
    Date: game.date.slice(0, 10).replace(/-/g, '.'),
    White: myWhite ? me : bot,
    Black: myWhite ? bot : me,
    Opening: opening.name,
    Result: result,
  };
  Object.entries(headers).forEach(([k, v]) => chess.setHeader(k, v));
  return chess.pgn().replace(/\s*\*?$/, '') + ` ${result}\n`;
}
