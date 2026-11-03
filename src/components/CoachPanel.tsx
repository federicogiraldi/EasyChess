import type { OpeningNode } from '../model/types';
import type { CoachLine } from '../engine/simEngine';
import { formatScore } from '../engine/stockfish';

interface Props {
  /** Mosse del repertorio in questa posizione (se siamo ancora nella teoria). */
  book: OpeningNode[];
  lines: CoachLine[] | null;
  onPlay?: (san: string) => void;
}

/** Il "coach": cosa giocare qui, prima secondo il repertorio e poi secondo Stockfish. */
export function CoachPanel({ book, lines, onPlay }: Props) {
  return (
    <div className="coach">
      <h3>💡 Mosse consigliate</h3>
      {book.length > 0 && (
        <div className="coach-book">
          {book.map((n) => (
            <button key={n.id} className="coach-line book" onClick={() => onPlay?.(n.san)}>
              <span className="coach-move">📖 {n.san}</span>
              <span className="coach-info">{n.comment ?? 'Mossa del tuo repertorio'}</span>
            </button>
          ))}
        </div>
      )}
      {!lines && <p className="muted small">Stockfish sta pensando…</p>}
      {lines?.map((l, i) => (
        <button key={l.uci} className="coach-line" onClick={() => onPlay?.(l.san)}>
          <span className="coach-move">
            {i + 1}. {l.san} <span className="coach-score">{formatScore(l.score, l.mate)}</span>
          </span>
          {l.reasons.length > 0 && <span className="coach-info">{l.reasons.join(' ')}</span>}
          <span className="coach-pv muted small">{l.line}</span>
        </button>
      ))}
      {lines && <p className="muted small">Valutazioni dal tuo punto di vista: + significa che stai meglio.</p>}
    </div>
  );
}
