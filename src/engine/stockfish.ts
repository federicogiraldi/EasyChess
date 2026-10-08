/**
 * Stockfish in un Web Worker, pilotato via protocollo UCI.
 * Le richieste vengono messe in coda: una sola analisi alla volta.
 */

export interface EngineLine {
  /** Prima mossa in notazione UCI (es. "e2e4"). */
  move: string;
  /** Valutazione in centipedoni dal punto di vista di chi muove (il matto è convertito in ±100000). */
  score: number;
  mate?: number;
  pv: string[];
  depth: number;
}

export interface AnalyzeOptions {
  depth?: number;
  multiPv?: number;
  /** Limita la ricerca a queste mosse UCI (per valutare una mossa precisa). */
  searchMoves?: string[];
}

const MATE = 100000;

interface Job {
  fen: string;
  opts: AnalyzeOptions;
  resolve: (lines: EngineLine[]) => void;
  reject: (e: Error) => void;
}

class Engine {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private queue: Job[] = [];
  private busy = false;
  private cache = new Map<string, EngineLine[]>();

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(`${import.meta.env.BASE_URL}engine/stockfish.js`);
      } catch (e) {
        reject(e as Error);
        return;
      }
      const onMsg = (e: MessageEvent) => {
        if (String(e.data) === 'uciok') this.worker!.postMessage('isready');
        if (String(e.data) === 'readyok') {
          this.worker!.removeEventListener('message', onMsg);
          resolve();
        }
      };
      this.worker.addEventListener('message', onMsg);
      this.worker.addEventListener('error', () => reject(new Error('Impossibile avviare Stockfish.')));
      this.worker.postMessage('uci');
    });
    return this.ready;
  }

  analyze(fen: string, opts: AnalyzeOptions = {}): Promise<EngineLine[]> {
    const key = `${fen}|${opts.depth ?? 0}|${opts.multiPv ?? 1}|${(opts.searchMoves ?? []).join(',')}`;
    const cached = this.cache.get(key);
    if (cached) return Promise.resolve(cached);
    return new Promise<EngineLine[]>((resolve, reject) => {
      this.queue.push({ fen, opts, resolve, reject });
      void this.pump();
    }).then((lines) => {
      this.cache.set(key, lines);
      return lines;
    });
  }

  private async pump() {
    if (this.busy) return;
    const job = this.queue.shift();
    if (!job) return;
    this.busy = true;
    try {
      await this.start();
      job.resolve(await this.run(job));
    } catch (e) {
      job.reject(e as Error);
    } finally {
      this.busy = false;
      void this.pump();
    }
  }

  private run({ fen, opts }: Job): Promise<EngineLine[]> {
    const w = this.worker!;
    const multiPv = opts.multiPv ?? 1;
    const lines = new Map<number, EngineLine>();
    return new Promise((resolve) => {
      const onMsg = (e: MessageEvent) => {
        const msg = String(e.data);
        if (msg.startsWith('info') && msg.includes(' pv ')) {
          const depth = Number(msg.match(/ depth (\d+)/)?.[1] ?? 0);
          const idx = Number(msg.match(/ multipv (\d+)/)?.[1] ?? 1);
          const cp = msg.match(/ score cp (-?\d+)/);
          const mate = msg.match(/ score mate (-?\d+)/);
          const pv = msg.split(' pv ')[1].trim().split(/\s+/);
          const m = mate ? Number(mate[1]) : undefined;
          const score = m !== undefined ? Math.sign(m || -1) * (MATE - Math.abs(m) * 10) : Number(cp?.[1] ?? 0);
          lines.set(idx, { move: pv[0], score, mate: m, pv, depth });
        } else if (msg.startsWith('bestmove')) {
          w.removeEventListener('message', onMsg);
          resolve([...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l));
        }
      };
      w.addEventListener('message', onMsg);
      w.postMessage(`setoption name MultiPV value ${multiPv}`);
      w.postMessage(`position fen ${fen}`);
      const search = opts.searchMoves?.length ? ` searchmoves ${opts.searchMoves.join(' ')}` : '';
      w.postMessage(`go depth ${opts.depth ?? 14}${search}`);
    });
  }
}

export const engine = new Engine();

/** Probabilità di vittoria in [-1, 1] (stessa curva usata da Lichess). */
export function winChance(cp: number): number {
  const c = Math.max(-1000, Math.min(1000, cp));
  return 2 / (1 + Math.exp(-0.00368208 * c)) - 1;
}

export function formatScore(scoreWhite: number, mate?: number): string {
  if (mate !== undefined) return `#${mate}`;
  if (Math.abs(scoreWhite) >= MATE / 2) return scoreWhite > 0 ? '#' : '-#';
  const v = scoreWhite / 100;
  return (v > 0 ? '+' : '') + v.toFixed(1);
}
