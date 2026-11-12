import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { MATE_LESSONS, checkLessons } from './mateCourse';
import { distance } from './endgame';

describe('corso dei matti', () => {
  it('posizioni legali', () => {
    expect(checkLessons()).toEqual([]);
  });

  for (const lesson of MATE_LESSONS)
    lesson.steps.forEach((step, i) => {
      if (step.kind === 'mate1')
        it(`${lesson.id}#${i}: c'è un matto in una`, () => {
          const c = new Chess(step.fen);
          const mates = c.moves().filter((m) => {
            const d = new Chess(step.fen);
            d.move(m);
            return d.isCheckmate();
          });
          expect(mates.length).toBeGreaterThan(0);
        });
      if (step.kind === 'play' && step.fen)
        it(`${lesson.id}#${i}: posizione vinta`, () => {
          expect(distance(step.fen!, step.piece)).not.toBeNull();
        });
      if (step.kind === 'quiz' && step.fen.includes(' b '))
        it(`${lesson.id}#${i}: risposta del quiz coerente`, () => {
          const c = new Chess(step.fen);
          const right = step.options.find((o) => o.correct)!.text;
          const actual = c.isCheckmate() ? 'Matto' : c.isStalemate() ? 'Stallo' : 'Nessuno dei due';
          expect(right).toBe(actual);
        });
    });
});
