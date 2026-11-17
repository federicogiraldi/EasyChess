import { describe, expect, it } from 'vitest';
import type { Opening } from '../model/types';
import { mineIn, needsOnboarding, suggestCourse } from './onboarding';

const op = (id: string, color: 'white' | 'black', lessons = 0) =>
  ({ id, name: id, color, course: lessons ? { lessons: Array(lessons).fill({}) } : undefined }) as unknown as Opening;

const LONDON = op('london', 'white', 5);
const CK = op('ck', 'black', 7);
const SLAV = op('slav', 'black', 0);
const ITA = op('ita', 'white', 6);
const ALL = [LONDON, CK, SLAV, ITA];

describe('onboarding', () => {
  it('compare solo a chi non ha ancora fatto niente', () => {
    const empty = { done: false, cards: 0, lessons: 0, visited: false };
    expect(needsOnboarding(empty)).toBe(true);
    expect(needsOnboarding({ ...empty, done: true })).toBe(false);
    expect(needsOnboarding({ ...empty, cards: 3 })).toBe(false);
    expect(needsOnboarding({ ...empty, lessons: 1 })).toBe(false);
    expect(needsOnboarding({ ...empty, visited: true })).toBe(false);
  });

  it('tiene solo le aperture scelte che esistono ancora', () => {
    expect(mineIn(ALL, ['ita', 'rimossa', 'ck']).map((o) => o.id)).toEqual(['ck', 'ita']);
  });

  it('propone il primo corso da fare, col Nero prima', () => {
    const none = () => 0;
    expect(suggestCourse(ALL, [], none)?.id).toBe('ck');
    expect(suggestCourse(ALL, ['london', 'ita'], none)?.id).toBe('london');
    // la Slava non ha un corso: si passa a un'apertura che ce l'ha
    expect(suggestCourse(ALL, ['slav', 'ita'], none)?.id).toBe('ita');
    // corso già finito: si passa al successivo
    expect(suggestCourse(ALL, ['ck', 'london'], (id) => (id === 'ck' ? 7 : 0))?.id).toBe('london');
    expect(suggestCourse(ALL, ['slav'], none)).toBeUndefined();
  });
});
