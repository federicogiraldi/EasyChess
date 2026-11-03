import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import type { Arrow, Highlight, Side } from '../model/types';
import { useVariationPreview, VariationBar } from './VariationPreview';

type ChessboardProps = Parameters<typeof Chessboard>[0];

interface Props {
  fen: string;
  orientation: Side;
  /** Ritorna true se la mossa è accettata; se manca la scacchiera è solo da guardare. */
  onMove?: (from: string, to: string) => boolean;
  arrows?: Arrow[];
  highlights?: Highlight[];
  lastMove?: { from: string; to: string };
  /** Case da colorare per un feedback (es. errore in rosso). */
  marks?: Record<string, string>;
}

const PREVIEW_ARROW = { good: 'rgba(21, 128, 61, 0.7)', bad: 'rgba(185, 28, 28, 0.7)' };

export function Board(props: Props) {
  // Durante l'anteprima di una variante la scacchiera mostra quella al posto della partita (solo da guardare).
  const preview = useVariationPreview()?.state;
  let { fen, onMove, arrows = [], highlights = [], lastMove, marks = {} } = props;
  const { orientation } = props;
  if (preview) {
    const { variation, index, req } = preview;
    const cur = index > 0 ? variation.steps[index - 1] : undefined;
    const next = variation.steps[index];
    fen = cur?.fen ?? variation.startFen;
    onMove = undefined;
    lastMove = cur ? { from: cur.from, to: cur.to } : undefined;
    arrows = next ? [{ from: next.from, to: next.to, color: PREVIEW_ARROW[req.tone] }] : [];
    highlights = [];
    marks = {};
  }
  return <BoardView fen={fen} orientation={orientation} onMove={onMove} arrows={arrows} highlights={highlights} lastMove={lastMove} marks={marks} previewing={!!preview} />;
}

function BoardView({ fen, orientation, onMove, arrows = [], highlights = [], lastMove, marks = {}, previewing }: Props & { previewing: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);

  useEffect(() => setSelected(null), [fen]);

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
  if (selected) styles[selected] = { background: 'var(--selected)' };

  const tryMove = (from: string, to: string) => (onMove ? onMove(from, to) : false);

  const onSquareClick = (square: string) => {
    if (!onMove) return;
    const chess = new Chess(fen);
    const piece = chess.get(square as never);
    const ownPiece = piece && piece.color === chess.turn();
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
    areArrowsAllowed: true,
    onPieceDrop: (from, to) => tryMove(from, to),
    onSquareClick: (sq) => onSquareClick(sq),
    customArrows: arrows.map((a) => [a.from, a.to, a.color]) as ChessboardProps['customArrows'],
    customSquareStyles: styles,
    customBoardStyle: { borderRadius: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' },
    customDarkSquareStyle: { backgroundColor: 'var(--sq-dark)' },
    customLightSquareStyle: { backgroundColor: 'var(--sq-light)' },
  };

  return (
    <>
      <div ref={wrapRef} className={`board ${previewing ? 'previewing' : ''}`}>
        <Chessboard {...props} />
      </div>
      {previewing && <VariationBar />}
    </>
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
