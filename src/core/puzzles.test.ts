import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { checkPuzzleMove, parseBucket, puzzleFens, solverColor, updateRating, DEFAULT_STATS, type PuzzleIndex } from './puzzles';

// I file della banca, letti come testo (in ordine di nome).
const files = import.meta.glob('../../public/puzzles/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const read = (name: string) => files[`../../public/puzzles/${name}`];
const index = JSON.parse(read('index.json')) as PuzzleIndex;

describe('banca problemi', () => {
  it('ha circa 100.000 problemi in tutte le fasce', () => {
    const total = index.buckets.reduce((s, b) => s + b.count, 0);
    expect(total).toBeGreaterThan(95000);
    // Sopra i 2800 i problemi collaudati sono pochi: la fascia più alta li prende tutti.
    for (const b of index.buckets) expect(b.count).toBeGreaterThan(b.rating >= 2800 ? 500 : 4000);
  });

  it('ogni problema (a campione) ha mosse legali e un punteggio nella sua fascia', () => {
    for (const b of index.buckets) {
      const puzzles = parseBucket(read(`p${b.rating}.txt`), index.themes);
      expect(puzzles.length).toBe(b.count);
      for (const p of puzzles.filter((_, i) => i % 40 === 0)) {
        expect(p.moves.length % 2).toBe(0);
        if (b.rating > 500) expect(p.rating).toBeGreaterThanOrEqual(b.rating);
        if (b.rating < 2800) expect(p.rating).toBeLessThan(b.rating + 100);
        expect(() => puzzleFens(p)).not.toThrow();
        expect(p.themes.every(Boolean)).toBe(true);
      }
    }
  });
});

describe('regole dei problemi', () => {
  // Il Nero sposta il cavallo, il Bianco dà matto sull'ultima traversa.
  const p = parseBucket(['abc12', '6k1/5ppp/n7/8/8/8/5PPP/3R2K1 b - - 0 1', 'a6b4 d1d8', '900', '0'].join('\t'), ['mateIn1'])[0];

  it('chi risolve muove dopo la prima mossa', () => {
    expect(solverColor(p)).toBe('white');
    expect(p.themes).toEqual(['mateIn1']);
  });

  it('accetta la mossa giusta e rifiuta le altre', () => {
    const fen = puzzleFens(p)[1];
    expect(checkPuzzleMove(fen, 'd1', 'd8', 'd1d8', true)).toBe('right');
    expect(checkPuzzleMove(fen, 'd1', 'd7', 'd1d8', true)).toBe('wrong');
    expect(checkPuzzleMove(fen, 'd1', 'e3', 'd1d8', true)).toBe('illegal');
  });

  it("all'ultima mossa vale anche un altro matto", () => {
    // Due torri: sia Ra8# sia Rb8# danno matto.
    const fen = '6k1/5ppp/8/8/8/8/R4PPP/1R4K1 w - - 0 1';
    expect(new Chess(fen).move('Ra8').san).toBe('Ra8#');
    expect(checkPuzzleMove(fen, 'b1', 'b8', 'a2a8', true)).toBe('right');
    expect(checkPuzzleMove(fen, 'b1', 'b8', 'a2a8', false)).toBe('wrong');
  });

  it('il punteggio sale se risolvi e scende se sbagli, più in fretta all\'inizio', () => {
    const win = updateRating(DEFAULT_STATS, 1500, true);
    expect(win.rating).toBe(1530);
    expect(win.streak).toBe(1);
    const loss = updateRating({ ...DEFAULT_STATS, games: 100 }, 1500, false);
    expect(loss.rating).toBe(1490);
    expect(loss.streak).toBe(0);
  });
});
