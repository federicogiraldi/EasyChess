import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { Arrow, Opening } from '../model/types';
import {
  archiveLabel,
  detectMyColor,
  fetchArchives,
  fetchMonth,
  loadLibrary,
  loadUsername,
  matchRepertoire,
  myOutcome,
  parseGames,
  removeFromLibrary,
  resultText,
  saveToLibrary,
  saveUsername,
  TIME_CLASS,
  type AnalyzedGame,
  type ImportedGame,
} from '../core/analysis';
import { buildPliesFrom, classifyMove, gameAccuracy, moveAccuracy, SIM_QUALITY, winPercent, type PosEval, type SimQuality } from '../core/simulation';
import { findInBook, lineNameOf, nextMoves, pathFromRoot } from '../core/tree';
import { evalPosition, sanFromUci } from '../engine/simEngine';
import { engine } from '../engine/stockfish';
import { Board } from '../components/Board';
import { EvalBar } from '../components/Explanation';
import { EvalGraph } from '../components/EvalGraph';
import { KeyMoments, ReviewMove, ReviewSummary } from '../components/ReviewParts';
import './simulator.css';
import './analysis.css';

interface Props {
  openings: Opening[];
  /** Apre il Laboratorio / il Simulatore di un'apertura del repertorio da questa sequenza di mosse. */
  onOpenMode: (openingId: string, mode: 'lab' | 'sim', moves: string[]) => void;
}

const BEST_ARROW = 'rgba(37, 99, 235, 0.8)';

/** 📊 Analisi: importa le tue partite (chess.com o PGN) e analizzale con Stockfish. */
export function Analysis({ openings, onOpenMode }: Props) {
  const [game, setGame] = useState<AnalyzedGame | null>(null);
  const [library, setLibrary] = useState<AnalyzedGame[]>(loadLibrary);
  const [username, setUsername] = useState(loadUsername);

  const open = (g: ImportedGame | AnalyzedGame) => {
    const saved = library.find((x) => x.id === g.id);
    const myWhite = saved?.myWhite ?? ('myWhite' in g ? g.myWhite : undefined) ?? detectMyColor(g, username);
    setGame({ ...g, ...saved, myWhite });
    window.scrollTo({ top: 0 });
  };

  if (game) {
    return (
      <GameAnalysis
        key={game.id}
        game={game}
        openings={openings}
        onChange={(g) => {
          setGame(g);
          setLibrary(saveToLibrary(g));
        }}
        onBack={() => {
          engine.cancelAll();
          setGame(null);
        }}
        onOpenMode={onOpenMode}
      />
    );
  }

  return (
    <div className="analysis-home">
      <section className="hero">
        <h1>📊 Analisi delle partite</h1>
        <p className="muted">
          Carica le tue partite di chess.com (o qualsiasi PGN) e Stockfish le analizza: precisione, errori, mosse migliori e il
          confronto con il tuo repertorio.
        </p>
      </section>
      <div className="analysis-grid">
        <ChessComImport
          username={username}
          onUsername={(u) => {
            setUsername(u);
            saveUsername(u);
          }}
          library={library}
          onOpen={open}
        />
        <PgnImport onOpen={open} />
      </div>
      <Library
        games={library}
        onOpen={open}
        onRemove={(id) => setLibrary(removeFromLibrary(id))}
      />
    </div>
  );
}

// ------------------------------------------------------------------ importazione

function GameRow({ g, myWhite, analyzed, onOpen }: { g: ImportedGame; myWhite?: boolean; analyzed?: AnalyzedGame; onOpen: () => void }) {
  const out = myOutcome(g, myWhite);
  const meAcc = analyzed?.accuracy && myWhite !== undefined ? (myWhite ? analyzed.accuracy.white : analyzed.accuracy.black) : undefined;
  return (
    <button className="game-row" onClick={onOpen}>
      <span className={`game-result ${out ?? ''}`}>{out === 'vinta' ? 'V' : out === 'persa' ? 'P' : out === 'patta' ? '½' : '·'}</span>
      <span className="game-main">
        <span className="game-players">
          <span className={myWhite === true ? 'me' : ''}>⚪ {g.white}{g.whiteElo ? ` (${g.whiteElo})` : ''}</span>
          <span className={myWhite === false ? 'me' : ''}>⚫ {g.black}{g.blackElo ? ` (${g.blackElo})` : ''}</span>
        </span>
        <span className="muted small">
          {[g.date && new Date(g.date).toLocaleDateString('it-IT'), g.timeClass && (TIME_CLASS[g.timeClass] ?? g.timeClass), `${Math.ceil(g.moves.length / 2)} mosse`, g.openingName]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <span className="game-cta small">{meAcc !== undefined ? `${meAcc.toFixed(1)}%` : analyzed ? 'Rivedi' : 'Analizza →'}</span>
    </button>
  );
}

function ChessComImport({
  username,
  onUsername,
  library,
  onOpen,
}: {
  username: string;
  onUsername: (u: string) => void;
  library: AnalyzedGame[];
  onOpen: (g: ImportedGame) => void;
}) {
  const [input, setInput] = useState(username);
  const [archives, setArchives] = useState<string[] | null>(null);
  const [month, setMonth] = useState('');
  const [games, setGames] = useState<ImportedGame[] | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | string>('idle');

  const loadMonth = async (url: string) => {
    setMonth(url);
    setState('loading');
    try {
      setGames(await fetchMonth(url));
      setState('idle');
    } catch (e) {
      setState(e instanceof Error ? e.message : String(e));
    }
  };

  const loadUser = async () => {
    const u = input.trim();
    if (!u) return;
    onUsername(u);
    setState('loading');
    setGames(null);
    try {
      const list = await fetchArchives(u);
      setArchives(list);
      if (list.length === 0) setState('Nessuna partita trovata per questo utente.');
      else await loadMonth(list[0]);
    } catch (e) {
      setState(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="sim-card">
      <h3>♟ Da chess.com</h3>
      <p className="small muted">Scrivi il tuo nome utente: le partite pubbliche si caricano da sole, senza esportare niente.</p>
      <form
        className="cc-form"
        onSubmit={(e) => {
          e.preventDefault();
          void loadUser();
        }}
      >
        <input
          className="text-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="nome utente chess.com"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Nome utente chess.com"
        />
        <button className="primary" type="submit" disabled={state === 'loading' || !input.trim()}>
          Carica partite
        </button>
      </form>
      {archives && archives.length > 1 && (
        <select value={month} onChange={(e) => void loadMonth(e.target.value)} aria-label="Mese">
          {archives.map((a) => (
            <option key={a} value={a}>
              {archiveLabel(a)}
            </option>
          ))}
        </select>
      )}
      {state === 'loading' && <p className="muted small">Carico da chess.com…</p>}
      {state !== 'idle' && state !== 'loading' && <p className="error-text small">{state}</p>}
      {games && games.length === 0 && state === 'idle' && <p className="muted small">Nessuna partita di scacchi classici in questo mese.</p>}
      {games && games.length > 0 && (
        <div className="game-list">
          {games.map((g) => (
            <GameRow key={g.id} g={g} myWhite={detectMyColor(g, username)} analyzed={library.find((x) => x.id === g.id)} onOpen={() => onOpen(g)} />
          ))}
        </div>
      )}
    </section>
  );
}

function PgnImport({ onOpen }: { onOpen: (g: ImportedGame) => void }) {
  const [text, setText] = useState('');
  const [found, setFound] = useState<ImportedGame[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const read = (pgn: string) => {
    const { games, errors } = parseGames(pgn);
    setErrors(errors);
    if (games.length === 1 && errors.length === 0) onOpen(games[0]);
    else setFound(games);
    if (games.length === 0 && errors.length === 0) setErrors(['Nessuna partita trovata nel testo.']);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) read(await file.text());
  };

  return (
    <section className="sim-card">
      <h3>📋 Incolla o apri un PGN</h3>
      <textarea
        className="pgn-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'[Event "Live Chess"]\n[White "…"]\n…\n\n1. e4 c6 2. d4 d5 …'}
        spellCheck={false}
        autoCapitalize="none"
        aria-label="PGN della partita"
      />
      <div className="controls">
        <button className="primary" onClick={() => read(text)} disabled={!text.trim()}>
          Analizza
        </button>
        <label className="button">
          📂 Apri file .pgn
          {/* niente "accept": su iPhone/iPad i .pgn risulterebbero non selezionabili */}
          <input type="file" onChange={onFile} hidden />
        </label>
      </div>
      {errors.map((e) => (
        <p key={e} className="error-text small">
          {e}
        </p>
      ))}
      {found && found.length > 0 && (
        <div className="game-list">
          <p className="muted small">{found.length} partite nel file: scegli quale analizzare.</p>
          {found.map((g) => (
            <GameRow key={g.id} g={g} onOpen={() => onOpen(g)} />
          ))}
        </div>
      )}
      <details className="howto small">
        <summary>Come esporto una partita dall'app di chess.com?</summary>
        <ol>
          <li>Apri la partita (dal profilo → Partite, o dalla fine della partita).</li>
          <li>
            Tocca il pulsante <b>Condividi</b> e scegli <b>PGN</b>.
          </li>
          <li>
            Tocca <b>Copia</b>, torna qui e incolla nel riquadro sopra (oppure salva il file e aprilo con 📂).
          </li>
        </ol>
        <p>
          Dal sito: apri la partita → <b>Condividi</b> → <b>PGN</b> → <b>Scarica</b> o <b>Copia</b>. Più semplice ancora: usa il
          nome utente qui a fianco.
        </p>
      </details>
    </section>
  );
}

function Library({ games, onOpen, onRemove }: { games: AnalyzedGame[]; onOpen: (g: AnalyzedGame) => void; onRemove: (id: string) => void }) {
  if (games.length === 0) return null;
  return (
    <section className="sim-card library">
      <h3>Partite analizzate</h3>
      <div className="game-list">
        {games.map((g) => (
          <div key={g.id} className="library-row">
            <GameRow g={g} myWhite={g.myWhite} analyzed={g} onOpen={() => onOpen(g)} />
            <button className="link" onClick={() => onRemove(g.id)} aria-label="Elimina dalla lista">
              Elimina
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ analisi di una partita

function GameAnalysis({
  game,
  openings,
  onChange,
  onBack,
  onOpenMode,
}: {
  game: AnalyzedGame;
  openings: Opening[];
  onChange: (g: AnalyzedGame) => void;
  onBack: () => void;
  onOpenMode: Props['onOpenMode'];
}) {
  const myWhite = game.myWhite;
  const match = useMemo(() => matchRepertoire(openings, game, myWhite), [openings, game, myWhite]);
  const plies = useMemo(() => buildPliesFrom(game.startFen, game.moves, match?.opening.root), [game, match]);
  const fens = useMemo(() => [game.startFen, ...plies.map((p) => p.fenAfter)], [game.startFen, plies]);
  const [evals, setEvals] = useState<Record<string, PosEval>>({});
  const [cursor, setCursor] = useState(0);
  const pending = useRef(new Set<string>());

  // Valuta tutte le posizioni, in ordine (Stockfish ne fa una alla volta).
  useEffect(() => {
    for (const f of fens) {
      if (evals[f] || pending.current.has(f)) continue;
      pending.current.add(f);
      evalPosition(f)
        .then((e) => setEvals((s) => ({ ...s, [f]: e })), () => {})
        .finally(() => pending.current.delete(f));
    }
  }, [fens, evals]);
  useEffect(() => () => engine.cancelAll(), []);

  const qualities: (SimQuality | undefined)[] = plies.map((p, i) => {
    if (p.book) return 'libro';
    const b = evals[fens[i]];
    const a = evals[fens[i + 1]];
    return b && a ? classifyMove(b, a, p.uci, p.white) : undefined;
  });
  const analyzed = fens.filter((f) => evals[f]).length;
  const ready = analyzed === fens.length;

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

  // Analisi completa: salva nell'archivio con la precisione.
  useEffect(() => {
    if (!ready) return;
    onChange({ ...game, openingId: match?.opening.id, accuracy: { white: accuracyOf(true), black: accuracyOf(false) }, analyzedAt: new Date().toISOString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, myWhite]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') setCursor((c) => Math.max(0, c - 1));
      else if (e.key === 'ArrowRight') setCursor((c) => Math.min(plies.length, c + 1));
      else if (e.key === 'Home') setCursor(0);
      else if (e.key === 'End') setCursor(plies.length);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [plies.length]);

  const shownFen = fens[cursor];
  const shownEval = evals[shownFen];
  const ply = cursor > 0 ? plies[cursor - 1] : undefined;
  const q = cursor > 0 ? qualities[cursor - 1] : undefined;
  const arrows: Arrow[] = [];
  const marks: Record<string, string> = {};
  if (ply && q) marks[ply.uci.slice(2, 4)] = SIM_QUALITY[q].color + '99';
  if (ply && q && q !== 'libro' && q !== 'migliore') {
    const best = evals[fens[cursor - 1]]?.best;
    if (best) arrows.push({ from: best.slice(0, 2), to: best.slice(2, 4), color: BEST_ARROW });
  }

  // Confronto con il repertorio: chi è uscito dalla teoria, e dove.
  const firstOut = plies.findIndex((p) => !p.book);
  const deviation = match && firstOut >= 0 ? plies[firstOut] : undefined;
  const deviationByMe = deviation && myWhite !== undefined && deviation.white === myWhite;
  const bookBefore = deviation && match ? findInBook(match.opening.root, deviation.fenBefore) : undefined;
  const expectedThere = bookBefore ? nextMoves(bookBefore) : [];
  const lineName = match && bookBefore ? lineNameOf(pathFromRoot(bookBefore)) : undefined;
  const moveNo = (i: number) => `${Math.floor(i / 2) + 1}${plies[i].white ? '.' : '...'}${plies[i].san}`;
  const meName = myWhite === undefined ? undefined : myWhite ? game.white : game.black;
  const oppName = myWhite === undefined ? undefined : myWhite ? game.black : game.white;

  return (
    <div className="layout two sim">
      <div className="board-col">
        <EvalBar scoreWhite={shownEval?.scoreWhite} mateWhite={shownEval?.mateWhite} />
        <Board
          fen={shownFen}
          orientation={myWhite === false ? 'black' : 'white'}
          arrows={arrows}
          marks={marks}
          lastMove={ply ? { from: ply.uci.slice(0, 2), to: ply.uci.slice(2, 4) } : undefined}
        />
        <div className="controls">
          <button onClick={() => setCursor(0)} title="Inizio">⏮</button>
          <button onClick={() => setCursor((c) => Math.max(0, c - 1))} title="Indietro (←)">◀</button>
          <button onClick={() => setCursor((c) => Math.min(plies.length, c + 1))} title="Avanti (→)">▶</button>
          <button onClick={() => setCursor(plies.length)} title="Fine">⏭</button>
          <button onClick={onBack}>← Le mie partite</button>
        </div>
      </div>

      <div className="side">
        <div className="analysis-head">
          <div>
            <strong>
              ⚪ {game.white}
              {game.whiteElo ? ` (${game.whiteElo})` : ''} – ⚫ {game.black}
              {game.blackElo ? ` (${game.blackElo})` : ''}
            </strong>
            <div className="muted small">
              {[game.date && new Date(game.date).toLocaleDateString('it-IT'), game.timeClass && (TIME_CLASS[game.timeClass] ?? game.timeClass), game.openingName].filter(Boolean).join(' · ')}
              {game.url && (
                <>
                  {' · '}
                  <a href={game.url} target="_blank" rel="noreferrer">
                    apri su chess.com
                  </a>
                </>
              )}
            </div>
          </div>
          <div className="seg" role="group" aria-label="Con che colore giocavi">
            <span className="muted small">Io ero:</span>
            <button className={myWhite === true ? 'active' : ''} onClick={() => onChange({ ...game, myWhite: true })}>
              ⚪ Bianco
            </button>
            <button className={myWhite === false ? 'active' : ''} onClick={() => onChange({ ...game, myWhite: false })}>
              ⚫ Nero
            </button>
          </div>
        </div>

        {myWhite === undefined && (
          <p className="feedback">Con che colore giocavi? Sceglilo qui sopra: serve per la tua precisione e per il confronto col repertorio.</p>
        )}

        {match && (
          <div className={`book-status ${deviationByMe ? 'out' : 'in'}`}>
            {!deviation ? (
              <>📗 Tutta la partita è nel tuo repertorio ({match.opening.name}).</>
            ) : deviationByMe ? (
              <>
                📕 {match.opening.name}
                {lineName ? ` — ${lineName}` : ''}: sei uscito dal repertorio con <strong>{moveNo(firstOut)}</strong>
                {expectedThere.length > 0 && <> (prevedeva {expectedThere.map((n) => n.san).join(' o ')})</>}.
              </>
            ) : (
              <>
                📗 {match.opening.name}
                {lineName ? ` — ${lineName}` : ''}: hai seguito il repertorio; l'avversario ne è uscito con <strong>{moveNo(firstOut)}</strong>.
              </>
            )}
            <div className="controls book-actions">
              {deviation && <button onClick={() => setCursor(firstOut + 1)}>Vai alla mossa</button>}
              <button onClick={() => onOpenMode(match.opening.id, 'lab', game.moves.slice(0, firstOut === -1 ? plies.length : firstOut))}>
                🔬 Laboratorio da qui
              </button>
              <button onClick={() => onOpenMode(match.opening.id, 'sim', game.moves.slice(0, firstOut === -1 ? plies.length : firstOut))}>
                🎮 Rigioca da qui
              </button>
            </div>
          </div>
        )}

        <ReviewSummary
          result={resultText(game)}
          meLabel={meName ? `${meName} (tu)` : `⚪ ${game.white}`}
          oppLabel={oppName ?? `⚫ ${game.black}`}
          meAcc={ready ? accuracyOf(myWhite ?? true) : undefined}
          oppAcc={ready ? accuracyOf(!(myWhite ?? true)) : undefined}
          progress={`${analyzed}/${fens.length}`}
          ready={ready}
          plies={plies}
          qualities={qualities}
          myWhite={myWhite ?? true}
        />
        {!ready && (
          <div className="progress" aria-label="Avanzamento dell'analisi">
            <div className="bar" style={{ width: `${(analyzed / fens.length) * 100}%` }} />
          </div>
        )}

        <EvalGraph
          values={fens.map((f) => (evals[f] ? winPercent(evals[f].scoreWhite) : undefined))}
          cursor={cursor}
          onSelect={setCursor}
          marks={plies.flatMap((_p, i) => {
            const qq = qualities[i];
            return qq === 'errore' || qq === 'grave' ? [{ index: i + 1, color: SIM_QUALITY[qq].color }] : [];
          })}
        />

        <div className="moves">
          {plies.map((p, i) => {
            const qq = qualities[i];
            const info = qq ? SIM_QUALITY[qq] : undefined;
            const startsBlack = game.startFen.split(' ')[1] === 'b';
            const k = i + (startsBlack ? 1 : 0);
            const num = Number(game.startFen.split(' ')[5] ?? 1) + Math.floor(k / 2);
            return (
              <span key={i} className="move-wrap">
                {(k % 2 === 0 || i === 0) && <span className="move-num">{num}.{k % 2 === 1 ? '..' : ''}</span>}
                <button
                  className={`move ${i + 1 === cursor ? 'active' : ''}`}
                  onClick={() => setCursor(i + 1)}
                  style={info && qq !== 'libro' && qq !== 'buona' && qq !== 'migliore' ? { color: info.color, fontWeight: 700 } : undefined}
                >
                  {qq === 'libro' && <span className="sim-book-dot" title="Repertorio" />}
                  {p.san}
                  {info?.symbol}
                </button>
              </span>
            );
          })}
        </div>

        {ply && (
          <ReviewMove
            ply={ply}
            index={cursor - 1}
            quality={q}
            before={evals[fens[cursor - 1]]}
            mine={myWhite === undefined ? true : ply.white === myWhite}
            expected={(() => {
              const n = match ? findInBook(match.opening.root, ply.fenBefore) : undefined;
              return n ? nextMoves(n) : [];
            })()}
          />
        )}
        {ply && !q && <p className="muted small">Stockfish sta ancora analizzando questa mossa…</p>}
        {!ply && evals[fens[0]]?.best && (
          <p className="muted small">Posizione iniziale · Stockfish giocherebbe {sanFromUci(fens[0], evals[fens[0]].best!)}.</p>
        )}

        {ready && <KeyMoments plies={plies} qualities={qualities} myWhite={myWhite ?? true} onSelect={setCursor} />}
      </div>
    </div>
  );
}
