import type { Opening, OpeningNode } from '../model/types';
import type { OpeningSummary } from './dashboard';
import { load, save } from './storage';

/**
 * Le mosse che identificano un'apertura: si segue la linea principale finché l'albero non si
 * dirama (almeno `min` semimosse, al massimo `max`). Es. Caro-Kann Avanzata → "1.e4 c6 2.d4 d5 3.e5".
 */
export function keyMoves(opening: Opening, min = 2, max = 6): string[] {
  const out: string[] = [];
  let node: OpeningNode = opening.root;
  while (node.children.length && out.length < max) {
    if (node.children.length > 1 && out.length >= min) break;
    node = node.children[0];
    out.push(node.san);
  }
  return out;
}

export interface OpeningGroup {
  id: string;
  title: string;
  side: 'white' | 'black';
  openings: Opening[];
}

const firstMoveName = (san: string) => `1.${san}`;
const OTHER = 'altre';

/**
 * Raggruppa le aperture: prima quelle col Bianco (per la prima mossa che gioco), poi quelle col Nero
 * (per la prima mossa dell'avversario). Un'apertura col Nero che risponde a più prime mosse (le
 * prime mosse rare) va in "contro altre prime mosse", in fondo.
 */
export function groupOpenings(openings: Opening[]): OpeningGroup[] {
  const groups: OpeningGroup[] = [];
  for (const side of ['white', 'black'] as const) {
    const bySan = new Map<string, Opening[]>();
    for (const op of openings.filter((o) => o.color === side)) {
      // col Nero, un'apertura che risponde a più prime mosse del Bianco va in "altre prime mosse"
      const san = side === 'black' && op.root.children.length > 1 ? OTHER : (op.root.children[0]?.san ?? '?');
      bySan.set(san, [...(bySan.get(san) ?? []), op]);
    }
    // e4 e d4 per primi, poi il resto in ordine di numero di aperture
    const order = (s: string) => (s === 'e4' ? 0 : s === 'd4' ? 1 : s === OTHER ? 3 : 2);
    const sans = [...bySan.keys()].sort((a, b) => order(a) - order(b) || bySan.get(b)!.length - bySan.get(a)!.length);
    for (const san of sans) {
      groups.push({
        id: `${side}-${san}`,
        title:
          san === OTHER
            ? 'Col Nero · contro altre prime mosse'
            : side === 'white' ? `Col Bianco · ${firstMoveName(san)}` : `Col Nero · contro ${firstMoveName(san)}`,
        side,
        openings: bySan.get(san)!,
      });
    }
  }
  return groups;
}

export type HomeMode = 'course' | 'explore' | 'drill' | 'review' | 'quiz' | 'lab' | 'sim';

/** Il passo consigliato per un'apertura: finire il corso, poi il ripasso, poi l'allenamento. */
export function nextStep(s: OpeningSummary): { mode: HomeMode; label: string } {
  if (s.courseTotal && s.courseDone < s.courseTotal)
    return { mode: 'course', label: s.courseDone ? `Continua il corso (${s.courseDone}/${s.courseTotal})` : 'Inizia il corso' };
  if (s.due > 0) return { mode: 'review', label: `Ripassa (${s.due})` };
  if (s.toReview > 0) return { mode: 'review', label: `Impara posizioni nuove (${s.toReview})` };
  return { mode: 'drill', label: 'Allenati' };
}

// ---------------------------------------------------------------------------
// "Continua da dove eri"

export interface LastVisit {
  openingId: string;
  mode: HomeMode;
  at: number;
}

const KEY = 'home:last';

export const loadLastVisit = () => load<LastVisit | null>(KEY, null);

export function saveLastVisit(openingId: string, mode: HomeMode, now = Date.now()): void {
  save(KEY, { openingId, mode, at: now } satisfies LastVisit);
}

/** Da quanto tempo, in parole. */
export function since(at: number, now = Date.now()): string {
  const min = Math.round((now - at) / 60000);
  if (min < 2) return 'poco fa';
  if (min < 60) return `${min} minuti fa`;
  const h = Math.round(min / 60);
  if (h < 24) return h === 1 ? "un'ora fa" : `${h} ore fa`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ieri' : `${d} giorni fa`;
}
