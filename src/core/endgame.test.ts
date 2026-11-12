import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { bestMove, defend, distance, movesToMate, randomStart, solve } from './endgame';

const maxMoves = (piece: 'q' | 'r') => {
  const t = solve(piece);
  let m = 0;
  for (const v of t.wtm) if (v !== 255 && v > m) m = v;
  return movesToMate(m);
};

describe('finali Re+pezzo contro Re', () => {
  it('matto più lungo: 10 mosse con la Donna, 16 con la Torre', () => {
    expect(maxMoves('q')).toBe(10);
    expect(maxMoves('r')).toBe(16);
  });

  it('riconosce matto in 1 e stallo', () => {
    expect(distance('1k6/8/1K6/8/8/8/8/7Q w - - 0 1', 'q')).toBe(1);
    // Qb6?? sarebbe stallo: la posizione col Nero a muovere non è vinta
    expect(distance('k7/8/1QK5/8/8/8/8/8 b - - 0 1', 'q')).toBeNull();
    expect(distance('k7/1RK5/8/8/8/8/8/8 b - - 0 1', 'r')).toBeNull();
  });

  it('il suggerimento e la difesa portano al matto nei tempi giusti', () => {
    for (const piece of ['q', 'r'] as const) {
      const fen = randomStart(piece, 6, 9);
      const c = new Chess(fen);
      const start = distance(fen, piece)!;
      let plies = 0;
      while (!c.isGameOver()) {
        const uci = c.turn() === 'w' ? bestMove(c.fen(), piece)! : defend(c.fen(), piece)!;
        c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
        plies++;
      }
      expect(c.isCheckmate()).toBe(true);
      expect(plies).toBe(start);
    }
  });
});
