import { describe, expect, it } from 'vitest';
import { parseOpening } from './pgnToTree';
import { groupOpenings, keyMoves, nextStep, since } from './home';
import type { OpeningSummary } from './dashboard';

const op = (id: string, color: string, pgn: string) =>
  parseOpening(`[Opening "${id}"]\n[Id "${id}"]\n[Color "${color}"]\n\n${pgn}`, id, 'builtin');

const CK = op('ck', 'black', '1. e4 c6 2. d4 d5 3. e5 Bf5 *\n1. e4 c6 2. d4 d5 3. Nc3 dxe4 *');
const SLAV = op('slav', 'black', '1. d4 d5 2. c4 c6 *');
const ITA = op('ita', 'white', '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 *\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 *');
const ALAPIN = op('alapin', 'white', '1. e4 c5 2. c3 *');
const LONDON = op('london', 'white', '1. d4 d5 2. Bf4 *\n1. d4 Nf6 2. Bf4 *');
const KIA = op('kia', 'white', '1. Nf3 d5 2. g3 *\n1. Nf3 Nf6 2. g3 *');

describe('home', () => {
  it('le mosse che identificano un’apertura si fermano alla prima diramazione', () => {
    expect(keyMoves(CK)).toEqual(['e4', 'c6', 'd4', 'd5']);
    expect(keyMoves(ITA)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
    // diramazione subito: si prosegue lungo la prima linea fino ad almeno due semimosse
    expect(keyMoves(LONDON)).toEqual(['d4', 'd5', 'Bf4']);
    expect(keyMoves(KIA)).toEqual(['Nf3', 'd5', 'g3']);
    expect(keyMoves(ALAPIN)).toEqual(['e4', 'c5', 'c3']);
  });

  it('raggruppa per colore e prima mossa', () => {
    const groups = groupOpenings([SLAV, KIA, CK, LONDON, ITA, ALAPIN]);
    expect(groups.map((g) => [g.title, g.openings.map((o) => o.id)])).toEqual([
      ['Col Bianco · 1.e4', ['ita', 'alapin']],
      ['Col Bianco · 1.d4', ['london']],
      ['Col Bianco · 1.Nf3', ['kia']],
      ['Col Nero · contro 1.e4', ['ck']],
      ['Col Nero · contro 1.d4', ['slav']],
    ]);
  });

  it('suggerisce il passo successivo', () => {
    const s = (p: Partial<OpeningSummary>) =>
      ({ due: 0, toReview: 0, courseDone: 0, courseTotal: 0, fresh: 0, ...p }) as OpeningSummary;
    expect(nextStep(s({ courseTotal: 6 }))).toMatchObject({ mode: 'course', label: 'Inizia il corso' });
    expect(nextStep(s({ courseTotal: 6, courseDone: 2 }))).toMatchObject({ mode: 'course', label: 'Continua il corso (2/6)' });
    expect(nextStep(s({ courseTotal: 6, courseDone: 6, due: 3, toReview: 5 }))).toMatchObject({ mode: 'review', label: 'Ripassa (3)' });
    expect(nextStep(s({ toReview: 10 })).mode).toBe('review');
    expect(nextStep(s({})).mode).toBe('drill');
  });

  it('scrive da quanto tempo', () => {
    const now = 1_000_000_000_000;
    expect(since(now - 30_000, now)).toBe('poco fa');
    expect(since(now - 20 * 60_000, now)).toBe('20 minuti fa');
    expect(since(now - 3 * 3_600_000, now)).toBe('3 ore fa');
    expect(since(now - 26 * 3_600_000, now)).toBe('ieri');
  });
});
