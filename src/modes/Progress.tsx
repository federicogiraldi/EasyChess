import { useMemo, type ReactNode } from 'react';
import { ENDGAME_LESSONS } from '../core/endgameCourse';
import { Icon } from '../components/Icon';
import type { Opening } from '../model/types';
import type { Mode } from '../App';
import { exportCards, useProgress } from '../core/progress';
import { load } from '../core/storage';
import { courseProgress } from './Course';
import { MATE_LESSONS } from '../core/mateCourse';
import { DEFAULT_STATS, loadMistakes, loadRatingHistory, loadStats } from '../core/puzzles';
import { loadHistory } from '../core/simulation';
import { loadLibrary } from '../core/analysis';
import { accuracySeries, average, NEW_PER_SESSION, pct, summarizeOpening, trainedSince, type OpeningSummary } from '../core/dashboard';
import { BarChart, LineChart } from '../components/Charts';
import { doneToday, loadActivity, loadGoal, streak } from '../core/daily';
import './progress.css';

interface Props {
  openings: Opening[];
  onOpen: (openingId: string, mode: Mode) => void;
  onSection: (section: 'puzzles' | 'mates' | 'analysis') => void;
}

const DAY = 24 * 60 * 60 * 1000;

function since(t: number | undefined, now: number): string {
  if (!t) return 'mai allenata';
  const days = Math.floor((startOfDay(now) - startOfDay(t)) / DAY);
  if (days <= 0) return 'oggi';
  if (days === 1) return 'ieri';
  if (days < 30) return `${days} giorni fa`;
  return `${Math.floor(days / 30)} mesi fa`;
}

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return d && m ? `${Number(d)}/${Number(m)}${y && y !== String(new Date().getFullYear()) ? `/${y.slice(2)}` : ''}` : iso;
};

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

function OpeningRow({ s, now, onOpen }: { s: OpeningSummary; now: number; onOpen: Props['onOpen'] }) {
  const p = pct(s.mastered, s.total);
  return (
    <li className="op-row">
      <div className="op-main">
        <div className="op-title">
          <b>{s.name}</b>
          <span className="muted small">{since(s.lastAt, now)}</span>
        </div>
        <div className="progress" title={`${s.mastered} posizioni imparate su ${s.total}`}>
          <div className="bar" style={{ width: `${p}%` }} />
        </div>
        <span className="muted small">
          {p}% imparato · {s.mastered}/{s.total} posizioni
          {s.courseTotal > 0 && ` · corso ${s.courseDone}/${s.courseTotal}`}
        </span>
      </div>
      <div className="op-actions">
        {s.due > 0 ? (
          <button className="primary" onClick={() => onOpen(s.id, 'review')}>
            <Icon name="review" /> Ripassa ({s.toReview})
          </button>
        ) : !s.lastAt && s.courseTotal > 0 && s.courseDone === 0 ? (
          <button onClick={() => onOpen(s.id, 'course')}><Icon name="course" /> Inizia il corso</button>
        ) : s.fresh > 0 ? (
          <button onClick={() => onOpen(s.id, 'review')}><Icon name="sparkles" /> Impara {Math.min(s.fresh, NEW_PER_SESSION)} nuove</button>
        ) : (
          <span className="op-done"><Icon name="check" /> Tutto ripassato</span>
        )}
        {s.courseDone > 0 && s.courseDone < s.courseTotal && <button onClick={() => onOpen(s.id, 'course')}><Icon name="course" /> Continua il corso</button>}
      </div>
    </li>
  );
}

export function ProgressPage({ openings, onOpen, onSection }: Props) {
  const version = useProgress();
  const now = Date.now();

  const summaries = useMemo(() => {
    const cards = exportCards();
    return openings.map((op) => summarizeOpening(op, cards, courseProgress(op.id).done.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openings, version]);

  const cards = exportCards();
  const total = summaries.reduce((n, s) => n + s.total, 0);
  const mastered = summaries.reduce((n, s) => n + s.mastered, 0);
  const toReview = summaries.reduce((n, s) => n + s.toReview, 0);
  const dueOnly = summaries.reduce((n, s) => n + s.due, 0);
  const week = trainedSince(cards, 7, now);
  const activity = loadActivity();
  const goal = loadGoal();
  const days = streak(activity, goal, now);
  const today = doneToday(activity, now);
  const courseDone = summaries.reduce((n, s) => n + s.courseDone, 0);
  const courseTotal = summaries.reduce((n, s) => n + s.courseTotal, 0);
  const mates = load<{ done: number[] }>('mates:progress', { done: [] }).done.length;
  const endgames = load<{ done: string[] }>('endgames:progress', { done: [] }).done.length;

  const stats = loadStats() ?? DEFAULT_STATS;
  const history = loadRatingHistory();
  const ratingPoints = history.length
    ? history.map((p) => ({ label: shortDate(p.d), value: p.r }))
    : stats.games > 0
      ? [{ label: 'oggi', value: stats.rating }]
      : [];
  const monthAgo = history.find((p) => new Date(p.d).getTime() >= now - 30 * DAY);
  const ratingDelta = monthAgo && history.length > 1 ? stats.rating - monthAgo.r : undefined;
  const mistakes = loadMistakes().length;

  const names = Object.fromEntries(openings.map((o) => [o.id, o.name]));
  const games = accuracySeries(loadHistory(), loadLibrary(), names).slice(-20);
  const last10 = average(games.slice(-10).map((g) => g.accuracy));

  const white = summaries.filter((s) => s.color === 'white');
  const black = summaries.filter((s) => s.color === 'black');
  /** Prima quelle con posizioni in scadenza, poi quelle allenate di recente, in fondo quelle mai iniziate. */
  const byUrgency = (a: OpeningSummary, b: OpeningSummary) => b.due - a.due || (b.lastAt ?? 0) - (a.lastAt ?? 0);

  return (
    <div className="progress-page">
      <section className="hero">
        <h1>I tuoi progressi</h1>
        <p className="muted">Quanto hai imparato di ogni apertura, cosa ripassare oggi e come vanno problemi e partite.</p>
      </section>

      <section className="stat-grid" aria-label="Riepilogo">
        <Tile label="Posizioni imparate" value={`${pct(mastered, total)}%`} sub={`${mastered} su ${total}`} />
        <Tile
          label="Da ripassare oggi"
          value={String(toReview)}
          sub={dueOnly ? `${dueOnly} in scadenza, ${toReview - dueOnly} nuove` : `${toReview} nuove`}
        />
        <Tile label="Serie di giorni" value={<><Icon name="flame" /> {days}</>} sub={`oggi ${today}/${goal} risposte`} />
        <Tile label="Allenate in 7 giorni" value={String(week)} sub="posizioni ripassate" />
        <Tile label="Lezioni completate" value={`${courseDone + mates + endgames}/${courseTotal + MATE_LESSONS.length + ENDGAME_LESSONS.length}`} sub={`aperture ${courseDone}/${courseTotal} · finali ${mates + endgames}/${MATE_LESSONS.length + ENDGAME_LESSONS.length}`} />
        <Tile
          label="Punteggio problemi"
          value={stats.games ? String(stats.rating) : '—'}
          sub={stats.games ? (ratingDelta !== undefined ? `${ratingDelta >= 0 ? '+' : '−'}${Math.abs(ratingDelta)} in 30 giorni` : `${stats.games} problemi`) : 'nessun problema ancora'}
        />
        <Tile label="Precisione media" value={last10 !== undefined ? `${last10.toFixed(1)}%` : '—'} sub={last10 !== undefined ? `ultime ${Math.min(10, games.length)} partite` : 'nessuna partita ancora'} />
      </section>

      <section className="panel-block">
        <h2>Aperture</h2>
        {[
          ['Col Bianco', white],
          ['Col Nero', black],
        ].map(([title, list]) =>
          (list as OpeningSummary[]).length ? (
            <div key={title as string}>
              <h3>{title as string}</h3>
              <ul className="op-list">
                {[...(list as OpeningSummary[])].sort(byUrgency).map((s) => (
                  <OpeningRow key={s.id} s={s} now={now} onOpen={onOpen} />
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </section>

      <div className="two-col">
        <section className="panel-block">
          <h2>Punteggio dei problemi</h2>
          {ratingPoints.length ? (
            <>
              <LineChart points={ratingPoints} ariaLabel="Punteggio dei problemi nel tempo" />
              <div className="stats-row">
                <span title="Risolti"><Icon name="check" /> {stats.solved} risolti</span>
                <span title="Sbagliati"><Icon name="wrong" /> {stats.failed} sbagliati</span>
                <span title="Serie migliore"><Icon name="flame" /> record {stats.bestStreak}</span>
                {mistakes > 0 && <span><Icon name="review" /> {mistakes} errori da rivedere</span>}
              </div>
              {history.length < 2 && <p className="muted small">Il grafico si riempie giorno dopo giorno: un punto per ogni giorno in cui risolvi problemi.</p>}
            </>
          ) : (
            <Empty text="Risolvi qualche problema e qui vedrai il tuo punteggio crescere." action="Vai ai problemi" onClick={() => onSection('puzzles')} />
          )}
        </section>

        <section className="panel-block">
          <h2>Precisione nelle partite</h2>
          {games.length ? (
            <>
              <BarChart
                ariaLabel="Precisione nelle ultime partite"
                bars={games.map((g) => ({ key: g.id, value: g.accuracy, label: shortDate(g.date), detail: g.label }))}
                reference={last10 !== undefined ? { value: last10, label: `media ${last10.toFixed(0)}%` } : undefined}
              />
              <p className="muted small">Ultime {games.length} partite del Simulatore e partite analizzate, dalla più vecchia alla più recente.</p>
            </>
          ) : (
            <Empty
              text="Gioca contro Stockfish nel Simulatore o analizza le tue partite di chess.com per vedere la tua precisione."
              action="Analizza le mie partite"
              onClick={() => onSection('analysis')}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function Empty({ text, action, onClick }: { text: string; action: string; onClick: () => void }) {
  return (
    <div className="empty">
      <p className="muted">{text}</p>
      <button onClick={onClick}>{action}</button>
    </div>
  );
}
