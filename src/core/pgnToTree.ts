import { Chess } from 'chess.js';
import type { Arrow, Highlight, Opening, OpeningNode, Side } from '../model/types';
import { formatPath, normalizeFen, pathFromRoot } from './tree';

/**
 * Converte un PGN (anche con più partite/capitoli, varianti annidate e commenti)
 * in un unico albero di aperture. Le partite che condividono le prime mosse
 * vengono fuse, quindi una linea può essere scritta come "partita" separata.
 *
 * Comandi riconosciuti nei commenti { ... }:
 *   [%line Nome linea]   dà un nome alla linea che parte da questa mossa
 *   [%key Idea]          idea chiave mostrata in Esplora (ripetibile)
 *   [%cal Ge2e4,Rd5e4]   frecce (formato Lichess: G/R/Y/B + case)
 *   [%csl Gd5]           case evidenziate (formato Lichess)
 */

export class PgnError extends Error {}

type Token =
  | { type: 'header'; key: string; value: string }
  | { type: 'comment'; text: string }
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'move'; san: string }
  | { type: 'result' };

interface Game {
  headers: Record<string, string>;
  tokens: Token[];
}

const TOKEN_RE =
  /\{([^}]*)\}|;[^\n]*|\[\s*(\w+)\s+"((?:[^"\\]|\\.)*)"\s*\]|(\()|(\))|\$\d+|(1-0|0-1|1\/2-1\/2|\*)|\d+\.(?:\.\.)?|([A-Za-z][A-Za-z0-9+#=\-]*[!?]*)/g;

function tokenize(pgn: string): Token[] {
  const tokens: Token[] = [];
  for (const m of pgn.matchAll(TOKEN_RE)) {
    if (m[1] !== undefined) tokens.push({ type: 'comment', text: m[1] });
    else if (m[2] !== undefined) tokens.push({ type: 'header', key: m[2], value: m[3].replace(/\\(.)/g, '$1') });
    else if (m[4]) tokens.push({ type: 'open' });
    else if (m[5]) tokens.push({ type: 'close' });
    else if (m[6]) tokens.push({ type: 'result' });
    else if (m[7]) tokens.push({ type: 'move', san: m[7] });
  }
  return tokens;
}

function splitGames(tokens: Token[]): Game[] {
  const games: Game[] = [];
  let cur: Game | null = null;
  let inMoves = false;
  for (const t of tokens) {
    if (t.type === 'header') {
      if (!cur || inMoves) {
        cur = { headers: {}, tokens: [] };
        games.push(cur);
        inMoves = false;
      }
      cur.headers[t.key] = t.value;
    } else if (t.type === 'result') {
      cur = null;
      inMoves = false;
    } else {
      if (!cur) {
        cur = { headers: {}, tokens: [] };
        games.push(cur);
      }
      cur.tokens.push(t);
      inMoves = true;
    }
  }
  return games.filter((g) => g.tokens.length > 0 || Object.keys(g.headers).length > 0);
}

const ARROW_COLORS: Record<string, string> = {
  G: 'rgba(21, 128, 61, 0.85)',
  R: 'rgba(200, 40, 40, 0.85)',
  Y: 'rgba(220, 160, 0, 0.85)',
  B: 'rgba(37, 99, 235, 0.85)',
};

function applyComment(node: OpeningNode, raw: string) {
  let text = raw;
  text = text.replace(/\[%line\s+([^\]]+)\]/g, (_, name: string) => {
    node.lineName = name.trim();
    return '';
  });
  text = text.replace(/\[%key\s+([^\]]+)\]/g, (_, idea: string) => {
    if (!node.keyIdeas.includes(idea.trim())) node.keyIdeas.push(idea.trim());
    return '';
  });
  text = text.replace(/\[%cal\s+([^\]]+)\]/g, (_, list: string) => {
    for (const a of list.split(',')) {
      const m = a.trim().match(/^([GRYB])([a-h][1-8])([a-h][1-8])$/);
      if (m) node.arrows.push({ color: ARROW_COLORS[m[1]], from: m[2], to: m[3] } satisfies Arrow);
    }
    return '';
  });
  text = text.replace(/\[%csl\s+([^\]]+)\]/g, (_, list: string) => {
    for (const a of list.split(',')) {
      const m = a.trim().match(/^([GRYB])([a-h][1-8])$/);
      if (m) node.highlights.push({ color: ARROW_COLORS[m[1]], square: m[2] } satisfies Highlight);
    }
    return '';
  });
  text = text.replace(/\[%[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return;
  if (!node.comment) node.comment = text;
  else if (!node.comment.includes(text)) node.comment += ' ' + text;
}

function makeRoot(fen: string): OpeningNode {
  return {
    id: '', san: '', from: '', to: '', fen, ply: 0, isUserMove: false,
    keyIdeas: [], arrows: [], highlights: [], children: [], parent: null,
  };
}

export function parseOpening(pgn: string, fallbackId: string, source: Opening['source'] = 'builtin'): Opening {
  const games = splitGames(tokenize(pgn));
  if (games.length === 0) throw new PgnError('Il file PGN è vuoto.');

  const headers: Record<string, string> = {};
  for (const g of games) for (const [k, v] of Object.entries(g.headers)) headers[k] ??= v;

  const colorRaw = (headers.Color ?? headers.Orientation ?? 'white').toLowerCase();
  if (colorRaw !== 'white' && colorRaw !== 'black') {
    throw new PgnError(`Header Color non valido: "${colorRaw}" (usa "white" o "black").`);
  }
  const color: Side = colorRaw;

  const startFen = headers.FEN ?? new Chess().fen();
  const root = makeRoot(startFen);

  for (const game of games) addGame(root, game, color);
  linkTranspositions(root);

  return {
    id: headers.Id ?? fallbackId,
    name: headers.Opening ?? headers.StudyName ?? headers.Event ?? fallbackId,
    color,
    description: headers.Description ?? '',
    root,
    source,
  };
}

function addGame(root: OpeningNode, game: Game, color: Side) {
  const tokens = game.tokens;
  let i = 0;
  let firstNew: OpeningNode | null = null;

  const play = (node: OpeningNode, rawSan: string): OpeningNode => {
    const san = rawSan.replace(/[!?]+$/, '').replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O');
    const chess = new Chess(node.fen);
    let move;
    try {
      move = chess.move(san);
    } catch {
      const where = node.parent ? `dopo ${formatPath(pathFromRoot(node))}` : 'in partenza';
      throw new PgnError(`Mossa illegale "${rawSan}" ${where}.`);
    }
    const existing = node.children.find((c) => c.san === move.san);
    if (existing) return existing;
    const child: OpeningNode = {
      id: node.id ? `${node.id} ${move.san}` : move.san,
      san: move.san,
      from: move.from,
      to: move.to,
      fen: chess.fen(),
      ply: node.ply + 1,
      isUserMove: (move.color === 'w' ? 'white' : 'black') === color,
      keyIdeas: [], arrows: [], highlights: [], children: [],
      parent: node,
    };
    node.children.push(child);
    firstNew ??= child;
    return child;
  };

  const line = (start: OpeningNode, depth: number) => {
    let cur = start;
    let beforeLast: OpeningNode | null = null;
    const pending: string[] = [];
    while (i < tokens.length) {
      const t = tokens[i++];
      if (t.type === 'open') {
        if (!beforeLast) throw new PgnError(`Variante "(" aperta prima di qualsiasi mossa, dopo ${formatPath(pathFromRoot(cur)) || "l'inizio"}.`);
        line(beforeLast, depth + 1);
      } else if (t.type === 'close') {
        if (depth === 0) throw new PgnError('Parentesi ")" senza "(" corrispondente.');
        return;
      } else if (t.type === 'comment') {
        if (cur === start && depth > 0) pending.push(t.text);
        else applyComment(cur, t.text);
      } else if (t.type === 'move') {
        const next = play(cur, t.san);
        for (const c of pending.splice(0)) applyComment(next, c);
        beforeLast = cur;
        cur = next;
      }
    }
    if (depth > 0) throw new PgnError('Variante "(" non chiusa.');
  };

  line(root, 0);

  const chapter = game.headers.ChapterName;
  if (firstNew && chapter && !/^chapter \d+$/i.test(chapter)) {
    (firstNew as OpeningNode).lineName ??= chapter;
  }
}

/** Una linea che finisce in una posizione presente altrove nell'albero prosegue da lì. */
function linkTranspositions(root: OpeningNode) {
  const byFen = new Map<string, OpeningNode>();
  const leaves: OpeningNode[] = [];
  const walk = (n: OpeningNode) => {
    if (n.children.length > 0) {
      const key = normalizeFen(n.fen);
      if (!byFen.has(key)) byFen.set(key, n);
    } else if (n.parent) {
      leaves.push(n);
    }
    n.children.forEach(walk);
  };
  walk(root);
  for (const leaf of leaves) {
    const target = byFen.get(normalizeFen(leaf.fen));
    if (target && target !== leaf) leaf.transposesTo = target;
  }
}
