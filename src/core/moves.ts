import { Chess } from 'chess.js';

/** La mossa da→a in notazione (es. "Nf3"), o null se non è legale. Le promozioni vanno a Donna. */
export function sanOf(fen: string, from: string, to: string): string | null {
  try {
    return new Chess(fen).move({ from, to, promotion: 'q' }).san;
  } catch {
    return null;
  }
}
