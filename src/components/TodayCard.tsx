import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import type { Opening } from '../model/types';
import { exportCards, useProgress } from '../core/progress';
import { dailyQueue, doneToday, GOAL_OPTIONS, loadActivity, loadGoal, saveGoal, streak } from '../core/daily';
import { loadMistakes } from '../core/puzzles';

interface Props {
  openings: Opening[];
  onStart: () => void;
  onMistakes: () => void;
}

/** Riquadro "Oggi" in home: obiettivo del giorno, serie di giorni e il pulsante del Ripasso di oggi. */
export function TodayCard({ openings, onStart, onMistakes }: Props) {
  const version = useProgress();
  const [goal, setGoal] = useState(loadGoal);
  const activity = loadActivity();
  const done = doneToday(activity);
  const days = streak(activity, goal);
  const mistakes = loadMistakes().length;
  const queue = useMemo(
    () => dailyQueue(openings, exportCards(), goal - done),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openings, version, goal],
  );
  const reached = done >= goal;
  const width = Math.min(100, Math.round((100 * done) / goal));

  return (
    <section className="today-card" aria-label="Oggi">
      <div className="today-head">
        <h2>Oggi</h2>
        <span className={`streak${days ? '' : ' none'}`} title="Giorni di fila con l'obiettivo raggiunto">
          <Icon name="flame" /> {days ? `${days} ${days === 1 ? 'giorno' : 'giorni'} di fila` : 'nessuna serie'}
        </span>
      </div>

      <div className="today-goal">
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(done, goal)}>
          <div className="bar" style={{ width: `${width}%` }} />
        </div>
        <span className="small">
          {reached ? <><Icon name="check" /> Obiettivo raggiunto: {done} risposte</> : `${done} / ${goal} risposte`}
        </span>
        <label className="goal-select small muted">
          Obiettivo
          <select
            value={goal}
            onChange={(e) => {
              const g = Number(e.target.value);
              setGoal(g);
              saveGoal(g);
            }}
          >
            {GOAL_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g} al giorno
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="muted small today-text">
        {queue.items.length === 0
          ? reached
            ? 'Niente in scadenza: ottimo lavoro! Puoi continuare con i corsi o con i problemi.'
            : 'Niente in scadenza. Inizia il corso di un\'apertura qui sotto: le posizioni che impari tornano qui nei giorni successivi.'
          : [
              queue.due ? `${queue.due} ${queue.due === 1 ? 'posizione in scadenza' : 'posizioni in scadenza'}` : '',
              queue.fresh ? `${queue.fresh} ${queue.fresh === 1 ? 'nuova' : 'nuove'} per arrivare all'obiettivo` : '',
            ]
              .filter(Boolean)
              .join(' e ') + ', da tutte le tue aperture.'}
      </p>

      <div className="actions">
        {queue.items.length > 0 && (
          <button className="primary" onClick={onStart}>
            <Icon name="play" /> Ripasso di oggi ({queue.items.length})
          </button>
        )}
        {mistakes > 0 && <button onClick={onMistakes}><Icon name="puzzle" /> Rivedi {mistakes} {mistakes === 1 ? 'problema sbagliato' : 'problemi sbagliati'}</button>}
      </div>
    </section>
  );
}
