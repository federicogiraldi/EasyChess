import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { kpkBestMove, probeKpk, solveKpk } from './kpk';

const res = (fen: string) => probeKpk(fen)?.result;

describe('Re e pedone contro Re', () => {
  it('si risolve in tempi ragionevoli', () => {
    const t0 = Date.now();
    solveKpk();
    expect(Date.now() - t0).toBeLessThan(15000);
  });

  it('opposizione: chi muove decide', () => {
    expect(res('8/8/4k3/8/4K3/4P3/8/8 w - - 0 1')).toBe('draw');
    expect(res('8/8/4k3/8/4K3/4P3/8/8 b - - 0 1')).toBe('win');
    // pedone in settima con il Re nero davanti: se tocca al Nero è stallo
    expect(res('4k3/4P3/4K3/8/8/8/8/8 b - - 0 1')).toBe('draw');
  });

  it('Re in sesta davanti al pedone vince sempre (non di Torre)', () => {
    expect(res('3k4/8/4K3/8/8/8/4P3/8 b - - 0 1')).toBe('win');
    expect(res('3k4/8/4K3/8/8/8/4P3/8 w - - 0 1')).toBe('win');
  });

  it('pedone di Torre con il Re nero nell’angolo è patta', () => {
    expect(res('k7/8/K7/P7/8/8/8/8 w - - 0 1')).toBe('draw');
  });

  it('regola del quadrato', () => {
    expect(res('7K/8/8/8/P7/8/8/7k b - - 0 1')).toBe('win');
    expect(res('7K/8/8/8/P7/4k3/8/8 b - - 0 1')).toBe('draw');
  });

  it('la mossa migliore mantiene il risultato', () => {
    // Il Bianco vince: a ogni mossa del Bianco la posizione resta vinta, fino alla promozione.
    const c = new Chess('8/8/4k3/8/4K3/4P3/8/8 b - - 0 1');
    for (let i = 0; i < 60 && !/[QR]/.test(c.fen().split(' ')[0]); i++) {
      const m = kpkBestMove(c.fen(), () => 0)!;
      c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
      if (c.turn() === 'b') expect(res(c.fen())).toBe('win');
    }
    expect(c.fen().split(' ')[0]).toMatch(/[QR]/);
    // Il Nero, in una posizione patta, trova sempre la mossa che patta.
    const d = new Chess('8/8/4k3/8/4K3/4P3/8/8 w - - 0 1');
    for (let i = 0; i < 20; i++) {
      const m = kpkBestMove(d.fen(), () => 0.5)!;
      d.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
      if (d.turn() === 'w' && /P/.test(d.fen().split(' ')[0])) expect(res(d.fen())).toBe('draw');
      if (!/P/.test(d.fen().split(' ')[0]) || d.isGameOver()) break;
    }
  });
});
