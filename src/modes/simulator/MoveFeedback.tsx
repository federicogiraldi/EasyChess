import type { Opening, OpeningNode } from '../../model/types';
import { Icon } from '../../components/Icon';
import { bookNode, type PosEval, type SimPly } from '../../core/simulation';
import { SIM_QUALITY, type SimQuality } from '../../core/quality';
import { findInBook, nextMoves } from '../../core/tree';
import { sanFromUci } from '../../engine/simEngine';
import { WhyButton } from '../../components/Explanation';
import { QualityIcon } from '../../components/QualityIcon';

/** Riscontro sulla tua ultima mossa durante la partita: qualità, teoria prevista, mossa di Stockfish. */
export function MoveFeedback({
  opening,
  plies,
  index,
  quality,
  before,
  onRetry,
}: {
  opening: Opening;
  plies: SimPly[];
  index: number;
  quality?: SimQuality;
  before?: PosEval;
  onRetry: () => void;
}) {
  const p = plies[index];
  const bookBefore = bookNode(opening, plies.slice(0, index));
  const expected: OpeningNode[] = bookBefore ? nextMoves(bookBefore) : [];
  const deviated = !p.book && expected.length > 0;
  const info = quality ? SIM_QUALITY[quality] : undefined;
  const node = p.book ? findInBook(opening.root, p.fenAfter) : undefined;
  const bestSan = before?.best && before.best !== p.uci ? sanFromUci(p.fenBefore, before.best) : undefined;
  const bad = quality === 'imprecisione' || quality === 'errore' || quality === 'grave';

  return (
    <div className={`sim-feedback ${bad || deviated ? 'bad' : 'good'}`} style={info ? { borderLeftColor: info.color } : undefined}>
      <div className="sim-feedback-head">
        {quality ? <QualityIcon q={quality} /> : <span className="sim-q-icon">…</span>}
        <strong>
          {p.san}
          {info?.symbol}
        </strong>
        <span>{info ? info.label : 'Stockfish sta valutando…'}</span>
      </div>
      {node?.comment && <p className="small">{node.comment}</p>}
      {deviated && (
        <p className="small">
          <Icon name="outOfBook" /> Hai lasciato il repertorio: la teoria prevede <strong>{expected.map((n) => n.san).join(' o ')}</strong>.
        </p>
      )}
      {!p.book && bestSan && quality && quality !== 'migliore' && (
        <p className="small">
          Stockfish preferiva <strong>{bestSan}</strong>
          {before?.line ? <span className="muted"> ({before.line})</span> : null}.
        </p>
      )}
      {(bad || deviated) && (
        <div className="controls">
          <button onClick={onRetry}><Icon name="undo" /> Riprova</button>
          <WhyButton fen={p.fenBefore} san={p.san} expected={expected} />
        </div>
      )}
    </div>
  );
}
