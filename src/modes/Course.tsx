import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import type { Opening, OpeningNode } from '../model/types';
import type { Course as CourseData } from '../core/course';
import { findInBook, nextMoves } from '../core/tree';
import { load, save } from '../core/storage';
import { Board, sanOf } from '../components/Board';
import { RichText } from '../components/RichText';
import { WhyButton } from '../components/Explanation';
import { SOLUTION_ARROW } from '../core/training';

interface Props {
  opening: Opening & { course: CourseData };
  onDrillLine: (lineName?: string) => void;
}

interface CourseProgress {
  done: number[];
  lesson: number;
}

export function courseProgress(openingId: string): CourseProgress {
  return load<CourseProgress>(`course:${openingId}`, { done: [], lesson: 0 });
}

/** Mossa attesa come nodo del repertorio (per "Perché?"), o un nodo minimale se è fuori repertorio. */
function expectedNode(opening: Opening, fen: string, san: string): OpeningNode {
  const book = findInBook(opening.root, fen);
  const hit = book && nextMoves(book).find((c) => c.san === san);
  if (hit) return hit;
  const m = new Chess(fen).move(san);
  return {
    id: '', san: m.san, from: m.from, to: m.to, fen: '', ply: 0, isUserMove: true,
    keyIdeas: [], arrows: [], highlights: [], children: [], parent: null,
  };
}

export function Course({ opening, onDrillLine }: Props) {
  const { lessons } = opening.course;
  const [progress, setProgress] = useState<CourseProgress>(() => courseProgress(opening.id));
  const [lessonIdx, setLessonIdx] = useState(() => Math.min(progress.lesson, lessons.length - 1));
  const [stepIdx, setStepIdx] = useState(0);
  const [played, setPlayed] = useState(0);
  const [wrongSan, setWrongSan] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [quizPick, setQuizPick] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);

  const lesson = lessons[lessonIdx];
  const step = lesson.steps[stepIdx];
  const myColor = opening.color === 'white' ? 'w' : 'b';

  const fens = useMemo(() => {
    const chess = new Chess(opening.root.fen);
    step.startMoves.forEach((m) => chess.move(m));
    const out = [chess.fen()];
    for (const m of step.play) {
      chess.move(m);
      out.push(chess.fen());
    }
    return out;
  }, [step, opening.root.fen]);

  const fen = fens[played];
  const playing = played < step.play.length;
  const expected = playing ? step.play[played] : undefined;
  const myTurn = playing && fen.split(' ')[1] === myColor;
  const quizSolved = !step.quiz || (quizPick !== null && step.quiz.options[quizPick].correct);
  const complete = !playing && quizSolved;
  const isLastStep = stepIdx === lesson.steps.length - 1;

  const persist = (p: CourseProgress) => {
    setProgress(p);
    save(`course:${opening.id}`, p);
  };

  const goTo = (l: number, s = 0) => {
    setLessonIdx(l);
    setStepIdx(s);
    setPlayed(0);
    setWrongSan(null);
    setDemo(false);
    setQuizPick(null);
    setFinished(false);
    if (l !== progress.lesson) persist({ ...progress, lesson: l });
  };

  // Mosse automatiche: quelle dell'avversario, oppure tutte in modalità "Mostrami".
  useEffect(() => {
    if (!playing || (myTurn && !demo)) return;
    const t = setTimeout(() => {
      setPlayed((p) => p + 1);
      setWrongSan(null);
    }, demo ? 700 : 550);
    return () => clearTimeout(t);
  }, [playing, myTurn, demo, played]);

  const onMove = (from: string, to: string) => {
    if (!myTurn || demo) return false;
    const san = sanOf(fen, from, to);
    if (!san) return false;
    if (san === expected) {
      setPlayed((p) => p + 1);
      setWrongSan(null);
      return true;
    }
    setWrongSan(san);
    return false;
  };

  const next = () => {
    if (!isLastStep) return goTo(lessonIdx, stepIdx + 1);
    if (!progress.done.includes(lessonIdx)) persist({ ...progress, done: [...progress.done, lessonIdx] });
    setFinished(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && complete && !finished) next();
      else if (e.key === 'ArrowLeft' && stepIdx > 0) goTo(lessonIdx, stepIdx - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const lastMove = played > 0 ? new Chess(fens[played - 1]).move(step.play[played - 1]) : undefined;
  const arrows = wrongSan && expected
    ? (() => {
        const m = new Chess(fen).move(expected);
        return [{ from: m.from, to: m.to, color: SOLUTION_ARROW }];
      })()
    : playing ? [] : step.arrows;

  return (
    <div className="layout three">
      <nav className="line-tree lessons">
        <h3>Lezioni · {progress.done.length}/{lessons.length}</h3>
        {lessons.map((l, i) => (
          <button key={i} className={`line-item ${i === lessonIdx ? 'on-path' : ''}`} onClick={() => goTo(i)}>
            <span className="lesson-check">{progress.done.includes(i) ? '✓' : `${i + 1}.`}</span> {l.title}
          </button>
        ))}
      </nav>

      <div className="board-col">
        <Board
          fen={fen}
          orientation={opening.color}
          onMove={onMove}
          arrows={arrows}
          highlights={playing ? [] : step.highlights}
          lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : undefined}
        />
      </div>

      <div className="side">
        {finished ? (
          <div className="lesson-done">
            <h2>✓ Lezione completata</h2>
            <p>{lesson.title}</p>
            <div className="actions">
              {lessonIdx < lessons.length - 1 && (
                <button className="primary" onClick={() => goTo(lessonIdx + 1)}>
                  Prossima lezione →
                </button>
              )}
              <button onClick={() => onDrillLine(lesson.line)}>♟ Allenati su questa linea</button>
              <button onClick={() => goTo(lessonIdx)}>↻ Rifai la lezione</button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <div className="lesson-title">{lesson.title}</div>
              <div className="step-progress">
                <div className="bar" style={{ width: `${((stepIdx + (complete ? 1 : 0)) / lesson.steps.length) * 100}%` }} />
              </div>
              <div className="muted small">Passo {stepIdx + 1} di {lesson.steps.length}</div>
            </div>

            {step.text && <RichText text={step.text} />}

            {step.play.length > 0 && (
              <div className={`feedback ${wrongSan ? 'wrong' : playing ? 'info' : 'ok'}`}>
                {wrongSan
                  ? `✗ ${wrongSan} non è la mossa giusta. La freccia verde ti mostra quella corretta: giocala.`
                  : playing
                    ? myTurn
                      ? `Tocca a te: gioca la mossa ${opening.color === 'white' ? 'del Bianco' : 'del Nero'}.`
                      : 'Il tuo avversario sta muovendo…'
                    : '✓ Ben fatto!'}
              </div>
            )}
            {wrongSan && expected && <WhyButton fen={fen} san={wrongSan} expected={[expectedNode(opening, fen, expected)]} />}

            {step.quiz && (
              <div className="quiz">
                <div className="quiz-q">{step.quiz.question}</div>
                {step.quiz.options.map((o, i) => (
                  <button
                    key={i}
                    className={`quiz-opt ${quizPick === i ? (o.correct ? 'right' : 'wrong') : ''}`}
                    onClick={() => !quizSolved && setQuizPick(i)}
                  >
                    {o.text}
                  </button>
                ))}
                {quizPick !== null && step.quiz.options[quizPick].explain && (
                  <div className={`feedback ${step.quiz.options[quizPick].correct ? 'ok' : 'wrong'}`}>
                    {step.quiz.options[quizPick].explain}
                    {!step.quiz.options[quizPick].correct && ' Riprova.'}
                  </div>
                )}
              </div>
            )}

            <div className="controls">
              <button onClick={() => goTo(lessonIdx, stepIdx - 1)} disabled={stepIdx === 0}>
                ◀ Indietro
              </button>
              {playing && myTurn && !demo && (
                <button onClick={() => setDemo(true)} title="Gioca le mosse al posto tuo">
                  👀 Mostrami
                </button>
              )}
              <button className="primary" onClick={next} disabled={!complete}>
                {isLastStep ? 'Completa la lezione ✓' : 'Avanti ▶'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
