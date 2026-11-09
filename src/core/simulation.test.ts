import { describe, expect, it } from 'vitest';
import { parseOpening } from './pgnToTree';
import { namedLines } from './tree';
import {
  bookNode,
  bookReply,
  buildPlies,
  classifyMove,
  gameAccuracy,
  moveAccuracy,
  outcomeOf,
  pickWeakMove,
  toPgn,
  weakMoveChance,
  winPercent,
} from './simulation';

const PGN = `
[Opening "Test Nero"]
[Color "black"]
[Id "test-sim"]

1. e4 c6 2. d4 d5 3. e5 { [%line Avanzata] } Bf5 *

1. e4 c6 2. d4 d5 3. Nc3 { [%line Classica] } dxe4 4. Nxe4 Bf5 *

1. e4 c6 2. d4 d5 3. exd5 { [%line Cambio] } cxd5 *
`;

const op = parseOpening(PGN, 'fallback');
const line = (name: string) => namedLines(op.root).find((l) => l.node.lineName === name)!.node;

describe('precisione', () => {
  it('percentuale di vittoria simmetrica', () => {
    expect(winPercent(0)).toBeCloseTo(50);
    expect(winPercent(300)).toBeGreaterThan(70);
    expect(winPercent(-300)).toBeCloseTo(100 - winPercent(300));
  });

  it('mossa perfetta = 100, perdere molto = quasi 0', () => {
    expect(moveAccuracy(60, 60)).toBe(100);
    expect(moveAccuracy(60, 65)).toBe(100);
    expect(moveAccuracy(60, 55)).toBeGreaterThan(75);
    expect(moveAccuracy(90, 10)).toBeLessThan(5);
  });

  it('un errore grave pesa più della media', () => {
    expect(gameAccuracy([])).toBeUndefined();
    expect(gameAccuracy([100, 100, 100])).toBeCloseTo(100);
    const acc = gameAccuracy([100, 100, 100, 0])!;
    expect(acc).toBeLessThan(75);
    expect(acc).toBeGreaterThan(30);
  });
});

describe('classificazione', () => {
  it('migliore se è la mossa di Stockfish', () => {
    expect(classifyMove({ scoreWhite: 30, best: 'e2e4' }, { scoreWhite: 30 }, 'e2e4', true)).toBe('migliore');
  });
  it('dal punto di vista di chi muove', () => {
    // Il Nero perde 4 punti: errore grave
    expect(classifyMove({ scoreWhite: 0, best: 'e7e5' }, { scoreWhite: 400 }, 'f7f6', false)).toBe('grave');
    // Il Nero migliora la sua posizione (per lui il Bianco sta peggio): mai un errore
    expect(classifyMove({ scoreWhite: 0, best: 'e7e5' }, { scoreWhite: -50 }, 'd7d5', false)).toBe('buona');
    expect(classifyMove({ scoreWhite: 0, best: 'e2e4' }, { scoreWhite: -90 }, 'g2g4', true)).toBe('imprecisione');
  });
});

describe('partita e libro', () => {
  it('segna le mosse da libro fino alla prima deviazione', () => {
    const plies = buildPlies(op, ['e4', 'c6', 'd4', 'd5', 'Nc3', 'g6', 'e5']);
    expect(plies.map((p) => p.book)).toEqual([true, true, true, true, true, false, false]);
    expect(plies[0].uci).toBe('e2e4');
    expect(bookNode(op, plies)).toBeUndefined();
    expect(bookNode(op, plies.slice(0, 4))?.san).toBe('d5');
  });

  it("l'avversario segue la linea scelta", () => {
    const afterD5 = bookNode(op, buildPlies(op, ['e4', 'c6', 'd4', 'd5']))!;
    for (let i = 0; i < 10; i++) {
      expect(bookReply(op, afterD5, line('Cambio')).san).toBe('exd5');
      expect(bookReply(op, afterD5, line('Avanzata')).san).toBe('e5');
    }
    expect(['e5', 'Nc3', 'exd5']).toContain(bookReply(op, afterD5).san);
  });

  it('riconosce matto e patta', () => {
    const fool = ['f3', 'e5', 'g4', 'Qh4#'];
    expect(outcomeOf(op.root.fen, fool)).toMatchObject({ over: true, score: -1 });
    expect(outcomeOf(op.root.fen, ['e4']).over).toBe(false);
  });

  it('esporta il PGN', () => {
    const pgn = toPgn(op, { id: '1', date: '2026-11-03T10:00:00Z', openingId: op.id, elo: 1500, moves: ['f3', 'e5', 'g4', 'Qh4#'], result: 'Scacco matto: vince il Nero' }, false);
    expect(pgn).toContain('[White "Stockfish (1500)"]');
    expect(pgn).toContain('[Black "EasyChess"]');
    expect(pgn).toContain('2. g4 Qh4#');
    expect(pgn.trim().endsWith('0-1')).toBe(true);
  });
});

describe('avversario debole', () => {
  const lines = ['e2e4', 'd2d4', 'g1f3'].map((move) => ({ move, score: 0, pv: [move], depth: 10 }));
  it('sopra 1320 Elo nessuna mossa scelta apposta peggiore', () => {
    expect(weakMoveChance(1500)).toBe(0);
    expect(pickWeakMove(lines, 'e2e4', 1500, () => 0)).toBe('e2e4');
  });
  it('sotto sceglie a volte un’alternativa', () => {
    expect(weakMoveChance(400)).toBeGreaterThan(weakMoveChance(1000));
    expect(pickWeakMove(lines, 'e2e4', 400, () => 0)).toBe('d2d4');
    expect(pickWeakMove(lines, 'e2e4', 400, () => 0.99)).toBe('e2e4');
  });
});
