import { Chess } from 'chess.js';
import type { Opening } from '../model/types';
import type { ImportedGame } from './analysis';
import { myOutcome } from './analysis';
import { cardKey, findInBook, lineNameOf, nextMoves, normalizeFen, pathFromRoot } from './tree';

/**
 * Buchi del repertorio, dalle partite giocate.
 * - "uncovered": l'avversario ha giocato una mossa che nessuna delle tue aperture prevede.
 * - "deviation": il repertorio prevedeva una tua mossa e tu ne hai giocata un'altra.
 * La fine normale di una linea preparata non conta: lì il repertorio finisce apposta.
 */
export type GapKind = 'uncovered' | 'deviation';

export interface Gap {
  kind: GapKind;
  /** Mosse (SAN) dalla posizione iniziale fino alla posizione del buco, mossa del buco esclusa. */
  moves: string[];
  /** La mossa giocata nella partita. */
  move: string;
  /** Il colore con cui giocavo. */
  myWhite: boolean;
  /** Apertura in cui si trova la posizione (la prima che la contiene). */
  openingId: string;
  openingName: string;
  lineName?: string;
  /** Mosse del repertorio in quella posizione. */
  expected: string[];
  /** Scheda di ripasso della posizione (solo per "deviation"). */
  cardKey?: string;
  games: number;
  lost: number;
  gameIds: string[];
}

export interface GapReport {
  uncovered: Gap[];
  deviations: Gap[];
  /** Partite controllate (colore noto e posizione iniziale standard). */
  checked: number;
  /** Partite in cui il repertorio è stato seguito fino alla fine della linea. */
  covered: number;
}

export interface GameWithColor {
  game: ImportedGame;
  myWhite?: boolean;
}

/** Il primo punto della partita in cui si esce dal repertorio, se l'uscita è un buco. */
export function firstGap(openings: Opening[], game: ImportedGame, myWhite: boolean): Omit<Gap, 'games' | 'lost' | 'gameIds'> | null | 'covered' {
  const mine = openings.filter((op) => (op.color === 'white') === myWhite && op.root.fen.split(' ')[0] === game.startFen.split(' ')[0]);
  if (mine.length === 0) return null;
  const chess = new Chess(game.startFen);
  for (let i = 0; i < game.moves.length; i++) {
    const fen = chess.fen();
    const found = mine
      .map((op) => ({ op, node: findInBook(op.root, fen) }))
      .filter((x): x is { op: Opening; node: NonNullable<typeof x.node> } => !!x.node && nextMoves(x.node).length > 0);
    // Posizione fuori dal libro o fine di tutte le linee preparate: niente buco.
    if (found.length === 0) return i === 0 ? null : 'covered';
    const played = chess.move(game.moves[i]);
    if (!played) return null;
    if (found.some(({ node }) => nextMoves(node).some((c) => c.san === played.san))) continue;
    // Mossa non prevista qui, ma che entro poche mosse traspone in una posizione del repertorio: nessun buco.
    const back = rejoin(mine, game.moves, i + 1, chess.fen());
    if (back !== -1) {
      for (let j = i + 1; j < back; j++) chess.move(game.moves[j]);
      i = back - 1;
      continue;
    }
    const { op, node } = found[0];
    const myMove = (chess.turn() === 'b') === myWhite;
    const expected = [...new Set(found.flatMap(({ node: n }) => nextMoves(n).map((c) => c.san)))];
    return {
      kind: myMove ? 'deviation' : 'uncovered',
      moves: game.moves.slice(0, i),
      move: played.san,
      myWhite,
      openingId: op.id,
      openingName: op.name,
      lineName: lineNameOf(pathFromRoot(node)),
      expected,
      cardKey: myMove ? cardKey(op, node) : undefined,
    };
  }
  return 'covered';
}

const REJOIN_PLIES = 4;

/** Indice della prima mossa (entro REJOIN_PLIES) da cui la partita torna in una posizione del repertorio, o -1. */
function rejoin(openings: Opening[], moves: string[], from: number, fen: string): number {
  const inBook = (f: string) => openings.some((op) => findInBook(op.root, f));
  if (inBook(fen)) return from;
  const c = new Chess(fen);
  for (let j = from; j < Math.min(moves.length, from + REJOIN_PLIES); j++) {
    if (!c.move(moves[j])) return -1;
    if (inBook(c.fen())) return j + 1;
  }
  return -1;
}

export function findGaps(openings: Opening[], games: GameWithColor[]): GapReport {
  const byKey = new Map<string, Gap>();
  let checked = 0;
  let covered = 0;
  const seen = new Set<string>();
  for (const { game, myWhite } of games) {
    if (myWhite === undefined || seen.has(game.id)) continue;
    seen.add(game.id);
    const gap = firstGap(openings, game, myWhite);
    if (gap === null) continue;
    checked++;
    if (gap === 'covered') {
      covered++;
      continue;
    }
    const chess = new Chess(game.startFen);
    for (const m of gap.moves) chess.move(m);
    const key = `${gap.kind}|${normalizeFen(chess.fen())}|${gap.move}`;
    const prev = byKey.get(key);
    const lost = myOutcome(game, myWhite) === 'persa' ? 1 : 0;
    if (prev) {
      prev.games++;
      prev.lost += lost;
      prev.gameIds.push(game.id);
    } else byKey.set(key, { ...gap, games: 1, lost, gameIds: [game.id] });
  }
  const sorted = [...byKey.values()].sort((a, b) => b.games - a.games || b.lost - a.lost || a.moves.length - b.moves.length);
  return {
    uncovered: sorted.filter((g) => g.kind === 'uncovered'),
    deviations: sorted.filter((g) => g.kind === 'deviation'),
    checked,
    covered,
  };
}

/** "1.e4 e5 2.Nf3" per le mosse prima del buco, e "2...Nf6" per la mossa del buco. */
export function formatMoves(moves: string[], startPly = 0): string {
  return moves
    .map((m, i) => {
      const ply = startPly + i;
      const n = Math.floor(ply / 2) + 1;
      if (ply % 2 === 0) return `${n}.${m}`;
      return i === 0 ? `${n}...${m}` : m;
    })
    .join(' ');
}
