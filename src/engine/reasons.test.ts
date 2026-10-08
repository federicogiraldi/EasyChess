import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { hangingPieces, materialSwing, reasonsAgainst, reasonsFor, sanLine } from './reasons';

const fenAfter = (moves: string) => {
  const c = new Chess();
  for (const m of moves.split(' ')) c.move(m);
  return c.fen();
};

describe('reasons', () => {
  it('scrive le varianti con i numeri di mossa', () => {
    expect(sanLine(fenAfter('e4 c6'), ['d2d4', 'd7d5', 'e4e5'])).toBe('2.d4 d5 3.e5');
    expect(sanLine(fenAfter('e4 c6 d4'), ['d7d5', 'e4e5'])).toBe('2...d5 3.e5');
  });

  it('conta il materiale perso lungo la variante', () => {
    // 2...a6? 3.Nxe5: il Nero perde il pedone e5
    const fen = fenAfter('e4 e5 Nf3');
    expect(materialSwing(fen, ['a7a6', 'f3e5'], 2)).toBe(-1);
  });

  it('trova i pezzi appesi', () => {
    const c = new Chess(fenAfter('e4 e5 Nf3 Qh4'));
    expect(hangingPieces(c, 'b').map((h) => h.square)).toEqual(['e5', 'h4']); // e5 attaccato da Nf3 e indifeso
  });

  it("segnala l'alfiere chiuso (...e6 prima di ...Bf5 nella Caro-Kann)", () => {
    const fen = fenAfter('e4 c6 d4 d5 e5');
    expect(reasonsAgainst(fen, ['e7e6', 'g1f3']).join(' ')).toMatch(/alfiere in c8/);
  });

  it('segnala la donna uscita troppo presto', () => {
    const fen = fenAfter('e4 c6 d4');
    expect(reasonsAgainst(fen, ['d8a5', 'c1d2']).join(' ')).toMatch(/donna troppo presto/);
  });

  it('descrive i pregi della mossa migliore', () => {
    const fen = fenAfter('e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2');
    const r = reasonsFor(fen, ['c6c5']).join(' ');
    expect(r).toMatch(/Attacca il pedone in d4/);
  });

  it('riconosce lo sviluppo con attacco', () => {
    const fen = fenAfter('e4 e5 Nf3 Qh4');
    expect(reasonsFor(fen, ['f3h4']).join(' ')).toMatch(/Cattura la donna/);
  });
});
