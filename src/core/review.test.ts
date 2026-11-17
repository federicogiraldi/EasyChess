import { describe, expect, it } from 'vitest';
import { accuracyOf, errorMarks, qualitiesOf, winCurve } from './review';
import { buildPliesFrom, type PosEval } from './simulation';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const plies = buildPliesFrom(START, ['e4', 'e5', 'Qh5', 'Nc6']);
const fens = [START, ...plies.map((p) => p.fenAfter)];
const ev = (scoreWhite: number, best?: string): PosEval => ({ scoreWhite, best });

describe('revisione', () => {
  it('senza valutazioni le qualità restano in attesa', () => {
    expect(qualitiesOf(plies, fens, {})).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('classifica le mosse e segna gli errori sul grafico', () => {
    const evals = {
      [fens[0]]: ev(30, 'e2e4'),
      [fens[1]]: ev(30, 'e7e5'),
      [fens[2]]: ev(30, 'g1f3'),
      // Qh5 regala molto: da +0.3 a -3
      [fens[3]]: ev(-300, 'b8c6'),
      [fens[4]]: ev(-300),
    };
    const q = qualitiesOf(plies, fens, evals);
    expect(q[0]).toBe('migliore');
    expect(q[2] === 'errore' || q[2] === 'grave').toBe(true);
    expect(errorMarks(q).map((m) => m.index)).toEqual([3]);
    expect(accuracyOf(plies, fens, evals, true)!).toBeLessThan(accuracyOf(plies, fens, evals, false)!);
    expect(winCurve(fens, evals)).toHaveLength(5);
  });

  it('le mosse di teoria non contano per la precisione', () => {
    const book = plies.map((p) => ({ ...p, book: true }));
    expect(qualitiesOf(book, fens, {})).toEqual(['libro', 'libro', 'libro', 'libro']);
    expect(accuracyOf(book, fens, {}, true)).toBeUndefined();
  });
});
