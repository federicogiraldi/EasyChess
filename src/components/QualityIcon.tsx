import { SIM_QUALITY, type SimQuality } from '../core/simulation';

/**
 * Icona della qualità di una mossa: cerchio colorato con un simbolo bianco
 * (stile delle revisioni di chess.com, disegnata da zero).
 */
export function QualityIcon({ q, size = 26, title }: { q: SimQuality; size?: number; title?: string }) {
  const info = SIM_QUALITY[q];
  const text = q === 'imprecisione' ? '?!' : q === 'errore' ? '?' : q === 'grave' ? '??' : undefined;
  return (
    <svg className="q-icon" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title ?? info.label}>
      <title>{title ?? info.label}</title>
      <circle cx="12" cy="12" r="11.5" fill={info.color} />
      <circle cx="12" cy="12" r="11" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
      {q === 'migliore' && (
        // stella
        <path d="M12 4.6l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5L4.8 9.8l5-.6z" fill="#fff" />
      )}
      {q === 'buona' && <path d="M6.6 12.4l3.6 3.5 7.3-7.6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />}
      {q === 'libro' && (
        // libro aperto
        <path
          d="M12 8.2c-1.7-1.3-3.9-1.7-6.2-1.3v9.6c2.3-.4 4.5 0 6.2 1.3 1.7-1.3 3.9-1.7 6.2-1.3V6.9c-2.3-.4-4.5 0-6.2 1.3zm0 0v9.6"
          fill="none"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      )}
      {text && (
        <text x="12" y="16.6" textAnchor="middle" fontSize={text.length > 1 ? 11.5 : 14} fontWeight="900" fill="#fff" fontFamily="system-ui, -apple-system, sans-serif" letterSpacing="-0.5">
          {text}
        </text>
      )}
    </svg>
  );
}
