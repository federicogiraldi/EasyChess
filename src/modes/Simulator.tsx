import { useEffect, useMemo, useRef, useState } from 'react';
import type { Arrow, Opening, OpeningNode } from '../model/types';
import { findInBook, formatPath, lineNameOf, namedLines, nextMoves, pathFromRoot } from '../core/tree';
import {
  bookNode,
  bookReply,
  buildPlies,
  classifyMove,
  eloLabel,
  gameAccuracy,
  loadHistory,
  loadSettings,
  moveAccuracy,
  outcomeOf,
  saveGame,
  saveSettings,
  SIM_ELO_MAX,
  SIM_ELO_MIN,
  SIM_QUALITY,
  toPgn,
  winPercent,
  type HintMode,
  type PosEval,
  type SimGame,
  type SimPly,
  type SimQuality,
  type SimSettings,
} from '../core/simulation';
import { coachLines, evalPosition, opponentMove, sanFromUci, type CoachLine } from '../engine/simEngine';
import { engine, opponentEngine } from '../engine/stockfish';
import { Board, sanOf } from '../components/Board';
import { EvalBar, WhyButton } from '../components/Explanation';
import { EvalGraph } from '../components/EvalGraph';
import { KeyMoments, ReviewMove, ReviewSummary } from '../components/ReviewParts';
import { BOOK_ARROW_COLOR, CoachPanel, ENGINE_ARROW_COLORS } from '../components/CoachPanel';
import './simulator.css';

interface Props {
  opening: Opening;
  /** Mosse (SAN) da cui partire, es. la fine di una linea aperta in Esplora. */
  initialMoves?: string[];
}

type Phase = 'setup' | 'play' | 'review';

const HINT_ARROW = 'rgba(37, 99, 235, 0.8)';
const BOOK_ARROW = 'rgba(21, 128, 61, 0.75)';
const HINT_SQUARE = 'rgba(37, 99, 235, 0.45)';

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Simulatore (sul modello di chess.com): giochi la tua apertura contro Stockfish al livello scelto.
 * Finché c'è teoria l'avversario segue il repertorio, poi gioca l'engine; il coach suggerisce le mosse
 * e alla fine c'è la revisione con precisione, errori e grafico.
 */
export function Simulator({ opening, initialMoves }: Props) {
  const lines = useMemo(() => namedLines(opening.root).filter((l) => l.node.parent), [opening]);
  const [phase, setPhase] = useState<Phase>('setup');
  const [settings, setSettingsState] = useState<SimSettings>(loadSettings);
  const [lineId, setLineId] = useState('');
  const [startMoves, setStartMoves] = useState<string[]>(initialMoves ?? []);
  const [moves, setMoves] = useState<string[]>([]);
  const [game, setGame] = useState<SimGame | null>(null);
  const [evals, setEvals] = useState<Record<string, PosEval>>({});
  const [cursor, setCursor] = useState(0);
  const [hintStage, setHintStage] = useState(0);
  const [coach, setCoach] = useState<{ fen: string; lines: CoachLine[] } | null>(null);
  const [history, setHistory] = useState<SimGame[]>(loadHistory);
  const [copied, setCopied] = useState(false);
  const [focusUci, setFocusUci] = useState<string | null>(null);
  const pending = useRef(new Set<string>());

  const setSettings = (s: SimSettings) => {
    setSettingsState(s);
    saveSettings(s);
  };

  const target = lines.find((l) => l.node.id === lineId)?.node;
  const myWhite = opening.color === 'white';
  const plies = useMemo(() => buildPlies(opening, moves), [opening, moves]);
  const fens = useMemo(() => [opening.root.fen, ...plies.map((p) => p.fenAfter)], [opening.root.fen, plies]);
  const fen = fens[fens.length - 1];
  const myTurn = (fen.split(' ')[1] === 'w') === myWhite;
  const outcome = useMemo(() => outcomeOf(opening.root.fen, moves), [opening.root.fen, moves]);
  const book = bookNode(opening, plies);
  const bookMovesHere = book ? nextMoves(book) : [];

  // Ferma l'engine uscendo dal Simulatore.
  useEffect(
    () => () => {
      opponentEngine.cancelAll();
    },
    [],
  );

  // ---------------------------------------------------------------- valutazioni
  // Ogni posizione della partita viene valutata una volta (in ordine): servono per barra, etichette e revisione.
  useEffect(() => {
    if (phase === 'setup') return;
    const todo = phase === 'review' ? fens : fens.slice(-2);
    for (const f of todo) {
      if (evals[f] || pending.current.has(f)) continue;
      pending.current.add(f);
      evalPosition(f).then(
        (e) => setEvals((s) => ({ ...s, [f]: e })),
        () => {},
      ).finally(() => pending.current.delete(f));
    }
  }, [phase, fens, evals]);

  // ---------------------------------------------------------------- avversario
  useEffect(() => {
    if (phase !== 'play' || outcome.over || myTurn || !game) return;
    let alive = true;
    const fromBook = book;
    const t = setTimeout(async () => {
      try {
        let san: string | undefined;
        if (fromBook) san = bookReply(opening, fromBook, target).san;
        else {
          const uci = await opponentMove(fen, game.elo);
          if (uci) san = sanFromUci(fen, uci);
        }
        if (alive && san) setMoves((m) => [...m, san]);
      } catch {
        // ricerca annullata (mossa annullata o nuova partita)
      }
    }, fromBook ? 450 : 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, moves, game?.id]);

  // ---------------------------------------------------------------- coach
  const wantCoach = phase === 'play' && myTurn && !outcome.over && (settings.hints === 'always' || hintStage > 0);
  useEffect(() => {
    if (!wantCoach || coach?.fen === fen) return;
    let alive = true;
    coachLines(fen).then((l) => alive && setCoach({ fen, lines: l }), () => {});
    return () => {
      alive = false;
    };
  }, [wantCoach, fen, coach?.fen]);
  const coachHere = coach?.fen === fen ? coach.lines : null;

  // ---------------------------------------------------------------- revisione
  const quality = (i: number, p: SimPly): SimQuality | undefined => {
    if (p.book) return 'libro';
    const before = evals[fens[i]];
    const after = evals[fens[i + 1]];
    return before && after ? classifyMove(before, after, p.uci, p.white) : undefined;
  };
  const qualities = plies.map((p, i) => quality(i, p));
  const analyzed = fens.filter((f) => evals[f]).length;
  const reviewReady = phase === 'review' && analyzed === fens.length;

  const accuracyOf = (white: boolean) =>
    gameAccuracy(
      plies.flatMap((p, i) => {
        if (p.white !== white || p.book) return [];
        const b = evals[fens[i]];
        const a = evals[fens[i + 1]];
        if (!b || !a) return [];
        const wp = (s: number) => (white ? winPercent(s) : 100 - winPercent(s));
        return [moveAccuracy(wp(b.scoreWhite), wp(a.scoreWhite))];
      }),
    );

  // Salva la precisione nello storico quando l'analisi è completa.
  useEffect(() => {
    if (!reviewReady || !game) return;
    const g = { ...game, accuracy: { me: accuracyOf(myWhite), opp: accuracyOf(!myWhite) } };
    saveGame(g);
    setHistory(loadHistory());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewReady, game?.id]);

  // Frecce della tastiera nella revisione.
  useEffect(() => {
    if (phase !== 'review') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setCursor((c) => Math.max(0, c - 1));
      else if (e.key === 'ArrowRight') setCursor((c) => Math.min(moves.length, c + 1));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, moves.length]);

  // ---------------------------------------------------------------- azioni
  const start = (from: string[] = startMoves) => {
    opponentEngine.cancelAll();
    const lineName = target ? target.lineName : from.length ? lineNameOf(pathFromRoot(findInBook(opening.root, buildPlies(opening, from).at(-1)?.fenAfter ?? opening.root.fen) ?? opening.root)) : undefined;
    setGame({ id: newId(), date: new Date().toISOString(), openingId: opening.id, lineName, elo: settings.elo, moves: [], result: '' });
    setMoves(from);
    setHintStage(0);
    setCoach(null);
    setPhase('play');
  };

  const play = (san: string) => {
    setMoves((m) => [...m, san]);
    setHintStage(0);
    setFocusUci(null);
  };

  const onMove = (from: string, to: string) => {
    if (phase !== 'play' || !myTurn || outcome.over) return false;
    const san = sanOf(fen, from, to);
    if (!san) return false;
    play(san);
    return true;
  };

  /** Torna a prima della tua ultima mossa (o della semimossa `index`). */
  const takeBack = (index?: number) => {
    opponentEngine.cancelAll();
    let i = index ?? plies.length - 1;
    if (index === undefined) while (i >= 0 && plies[i].white !== myWhite) i--;
    if (i < 0) return;
    // Riprovare dalla revisione è una nuova partita nello storico.
    if (phase === 'review' && game) setGame({ ...game, id: newId(), date: new Date().toISOString(), result: '', accuracy: undefined });
    setMoves(moves.slice(0, i));
    setHintStage(0);
    setPhase('play');
  };

  const finish = (result = outcome.text ?? 'Partita interrotta') => {
    opponentEngine.cancelAll();
    if (!game) return;
    const g = { ...game, moves, result };
    setGame(g);
    saveGame(g);
    setHistory(loadHistory());
    setCursor(moves.length);
    setPhase('review');
  };

  const openFromHistory = (g: SimGame) => {
    setGame(g);
    setMoves(g.moves);
    setCursor(g.moves.length);
    setPhase('review');
  };

  const copyPgn = async () => {
    if (!game) return;
    try {
      await navigator.clipboard.writeText(toPgn(opening, { ...game, moves }, myWhite));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // appunti non disponibili
    }
  };

  // ================================================================ SETUP
  if (phase === 'setup') {
    return (
      <div className="sim-setup">
        <section className="sim-card">
          <h2>🎮 Simulatore</h2>
          <p className="muted">
            Gioca la tua apertura contro Stockfish. Finché c'è teoria l'avversario segue il repertorio; quando la linea finisce
            continua Stockfish al livello che scegli. Il coach ti consiglia le mosse e alla fine c'è la revisione della partita.
          </p>

          <label className="sim-field">
            <span>Linea da giocare</span>
            <select value={lineId} onChange={(e) => setLineId(e.target.value)}>
              <option value="">🎲 A caso (prima le linee che conosci meno)</option>
              {lines.map(({ node, depth }) => (
                <option key={node.id} value={node.id}>
                  {'  '.repeat(depth)}
                  {node.lineName}
                </option>
              ))}
            </select>
          </label>
          {target && <p className="muted small">{formatPath(pathFromRoot(target))}</p>}

          {startMoves.length > 0 && (
            <p className="sim-start-from small">
              Partenza dalla posizione di Esplora: <strong>{formatPath(pathFromRoot(findInBook(opening.root, buildPlies(opening, startMoves).at(-1)!.fenAfter) ?? opening.root)) || startMoves.join(' ')}</strong>{' '}
              <button className="link" onClick={() => setStartMoves([])}>
                parti dall'inizio
              </button>
            </p>
          )}

          <label className="sim-field">
            <span>
              Avversario: <strong>Stockfish {settings.elo}</strong> <span className="muted">· {eloLabel(settings.elo)}</span>
            </span>
            <input
              type="range"
              min={SIM_ELO_MIN}
              max={SIM_ELO_MAX}
              step={50}
              value={settings.elo}
              onChange={(e) => setSettings({ ...settings, elo: Number(e.target.value) })}
            />
            <span className="sim-elo-scale muted small">
              <span>{SIM_ELO_MIN}</span>
              <span>{SIM_ELO_MAX}</span>
            </span>
          </label>

          <fieldset className="sim-field">
            <legend>Suggerimenti del coach</legend>
            {(
              [
                ['off', 'Nessuno', 'partita vera, senza aiuti'],
                ['request', 'Su richiesta', 'col pulsante 💡: prima il pezzo, poi la mossa'],
                ['always', 'Sempre visibili', 'le 3 mosse migliori a ogni turno'],
              ] as [HintMode, string, string][]
            ).map(([id, label, desc]) => (
              <label key={id} className="sim-radio">
                <input type="radio" name="hints" checked={settings.hints === id} onChange={() => setSettings({ ...settings, hints: id })} />
                <span>
                  {label} <span className="muted small">— {desc}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="toggle-inline">
            <input type="checkbox" checked={settings.evalBar} onChange={(e) => setSettings({ ...settings, evalBar: e.target.checked })} /> Mostra la barra di
            valutazione durante la partita
          </label>
          <label className="toggle-inline">
            <input type="checkbox" checked={settings.arrows} onChange={(e) => setSettings({ ...settings, arrows: e.target.checked })} /> Frecce sulla
            scacchiera per le mosse consigliate (come l'engine di chess.com)
          </label>

          <button className="primary sim-start" onClick={() => start()}>
            ▶ Inizia la partita
          </button>
        </section>

        {history.filter((g) => g.openingId === opening.id).length > 0 && (
          <section className="sim-card">
            <h3>Partite recenti</h3>
            <div className="sim-history">
              {history
                .filter((g) => g.openingId === opening.id)
                .slice(0, 10)
                .map((g) => (
                  <button key={g.id} className="sim-history-row" onClick={() => openFromHistory(g)}>
                    <span>
                      <strong>{g.lineName ?? opening.name}</strong>
                      <span className="muted small">
                        {' '}
                        · Stockfish {g.elo} · {new Date(g.date).toLocaleDateString('it-IT')}
                      </span>
                    </span>
                    <span className="small">
                      {g.result}
                      {g.accuracy?.me !== undefined && <> · precisione {g.accuracy.me.toFixed(1)}</>}
                    </span>
                  </button>
                ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ================================================================ PARTITA / REVISIONE
  const reviewing = phase === 'review';
  const shown = reviewing ? cursor : moves.length;
  const shownFen = fens[shown];
  const shownEval = evals[shownFen];
  const lastPly = shown > 0 ? plies[shown - 1] : undefined;
  const lastQ = shown > 0 ? qualities[shown - 1] : undefined;

  const arrows: Arrow[] = [];
  const marks: Record<string, string> = {};
  const highlights: { square: string; color: string }[] = [];
  if (lastPly && lastQ) marks[lastPly.uci.slice(2, 4)] = SIM_QUALITY[lastQ].color + '99';

  // Suggerimento: prima il pezzo, poi la freccia.
  const suggestion: { uci: string; book: boolean } | undefined =
    !reviewing && myTurn
      ? bookMovesHere[0]?.isUserMove
        ? { uci: bookMovesHere[0].from + bookMovesHere[0].to, book: true }
        : coachHere?.[0]
          ? { uci: coachHere[0].uci, book: false }
          : undefined
      : undefined;
  if (suggestion && hintStage >= 1) highlights.push({ square: suggestion.uci.slice(0, 2), color: HINT_SQUARE });
  if (suggestion && hintStage >= 2) arrows.push({ from: suggestion.uci.slice(0, 2), to: suggestion.uci.slice(2, 4), color: suggestion.book ? BOOK_ARROW : HINT_ARROW });

  // Frecce dell'engine (come su chess.com): le 3 migliori di Stockfish e le mosse del repertorio,
  // ogni volta che il coach è visibile. La mossa sotto il dito/mouse resta piena, le altre si attenuano.
  const coachVisible = !reviewing && myTurn && !outcome.over && (settings.hints === 'always' || hintStage >= 2);
  if (coachVisible && settings.arrows) {
    arrows.length = 0;
    const seen = new Set<string>();
    const add = (uci: string, color: string) => {
      const key = uci.slice(0, 4);
      if (seen.has(key)) return;
      seen.add(key);
      const dim = focusUci && focusUci.slice(0, 4) !== key;
      arrows.push({ from: uci.slice(0, 2), to: uci.slice(2, 4), color: dim ? 'rgba(120, 120, 120, 0.25)' : color });
    };
    bookMovesHere.filter((n) => n.isUserMove).forEach((n) => add(n.from + n.to, BOOK_ARROW_COLOR));
    coachHere?.forEach((l, i) => add(l.uci, ENGINE_ARROW_COLORS[i] ?? ENGINE_ARROW_COLORS[2]));
  }

  // In revisione: freccia blu con la mossa migliore quando quella giocata non lo era.
  if (reviewing && lastPly && lastQ && lastQ !== 'libro' && lastQ !== 'migliore') {
    const best = evals[fens[shown - 1]]?.best;
    if (best) arrows.push({ from: best.slice(0, 2), to: best.slice(2, 4), color: HINT_ARROW });
  }

  // Ultima mossa mia, per il riscontro durante la partita.
  let myLast = plies.length - 1;
  while (myLast >= 0 && plies[myLast].white !== myWhite) myLast--;

  // "Fine della teoria": la linea è finita (non per una tua deviazione) e non hai ancora risposto a Stockfish.
  const firstOut = plies.findIndex((p) => !p.book);
  const theoryJustEnded =
    !book && plies.length > 0 && (firstOut === -1 || (firstOut === plies.length - 1 && plies[firstOut].white !== myWhite));

  return (
    <div className="layout two sim">
      <div className="board-col">
        {(reviewing || settings.evalBar) && <EvalBar scoreWhite={shownEval?.scoreWhite} mateWhite={shownEval?.mateWhite} />}
        <Board
          fen={shownFen}
          orientation={opening.color}
          onMove={reviewing ? undefined : onMove}
          arrows={arrows}
          highlights={highlights}
          marks={marks}
          lastMove={lastPly ? { from: lastPly.uci.slice(0, 2), to: lastPly.uci.slice(2, 4) } : undefined}
        />
        {reviewing ? (
          <div className="controls">
            <button onClick={() => setCursor(0)} title="Inizio">⏮</button>
            <button onClick={() => setCursor((c) => Math.max(0, c - 1))} title="Indietro (←)">◀</button>
            <button onClick={() => setCursor((c) => Math.min(moves.length, c + 1))} title="Avanti (→)">▶</button>
            <button onClick={() => setCursor(moves.length)} title="Fine">⏭</button>
          </div>
        ) : (
          <div className="controls">
            {settings.hints !== 'off' && (
              <button onClick={() => setHintStage((s) => Math.min(2, s + 1))} disabled={!myTurn || outcome.over || hintStage >= 2}>
                💡 {hintStage === 0 ? 'Suggerimento' : 'Mostra la mossa'}
              </button>
            )}
            <button onClick={() => takeBack()} disabled={myLast < 0}>
              ↶ Annulla mossa
            </button>
            <button onClick={() => finish()}>{outcome.over ? '📊 Revisione partita' : '🏁 Termina e analizza'}</button>
            {settings.hints !== 'off' && (
              <label className="toggle-inline">
                <input type="checkbox" checked={settings.arrows} onChange={(e) => setSettings({ ...settings, arrows: e.target.checked })} /> Frecce
                delle mosse migliori
              </label>
            )}
          </div>
        )}
      </div>

      <div className="side">
        {/* Stato della partita */}
        {!reviewing && (
          <div className={`book-status ${book ? 'in' : 'out'}`}>
            {book
              ? `📗 Teoria${lineNameOf(pathFromRoot(book)) ? ` — ${lineNameOf(pathFromRoot(book))}` : ''}`
              : `⚔️ Contro Stockfish ${game?.elo} (${eloLabel(game?.elo ?? 0)})`}
          </div>
        )}
        {!reviewing && theoryJustEnded && !outcome.over && (
          <p className="feedback">📕 Fine della teoria: da qui l'avversario gioca con Stockfish. Ora tocca a te trovare il piano!</p>
        )}

        {!reviewing && outcome.over && (
          <div className="feedback done">
            🏁 {outcome.text}.{' '}
            <button className="primary" onClick={() => finish()}>
              📊 Revisione partita
            </button>
          </div>
        )}

        {!reviewing && myLast >= 0 && (
          <MoveFeedback
            opening={opening}
            plies={plies}
            index={myLast}
            quality={qualities[myLast]}
            before={evals[fens[myLast]]}
            onRetry={() => takeBack(myLast)}
          />
        )}

        {!reviewing && !outcome.over && !myTurn && <p className="muted small">L'avversario sta pensando…</p>}

        {coachVisible && (
          <CoachPanel
            book={bookMovesHere.filter((n) => n.isUserMove)}
            lines={coachHere}
            onPlay={play}
            onFocus={setFocusUci}
            arrowChips={settings.arrows}
          />
        )}

        {reviewing && (
          <ReviewSummary
            result={game?.result ?? ''}
            oppLabel={`Stockfish ${game?.elo ?? 0}`}
            meAcc={reviewReady ? accuracyOf(myWhite) : undefined}
            oppAcc={reviewReady ? accuracyOf(!myWhite) : undefined}
            progress={`${analyzed}/${fens.length}`}
            ready={reviewReady}
            plies={plies}
            qualities={qualities}
            myWhite={myWhite}
          />
        )}
        {reviewing && (
          <EvalGraph
            values={fens.map((f) => (evals[f] ? winPercent(evals[f].scoreWhite) : undefined))}
            cursor={cursor}
            onSelect={setCursor}
            marks={plies.flatMap((_p, i) => {
              const q = qualities[i];
              return q === 'errore' || q === 'grave' ? [{ index: i + 1, color: SIM_QUALITY[q].color }] : [];
            })}
          />
        )}

        <div className="moves">
          {moves.length === 0 && <span className="muted">Posizione iniziale</span>}
          {plies.map((p, i) => {
            const q = qualities[i];
            const info = q ? SIM_QUALITY[q] : undefined;
            return (
              <span key={i} className="move-wrap">
                {i % 2 === 0 && <span className="move-num">{i / 2 + 1}.</span>}
                <button
                  className={`move ${reviewing && i + 1 === cursor ? 'active' : ''}`}
                  onClick={() => reviewing && setCursor(i + 1)}
                  style={info && q !== 'libro' && q !== 'buona' && q !== 'migliore' ? { color: info.color, fontWeight: 700 } : undefined}
                >
                  {q === 'libro' && <span className="sim-book-dot" title="Libro" />}
                  {p.san}
                  {info?.symbol}
                </button>
              </span>
            );
          })}
        </div>

        {reviewing && lastPly && (
          <ReviewMove
            ply={lastPly}
            index={cursor - 1}
            quality={lastQ}
            before={evals[fens[cursor - 1]]}
            mine={lastPly.white === myWhite}
            onRetry={() => takeBack(cursor - 1)}
            expected={(() => {
              const n = findInBook(opening.root, lastPly.fenBefore);
              return n ? nextMoves(n) : [];
            })()}
          />
        )}

        {reviewing && reviewReady && (
          <KeyMoments
            plies={plies}
            qualities={qualities}
            myWhite={myWhite}
            onSelect={setCursor}
          />
        )}

        {reviewing && (
          <div className="controls">
            <button className="primary" onClick={() => start(startMoves)}>
              🔄 Nuova partita
            </button>
            <button onClick={() => { setPhase('setup'); setMoves([]); }}>⚙️ Impostazioni</button>
            <button onClick={copyPgn}>{copied ? '✓ PGN copiato' : '📋 Copia PGN'}</button>
          </div>
        )}
        {!reviewing && (
          <button className="link" onClick={() => { opponentEngine.cancelAll(); engine.cancelAll(); setPhase('setup'); setMoves([]); }}>
            ⚙️ Cambia linea o livello
          </button>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ sottocomponenti

function MoveFeedback({
  opening,
  plies,
  index,
  quality,
  before,
  onRetry,
}: {
  opening: Opening;
  plies: SimPly[];
  index: number;
  quality?: SimQuality;
  before?: PosEval;
  onRetry: () => void;
}) {
  const p = plies[index];
  const bookBefore = bookNode(opening, plies.slice(0, index));
  const expected: OpeningNode[] = bookBefore ? nextMoves(bookBefore) : [];
  const deviated = !p.book && expected.length > 0;
  const info = quality ? SIM_QUALITY[quality] : undefined;
  const node = p.book ? findInBook(opening.root, p.fenAfter) : undefined;
  const bestSan = before?.best && before.best !== p.uci ? sanFromUci(p.fenBefore, before.best) : undefined;
  const bad = quality === 'imprecisione' || quality === 'errore' || quality === 'grave';

  return (
    <div className={`sim-feedback ${bad || deviated ? 'bad' : 'good'}`} style={info ? { borderLeftColor: info.color } : undefined}>
      <div className="sim-feedback-head">
        <span className="sim-q-icon" style={info ? { background: info.color } : undefined}>
          {info?.icon ?? '…'}
        </span>
        <strong>
          {p.san}
          {info?.symbol}
        </strong>
        <span>{info ? info.label : 'Stockfish sta valutando…'}</span>
      </div>
      {node?.comment && <p className="small">{node.comment}</p>}
      {deviated && (
        <p className="small">
          📕 Hai lasciato il repertorio: la teoria prevede <strong>{expected.map((n) => n.san).join(' o ')}</strong>.
        </p>
      )}
      {!p.book && bestSan && quality && quality !== 'migliore' && (
        <p className="small">
          Stockfish preferiva <strong>{bestSan}</strong>
          {before?.line ? <span className="muted"> ({before.line})</span> : null}.
        </p>
      )}
      {(bad || deviated) && (
        <div className="controls">
          <button onClick={onRetry}>↶ Riprova</button>
          <WhyButton fen={p.fenBefore} san={p.san} expected={expected} />
        </div>
      )}
    </div>
  );
}
