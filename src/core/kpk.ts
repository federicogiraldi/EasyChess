/**
 * Re + pedone contro Re, risolto in modo esatto (analisi retrograda in memoria, come endgame.ts).
 * Il pedone è sempre bianco. "Vinto" = il Bianco promuove e il pezzo nuovo non viene catturato
 * subito (né fa stallo); dopo, Re + Donna (o Torre) contro Re vince sempre.
 *
 * Per ogni posizione sappiamo se è vinta o patta e, se vinta, in quante semimosse arriva la promozione:
 * così il Nero si difende al meglio, e possiamo giudicare le mosse dell'utente da entrambe le parti.
 */
import { Chess } from 'chess.js';

const file = (s: number) => s & 7;
const rank = (s: number) => s >> 3;
const adjacent = (a: number, b: number) => Math.abs(file(a) - file(b)) <= 1 && Math.abs(rank(a) - rank(b)) <= 1;

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

/** Il pedone bianco in `p` attacca `t`? */
const pawnAttacks = (p: number, t: number) => rank(t) === rank(p) + 1 && Math.abs(file(t) - file(p)) === 1;

const UNKNOWN = 0;
const WIN = 1;
const DRAW = 2;
const ILLEGAL = 3;

// indice: (wk << 12) | (bk << 6) | p   (p = casa del pedone, traverse 2-7)
const N = 64 * 64 * 64;
const idx = (wk: number, bk: number, p: number) => (wk << 12) | (bk << 6) | p;

export interface KpkTable {
  /** Bianco a muovere. */
  wtm: Uint8Array;
  btm: Uint8Array;
  /** Semimosse alla promozione (solo per le posizioni vinte). */
  wDist: Uint8Array;
  bDist: Uint8Array;
}

/** Linee di Donna / Torre (servono solo per giudicare la promozione). */
const DIRS = { q: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]], r: [[1, 0], [-1, 0], [0, 1], [0, -1]] };
function attacksFrom(kind: 'q' | 'r', from: number, t: number, wk: number): boolean {
  for (const [df, dr] of DIRS[kind]) {
    let f = file(from) + df;
    let r = rank(from) + dr;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const s = r * 8 + f;
      if (s === t) return true;
      if (s === wk) break;
      f += df;
      r += dr;
    }
  }
  return false;
}

/** Dopo la promozione in `q` (tocca al Nero): il pezzo resta e non è stallo? */
function promotionWins(kind: 'q' | 'r', wk: number, bk: number, q: number): boolean {
  if (adjacent(bk, q) && !adjacent(wk, q)) return false; // il Re nero lo cattura
  const inCheck = attacksFrom(kind, q, bk, wk);
  const canMove = KING[bk].some((s) => s !== q && !adjacent(s, wk) && !attacksFrom(kind, q, s, wk) && s !== wk);
  return canMove || inCheck; // senza mosse e senza scacco = stallo
}

/** Mosse del Bianco: [nuovo wk, nuovo pedone] oppure promozione (p = -1 vinta, -2 patta). */
function whiteMoves(wk: number, bk: number, p: number): [number, number][] {
  const out: [number, number][] = [];
  for (const s of KING[wk]) if (s !== p && !adjacent(s, bk)) out.push([s, p]);
  const one = p + 8;
  if (one !== wk && one !== bk) {
    if (rank(one) === 7) out.push([wk, promotionWins('q', wk, bk, one) || promotionWins('r', wk, bk, one) ? -1 : -2]);
    else {
      out.push([wk, one]);
      const two = p + 16;
      if (rank(p) === 1 && two !== wk && two !== bk) out.push([wk, two]);
    }
  }
  return out;
}

let table: KpkTable | null = null;

export function solveKpk(): KpkTable {
  if (table) return table;
  const wtm = new Uint8Array(N);
  const btm = new Uint8Array(N);
  const wDist = new Uint8Array(N);
  const bDist = new Uint8Array(N);
  for (let wk = 0; wk < 64; wk++)
    for (let bk = 0; bk < 64; bk++)
      for (let p = 0; p < 64; p++) {
        const i = idx(wk, bk, p);
        const bad = rank(p) < 1 || rank(p) > 6 || wk === bk || wk === p || bk === p || adjacent(wk, bk);
        wtm[i] = bad || pawnAttacks(p, bk) ? ILLEGAL : UNKNOWN;
        btm[i] = bad ? ILLEGAL : UNKNOWN;
      }

  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < N; i++) {
      if (wtm[i] === UNKNOWN) {
        const wk = i >> 12, bk = (i >> 6) & 63, p = i & 63;
        let best = -1;
        let allDraw = true;
        for (const [k, q] of whiteMoves(wk, bk, p)) {
          if (q === -1) {
            best = 0;
            allDraw = false;
            continue;
          }
          if (q === -2) continue;
          const j = idx(k, bk, q);
          const v = btm[j];
          if (v === WIN) {
            if (best === -1 || bDist[j] < best) best = bDist[j];
          } else if (v !== DRAW) allDraw = false;
        }
        if (best !== -1) {
          wtm[i] = WIN;
          wDist[i] = best + 1;
          changed = true;
        } else if (allDraw) {
          wtm[i] = DRAW;
          changed = true;
        }
      }
      if (btm[i] === UNKNOWN) {
        const wk = i >> 12, bk = (i >> 6) & 63, p = i & 63;
        let worst = -1;
        let any = false;
        let draw = false;
        let unknown = false;
        for (const s of KING[bk]) {
          if (adjacent(s, wk) || s === wk || pawnAttacks(p, s)) continue;
          any = true;
          if (s === p) {
            // cattura del pedone (che non è difeso, altrimenti il Re sarebbe accanto al Re bianco)
            draw = true;
            break;
          }
          const j = idx(wk, s, p);
          const v = wtm[j];
          if (v === DRAW) {
            draw = true;
            break;
          }
          if (v === WIN) worst = Math.max(worst, wDist[j]);
          else unknown = true;
        }
        if (!any) {
          // senza mosse: matto (scacco di pedone) o stallo
          btm[i] = pawnAttacks(p, bk) ? WIN : DRAW;
          bDist[i] = 0;
          changed = true;
        } else if (draw) {
          btm[i] = DRAW;
          changed = true;
        } else if (!unknown) {
          btm[i] = WIN;
          bDist[i] = worst + 1;
          changed = true;
        }
      }
    }
  }
  for (let i = 0; i < N; i++) {
    if (wtm[i] === UNKNOWN) wtm[i] = DRAW;
    if (btm[i] === UNKNOWN) btm[i] = DRAW;
  }
  table = { wtm, btm, wDist, bDist };
  return table;
}

// ---------------------------------------------------------------------------
// FEN

export const sqName = (s: number) => String.fromCharCode(97 + file(s)) + (rank(s) + 1);

export interface KpkPos {
  wk: number;
  bk: number;
  p: number;
  white: boolean;
}

/** Posizione Re + pedone bianco contro Re, o null se la FEN è un'altra cosa. */
export function parseKpk(fen: string): KpkPos | null {
  const [board, turn] = fen.split(' ');
  let wk = -1, bk = -1, p = -1;
  const rows = board.split('/');
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        const s = (7 - r) * 8 + f;
        if (ch === 'K') wk = s;
        else if (ch === 'k') bk = s;
        else if (ch === 'P' && p === -1) p = s;
        else return null;
        f++;
      }
    }
  }
  if (wk < 0 || bk < 0 || p < 0) return null;
  return { wk, bk, p, white: turn === 'w' };
}

export type KpkResult = { result: 'win'; plies: number } | { result: 'draw' };

/** Vinto o patto (per il Bianco), con la mossa a chi tocca nella FEN. null = non è un finale Re+pedone. */
export function probeKpk(fen: string): KpkResult | null {
  const pos = parseKpk(fen);
  if (!pos) {
    // Pedone appena promosso: se il pezzo è ancora sulla scacchiera, è vinto.
    const pieces = fen.split(' ')[0].replace(/[^a-zA-Z]/g, '');
    if (/^(?=.*K)(?=.*k)(?=.*[QR])[KkQR]{3}$/.test(pieces)) return { result: 'win', plies: 0 };
    return /^[Kk]{2}$/.test(pieces) ? { result: 'draw' } : null;
  }
  const t = solveKpk();
  const i = idx(pos.wk, pos.bk, pos.p);
  const v = pos.white ? t.wtm[i] : t.btm[i];
  if (v === ILLEGAL) return null;
  return v === WIN ? { result: 'win', plies: pos.white ? t.wDist[i] : t.bDist[i] } : { result: 'draw' };
}

/** Le mosse legali (UCI) dalla posizione, con il risultato dopo ciascuna. */
export function kpkMoves(fen: string): { uci: string; san: string; after: KpkResult | null; fen: string }[] {
  const c = new Chess(fen);
  return c.moves({ verbose: true }).map((m) => {
    const d = new Chess(fen);
    d.move(m.san);
    return { uci: m.from + m.to + (m.promotion ?? ''), san: m.san, after: probeKpk(d.fen()), fen: d.fen() };
  });
}

const winPlies = (r: KpkResult | null) => (r && r.result === 'win' ? r.plies : null);

/**
 * La mossa migliore per chi tocca. Bianco: se vince, la promozione più veloce; se è patta, la mossa
 * che lascia al Nero meno risposte che pattano (la più insidiosa). Nero: patta se può (meglio catturare
 * il pedone), altrimenti la difesa più lunga.
 */
export function kpkBestMove(fen: string, random = Math.random): string | null {
  const moves = kpkMoves(fen).filter((m) => !/[bn]$/.test(m.uci));
  if (moves.length === 0) return null;
  const white = fen.split(' ')[1] === 'w';
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];
  if (white) {
    const wins = moves.filter((m) => winPlies(m.after) !== null);
    if (wins.length) {
      const min = Math.min(...wins.map((m) => winPlies(m.after)!));
      const best = wins.filter((m) => winPlies(m.after) === min);
      // a parità, promuovi a Donna (la Torre solo se è l'unico modo)
      const queen = best.filter((m) => m.uci.length === 4 || m.uci.endsWith('q'));
      return pick(queen.length ? queen : best).uci;
    }
    // patta: la mossa che lascia meno difese al Nero
    const scored = moves.map((m) => ({ m, n: m.after ? kpkMoves(m.fen).filter((r) => r.after?.result === 'draw').length : 99 }));
    const min = Math.min(...scored.map((s) => s.n));
    return pick(scored.filter((s) => s.n === min)).m.uci;
  }
  const draws = moves.filter((m) => m.after?.result === 'draw');
  if (draws.length) {
    const capture = draws.find((m) => m.san.includes('x'));
    return (capture ?? pick(draws)).uci;
  }
  const max = Math.max(...moves.map((m) => winPlies(m.after) ?? 0));
  return pick(moves.filter((m) => (winPlies(m.after) ?? 0) === max)).uci;
}
