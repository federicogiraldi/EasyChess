import { describe, expect, it } from 'vitest';
import { buildVariation } from './variation';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('buildVariation', () => {
  it('gioca le mosse UCI con numerazione per Bianco e Nero', () => {
    const v = buildVariation(START, ['e2e4', 'c7c6', 'd2d4', 'd7d5']);
    expect(v.steps.map((s) => s.label)).toEqual(['1.e4', '1...c6', '2.d4', '2...d5']);
    expect(v.steps[0]).toMatchObject({ from: 'e2', to: 'e4', san: 'e4' });
    expect(v.steps[3].fen).toContain('rnbqkbnr/pp2pppp/2p5/3p4/3PP3');
  });

  it('parte dal Nero e gestisce la promozione', () => {
    const v = buildVariation('8/P6k/8/8/8/8/8/K7 w - - 0 50', ['a7a8q', 'h7g6']);
    expect(v.steps.map((s) => s.label)).toEqual(['50.a8=Q', '50...Kg6']);
    expect(buildVariation(START, ['e7e5']).steps[0]).toBeUndefined();
    expect(buildVariation('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', ['c7c6']).steps[0].label).toBe('1...c6');
  });

  it('si ferma alla prima mossa illegale e rispetta il massimo', () => {
    expect(buildVariation(START, ['e2e4', 'e2e4', 'd7d5']).steps).toHaveLength(1);
    const long = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
    expect(buildVariation(START, [...long, ...long, ...long], 10).steps).toHaveLength(10);
  });
});
