import type { OpeningNode } from '../model/types';
import { SIM_QUALITY, SIM_QUALITY_ORDER, type PosEval, type SimPly, type SimQuality } from '../core/simulation';
import { sanFromUci } from '../engine/simEngine';
import { formatScore } from '../engine/stockfish';
import { WhyButton } from './Explanation';

/** Pezzi della revisione di una partita (Simulatore e Analisi). */

export function ReviewSummary({
  result,
  meLabel = 'La tua precisione',
  oppLabel,
  meAcc,
  oppAcc,
  progress,
  ready,
  plies,
  qualities,
  myWhite,
}: {
  result: string;
  meLabel?: string;
  oppLabel: string;
  meAcc?: number;
  oppAcc?: number;
  progress: string;
  ready: boolean;
  plies: SimPly[];
  qualities: (SimQuality | undefined)[];
  myWhite: boolean;
}) {
  const count = (q: SimQuality, white: boolean) => plies.filter((p, i) => p.white === white && qualities[i] === q).length;
  return (
    <div className="sim-summary">
      <div className="sim-result">{result}</div>
      {!ready && <p className="muted small">Stockfish sta analizzando la partita… {progress}</p>}
      <div className="sim-acc">
        <div>
          <span className="sim-acc-num">{meAcc !== undefined ? meAcc.toFixed(1) : '—'}</span>
          <span className="muted small">{meLabel}</span>
        </div>
        <div>
          <span className="sim-acc-num opp">{oppAcc !== undefined ? oppAcc.toFixed(1) : '—'}</span>
          <span className="muted small">{oppLabel}</span>
        </div>
      </div>
      <table className="sim-table">
        <thead>
          <tr>
            <th />
            <th>Tu</th>
            <th>Avv.</th>
          </tr>
        </thead>
        <tbody>
          {SIM_QUALITY_ORDER.map((q) => (
            <tr key={q}>
              <td>
                <span className="sim-q-icon small" style={{ background: SIM_QUALITY[q].color }}>
                  {SIM_QUALITY[q].icon}
                </span>{' '}
                {SIM_QUALITY[q].label}
              </td>
              <td>{count(q, myWhite)}</td>
              <td>{count(q, !myWhite)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReviewMove({
  ply,
  quality,
  before,
  mine,
  onRetry,
  expected,
}: {
  ply: SimPly;
  index: number;
  quality?: SimQuality;
  before?: PosEval;
  mine: boolean;
  /** "Riprova da qui" (solo dove ha senso, es. nel Simulatore). */
  onRetry?: () => void;
  expected: OpeningNode[];
}) {
  const info = quality ? SIM_QUALITY[quality] : undefined;
  const bestSan = before?.best && before.best !== ply.uci ? sanFromUci(ply.fenBefore, before.best) : undefined;
  const bad = quality === 'imprecisione' || quality === 'errore' || quality === 'grave';
  return (
    <div className="sim-feedback" style={info ? { borderLeftColor: info.color } : undefined}>
      <div className="sim-feedback-head">
        <span className="sim-q-icon" style={info ? { background: info.color } : undefined}>
          {info?.icon ?? '…'}
        </span>
        <strong>
          {ply.san}
          {info?.symbol}
        </strong>
        <span>
          {info?.label ?? 'in analisi'} {mine ? '(tu)' : '(avversario)'}
        </span>
      </div>
      {bestSan && quality !== 'libro' && quality !== 'migliore' && (
        <p className="small">
          Migliore era <strong>{bestSan}</strong> ({formatScore(ply.white ? before!.scoreWhite : -before!.scoreWhite)} per chi muove)
          {before?.line ? <span className="muted"> · {before.line}</span> : null}
        </p>
      )}
      {mine && bad && (
        <div className="controls">
          {onRetry && <button onClick={onRetry}>↶ Riprova da qui</button>}
          <WhyButton fen={ply.fenBefore} san={ply.san} expected={expected} />
        </div>
      )}
    </div>
  );
}

export function KeyMoments({
  plies,
  qualities,
  myWhite,
  onSelect,
}: {
  plies: SimPly[];
  qualities: (SimQuality | undefined)[];
  myWhite: boolean;
  onSelect: (cursor: number) => void;
}) {
  const moments = plies
    .map((p, i) => ({ p, i, q: qualities[i] }))
    .filter(({ p, q }) => p.white === myWhite && (q === 'imprecisione' || q === 'errore' || q === 'grave'));
  return (
    <div className="sim-moments">
      <h3>Momenti chiave</h3>
      {moments.length === 0 ? (
        <p className="muted small">Nessun errore: complimenti! 🎉</p>
      ) : (
        moments.map(({ p, i, q }) => (
          <button key={i} className="sim-moment" onClick={() => onSelect(i + 1)}>
            <span className="sim-q-icon small" style={{ background: SIM_QUALITY[q!].color }}>
              {SIM_QUALITY[q!].icon}
            </span>
            {Math.floor(i / 2) + 1}
            {p.white ? '.' : '...'}
            {p.san} · {SIM_QUALITY[q!].label}
          </button>
        ))
      )}
    </div>
  );
}
