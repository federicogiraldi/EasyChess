// @vitest-environment jsdom
import { it, expect, beforeAll } from 'vitest';

/** Worker finto che risponde come Stockfish e smette di rispondere quando viene chiuso. */
class FakeWorker {
  ls = new Set<(e: { data: string }) => void>();
  dead = false;
  addEventListener(t: string, f: (e: { data: string }) => void) {
    if (t === 'message') this.ls.add(f);
  }
  removeEventListener(_t: string, f: (e: { data: string }) => void) {
    this.ls.delete(f);
  }
  emit(d: string) {
    if (!this.dead) for (const f of [...this.ls]) f({ data: d });
  }
  terminate() {
    this.dead = true;
  }
  postMessage(m: string) {
    if (m === 'uci') setTimeout(() => this.emit('uciok'), 1);
    else if (m === 'isready') setTimeout(() => this.emit('readyok'), 20);
    else if (m === 'stop') setTimeout(() => this.emit('bestmove e2e4'), 1);
    else if (m.startsWith('go'))
      setTimeout(() => {
        this.emit('info depth 10 score cp 20 pv e2e4');
        this.emit('bestmove e2e4');
      }, 100);
  }
}

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const within = <T>(p: Promise<T>, ms = 2000) => Promise.race([p, wait(ms).then(() => 'bloccato' as const)]);

beforeAll(() => {
  (globalThis as unknown as { Worker: unknown }).Worker = FakeWorker;
});

it('cambiare precisione durante una ricerca non blocca il motore', async () => {
  const { Engine } = await import('./stockfish');
  const e = new Engine('lite', 32);
  const first = e.analyze(FEN, { depth: 5 }).then(() => 'ok', (x: Error) => x.message);
  await wait(50); // ricerca in corso
  e.configure('full', 64);
  expect(await within(first)).toBe('annullata');
  const second = e.analyze(FEN.replace(' w ', ' b '), { depth: 5 }).then((l) => l.length);
  expect(await within(second)).toBe(1);
});

it('cambiare precisione mentre il motore si avvia non blocca il motore', async () => {
  const { Engine } = await import('./stockfish');
  const e = new Engine('lite', 32);
  const first = e.analyze(FEN, { depth: 5 }).then(() => 'ok', (x: Error) => x.message);
  await wait(5); // in attesa di "readyok"
  e.configure('full', 64);
  expect(await within(first)).toBe('annullata');
  expect(e.usingBuild).toBe('full');
  const second = e.analyze(FEN.replace(' w ', ' b '), { depth: 5 }).then((l) => l.length);
  expect(await within(second)).toBe(1);
});
