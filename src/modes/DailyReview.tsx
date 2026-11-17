import { useState } from 'react';
import { Icon } from '../components/Icon';
import type { Opening } from '../model/types';
import { exportCards } from '../core/progress';
import { dailyQueue, doneToday, loadActivity, loadGoal, streak } from '../core/daily';
import { loadMistakes } from '../core/puzzles';
import { PositionTrainer } from './PositionTrainer';

interface Props {
  openings: Opening[];
  onHome: () => void;
  onMistakes: () => void;
}

/** Ripasso di oggi: le posizioni in scadenza di tutte le aperture in un'unica sessione. */
export function DailyReview({ openings, onHome, onMistakes }: Props) {
  const [items] = useState(() => dailyQueue(openings, exportCards(), loadGoal() - doneToday()).items);

  if (items.length === 0) {
    return (
      <div className="session-end">
        <h2>Niente da ripassare adesso <Icon name="party" /></h2>
        <p className="muted">Le posizioni che impari nei corsi e nell'Allenamento tornano qui quando è il momento di ripassarle.</p>
        <button className="primary" onClick={onHome}>
          Torna alla home
        </button>
      </div>
    );
  }

  return (
    <PositionTrainer
      mode="daily"
      items={items}
      onEnd={(score) => <DailyEnd score={score} onHome={onHome} onMistakes={onMistakes} />}
    />
  );
}

function DailyEnd({ score, onHome, onMistakes }: { score: { correct: number; wrong: number }; onHome: () => void; onMistakes: () => void }) {
  const goal = loadGoal();
  const activity = loadActivity();
  const done = doneToday(activity);
  const days = streak(activity, goal);
  const mistakes = loadMistakes().length;
  return (
    <div className="session-end">
      <h2>Ripasso di oggi completato!</h2>
      <p>
        Risposte giuste al primo colpo: <strong>{score.correct}</strong> · errori: <strong>{score.wrong}</strong>
      </p>
      <p>
        {done >= goal ? <><Icon name="check" /> Obiettivo del giorno raggiunto ({done}/{goal})</> : `Obiettivo del giorno: ${done}/${goal}`}
        {days > 0 && <> · <Icon name="flame" /> {days} {days === 1 ? 'giorno' : 'giorni'} di fila</>}
      </p>
      {done < goal && <p className="muted">Ti mancano {goal - done} risposte: puoi completarle con l'Allenamento, un corso o i problemi.</p>}
      <div className="actions" style={{ justifyContent: 'center' }}>
        <button className="primary" onClick={onHome}>
          Torna alla home
        </button>
        {mistakes > 0 && <button onClick={onMistakes}><Icon name="puzzle" /> Rivedi i problemi sbagliati</button>}
      </div>
    </div>
  );
}
