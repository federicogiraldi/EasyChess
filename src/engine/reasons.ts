import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

/**
 * Spiegazioni "a regole": dato una posizione e una variante (mosse UCI), riconosce
 * motivi scacchistici comprensibili (materiale, pezzi appesi, sviluppo, centro, re).
 * Nessuna dipendenza dall'engine: riceve già le varianti calcolate.
 */

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const NAME: Record<PieceSymbol, string> = { p: 'pedone', n: 'cavallo', b: 'alfiere', r: 'torre', q: 'donna', k: 're' };
const ART: Record<PieceSymbol, string> = { p: 'il', n: 'il', b: "l'", r: 'la', q: 'la', k: 'il' };

export const pieceName = (t: PieceSymbol) => NAME[t];
const withArticle = (t: PieceSymbol) => (ART[t].endsWith("'") ? ART[t] + NAME[t] : `${ART[t]} ${NAME[t]}`);

function material(chess: Chess, color: Color): number {
  let sum = 0;
  for (const row of chess.board()) for (const p of row) if (p && p.color === color) sum += VALUE[p.type];
  return sum;
}

function balance(chess: Chess, color: Color): number {
  return material(chess, color) - material(chess, color === 'w' ? 'b' : 'w');
}

function playUci(chess: Chess, uci: string) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? 'q' });
}

/** "5...e6 6.Nf3 c5" a partire dalla posizione `fen`. */
export function sanLine(fen: string, uci: string[], maxPlies = 6): string {
  const chess = new Chess(fen);
  const out: string[] = [];
  for (const [i, u] of uci.slice(0, maxPlies).entries()) {
    const num = chess.moveNumber();
    const white = chess.turn() === 'w';
    let m;
    try {
      m = playUci(chess, u);
    } catch {
      break;
    }
    out.push(white ? `${num}.${m.san}` : i === 0 ? `${num}...${m.san}` : m.san);
  }
  return out.join(' ');
}

export function uciToSan(fen: string, uci: string): string {
  try {
    return playUci(new Chess(fen), uci).san;
  } catch {
    return uci;
  }
}

/** Variazione del materiale (in pedoni) per chi muove, lungo la variante. */
export function materialSwing(fen: string, pv: string[], plies = 5): number {
  const chess = new Chess(fen);
  const me = chess.turn();
  const start = balance(chess, me);
  for (const u of pv.slice(0, plies)) {
    try {
      playUci(chess, u);
    } catch {
      break;
    }
  }
  return balance(chess, me) - start;
}

function describeMaterial(n: number): string {
  if (n <= 1) return 'un pedone';
  if (n === 2) return 'due pedoni';
  if (n <= 4) return 'un pezzo';
  if (n <= 7) return 'una torre (o materiale equivalente)';
  return 'la donna (o materiale equivalente)';
}

interface Hanging {
  square: Square;
  type: PieceSymbol;
}

/** Pezzi attaccati e non difesi, o attaccati da un pezzo di valore minore. */
export function hangingPieces(chess: Chess, color: Color): Hanging[] {
  const opp: Color = color === 'w' ? 'b' : 'w';
  const out: Hanging[] = [];
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== color || p.type === 'k') continue;
      const attackers = chess.attackers(p.square, opp);
      if (attackers.length === 0) continue;
      const defenders = chess.attackers(p.square, color);
      const cheapest = Math.min(...attackers.map((s) => VALUE[chess.get(s)!.type] || 100));
      if (defenders.length === 0 || cheapest < VALUE[p.type]) out.push({ square: p.square, type: p.type });
    }
  }
  return out;
}

const HOME_MINORS: Record<Color, Square[]> = { w: ['b1', 'g1', 'c1', 'f1'], b: ['b8', 'g8', 'c8', 'f8'] };

function undevelopedMinors(chess: Chess, color: Color): number {
  return HOME_MINORS[color].filter((sq) => {
    const p = chess.get(sq);
    return p && p.color === color && (p.type === 'n' || p.type === 'b');
  }).length;
}

/** Quante case vede un alfiere (fino al primo ostacolo, incluso). */
function bishopScope(chess: Chess, sq: Square): number {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  let count = 0;
  for (const [df, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    for (let x = f + df, y = r + dr; x >= 0 && x < 8 && y >= 0 && y < 8; x += df, y += dr) {
      count++;
      if (chess.get(`${String.fromCharCode(97 + x)}${y + 1}` as Square)) break;
    }
  }
  return count;
}

function castlingRights(fen: string, color: Color): string {
  const field = fen.split(' ')[2];
  return [...field].filter((c) => (color === 'w' ? /[KQ]/ : /[kq]/).test(c)).join('');
}

const fullmove = (fen: string) => Number(fen.split(' ')[5] ?? 1);

/** Perché la mossa giocata (prima mossa di `pv`) è peggiore. */
export function reasonsAgainst(fen: string, pv: string[]): string[] {
  const before = new Chess(fen);
  const me = before.turn();
  const reasons: string[] = [];
  const after = new Chess(fen);
  let move;
  try {
    move = playUci(after, pv[0]);
  } catch {
    return reasons;
  }

  const swing = materialSwing(fen, pv);
  if (swing <= -1) {
    reasons.push(`Perdi ${describeMaterial(-swing)}: ${sanLine(fen, pv, 5)}.`);
  }

  const hangBefore = new Set(hangingPieces(before, me).map((h) => h.square));
  const hangAfter = hangingPieces(after, me);
  const stillHanging = hangAfter.find((h) => hangBefore.has(h.square));
  const newHanging = hangAfter.find((h) => !hangBefore.has(h.square));
  if (stillHanging) {
    reasons.push(`Non risolvi la minaccia: ${withArticle(stillHanging.type)} in ${stillHanging.square} resta attaccato.`);
  } else if (newHanging && swing > -1) {
    reasons.push(`Lasci ${withArticle(newHanging.type)} in ${newHanging.square} attaccato senza difesa sufficiente.`);
  }

  const isCastle = move.flags.includes('k') || move.flags.includes('q');
  if (!isCastle && castlingRights(fen, me).length > castlingRights(after.fen(), me).length) {
    reasons.push('Perdi il diritto di arrocco: il re rischia di restare esposto al centro.');
  }

  const n = fullmove(fen);
  const undeveloped = undevelopedMinors(before, me);
  if (move.piece === 'q' && n <= 8 && undeveloped >= 2) {
    reasons.push("Esci con la donna troppo presto: l'avversario può attaccarla sviluppando i pezzi con guadagno di tempo.");
  }

  const wasAttacked = before.attackers(move.from, me === 'w' ? 'b' : 'w').length > 0;
  if ((move.piece === 'n' || move.piece === 'b') && !HOME_MINORS[me].includes(move.from) && n <= 10 && undeveloped >= 2 && !move.captured && !wasAttacked) {
    reasons.push('Muovi di nuovo un pezzo già sviluppato invece di svilupparne un altro: perdi tempo.');
  }

  if (move.piece === 'p') {
    for (const sq of HOME_MINORS[me].slice(2)) {
      const p = before.get(sq);
      if (!p || p.type !== 'b' || p.color !== me) continue;
      const s0 = bishopScope(before, sq);
      const s1 = bishopScope(after, sq);
      if (s0 - s1 >= 3 && s1 <= 3) {
        reasons.push(`Chiudi la diagonale dell'alfiere in ${sq} prima di averlo sviluppato: resterà passivo dietro i pedoni.`);
      }
    }
    const kingSq = after.findPiece({ type: 'k', color: me })[0];
    const kingside = kingSq && 'efgh'.includes(kingSq[0]);
    if ((move.from[0] === 'f' || move.from[0] === 'g') && kingside && n <= 15 && !move.captured) {
      reasons.push(`La spinta ${move.san} indebolisce le case intorno al tuo re.`);
    }
    if ('abgh'.includes(move.from[0]) && n <= 8 && undeveloped >= 3 && !move.captured) {
      reasons.push("Mossa di pedone sull'ala mentre i pezzi sono ancora da sviluppare.");
    }
  }

  if (pv.length > 1) reasons.push(`La risposta migliore per l'avversario è ${uciToSan(after.fen(), pv[1])}.`);
  return reasons;
}

/** Cosa fa di buono la mossa migliore (prima mossa di `pv`). */
export function reasonsFor(fen: string, pv: string[]): string[] {
  const before = new Chess(fen);
  const me = before.turn();
  const opp: Color = me === 'w' ? 'b' : 'w';
  const after = new Chess(fen);
  let move;
  try {
    move = playUci(after, pv[0]);
  } catch {
    return [];
  }
  const reasons: string[] = [];

  if (after.isCheckmate()) return ['Dà scacco matto!'];
  if (move.captured) reasons.push(`Cattura ${withArticle(move.captured)} in ${move.to}.`);
  const swing = materialSwing(fen, pv);
  if (swing >= 1) reasons.push(`Guadagna ${describeMaterial(swing)}: ${sanLine(fen, pv, 5)}.`);
  if (move.flags.includes('k') || move.flags.includes('q')) reasons.push('Arrocca: mette al sicuro il re e collega le torri.');
  if ((move.piece === 'n' || move.piece === 'b') && HOME_MINORS[me].includes(move.from)) {
    reasons.push(`Sviluppa ${withArticle(move.piece)} in ${move.to}.`);
  }
  if (move.piece === 'p') {
    const rank = Number(move.to[1]);
    const rel = me === 'w' ? rank : 9 - rank;
    if ('cdef'.includes(move.to[0]) && (rel === 4 || rel === 5)) reasons.push('Occupa o contesta il centro.');
    const dir = me === 'w' ? 1 : -1;
    for (const df of [-1, 1]) {
      const f = move.to.charCodeAt(0) + df;
      if (f < 97 || f > 104) continue;
      const target = `${String.fromCharCode(f)}${rank + dir}` as Square;
      const p = after.get(target);
      if (p && p.color === opp && p.type === 'p') {
        reasons.push(`Attacca il pedone in ${target}: è la rottura che mette in discussione la struttura avversaria.`);
        break;
      }
    }
  }
  if (move.piece !== 'p' && move.piece !== 'k') {
    // Attacchi creati dal pezzo mosso: pezzi di valore maggiore o indifesi.
    const targets = hangingPieces(after, opp).filter((h) => after.attackers(h.square, me).includes(move.to));
    if (targets[0]) reasons.push(`Attacca ${withArticle(targets[0].type)} in ${targets[0].square}.`);
  }
  if (after.inCheck() && !after.isCheckmate()) reasons.push('Dà scacco.');

  const hangBefore = hangingPieces(before, me);
  const hangAfter = new Set(hangingPieces(after, me).map((h) => h.square));
  const solved = hangBefore.find((h) => !hangAfter.has(h.square === move.from ? move.to : h.square));
  if (solved) reasons.push(`Risolve la minaccia su ${withArticle(solved.type)} in ${solved.square}.`);

  return reasons;
}
