import { useState, type ChangeEvent } from 'react';
import { Icon } from '../../components/Icon';
import {
  archiveLabel,
  detectMyColor,
  fetchArchives,
  fetchMonth,
  myOutcome,
  parseGames,
  TIME_CLASS,
  type AnalyzedGame,
  type ImportedGame,
} from '../../core/analysis';

/** Importazione delle partite (chess.com o PGN) e archivio di quelle già analizzate. */

function GameRow({ g, myWhite, analyzed, onOpen }: { g: ImportedGame; myWhite?: boolean; analyzed?: AnalyzedGame; onOpen: () => void }) {
  const out = myOutcome(g, myWhite);
  const meAcc = analyzed?.accuracy && myWhite !== undefined ? (myWhite ? analyzed.accuracy.white : analyzed.accuracy.black) : undefined;
  return (
    <button className="game-row" onClick={onOpen}>
      <span className={`game-result ${out ?? ''}`}>{out === 'vinta' ? 'V' : out === 'persa' ? 'P' : out === 'patta' ? '½' : '·'}</span>
      <span className="game-main">
        <span className="game-players">
          <span className={myWhite === true ? 'me' : ''}><Icon name="white" /> {g.white}{g.whiteElo ? ` (${g.whiteElo})` : ''}</span>
          <span className={myWhite === false ? 'me' : ''}><Icon name="black" /> {g.black}{g.blackElo ? ` (${g.blackElo})` : ''}</span>
        </span>
        <span className="muted small">
          {[g.date && new Date(g.date).toLocaleDateString('it-IT'), g.timeClass && (TIME_CLASS[g.timeClass] ?? g.timeClass), `${Math.ceil(g.moves.length / 2)} mosse`, g.openingName]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <span className="game-cta small">{meAcc !== undefined ? `${meAcc.toFixed(1)}%` : analyzed ? 'Rivedi' : <>Analizza <Icon name="arrowRight" /></>}</span>
    </button>
  );
}

export function ChessComImport({
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
      <h3><Icon name="knight" /> Da chess.com</h3>
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

export function PgnImport({ onOpen }: { onOpen: (g: ImportedGame) => void }) {
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
      <h3><Icon name="paste" /> Incolla o apri un PGN</h3>
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
          <Icon name="folder" /> Apri file .pgn
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
            Tocca <b>Copia</b>, torna qui e incolla nel riquadro sopra (oppure salva il file e aprilo con <Icon name="folder" />).
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

export function Library({ games, onOpen, onRemove }: { games: AnalyzedGame[]; onOpen: (g: AnalyzedGame) => void; onRemove: (id: string) => void }) {
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
