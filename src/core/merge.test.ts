import { describe, expect, it } from 'vitest';
import { applyResets, mergeCards, mergeValue } from './merge';
import type { CardState } from './srs';

const card = (at: number | undefined, seen: number): CardState => ({ due: 0, interval: 1, ease: 2.5, reps: 1, lapses: 0, seen, correct: seen, at });

describe('mergeValue', () => {
  it('vince la modifica più recente per i dati semplici', () => {
    expect(mergeValue('simSettings', { elo: 1200 }, 10, { elo: 1500 }, 20)).toEqual({ elo: 1500 });
    expect(mergeValue('simSettings', { elo: 1200 }, 30, { elo: 1500 }, 20)).toEqual({ elo: 1200 });
  });

  it('se un lato manca tiene l\'altro', () => {
    expect(mergeValue('simGames', undefined, 0, [1], 5)).toEqual([1]);
    expect(mergeValue('simGames', [2], 5, undefined, 0)).toEqual([2]);
  });

  it('unisce i problemi visti e tiene le statistiche con più partite', () => {
    expect(mergeValue('puzzles:seen', ['a', 'b'], 1, ['b', 'c'], 2)).toEqual(['a', 'b', 'c']);
    expect(mergeValue('puzzles:stats', { games: 40, rating: 1600 }, 99, { games: 42, rating: 1580 }, 1)).toEqual({ games: 42, rating: 1580 });
  });

  it('unisce le lezioni completate dei corsi', () => {
    const m = mergeValue('course:caro-kann', { done: [0, 1], lesson: 2 }, 10, { done: [0, 3], lesson: 4 }, 20) as { done: number[]; lesson: number };
    expect(m.lesson).toBe(4);
    expect(m.done.sort()).toEqual([0, 1, 3]);
  });
});

describe('mergeCards', () => {
  it('tiene le schede di entrambi i dispositivi e, per la stessa, quella ripassata dopo', () => {
    const ipad = { 'ck|1': card(100, 3), 'ck|2': card(50, 1) };
    const phone = { 'ck|1': card(200, 2), 'ck|3': card(10, 1) };
    const m = mergeCards(ipad, phone);
    expect(Object.keys(m).sort()).toEqual(['ck|1', 'ck|2', 'ck|3']);
    expect(m['ck|1'].at).toBe(200);
  });

  it('per i dati vecchi senza data usa il numero di volte vista', () => {
    expect(mergeCards({ k: card(undefined, 5) }, { k: card(undefined, 2) }).k.seen).toBe(5);
  });

  it('le aperture azzerate non tornano dall\'altro dispositivo', () => {
    const cards = { 'ck|1': card(100, 1), 'ck|2': card(300, 1), 'london|1': card(50, 1) };
    expect(Object.keys(applyResets(cards, { ck: 200 })).sort()).toEqual(['ck|2', 'london|1']);
  });
});
