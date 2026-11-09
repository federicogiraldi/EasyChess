import { useMemo } from 'react';
import type { OpeningNode } from '../model/types';
import { describeMove } from '../engine/reasons';

interface Props {
  node: OpeningNode;
  lineName?: string;
  fallback?: string;
}

export function CommentPanel({ node, lineName, fallback }: Props) {
  const text = node.comment ?? fallback;
  // Spiegazione "a regole" della mossa appena giocata: integra il commento del repertorio.
  const motifs = useMemo(() => (node.parent ? describeMove(node.parent.fen, node.san) : []), [node]);
  if (!lineName && !text && node.keyIdeas.length === 0 && motifs.length === 0) return null;
  return (
    <div className="comment-panel">
      {lineName && <div className="line-name">{lineName}</div>}
      {text && <p className="comment">{text}</p>}
      {node.keyIdeas.length > 0 && (
        <ul className="key-ideas">
          {node.keyIdeas.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      )}
      {motifs.length > 0 && (
        <div className="move-motifs">
          <div className="move-motifs-head">🔍 Cosa fa {node.san}</div>
          <ul>
            {motifs.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
