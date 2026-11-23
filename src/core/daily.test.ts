import { describe, expect, it } from 'vitest';
import { parseOpening } from './pgnToTree';
import { cardPositions } from './tree';
import { grade, type CardState } from './srs';
import { addActivity, dailyQueue, streak } from './daily';
import { dayKey } from './dashboard';
import { mergeValue } from './merge';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 10, 17, 18).getTime();

const a = parseOpening(`[Opening "A"]\n[Id "a"]\n[Color "white"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 *\n1. e4 c5 2. c3 *`, 'a', 'builtin');
const b = parseOpening(`[Opening "B"]\n[Id "b"]\n[Color "black"]\n\n1. d4 d5 2. c4 c6 3. Nc3 Nf6 *`, 'b', 'builtin');
const c = parseOpening(`[Opening "C"]\n[Id "c"]\n[Color "white"]\n\n1. d4 Nf6 2. Bf4 *`, 'c', 'builtin');

describe('dailyQueue', () => {
  const ka = cardPositions(a).map((x) => x.key); // 4 posizioni
  const kb = cardPositions(b).map((x) => x.key); // 3 posizioni
  const cards: Record<string, CardState> = {
    [ka[0]]: grade(undefined, true, NOW - 2 * DAY), // scaduta da 1 giorno
    [ka[1]]: grade(undefined, false, NOW - 3 * DAY), // scaduta da 3 giorni
    [kb[0]]: grade(undefined, true, NOW - 5 * DAY), // scaduta da 4 giorni
    [ka[2]]: grade(grade(undefined, true, NOW - 2 * DAY), true, NOW - DAY), // non scaduta
  };

  it('prima le scadute di tutte le aperture, dalla più vecchia', () => {
    const q = dailyQueue([a, b, c], cards, 0, NOW);
    expect(q.items.map((i) => i.card.key)).toEqual([kb[0], ka[1], ka[0]]);
    expect(q).toMatchObject({ due: 3, fresh: 0 });
  });

  it("aggiunge nuove posizioni a turno, solo dalle aperture già iniziate, fino all'obiettivo", () => {
    const q = dailyQueue([a, b, c], cards, 6, NOW);
    expect(q.items.map((i) => i.card.key)).toEqual([kb[0], ka[1], ka[0], ka[3], kb[1], kb[2]]);
    expect(q.items.every((i) => i.opening.id !== 'c')).toBe(true);
    expect(q).toMatchObject({ due: 3, fresh: 3 });
  });

  it('senza nessuna apertura iniziata la coda è vuota', () => {
    expect(dailyQueue([a, b, c], {}, 20, NOW).items).toEqual([]);
  });
});

describe('obiettivo e serie di giorni', () => {
  const day = (n: number) => dayKey(NOW - n * DAY);

  it('conta le risposte per giorno', () => {
    let act = addActivity({}, 1, NOW);
    act = addActivity(act, 2, NOW);
    act = addActivity(act, 1, NOW - DAY);
    expect(act).toEqual({ [day(0)]: 3, [day(1)]: 1 });
  });

  it("la serie conta i giorni consecutivi con l'obiettivo raggiunto", () => {
    const act = { [day(0)]: 20, [day(1)]: 25, [day(2)]: 20, [day(3)]: 5, [day(4)]: 30 };
    expect(streak(act, 20, NOW)).toBe(3);
  });

  it("se oggi non è ancora raggiunto, la serie arriva fino a ieri (non si azzera di mattina)", () => {
    const act = { [day(0)]: 4, [day(1)]: 25, [day(2)]: 20 };
    expect(streak(act, 20, NOW)).toBe(2);
    expect(streak({ [day(0)]: 4, [day(2)]: 20 }, 20, NOW)).toBe(0);
  });

  it('unendo due dispositivi tiene il massimo per ogni giorno', () => {
    expect(mergeValue('activity', { [day(0)]: 5, [day(1)]: 20 }, 1, { [day(0)]: 12 }, 2)).toEqual({ [day(0)]: 12, [day(1)]: 20 });
  });
});
