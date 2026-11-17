import type { Opening } from '../model/types';
import { load, save } from './storage';

/**
 * Presentazione al primo avvio: scegli le aperture che giochi, imposta il ripasso, prova un corso.
 * Compare solo a chi non ha ancora nessun progresso: se un altro dispositivo porta progressi con la
 * sincronizzazione, sparisce da sola.
 */
const DONE_KEY = 'onboarding';
const MINE_KEY = 'myOpenings';

export interface OnboardingState {
  done: boolean;
  /** Schede del ripasso già presenti. */
  cards: number;
  /** Lezioni completate in qualche corso. */
  lessons: number;
  /** È già stata aperta un'apertura. */
  visited: boolean;
}

export const needsOnboarding = (s: OnboardingState) => !s.done && s.cards === 0 && s.lessons === 0 && !s.visited;

export const isOnboardingDone = () => load<{ at: number } | null>(DONE_KEY, null) !== null;
export const finishOnboarding = (now = Date.now()) => save(DONE_KEY, { at: now });

/** Le aperture che l'utente gioca (id), nell'ordine in cui compaiono. Vuoto = non ha scelto. */
export const loadMyOpenings = () => load<string[]>(MINE_KEY, []);
export const saveMyOpenings = (ids: string[]) => save(MINE_KEY, ids);

/** Solo gli id che esistono ancora (un'apertura importata può essere stata rimossa). */
export function mineIn(openings: Opening[], mine: string[]): Opening[] {
  const set = new Set(mine);
  return openings.filter((o) => set.has(o.id));
}

/**
 * Il corso da proporre per cominciare: tra le aperture scelte (o tutte, se non ne ha scelte) la prima
 * con un corso non finito; a parità, quella col Nero contro 1.e4 o 1.d4 prima, poi col Bianco.
 */
export function suggestCourse(openings: Opening[], mine: string[], lessonsDone: (id: string) => number): Opening | undefined {
  const pool = mine.length ? mineIn(openings, mine) : openings;
  const withCourse = pool.filter((o) => o.course && lessonsDone(o.id) < o.course.lessons.length);
  return withCourse.find((o) => o.color === 'black') ?? withCourse[0];
}
