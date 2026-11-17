import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { Chess } from 'chess.js';
import { MATE_COURSE, type MateCourseDef, type MateStep } from '../core/mateCourse';
import { ENDGAME_COURSE } from '../core/endgameCourse';
import { kpkBestMove, probeKpk, solveKpk } from '../core/kpk';
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

/** Sezione Finali: il corso sui matti e quello sui finali di pedoni e torri. */
export function Endgames() {
  const [tab, setTab] = useState<string>(() => load('endgames:tab', MATE_COURSE.id));
  const courses = [MATE_COURSE, ENDGAME_COURSE];
  const course = courses.find((c) => c.id === tab) ?? MATE_COURSE;
  return (
    <div className="endgames">
      <div className="segmented course-switch" role="tablist" aria-label="Corso">
        {courses.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={c.id === course.id}
            className={c.id === course.id ? 'active' : ''}
            onClick={() => {
              setTab(c.id);
              save('endgames:tab', c.id);
            }}
          >
            <Icon name={c.id === 'mates' ? 'king' : 'drill'} /> {c.title}
          </button>
        ))}
      </div>
      <MateCourse key={course.id} course={course} />
    </div>
  );
}

export function MateCourse({ course }: { course: MateCourseDef }) {
  const MATE_LESSONS = course.lessons;
  const [progress, setProgress] = useState<Progress>(() => load(course.storageKey, { done: [], lesson: 0 }));
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
    if (lesson.steps.some((s) => s.kind === 'kpk')) {
      const t = setTimeout(() => solveKpk(), 60);
      return () => clearTimeout(t);
    }
    const piece = lesson.piece ?? lesson.steps.find((s) => s.kind === 'play')?.piece;
    if (!piece) return;
    const t = setTimeout(() => solve(piece), 60);
    return () => clearTimeout(t);
  }, [lesson]);

  const persist = (p: Progress) => {
    setProgress(p);
    save(course.storageKey, p);
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
          {course.title} · {MATE_LESSONS.filter((l) => progress.done.includes(l.id)).length}/{MATE_LESSONS.length}
        </h3>
        {MATE_LESSONS.map((l, i) => (
          <button key={l.id} className={`line-item ${i === lessonIdx ? 'on-path' : ''}`} onClick={() => goTo(i)}>
            <span className="lesson-check">{progress.done.includes(l.id) ? <Icon name="check" /> : `${i + 1}.`}</span>{' '}
            {l.icon ? <><Icon name={l.icon === 'pawn' ? 'drill' : l.icon} />{' '}</> : l.piece === 'q' ? <><Icon name="queen" />{' '}</> : l.piece === 'r' ? <><Icon name="rook" />{' '}</> : null}
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
              <h2><Icon name="check" /> Lezione completata</h2>
              <p>{lesson.title}</p>
              <div className="actions">
                {lessonIdx < MATE_LESSONS.length - 1 && (
                  <button className="primary" onClick={() => goTo(lessonIdx + 1)}>
                    Prossima lezione <Icon name="arrowRight" />
                  </button>
                )}
                <button onClick={() => goTo(lessonIdx)}><Icon name="restart" /> Rifai la lezione</button>
              </div>
            </div>
          ) : null
        }
        canBack={stepIdx > 0}
        onBack={() => goTo(lessonIdx, stepIdx - 1)}
        onNext={next}
        nextLabel={isLastStep ? <>Completa la lezione <Icon name="check" /></> : <>Avanti <Icon name="next" /></>}
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
  nextLabel: ReactNode;
  onRestart: () => void;
}

function StepView(props: StepProps) {
  const { step } = props;
  if (step.kind === 'play') return <PlayStep {...props} step={step} />;
  if (step.kind === 'mate1') return <Mate1Step {...props} step={step} />;
  if (step.kind === 'quiz') return <QuizStep {...props} step={step} />;
  if (step.kind === 'kpk') return <KpkStep {...props} step={step} />;
  if (step.kind === 'line') return <LineStep {...props} step={step} />;
  return (
    <Shell {...props} complete board={<Board fen={step.fen} orientation={step.orientation ?? 'white'} arrows={step.arrows} highlights={step.highlights} />}>
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
                <Icon name="prev" /> Indietro
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
          orientation={step.orientation ?? 'white'}
          arrows={step.arrows}
          highlights={step.highlights}
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
            <Icon name="restart" /> Riprova
          </button>
        ) : !after && !hint ? (
          <button onClick={() => setHint(true)}><Icon name="hint" /> Aiuto</button>
        ) : null
      }
    >
      <RichText text={step.text} />
      {result ? (
        <div className={`feedback ${result.mate ? 'done' : 'wrong'}`}>
          {result.mate ? <><Icon name="check" /> Scacco matto! Ben fatto.</> : <RichText text={result.text} />}
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
              <Icon name="undo" /> Annulla
            </button>
          )}
          {!over && (
            <button onClick={askHint} disabled={!whiteToMove || !!hint}>
              <Icon name="hint" /> Suggerimento
            </button>
          )}
          <button onClick={onRestart}>{step.fen ? <><Icon name="restart" /> Ricomincia</> : <><Icon name="dice" /> Nuova posizione</>}</button>
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
          <div className="big">{over === 'mate' ? <Icon name="check" /> : toMate !== null ? movesToMate(toMate) : '–'}</div>
        </div>
      </div>
      <div className={`feedback ${status.kind}`}>
        <RichText text={status.text} />
      </div>
      {over === 'draw' && (
        <button className="primary" onClick={undo}>
          <Icon name="undo" /> Riprova la mossa
        </button>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Re + pedone contro Re, contro la tabella esatta

const hasPawn = (fen: string) => /P/.test(fen.split(' ')[0]);
const promoted = (fen: string) => /[QR]/.test(fen.split(' ')[0]);

function KpkStep(props: StepProps & { step: Extract<MateStep, { kind: 'kpk' }> }) {
  const { step, onRestart } = props;
  const user = step.goal === 'win' ? 'w' : 'b';
  const orientation = user === 'w' ? 'white' : 'black';
  const [plies, setPlies] = useState<Ply[]>([{ fen: step.fen }]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [over, setOver] = useState<'won' | 'lost' | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const cur = plies[plies.length - 1];
  const turn = cur.fen.split(' ')[1];
  const myTurn = turn === user;
  const myMoves = plies.slice(1).filter((_, i) => plies[i].fen.split(' ')[1] === user).length;
  const left = step.moves ? Math.max(0, step.moves - myMoves) : null;
  const probe = useMemo(() => probeKpk(cur.fen), [cur.fen]);

  /** Dopo ogni semimossa: la prova è finita? */
  const finished = (fen: string, moves: number): Feedback | null => {
    const c = new Chess(fen);
    if (step.goal === 'win' && promoted(fen))
      return { kind: 'done', text: '✓ Promozione! Ora con la Donna il matto è questione di tecnica: finale vinto.' };
    if (step.goal === 'draw') {
      if (!hasPawn(fen) && !promoted(fen)) return { kind: 'done', text: '✓ Il pedone è caduto: è patta. Ben difeso!' };
      if (c.isStalemate()) return { kind: 'done', text: '✓ Stallo: è patta. Ben difeso!' };
      if (step.moves && moves >= step.moves && probeKpk(fen)?.result === 'draw')
        return { kind: 'done', text: `✓ Hai resistito ${step.moves} mosse senza sbagliare: con questa difesa è patta.` };
    }
    return null;
  };

  // Risposta dell'avversario, che gioca perfettamente.
  useEffect(() => {
    if (myTurn || over) return;
    const t = setTimeout(() => {
      const uci = kpkBestMove(cur.fen);
      if (!uci) return;
      const c = new Chess(cur.fen);
      const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      setPlies((p) => [...p, { fen: c.fen(), from: m.from, to: m.to }]);
      const end = finished(c.fen(), myMoves);
      if (end) {
        setOver('won');
        setFeedback(end);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [cur, myTurn, over]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMove = (from: string, to: string) => {
    if (over || !myTurn) return false;
    const c = new Chess(cur.fen);
    try {
      c.move({ from, to, promotion: 'q' });
    } catch {
      return false;
    }
    setHint(null);
    setPlies((p) => [...p, { fen: c.fen(), from, to }]);
    const moves = myMoves + 1;
    const end = finished(c.fen(), moves);
    if (end) {
      setOver('won');
      setFeedback(end);
      return true;
    }
    const after = probeKpk(c.fen());
    const ok = step.goal === 'win' ? after?.result === 'win' : after?.result === 'draw';
    if (!ok) {
      setOver('lost');
      setFeedback({
        kind: 'wrong',
        text:
          step.goal === 'win'
            ? "✗ Con questa mossa la vittoria sfuma: ora il Nero può pattare. Torna indietro e riprova: **prima il Re**, e quando i Re si fronteggiano fai muovere il Nero."
            : '✗ Questa mossa perde: ora il Bianco vince con il gioco perfetto. Torna indietro e tieni il Re **davanti al pedone**, prendendo l\'opposizione.',
      });
      return true;
    }
    setFeedback({ kind: 'ok', text: step.goal === 'win' ? '✓ Buona mossa: la posizione resta vinta.' : '✓ Bene: è ancora patta.' });
    return true;
  };

  /** Torna all'ultima posizione in cui toccava a te, prima della tua ultima mossa. */
  const undo = () => {
    setPlies((p) => {
      for (let k = p.length - 2; k >= 0; k--) if (p[k].fen.split(' ')[1] === user) return p.slice(0, k + 1);
      return p.slice(0, 1);
    });
    setOver(null);
    setFeedback(null);
    setHint(null);
  };

  const status: Feedback =
    feedback && (over || myTurn)
      ? feedback
      : !myTurn
        ? { kind: 'info', text: step.goal === 'win' ? 'Il Re nero risponde…' : 'Il Bianco muove…' }
        : { kind: 'info', text: step.goal === 'win' ? 'Tocca a te (Bianco): vinci e promuovi.' : 'Tocca a te (Nero): non perdere.' };

  return (
    <Shell
      {...props}
      complete={over === 'won'}
      board={
        <Board
          fen={cur.fen}
          orientation={orientation}
          onMove={over ? undefined : onMove}
          premoveColor={over ? undefined : orientation}
          lastMove={cur.from ? { from: cur.from, to: cur.to! } : undefined}
          arrows={hint ? [{ from: hint.slice(0, 2), to: hint.slice(2, 4), color: SOLUTION_ARROW }] : []}
        />
      }
      extraControls={
        <>
          {over !== 'won' && (
            <button onClick={undo} disabled={myMoves === 0}>
              <Icon name="undo" /> Annulla
            </button>
          )}
          {!over && (
            <button onClick={() => setHint(kpkBestMove(cur.fen))} disabled={!myTurn || !!hint}>
              <Icon name="hint" /> Suggerimento
            </button>
          )}
          <button onClick={onRestart}><Icon name="restart" /> Ricomincia</button>
        </>
      }
    >
      <RichText text={step.text} />
      <div className="mate-counter">
        <div>
          <div className="muted small">Le tue mosse</div>
          <div className="big">{myMoves}</div>
        </div>
        <div>
          <div className="muted small">{step.goal === 'win' ? 'Promozione perfetta in' : left !== null ? 'Mosse da resistere' : 'Risultato'}</div>
          <div className="big">
            {over === 'won' ? (
              <Icon name="check" />
            ) : step.goal === 'win' ? (
              probe?.result === 'win' ? Math.ceil(probe.plies / 2) : '–'
            ) : left !== null ? (
              left
            ) : (
              'patta'
            )}
          </div>
        </div>
      </div>
      <div className={`feedback ${status.kind}`}>
        <RichText text={status.text} />
      </div>
      {over === 'lost' && (
        <button className="primary" onClick={undo}>
          <Icon name="undo" /> Riprova la mossa
        </button>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Sequenza da giocare a memoria (finali di Torre)

function LineStep(props: StepProps & { step: Extract<MateStep, { kind: 'line' }> }) {
  const { step, onRestart } = props;
  const user = step.fen.split(' ')[1];
  const orientation = user === 'w' ? 'white' : 'black';
  const [plies, setPlies] = useState<Ply[]>([{ fen: step.fen }]);
  const [wrong, setWrong] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  const i = plies.length - 1;
  const cur = plies[i];
  const done = i >= step.moves.length;
  const myTurn = !done && cur.fen.split(' ')[1] === user;
  const expected = done ? [] : step.moves[i].split('|');
  const note = i > 0 ? step.notes?.[i - 1] : undefined;

  useEffect(() => {
    if (done || myTurn) return;
    const t = setTimeout(() => {
      const c = new Chess(cur.fen);
      const m = c.move(step.moves[i].split('|')[0]);
      setPlies((p) => [...p, { fen: c.fen(), from: m.from, to: m.to }]);
    }, 700);
    return () => clearTimeout(t);
  }, [cur, done, myTurn, i, step.moves]);

  const onMove = (from: string, to: string) => {
    if (!myTurn) return false;
    const c = new Chess(cur.fen);
    let san: string;
    try {
      san = c.move({ from, to, promotion: 'q' }).san;
    } catch {
      return false;
    }
    if (!expected.includes(san)) {
      setWrong(san);
      return false;
    }
    setWrong(null);
    setShow(false);
    setPlies((p) => [...p, { fen: c.fen(), from, to }]);
    return true;
  };

  const solution = useMemo(() => {
    if (!myTurn) return null;
    // la prima alternativa giocabile qui (alcune valgono solo su un altro percorso)
    for (const alt of expected) {
      try {
        const m = new Chess(cur.fen).move(alt);
        return { from: m.from, to: m.to };
      } catch {
        // prossima
      }
    }
    return null;
  }, [cur.fen, myTurn]); // eslint-disable-line react-hooks/exhaustive-deps

  const status: Feedback = done
    ? { kind: 'done', text: '✓ Sequenza completata!' }
    : wrong
      ? { kind: 'wrong', text: `✗ ${wrong} non è la mossa del piano. Rileggi il metodo, oppure guarda la freccia verde.` }
      : myTurn
        ? { kind: 'info', text: `Tocca a te (${user === 'w' ? 'Bianco' : 'Nero'}).` }
        : { kind: 'info', text: 'L\'avversario risponde…' };

  return (
    <Shell
      {...props}
      complete={done}
      board={
        <Board
          fen={cur.fen}
          orientation={orientation}
          onMove={done ? undefined : onMove}
          lastMove={cur.from ? { from: cur.from, to: cur.to! } : undefined}
          arrows={solution && (show || wrong) ? [{ ...solution, color: SOLUTION_ARROW }] : []}
        />
      }
      extraControls={
        <>
          {!done && (
            <button onClick={() => setShow(true)} disabled={!myTurn || show}>
              <Icon name="eye" /> Mostrami
            </button>
          )}
          <button onClick={onRestart}><Icon name="restart" /> Ricomincia</button>
        </>
      }
    >
      <RichText text={step.text} />
      {note && <p className="line-note">{note}</p>}
      <div className={`feedback ${status.kind}`}>
        <RichText text={status.text} />
      </div>
    </Shell>
  );
}
