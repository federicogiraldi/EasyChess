import { useEffect, useState } from 'react';
import type { Arrow, Opening, OpeningNode } from '../model/types';
import { candidateLabel, lineNameOf, moveLabel, nextMoves, pathFromRoot } from '../core/tree';
import { Board, sanOf } from '../components/Board';
import { MoveList } from '../components/MoveList';
import { CommentPanel } from '../components/CommentPanel';
import { LineTree } from '../components/LineTree';

const MY_ARROW = 'rgba(21, 128, 61, 0.55)';
const THEIR_ARROW = 'rgba(234, 120, 20, 0.55)';

export function Explore({ opening, onOpenLab }: { opening: Opening; onOpenLab: (moves: string[]) => void }) {
  // Il percorso è quello effettivamente seguito: resta corretto anche attraverso le trasposizioni.
  const [path, setPath] = useState<OpeningNode[]>([opening.root]);
  const [hints, setHints] = useState(true);
  const current = path[path.length - 1];
  const candidates = nextMoves(current);

  const go = (child: OpeningNode) => setPath((p) => [...p, child]);
  const back = () => setPath((p) => (p.length > 1 ? p.slice(0, -1) : p));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') back();
      else if (e.key === 'ArrowRight' && candidates[0]) go(candidates[0]);
      else if (e.key === 'Home') setPath([opening.root]);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onMove = (from: string, to: string) => {
    const san = sanOf(current.fen, from, to);
    const child = candidates.find((c) => c.san === san);
    if (!child) return false;
    go(child);
    return true;
  };

  const arrows: Arrow[] = [
    ...current.arrows,
    ...(hints ? candidates.map((c) => ({ from: c.from, to: c.to, color: c.isUserMove ? MY_ARROW : THEIR_ARROW })) : []),
  ];

  return (
    <div className="layout three">
      <LineTree root={opening.root} currentPath={path} onSelect={(n) => setPath(pathFromRoot(n))} />

      <div className="board-col">
        <Board
          fen={current.fen}
          orientation={opening.color}
          onMove={onMove}
          arrows={arrows}
          highlights={current.highlights}
          lastMove={current.parent ? current : undefined}
        />
        <div className="controls">
          <button onClick={() => setPath([opening.root])} title="Inizio (Home)">⏮</button>
          <button onClick={back} title="Indietro (←)">◀</button>
          <button onClick={() => candidates[0] && go(candidates[0])} title="Avanti, linea principale (→)">▶</button>
          <label className="toggle">
            <input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} /> Frecce delle mosse
          </label>
          <button onClick={() => onOpenLab(path.slice(1).map((n) => n.san))} title="Prova mosse diverse da questa posizione con Stockfish">
            🔬 Prova altre mosse da qui
          </button>
        </div>
      </div>

      <div className="side">
        <MoveList path={path} onSelect={(i) => setPath((p) => p.slice(0, i + 1))} />
        <CommentPanel
          node={current}
          lineName={lineNameOf(path)}
          fallback={current.parent ? undefined : opening.description}
        />
        <div className="candidates">
          <h3>{candidates.length === 0 ? 'Fine della linea' : candidates[0].isUserMove ? 'La tua mossa' : "Risposte dell'avversario"}</h3>
          {candidates.map((c) => (
            <button key={c.id} className={`candidate ${c.isUserMove ? 'mine' : 'theirs'}`} onClick={() => go(c)}>
              <strong>{moveLabel(c)}</strong>
              <span>{candidateLabel(c)}</span>
            </button>
          ))}
          {current.transposesTo && <p className="muted small">↪ Traspone in un'altra linea dell'albero.</p>}
        </div>
      </div>
    </div>
  );
}
