import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';

/** Larghezza del contenitore, aggiornata quando cambia (rotazione del telefono, finestra ridimensionata). */
function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const PAD = { top: 12, right: 12, bottom: 24, left: 40 };

/** 3–5 valori "tondi" per le linee della griglia. */
function ticks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

function Tooltip({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null;
  const left = Math.min(Math.max(tip.x, 70), width - 70);
  return (
    <div className="chart-tip" style={{ left, top: tip.y }} role="status">
      {tip.content}
    </div>
  );
}

export interface LinePoint {
  label: string;
  value: number;
}

/** Linea singola con mirino e tooltip al passaggio (o al tocco). */
export function LineChart({ points, height = 200, format = String, ariaLabel }: { points: LinePoint[]; height?: number; format?: (v: number) => string; ariaLabel: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(10, (hi - lo) * 0.15);
  const grid = ticks(lo - pad, hi + pad);
  const min = Math.min(lo - pad, grid[0]);
  const max = Math.max(hi + pad, grid[grid.length - 1]);
  const w = Math.max(width, 1);
  const iw = w - PAD.left - PAD.right;
  const ih = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? iw / 2 : (i * iw) / (points.length - 1));
  const y = (v: number) => PAD.top + ih - ((v - min) / (max - min)) * ih;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - box.left) / box.width;
    setHover(Math.round(rel * (points.length - 1)));
  };
  const h = hover !== null ? points[hover] : null;

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={w} height={height} role="img" aria-label={ariaLabel}>
          {grid.map((g) => (
            <g key={g} className="chart-grid">
              <line x1={PAD.left} x2={w - PAD.right} y1={y(g)} y2={y(g)} />
              <text x={PAD.left - 6} y={y(g)} dy="0.32em" textAnchor="end">
                {format(g)}
              </text>
            </g>
          ))}
          <text className="chart-axis" x={PAD.left} y={height - 6}>
            {points[0].label}
          </text>
          {points.length > 1 && (
            <text className="chart-axis" x={w - PAD.right} y={height - 6} textAnchor="end">
              {points[points.length - 1].label}
            </text>
          )}
          <path className="chart-line" d={path} />
          {points.length <= 40 && points.map((p, i) => <circle key={i} className="chart-dot" cx={x(i)} cy={y(p.value)} r={3} />)}
          {h && hover !== null && (
            <g>
              <line className="chart-cross" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} />
              <circle className="chart-dot active" cx={x(hover)} cy={y(h.value)} r={5} />
            </g>
          )}
          <rect
            className="chart-hit"
            x={PAD.left - 8}
            y={0}
            width={iw + 16}
            height={height}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      <Tooltip
        width={w}
        tip={
          h && hover !== null
            ? {
                x: x(hover),
                y: y(h.value),
                content: (
                  <>
                    <b>{format(h.value)}</b> <span>{h.label}</span>
                  </>
                ),
              }
            : null
        }
      />
    </div>
  );
}

export interface BarDatum {
  key: string;
  value: number;
  label: string;
  detail?: string;
}

/** Barre verticali (valori 0–100), una per partita, con tooltip sulla barra. */
export function BarChart({ bars, height = 200, ariaLabel, reference }: { bars: BarDatum[]; height?: number; ariaLabel: string; reference?: { value: number; label: string } }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const w = Math.max(width, 1);
  const iw = w - PAD.left - PAD.right;
  const ih = height - PAD.top - PAD.bottom;
  const slot = iw / Math.max(bars.length, 1);
  const bw = Math.max(4, Math.min(28, slot - 2));
  const y = (v: number) => PAD.top + ih - (v / 100) * ih;
  const r = Math.min(4, bw / 2);
  const bar = (i: number, v: number) => {
    const x0 = PAD.left + i * slot + (slot - bw) / 2;
    const top = y(v);
    const bottom = PAD.top + ih;
    const rr = Math.min(r, bottom - top);
    return `M${x0},${bottom}V${top + rr}Q${x0},${top} ${x0 + rr},${top}H${x0 + bw - rr}Q${x0 + bw},${top} ${x0 + bw},${top + rr}V${bottom}Z`;
  };
  const h = hover !== null ? bars[hover] : null;

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={w} height={height} role="img" aria-label={ariaLabel}>
          {[0, 25, 50, 75, 100].map((g) => (
            <g key={g} className="chart-grid">
              <line x1={PAD.left} x2={w - PAD.right} y1={y(g)} y2={y(g)} />
              <text x={PAD.left - 6} y={y(g)} dy="0.32em" textAnchor="end">
                {g}
              </text>
            </g>
          ))}
          {bars.map((b, i) => (
            <path key={b.key} className={`chart-bar${hover === i ? ' active' : ''}`} d={bar(i, b.value)} />
          ))}
          {reference && (
            <g className="chart-ref">
              <line x1={PAD.left} x2={w - PAD.right} y1={y(reference.value)} y2={y(reference.value)} />
              <text x={w - PAD.right} y={y(reference.value) - 5} textAnchor="end">
                {reference.label}
              </text>
            </g>
          )}
          {bars.map((b, i) => (
            <rect
              key={b.key}
              className="chart-hit"
              x={PAD.left + i * slot}
              y={0}
              width={slot}
              height={height}
              onPointerEnter={() => setHover(i)}
              onPointerDown={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            />
          ))}
        </svg>
      )}
      <Tooltip
        width={w}
        tip={
          h && hover !== null
            ? {
                x: PAD.left + hover * slot + slot / 2,
                y: y(h.value),
                content: (
                  <>
                    <b>{h.value.toFixed(1)}%</b> <span>{h.label}</span>
                    {h.detail && <span className="muted">{h.detail}</span>}
                  </>
                ),
              }
            : null
        }
      />
    </div>
  );
}
