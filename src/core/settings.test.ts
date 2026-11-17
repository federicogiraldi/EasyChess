import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { DEFAULT_SETTINGS, normalize } from './settings';
import { moveSound } from './sound';

describe('impostazioni', () => {
  it('senza dati salvati usa i valori predefiniti', () => {
    expect(normalize(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('completa i dati vecchi e corregge i valori non validi', () => {
    const s = normalize({ boardTheme: 'neon' as never, theme: 'blu' as never, volume: 4, animation: 'lenta' as never, sound: false });
    expect(s).toEqual({ ...DEFAULT_SETTINGS, sound: false, volume: 1 });
    expect(normalize({ boardTheme: 'green', volume: -1 })).toMatchObject({ boardTheme: 'green', volume: 0 });
  });
});

describe('suono della mossa', () => {
  const play = (fen: string, san: string) => moveSound(new Chess(fen).move(san));

  it('distingue mossa, cattura, arrocco e scacco', () => {
    expect(play('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e4')).toBe('move');
    expect(play('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'exd5')).toBe('capture');
    expect(play('r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', 'O-O')).toBe('castle');
    expect(play('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'Qh5')).toBe('move');
    expect(play('rnbqkbnr/ppppp2p/5p2/6p1/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3', 'Qh5#')).toBe('check');
  });

  it('presa en passant = cattura', () => {
    expect(play('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3', 'exf6')).toBe('capture');
  });
});
