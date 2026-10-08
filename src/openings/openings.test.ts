import { describe, expect, it } from 'vitest';
import { builtinSources, loadOpenings } from './index';
import { cardPositions, countLeaves } from '../core/tree';

describe('aperture in src/openings', () => {
  const { openings, errors } = loadOpenings(builtinSources);

  it('tutti i PGN e i corsi sono validi (mosse legali, parentesi bilanciate, id unici)', () => {
    expect(errors).toEqual([]);
  });

  for (const op of openings) {
    it(`${op.name}: ha linee e posizioni da allenare`, () => {
      const cards = cardPositions(op);
      const lines = countLeaves(op.root);
      console.log(`${op.name} (${op.color}): ${lines} linee, ${cards.length} posizioni da imparare${op.course ? `, corso di ${op.course.lessons.length} lezioni` : ''}`);
      expect(cards.length).toBeGreaterThan(0);
    });
  }
});
