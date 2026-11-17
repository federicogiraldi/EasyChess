import { classifyMove, gameAccuracy, moveAccuracy, winPercent, type PosEval, type SimPly } from './simulation';
import { SIM_QUALITY, type SimQuality } from './quality';

/**
 * Revisione di una partita, in comune tra Simulatore e Analisi. `fens[i]` è la posizione prima della
 * semimossa `plies[i]` (quindi `fens` ha una posizione in più delle semimosse); `evals` sono le
 * valutazioni di Stockfish già pronte, per FEN.
 */
export type Evals = Record<string, PosEval>;

/** Qualità di ogni semimossa: "libro" per la teoria, undefined finché mancano le valutazioni. */
export function qualitiesOf(plies: SimPly[], fens: string[], evals: Evals): (SimQuality | undefined)[] {
  return plies.map((p, i) => {
    if (p.book) return 'libro';
    const before = evals[fens[i]];
    const after = evals[fens[i + 1]];
    return before && after ? classifyMove(before, after, p.uci, p.white) : undefined;
  });
}

/** Precisione (0-100) di un giocatore, sulle sue mosse fuori dalla teoria già valutate. */
export function accuracyOf(plies: SimPly[], fens: string[], evals: Evals, white: boolean): number | undefined {
  const wp = (s: number) => (white ? winPercent(s) : 100 - winPercent(s));
  return gameAccuracy(
    plies.flatMap((p, i) => {
      if (p.white !== white || p.book) return [];
      const before = evals[fens[i]];
      const after = evals[fens[i + 1]];
      return before && after ? [moveAccuracy(wp(before.scoreWhite), wp(after.scoreWhite))] : [];
    }),
  );
}

/** I segni sul grafico della valutazione: errori ed errori gravi (indice = posizione dopo la mossa). */
export function errorMarks(qualities: (SimQuality | undefined)[]): { index: number; color: string }[] {
  return qualities.flatMap((q, i) => (q === 'errore' || q === 'grave' ? [{ index: i + 1, color: SIM_QUALITY[q].color }] : []));
}

/** Curva della probabilità di vittoria del Bianco, per il grafico. */
export const winCurve = (fens: string[], evals: Evals) => fens.map((f) => (evals[f] ? winPercent(evals[f].scoreWhite) : undefined));
