import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Chess } from 'chess.js';
import { MATE_LESSONS, type MateStep } from '../core/mateCourse';
import { bestMove, defend, distance, movesToMate, randomStart, solve, type Piece } from '../core/endgame';
import { load, save } from '../core/storage';
import { Board } from '../components/Board';
import { RichText } from '../components/RichText';
import { SOLUTION_ARROW } from '../core/training';
import './mates.css';

interface Progress {
  done: string[];
  lesson: number;
}

const PIECE_NAME: Record<Piece, string> = { q: 'la Donna', r: 'la Torre' };
const PIECE_CAP: Record<Piece, string> = { q: 'La Donna', r: 'La Torre' };
const STALEMATE_MARK = 'rgba(250, 204, 21, 0.75)';
const WRONG_MARK = 'rgba(220, 38, 38, 0.55)';
const MATE_MARK = 'rgba(21, 128, 61, 0.6)';
/** Regola delle 50 mosse: senza catture né pedoni la partita è patta. */
const MOVE_LIMIT = 50;

type Feedback = { kind: 'info' | 'ok' | 'wrong' | 'done'; text: string };

interface Ply {
  fen: string;
  from?: string;
  to?: string;
}

const kingSquare = (c: Chess, color: 'w' | 'b') =>
  c.board().flat().find((p) => p && p.type === 'k' && p.color === color)?.square;

function pieceOn(fen: string): Piece {
  return /Q/.test(fen.split(' ')[0]) ? 'q' : 'r';
}

/** Perché la mossa (già giocata in `c`, tocca al Nero) non è matto. */
function whyNotMate(c: Chess, piece: Piece): string {
  if (c.isStalemate())
    return '😱 **Stallo!** Il Re nero non è sotto scacco ma non ha nessuna mossa: la partita sarebbe **patta**. Lasciagli sempre una casa libera, finché non puoi dare matto.';
  const moves = c.moves({ verbose: true });
  const capture = moves.find((m) => m.captured);
  if (capture)
    return `✗ ${PIECE_CAP[piece]} non è protetta: il Re nero la mangia in ${capture.to} e resta solo il tuo Re. Patta! Tieni il pezzo vicino al tuo Re o lontano dal Re nemico.`;
  const escapes = [...new Set(moves.map((m) => m.to))].join(', ');
  if (!c.inCheck()) return `✗ Non è scacco, quindi non può essere matto: il Re nero può ancora andare in ${escapes}.`;
  return `✗ È scacco, ma non matto: il Re nero scappa in ${escapes}.`;
}

export function MateCourse() {
  const [progress, setProgress] = useState<Progress>(() => load('mates:progress', { done: [], lesson: 0 }));
  const [lessonIdx, setLessonIdx] = useState(() => Math.min(progress.lesson, MATE_LESSONS.length - 1));
  const [stepIdx, setStepIdx] = useState(0);
  const [finished, setFinished] = useState(false);
  /** Cambia per ripartire da capo nello stesso passo (nuova posizione casuale). */
  const [round, setRound] = useState(0);

  const lesson = MATE_LESSONS[lessonIdx];
  const step = lesson.steps[stepIdx];
  const isLastStep = stepIdx === lesson.steps.length - 1;

  // Prepara le tabelle del finale mentre leggi (la prima volta servono pochi decimi di secondo).
  useEffect(() => {
    const piece = lesson.piece ?? lesson.steps.find((s) => s.kind === 'play')?.piece;
    if (!piece) return;
    const t = setTimeout(() => solve(piece), 60);
    return () => clearTimeout(t);
  }, [lesson]);

  const persist = (p: Progress) => {
    setProgress(p);
    save('mates:progress', p);
  };

  const goTo = (l: number, s = 0) => {
    setLessonIdx(l);
    setStepIdx(s);
    if (l !== lessonIdx) window.scrollTo({ top: 0 });
    setFinished(false);
    setRound((r) => r + 1);
    if (l !== progress.lesson) persist({ ...progress, lesson: l });
  };

  const next = () => {
    if (!isLastStep) return goTo(lessonIdx, stepIdx + 1);
    if (!progress.done.includes(lesson.id)) persist({ ...progress, done: [...progress.done, lesson.id] });
    setFinished(true);
  };

  return (
    <div className="layout three mates">
      <nav className="line-tree lessons">
        <h3>
          Come dare matto · {MATE_LESSONS.filter((l) => progress.done.includes(l.id)).length}/{MATE_LESSONS.length}
        </h3>
        {MATE_LESSONS.map((l, i) => (
          <button key={l.id} className={`line-item ${i === lessonIdx ? 'on-path' : ''}`} onClick={() => goTo(i)}>
            <span className="lesson-check">{progress.done.includes(l.id) ? '✓' : `${i + 1}.`}</span>{' '}
            {l.piece === 'q' ? '♕ ' : l.piece === 'r' ? '♖ ' : ''}
            {l.title}
          </button>
        ))}
      </nav>

      <StepView
        key={`${lessonIdx}-${stepIdx}-${round}`}
        step={step}
        header={
          <div>
            <div className="lesson-title">{lesson.title}</div>
            <div className="step-progress">
              <div className="bar" style={{ width: `${(stepIdx / lesson.steps.length) * 100}%` }} />
            </div>
            <div className="muted small">
              Passo {stepIdx + 1} di {lesson.steps.length}
            </div>
          </div>
        }
        finished={
          finished ? (
            <div className="lesson-done">
              <h2>✓ Lezione completata</h2>
              <p>{lesson.title}</p>
              <div className="actions">
                {lessonIdx < MATE_LESSONS.length - 1 && (
                  <button className="primary" onClick={() => goTo(lessonIdx + 1)}>
                    Prossima lezione →
                  </button>
                )}
                <button onClick={() => goTo(lessonIdx)}>↻ Rifai la lezione</button>
              </div>
            </div>
          ) : null
        }
        canBack={stepIdx > 0}
        onBack={() => goTo(lessonIdx, stepIdx - 1)}
        onNext={next}
        nextLabel={isLastStep ? 'Completa la lezione ✓' : 'Avanti ▶'}
        onRestart={() => setRound((r) => r + 1)}
      />
    </div>
  );
}

interface StepProps {
  step: MateStep;
  header: ReactNode;
  finished: ReactNode;
  canBack: boolean;
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  onRestart: () => void;
}

function StepView(props: StepProps) {
  const { step } = props;
  if (step.kind === 'play') return <PlayStep {...props} step={step} />;
  if (step.kind === 'mate1') return <Mate1Step {...props} step={step} />;
  if (step.kind === 'quiz') return <QuizStep {...props} step={step} />;
  return (
    <Shell {...props} complete board={<Board fen={step.fen} orientation="white" arrows={step.arrows} highlights={step.highlights} />}>
      <RichText text={step.text} />
    </Shell>
  );
}

/** Scacchiera + colonna laterale con intestazione, testo e pulsanti Indietro/Avanti. */
function Shell({
  header, finished, canBack, onBack, onNext, nextLabel, complete, board, children, extraControls,
}: StepProps & { complete: boolean; board: ReactNode; children: ReactNode; extraControls?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && complete && !finished) onNext();
      else if (e.key === 'ArrowLeft' && canBack && !finished) onBack();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <>
      <div className="board-col">{board}</div>
      <div className="side">
        {finished ?? (
          <>
            {header}
            {children}
            <div className="controls">
              <button onClick={onBack} disabled={!canBack}>
                ◀ Indietro
              </button>
              {extraControls}
              <button className="primary" onClick={onNext} disabled={!complete}>
                {nextLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function QuizStep(props: StepProps & { step: Extract<MateStep, { kind: 'quiz' }> }) {
  const { step } = props;
  const [pick, setPick] = useState<number | null>(null);
  const solved = pick !== null && !!step.options[pick].correct;
  const c = new Chess(step.fen);
  const k = kingSquare(c, c.turn());
  return (
    <Shell
      {...props}
      complete={solved}
      board={
        <Board
          fen={step.fen}
          orientation="white"
          arrows={step.arrows}
          marks={solved && k ? { [k]: c.isCheckmate() ? MATE_MARK : c.isStalemate() ? STALEMATE_MARK : 'rgba(37, 99, 235, 0.35)' } : undefined}
        />
      }
    >
      <RichText text={step.text} />
      <div className="quiz">
        <div className="quiz-q">{step.question}</div>
        {step.options.map((o, i) => (
          <button
            key={i}
            className={`quiz-opt ${pick === i ? (o.correct ? 'right' : 'wrong') : ''}`}
            onClick={() => !solved && setPick(i)}
          >
            {o.text}
          </button>
        ))}
        {pick !== null && (
          <div className={`feedback ${step.options[pick].correct ? 'ok' : 'wrong'}`}>
            {step.options[pick].explain}
            {!step.options[pick].correct && ' Riprova.'}
          </div>
        )}
      </div>
    </Shell>
  );
}

function Mate1Step(props: StepProps & { step: Extract<MateStep, { kind: 'mate1' }> }) {
  const { step } = props;
  const piece = pieceOn(step.fen);
  const [after, setAfter] = useState<Ply | null>(null);
  const [tries, setTries] = useState(0);
  const [hint, setHint] = useState(false);

  const result = useMemo(() => {
    if (!after) return null;
    const c = new Chess(after.fen);
    return { mate: c.isCheckmate(), stalemate: c.isStalemate(), text: c.isCheckmate() ? '' : whyNotMate(c, piece), king: kingSquare(c, 'b') };
  }, [after, piece]);

  const solution = useMemo(() => {
    const c = new Chess(step.fen);
    return c.moves({ verbose: true }).find((m) => {
      const d = new Chess(step.fen);
      d.move(m.san);
      return d.isCheckmate();
    });
  }, [step.fen]);

  const onMove = (from: string, to: string) => {
    if (after) return false;
    const c = new Chess(step.fen);
    try {
      c.move({ from, to, promotion: 'q' });
    } catch {
      return false;
    }
    setAfter({ fen: c.fen(), from, to });
    if (!c.isCheckmate()) setTries((t) => t + 1);
    return true;
  };

  const solved = !!result?.mate;
  const marks: Record<string, string> = {};
  if (result?.king) marks[result.king] = result.mate ? MATE_MARK : result.stalemate ? STALEMATE_MARK : WRONG_MARK;
  const showSolution = !after && (hint || tries >= 2) && solution;

  return (
    <Shell
      {...props}
      complete={solved}
      board={
        <Board
          fen={after?.fen ?? step.fen}
          orientation="white"
          onMove={after ? undefined : onMove}
          lastMove={after?.from ? { from: after.from, to: after.to! } : undefined}
          marks={marks}
          arrows={showSolution ? [{ from: solution.from, to: solution.to, color: SOLUTION_ARROW }] : []}
        />
      }
      extraControls={
        after && !solved ? (
          <button className="primary" onClick={() => setAfter(null)}>
            ↻ Riprova
          </button>
        ) : !after && !hint ? (
          <button onClick={() => setHint(true)}>💡 Aiuto</button>
        ) : null
      }
    >
      <RichText text={step.text} />
      {result ? (
        <div className={`feedback ${result.mate ? 'done' : 'wrong'}`}>
          {result.mate ? '✓ Scacco matto! Ben fatto.' : <RichText text={result.text} />}
        </div>
      ) : (
        <div className="feedback info">
          {showSolution ? 'La freccia verde ti mostra la mossa del matto: giocala.' : 'Tocca a te (Bianco): trova il matto.'}
        </div>
      )}
    </Shell>
  );
}

function PlayStep(props: StepProps & { step: Extract<MateStep, { kind: 'play' }> }) {
  const { step, onRestart } = props;
  const { piece } = step;
  const startFen = useMemo(() => step.fen ?? randomStart(piece, step.min ?? 5, step.max ?? 10), [step, piece]);
  const optimal = useMemo(() => movesToMate(distance(startFen, piece) ?? 0), [startFen, piece]);

  const [plies, setPlies] = useState<Ply[]>([{ fen: startFen }]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [over, setOver] = useState<'mate' | 'draw' | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [hints, setHints] = useState(0);

  const cur = plies[plies.length - 1];
  const whiteToMove = cur.fen.split(' ')[1] === 'w';
  const myMoves = Math.floor(plies.length / 2);
  const toMate = whiteToMove && !over ? distance(cur.fen, piece) : null;

  // Risposta del Re nero (o cattura del pezzo lasciato indifeso).
  useEffect(() => {
    if (whiteToMove || over === 'mate') return;
    const t = setTimeout(() => {
      const uci = defend(cur.fen, piece);
      if (!uci) return;
      const c = new Chess(cur.fen);
      const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
      setPlies((p) => [...p, { fen: c.fen(), from: m.from, to: m.to }]);
    }, over ? 900 : 450);
    return () => clearTimeout(t);
  }, [cur, whiteToMove, over, piece]);

  const onMove = (from: string, to: string) => {
    if (over || !whiteToMove) return false;
    const before = cur.fen;
    const c = new Chess(before);
    try {
      c.move({ from, to, promotion: 'q' });
    } catch {
      return false;
    }
    setHint(null);
    setPlies((p) => [...p, { fen: c.fen(), from, to }]);
    const moves = myMoves + 1;
    if (c.isCheckmate()) {
      setOver('mate');
      const extra = moves - optimal;
      const stars = hints > 0 ? (extra <= 3 ? 2 : 1) : extra <= 0 ? 3 : extra <= 5 ? 2 : 1;
      setFeedback({
        kind: 'done',
        text: `${'⭐'.repeat(stars)} Scacco matto in ${moves} mosse! ${
          extra <= 0 ? 'Perfetto: il più veloce possibile.' : `Il matto più veloce era in ${optimal}.`
        }${hints ? ` (Hai usato ${hints} suggeriment${hints === 1 ? 'o' : 'i'}.)` : ''}`,
      });
      return true;
    }
    const d1 = distance(c.fen(), piece);
    if (d1 === null) {
      setOver('draw');
      setFeedback({ kind: 'wrong', text: whyNotMate(c, piece) });
      return true;
    }
    if (moves >= MOVE_LIMIT) {
      setOver('draw');
      setFeedback({ kind: 'wrong', text: `Hai fatto ${MOVE_LIMIT} mosse senza dare matto: per la regola delle 50 mosse è patta. Usa il metodo della scatola e riprova!` });
      return true;
    }
    const d0 = distance(before, piece) ?? 0;
    if (d1 === d0 - 1) setFeedback({ kind: 'ok', text: '✓ Ottima mossa: il matto si avvicina.' });
    else if (movesToMate(d1 + 1) > movesToMate(d0))
      setFeedback({ kind: 'info', text: `Va bene, ma c'era una mossa più veloce: il matto si è allontanato di ${movesToMate(d1 + 1) - movesToMate(d0)}.` });
    else setFeedback({ kind: 'ok', text: '✓ Buona mossa.' });
    return true;
  };

  /** Torna all'ultima posizione col Bianco a muovere prima della tua ultima mossa. */
  const undo = () => {
    setPlies((p) => {
      let n = p.length - 1;
      while (n > 0 && p[n].fen.split(' ')[1] !== 'b') n--;
      return n > 0 ? p.slice(0, n) : p.slice(0, 1);
    });
    setOver(null);
    setFeedback(null);
    setHint(null);
  };

  const askHint = () => {
    const m = bestMove(cur.fen, piece);
    if (!m) return;
    setHint(m);
    setHints((h) => h + 1);
  };

  const c = new Chess(cur.fen);
  const marks: Record<string, string> = {};
  const bk = kingSquare(c, 'b');
  if (over === 'mate' && bk) marks[bk] = MATE_MARK;
  if (over === 'draw' && c.isStalemate() && bk) marks[bk] = STALEMATE_MARK;

  let status: Feedback;
  if (feedback && (over || whiteToMove)) status = feedback;
  else if (!whiteToMove) status = { kind: feedback?.kind ?? 'info', text: feedback ? `${feedback.text} Il Re nero risponde…` : 'Il Re nero risponde…' };
  else status = { kind: 'info', text: `Tocca a te: dai matto con ${PIECE_NAME[piece]}.` };

  return (
    <Shell
      {...props}
      complete={over === 'mate'}
      board={
        <Board
          fen={cur.fen}
          orientation="white"
          onMove={over ? undefined : onMove}
          premoveColor={over ? undefined : 'white'}
          lastMove={cur.from ? { from: cur.from, to: cur.to! } : undefined}
          marks={marks}
          arrows={hint ? [{ from: hint.slice(0, 2), to: hint.slice(2, 4), color: SOLUTION_ARROW }] : []}
        />
      }
      extraControls={
        <>
          {over !== 'mate' && (
            <button onClick={undo} disabled={plies.length < 2}>
              ↶ Annulla
            </button>
          )}
          {!over && (
            <button onClick={askHint} disabled={!whiteToMove || !!hint}>
              💡 Suggerimento
            </button>
          )}
          <button onClick={onRestart}>{step.fen ? '↻ Ricomincia' : '🎲 Nuova posizione'}</button>
        </>
      }
    >
      <RichText text={step.text} />
      <div className="mate-counter">
        <div>
          <div className="muted small">Le tue mosse</div>
          <div className="big">
            {myMoves}
            <span className="muted small"> / {MOVE_LIMIT}</span>
          </div>
        </div>
        <div>
          <div className="muted small">Matto perfetto in</div>
          <div className="big">{over === 'mate' ? '✓' : toMate !== null ? movesToMate(toMate) : '–'}</div>
        </div>
      </div>
      <div className={`feedback ${status.kind}`}>
        <RichText text={status.text} />
      </div>
      {over === 'draw' && (
        <button className="primary" onClick={undo}>
          ↶ Riprova la mossa
        </button>
      )}
    </Shell>
  );
}
