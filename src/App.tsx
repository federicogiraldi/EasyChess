import { useMemo, useState, type ChangeEvent } from 'react';
import { builtinSources, loadOpenings, type PgnSource } from './openings';
import { parseOpening } from './core/pgnToTree';
import { exportCards, replaceCards } from './core/progress';
import { load, save } from './core/storage';
import { OpeningPicker } from './components/OpeningPicker';
import { Explore } from './modes/Explore';
import { Drill } from './modes/Drill';
import { Review } from './modes/Review';
import { Quiz } from './modes/Quiz';
import { Lab } from './modes/Lab';
import { Course } from './modes/Course';

export type Mode = 'course' | 'explore' | 'drill' | 'review' | 'quiz' | 'lab';

const MODES: { id: Mode; label: string }[] = [
  { id: 'course', label: '🎓 Corso' },
  { id: 'explore', label: '📖 Esplora' },
  { id: 'drill', label: '♟ Allenamento' },
  { id: 'review', label: '🔁 Ripasso' },
  { id: 'quiz', label: '❓ Quiz' },
  { id: 'lab', label: '🔬 Laboratorio' },
];

const idOf = (s: PgnSource) => parseOpening(s.pgn, s.file.replace(/\.pgn$/i, ''), s.source).id;

export default function App() {
  const [imported, setImported] = useState<PgnSource[]>(() => load('imported', []));
  const [route, setRoute] = useState<{ openingId: string; mode: Mode; labMoves?: string[]; drillLine?: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { openings, errors } = useMemo(() => loadOpenings([...builtinSources, ...imported]), [imported]);
  const opening = route && openings.find((o) => o.id === route.openingId);

  const updateImported = (next: PgnSource[]) => {
    setImported(next);
    save('imported', next);
  };

  const importPgn = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const pgn = await file.text();
    try {
      const op = parseOpening(pgn, file.name.replace(/\.pgn$/i, ''), 'imported');
      if (openings.some((o) => o.id === op.id)) throw new Error(`esiste già un'apertura con id "${op.id}".`);
      updateImported([...imported, { file: file.name, pgn, source: 'imported' }]);
      setMessage(`Importata "${op.name}".`);
    } catch (err) {
      setMessage(`Impossibile importare ${file.name}: ${err instanceof Error ? err.message : err}`);
    }
  };

  const exportProgress = () => {
    const data = { version: 1, cards: exportCards(), imported };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `easychess-progressi-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importProgress = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.version !== 1 || typeof data.cards !== 'object') throw new Error('formato non riconosciuto');
      replaceCards(data.cards);
      if (Array.isArray(data.imported)) updateImported(data.imported);
      setMessage('Progressi ripristinati.');
    } catch (err) {
      setMessage(`Backup non valido: ${err instanceof Error ? err.message : err}`);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setRoute(null)}>
          <span className="logo">♞</span> EasyChess
        </button>
        {opening && route && (
          <>
            <span className="crumb">{opening.name}</span>
            <nav className="tabs">
              {MODES.filter((m) => m.id !== 'course' || opening.course).map((m) => (
                <button
                  key={m.id}
                  className={m.id === route.mode ? 'active' : ''}
                  onClick={() => setRoute({ openingId: route.openingId, mode: m.id })}
                >
                  {m.label}
                </button>
              ))}
            </nav>
          </>
        )}
      </header>

      <main>
        {opening && route ? (
          <div key={`${opening.id}-${route.mode}`}>
            {route.mode === 'explore' && (
              <Explore opening={opening} onOpenLab={(labMoves) => setRoute({ openingId: opening.id, mode: 'lab', labMoves })} />
            )}
            {route.mode === 'drill' && <Drill opening={opening} initialLine={route.drillLine} />}
            {route.mode === 'course' && opening.course && (
              <Course
                opening={{ ...opening, course: opening.course }}
                onDrillLine={(drillLine) => setRoute({ openingId: opening.id, mode: 'drill', drillLine })}
              />
            )}
            {route.mode === 'review' && <Review opening={opening} />}
            {route.mode === 'quiz' && <Quiz opening={opening} />}
            {route.mode === 'lab' && <Lab opening={opening} initialMoves={route.labMoves} />}
          </div>
        ) : (
          <>
            <section className="hero">
              <h1>Le tue aperture</h1>
              <p className="muted">
                Esplora le linee, allenati contro le risposte dell'avversario e ripassa con la ripetizione spaziata.
              </p>
            </section>
            {message && (
              <div className="toast" onClick={() => setMessage(null)}>
                {message}
              </div>
            )}
            <OpeningPicker
              openings={openings}
              errors={errors}
              onOpen={(openingId, mode) => setRoute({ openingId, mode })}
              onRemoveImported={(id) => updateImported(imported.filter((s) => idOf(s) !== id))}
            />
            <section className="tools">
              <label className="button">
                ➕ Importa apertura (.pgn)
                <input type="file" accept=".pgn,text/plain" onChange={importPgn} hidden />
              </label>
              <button onClick={exportProgress}>💾 Esporta progressi</button>
              <label className="button">
                📂 Ripristina progressi
                <input type="file" accept=".json,application/json" onChange={importProgress} hidden />
              </label>
            </section>
            <p className="muted small hint">
              Per aggiungere un'apertura in modo permanente salva un file <code>.pgn</code> in <code>src/openings/</code> con gli
              header <code>[Opening]</code>, <code>[Color]</code> e <code>[Description]</code>. Istruzioni complete nel README.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
