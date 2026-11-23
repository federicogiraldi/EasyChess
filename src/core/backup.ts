import type { CardState } from './srs';
import type { PgnSource } from '../openings';

const NUMERIC: (keyof CardState)[] = ['due', 'interval', 'ease', 'reps', 'lapses', 'seen', 'correct'];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Tiene solo le schede SRS ben formate (da un backup, dalla sync o da uno storage rovinato). */
export function sanitizeCards(value: unknown): Record<string, CardState> {
  if (!isRecord(value)) return {};
  const out: Record<string, CardState> = {};
  for (const [key, card] of Object.entries(value)) {
    if (!isRecord(card)) continue;
    if (!NUMERIC.every((f) => typeof card[f] === 'number' && Number.isFinite(card[f]))) continue;
    if (card.at !== undefined && typeof card.at !== 'number') continue;
    out[key] = card as unknown as CardState;
  }
  return out;
}

/** Tiene solo le aperture importate ben formate; la provenienza è sempre "imported". */
export function sanitizeSources(value: unknown): PgnSource[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Record<string, unknown> => isRecord(s) && typeof s.file === 'string' && typeof s.pgn === 'string')
    .map((s) => ({ file: s.file as string, pgn: s.pgn as string, source: 'imported' as const }));
}

/** Legge un file di backup dei progressi; lancia un errore se il formato non è riconosciuto. */
export function parseBackup(text: string): { cards: Record<string, CardState>; imported?: PgnSource[] } {
  const data: unknown = JSON.parse(text);
  if (!isRecord(data) || data.version !== 1 || !isRecord(data.cards)) throw new Error('formato non riconosciuto');
  return {
    cards: sanitizeCards(data.cards),
    imported: data.imported === undefined ? undefined : sanitizeSources(data.imported),
  };
}
