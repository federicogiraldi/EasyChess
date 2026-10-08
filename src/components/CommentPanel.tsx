import type { OpeningNode } from '../model/types';

interface Props {
  node: OpeningNode;
  lineName?: string;
  fallback?: string;
}

export function CommentPanel({ node, lineName, fallback }: Props) {
  const text = node.comment ?? fallback;
  if (!lineName && !text && node.keyIdeas.length === 0) return null;
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
    </div>
  );
}
