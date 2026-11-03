import { Chess } from 'chess.js';
import type { Opening } from '../model/types';
import { buildPliesFrom } from './simulation';
import { load, save } from './storage';

/** Una partita importata (da chess.com o da un PGN) da analizzare con Stockfish. */
export interface ImportedGame {
  id: string;
  source: 'chess.com' | 'pgn';
  startFen: string;
  /** Mosse in SAN. */
  moves: string[];
  white: string;
  black: string;
  whiteElo?: string;
  blackElo?: string;
  /** "1-0", "0-1", "1/2-1/2" o "*". */
  result: string;
  /** Come è finita, se il PGN lo dice (es. "federico won by checkmate"). */
  termination?: string;
  /** AAAA-MM-GG */
  date?: string;
  timeControl?: string;
  timeClass?: string;
  url?: string;
  /** Nome dell'apertura secondo chess.com (dall'URL ECO), se c'è. */
  openingName?: string;
}

export interface AnalyzedGame extends ImportedGame {
  /** Il colore con cui ho giocato; undefined = non so chi sono (PGN di altri). */
  myWhite?: boolean;
  /** Apertura del mio repertorio che la partita segue, se c'è. */
  openingId?: string;
  accuracy?: { white?: number; black?: number };
  analyzedAt?: string;
}

export const STANDARD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// ---------------------------------------------------------------------------
// PGN

/** Divide un file con più partite: una nuova partita inizia con gli header dopo delle mosse. */
export function splitPgn(text: string): string[] {
  const games: string[] = [];
  let cur: string[] = [];
  let sawMoves = false;
  for (const raw of text.replace(/\r\n?/g, '\n').replace(/^﻿/, '').split('\n')) {
    const line = raw.trim();
    const isHeader = /^\[\w+\s+".*"\]$/.test(line);
    if (isHeader && sawMoves) {
      games.push(cur.join('\n'));
      cur = [];
      sawMoves = false;
    }
    if (!isHeader && line) sawMoves = true;
    cur.push(raw);
  }
  if (cur.join('').trim()) games.push(cur.join('\n'));
  return games.map((g) => g.trim()).filter((g) => g.length > 0);
}

/** Identificativo stabile: stessa partita = stesso id (niente doppioni nello storico). */
function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function openingFromEcoUrl(url?: string): string | undefined {
  const slug = url?.split('/openings/')[1];
  return slug ? decodeURIComponent(slug).replace(/-/g, ' ').replace(/\.{3}/g, '...') : undefined;
}

/** Legge una partita PGN. Lancia un errore comprensibile se non è valida. */
export function parseGame(pgn: string, source: ImportedGame['source'] = 'pgn'): ImportedGame {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch (e) {
    throw new Error(`PGN non valido: ${e instanceof Error ? e.message : e}`);
  }
  const h = chess.getHeaders() as Record<string, string | undefined>;
  if (h.Variant && !/^standard$/i.test(h.Variant)) throw new Error(`variante "${h.Variant}" non supportata`);
  const moves = chess.history();
  if (moves.length === 0) throw new Error('la partita non contiene mosse');
  const startFen = h.FEN && h.SetUp !== '0' ? h.FEN : STANDARD_FEN;
  const url = h.Link ?? (h.Site?.startsWith('http') ? h.Site : undefined);
  const date = (h.UTCDate ?? h.Date)?.replace(/\./g, '-');
  return {
    id: hashId(`${h.White}|${h.Black}|${date}|${h.UTCTime ?? ''}|${moves.join(' ')}`),
    source,
    startFen,
    moves,
    white: h.White || 'Bianco',
    black: h.Black || 'Nero',
    whiteElo: h.WhiteElo && h.WhiteElo !== '?' ? h.WhiteElo : undefined,
    blackElo: h.BlackElo && h.BlackElo !== '?' ? h.BlackElo : undefined,
    result: h.Result ?? '*',
    termination: h.Termination,
    date: date && !date.includes('?') ? date : undefined,
    timeControl: h.TimeControl,
    url,
    openingName: openingFromEcoUrl(h.ECOUrl) ?? h.Opening,
  };
}

/** Tutte le partite valide di un testo PGN, più gli errori di quelle non valide. */
export function parseGames(text: string): { games: ImportedGame[]; errors: string[] } {
  const games: ImportedGame[] = [];
  const errors: string[] = [];
  splitPgn(text).forEach((g, i) => {
    try {
      games.push(parseGame(g));
    } catch (e) {
      errors.push(`Partita ${i + 1}: ${e instanceof Error ? e.message : e}`);
    }
  });
  return { games, errors };
}

// ---------------------------------------------------------------------------
// Chi sono e quale apertura del repertorio ho giocato

export function detectMyColor(game: ImportedGame, username?: string): boolean | undefined {
  const u = username?.trim().toLowerCase();
  if (!u) return undefined;
  if (game.white.toLowerCase() === u) return true;
  if (game.black.toLowerCase() === u) return false;
  return undefined;
}

/**
 * L'apertura del repertorio (del mio colore) che la partita segue più a lungo.
 * Servono almeno 2 semimosse in comune, altrimenti non c'è un vero legame.
 */
export function matchRepertoire(openings: Opening[], game: ImportedGame, myWhite?: boolean): { opening: Opening; bookPlies: number } | undefined {
  let best: { opening: Opening; bookPlies: number } | undefined;
  for (const op of openings) {
    if (myWhite !== undefined && (op.color === 'white') !== myWhite) continue;
    if (op.root.fen.split(' ')[0] !== game.startFen.split(' ')[0]) continue;
    const plies = buildPliesFrom(game.startFen, game.moves, op.root);
    const n = plies.findIndex((p) => !p.book);
    const bookPlies = n === -1 ? plies.length : n;
    if (bookPlies >= 2 && (!best || bookPlies > best.bookPlies)) best = { opening: op, bookPlies };
  }
  return best;
}

/** Risultato dal mio punto di vista. */
export function myOutcome(game: ImportedGame, myWhite?: boolean): 'vinta' | 'persa' | 'patta' | undefined {
  if (game.result === '1/2-1/2') return 'patta';
  if (myWhite === undefined || (game.result !== '1-0' && game.result !== '0-1')) return undefined;
  return (game.result === '1-0') === myWhite ? 'vinta' : 'persa';
}

export function resultText(game: ImportedGame): string {
  const base =
    game.result === '1-0' ? 'Vince il Bianco' : game.result === '0-1' ? 'Vince il Nero' : game.result === '1/2-1/2' ? 'Patta' : 'Partita non conclusa';
  return game.termination ? `${base} · ${game.termination}` : base;
}

// ---------------------------------------------------------------------------
// chess.com (API pubblica: https://www.chess.com/news/view/published-data-api)

export const TIME_CLASS: Record<string, string> = { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid', daily: 'Giornaliera' };

interface ChessComPlayer {
  username: string;
  rating?: number;
  result?: string;
}

export interface ChessComGame {
  url: string;
  pgn?: string;
  end_time?: number;
  time_class?: string;
  rules?: string;
  white: ChessComPlayer;
  black: ChessComPlayer;
}

const API = 'https://api.chess.com/pub/player';

async function getJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('chess.com non risponde: controlla la connessione (offline l\'import da chess.com non funziona).');
  }
  if (res.status === 404) throw new Error('utente non trovato su chess.com.');
  if (!res.ok) throw new Error(`chess.com ha risposto con un errore (${res.status}). Riprova tra poco.`);
  return res.json() as Promise<T>;
}

/** URL degli archivi mensili, dal più recente. */
export async function fetchArchives(username: string): Promise<string[]> {
  const data = await getJson<{ archives?: string[] }>(`${API}/${encodeURIComponent(username.trim().toLowerCase())}/games/archives`);
  return [...(data.archives ?? [])].reverse();
}

/** Le partite (scacchi classici) di un mese, dalla più recente. */
export async function fetchMonth(archiveUrl: string): Promise<ImportedGame[]> {
  const data = await getJson<{ games?: ChessComGame[] }>(archiveUrl);
  return fromChessCom(data.games ?? []);
}

export function fromChessCom(games: ChessComGame[]): ImportedGame[] {
  const out: ImportedGame[] = [];
  for (const g of games) {
    if ((g.rules && g.rules !== 'chess') || !g.pgn) continue;
    try {
      const parsed = parseGame(g.pgn, 'chess.com');
      out.push({ ...parsed, id: g.url ? `cc-${g.url.split('/').pop()}` : parsed.id, url: g.url ?? parsed.url, timeClass: g.time_class });
    } catch {
      // partita illeggibile: la saltiamo
    }
  }
  return out.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

/** "2026/11" dall'URL dell'archivio → "novembre 2026". */
export function archiveLabel(url: string): string {
  const m = url.match(/(\d{4})\/(\d{2})$/);
  if (!m) return url;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Archivio delle partite analizzate

const LIBRARY_MAX = 50;

export function loadLibrary(): AnalyzedGame[] {
  return load<AnalyzedGame[]>('analyzedGames', []);
}

export function saveToLibrary(game: AnalyzedGame): AnalyzedGame[] {
  const next = [game, ...loadLibrary().filter((g) => g.id !== game.id)].slice(0, LIBRARY_MAX);
  save('analyzedGames', next);
  return next;
}

export function removeFromLibrary(id: string): AnalyzedGame[] {
  const next = loadLibrary().filter((g) => g.id !== id);
  save('analyzedGames', next);
  return next;
}

export const loadUsername = () => load<string>('chesscomUser', '');
export const saveUsername = (u: string) => save('chesscomUser', u.trim());
