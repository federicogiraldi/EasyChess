import { useEffect, useMemo, useState } from 'react';
import type { Opening, OpeningNode } from '../model/types';
import { cardPositions, lineNameOf, moveLabel, nextMoves, pathFromRoot, type CardPosition } from '../core/tree';
import { checkMove, gradePosition, solutionArrows } from '../core/training';
import { getCard } from '../core/progress';
import { isDue } from '../core/srs';
import { Board } from '../components/Board';
import { MoveList } from '../components/MoveList';
import { CommentPanel } from '../components/CommentPanel';
import { WhyButton } from '../components/Explanation';

const NEW_PER_SESSION = 10;

export function reviewQueue(opening: Opening, now = Date.now()): CardPosition[] {
  const all = cardPositions(opening);
  const due = all
    .filter((c) => isDue(getCard(c.key), now))
    .sort((a, b) => getCard(a.key)!.due - getCard(b.key)!.due);
  const fresh = all.filter((c) => !getCard(c.key)).slice(0, NEW_PER_SESSION);
  return [...due, ...fresh];
}

function randomCard(all: CardPosition[], avoid?: CardPosition): CardPosition {
  const pool = all.length > 1 ? all.filter((c) => c !== avoid) : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

type Phase = 'ask' | 'wrong' | 'solved';

interface Props {
  opening: Opening;
  mode: 'review' | 'quiz';
}

export function PositionTrainer({ opening, mode }: Props) {
  const [all] = useState(() => cardPositions(opening));
  const [queue, setQueue] = useState<CardPosition[]>(() => (mode === 'review' ? reviewQueue(opening) : [randomCard(all)]));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [answer, setAnswer] = useState<OpeningNode | null>(null);
  const [wrongSan, setWrongSan] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });

  const card = queue[index] as CardPosition | undefined;
  // Calcolato all'inizio della domanda: dopo la risposta la card non è più nuova.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const isNew = useMemo(() => !!card && !getCard(card.key), [index]);

  const advance = () => {
    if (mode === 'quiz') setQueue((q) => [...q, randomCard(all, card)]);
    setIndex((i) => i + 1);
    setPhase('ask');
    setAnswer(null);
    setWrongSan(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'solved' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!card) return <SessionEnd opening={opening} score={score} empty={queue.length === 0} />;

  const position = card.node;
  const onMove = (from: string, to: string) => {
    if (phase === 'solved') return false;
    const { san, match } = checkMove(position, from, to);
    if (!san) return false;
    if (match) {
      if (phase === 'ask') {
        gradePosition(opening, position, true);
        setScore((s) => ({ ...s, correct: s.correct + 1 }));
      }
      setAnswer(match);
      setPhase('solved');
      return true;
    }
    if (phase === 'ask') {
      gradePosition(opening, position, false);
      setScore((s) => ({ ...s, wrong: s.wrong + 1 }));
      // Nel ripasso, una posizione sbagliata torna in fondo alla coda.
      if (mode === 'review') setQueue((q) => [...q, card]);
    }
    setWrongSan(san);
    setPhase('wrong');
    return false;
  };

  const path = pathFromRoot(position);
  const shownPath = answer ? [...path, answer] : path;
  const shown = answer ?? position;
  const remaining = queue.length - index;
  const expected = nextMoves(position);

  return (
    <div className="layout two">
      <div className="board-col">
        <Board
          fen={shown.fen}
          orientation={opening.color}
          onMove={onMove}
          arrows={phase === 'wrong' ? solutionArrows(expected) : []}
          lastMove={shown.parent ? shown : undefined}
        />
      </div>
      <div className="side">
        <div className="stats-row">
          {mode === 'review' ? <span>Da fare: {remaining}</span> : <span>Quiz</span>}
          <span>✓ {score.correct}</span>
          <span>✗ {score.wrong}</span>
          {mode === 'review' && <span>{isNew ? 'Nuova' : 'Ripasso'}</span>}
        </div>
        <div className={`feedback ${phase === 'ask' ? 'info' : phase === 'wrong' ? 'wrong' : 'ok'}`}>
          {phase === 'ask' && 'Trova la mossa del tuo repertorio.'}
          {phase === 'wrong' && `✗ ${wrongSan} non è nel repertorio. Giusta: ${expected.map(moveLabel).join(' oppure ')} — giocala.`}
          {phase === 'solved' && `✓ ${moveLabel(answer!)}`}
        </div>
        {phase === 'wrong' && wrongSan && <WhyButton fen={position.fen} san={wrongSan} expected={expected} />}
        {phase === 'solved' && (
          <button className="primary" onClick={advance}>
            Avanti → <span className="muted small">(Invio)</span>
          </button>
        )}
        <MoveList path={shownPath} />
        <CommentPanel node={shown} lineName={lineNameOf(shownPath)} />
      </div>
    </div>
  );
}

function SessionEnd({ opening, score, empty }: { opening: Opening; score: { correct: number; wrong: number }; empty: boolean }) {
  const next = cardPositions(opening)
    .map((c) => getCard(c.key)?.due)
    .filter((d): d is number => d !== undefined)
    .sort((a, b) => a - b)[0];
  return (
    <div className="session-end">
      <h2>{empty ? 'Niente da ripassare adesso 🎉' : 'Sessione completata!'}</h2>
      {!empty && (
        <p>
          Risposte giuste al primo colpo: <strong>{score.correct}</strong> · errori: <strong>{score.wrong}</strong>
        </p>
      )}
      {next && <p className="muted">Prossimo ripasso: {new Date(next).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
      <p className="muted">Puoi continuare con Allenamento o Quiz quando vuoi.</p>
    </div>
  );
}
