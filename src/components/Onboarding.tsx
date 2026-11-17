import { useState } from 'react';
import type { Opening } from '../model/types';
import { Icon, type IconName } from './Icon';
import { groupOpenings, keyMoves } from '../core/home';
import { finishOnboarding, loadMyOpenings, saveMyOpenings, suggestCourse } from '../core/onboarding';
import { GOAL_OPTIONS, loadGoal, saveGoal } from '../core/daily';
import { courseProgress } from '../modes/Course';

interface Props {
  openings: Opening[];
  /** Fine della presentazione: con un'apertura, apri il suo corso; altrimenti torna alla home. */
  onDone: (courseOf?: string) => void;
  /** Riaperta dalla home ("Scegli le tue aperture"): parte dal primo passo e si può chiudere. */
  reopened?: boolean;
}

const numbered = (moves: string[]) => moves.map((m, i) => (i % 2 ? m : `${i / 2 + 1}.${m}`)).join(' ');

const STEPS: { title: string; icon: IconName }[] = [
  { title: 'Le tue aperture', icon: 'knight' },
  { title: 'Il ripasso', icon: 'review' },
  { title: 'Il primo corso', icon: 'course' },
];

/** Presentazione al primo avvio, in tre passi. */
export function Onboarding({ openings, onDone, reopened }: Props) {
  const [step, setStep] = useState(0);
  const [mine, setMine] = useState<string[]>(loadMyOpenings);
  const [goal, setGoal] = useState(loadGoal);

  const toggle = (id: string) => {
    // l'ordine resta quello delle aperture, non quello dei clic
    const next = mine.includes(id) ? mine.filter((x) => x !== id) : openings.map((o) => o.id).filter((x) => x === id || mine.includes(x));
    setMine(next);
    saveMyOpenings(next);
  };
  const finish = (courseOf?: string) => {
    finishOnboarding();
    onDone(courseOf);
  };
  const course = suggestCourse(openings, mine, (id) => courseProgress(id).done.length);

  return (
    <section className="onboarding view" aria-label="Presentazione">
      <header className="ob-head">
        <ol className="ob-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className={i === step ? 'current' : i < step ? 'past' : ''} aria-current={i === step ? 'step' : undefined}>
              <span className="ob-dot">{i < step ? <Icon name="check" /> : <Icon name={s.icon} />}</span>
              <span className="ob-step-name">{s.title}</span>
            </li>
          ))}
        </ol>
        <button className="link" onClick={() => finish()}>
          {reopened ? 'Chiudi' : 'Salta la presentazione'}
        </button>
      </header>

      {step === 0 && (
        <div className="ob-body" key="s0">
          <h1>{reopened ? 'Quali aperture giochi?' : 'Benvenuto in EasyChess'}</h1>
          <p className="muted">
            {reopened ? '' : 'Qui impari le aperture con corsi guidati, allenamento e ripasso. '}
            Scegli quelle che giochi (o che vuoi imparare): in home le trovi per prime. Puoi cambiarle quando vuoi.
          </p>
          <div className="ob-groups">
            {groupOpenings(openings).map((g) => (
              <div key={g.id} className="ob-group">
                <h3 className="group-title">
                  <Icon name={g.side} className={`icon-${g.side}`} /> {g.title}
                </h3>
                <div className="ob-options">
                  {g.openings.map((o) => {
                    const on = mine.includes(o.id);
                    return (
                      <button key={o.id} className={`ob-option${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(o.id)}>
                        <span className="ob-check" aria-hidden>{on && <Icon name="check" />}</span>
                        <span className="ob-option-text">
                          <strong>{o.name}</strong>
                          <span className="op-moves">{numbered(keyMoves(o))}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="ob-nav">
            <span className="muted small">{mine.length ? `${mine.length} ${mine.length === 1 ? 'scelta' : 'scelte'}` : 'Nessuna scelta: le vedrai tutte'}</span>
            <button className="primary" onClick={() => setStep(1)}>
              Avanti <Icon name="next" />
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="ob-body" key="s1">
          <h1>Il ripasso di ogni giorno</h1>
          <p className="muted">
            Ogni posizione che impari torna a farsi vedere quando stai per dimenticarla: il giorno dopo, poi dopo qualche giorno,
            poi dopo settimane. È la ripetizione spaziata, il modo più veloce per ricordare le linee.
          </p>
          <ul className="ob-points">
            <li><Icon name="play" /> <span>In home trovi <strong>Ripasso di oggi</strong>: una sola sessione con le posizioni in scadenza di tutte le aperture.</span></li>
            <li><Icon name="flame" /> <span>Raggiungi l'obiettivo del giorno per allungare la <strong>serie</strong> di giorni di fila.</span></li>
            <li><Icon name="sync" /> <span>Con l'account (in alto a destra) i progressi sono gli stessi su iPad, telefono e PC.</span></li>
          </ul>
          <div className="setting">
            <span className="setting-label">Quante risposte al giorno?</span>
            <div className="segmented" role="radiogroup" aria-label="Obiettivo del giorno">
              {GOAL_OPTIONS.map((g) => (
                <button
                  key={g}
                  role="radio"
                  aria-checked={goal === g}
                  className={goal === g ? 'active' : ''}
                  onClick={() => {
                    setGoal(g);
                    saveGoal(g);
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
            <span className="muted small">{goal <= 10 ? 'Circa 5 minuti al giorno.' : goal <= 20 ? 'Circa 10 minuti al giorno.' : goal <= 30 ? 'Circa 15 minuti al giorno.' : 'Circa 25 minuti al giorno.'}</span>
          </div>
          <div className="ob-nav">
            <button onClick={() => setStep(0)}>
              <Icon name="prev" /> Indietro
            </button>
            <button className="primary" onClick={() => setStep(2)}>
              Avanti <Icon name="next" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="ob-body" key="s2">
          <h1>Comincia con un corso</h1>
          {course ? (
            <>
              <p className="muted">
                Il corso spiega i piani e le idee dell'apertura con lezioni brevi, e ti fa giocare le mosse sulla scacchiera. Le
                posizioni che giochi entrano nel ripasso.
              </p>
              <article className={`opening-card side-${course.color} ob-course`}>
                <div className="op-title">
                  <h2>{course.name}</h2>
                  <p className="op-moves">{numbered(keyMoves(course))}</p>
                </div>
                {course.description && <p className="desc small">{course.description}</p>}
                <p className="small">
                  <Icon name="course" /> {course.course!.lessons.length} lezioni · {course.color === 'white' ? 'col Bianco' : 'col Nero'}
                </p>
              </article>
            </>
          ) : (
            <p className="muted">Le aperture che hai scelto non hanno un corso: parti da Esplora e Allenamento, dalla home.</p>
          )}
          <div className="ob-nav">
            <button onClick={() => setStep(1)}>
              <Icon name="prev" /> Indietro
            </button>
            {course ? (
              <span className="actions">
                <button onClick={() => finish()}>Vai alla home</button>
                <button className="primary" onClick={() => finish(course.id)}>
                  <Icon name="play" /> Inizia il corso
                </button>
              </span>
            ) : (
              <button className="primary" onClick={() => finish()}>
                Vai alla home <Icon name="next" />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
