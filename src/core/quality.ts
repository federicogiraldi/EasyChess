import type { Quality } from '../engine/judge';

/**
 * Le categorie di qualità di una mossa, con nome, simbolo e colore. Modulo senza dipendenze: lo usano
 * sia la logica (simulazione, analisi) sia la grafica (icone, scacchiera).
 */

/** Come su chess.com: le mosse di teoria hanno la loro categoria. */
export type SimQuality = Quality | 'libro';

export const SIM_QUALITY: Record<SimQuality, { label: string; symbol: string; icon: string; color: string }> = {
  libro: { label: 'Libro', symbol: '', icon: '📖', color: '#a8865c' },
  migliore: { label: 'Migliore', symbol: '!', icon: '★', color: '#5c9b2f' },
  buona: { label: 'Buona', symbol: '', icon: '✓', color: '#77915f' },
  imprecisione: { label: 'Imprecisione', symbol: '?!', icon: '?!', color: '#e0a82e' },
  errore: { label: 'Errore', symbol: '?', icon: '?', color: '#e5762c' },
  grave: { label: 'Errore grave', symbol: '??', icon: '??', color: '#d43a2f' },
};

export const SIM_QUALITY_ORDER: SimQuality[] = ['libro', 'migliore', 'buona', 'imprecisione', 'errore', 'grave'];
