import { describe, expect, it } from 'vitest';
import { parseOpening } from './pgnToTree';
import { STANDARD_FEN, type ImportedGame } from './analysis';
import { findGaps, firstGap, formatMoves } from './gaps';

const CK = parseOpening(
  `[Opening "Caro-Kann"]
[Color "black"]
[Id "ck"]

1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 *
1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 *`,
  'ck',
  'builtin',
);
const SLAV = parseOpening(
  `[Opening "Slava"]
[Color "black"]
[Id "slav"]

1. d4 d5 2. c4 c6 *`,
  'slav',
  'builtin',
);
const LONDON = parseOpening(
  `[Opening "Londra"]
[Color "white"]
[Id "london"]

1. d4 d5 2. Bf4 Nf6 3. e3 *`,
  'london',
  'builtin',
);
const OPENINGS = [CK, SLAV, LONDON];

let n = 0;
const game = (moves: string, result = '*'): ImportedGame => ({
  id: `g${n++}`,
  source: 'pgn',
  startFen: STANDARD_FEN,
  moves: moves.split(' '),
  white: 'W',
  black: 'B',
  result,
});

describe('buchi del repertorio', () => {
  it("riconosce una mossa dell'avversario non coperta", () => {
    const gap = firstGap(OPENINGS, game('e4 c6 d4 d5 f3 e6'), false);
    expect(gap).toMatchObject({ kind: 'uncovered', move: 'f3', moves: ['e4', 'c6', 'd4', 'd5'], openingId: 'ck', expected: ['e5', 'Nc3'] });
  });

  it('riconosce quando esco io dal repertorio, con la scheda da ripassare', () => {
    const gap = firstGap(OPENINGS, game('e4 c6 d4 d5 e5 c5'), false);
    expect(gap).toMatchObject({ kind: 'deviation', move: 'c5', expected: ['Bf5'] });
    expect(gap && typeof gap === 'object' && gap.cardKey?.startsWith('ck|')).toBe(true);
  });

  it('la fine di una linea preparata non è un buco', () => {
    expect(firstGap(OPENINGS, game('e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5'), false)).toBe('covered');
  });

  it('la prima mossa dell’avversario fuori repertorio è un buco', () => {
    expect(firstGap(OPENINGS, game('c4 e5'), false)).toMatchObject({ kind: 'uncovered', move: 'c4', moves: [] });
  });

  it('col Bianco usa solo le aperture col Bianco', () => {
    expect(firstGap(OPENINGS, game('d4 d5 Bf4 c5'), true)).toMatchObject({ kind: 'uncovered', move: 'c5', openingId: 'london' });
    expect(firstGap(OPENINGS, game('e4 e5'), true)).toMatchObject({ kind: 'deviation', move: 'e4', expected: ['d4'] });
  });

  it('una trasposizione in una posizione del repertorio non è un buco', () => {
    // 1.d4 c6 2.c4 d5 arriva alla stessa posizione della Slava (1.d4 d5 2.c4 c6).
    expect(firstGap(OPENINGS, game('d4 c6 c4 d5 Nc3'), false)).toBe('covered');
  });

  it('raggruppa le partite per posizione e conta le sconfitte', () => {
    const report = findGaps(OPENINGS, [
      { game: game('e4 c6 d4 d5 f3 e6', '1-0'), myWhite: false },
      { game: game('e4 c6 d4 d5 f3 dxe4', '0-1'), myWhite: false },
      { game: game('c4 e5'), myWhite: false },
      { game: game('e4 c6 d4 d5 e5 Bf5 Nf3 e6'), myWhite: false },
      { game: game('e4 e5'), myWhite: undefined },
    ]);
    expect(report.checked).toBe(4);
    expect(report.covered).toBe(1);
    expect(report.uncovered.map((g) => [g.move, g.games, g.lost])).toEqual([
      ['f3', 2, 1],
      ['c4', 1, 0],
    ]);
  });

  it('scrive le mosse con i numeri giusti', () => {
    expect(formatMoves(['e4', 'c6', 'd4'])).toBe('1.e4 c6 2.d4');
    expect(formatMoves(['d5'], 3)).toBe('2...d5');
  });
});
