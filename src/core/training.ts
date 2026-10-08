import type { Arrow, Opening, OpeningNode } from '../model/types';
import { cardKey, nextMoves, walk } from './tree';
import { getCard, recordAnswer } from './progress';
import { isDue } from './srs';
import { sanOf } from '../components/Board';

export const SOLUTION_ARROW = 'rgba(21, 128, 61, 0.85)';

export interface MoveCheck {
  /** null se la mossa è illegale: la scacchiera la rifiuta senza contare un errore. */
  san: string | null;
  match?: OpeningNode;
  expected: OpeningNode[];
}

export function checkMove(node: OpeningNode, from: string, to: string): MoveCheck {
  const expected = nextMoves(node);
  const san = sanOf(node.fen, from, to);
  return { san, match: san ? expected.find((c) => c.san === san) : undefined, expected };
}

/** Registra la risposta per la card di questa posizione (solo al primo tentativo). */
export function gradePosition(opening: Opening, node: OpeningNode, correct: boolean) {
  recordAnswer(cardKey(opening, node), correct);
}

export function solutionArrows(expected: OpeningNode[]): Arrow[] {
  return expected.map((c) => ({ from: c.from, to: c.to, color: SOLUTION_ARROW }));
}

/** Quante posizioni nuove o da ripassare ci sono in questo ramo: guida la scelta dell'avversario. */
export function pendingInSubtree(opening: Opening, node: OpeningNode): number {
  let count = 0;
  walk(node, (n) => {
    const moves = nextMoves(n);
    if (moves.length > 0 && moves[0].isUserMove) {
      const s = getCard(cardKey(opening, n));
      if (!s || isDue(s)) count++;
    }
  });
  return count;
}

/** Sceglie la risposta dell'avversario, preferendo i rami con più cose da imparare. */
export function pickOpponentMove(opening: Opening, options: OpeningNode[]): OpeningNode {
  const weights = options.map((o) => 1 + 3 * pendingInSubtree(opening, o));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) {
    r -= weights[i];
    if (r <= 0) return options[i];
  }
  return options[options.length - 1];
}
