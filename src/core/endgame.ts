/**
 * Finali elementari Re + Donna / Re + Torre contro Re, risolti in modo esatto
 * (analisi retrograda, tutto in memoria: ~262k posizioni per lato, meno di un secondo).
 *
 * Il Bianco ha sempre il pezzo in più. Per ogni posizione sappiamo in quanti semimosse
 * arriva il matto con gioco perfetto, così possiamo:
 * - far difendere il Re nero nel modo più tenace;
 * - dire se una mossa dell'utente avvicina o allontana il matto;
 * - suggerire una mossa buona e scegliere posizioni di partenza casuali.
 */
import { Chess } from 'chess.js';

export type Piece = 'q' | 'r';

const N = 64 * 64 * 64;
const UNKNOWN = 255;

const file = (s: number) => s & 7;
const rank = (s: number) => s >> 3;
const idx = (wk: number, x: number, bk: number) => (wk << 12) | (x << 6) | bk;

const KING: number[][] = [];
for (let s = 0; s < 64; s++) {
  const out: number[] = [];
  for (let df = -1; df <= 1; df++)
    for (let dr = -1; dr <= 1; dr++) {
      if (!df && !dr) continue;
      const f = file(s) + df;
      const r = rank(s) + dr;
      if (f >= 0 && f < 8 && r >= 0 && r < 8) out.push(r * 8 + f);
    }
  KING.push(out);
}
const adjacent = (a: number, b: number) => Math.abs(file(a) - file(b)) <= 1 && Math.abs(rank(a) - rank(b)) <= 1;

const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const QUEEN_DIRS = [...ROOK_DIRS, [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Raggi del pezzo da ogni casa: liste di case in ordine di distanza. */
function rays(dirs: number[][]): number[][][] {
  const out: number[][][] = [];
  for (let s = 0; s < 64; s++) {
    out.push(
      dirs.map(([df, dr]) => {
        const ray: number[] = [];
        let f = file(s) + df;
        let r = rank(s) + dr;
        while (f >= 0 && f < 8 && r >= 0 && r < 8) {
          ray.push(r * 8 + f);
          f += df;
          r += dr;
        }
        return ray;
      }),
    );
  }
  return out;
}

export interface Table {
  piece: Piece;
  /** Bianco a muovere: semimosse al matto (dispari), UNKNOWN = patta / illegale. */
  wtm: Uint8Array;
  /** Nero a muovere: semimosse al matto (pari, 0 = è matto), UNKNOWN = patta / illegale. */
  btm: Uint8Array;
}

/** Il pezzo bianco in `x` attacca `t`? (bloccato dal Re bianco; il Re nero non blocca: si muove lui). */
function pieceAttacks(R: number[][][], x: number, t: number, wk: number): boolean {
  for (const ray of R[x]) {
    for (const s of ray) {
      if (s === t) return true;
      if (s === wk) break;
    }
  }
  return false;
}

/** Mosse del Re nero: case d'arrivo; -1 nella lista = può catturare il pezzo indifeso (patta). */
function blackMoves(R: number[][][], wk: number, x: number, bk: number): number[] {
  const out: number[] = [];
  for (const t of KING[bk]) {
    if (t === wk || adjacent(t, wk)) continue;
    if (t === x) {
      out.push(-1); // il pezzo non è difeso dal Re (altrimenti adjacent(t, wk))
      continue;
    }
    if (pieceAttacks(R, x, t, wk)) continue;
    out.push(t);
  }
  return out;
}

/** Mosse del Bianco: [nuovoRe, nuovoPezzo]. */
function whiteMoves(R: number[][][], wk: number, x: number, bk: number): [number, number][] {
  const out: [number, number][] = [];
  for (const t of KING[wk]) if (t !== x && !adjacent(t, bk)) out.push([t, x]);
  for (const ray of R[x])
    for (const s of ray) {
      if (s === wk || s === bk) break;
      out.push([wk, s]);
    }
  return out;
}

const RAYS: Record<Piece, number[][][]> = { q: rays(QUEEN_DIRS), r: rays(ROOK_DIRS) };
const cache: Partial<Record<Piece, Table>> = {};

export function solve(piece: Piece): Table {
  const hit = cache[piece];
  if (hit) return hit;
  const R = RAYS[piece];
  const wtm = new Uint8Array(N).fill(UNKNOWN);
  const btm = new Uint8Array(N).fill(UNKNOWN);
  // Posizioni legali (case distinte, Re non adiacenti).
  const legal = new Uint8Array(N);
  const check = new Uint8Array(N);
  for (let wk = 0; wk < 64; wk++)
    for (let x = 0; x < 64; x++) {
      if (x === wk) continue;
      for (let bk = 0; bk < 64; bk++) {
        if (bk === wk || bk === x || adjacent(bk, wk)) continue;
        const i = idx(wk, x, bk);
        legal[i] = 1;
        if (pieceAttacks(R, x, bk, wk)) check[i] = 1;
      }
    }
  // Nero a muovere: figli precalcolati (le mosse non dipendono dai valori). Matti a 0;
  // stalli e posizioni dove può mangiare il pezzo restano patte e non si guardano più.
  const bList = new Int32Array(N);
  const children = new Int32Array(N * 8);
  const nChildren = new Uint8Array(N);
  let bCount = 0;
  // Bianco a muovere: posizioni legali (Nero non sotto scacco) ancora da risolvere.
  const wList = new Int32Array(N);
  let wCount = 0;
  for (let i = 0; i < N; i++) {
    if (!legal[i]) continue;
    const wk = i >> 12, x = (i >> 6) & 63, bk = i & 63;
    if (!check[i]) wList[wCount++] = i;
    const moves = blackMoves(R, wk, x, bk);
    if (moves.length === 0) {
      if (check[i]) btm[i] = 0;
      continue;
    }
    if (moves.includes(-1)) continue;
    moves.forEach((t, k) => (children[i * 8 + k] = idx(wk, x, t)));
    nChildren[i] = moves.length;
    bList[bCount++] = i;
  }
  for (let ply = 1; ply < 250; ply += 2) {
    let changed = false;
    // Bianco: matto in `ply` se una mossa porta a una posizione col Nero matto in ply-1.
    const target = ply - 1;
    let keep = 0;
    for (let n = 0; n < wCount; n++) {
      const i = wList[n];
      const wk = i >> 12, x = (i >> 6) & 63, bk = i & 63;
      let won = false;
      for (const t of KING[wk]) {
        if (t !== x && !adjacent(t, bk) && btm[(t << 12) | (x << 6) | bk] === target) {
          won = true;
          break;
        }
      }
      if (!won)
        outer: for (const ray of R[x])
          for (const s of ray) {
            if (s === wk || s === bk) break;
            if (btm[(wk << 12) | (s << 6) | bk] === target) {
              won = true;
              break outer;
            }
          }
      if (won) {
        wtm[i] = ply;
        changed = true;
      } else wList[keep++] = i;
    }
    wCount = keep;
    // Nero: perso in ply+1 se tutte le sue mosse portano a posizioni vinte per il Bianco.
    keep = 0;
    for (let n = 0; n < bCount; n++) {
      const i = bList[n];
      const base = i * 8;
      let worst = 0;
      for (let k = 0; k < nChildren[i]; k++) {
        const v = wtm[children[base + k]];
        if (v > worst) worst = v; // UNKNOWN = 255 vince sempre
      }
      if (worst === ply) {
        btm[i] = ply + 1;
        changed = true;
      } else bList[keep++] = i;
    }
    bCount = keep;
    if (!changed) break;
  }
  const t = { piece, wtm, btm };
  cache[piece] = t;
  return t;
}

// ---------- Ponte con FEN / chess.js ----------

const sq = (name: string) => (Number(name[1]) - 1) * 8 + (name.charCodeAt(0) - 97);
export const sqName = (s: number) => String.fromCharCode(97 + file(s)) + (rank(s) + 1);

interface Pos {
  wk: number;
  x: number;
  bk: number;
  white: boolean;
}

/** Legge una FEN del tipo Re+pezzo contro Re; null se ci sono altri pezzi o manca il pezzo. */
export function parse(fen: string, piece: Piece): Pos | null {
  const c = new Chess(fen);
  let wk = -1, x = -1, bk = -1, others = 0;
  for (const row of c.board())
    for (const p of row) {
      if (!p) continue;
      if (p.type === 'k') (p.color === 'w' ? (wk = sq(p.square)) : (bk = sq(p.square)));
      else if (p.color === 'w' && p.type === piece && x < 0) x = sq(p.square);
      else others++;
    }
  if (wk < 0 || bk < 0 || x < 0 || others) return null;
  return { wk, x, bk, white: c.turn() === 'w' };
}

/** Semimosse al matto con gioco perfetto (null = non vinto, es. pezzo perso o stallo). */
export function distance(fen: string, piece: Piece): number | null {
  const p = parse(fen, piece);
  if (!p) return null;
  const t = solve(piece);
  const v = (p.white ? t.wtm : t.btm)[idx(p.wk, p.x, p.bk)];
  return v === UNKNOWN ? null : v;
}

/** Mosse al matto (del Bianco) dalla posizione col Bianco a muovere. */
export const movesToMate = (plies: number) => Math.ceil(plies / 2);

/** Risposta del Re nero: la difesa più lunga (a parità, una a caso). Ritorna la mossa in UCI. */
export function defend(fen: string, piece: Piece, random = Math.random): string | null {
  const p = parse(fen, piece);
  if (!p || p.white) return null;
  const t = solve(piece);
  const R = RAYS[piece];
  const moves = blackMoves(R, p.wk, p.x, p.bk);
  if (!moves.length) return null;
  // Se può mangiare il pezzo lo fa.
  if (moves.includes(-1)) return sqName(p.bk) + sqName(p.x);
  let best = -1;
  let picks: number[] = [];
  for (const m of moves) {
    const v = t.wtm[idx(p.wk, p.x, m)];
    const score = v === UNKNOWN ? 999 : v;
    if (score > best) {
      best = score;
      picks = [m];
    } else if (score === best) picks.push(m);
  }
  const m = picks[Math.floor(random() * picks.length)];
  return sqName(p.bk) + sqName(m);
}

/** Una mossa ottima per il Bianco (UCI), per il suggerimento. */
export function bestMove(fen: string, piece: Piece): string | null {
  const p = parse(fen, piece);
  if (!p || !p.white) return null;
  const t = solve(piece);
  const d = t.wtm[idx(p.wk, p.x, p.bk)];
  if (d === UNKNOWN) return null;
  const R = RAYS[piece];
  for (const [nk, nx] of whiteMoves(R, p.wk, p.x, p.bk)) {
    if (t.btm[idx(nk, nx, p.bk)] === d - 1) return nk !== p.wk ? sqName(p.wk) + sqName(nk) : sqName(p.x) + sqName(nx);
  }
  return null;
}

/**
 * Posizione casuale col Bianco a muovere, con il matto tra `min` e `max` mosse
 * e il Re nero lontano dai bordi (così c'è davvero da lavorare).
 */
export function randomStart(piece: Piece, min: number, max: number, random = Math.random): string {
  const t = solve(piece);
  const P = piece.toUpperCase();
  for (let tries = 0; tries < 100000; tries++) {
    const i = Math.floor(random() * N);
    const v = t.wtm[i];
    if (v === UNKNOWN) continue;
    const m = movesToMate(v);
    if (m < min || m > max) continue;
    const wk = i >> 12, x = (i >> 6) & 63, bk = i & 63;
    const edge = (s: number) => file(s) === 0 || file(s) === 7 || rank(s) === 0 || rank(s) === 7;
    if (edge(bk)) continue;
    return toFen(wk, x, bk, P);
  }
  return piece === 'q' ? '8/8/8/4k3/8/8/8/Q3K3 w - - 0 1' : '8/8/8/4k3/8/8/8/R3K3 w - - 0 1';
}

function toFen(wk: number, x: number, bk: number, P: string): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const s = r * 8 + f;
      const ch = s === wk ? 'K' : s === bk ? 'k' : s === x ? P : '';
      if (!ch) empty++;
      else {
        if (empty) row += empty;
        empty = 0;
        row += ch;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join('/')} w - - 0 1`;
}
