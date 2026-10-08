import { Chess } from 'chess.js';
import type { OpeningNode } from '../model/types';
import { engine, winChance, type EngineLine } from './stockfish';
import { reasonsAgainst, reasonsFor, sanLine } from './reasons';

export type Quality = 'migliore' | 'buona' | 'imprecisione' | 'errore' | 'grave';

export const QUALITY_INFO: Record<Quality, { label: string; symbol: string }> = {
  migliore: { label: 'Mossa migliore', symbol: '!' },
  buona: { label: 'Buona mossa', symbol: '' },
  imprecisione: { label: 'Imprecisione', symbol: '?!' },
  errore: { label: 'Errore', symbol: '?' },
  grave: { label: 'Errore grave', symbol: '??' },
};

export interface Verdict {
  quality: Quality;
  playedSan: string;
  /** Valutazioni in centipedoni dal punto di vista di chi ha mosso. */
  playedScore: number;
  /** Mossa con cui confrontare: quella del repertorio se esiste, altrimenti la migliore dell'engine. */
  better?: {
    san: string;
    score: number;
    line: string;
    source: 'repertorio' | 'engine';
    node?: OpeningNode;
    reasons: string[];
  };
  inRepertoire: boolean;
  against: string[];
  /** Valutazione della posizione dopo la mossa, dal punto di vista del Bianco. */
  evalWhite: number;
  mateWhite?: number;
}

const DEPTH = 14;

function toUci(fen: string, san: string): string {
  const m = new Chess(fen).move(san);
  return m.from + m.to + (m.promotion ?? '');
}

async function lineFor(fen: string, uci: string, known: EngineLine[]): Promise<EngineLine> {
  const hit = known.find((l) => l.move === uci);
  if (hit) return hit;
  const [line] = await engine.analyze(fen, { depth: DEPTH, searchMoves: [uci] });
  return line ?? { move: uci, score: 0, pv: [uci], depth: 0 };
}

/**
 * Valuta `playedSan` nella posizione `fen`.
 * `repertoire` sono le mosse previste dal repertorio in questa posizione (se ce ne sono).
 */
export async function judgeMove(fen: string, playedSan: string, repertoire: OpeningNode[] = []): Promise<Verdict> {
  const white = fen.split(' ')[1] === 'w';
  const playedUci = toUci(fen, playedSan);
  const top = await engine.analyze(fen, { depth: DEPTH, multiPv: 3 });
  const played = await lineFor(fen, playedUci, top);

  const inRepertoire = repertoire.some((n) => n.san === playedSan);
  let betterNode: OpeningNode | undefined;
  let betterLine: EngineLine | undefined;
  if (repertoire.length > 0 && !inRepertoire) {
    // Tra le mosse del repertorio, quella che l'engine preferisce.
    const lines = await Promise.all(repertoire.map((n) => lineFor(fen, toUci(fen, n.san), top)));
    const i = lines.reduce((best, l, j) => (l.score > lines[best].score ? j : best), 0);
    betterNode = repertoire[i];
    betterLine = lines[i];
  } else if (top[0] && top[0].move !== playedUci) {
    betterLine = top[0];
  }

  const bestScore = Math.max(played.score, top[0]?.score ?? played.score, betterLine?.score ?? -Infinity);
  const loss = winChance(bestScore) - winChance(played.score);
  const quality: Quality =
    top[0]?.move === playedUci || loss < 0.02
      ? top[0]?.move === playedUci ? 'migliore' : 'buona'
      : loss < 0.1 ? 'buona'
      : loss < 0.2 ? 'imprecisione'
      : loss < 0.3 ? 'errore'
      : 'grave';

  const after = new Chess(fen);
  after.move(playedSan);

  return {
    quality,
    playedSan,
    playedScore: played.score,
    inRepertoire,
    // Anche quando l'engine la considera giocabile, se devii dal repertorio ti dico cosa perdi rispetto al piano.
    against: quality === 'migliore' || (quality === 'buona' && (inRepertoire || !betterNode)) ? [] : reasonsAgainst(fen, played.pv),
    better: betterLine && {
      san: betterNode?.san ?? new Chess(fen).move({ from: betterLine.move.slice(0, 2), to: betterLine.move.slice(2, 4), promotion: betterLine.move[4] ?? 'q' }).san,
      score: betterLine.score,
      line: sanLine(fen, betterLine.pv, 6),
      source: betterNode ? 'repertorio' : 'engine',
      node: betterNode,
      reasons: reasonsFor(fen, betterLine.pv),
    },
    evalWhite: white ? played.score : -played.score,
    mateWhite: played.mate === undefined ? undefined : white ? played.mate : -played.mate,
  };
}

/** Valutazione della posizione dal punto di vista del Bianco + mossa migliore. */
export async function evaluate(fen: string) {
  const [line] = await engine.analyze(fen, { depth: DEPTH });
  const white = fen.split(' ')[1] === 'w';
  if (!line) return { scoreWhite: 0, best: undefined as string | undefined, line: '' };
  return {
    scoreWhite: white ? line.score : -line.score,
    mateWhite: line.mate === undefined ? undefined : white ? line.mate : -line.mate,
    best: line.move,
    line: sanLine(fen, line.pv, 8),
  };
}
