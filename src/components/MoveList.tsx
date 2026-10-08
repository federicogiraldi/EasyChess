import type { OpeningNode } from '../model/types';

interface Props {
  path: OpeningNode[];
  /** Indice nel percorso del nodo attivo (default: l'ultimo). */
  active?: number;
  onSelect?: (index: number) => void;
}

export function MoveList({ path, active = path.length - 1, onSelect }: Props) {
  if (path.length <= 1) return <div className="moves muted">Posizione iniziale</div>;
  return (
    <div className="moves">
      {path.map((n, i) => {
        if (i === 0) return null;
        const white = n.ply % 2 === 1;
        const num = Math.ceil(n.ply / 2);
        return (
          <span key={n.id + i} className="move-wrap">
            {white && <span className="move-num">{num}.</span>}
            {!white && i === 1 && <span className="move-num">{num}...</span>}
            <button
              className={`move ${i === active ? 'active' : ''} ${n.isUserMove ? 'mine' : ''}`}
              onClick={onSelect ? () => onSelect(i) : undefined}
              disabled={!onSelect}
            >
              {n.san}
            </button>
          </span>
        );
      })}
    </div>
  );
}
