import { useMemo, useState } from 'react';
import type { Opening } from '../model/types';
import { Icon, type IconName } from './Icon';
import type { LoadError } from '../openings';
import { exportCards, resetOpening, useProgress } from '../core/progress';
import { pct, summarizeOpening, type OpeningSummary } from '../core/dashboard';
import { groupOpenings, keyMoves, loadLastVisit, nextStep, since, type HomeMode } from '../core/home';
import { load, save } from '../core/storage';
import { courseProgress } from '../modes/Course';

export const MODES: { id: HomeMode; label: string; icon: IconName }[] = [
  { id: 'course', label: 'Corso', icon: 'course' },
  { id: 'explore', label: 'Esplora', icon: 'explore' },
  { id: 'drill', label: 'Allenamento', icon: 'drill' },
  { id: 'review', label: 'Ripasso', icon: 'review' },
  { id: 'quiz', label: 'Quiz', icon: 'quiz' },
  { id: 'sim', label: 'Simulatore', icon: 'sim' },
  { id: 'lab', label: 'Laboratorio', icon: 'lab' },
];
const modeInfo = (id: HomeMode) => MODES.find((m) => m.id === id)!;

/** Mosse in notazione con i numeri: ["e4","c6","d4"] → "1.e4 c6 2.d4". */
const numbered = (moves: string[]) => moves.map((m, i) => (i % 2 ? m : `${i / 2 + 1}.${m}`)).join(' ');

function useSummaries(openings: Opening[]): Map<string, OpeningSummary> {
  const version = useProgress();
  return useMemo(() => {
    const cards = exportCards();
    return new Map(openings.map((op) => [op.id, summarizeOpening(op, cards, courseProgress(op.id).done.length)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openings, version]);
}

/** Anello di avanzamento: posizioni imparate sul totale. */
function Ring({ value, side }: { value: number; side: 'white' | 'black' }) {
  const r = 19;
  const c = 2 * Math.PI * r;
  return (
    <div className={`ring ring-${side}`} role="img" aria-label={`${value}% imparato`}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={r} className="ring-track" />
        {value > 0 && (
          <circle cx="24" cy="24" r={r} className="ring-bar" strokeDasharray={`${(c * value) / 100} ${c}`} transform="rotate(-90 24 24)" />
        )}
      </svg>
      <span>{value}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface ContinueProps {
  openings: Opening[];
  onOpen: (openingId: string, mode: HomeMode) => void;
}

/** "Continua da dove eri": l'ultima apertura e modalità aperta, con il passo consigliato. */
export function ContinueCard({ openings, onOpen }: ContinueProps) {
  const summaries = useSummaries(openings);
  const last = loadLastVisit();
  const op = last && openings.find((o) => o.id === last.openingId);
  if (!last || !op) return null;
  const s = summaries.get(op.id)!;
  const mode = modeInfo(last.mode) ?? modeInfo('explore');
  const step = nextStep(s);
  const detail =
    last.mode === 'course' && s.courseTotal
      ? `Lezioni completate: ${s.courseDone} di ${s.courseTotal}`
      : `${s.mastered} posizioni imparate su ${s.total}${s.due ? ` · ${s.due} da ripassare` : ''}`;
  return (
    <section className={`continue-card side-${op.color}`} aria-label="Continua da dove eri">
      <div className="continue-text">
        <span className="eyebrow">Continua da dove eri · {since(last.at)}</span>
        <h2>{op.name}</h2>
        <p className="muted small">
          <Icon name={mode.icon} /> {mode.label} · {detail}
        </p>
      </div>
      <div className="actions">
        <button className="primary" onClick={() => onOpen(op.id, last.mode)}>
          <Icon name="play" /> Riprendi
        </button>
        {step.mode !== last.mode && (
          <button onClick={() => onOpen(op.id, step.mode)}>
            <Icon name={modeInfo(step.mode).icon} /> {step.label}
          </button>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

type SideFilter = 'all' | 'white' | 'black';
const FILTER_KEY = 'home:side';

interface GridProps {
  openings: Opening[];
  errors: LoadError[];
  onOpen: (openingId: string, mode: HomeMode) => void;
  onRemoveImported: (openingId: string) => void;
}

/** Le aperture, raggruppate per colore e prima mossa, con un filtro Bianco/Nero. */
export function OpeningGrid({ openings, errors, onOpen, onRemoveImported }: GridProps) {
  const summaries = useSummaries(openings);
  const [filter, setFilter] = useState<SideFilter>(() => load<SideFilter>(FILTER_KEY, 'all'));
  const groups = groupOpenings(openings).filter((g) => filter === 'all' || g.side === filter);
  const count = (side: 'white' | 'black') => openings.filter((o) => o.color === side).length;
  const choose = (f: SideFilter) => {
    setFilter(f);
    save(FILTER_KEY, f);
  };

  return (
    <section className="openings" aria-label="Aperture">
      <div className="openings-head">
        <h2>Le tue aperture</h2>
        <div className="side-filter" role="group" aria-label="Mostra">
          {(
            [
              ['all', `Tutte (${openings.length})`],
              ['white', `Bianco (${count('white')})`],
              ['black', `Nero (${count('black')})`],
            ] as [SideFilter, string][]
          ).map(([id, label]) => (
            <button key={id} className={filter === id ? 'active' : ''} aria-pressed={filter === id} onClick={() => choose(id)}>
              {id !== 'all' && <Icon name={id} className={`icon-${id}`} />} {label}
            </button>
          ))}
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.id} className="opening-group">
          <h3 className="group-title">
            <Icon name={g.side} className={`icon-${g.side}`} /> {g.title}
            <span className="muted"> · {g.openings.length}</span>
          </h3>
          <div className="picker">
            {g.openings.map((op) => (
              <OpeningCard key={op.id} opening={op} summary={summaries.get(op.id)!} onOpen={onOpen} onRemoveImported={onRemoveImported} />
            ))}
          </div>
        </div>
      ))}

      {errors.map((e) => (
        <article key={e.file} className="opening-card error">
          <h2><Icon name="warning" /> {e.file}</h2>
          <p>{e.message}</p>
          <p className="muted small">Correggi il file PGN e ricarica la pagina (oppure esegui npm run validate).</p>
        </article>
      ))}
    </section>
  );
}

interface CardProps {
  opening: Opening;
  summary: OpeningSummary;
  onOpen: (openingId: string, mode: HomeMode) => void;
  onRemoveImported: (openingId: string) => void;
}

function OpeningCard({ opening: op, summary: s, onOpen, onRemoveImported }: CardProps) {
  const learned = pct(s.mastered, s.total);
  const step = nextStep(s);
  const moves = useMemo(() => numbered(keyMoves(op)), [op]);
  const others = MODES.filter((m) => m.id !== step.mode && (m.id !== 'course' || op.course));

  return (
    <article className={`opening-card side-${op.color}`}>
      <header className="op-head">
        <Ring value={learned} side={op.color} />
        <div className="op-title">
          <h2>{op.name}</h2>
          <p className="op-moves">{moves}</p>
        </div>
      </header>
      {op.description && <p className="desc small">{op.description}</p>}
      <div className="op-stats small">
        <span>{s.lines} linee</span>
        <span>{s.mastered}/{s.total} posizioni</span>
        {s.courseTotal > 0 && (
          <span className={s.courseDone === s.courseTotal ? 'done' : ''}>
            {s.courseDone === s.courseTotal && <Icon name="check" />} corso {s.courseDone}/{s.courseTotal}
          </span>
        )}
        {s.due > 0 && <span className="due">{s.due} da ripassare</span>}
        <span className="muted">{s.lastAt ? since(s.lastAt) : 'mai allenata'}</span>
      </div>
      <button className="primary op-next" onClick={() => onOpen(op.id, step.mode)}>
        <Icon name={modeInfo(step.mode).icon} /> {step.label}
      </button>
      <div className="op-modes">
        {others.map((m) => (
          <button key={m.id} onClick={() => onOpen(op.id, m.id)} title={m.label}>
            <Icon name={m.icon} /> <span>{m.label}</span>
          </button>
        ))}
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
}

// ---------------------------------------------------------------------------

export type ShortcutSection = 'mates' | 'puzzles' | 'analysis' | 'progress';

const SHORTCUTS: { id: ShortcutSection; icon: IconName; title: string; text: string }[] = [
  { id: 'puzzles', icon: 'puzzle', title: 'Problemi', text: 'Quasi 100.000 problemi di tattica, anche offline' },
  { id: 'mates', icon: 'king', title: 'Finali', text: 'Matti base, Re e pedone, Lucena e Philidor' },
  { id: 'analysis', icon: 'analysis', title: 'Analisi', text: 'Le tue partite di chess.com confrontate col repertorio' },
  { id: 'progress', icon: 'progress', title: 'Progressi', text: 'Aperture, problemi e precisione nel tempo' },
];

/** Scorciatoie alle altre sezioni. */
export function Shortcuts({ onSection }: { onSection: (s: ShortcutSection) => void }) {
  return (
    <section className="shortcuts" aria-label="Altre sezioni">
      {SHORTCUTS.map((s) => (
        <button key={s.id} className="shortcut" onClick={() => onSection(s.id)}>
          <span className="shortcut-icon"><Icon name={s.icon} /></span>
          <span className="shortcut-text">
            <strong>{s.title}</strong>
            <span className="muted small">{s.text}</span>
          </span>
          <Icon name="next" className="shortcut-arrow" />
        </button>
      ))}
    </section>
  );
}
