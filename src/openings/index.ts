import { parseOpening } from '../core/pgnToTree';
import { parseCourse } from '../core/course';
import type { Opening } from '../model/types';

/**
 * Ogni file .pgn in questa cartella diventa un'apertura, senza toccare il codice.
 * Il nome del file (senza estensione) è l'id di riserva se manca l'header [Id].
 */
const files = import.meta.glob('./*.pgn', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Corsi guidati: `<nome>.course.md`, collegati all'apertura con lo stesso nome file o id. */
const courseFiles = import.meta.glob('./*.course.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const courses = new Map(Object.entries(courseFiles).map(([p, text]) => [p.replace(/^\.\//, '').replace(/\.course\.md$/, ''), text]));

export interface LoadError {
  file: string;
  message: string;
}

export interface PgnSource {
  file: string;
  pgn: string;
  source: Opening['source'];
}

export const builtinSources: PgnSource[] = Object.entries(files).map(([path, pgn]) => ({
  file: path.replace(/^\.\//, ''),
  pgn,
  source: 'builtin',
}));

export function loadOpenings(sources: PgnSource[]): { openings: Opening[]; errors: LoadError[] } {
  const openings: Opening[] = [];
  const errors: LoadError[] = [];
  for (const s of sources) {
    try {
      const op = parseOpening(s.pgn, s.file.replace(/\.pgn$/i, ''), s.source);
      if (openings.some((o) => o.id === op.id)) throw new Error(`Id "${op.id}" già usato da un'altra apertura.`);
      openings.push(op);
      const base = s.file.replace(/\.pgn$/i, '');
      const courseText = courses.get(base) ?? courses.get(op.id);
      if (courseText) {
        try {
          op.course = parseCourse(courseText, op.root.fen);
        } catch (e) {
          errors.push({ file: `${base}.course.md`, message: e instanceof Error ? e.message : String(e) });
        }
      }
    } catch (e) {
      errors.push({ file: s.file, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return { openings, errors };
}
