import { Chess } from 'chess.js';
import { engine, opponentEngine, ENGINE_ELO_MIN, EVAL_DEPTH } from './stockfish';
import { evaluate } from './judge';
import { reasonsFor, sanLine, uciToSan } from './reasons';
import { pickWeakMove, thinkTime, type PosEval } from '../core/simulation';

const MATE = 100000;

/** Telefono (schermo touch stretto): l'avversario pensa meno. Riguarda solo il suo tempo di gioco, non la precisione delle analisi. */
function isPhoneLike(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse) and (max-width: 760px)').matches;
}

/** Valutazione di una posizione (lato Bianco), anche quando la partita è finita. */
export async function evalPosition(fen: string): Promise<PosEval> {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) return { scoreWhite: chess.turn() === 'w' ? -MATE : MATE };
  if (chess.isDraw() || chess.isStalemate()) return { scoreWhite: 0 };
  const e = await evaluate(fen);
  return { scoreWhite: e.scoreWhite, mateWhite: e.mateWhite, best: e.best, line: e.line };
}

/** Mossa (UCI) dell'avversario Stockfish con la forza scelta. */
export async function opponentMove(fen: string, elo: number): Promise<string | undefined> {
  const movetime = thinkTime(elo, isPhoneLike());
  if (elo >= ENGINE_ELO_MIN) {
    const { bestmove, lines } = await opponentEngine.search(fen, { elo, movetime });
    return bestmove ?? lines[0]?.move;
  }
  const { bestmove, lines } = await opponentEngine.search(fen, { skill: 0, multiPv: 5, movetime });
  return pickWeakMove(lines, bestmove, elo);
}

export interface CoachLine {
  uci: string;
  san: string;
  /** Valutazione dal punto di vista di chi muove, in centipedoni. */
  score: number;
  mate?: number;
  line: string;
  reasons: string[];
}

/** Le migliori mosse secondo Stockfish, con il motivo in parole semplici. */
export async function coachLines(fen: string, count = 3): Promise<CoachLine[]> {
  const lines = await engine.analyze(fen, { depth: EVAL_DEPTH, multiPv: count });
  return lines.map((l) => ({
    uci: l.move,
    san: uciToSan(fen, l.move),
    score: l.score,
    mate: l.mate,
    line: sanLine(fen, l.pv, 8),
    reasons: reasonsFor(fen, l.pv).slice(0, 2),
  }));
}

export function sanFromUci(fen: string, uci: string): string {
  return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? 'q' }).san;
}
