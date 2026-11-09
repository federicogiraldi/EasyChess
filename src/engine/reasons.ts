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

  if (pv.length > 1) reasons.push(`La risposta migliore per l'avversario è ${describeReply(after.fen(), pv[1])}.`);
  return reasons;
}

/** Cosa fa di buono la mossa migliore (prima mossa di `pv`). */
export function reasonsFor(fen: string, pv: string[]): string[] {
  const after = new Chess(fen);
  let move;
  try {
    move = playUci(after, pv[0]);
  } catch {
    return [];
  }
  if (after.isCheckmate()) return ['Dà scacco matto!'];
  const reasons = describeMove(fen, move.san);
  const swing = materialSwing(fen, pv);
  if (swing >= 1) reasons.push(`Guadagna ${describeMaterial(swing)}: ${sanLine(fen, pv, 5)}.`);
  return reasons;
}

// ---------------------------------------------------------------------------
// Descrizione di una singola mossa: cosa fa e a cosa mira.
// ---------------------------------------------------------------------------

const CENTER: Square[] = ['d4', 'e4', 'd5', 'e5'];

const square = (file: number, rank: number) => `${String.fromCharCode(97 + file)}${rank + 1}` as Square;
const onBoard = (file: number, rank: number) => file >= 0 && file < 8 && rank >= 0 && rank < 8;
const listText = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const feminine = (t: PieceSymbol) => t === 'r' || t === 'q';

/** Case controllate dal pezzo in `sq`. */
function controlled(chess: Chess, sq: Square): Square[] {
  const p = chess.get(sq);
  if (!p) return [];
  const out: Square[] = [];
  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      const t = square(f, r);
      if (t !== sq && chess.attackers(t, p.color).includes(sq)) out.push(t);
    }
  }
  return out;
}

const SLIDES: Partial<Record<PieceSymbol, number[][]>> = {
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
};

interface Pin {
  pinned: Square;
  type: PieceSymbol;
  behind: PieceSymbol;
}

/** Inchiodature create dal pezzo a lungo raggio in `sq`: un pezzo avversario davanti a re, donna o torre. */
function pinsFrom(chess: Chess, sq: Square): Pin[] {
  const p = chess.get(sq);
  const dirs = p && SLIDES[p.type];
  if (!p || !dirs) return [];
  const out: Pin[] = [];
  const f0 = sq.charCodeAt(0) - 97;
  const r0 = Number(sq[1]) - 1;
  for (const [df, dr] of dirs) {
    let first: { sq: Square; type: PieceSymbol } | null = null;
    for (let f = f0 + df, r = r0 + dr; onBoard(f, r); f += df, r += dr) {
      const t = chess.get(square(f, r));
      if (!t) continue;
      if (t.color === p.color) break;
      if (!first) {
        if (t.type === 'k') break;
        first = { sq: square(f, r), type: t.type };
        continue;
      }
      if (first.type !== 'p' && (t.type === 'k' || VALUE[t.type] > VALUE[first.type])) {
        out.push({ pinned: first.sq, type: first.type, behind: t.type });
      }
      break;
    }
  }
  return out;
}

function canCastleNow(chess: Chess, color: Color, side: 'k' | 'q'): boolean {
  if (!castlingRights(chess.fen(), color).toLowerCase().includes(side)) return false;
  const rank = color === 'w' ? '1' : '8';
  const between = side === 'k' ? ['f', 'g'] : ['b', 'c', 'd'];
  return between.every((f) => !chess.get(`${f}${rank}` as Square));
}

/**
 * Spiega con parole semplici cosa fa la mossa `san` nella posizione `fen`: sviluppo, centro,
 * catene di pedoni, minacce, attacchi doppi, inchiodature, preparazione dell'arrocco…
 * Completa i commenti del repertorio e le analisi di Stockfish.
 */
export function describeMove(fen: string, san: string): string[] {
  const before = new Chess(fen);
  const me = before.turn();
  const opp: Color = me === 'w' ? 'b' : 'w';
  const after = new Chess(fen);
  let move;
  try {
    move = after.move(san);
  } catch {
    return [];
  }
  if (after.isCheckmate()) return ['Scacco matto!'];

  const out: string[] = [];
  const from = move.from as Square;
  const to = move.to as Square;
  const isCastle = move.flags.includes('k') || move.flags.includes('q');

  if (isCastle) {
    out.push(
      move.flags.includes('k')
        ? 'Arrocco corto: il re va al sicuro e la torre si avvicina al centro.'
        : 'Arrocco lungo: il re va sul lato di donna e la torre entra subito in colonna d.',
    );
  }

  // Catture, scambi e sacrifici.
  if (move.flags.includes('e')) {
    out.push('Presa en passant del pedone appena avanzato di due case.');
  } else if (move.captured) {
    const recapture = after.attackers(to, opp).length > 0;
    const given = VALUE[move.piece] - VALUE[move.captured];
    if (!recapture) out.push(`Cattura ${withArticle(move.captured)} in ${to}: nessun pezzo avversario può riprendere.`);
    else if (given >= 2) {
      out.push(`Sacrificio: ${withArticle(move.piece)} prende ${withArticle(move.captured)} in ${to} e può essere ripres${feminine(move.piece) ? 'a' : 'o'}. Si dà materiale in cambio di attacco o tempo.`);
    } else if (given === 0) out.push(`Cattura ${withArticle(move.captured)} in ${to}: se l'avversario riprende è uno scambio alla pari.`);
    else out.push(`Cattura ${withArticle(move.captured)} in ${to}.`);
  }

  // Sviluppo e centro.
  if ((move.piece === 'n' || move.piece === 'b') && HOME_MINORS[me].includes(from)) {
    const c = controlled(after, to).filter((t) => CENTER.includes(t));
    const centre = c.length ? `: controlla ${c.length > 1 ? 'le case centrali' : 'la casa centrale'} ${listText(c)}` : '';
    out.push(`Sviluppa ${withArticle(move.piece)} in ${to}${centre}.`);
  } else if (move.piece === 'n' && CENTER.includes(to)) {
    out.push('Il cavallo si piazza al centro, dove controlla il massimo delle case.');
  }

  if (move.piece === 'p') {
    const rel = me === 'w' ? Number(to[1]) : 9 - Number(to[1]);
    if (!move.captured) {
      if ('de'.includes(to[0]) && rel === 4) out.push('Occupa il centro con un pedone.');
      else if ('cdef'.includes(to[0]) && rel === 5) out.push('Avanza al centro e guadagna spazio.');
      if (rel === 3 && 'ah'.includes(to[0])) {
        const denied = `${to[0] === 'h' ? 'g' : 'b'}${me === 'w' ? 4 : 5}`;
        out.push(`Mossa profilattica: toglie la casa ${denied} ai pezzi avversari (per esempio a un alfiere che vorrebbe inchiodare il cavallo).`);
      }
      if (rel === 3 && 'bg'.includes(to[0])) {
        const b = before.get(`${to[0] === 'g' ? 'f' : 'c'}${me === 'w' ? 1 : 8}` as Square);
        if (b && b.type === 'b' && b.color === me) out.push(`Prepara il fianchetto: l'alfiere andrà in ${to[0]}${me === 'w' ? 2 : 7}, sulla grande diagonale.`);
      }
    }
    const dir = me === 'w' ? 1 : -1;
    const f = to.charCodeAt(0) - 97;
    const r = Number(to[1]) - 1;
    const ahead = [-1, 1].filter((df) => onBoard(f + df, r + dir)).map((df) => square(f + df, r + dir));
    const pawnTarget = ahead.find((t) => after.get(t)?.color === opp && after.get(t)?.type === 'p');
    const pieceTarget = ahead.find((t) => after.get(t)?.color === opp && !['p', 'k'].includes(after.get(t)!.type));
    if (pieceTarget) out.push(`Minaccia di prendere ${withArticle(after.get(pieceTarget)!.type)} in ${pieceTarget} con il pedone.`);
    else if (pawnTarget) out.push(`Attacca il pedone in ${pawnTarget}: è la rottura che mette in discussione la struttura avversaria.`);
    const supported = ahead.find((t) => after.get(t)?.color === me && after.get(t)?.type === 'p');
    if (supported) out.push(`Sostiene il pedone in ${supported}.`);
    // Diagonali che si aprono per alfieri e donna.
    for (const row of before.board()) {
      for (const p of row) {
        if (!p || p.color !== me || (p.type !== 'b' && p.type !== 'q')) continue;
        if (bishopScope(after, p.square) - bishopScope(before, p.square) >= 3) {
          out.push(`Apre la diagonale ${p.type === 'b' ? `all'alfiere in ${p.square}` : 'alla donna'}.`);
        }
      }
    }
  }

  // Minacce, attacchi doppi, inchiodature, colonne.
  if (move.piece !== 'p' && move.piece !== 'k') {
    const targets = hangingPieces(after, opp).filter((h) => after.attackers(h.square, me).includes(to));
    const check = after.inCheck();
    if (targets.length + (check ? 1 : 0) >= 2) {
      const what = [...(check ? ['il re (scacco)'] : []), ...targets.map((t) => `${withArticle(t.type)} in ${t.square}`)];
      out.push(`Attacco doppio: colpisce contemporaneamente ${listText(what)}.`);
    } else if (targets[0]) {
      out.push(`Attacca ${withArticle(targets[0].type)} in ${targets[0].square}.`);
    }
    for (const pin of pinsFrom(after, to)) {
      const behind = pin.behind === 'k' ? 'al re: non può muoversi' : pin.behind === 'q' ? 'alla donna' : 'alla torre';
      out.push(`Inchioda ${withArticle(pin.type)} in ${pin.pinned} ${behind}.`);
    }
    const weak = (opp === 'b' ? 'f7' : 'f2') as Square;
    const wp = after.get(weak);
    const weakAttackers = after.attackers(weak, me);
    if (wp?.type === 'p' && wp.color === opp && weakAttackers.includes(to) && after.attackers(weak, opp).every((s) => after.get(s)!.type === 'k')) {
      out.push(
        weakAttackers.length >= 2
          ? `Secondo pezzo contro ${weak}: ora è attaccato due volte e difeso solo dal re, quindi è minacciato.`
          : `Punta su ${weak}, il punto debole ${opp === 'b' ? 'del Nero' : 'del Bianco'}: all'inizio della partita è difeso solo dal re.`,
      );
    }
    if (move.piece === 'r' && !isCastle) {
      const pawns = [1, 2, 3, 4, 5, 6, 7, 8].map((r) => after.get(`${to[0]}${r}` as Square)).filter((p) => p?.type === 'p');
      if (pawns.length === 0) out.push(`La torre occupa la colonna aperta ${to[0]}.`);
      else if (!pawns.some((p) => p!.color === me)) out.push(`La torre si piazza sulla colonna semiaperta ${to[0]}, contro il pedone avversario.`);
    }
    if (hangingPieces(before, me).some((h) => h.square === from) && !hangingPieces(after, me).some((h) => h.square === to)) {
      out.push(`Toglie ${withArticle(move.piece)} dall'attacco.`);
    }
    if (check && targets.length === 0) out.push('Dà scacco.');
  } else if (after.inCheck()) {
    out.push('Dà scacco.');
  }

  // Difese.
  const hangAfter = new Set(hangingPieces(after, me).map((h) => h.square));
  const defended = hangingPieces(before, me).find((h) => h.square !== from && !hangAfter.has(h.square));
  if (defended) out.push(`Difende ${withArticle(defended.type)} in ${defended.square}, che era sotto attacco.`);

  // Arrocco.
  if (!isCastle && move.piece !== 'k') {
    if (canCastleNow(after, me, 'k') && !canCastleNow(before, me, 'k')) out.push('Libera la strada: ora puoi arroccare corto.');
    else if (canCastleNow(after, me, 'q') && !canCastleNow(before, me, 'q')) out.push('Libera la strada: ora puoi arroccare lungo.');
  }
  if (move.piece === 'k' && !isCastle && castlingRights(fen, me)) out.push('Il re si muove e perde il diritto di arroccare.');

  return [...new Set(out)];
}

/** Una mossa (UCI) con le sue intenzioni tra parentesi: "Nb5 (attacca il pedone in c7)". */
export function describeReply(fen: string, uci: string): string {
  const san = uciToSan(fen, uci);
  const motifs = describeMove(fen, san).slice(0, 2);
  return motifs.length ? `${san} (${motifs.map((m) => lowerFirst(m).replace(/\.$/, '')).join('; ')})` : san;
}
