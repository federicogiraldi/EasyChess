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
  /** Cerca per questo tempo (ms) invece che fino a una profondità. */
  movetime?: number;
  /** Forza di gioco: Elo (UCI_Elo, da 1320) e/o Skill Level (0-20). Assenti = piena forza. */
  elo?: number;
  skill?: number;
}

export interface SearchResult {
  lines: EngineLine[];
  /** Mossa scelta dall'engine: con la forza limitata può non essere la prima delle linee. */
  bestmove?: string;
}

/** Elo minimo e massimo che Stockfish accetta in UCI_Elo. */
export const ENGINE_ELO_MIN = 1320;
export const ENGINE_ELO_MAX = 3190;

const MATE = 100000;

/**
 * Profondità di analisi, uguali su PC e telefono: sul telefono ci vuole qualche secondo in più,
 * ma i giudizi restano gli stessi (a profondità 12-14 alcune valutazioni cambiavano di segno).
 * ANALYSIS_DEPTH: spiegazione di una singola mossa ("Perché?", Laboratorio).
 * EVAL_DEPTH: valutazione di posizioni in serie (revisione delle partite, barra di valutazione, coach).
 */
export const ANALYSIS_DEPTH = 18;
export const EVAL_DEPTH = 16;

export interface EngineProgress {
  /** Profondità raggiunta dalla ricerca in corso e quella richiesta. */
  depth: number;
  target: number;
  /** Analisi ancora in coda dopo quella in corso. */
  queued: number;
}

interface Job {
  fen: string;
  opts: AnalyzeOptions;
  resolve: (r: SearchResult) => void;
  reject: (e: Error) => void;
  cancelled?: boolean;
}

export class Engine {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private queue: Job[] = [];
  private busy = false;
  private current: Job | null = null;
  private cache = new Map<string, EngineLine[]>();
  private listeners = new Set<(p: EngineProgress | null) => void>();

  /** Avanzamento dell'analisi in corso (null quando il motore è fermo). */
  onProgress(fn: (p: EngineProgress | null) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(p: EngineProgress | null) {
    for (const fn of this.listeners) fn(p);
  }

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
        if (String(e.data) === 'uciok') {
          // Più memoria per la tabella delle trasposizioni: ricerche profonde più rapide.
          this.worker!.postMessage('setoption name Hash value 32');
          this.worker!.postMessage('isready');
        }
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
    const key = `${fen}|${opts.depth ?? 0}|${opts.multiPv ?? 1}|${(opts.searchMoves ?? []).join(',')}|${opts.movetime ?? 0}`;
    const cached = this.cache.get(key);
    if (cached) return Promise.resolve(cached);
    return this.search(fen, opts).then(({ lines }) => {
      // Risultati a tempo o a forza ridotta non sono riproducibili: non vanno in cache.
      if (!opts.movetime && opts.elo === undefined && opts.skill === undefined) this.cache.set(key, lines);
      return lines;
    });
  }

  /** Ricerca senza cache, con la mossa scelta dall'engine (serve per l'avversario a forza limitata). */
  search(fen: string, opts: AnalyzeOptions = {}): Promise<SearchResult> {
    return new Promise<SearchResult>((resolve, reject) => {
      this.queue.push({ fen, opts, resolve, reject });
      void this.pump();
    });
  }

  /** Annulla le richieste in coda e interrompe quella in corso (es. nuova partita). */
  cancelAll() {
    const pending = this.queue.splice(0);
    pending.forEach((j) => j.reject(new Error('annullata')));
    if (this.current) {
      // Il risultato parziale della ricerca interrotta viene scartato (non va in cache).
      this.current.cancelled = true;
      this.worker?.postMessage('stop');
    }
  }

  private async pump() {
    if (this.busy) return;
    const job = this.queue.shift();
    if (!job) return;
    this.busy = true;
    this.current = job;
    try {
      await this.start();
      const result = await this.run(job);
      if (job.cancelled) job.reject(new Error('annullata'));
      else job.resolve(result);
    } catch (e) {
      job.reject(e as Error);
    } finally {
      this.busy = false;
      this.current = null;
      if (this.queue.length === 0) this.emit(null);
      void this.pump();
    }
  }

  private run({ fen, opts }: Job): Promise<SearchResult> {
    const w = this.worker!;
    const multiPv = opts.multiPv ?? 1;
    const target = opts.depth ?? ANALYSIS_DEPTH;
    this.emit({ depth: 0, target, queued: this.queue.length });
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
          if (idx === 1) this.emit({ depth, target, queued: this.queue.length });
        } else if (msg.startsWith('bestmove')) {
          w.removeEventListener('message', onMsg);
          const best = msg.split(/\s+/)[1];
          resolve({
            lines: [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l),
            bestmove: best && best !== '(none)' ? best : undefined,
          });
        }
      };
      w.addEventListener('message', onMsg);
      // Le opzioni di forza vanno reimpostate ogni volta: lo stesso worker può servire ricerche diverse.
      const limit = opts.elo !== undefined;
      w.postMessage(`setoption name UCI_LimitStrength value ${limit}`);
      if (limit) w.postMessage(`setoption name UCI_Elo value ${Math.round(Math.min(ENGINE_ELO_MAX, Math.max(ENGINE_ELO_MIN, opts.elo!)))}`);
      w.postMessage(`setoption name Skill Level value ${opts.skill ?? 20}`);
      w.postMessage(`setoption name MultiPV value ${multiPv}`);
      w.postMessage(`position fen ${fen}`);
      const search = opts.searchMoves?.length ? ` searchmoves ${opts.searchMoves.join(' ')}` : '';
      w.postMessage(opts.movetime ? `go movetime ${opts.movetime}${search}` : `go depth ${target}${search}`);
    });
  }
}

/** Analisi a piena forza (giudizi, valutazioni, coach). */
export const engine = new Engine();
/** Avversario del Simulatore: worker separato, così la forza ridotta non tocca le analisi. */
export const opponentEngine = new Engine();

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
