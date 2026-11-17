import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import type { Arrow, Opening } from '../model/types';
import { findInBook, lineNameOf, namedLines, nextMoves, pathFromRoot } from '../core/tree';
import {
  bookNode,
  bookReply,
  buildPlies,
  eloLabel,
  loadHistory,
  loadSettings,
  outcomeOf,
  saveGame,
  saveSettings,
  toPgn,
  type SimGame,
  type SimSettings,
} from '../core/simulation';
import { SIM_QUALITY } from '../core/quality';
import { accuracyOf, errorMarks, qualitiesOf, winCurve } from '../core/review';
import { coachLines, opponentMove, sanFromUci, type CoachLine } from '../engine/simEngine';
import { engine, opponentEngine } from '../engine/stockfish';
import { Board } from '../components/Board';
import { sanOf } from '../core/moves';
import { EvalBar } from '../components/Explanation';
import { EvalGraph } from '../components/EvalGraph';
import { KeyMoments, QualityMoves, ReviewMove, ReviewNav, ReviewSummary } from '../components/ReviewParts';
import { BOOK_ARROW_COLOR, CoachPanel, ENGINE_ARROW_COLORS } from '../components/CoachPanel';
import { useMoveKeys, usePositionEvals } from '../components/useReview';
import { MoveFeedback } from './simulator/MoveFeedback';
import { SimSetup } from './simulator/SimSetup';
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
  const [cursor, setCursor] = useState(0);
  const [hintStage, setHintStage] = useState(0);
  const [coach, setCoach] = useState<{ fen: string; lines: CoachLine[] } | null>(null);
  const [history, setHistory] = useState<SimGame[]>(loadHistory);
  const [copied, setCopied] = useState(false);
  const [focusUci, setFocusUci] = useState<string | null>(null);

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
  const toEval = useMemo(() => (phase === 'setup' ? [] : phase === 'review' ? fens : fens.slice(-2)), [phase, fens]);
  const evals = usePositionEvals(toEval);

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
  const qualities = qualitiesOf(plies, fens, evals);
  const analyzed = fens.filter((f) => evals[f]).length;
  const reviewReady = phase === 'review' && analyzed === fens.length;

  const accuracy = (white: boolean) => accuracyOf(plies, fens, evals, white);

  // Salva la precisione nello storico quando l'analisi è completa.
  useEffect(() => {
    if (!reviewReady || !game) return;
    const g = { ...game, accuracy: { me: accuracy(myWhite), opp: accuracy(!myWhite) } };
    saveGame(g);
    setHistory(loadHistory());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewReady, game?.id]);

  // Frecce della tastiera nella revisione.
  useMoveKeys(phase === 'review', moves.length, setCursor);

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
      <SimSetup
        opening={opening}
        lines={lines}
        lineId={lineId}
        setLineId={setLineId}
        target={target}
        startMoves={startMoves}
        clearStartMoves={() => setStartMoves([])}
        settings={settings}
        setSettings={setSettings}
        history={history}
        start={() => start()}
        openFromHistory={openFromHistory}
      />
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
  if (lastPly && lastQ) marks[lastPly.uci.slice(2, 4)] = SIM_QUALITY[lastQ].color + '66';

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
          premoveColor={phase === 'play' && !outcome.over ? opening.color : undefined}
          arrows={arrows}
          highlights={highlights}
          marks={marks}
          badge={lastPly && lastQ ? { square: lastPly.uci.slice(2, 4), quality: lastQ } : undefined}
          lastMove={lastPly ? { from: lastPly.uci.slice(0, 2), to: lastPly.uci.slice(2, 4) } : undefined}
        />
        {reviewing ? (
          <ReviewNav last={moves.length} setCursor={setCursor} />
        ) : (
          <div className="controls">
            {settings.hints !== 'off' && (
              <button onClick={() => setHintStage((s) => Math.min(2, s + 1))} disabled={!myTurn || outcome.over || hintStage >= 2}>
                <Icon name="hint" /> {hintStage === 0 ? 'Suggerimento' : 'Mostra la mossa'}
              </button>
            )}
            <button onClick={() => takeBack()} disabled={myLast < 0}>
              <Icon name="undo" /> Annulla mossa
            </button>
            <button onClick={() => finish()}>{outcome.over ? <><Icon name="analysis" /> Revisione partita</> : <><Icon name="flag" /> Termina e analizza</>}</button>
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
              ? <><Icon name="inBook" /> Teoria{lineNameOf(pathFromRoot(book)) ? ` — ${lineNameOf(pathFromRoot(book))}` : ''}</>
              : <><Icon name="swords" /> Contro Stockfish {game?.elo} ({eloLabel(game?.elo ?? 0)})</>}
          </div>
        )}
        {!reviewing && theoryJustEnded && !outcome.over && (
          <p className="feedback"><Icon name="outOfBook" /> Fine della teoria: da qui l'avversario gioca con Stockfish. Ora tocca a te trovare il piano!</p>
        )}

        {!reviewing && outcome.over && (
          <div className="feedback done">
            <Icon name="flag" /> {outcome.text}.{' '}
            <button className="primary" onClick={() => finish()}>
              <Icon name="analysis" /> Revisione partita
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
            meAcc={reviewReady ? accuracy(myWhite) : undefined}
            oppAcc={reviewReady ? accuracy(!myWhite) : undefined}
            progress={`${analyzed}/${fens.length}`}
            ready={reviewReady}
            plies={plies}
            qualities={qualities}
            myWhite={myWhite}
          />
        )}
        {reviewing && (
          <EvalGraph
            values={winCurve(fens, evals)}
            cursor={cursor}
            onSelect={setCursor}
            marks={errorMarks(qualities)}
          />
        )}

        <QualityMoves
          plies={plies}
          qualities={qualities}
          startFen={opening.root.fen}
          cursor={reviewing ? cursor : undefined}
          onSelect={reviewing ? setCursor : undefined}
          empty={<span className="muted">Posizione iniziale</span>}
        />

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
              <Icon name="restart" /> Nuova partita
            </button>
            <button onClick={() => { setPhase('setup'); setMoves([]); }}><Icon name="settings" /> Impostazioni</button>
            <button onClick={copyPgn}>{copied ? <><Icon name="check" /> PGN copiato</> : <><Icon name="copy" /> Copia PGN</>}</button>
          </div>
        )}
        {!reviewing && (
          <button className="link" onClick={() => { opponentEngine.cancelAll(); engine.cancelAll(); setPhase('setup'); setMoves([]); }}>
            <Icon name="settings" /> Cambia linea o livello
          </button>
        )}
      </div>
    </div>
  );
}

