import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import type { Arrow, Highlight, Side } from '../model/types';

type ChessboardProps = Parameters<typeof Chessboard>[0];

interface Props {
  fen: string;
  orientation: Side;
  /** Ritorna true se la mossa è accettata; se manca la scacchiera è solo da guardare. */
  onMove?: (from: string, to: string) => boolean;
  /**
   * Colore con cui gioca l'utente. Se indicato, quando tocca all'avversario la mossa
   * resta "in attesa" (pre-move) e viene giocata appena l'avversario ha risposto.
   */
  premoveColor?: Side;
  arrows?: Arrow[];
  highlights?: Highlight[];
  lastMove?: { from: string; to: string };
  /** Case da colorare per un feedback (es. errore in rosso). */
  marks?: Record<string, string>;
}

interface Premove {
  from: string;
  to: string;
}

/** true se `next` si ottiene da `prev` con una sola mossa legale (cioè l'avversario ha appena risposto). */
function isOneMoveAfter(prev: string, next: string): boolean {
  const target = next.split(' ').slice(0, 4).join(' ');
  try {
    const chess = new Chess(prev);
    return chess.moves({ verbose: true }).some((m) => m.after.split(' ').slice(0, 4).join(' ') === target);
  } catch {
    return false;
  }
}

export function Board({ fen, orientation, onMove, premoveColor, arrows = [], highlights = [], lastMove, marks = {} }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [premove, setPremove] = useState<Premove | null>(null);
  const prevFen = useRef(fen);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);

  const me = premoveColor === 'white' ? 'w' : premoveColor === 'black' ? 'b' : null;
  const sideToMove = fen.split(' ')[1];
  const waiting = !!onMove && me !== null && sideToMove !== me;

  // Nuova posizione: se l'avversario ha appena mosso, gioca la pre-move; in ogni altro caso (nuova linea, passo indietro…) la scarta.
  useEffect(() => {
    const before = prevFen.current;
    prevFen.current = fen;
    setSelected((s) => {
      if (!s || !me) return null;
      const p = new Chess(fen).get(s as never);
      return p && p.color === me ? s : null;
    });
    if (!premove) return;
    setPremove(null);
    if (!onMove || sideToMove !== me || !isOneMoveAfter(before, fen)) return;
    const pm = premove;
    // Piccola pausa per lasciar vedere la risposta dell'avversario.
    const t = setTimeout(() => onMove(pm.from, pm.to), 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen]);

  useEffect(() => {
    if (!onMove || !me) setPremove(null);
  }, [onMove, me]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const styles: Record<string, CSSProperties> = {};
  if (lastMove?.from) {
    styles[lastMove.from] = { background: 'var(--last-move)' };
    styles[lastMove.to] = { background: 'var(--last-move)' };
  }
  for (const h of highlights) {
    styles[h.square] = { ...styles[h.square], boxShadow: `inset 0 0 0 4px ${h.color}` };
  }
  for (const [sq, color] of Object.entries(marks)) styles[sq] = { background: color };
  if (premove) {
    styles[premove.from] = { background: 'var(--premove)' };
    styles[premove.to] = { background: 'var(--premove)' };
  }
  if (selected) styles[selected] = { background: 'var(--selected)' };

  const pieceColorAt = (square: string) => new Chess(fen).get(square as never)?.color;

  const tryMove = (from: string, to: string) => {
    if (!onMove) return false;
    if (waiting) {
      if (from !== to && pieceColorAt(from) === me) setPremove({ from, to });
      return false;
    }
    return onMove(from, to);
  };

  const onSquareClick = (square: string) => {
    if (!onMove) return;
    // Mentre aspetti l'avversario selezioni i tuoi pezzi, non quelli di chi deve muovere.
    const mover = waiting ? me : sideToMove;
    const ownPiece = pieceColorAt(square) === mover;
    if (waiting && premove && !selected) {
      setPremove(null);
      setSelected(ownPiece && square !== premove.from ? square : null);
      return;
    }
    if (selected && selected !== square && !ownPiece) {
      tryMove(selected, square);
      setSelected(null);
    } else {
      setSelected(ownPiece && selected !== square ? square : null);
    }
  };

  const props: ChessboardProps = {
    id: 'easychess-board',
    position: fen,
    boardOrientation: orientation,
    boardWidth: width,
    animationDuration: 200,
    arePiecesDraggable: !!onMove,
    isDraggablePiece: ({ piece }) => !me || piece[0] === me,
    areArrowsAllowed: true,
    onPieceDrop: (from, to) => tryMove(from, to),
    onSquareClick: (sq) => onSquareClick(sq),
    onSquareRightClick: () => setPremove(null),
    customArrows: arrows.map((a) => [a.from, a.to, a.color]) as ChessboardProps['customArrows'],
    customSquareStyles: styles,
    customBoardStyle: { borderRadius: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' },
    customDarkSquareStyle: { backgroundColor: 'var(--sq-dark)' },
    customLightSquareStyle: { backgroundColor: 'var(--sq-light)' },
  };

  return (
    <div ref={wrapRef} className="board">
      <Chessboard {...props} />
      {premove && <div className="premove-hint">Pre-move {premove.from}→{premove.to} · clic per annullare</div>}
    </div>
  );
}

/** Prova a giocare from→to nella posizione e restituisce il SAN canonico, o null se illegale. */
export function sanOf(fen: string, from: string, to: string): string | null {
  try {
    return new Chess(fen).move({ from, to, promotion: 'q' }).san;
  } catch {
    return null;
  }
}
