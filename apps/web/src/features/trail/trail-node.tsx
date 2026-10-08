import type { NodeProgressView } from '@rpg-chains/shared-types';
import type { CellBox } from './trail-geometry';
import { nodeIcon, nodeName, nodeStateLabel } from './node-label';

interface TrailNodeProps {
  node: NodeProgressView;
  box: CellBox;
  /** The chapter's lit campfire is this node. */
  lit: boolean;
  selected: boolean;
  /** The node's chapter is locked: shown, never opened. */
  disabled: boolean;
  onSelect: () => void;
}

const STATE_CLASSES: Record<NodeProgressView['state'], string> = {
  locked: 'border-gray-300 bg-gray-200 text-gray-400',
  unlocked: 'border-indigo-800 bg-indigo-500 text-white shadow-md',
  cleared: 'border-amber-600 bg-amber-300 text-amber-950',
};

/** One node of the trail, drawn in its grid cell: an icon in a circle and its name under it. */
export function TrailNode({ node, box, lit, selected, disabled, onSelect }: TrailNodeProps) {
  const name = nodeName(node);
  const running = node.battleId !== null;
  return (
    <div
      className="absolute flex flex-col items-center justify-start"
      style={{
        left: `${box.left}%`,
        width: `${box.width}%`,
        top: `${box.top}%`,
        height: `${box.height}%`,
      }}
    >
      <button
        type="button"
        data-trail-node={node.nodeId}
        aria-label={`${name} (${nodeStateLabel(node)}${running ? ', batalha em andamento' : ''})`}
        aria-expanded={selected}
        disabled={disabled}
        onClick={onSelect}
        className={`relative mt-[8%] flex aspect-square w-[70%] items-center justify-center rounded-full border-b-4 text-xl transition-transform hover:scale-105 disabled:hover:scale-100 ${STATE_CLASSES[node.state]} ${selected ? 'ring-4 ring-indigo-300' : ''} ${running ? 'animate-pulse ring-4 ring-red-400' : ''} ${lit ? 'ring-4 ring-orange-400' : ''}`}
      >
        <span aria-hidden className={node.state === 'locked' ? 'opacity-40 grayscale' : ''}>
          {nodeIcon(node.type)}
        </span>
        {node.state === 'locked' && (
          <span aria-hidden className="absolute -right-1 -bottom-1 text-xs">
            🔒
          </span>
        )}
        {node.state === 'cleared' && (
          <span
            aria-hidden
            className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-xs text-white"
          >
            ✓
          </span>
        )}
      </button>
      <span
        aria-hidden
        className="mt-0.5 line-clamp-2 w-[130%] text-center text-[11px] leading-tight font-medium text-gray-700"
      >
        {name}
      </span>
    </div>
  );
}
