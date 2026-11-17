import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Evals } from '../core/review';
import { evalPosition } from '../engine/simEngine';

/**
 * Valuta con Stockfish le posizioni in `todo`, una volta sola ciascuna e nell'ordine dato (l'engine ne
 * fa una alla volta). Le valutazioni restano anche quando `todo` cambia.
 */
export function usePositionEvals(todo: string[]): Evals {
  const [evals, setEvals] = useState<Evals>({});
  const pending = useRef(new Set<string>());
  useEffect(() => {
    for (const f of todo) {
      if (evals[f] || pending.current.has(f)) continue;
      pending.current.add(f);
      evalPosition(f)
        .then((e) => setEvals((s) => ({ ...s, [f]: e })), () => {})
        .finally(() => pending.current.delete(f));
    }
  }, [todo, evals]);
  return evals;
}

/** Frecce ←/→ (e Inizio/Fine) per scorrere le mosse, tranne mentre si scrive in un campo. */
export function useMoveKeys(enabled: boolean, last: number, setCursor: Dispatch<SetStateAction<number>>) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') setCursor((c) => Math.max(0, c - 1));
      else if (e.key === 'ArrowRight') setCursor((c) => Math.min(last, c + 1));
      else if (e.key === 'Home') setCursor(0);
      else if (e.key === 'End') setCursor(last);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, last, setCursor]);
}
