import { describe, it, expect } from 'vitest';
import { parseTypedMove } from './Board';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const CASTLE = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';

describe('mossa scritta da tastiera', () => {
  it('accetta SAN e UCI', () => {
    expect(parseTypedMove(START, 'Nf3')).toEqual({ from: 'g1', to: 'f3' });
    expect(parseTypedMove(START, ' e4 ')).toEqual({ from: 'e2', to: 'e4' });
    expect(parseTypedMove(START, 'g1f3')).toEqual({ from: 'g1', to: 'f3' });
    expect(parseTypedMove(START, 'e2-e4')).toEqual({ from: 'e2', to: 'e4' });
  });

  it('accetta l\u2019arrocco con le O o con gli zeri', () => {
    expect(parseTypedMove(CASTLE, 'O-O')).toEqual({ from: 'e1', to: 'g1' });
    expect(parseTypedMove(CASTLE, '0-0-0')).toEqual({ from: 'e1', to: 'c1' });
  });

  it('rifiuta mosse illegali o testo a caso', () => {
    expect(parseTypedMove(START, 'Ke2')).toBeNull();
    expect(parseTypedMove(START, 'ciao')).toBeNull();
    expect(parseTypedMove(START, '')).toBeNull();
  });
});
