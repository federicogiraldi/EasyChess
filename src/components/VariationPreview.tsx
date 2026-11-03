import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { buildVariation, type BuiltVariation } from '../core/variation';

/**
 * Anteprima di una variante sulla scacchiera.
 * Una spiegazione chiede di mostrare una sequenza di mosse; la scacchiera della modalità corrente
 * (qualunque sia) la mostra al posto della partita, finché non si torna alla posizione.
 */

export interface VariationRequest {
  /** Chi l'ha aperta: quando sparisce (es. la spiegazione si chiude) l'anteprima si chiude con lei. */
  owner: object;
  title: string;
  startFen: string;
  uci: string[];
  /** Colore delle frecce/evidenziazioni: verde per la linea consigliata, rosso per quella della tua mossa. */
  tone: 'good' | 'bad';
}

interface PreviewState {
  req: VariationRequest;
  variation: BuiltVariation;
  /** 0 = posizione di partenza, i = dopo la i-esima mossa. */
  index: number;
  playing: boolean;
}

interface PreviewApi {
  state: PreviewState | null;
  show: (req: VariationRequest) => void;
  close: (owner?: object) => void;
  goTo: (index: number) => void;
  step: (delta: number) => void;
  replay: () => void;
}

const Ctx = createContext<PreviewApi | null>(null);

const AUTOPLAY_MS = 1000;

export function VariationPreviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PreviewState | null>(null);

  const show = useCallback((req: VariationRequest) => {
    setState({ req, variation: buildVariation(req.startFen, req.uci), index: 0, playing: true });
    // Su telefono la spiegazione è sotto la scacchiera: riportala in vista.
    requestAnimationFrame(() => document.querySelector('.board')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }, []);

  const close = useCallback((owner?: object) => {
    setState((s) => (!s || (owner && s.req.owner !== owner) ? s : null));
  }, []);

  const goTo = useCallback((index: number) => {
    setState((s) => s && { ...s, playing: false, index: Math.max(0, Math.min(s.variation.steps.length, index)) });
  }, []);

  const step = useCallback((delta: number) => {
    setState((s) => s && { ...s, playing: false, index: Math.max(0, Math.min(s.variation.steps.length, s.index + delta)) });
  }, []);

  const replay = useCallback(() => setState((s) => s && { ...s, index: 0, playing: true }), []);

  // Riproduzione automatica: mostra tutta la sequenza, poi si ferma sull'ultima mossa.
  useEffect(() => {
    if (!state?.playing) return;
    if (state.index >= state.variation.steps.length) {
      setState((s) => s && { ...s, playing: false });
      return;
    }
    const t = setTimeout(() => setState((s) => s && s.playing ? { ...s, index: s.index + 1 } : s), state.index === 0 ? 600 : AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [state?.playing, state?.index, state?.variation.steps.length]);

  // Tastiera: durante l'anteprima le frecce scorrono la variante (non la partita), Esc torna alla posizione.
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      const len = state.variation.steps.length;
      if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'Home') goTo(0);
      else if (e.key === 'End') goTo(len);
      else if (e.key === 'Escape') close();
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    // In cattura: arriva prima dei comandi da tastiera delle modalità.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [state, step, goTo, close]);

  const api = useMemo(() => ({ state, show, close, goTo, step, replay }), [state, show, close, goTo, step, replay]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useVariationPreview(): PreviewApi | null {
  return useContext(Ctx);
}

/** Barra sotto la scacchiera durante l'anteprima: mosse cliccabili, avanti/indietro, torna alla posizione. */
export function VariationBar() {
  const api = useVariationPreview();
  if (!api?.state) return null;
  const { req, variation, index, playing } = api.state;
  const len = variation.steps.length;
  return (
    <div className={`variation-bar ${req.tone}`} role="region" aria-label="Variante sulla scacchiera">
      <div className="variation-title">
        <strong>{req.title}</strong>
        <span className="muted small">
          {index}/{len}
          {playing ? ' · in riproduzione' : ''}
        </span>
      </div>
      <div className="variation-moves">
        <button className={`move ${index === 0 ? 'active' : ''}`} onClick={() => api.goTo(0)}>
          Inizio
        </button>
        {variation.steps.map((s, i) => (
          <button key={i} className={`move ${index === i + 1 ? 'active' : ''}`} onClick={() => api.goTo(i + 1)}>
            {i === 0 || !s.label.includes('...') ? s.label : s.san}
          </button>
        ))}
      </div>
      <div className="controls">
        <button onClick={() => api.goTo(0)} title="Inizio della variante" aria-label="Inizio della variante">⏮</button>
        <button onClick={() => api.step(-1)} disabled={index === 0} title="Indietro (←)" aria-label="Indietro">◀</button>
        <button onClick={() => api.step(1)} disabled={index === len} title="Avanti (→)" aria-label="Avanti">▶</button>
        <button onClick={() => api.goTo(len)} title="Fine della variante" aria-label="Fine della variante">⏭</button>
        <button onClick={api.replay} title="Rivedi tutta la sequenza">⟲ Rivedi</button>
        <button className="primary variation-back" onClick={() => api.close()} title="Torna alla posizione (Esc)">
          ↩ Torna alla posizione
        </button>
      </div>
    </div>
  );
}
