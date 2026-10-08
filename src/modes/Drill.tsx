import { useEffect, useState } from 'react';
import type { Opening, OpeningNode } from '../model/types';
import { lineNameOf, moveLabel, namedLines, nextMoves, pathFromRoot } from '../core/tree';
import { checkMove, gradePosition, pickOpponentMove, solutionArrows } from '../core/training';
import { Board } from '../components/Board';
import { MoveList } from '../components/MoveList';
import { CommentPanel } from '../components/CommentPanel';
import { WhyButton } from '../components/Explanation';

type Feedback = { kind: 'info' | 'ok' | 'wrong' | 'done'; text: string };

export function Drill({ opening, initialLine }: { opening: Opening; initialLine?: string }) {
  const [start, setStart] = useState<OpeningNode>(
    () => namedLines(opening.root).find((l) => l.node.lineName === initialLine && l.node.parent)?.node ?? opening.root,
  );
  const [path, setPath] = useState<OpeningNode[]>(() => pathFromRoot(start));
  const [wrongHere, setWrongHere] = useState(false);
  const [wrongSan, setWrongSan] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'info', text: 'Gioca le tue mosse: l\'avversario risponde con le varie linee.' });
  const [stats, setStats] = useState({ correct: 0, mistakes: 0, lines: 0 });

  const current = path[path.length - 1];
  const next = nextMoves(current);
  const myTurn = next.length > 0 && next[0].isUserMove;

  const restart = (from: OpeningNode = start) => {
    setPath(pathFromRoot(from));
    setWrongHere(false);
    setFeedback({ kind: 'info', text: 'Nuova linea: tocca a te quando è il tuo turno.' });
  };

  // Mossa automatica dell'avversario / fine linea.
  useEffect(() => {
    if (next.length === 0) {
      if (feedback.kind !== 'done') {
        setStats((s) => ({ ...s, lines: s.lines + 1 }));
        setFeedback({ kind: 'done', text: `Linea completata: ${lineNameOf(path) ?? opening.name}.` });
      }
      return;
    }
    if (myTurn) return;
    const t = setTimeout(() => setPath((p) => [...p, pickOpponentMove(opening, next)]), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const onMove = (from: string, to: string) => {
    if (!myTurn) return false;
    const { san, match, expected } = checkMove(current, from, to);
    if (!san) return false;
    if (match) {
      if (!wrongHere) {
        gradePosition(opening, current, true);
        setStats((s) => ({ ...s, correct: s.correct + 1 }));
      }
      setWrongHere(false);
      setWrongSan(null);
      setFeedback({ kind: 'ok', text: `✓ ${moveLabel(match)}` });
      setPath((p) => [...p, match]);
      return true;
    }
    if (!wrongHere) {
      gradePosition(opening, current, false);
      setStats((s) => ({ ...s, mistakes: s.mistakes + 1 }));
    }
    setWrongHere(true);
    setWrongSan(san);
    setFeedback({
      kind: 'wrong',
      text: `✗ ${san} non è nel repertorio. Giusta: ${expected.map(moveLabel).join(' oppure ')} — giocala sulla scacchiera.`,
    });
    return false;
  };

  return (
    <div className="layout two">
      <div className="board-col">
        <Board
          fen={current.fen}
          orientation={opening.color}
          onMove={onMove}
          arrows={wrongHere ? solutionArrows(next) : []}
          lastMove={current.parent ? current : undefined}
        />
        <div className="controls">
          <select
            value={start.id}
            onChange={(e) => {
              const n = e.target.value === '' ? opening.root : namedLines(opening.root).find((l) => l.node.id === e.target.value)!.node;
              setStart(n);
              restart(n);
            }}
          >
            <option value="">Tutte le linee</option>
            {namedLines(opening.root).map(({ node, depth }) => (
              <option key={node.id} value={node.id}>
                {'\u00a0\u00a0'.repeat(depth)}{node.lineName}
              </option>
            ))}
          </select>
          <button onClick={() => restart()}>↻ Ricomincia</button>
        </div>
      </div>

      <div className="side">
        <div className={`feedback ${feedback.kind}`}>{feedback.text}</div>
        {wrongHere && wrongSan && <WhyButton fen={current.fen} san={wrongSan} expected={next} />}
        {feedback.kind === 'done' && (
          <button className="primary" onClick={() => restart()}>
            Prossima linea →
          </button>
        )}
        <div className="stats-row">
          <span>✓ {stats.correct}</span>
          <span>✗ {stats.mistakes}</span>
          <span>Linee: {stats.lines}</span>
        </div>
        <MoveList path={path} />
        <CommentPanel node={current} lineName={lineNameOf(path)} />
      </div>
    </div>
  );
}
