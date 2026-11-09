import { useEffect, useRef, useState } from 'react';
import { useVariationPreview } from './VariationPreview';
import type { OpeningNode } from '../model/types';
import { judgeMove, QUALITY_INFO, type Verdict } from '../engine/judge';
import { engine, formatScore, winChance, type EngineProgress } from '../engine/stockfish';
import { lineNameOf, pathFromRoot } from '../core/tree';

const fmt = (cp: number) => formatScore(cp);

export function ExplanationCard({ verdict }: { verdict: Verdict }) {
  const q = QUALITY_INFO[verdict.quality];
  const b = verdict.better;
  const preview = useVariationPreview();
  const owner = useRef({}).current;
  // Se la spiegazione sparisce (nuova mossa, cambio di modalità) la scacchiera torna alla partita.
  useEffect(() => () => preview?.close(owner), [preview?.close, owner]);
  const showing = preview?.state?.req.owner === owner ? preview.state.req.tone : undefined;
  const showLine = (tone: 'good' | 'bad') => {
    if (!preview) return;
    if (tone === 'good' && b) preview.show({ owner, tone, startFen: verdict.fen, uci: b.pv, title: `${b.source === 'repertorio' ? 'Repertorio' : 'Stockfish'}: ${b.san}` });
    if (tone === 'bad') preview.show({ owner, tone, startFen: verdict.fen, uci: verdict.playedPv, title: `La tua mossa: ${verdict.playedSan}` });
  };
  const canShowPlayed = verdict.playedPv.length > 1 && verdict.quality !== 'migliore';
  return (
    <div className={`explanation q-${verdict.quality}`}>
      <div className="exp-head">
        <span className="q-badge">
          {verdict.playedSan}
          {q.symbol} · {q.label}
        </span>
        <span className="muted small">valutazione {fmt(verdict.playedScore)} per chi ha mosso</span>
      </div>
      {verdict.inRepertoire && <p className="exp-ok">✓ È una mossa del tuo repertorio.</p>}
      {verdict.against.length > 0 && (
        <ul className="exp-list against">
          {verdict.against.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {b && (
        <div className="exp-better">
          <div className="exp-better-head">
            {b.source === 'repertorio' ? 'Il repertorio gioca' : 'Stockfish preferisce'} <strong>{b.san}</strong>{' '}
            <span className="muted small">({fmt(b.score)})</span>
          </div>
          {b.node?.comment && (
            <p className="exp-comment">
              {lineNameOf(pathFromRoot(b.node)) && <strong>{lineNameOf(pathFromRoot(b.node))}: </strong>}
              {b.node.comment}
            </p>
          )}
          {b.reasons.length > 0 && (
            <ul className="exp-list for">
              {b.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          <p className="muted small">Linea: {b.line}</p>
          {preview && b.pv.length > 0 && (
            <div className="exp-show">
              <button className={showing === 'good' ? 'primary' : ''} onClick={() => showLine('good')}>
                ♟ Mostra {b.san} sulla scacchiera
              </button>
              {canShowPlayed && (
                <button className={showing === 'bad' ? 'primary' : ''} onClick={() => showLine('bad')}>
                  ♟ Cosa succede dopo {verdict.playedSan}
                </button>
              )}
            </div>
          )}
          {b.source === 'repertorio' && verdict.quality === 'buona' && (
            <p className="muted small">
              Secondo l'engine anche la tua mossa è giocabile: il repertorio sceglie {b.san} per restare nelle strutture che stai studiando.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Pulsante "Perché?" che analizza una mossa sbagliata rispetto al repertorio. */
export function WhyButton({ fen, san, expected }: { fen: string; san: string; expected: OpeningNode[] }) {
  const [state, setState] = useState<'idle' | 'loading' | Verdict | Error>('idle');
  useEffect(() => setState('idle'), [fen, san]);

  if (state === 'idle') {
    return (
      <button className="why" onClick={() => {
        setState('loading');
        judgeMove(fen, san, expected).then(setState, (e: Error) => setState(e));
      }}>
        🔬 Perché {san} è peggio?
      </button>
    );
  }
  if (state === 'loading') return <AnalysisProgress label={`Stockfish sta analizzando ${san}…`} />;
  if (state instanceof Error) return <p className="muted small">Analisi non disponibile: {state.message}</p>;
  return <ExplanationCard verdict={state} />;
}

/** Barra di avanzamento dell'analisi: sui telefoni un'analisi accurata richiede qualche secondo. */
export function AnalysisProgress({ label }: { label: string }) {
  const [p, setP] = useState<EngineProgress | null>(null);
  useEffect(() => engine.onProgress(setP), []);
  const pct = p ? Math.min(100, (p.depth / p.target) * 100) : 0;
  return (
    <div className="analysis-progress">
      <div className="muted small">
        {label}
        {p && p.depth > 0 && ` profondità ${p.depth}/${p.target}`}
      </div>
      <div className="step-progress">
        <div className="bar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EvalBar({ scoreWhite, mateWhite }: { scoreWhite?: number; mateWhite?: number }) {
  const pct = scoreWhite === undefined ? 50 : ((winChance(scoreWhite) + 1) / 2) * 100;
  return (
    <div className="evalbar" title="Valutazione di Stockfish (lato Bianco)">
      <div className="evalbar-white" style={{ width: `${pct}%` }} />
      <span className="evalbar-label">{scoreWhite === undefined ? '…' : formatScore(scoreWhite, mateWhite)}</span>
    </div>
  );
}
