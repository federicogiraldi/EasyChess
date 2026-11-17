import { Icon } from '../../components/Icon';
import type { Opening, OpeningNode } from '../../model/types';
import { findInBook, formatPath, pathFromRoot } from '../../core/tree';
import { buildPlies, eloLabel, SIM_ELO_MAX, SIM_ELO_MIN, type HintMode, type SimGame, type SimSettings } from '../../core/simulation';

interface Props {
  opening: Opening;
  lines: { node: OpeningNode; depth: number }[];
  lineId: string;
  setLineId: (id: string) => void;
  target?: OpeningNode;
  /** Mosse di partenza (da Esplora): vuoto = dall'inizio. */
  startMoves: string[];
  clearStartMoves: () => void;
  settings: SimSettings;
  setSettings: (s: SimSettings) => void;
  history: SimGame[];
  start: () => void;
  openFromHistory: (g: SimGame) => void;
}

/** Schermata iniziale del Simulatore: linea, livello di Stockfish, aiuti del coach e partite recenti. */
export function SimSetup({ opening, lines, lineId, setLineId, target, startMoves, clearStartMoves, settings, setSettings, history, start, openFromHistory }: Props) {
  return (
      <div className="sim-setup">
        <section className="sim-card">
          <h2><Icon name="sim" /> Simulatore</h2>
          <p className="muted">
            Gioca la tua apertura contro Stockfish. Finché c'è teoria l'avversario segue il repertorio; quando la linea finisce
            continua Stockfish al livello che scegli. Il coach ti consiglia le mosse e alla fine c'è la revisione della partita.
          </p>

          <label className="sim-field">
            <span>Linea da giocare</span>
            <select value={lineId} onChange={(e) => setLineId(e.target.value)}>
              <option value="">A caso (prima le linee che conosci meno)</option>
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
              <button className="link" onClick={clearStartMoves}>
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
                ['request', 'Su richiesta', 'col pulsante Suggerimento: prima il pezzo, poi la mossa'],
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

          <button className="primary sim-start" onClick={start}>
            <Icon name="play" /> Inizia la partita
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
