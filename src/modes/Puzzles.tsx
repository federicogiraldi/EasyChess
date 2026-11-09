import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { OpeningNode } from '../model/types';
import {
  checkPuzzleMove,
  findPuzzle,
  loadIndex,
  loadMistakes,
  loadSeen,
  loadStats,
  pickPuzzle,
  puzzleFens,
  saveMistakes,
  saveSeen,
  saveStats,
  solverColor,
  updateRating,
  type Mistake,
  type Puzzle,
  type PuzzleIndex,
  type PuzzleStats,
} from '../core/puzzles';
import { THEME_GROUPS, themeName } from '../core/puzzleThemes';
import { load, save } from '../core/storage';
import { Board, sanOf } from '../components/Board';
import { WhyButton } from '../components/Explanation';
import './puzzles.css';

type Source = 'rated' | 'theme' | 'mistakes';

interface Settings {
  source: Source;
  theme: string;
  /** Scarto rispetto al tuo punteggio: negativo = più facili. */
  offset: number;
}

const DIFFICULTY = [
  { value: -300, label: 'Molto più facili' },
  { value: -150, label: 'Più facili' },
  { value: 0, label: 'Al tuo livello' },
  { value: 150, label: 'Più difficili' },
  { value: 300, label: 'Molto più difficili' },
];

/** Pochi problemi per un tema: non vale la pena mostrarlo nel menu. */
const MIN_THEME_COUNT = 30;

/** Nodo minimo per "Perché?": la mossa giusta del problema. */
function solutionNode(fen: string, uci: string): OpeningNode {
  const m = new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return {
    id: '', san: m.san, from: m.from, to: m.to, fen: m.after, ply: 0, isUserMove: true,
    keyIdeas: [], arrows: [], highlights: [], children: [], parent: null,
  };
}

export function Puzzles() {
  const [settings, setSettings] = useState<Settings>(() => load('puzzles:settings', { source: 'rated', theme: 'fork', offset: 0 }));
  const [stats, setStats] = useState<PuzzleStats>(loadStats);
  const [mistakes, setMistakes] = useState<Mistake[]>(loadMistakes);
  const seen = useRef(loadSeen());
  const [index, setIndex] = useState<PuzzleIndex | null>(null);

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ply, setPly] = useState(0);
  /** Posizione finale se hai dato un matto diverso da quello previsto (vale lo stesso). */
  const [altEnd, setAltEnd] = useState<{ fen: string; from: string; to: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [hinted, setHinted] = useState(false);
  const [showing, setShowing] = useState(false);
  const [finished, setFinished] = useState(false);
  const [wrong, setWrong] = useState<{ fen: string; san: string; expected: string } | null>(null);
  const [delta, setDelta] = useState<number | null>(null);

  const fens = useMemo(() => (puzzle ? puzzleFens(puzzle) : []), [puzzle]);
  const total = puzzle?.moves.length ?? 0;
  const myColor = puzzle ? solverColor(puzzle) : 'white';
  const rated = settings.source !== 'mistakes';
  const myTurn = !!puzzle && !finished && !showing && ply % 2 === 1 && ply < total;

  const updateSettings = (s: Partial<Settings>) => {
    const next = { ...settings, ...s };
    setSettings(next);
    save('puzzles:settings', next);
  };

  useEffect(() => {
    loadIndex().then(setIndex, (e: Error) => setError(e.message));
  }, []);

  const themeOptions = useMemo(
    () =>
      THEME_GROUPS.map((g) => ({
        label: g.label,
        themes: Object.keys(g.themes).filter((t) => (index?.themeCounts[t] ?? 0) >= MIN_THEME_COUNT),
      })).filter((g) => g.themes.length > 0),
    [index],
  );

  const nextPuzzle = useCallback(async (s: Settings = settings) => {
    setLoading(true);
    setError(null);
    try {
      let p: Puzzle | null;
      if (s.source === 'mistakes') {
        const m = loadMistakes()[0];
        p = m ? await findPuzzle(m.id, m.rating) : null;
        if (!p && m) {
          // Problema non più nella banca (banca rigenerata): toglilo dagli errori.
          const rest = loadMistakes().filter((x) => x.id !== m.id);
          saveMistakes(rest);
          setMistakes(rest);
          return nextPuzzle(s);
        }
      } else {
        const target = loadStats().rating + s.offset;
        p = await pickPuzzle({ target, theme: s.source === 'theme' ? s.theme : undefined, seen: seen.current });
      }
      setPuzzle(p);
      setPly(0);
      setAltEnd(null);
      setFailed(false);
      setHinted(false);
      setShowing(false);
      setFinished(false);
      setWrong(null);
      setDelta(null);
      if (!p) setError(s.source === 'mistakes' ? 'Nessun errore da ripassare: ottimo lavoro!' : 'Hai già visto tutti i problemi di questo tipo.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  useEffect(() => {
    void nextPuzzle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Registra l'esito (una volta sola per problema): punteggio, serie, errori da ripassare. */
  const record = (win: boolean) => {
    if (!puzzle) return;
    seen.current.add(puzzle.id);
    saveSeen(seen.current);
    if (rated && !(win && hinted)) {
      const before = stats.rating;
      const next = updateRating(stats, puzzle.rating, win);
      setStats(next);
      saveStats(next);
      setDelta(next.rating - before);
    }
    const others = loadMistakes().filter((m) => m.id !== puzzle.id);
    // Risolto al primo colpo (anche con un suggerimento): esce dagli errori. Sbagliato: ci entra in coda.
    const nextMistakes = win ? others : [...others, { id: puzzle.id, rating: puzzle.rating }];
    saveMistakes(nextMistakes);
    setMistakes(nextMistakes);
  };

  // Mosse automatiche: quelle dell'avversario, o tutte mentre mostri la soluzione.
  useEffect(() => {
    if (!puzzle || finished || ply >= total) return;
    if (ply % 2 === 1 && !showing) return;
    const t = setTimeout(() => setPly((p) => p + 1), ply === 0 ? 700 : showing ? 800 : 400);
    return () => clearTimeout(t);
  }, [puzzle, ply, total, finished, showing]);

  useEffect(() => {
    if (showing && ply >= total) {
      setShowing(false);
      setFinished(true);
    }
  }, [showing, ply, total]);

  const onMove = (from: string, to: string) => {
    if (!puzzle || !myTurn) return false;
    const fen = fens[ply];
    const expected = puzzle.moves[ply];
    const last = ply === total - 1;
    const verdict = checkPuzzleMove(fen, from, to, expected, last);
    if (verdict === 'illegal') return false;
    if (verdict === 'wrong') {
      if (!failed) {
        setFailed(true);
        record(false);
      }
      setWrong({ fen, san: sanOf(fen, from, to) ?? `${from}-${to}`, expected });
      return false;
    }
    setWrong(null);
    if (from !== expected.slice(0, 2) || to !== expected.slice(2, 4)) {
      // Matto alternativo: mostra la posizione che hai davvero ottenuto.
      const c = new Chess(fen);
      c.move({ from, to, promotion: 'q' });
      setAltEnd({ fen: c.fen(), from, to });
    }
    setPly(ply + 1);
    if (last) {
      if (!failed) record(true);
      setFinished(true);
    }
    return true;
  };

  const showSolution = () => {
    if (!failed) {
      setFailed(true);
      record(false);
    }
    setWrong(null);
    setShowing(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!finished || (e.key !== 'ArrowRight' && e.key !== 'Enter')) return;
      e.preventDefault();
      void nextPuzzle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const fen = altEnd && finished ? altEnd.fen : fens[ply] ?? '8/8/8/8/8/8/8/8 w - - 0 1';
  const lastUci = ply > 0 ? puzzle?.moves[ply - 1] : undefined;
  const lastMove = altEnd && finished
    ? { from: altEnd.from, to: altEnd.to }
    : lastUci
      ? { from: lastUci.slice(0, 2), to: lastUci.slice(2, 4) }
      : undefined;
  const expected = puzzle && ply < total ? puzzle.moves[ply] : undefined;
  const marks = hinted && myTurn && expected ? { [expected.slice(0, 2)]: 'rgba(250, 204, 21, 0.65)' } : undefined;

  const sideName = myColor === 'white' ? 'il Bianco' : 'il Nero';
  let feedback: { kind: string; text: string };
  if (loading) feedback = { kind: 'info', text: 'Carico il problema…' };
  else if (error) feedback = { kind: 'info', text: error };
  else if (finished) {
    const score = delta === null ? '' : ` Punteggio ${stats.rating} (${delta >= 0 ? '+' : '−'}${Math.abs(delta)}).`;
    feedback = failed
      ? { kind: 'wrong', text: `Problema non risolto.${score} Lo ritrovi in "Ripassa gli errori".` }
      : { kind: 'done', text: `✓ Risolto!${hinted ? ' (con suggerimento, non conta per il punteggio)' : ''}${score}` };
  } else if (showing) feedback = { kind: 'info', text: 'Ecco la soluzione…' };
  else if (wrong) feedback = { kind: 'wrong', text: `✗ ${wrong.san} non è la mossa giusta. Riprova, oppure guarda la soluzione.` };
  else if (ply === 0) feedback = { kind: 'info', text: `L'avversario muove… poi tocca a te con ${sideName}.` };
  else if (myTurn) feedback = { kind: ply > 1 ? 'ok' : 'info', text: ply > 1 ? '✓ Giusta! Continua…' : `Tocca a te (${sideName}): trova la mossa migliore.` };
  else feedback = { kind: 'ok', text: '✓ Giusta!' };

  return (
    <div className="layout two puzzles">
      <div className="board-col">
        <Board
          fen={fen}
          orientation={myColor}
          onMove={puzzle && !finished && !showing ? onMove : undefined}
          premoveColor={puzzle && !finished && !showing ? myColor : undefined}
          lastMove={lastMove}
          marks={marks}
        />
        <div className="controls">
          {finished || error ? (
            <button className="primary" onClick={() => void nextPuzzle()} disabled={loading}>
              Prossimo problema →
            </button>
          ) : (
            <>
              <button onClick={() => setHinted(true)} disabled={!myTurn || hinted} title="Evidenzia il pezzo da muovere: il problema non conterà per il punteggio">
                💡 Suggerimento
              </button>
              <button onClick={showSolution} disabled={!puzzle || showing || loading}>
                👀 Soluzione
              </button>
              <button onClick={() => void nextPuzzle()} disabled={loading} title="Salta questo problema">
                ⏭ Salta
              </button>
            </>
          )}
        </div>
      </div>

      <div className="side">
        <div className="puzzle-score">
          <div>
            <div className="muted small">Il tuo punteggio problemi</div>
            <div className="puzzle-rating">
              {stats.rating}
              {delta !== null && <span className={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? `+${delta}` : `−${-delta}`}</span>}
            </div>
          </div>
          <div className="stats-row">
            <span title="Risolti">✓ {stats.solved}</span>
            <span title="Sbagliati">✗ {stats.failed}</span>
            <span title="Serie attuale (record)">🔥 {stats.streak} ({stats.bestStreak})</span>
          </div>
        </div>

        <div className="puzzle-settings">
          <div className="puzzle-seg">
            {(['rated', 'theme', 'mistakes'] as Source[]).map((src) => (
              <button
                key={src}
                className={settings.source === src ? 'active' : ''}
                onClick={() => {
                  updateSettings({ source: src });
                  void nextPuzzle({ ...settings, source: src });
                }}
              >
                {src === 'rated' ? '🎯 Misti' : src === 'theme' ? '🏷 Per tema' : `🔁 Errori (${mistakes.length})`}
              </button>
            ))}
          </div>
          {settings.source === 'theme' && (
            <select
              value={settings.theme}
              onChange={(e) => {
                updateSettings({ theme: e.target.value });
                void nextPuzzle({ ...settings, theme: e.target.value });
              }}
            >
              {themeOptions.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.themes.map((t) => (
                    <option key={t} value={t}>
                      {themeName(t)} ({index?.themeCounts[t]})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
          {settings.source !== 'mistakes' && (
            <select
              value={settings.offset}
              onChange={(e) => {
                const offset = Number(e.target.value);
                updateSettings({ offset });
                void nextPuzzle({ ...settings, offset });
              }}
            >
              {DIFFICULTY.map((d) => (
                <option key={d.value} value={d.value}>
                  Difficoltà: {d.label}
                </option>
              ))}
            </select>
          )}
          {settings.source === 'mistakes' && (
            <p className="muted small">I problemi sbagliati tornano qui finché non li risolvi al primo colpo. Non contano per il punteggio.</p>
          )}
        </div>

        <div className={`feedback ${feedback.kind}`}>{feedback.text}</div>
        {wrong && <WhyButton fen={wrong.fen} san={wrong.san} expected={[solutionNode(wrong.fen, wrong.expected)]} />}

        {puzzle && finished && (
          <div className="puzzle-info">
            <div>
              Problema da <strong>{puzzle.rating}</strong> punti
            </div>
            {puzzle.themes.length > 0 && (
              <div className="puzzle-themes">
                {puzzle.themes.map((t) => (
                  <span key={t} className="chip">
                    {themeName(t)}
                  </span>
                ))}
              </div>
            )}
            <a className="muted small" href={`https://lichess.org/training/${puzzle.id}`} target="_blank" rel="noreferrer">
              Vedi su Lichess ↗
            </a>
          </div>
        )}

        <p className="muted small">
          {index ? `${index.buckets.reduce((s, b) => s + b.count, 0).toLocaleString('it-IT')} problemi` : 'Problemi'} dal database
          pubblico di Lichess, sempre disponibili anche offline. Ne hai visti {seen.current.size}.
        </p>
      </div>
    </div>
  );
}

