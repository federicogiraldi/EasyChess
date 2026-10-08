import { describe, expect, it } from 'vitest';
import { CourseError, parseCourse } from './course';

const COURSE = `# Prima lezione
line: Avanzata

Testo iniziale.
moves: 1. e4 c6
arrows: Gd7d5

---
play: 2. d4 d5

---
quiz: Domanda?
- sbagliata | perché no
* giusta | perché sì

# Seconda
moves: 1. e4 c6 2. d4 d5 3. e5
play: 3... Bf5
`;

describe('parseCourse', () => {
  const course = parseCourse(COURSE);

  it('divide lezioni e passi', () => {
    expect(course.lessons.map((l) => l.title)).toEqual(['Prima lezione', 'Seconda']);
    expect(course.lessons[0].line).toBe('Avanzata');
    expect(course.lessons[0].steps).toHaveLength(3);
  });

  it('concatena le posizioni tra i passi', () => {
    const [s1, s2, s3] = course.lessons[0].steps;
    expect(s1.startMoves).toEqual(['e4', 'c6']);
    expect(s2.startMoves).toEqual(['e4', 'c6']);
    expect(s2.play).toEqual(['d4', 'd5']);
    expect(s3.startMoves).toEqual(['e4', 'c6', 'd4', 'd5']);
  });

  it('legge quiz, frecce e testo', () => {
    const [s1, , s3] = course.lessons[0].steps;
    expect(s1.text).toBe('Testo iniziale.');
    expect(s1.arrows).toHaveLength(1);
    expect(s3.quiz?.options).toEqual([
      { text: 'sbagliata', correct: false, explain: 'perché no' },
      { text: 'giusta', correct: true, explain: 'perché sì' },
    ]);
  });

  it('segnala mosse illegali con lezione e passo', () => {
    expect(() => parseCourse('# L\nplay: 1. e5')).toThrow(CourseError);
    expect(() => parseCourse('# L\n\n---\nmoves: 1. e4 e5 2. Ke3')).toThrow(/Lezione 1 "L", passo 2: mossa illegale "Ke3"/);
  });
});
