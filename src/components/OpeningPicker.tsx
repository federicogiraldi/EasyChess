import type { Opening } from '../model/types';
import type { LoadError } from '../openings';
import { cardPositions, countLeaves } from '../core/tree';
import { getCard, resetOpening, useProgress } from '../core/progress';
import { isDue, isMastered } from '../core/srs';
import type { Mode } from '../App';
import { courseProgress } from '../modes/Course';

interface Props {
  openings: Opening[];
  errors: LoadError[];
  onOpen: (openingId: string, mode: Mode) => void;
  onRemoveImported: (openingId: string) => void;
}

export function openingStats(opening: Opening) {
  const cards = cardPositions(opening);
  const states = cards.map((c) => getCard(c.key));
  return {
    lines: countLeaves(opening.root),
    total: cards.length,
    mastered: states.filter(isMastered).length,
    due: states.filter((s) => isDue(s)).length,
    fresh: states.filter((s) => !s).length,
  };
}

export function OpeningPicker({ openings, errors, onOpen, onRemoveImported }: Props) {
  useProgress();
  return (
    <div className="picker">
      {openings.map((op) => {
        const st = openingStats(op);
        const pct = st.total ? Math.round((100 * st.mastered) / st.total) : 0;
        const toReview = st.due + Math.min(st.fresh, 10);
        return (
          <article key={op.id} className="opening-card">
            <header>
              <h2>{op.name}</h2>
              <span className={`side-badge ${op.color}`}>{op.color === 'white' ? 'col Bianco' : 'col Nero'}</span>
            </header>
            {op.description && <p className="desc">{op.description}</p>}
            <div className="progress" title={`${st.mastered} posizioni imparate su ${st.total}`}>
              <div className="bar" style={{ width: `${pct}%` }} />
            </div>
            <p className="muted small">
              {pct}% imparato · {st.lines} linee · {st.total} posizioni · {st.due} da ripassare · {st.fresh} nuove
            </p>
            <div className="actions">
              {op.course && (
                <button className="primary" onClick={() => onOpen(op.id, 'course')}>
                  🎓 Corso ({courseProgress(op.id).done.length}/{op.course.lessons.length})
                </button>
              )}
              <button onClick={() => onOpen(op.id, 'explore')}>📖 Esplora</button>
              <button onClick={() => onOpen(op.id, 'drill')}>♟ Allenamento</button>
              <button onClick={() => onOpen(op.id, 'review')}>
                🔁 Ripasso{toReview > 0 ? ` (${toReview})` : ''}
              </button>
              <button onClick={() => onOpen(op.id, 'quiz')}>❓ Quiz</button>
              <button onClick={() => onOpen(op.id, 'lab')}>🔬 Laboratorio</button>
            </div>
            <footer className="card-footer">
              <button className="link" onClick={() => confirm(`Azzerare i progressi di "${op.name}"?`) && resetOpening(op.id)}>
                Azzera progressi
              </button>
              {op.source === 'imported' && (
                <button className="link" onClick={() => confirm(`Rimuovere "${op.name}"?`) && onRemoveImported(op.id)}>
                  Rimuovi apertura importata
                </button>
              )}
            </footer>
          </article>
        );
      })}
      {errors.map((e) => (
        <article key={e.file} className="opening-card error">
          <h2>⚠ {e.file}</h2>
          <p>{e.message}</p>
          <p className="muted small">Correggi il file PGN e ricarica la pagina (oppure esegui npm run validate).</p>
        </article>
      ))}
    </div>
  );
}
