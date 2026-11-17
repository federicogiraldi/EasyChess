import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { OpeningNode } from '../model/types';
import { Icon } from './Icon';
import type { PosEval, SimPly } from '../core/simulation';
import { SIM_QUALITY, SIM_QUALITY_ORDER, type SimQuality } from '../core/quality';
import { sanFromUci } from '../engine/simEngine';
import { formatScore } from '../engine/stockfish';
import { WhyButton } from './Explanation';
import { QualityIcon } from './QualityIcon';

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
                <QualityIcon q={q} size={20} />{' '}
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
        {quality ? <QualityIcon q={quality} /> : <span className="sim-q-icon">…</span>}
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
          {onRetry && <button onClick={onRetry}><Icon name="undo" /> Riprova da qui</button>}
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
        <p className="muted small">Nessun errore: complimenti! <Icon name="party" /></p>
      ) : (
        moments.map(({ p, i, q }) => (
          <button key={i} className="sim-moment" onClick={() => onSelect(i + 1)}>
            <QualityIcon q={q!} size={20} />
            {Math.floor(i / 2) + 1}
            {p.white ? '.' : '...'}
            {p.san} · {SIM_QUALITY[q!].label}
          </button>
        ))
      )}
    </div>
  );
}

/** Pulsanti per scorrere la partita: inizio, indietro, avanti, fine (più eventuali pulsanti in coda). */
export function ReviewNav({ last, setCursor, children }: { last: number; setCursor: Dispatch<SetStateAction<number>>; children?: ReactNode }) {
  return (
    <div className="controls">
      <button onClick={() => setCursor(0)} title="Inizio"><Icon name="first" /></button>
      <button onClick={() => setCursor((c) => Math.max(0, c - 1))} title="Indietro (←)"><Icon name="prev" /></button>
      <button onClick={() => setCursor((c) => Math.min(last, c + 1))} title="Avanti (→)"><Icon name="next" /></button>
      <button onClick={() => setCursor(last)} title="Fine"><Icon name="last" /></button>
      {children}
    </div>
  );
}

/**
 * Elenco delle mosse con il colore della loro qualità. Le mosse sono cliccabili solo se c'è `onSelect`;
 * la numerazione parte dalla posizione iniziale (anche se tocca al Nero).
 */
export function QualityMoves({
  plies,
  qualities,
  startFen,
  cursor,
  onSelect,
  bookTitle = 'Libro',
  empty,
}: {
  plies: SimPly[];
  qualities: (SimQuality | undefined)[];
  startFen: string;
  /** Mossa evidenziata (1 = la prima); niente evidenziazione se undefined. */
  cursor?: number;
  onSelect?: (index: number) => void;
  bookTitle?: string;
  empty?: ReactNode;
}) {
  const [, side, , , , full] = startFen.split(' ');
  const startsBlack = side === 'b';
  return (
    <div className="moves">
      {plies.length === 0 && empty}
      {plies.map((p, i) => {
        const q = qualities[i];
        const info = q ? SIM_QUALITY[q] : undefined;
        const k = i + (startsBlack ? 1 : 0);
        const num = Number(full ?? 1) + Math.floor(k / 2);
        return (
          <span key={i} className="move-wrap">
            {(k % 2 === 0 || i === 0) && <span className="move-num">{num}.{k % 2 === 1 ? '..' : ''}</span>}
            <button
              className={`move ${i + 1 === cursor ? 'active' : ''}`}
              onClick={() => onSelect?.(i + 1)}
              style={info && q !== 'libro' && q !== 'buona' && q !== 'migliore' ? { color: info.color, fontWeight: 700 } : undefined}
            >
              {q === 'libro' && <span className="sim-book-dot" title={bookTitle} />}
              {p.san}
              {info?.symbol}
            </button>
          </span>
        );
      })}
    </div>
  );
}
