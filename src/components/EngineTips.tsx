import { useEffect, useState } from 'react';
import { coachLines, type CoachLine } from '../engine/simEngine';
import { formatScore } from '../engine/stockfish';
import '../modes/simulator.css';

/** A fine linea: come continuerebbe Stockfish, con le 3 mosse migliori e il perché. */
export function EngineTips({ fen, onSimulate }: { fen: string; onSimulate: () => void }) {
  const [lines, setLines] = useState<{ fen: string; lines: CoachLine[] } | null>(null);
  useEffect(() => {
    let alive = true;
    coachLines(fen).then((l) => alive && setLines({ fen, lines: l }), () => {});
    return () => {
      alive = false;
    };
  }, [fen]);
  const here = lines?.fen === fen ? lines.lines : null;
  const white = fen.split(' ')[1] === 'w';

  return (
    <div className="engine-tips">
      <h3>🤖 Dopo la teoria, Stockfish consiglia</h3>
      {!here && <p className="muted small">Stockfish sta analizzando…</p>}
      {here?.map((l, i) => (
        <div key={l.uci} className="coach-line">
          <span className="coach-move">
            {i + 1}. {l.san} <span className="coach-score">{formatScore(white ? l.score : -l.score, l.mate === undefined ? undefined : white ? l.mate : -l.mate)}</span>
          </span>
          {l.reasons.length > 0 && <span className="coach-info">{l.reasons.join(' ')}</span>}
          <span className="coach-pv muted small">{l.line}</span>
        </div>
      ))}
      {here && <p className="muted small">Valutazioni dal punto di vista del Bianco.</p>}
      <button className="primary" onClick={onSimulate}>
        🎮 Gioca da qui contro Stockfish
      </button>
    </div>
  );
}
