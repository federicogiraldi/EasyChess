/** Ripetizione spaziata: SM-2 semplificato, una card per posizione in cui tocca a me. */

export interface CardState {
  due: number;
  /** Intervallo in giorni (0 = da rivedere subito). */
  interval: number;
  ease: number;
  /** Risposte corrette consecutive. */
  reps: number;
  lapses: number;
  seen: number;
  correct: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function grade(prev: CardState | undefined, correct: boolean, now = Date.now()): CardState {
  const s: CardState = prev
    ? { ...prev }
    : { due: now, interval: 0, ease: 2.5, reps: 0, lapses: 0, seen: 0, correct: 0 };
  s.seen++;
  if (correct) {
    s.correct++;
    s.reps++;
    s.interval = s.reps === 1 ? 1 : s.reps === 2 ? 3 : Math.round(s.interval * s.ease);
    s.ease = Math.min(3, s.ease + 0.05);
  } else {
    s.reps = 0;
    s.lapses++;
    s.interval = 0;
    s.ease = Math.max(1.3, s.ease - 0.2);
  }
  s.due = now + s.interval * DAY;
  return s;
}

export function isDue(s: CardState | undefined, now = Date.now()): boolean {
  return !!s && s.due <= now;
}

/** Considerata imparata dopo due risposte corrette di fila (intervallo ≥ 3 giorni). */
export function isMastered(s: CardState | undefined): boolean {
  return !!s && s.reps >= 2;
}
