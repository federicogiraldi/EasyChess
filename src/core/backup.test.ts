// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { parseBackup, sanitizeCards, sanitizeSources } from './backup';
import { load } from './storage';
import { loadOpenings } from '../openings';

const card = { due: 1, interval: 1, ease: 2.5, reps: 1, lapses: 0, seen: 1, correct: 1, at: 1 };

describe('backup dei progressi', () => {
  it('rifiuta cards null, array o mancanti', () => {
    expect(() => parseBackup('{"version":1,"cards":null}')).toThrow(/formato/);
    expect(() => parseBackup('{"version":1,"cards":[]}')).toThrow(/formato/);
    expect(() => parseBackup('{"version":1}')).toThrow(/formato/);
    expect(() => parseBackup('null')).toThrow(/formato/);
  });

  it('scarta le schede malformate e tiene le buone', () => {
    expect(sanitizeCards({ a: card, b: null, c: { ...card, due: 'x' }, d: 3 })).toEqual({ a: card });
  });

  it('scarta le aperture importate malformate', () => {
    expect(sanitizeSources([null, 3, { file: 'a.pgn' }, { file: 'b.pgn', pgn: '1. e4 *', source: 'builtin' }])).toEqual([
      { file: 'b.pgn', pgn: '1. e4 *', source: 'imported' },
    ]);
    expect(parseBackup(JSON.stringify({ version: 1, cards: {}, imported: [null] })).imported).toEqual([]);
  });
});

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('usa il valore di riserva se quello salvato ha un\'altra forma', () => {
    localStorage.setItem('easychess:cards', 'null');
    expect(load('cards', {})).toEqual({});
    localStorage.setItem('easychess:imported', '{}');
    expect(load('imported', [])).toEqual([]);
    localStorage.setItem('easychess:imported', '[1]');
    expect(load('imported', [])).toEqual([1]);
  });
});

describe('aperture importate rotte', () => {
  it('diventano un errore rimovibile invece di un crash', () => {
    const { errors } = loadOpenings([{ file: 'rotta.pgn', pgn: '1. e4 e5 2. Ke3 *', source: 'imported' }]);
    expect(errors).toEqual([expect.objectContaining({ file: 'rotta.pgn', imported: true })]);
  });
});
