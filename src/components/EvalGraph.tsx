import type { MouseEvent } from 'react';

interface Props {
  /** Probabilità di vittoria del Bianco (0-100) dopo ogni semimossa; indice 0 = posizione iniziale. */
  values: (number | undefined)[];
  cursor: number;
  onSelect: (index: number) => void;
  /** Punti da evidenziare (es. errori) con il loro colore. */
  marks?: { index: number; color: string }[];
}

const W = 600;
const H = 100;

/** Grafico della valutazione come nella revisione di chess.com: bianco sopra, nero sotto. */
export function EvalGraph({ values, cursor, onSelect, marks = [] }: Props) {
  const n = Math.max(1, values.length - 1);
  const x = (i: number) => (i / n) * W;
  const y = (v: number) => H - (v / 100) * H;
  // I valori mancanti (analisi in corso) restano a metà.
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v ?? 50).toFixed(1)}`);
  const area = `0,${H} ${pts.join(' ')} ${W},${H}`;

  const onClick = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onSelect(Math.max(0, Math.min(values.length - 1, Math.round(((e.clientX - r.left) / r.width) * n))));
  };

  return (
    <svg className="eval-graph" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onClick={onClick} role="img" aria-label="Grafico della valutazione">
      <rect x="0" y="0" width={W} height={H} className="eg-black" />
      <polygon points={area} className="eg-white" />
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="eg-mid" />
      <line x1={x(cursor)} x2={x(cursor)} y1="0" y2={H} className="eg-cursor" />
      {marks.map((m) => (
        <circle key={m.index} cx={x(m.index)} cy={y(values[m.index] ?? 50)} r="4" fill={m.color} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
