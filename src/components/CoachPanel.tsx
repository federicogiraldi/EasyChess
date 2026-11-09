import type { OpeningNode } from '../model/types';
import type { CoachLine } from '../engine/simEngine';
import { formatScore } from '../engine/stockfish';

/**
 * Colori delle frecce (come su chess.com): la migliore blu scuro, poi sempre più chiara.
 * Si distinguono per tonalità e non per trasparenza, perché la scacchiera rende già le frecce semitrasparenti.
 */
export const ENGINE_ARROW_COLORS = ['rgb(29, 78, 216)', 'rgb(96, 145, 245)', 'rgb(165, 196, 250)'];
export const BOOK_ARROW_COLOR = 'rgba(21, 128, 61, 0.8)';

interface Props {
  /** Mosse del repertorio in questa posizione (se siamo ancora nella teoria). */
  book: OpeningNode[];
  lines: CoachLine[] | null;
  onPlay?: (san: string) => void;
  /** Mossa (UCI) sotto il dito/mouse: la sua freccia viene messa in evidenza. */
  onFocus?: (uci: string | null) => void;
  /** Mostra il pallino colorato della freccia accanto a ogni mossa. */
  arrowChips?: boolean;
}

/** Il "coach": cosa giocare qui, prima secondo il repertorio e poi secondo Stockfish. */
export function CoachPanel({ book, lines, onPlay, onFocus, arrowChips }: Props) {
  const focus = (uci: string | null) => () => onFocus?.(uci);
  return (
    <div className="coach">
      <h3>💡 Mosse consigliate</h3>
      {book.length > 0 && (
        <div className="coach-book">
          {book.map((n) => (
            <button
              key={n.id}
              className="coach-line book"
              onClick={() => onPlay?.(n.san)}
              onMouseEnter={focus(n.from + n.to)}
              onMouseLeave={focus(null)}
              onFocus={focus(n.from + n.to)}
              onBlur={focus(null)}
            >
              <span className="coach-move">
                {arrowChips && <span className="arrow-chip" style={{ background: BOOK_ARROW_COLOR }} />}📖 {n.san}
              </span>
              <span className="coach-info">{n.comment ?? 'Mossa del tuo repertorio'}</span>
            </button>
          ))}
        </div>
      )}
      {!lines && <p className="muted small">Stockfish sta pensando…</p>}
      {lines?.map((l, i) => (
        <button
          key={l.uci}
          className="coach-line"
          style={{ borderLeftColor: ENGINE_ARROW_COLORS[i] }}
          onClick={() => onPlay?.(l.san)}
          onMouseEnter={focus(l.uci)}
          onMouseLeave={focus(null)}
          onFocus={focus(l.uci)}
          onBlur={focus(null)}
        >
          <span className="coach-move">
            {arrowChips && <span className="arrow-chip" style={{ background: ENGINE_ARROW_COLORS[i] }} />}
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
