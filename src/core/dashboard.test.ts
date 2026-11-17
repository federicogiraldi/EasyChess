import { describe, expect, it } from 'vitest';
import { parseOpening } from './pgnToTree';
import { cardPositions } from './tree';
import { grade, type CardState } from './srs';
import { accuracySeries, addRatingPoint, average, dayKey, mergeRatingHistory, summarizeOpening, trainedSince } from './dashboard';
import { mergeValue } from './merge';
import type { SimGame } from './simulation';
import type { AnalyzedGame } from './analysis';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 10, 17, 12).getTime();

const opening = parseOpening(
  `[Opening "Prova"]\n[Id "prova"]\n[Color "white"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 *\n1. e4 c5 2. c3 *`,
  'prova',
  'builtin',
);

describe('summarizeOpening', () => {
  it('conta imparate, in scadenza e nuove, e l\'ultima attività', () => {
    const keys = cardPositions(opening).map((c) => c.key);
    expect(keys.length).toBe(4); // 1.e4, 2.Nf3, 2.c3, 3.Bc4
    let mastered = grade(undefined, true, NOW - 10 * DAY);
    mastered = grade(mastered, true, NOW - 5 * DAY); // intervallo 3 giorni: scaduta
    const wrong = grade(undefined, false, NOW - DAY);
    const cards: Record<string, CardState> = { [keys[0]]: mastered, [keys[1]]: wrong };
    const s = summarizeOpening(opening, cards, 0, NOW);
    expect(s).toMatchObject({ total: 4, mastered: 1, due: 2, fresh: 2, toReview: 4, lines: 2, lastAt: NOW - DAY, courseTotal: 0 });
  });

  it('senza progressi: tutto da imparare, nessuna attività', () => {
    const s = summarizeOpening(opening, {}, 0, NOW);
    expect(s).toMatchObject({ mastered: 0, due: 0, fresh: 4, toReview: 4, lastAt: undefined });
  });
});

describe('trainedSince', () => {
  it('conta le posizioni a cui hai risposto negli ultimi giorni', () => {
    const cards = { a: grade(undefined, true, NOW - DAY), b: grade(undefined, true, NOW - 9 * DAY), c: { ...grade(undefined, true, NOW), at: undefined } };
    expect(trainedSince(cards, 7, NOW)).toBe(1);
  });
});

describe('storico del punteggio dei problemi', () => {
  it('un punto al giorno: lo stesso giorno sovrascrive', () => {
    let h = addRatingPoint([], 1500, 1, NOW - DAY);
    h = addRatingPoint(h, 1520, 2, NOW);
    h = addRatingPoint(h, 1540, 3, NOW + 1000);
    expect(h).toEqual([
      { d: dayKey(NOW - DAY), r: 1500, n: 1 },
      { d: dayKey(NOW), r: 1540, n: 3 },
    ]);
  });

  it('unendo due dispositivi, per ogni giorno vince chi ha giocato più problemi', () => {
    const a = [{ d: '2026-11-10', r: 1500, n: 5 }, { d: '2026-11-11', r: 1550, n: 9 }];
    const b = [{ d: '2026-11-11', r: 1530, n: 12 }, { d: '2026-11-12', r: 1600, n: 20 }];
    const merged = [{ d: '2026-11-10', r: 1500, n: 5 }, { d: '2026-11-11', r: 1530, n: 12 }, { d: '2026-11-12', r: 1600, n: 20 }];
    expect(mergeRatingHistory(a, b)).toEqual(merged);
    expect(mergeValue('puzzles:history', a, 1, b, 0)).toEqual(merged);
  });
});

describe('accuracySeries', () => {
  it('prende la mia precisione dal Simulatore e dalle partite analizzate, in ordine di data', () => {
    const sim = [
      { id: 's1', date: '2026-11-12T10:00:00.000Z', openingId: 'prova', elo: 1200, moves: [], result: '1-0', accuracy: { me: 82.5, opp: 70 } },
      { id: 's2', date: '2026-11-13T10:00:00.000Z', openingId: 'prova', elo: 1200, moves: [], result: '' },
    ] as SimGame[];
    const analyzed = [
      { id: 'a1', white: 'Mario', black: 'io', myWhite: false, date: '2026.11.10', accuracy: { white: 60, black: 75 } },
      { id: 'a2', white: 'x', black: 'y', date: '2026.11.11', accuracy: { white: 90, black: 91 } },
    ] as AnalyzedGame[];
    const s = accuracySeries(sim, analyzed, { prova: 'Prova' });
    expect(s.map((p) => [p.id, p.date, p.accuracy])).toEqual([
      ['a1', '2026-11-10', 75],
      ['s1', '2026-11-12', 82.5],
    ]);
    expect(s[0].label).toBe('Partita contro Mario');
    expect(s[1].label).toBe('Simulatore · Prova · Elo 1200');
    expect(average(s.map((p) => p.accuracy))).toBe(78.75);
    expect(average([])).toBeUndefined();
  });
});
