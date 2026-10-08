import { Chess } from 'chess.js';
import type { Arrow, Highlight } from '../model/types';

/**
 * Corso guidato scritto in un file `<id-apertura>.course.md`:
 *
 *   # Titolo lezione           ← nuova lezione
 *   line: Variante Classica    ← (facoltativo) linea da allenare a fine lezione
 *
 *   Testo del passo, con **grassetto** ed elenchi "- ".
 *   moves: 1. e4 c6 2. d4 d5   ← posizione assoluta da mostrare
 *   play: 3. e5 Bf5            ← mosse che continuano: le tue le giochi tu, le altre sono automatiche
 *   arrows: Gc6c5, Rd5e4
 *   marks: Gd5, Rd4
 *   quiz: Domanda?
 *   * risposta giusta | spiegazione
 *   - risposta sbagliata | spiegazione
 *
 *   ---                        ← nuovo passo
 */

export interface QuizOption {
  text: string;
  correct: boolean;
  explain?: string;
}

export interface CourseStep {
  text: string;
  arrows: Arrow[];
  highlights: Highlight[];
  /** Mosse (SAN) dalla posizione iniziale all'inizio del passo. */
  startMoves: string[];
  /** Mosse da giocare durante il passo (SAN), a partire da startMoves. */
  play: string[];
  quiz?: { question: string; options: QuizOption[] };
}

export interface Lesson {
  title: string;
  line?: string;
  steps: CourseStep[];
}

export interface Course {
  lessons: Lesson[];
}

export class CourseError extends Error {}

const COLORS: Record<string, string> = {
  G: 'rgba(21, 128, 61, 0.85)',
  R: 'rgba(200, 40, 40, 0.85)',
  Y: 'rgba(220, 160, 0, 0.85)',
  B: 'rgba(37, 99, 235, 0.85)',
};

function parseMoves(text: string): string[] {
  return text
    .split(/\s+/)
    .map((t) => t.replace(/^\d+\.+/, '').replace(/[!?]+$/, ''))
    .filter((t) => t && t !== '...' && !/^\d+\.*$/.test(t));
}

/** Gioca le mosse e restituisce i SAN canonici; errore leggibile se una è illegale. */
function playAll(startFen: string, before: string[], moves: string[], where: string): string[] {
  const chess = new Chess(startFen);
  for (const m of before) chess.move(m);
  return moves.map((m) => {
    try {
      return chess.move(m).san;
    } catch {
      throw new CourseError(`${where}: mossa illegale "${m}".`);
    }
  });
}

export function parseCourse(text: string, startFen = new Chess().fen()): Course {
  const lessons: Lesson[] = [];
  const blocks = text.replace(/\r/g, '').split(/^# /m).slice(1);
  if (blocks.length === 0) throw new CourseError('Nessuna lezione trovata (ogni lezione inizia con "# Titolo").');

  for (const [li, block] of blocks.entries()) {
    const [titleLine, ...rest] = block.split('\n');
    const lesson: Lesson = { title: titleLine.trim(), steps: [] };
    let body = rest.join('\n');
    const lineMatch = body.match(/^\s*line:\s*(.+)$/m);
    if (lineMatch && body.trimStart().startsWith('line:')) {
      lesson.line = lineMatch[1].trim();
      body = body.replace(lineMatch[0], '');
    }

    let position: string[] = [];
    for (const [si, raw] of body.split(/^---\s*$/m).entries()) {
      if (!raw.trim()) continue;
      const where = `Lezione ${li + 1} "${lesson.title}", passo ${si + 1}`;
      const step: CourseStep = { text: '', arrows: [], highlights: [], startMoves: position, play: [] };
      const textLines: string[] = [];
      let quiz: CourseStep['quiz'];

      for (const line of raw.split('\n')) {
        const m = line.match(/^(moves|play|arrows|marks|quiz):\s*(.*)$/i);
        if (m) {
          const [, key, value] = m;
          switch (key.toLowerCase()) {
            case 'moves':
              step.startMoves = playAll(startFen, [], parseMoves(value), where);
              break;
            case 'play':
              step.play = playAll(startFen, step.startMoves, parseMoves(value), where);
              break;
            case 'arrows':
              for (const a of value.split(',')) {
                const am = a.trim().match(/^([GRYB])([a-h][1-8])([a-h][1-8])$/);
                if (!am) throw new CourseError(`${where}: freccia non valida "${a.trim()}" (es. Gc7c5).`);
                step.arrows.push({ color: COLORS[am[1]], from: am[2], to: am[3] });
              }
              break;
            case 'marks':
              for (const a of value.split(',')) {
                const am = a.trim().match(/^([GRYB])([a-h][1-8])$/);
                if (!am) throw new CourseError(`${where}: casa non valida "${a.trim()}" (es. Rd4).`);
                step.highlights.push({ color: COLORS[am[1]], square: am[2] });
              }
              break;
            case 'quiz':
              quiz = { question: value.trim(), options: [] };
              break;
          }
          continue;
        }
        const opt = quiz && line.match(/^([*-])\s+(.+)$/);
        if (quiz && opt) {
          const [text, explain] = opt[2].split('|').map((s) => s.trim());
          quiz.options.push({ text, correct: opt[1] === '*', explain: explain || undefined });
          continue;
        }
        textLines.push(line);
      }

      if (quiz) {
        if (!quiz.options.some((o) => o.correct)) throw new CourseError(`${where}: il quiz non ha una risposta giusta (riga che inizia con "*").`);
        step.quiz = quiz;
      }
      step.text = textLines.join('\n').trim();
      position = [...step.startMoves, ...step.play];
      lesson.steps.push(step);
    }
    if (lesson.steps.length === 0) throw new CourseError(`Lezione ${li + 1} "${lesson.title}" senza passi.`);
    lessons.push(lesson);
  }
  return { lessons };
}
