import { Chess } from 'chess.js';
import type { Opening, OpeningNode } from '../model/types';

/** Mosse giocabili da questa posizione, seguendo le trasposizioni. */
export function nextMoves(node: OpeningNode): OpeningNode[] {
  if (node.children.length > 0) return node.children;
  return node.transposesTo?.children ?? [];
}

export function pathFromRoot(node: OpeningNode): OpeningNode[] {
  const path: OpeningNode[] = [];
  for (let n: OpeningNode | null = node; n; n = n.parent) path.unshift(n);
  return path;
}

/** Ultimo nome di linea incontrato lungo il percorso. */
export function lineNameOf(path: OpeningNode[]): string | undefined {
  for (let i = path.length - 1; i >= 0; i--) {
    const n = path[i];
    if (n.lineName) return n.lineName;
    if (n.transposesTo) {
      const via = lineNameOf(pathFromRoot(n.transposesTo));
      if (via) return via;
    }
  }
  return undefined;
}

/** Etichetta per una mossa candidata: nome della linea, quante linee ne seguono, o la trasposizione. */
export function candidateLabel(node: OpeningNode): string {
  if (node.lineName) return node.lineName;
  const names = namedLines(node);
  if (names.length === 1) return names[0].node.lineName!;
  if (names.length > 1) return `${names.length} linee`;
  if (node.transposesTo) return '↪ ' + (lineNameOf(pathFromRoot(node.transposesTo)) ?? 'trasposizione');
  return '';
}

export function moveLabel(node: OpeningNode): string {
  const num = Math.ceil(node.ply / 2);
  return node.ply % 2 === 1 ? `${num}.${node.san}` : `${num}...${node.san}`;
}

/** "1.e4 c6 2.d4 d5" (la radice viene ignorata). */
export function formatPath(path: OpeningNode[]): string {
  const moves = path.filter((n) => n.ply > 0);
  return moves
    .map((n, i) => (n.ply % 2 === 1 ? `${Math.ceil(n.ply / 2)}.${n.san}` : i === 0 ? moveLabel(n) : n.san))
    .join(' ');
}

/**
 * FEN senza contatori di mosse; la casa en-passant resta solo se la presa è davvero possibile,
 * così due ordini di mosse che portano alla stessa posizione coincidono.
 */
const normalized = new Map<string, string>();

export function normalizeFen(fen: string): string {
  const cached = normalized.get(fen);
  if (cached) return cached;
  const parts = fen.split(' ');
  if (parts[3] !== '-') {
    const epPossible = new Chess(fen).moves({ verbose: true }).some((m) => m.flags.includes('e'));
    if (!epPossible) parts[3] = '-';
  }
  const result = parts.slice(0, 4).join(' ');
  normalized.set(fen, result);
  return result;
}

export function walk(root: OpeningNode, fn: (n: OpeningNode) => void) {
  fn(root);
  root.children.forEach((c) => walk(c, fn));
}

/** Nodi con un nome di linea, con profondità di annidamento per la vista ad albero. */
export function namedLines(root: OpeningNode): { node: OpeningNode; depth: number }[] {
  const out: { node: OpeningNode; depth: number }[] = [];
  const visit = (n: OpeningNode, depth: number) => {
    let d = depth;
    if (n.lineName) out.push({ node: n, depth: d++ });
    n.children.forEach((c) => visit(c, d));
  };
  visit(root, 0);
  return out;
}

export interface CardPosition {
  key: string;
  /** Posizione in cui tocca a me muovere. */
  node: OpeningNode;
}

/** Ogni posizione (unica) in cui devo trovare una mossa del repertorio è una "card". */
export function cardPositions(opening: Opening): CardPosition[] {
  const seen = new Set<string>();
  const out: CardPosition[] = [];
  walk(opening.root, (n) => {
    const moves = nextMoves(n);
    if (moves.length === 0 || !moves[0].isUserMove) return;
    const key = cardKey(opening, n);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, node: n });
  });
  return out;
}

export function cardKey(opening: Opening, node: OpeningNode): string {
  return `${opening.id}|${normalizeFen(node.fen)}`;
}

export function countLeaves(root: OpeningNode): number {
  let count = 0;
  walk(root, (n) => {
    if (n.children.length === 0 && n.parent) count++;
  });
  return count;
}

const bookCache = new WeakMap<OpeningNode, Map<string, OpeningNode>>();

/** Indice posizione → nodo del repertorio, per riconoscere le posizioni "da libro" anche per trasposizione. */
export function findInBook(root: OpeningNode, fen: string): OpeningNode | undefined {
  let index = bookCache.get(root);
  if (!index) {
    index = new Map();
    const map = index;
    walk(root, (n) => {
      const key = normalizeFen(n.fen);
      const prev = map.get(key);
      if (!prev || (nextMoves(prev).length === 0 && nextMoves(n).length > 0)) map.set(key, n);
    });
    bookCache.set(root, index);
  }
  return index.get(normalizeFen(fen));
}
