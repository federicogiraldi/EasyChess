import type { OpeningNode } from '../model/types';
import { formatPath, namedLines, pathFromRoot } from '../core/tree';

interface Props {
  root: OpeningNode;
  currentPath: OpeningNode[];
  onSelect: (node: OpeningNode) => void;
}

export function LineTree({ root, currentPath, onSelect }: Props) {
  const lines = namedLines(root);
  const onPath = new Set(currentPath.map((n) => n.id));
  return (
    <nav className="line-tree">
      <h3>Linee</h3>
      {lines.map(({ node, depth }) => (
        <button
          key={node.id}
          className={`line-item ${onPath.has(node.id) ? 'on-path' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => onSelect(node)}
          title={formatPath(pathFromRoot(node))}
        >
          {node.lineName}
        </button>
      ))}
    </nav>
  );
}
