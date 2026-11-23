import { useEffect, useMemo, useReducer, useState, type ChangeEvent } from 'react';
import { Icon, type IconName } from './components/Icon';
import { builtinSources, loadOpenings, type PgnSource } from './openings';
import { parseOpening } from './core/pgnToTree';
import { exportCards, replaceCards, useProgress } from './core/progress';
import { parseBackup, sanitizeSources } from './core/backup';
import { load, save } from './core/storage';
import { saveFile } from './core/device';
import { InstallHint } from './components/InstallHint';
import { Account } from './components/Account';
import { ContinueCard, MODES, OpeningGrid, Shortcuts } from './components/Home';
import { FileButton } from './components/FileButton';
import { loadLastVisit, saveLastVisit } from './core/home';
import { Onboarding } from './components/Onboarding';
import { isOnboardingDone, loadMyOpenings, needsOnboarding } from './core/onboarding';
import { courseProgress } from './modes/Course';
import { Explore } from './modes/Explore';
import { Drill } from './modes/Drill';
import { Review } from './modes/Review';
import { Quiz } from './modes/Quiz';
import { Lab } from './modes/Lab';
import { Course } from './modes/Course';
import { Simulator } from './modes/Simulator';
import { Analysis } from './modes/Analysis';
import { Puzzles } from './modes/Puzzles';
import { Endgames } from './modes/MateCourse';
import { ProgressPage } from './modes/Progress';
import { DailyReview } from './modes/DailyReview';
import { TodayCard } from './components/TodayCard';
import { SettingsPage } from './modes/SettingsPage';
import { VariationPreviewProvider } from './components/VariationPreview';

export type Mode = 'course' | 'explore' | 'drill' | 'review' | 'quiz' | 'lab' | 'sim';


/** 'today' (Ripasso di oggi) non ha una voce nel menu: ci si arriva dalla home. */
type Section = 'openings' | 'mates' | 'puzzles' | 'analysis' | 'progress' | 'today' | 'settings';

/** Menu principale: ogni sezione ha la sua pagina, così la home resta dedicata alle aperture. */
const SECTIONS: { id: Section; label: string; icon: IconName }[] = [
  { id: 'openings', label: 'Aperture', icon: 'knight' },
  { id: 'mates', label: 'Finali', icon: 'king' },
  { id: 'puzzles', label: 'Problemi', icon: 'puzzle' },
  { id: 'analysis', label: 'Analisi', icon: 'analysis' },
  { id: 'progress', label: 'Progressi', icon: 'progress' },
];

/** Id dell'apertura di un file importato, o null se il file non si legge più. */
const idOf = (s: PgnSource) => {
  try {
    return parseOpening(s.pgn, s.file.replace(/\.pgn$/i, ''), s.source).id;
  } catch {
    return null;
  }
};

/** Saluto in base all'ora del giorno. */
function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 5 ? 'Buonanotte' : h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
}

export default function App() {
  const [imported, setImported] = useState<PgnSource[]>(() => sanitizeSources(load('imported', [])));
  const [route, setRoute] = useState<{ openingId: string; mode: Mode; labMoves?: string[]; drillLine?: string; simMoves?: string[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('openings');
  /** Presentazione riaperta dalla home ("Scegli le aperture che giochi"). */
  const [reopenOnboarding, setReopenOnboarding] = useState(false);
  /** Ridisegna dopo la fine della presentazione (lo stato "fatta" è in storage, non in React). */
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  // Si ricalcola quando arrivano progressi (anche dalla sincronizzazione): allora la presentazione sparisce.
  useProgress();
  const analysis = section === 'analysis';
  const puzzles = section === 'puzzles';
  const mates = section === 'mates';
  const progress = section === 'progress';
  const today = section === 'today';
  /** Problemi aperti dal pulsante "Rivedi problemi sbagliati": partono dagli errori. */
  const [puzzleStart, setPuzzleStart] = useState<'mistakes' | undefined>();
  const goHome = () => {
    setRoute(null);
    setSection('openings');
    window.scrollTo({ top: 0 });
  };
  const openMistakes = () => {
    setPuzzleStart('mistakes');
    setSection('puzzles');
    window.scrollTo({ top: 0 });
  };

  const { openings, errors } = useMemo(() => loadOpenings([...builtinSources, ...imported]), [imported]);
  const opening = route && openings.find((o) => o.id === route.openingId);
  const firstLaunch = needsOnboarding({
    done: isOnboardingDone(),
    cards: Object.keys(exportCards()).length,
    lessons: openings.reduce((n, o) => n + courseProgress(o.id).done.length, 0),
    visited: loadLastVisit() !== null,
  });
  const showOnboarding = !route && section === 'openings' && (firstLaunch || reopenOnboarding);

  // Sul telefono le schede scorrono in orizzontale: porta in vista quella attiva (es. Esplora → Laboratorio).
  useEffect(() => {
    document.querySelector('.tabs .active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    window.scrollTo({ top: 0 });
    if (route) saveLastVisit(route.openingId, route.mode);
  }, [route?.mode, route?.openingId]);

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
    void saveFile(
      `easychess-progressi-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
      'application/json',
    );
  };

  const importProgress = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = parseBackup(await file.text());
      replaceCards(data.cards);
      if (data.imported) updateImported(data.imported);
      setMessage('Progressi ripristinati.');
    } catch (err) {
      setMessage(`Backup non valido: ${err instanceof Error ? err.message : err}`);
    }
  };

  return (
    <VariationPreviewProvider>
      <div className="app">
        <header className="topbar">
          <button
            className="brand"
            onClick={() => {
              setRoute(null);
              setSection('openings');
              setReopenOnboarding(false);
            }}
          >
            <span className="logo"><Icon name="knight" /></span> EasyChess
          </button>
          {!route && (
            <nav className="tabs sections">
              {SECTIONS.map((sec) => (
                <button
                  key={sec.id}
                  className={sec.id === section ? 'active' : ''}
                  onClick={() => {
                    setSection(sec.id);
                    setPuzzleStart(undefined);
                    setReopenOnboarding(false);
                    window.scrollTo({ top: 0 });
                  }}
                >
                  <Icon name={sec.icon} /> {sec.label}
                </button>
              ))}
            </nav>
          )}
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
                    <Icon name={m.icon} /> {m.label}
                  </button>
                ))}
              </nav>
            </>
          )}
          <button
            className={`settings-btn${section === 'settings' && !route ? ' active' : ''}`}
            title="Impostazioni"
            aria-label="Impostazioni"
            onClick={() => {
              setRoute(null);
              setSection('settings');
              window.scrollTo({ top: 0 });
            }}
          >
            <Icon name="settings" />
          </button>
          <Account />
        </header>

        <main key={route ? `${route.openingId}-${route.mode}` : section} className="view">
          {section === 'settings' && !route ? (
            <SettingsPage />
          ) : today && !route ? (
            <DailyReview openings={openings} onHome={goHome} onMistakes={openMistakes} />
          ) : progress && !route ? (
            <ProgressPage
              openings={openings}
              onOpen={(openingId, mode) => {
                setSection('openings');
                setRoute({ openingId, mode });
              }}
              onSection={(sec) => {
                setSection(sec);
                window.scrollTo({ top: 0 });
              }}
            />
          ) : mates && !route ? (
            <Endgames />
          ) : puzzles && !route ? (
            <Puzzles key={puzzleStart ?? 'normal'} initialSource={puzzleStart} />
          ) : analysis && !route ? (
            <Analysis
              openings={openings}
              onOpenMode={(openingId, mode, moves) => {
                setSection('openings');
                setRoute(mode === 'lab' ? { openingId, mode, labMoves: moves } : { openingId, mode, simMoves: moves });
              }}
            />
          ) : showOnboarding ? (
            <Onboarding
              openings={openings}
              reopened={reopenOnboarding}
              onDone={(courseOf) => {
                setReopenOnboarding(false);
                rerender();
                if (courseOf) setRoute({ openingId: courseOf, mode: 'course' });
                window.scrollTo({ top: 0 });
              }}
            />
          ) : opening && route ? (
            <div key={`${opening.id}-${route.mode}`}>
              {route.mode === 'explore' && (
                <Explore
                  opening={opening}
                  onOpenLab={(labMoves) => setRoute({ openingId: opening.id, mode: 'lab', labMoves })}
                  onSimulate={(simMoves) => setRoute({ openingId: opening.id, mode: 'sim', simMoves })}
                />
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
              {route.mode === 'sim' && <Simulator opening={opening} initialMoves={route.simMoves} />}
            </div>
          ) : (
            <>
              <section className="hero">
                <h1>{greeting()}</h1>
                <p className="muted">
                  Impara le aperture con i corsi, allenati contro le risposte dell'avversario e ripassa con la ripetizione spaziata.
                </p>
              </section>
              <InstallHint />
              {message && (
                <div className="toast" onClick={() => setMessage(null)}>
                  {message}
                </div>
              )}
              <div className="home-top">
                <TodayCard
                  openings={openings}
                  onStart={() => {
                    setSection('today');
                    window.scrollTo({ top: 0 });
                  }}
                  onMistakes={openMistakes}
                />
                <ContinueCard openings={openings} onOpen={(openingId, mode) => setRoute({ openingId, mode })} />
              </div>
              <OpeningGrid
                openings={openings}
                errors={errors}
                onOpen={(openingId, mode) => setRoute({ openingId, mode })}
                onRemoveImported={(id) => updateImported(imported.filter((s) => idOf(s) !== id))}
                onRemoveBroken={(file) => updateImported(imported.filter((s) => s.file !== file))}
                mine={loadMyOpenings()}
                onChooseMine={() => {
                  setReopenOnboarding(true);
                  window.scrollTo({ top: 0 });
                }}
              />
              <Shortcuts
                onSection={(sec) => {
                  setSection(sec);
                  setPuzzleStart(undefined);
                  window.scrollTo({ top: 0 });
                }}
              />
              <details className="home-tools">
                <summary><Icon name="folder" /> Importa aperture e backup dei progressi</summary>
                <section className="tools">
                  {/* niente "accept": su iPhone/iPad i .pgn risulterebbero non selezionabili; il contenuto viene comunque validato */}
                  <FileButton onFile={importPgn}>
                    <Icon name="plus" /> Importa apertura (.pgn)
                  </FileButton>
                  <button onClick={exportProgress}><Icon name="save" /> Esporta progressi</button>
                  <FileButton onFile={importProgress} accept=".json,application/json">
                    <Icon name="folder" /> Ripristina progressi
                  </FileButton>
                </section>
                <p className="muted small hint">
                  Per aggiungere un'apertura in modo permanente salva un file <code>.pgn</code> in <code>src/openings/</code> con gli
                  header <code>[Opening]</code>, <code>[Color]</code> e <code>[Description]</code>. Istruzioni complete nel README.
                </p>
              </details>
            </>
          )}
        </main>
      </div>
    </VariationPreviewProvider>
  );
}
