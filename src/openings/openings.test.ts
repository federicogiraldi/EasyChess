import { describe, expect, it } from 'vitest';
import { builtinSources, loadOpenings } from './index';
import { cardPositions, countLeaves, formatPath, namedLines, pathFromRoot, walk } from '../core/tree';
import type { OpeningNode } from '../model/types';

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

    it(`${op.name}: le mosse commentate "Traspone" traspongono davvero`, () => {
      const broken: string[] = [];
      walk(op.root, (n: OpeningNode) => {
        if (/traspone/i.test(n.comment ?? '') && n.children.length === 0 && !n.transposesTo) broken.push(formatPath(pathFromRoot(n)));
      });
      expect(broken).toEqual([]);
    });

    it(`${op.name}: le lezioni del corso puntano a linee esistenti`, () => {
      const names = new Set(namedLines(op.root).map((l) => l.node.lineName));
      const missing = (op.course?.lessons ?? []).filter((l) => l.line && !names.has(l.line)).map((l) => `${l.title} → ${l.line}`);
      expect(missing).toEqual([]);
    });
  }
});
