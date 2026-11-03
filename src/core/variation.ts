import { Chess } from 'chess.js';

/** Una variante da mostrare sulla scacchiera: posizioni e mosse a partire da `startFen`. */
export interface VariationStep {
  fen: string;
  san: string;
  from: string;
  to: string;
  /** "5.Nf3" o "5...Nf6" */
  label: string;
}

export interface BuiltVariation {
  startFen: string;
  steps: VariationStep[];
}

/** Massimo di semimosse mostrate: oltre, la variante di Stockfish diventa poco affidabile e difficile da seguire. */
export const VARIATION_MAX_PLIES = 10;

/** Gioca le mosse UCI da `startFen` (si ferma alla prima illegale). */
export function buildVariation(startFen: string, uci: string[], maxPlies = VARIATION_MAX_PLIES): BuiltVariation {
  const chess = new Chess(startFen);
  const steps: VariationStep[] = [];
  for (const u of uci.slice(0, maxPlies)) {
    const num = chess.moveNumber();
    const white = chess.turn() === 'w';
    let m;
    try {
      m = chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] ?? undefined });
    } catch {
      break;
    }
    steps.push({ fen: chess.fen(), san: m.san, from: m.from, to: m.to, label: white ? `${num}.${m.san}` : `${num}...${m.san}` });
  }
  return { startFen, steps };
}
