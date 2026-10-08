'use client';

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { TRAIL_COLUMN_WIDTH, TRAIL_ROW_HEIGHT, type NodeType } from '@rpg-chains/shared-types';
import { nodeIcon } from '@/features/trail/node-label';

export type ChapterFlowNode = Node<
  { label: string; type: NodeType; isEntry: boolean; isBoss: boolean; hasIssues: boolean },
  'chapterNode'
>;

/**
 * Custom canvas node, the size of one trail cell (Fase 5 plan decision 17) so the author sees the
 * chapter as players will: the type's icon in a circle, the label under it, entry/boss marks and a
 * red ring on issues.
 */
export function ChapterNode({ data, selected }: NodeProps<ChapterFlowNode>) {
  const ring = data.hasIssues
    ? 'ring-4 ring-red-500'
    : selected
      ? 'ring-4 ring-blue-500'
      : 'ring-1 ring-gray-300';

  return (
    <div
      className="flex flex-col items-center pt-2"
      style={{ width: TRAIL_COLUMN_WIDTH, height: TRAIL_ROW_HEIGHT }}
    >
      <Handle type="target" position={Position.Top} />
      <div
        className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-white text-xl shadow-sm ${ring}`}
      >
        <span aria-hidden>{nodeIcon(data.type)}</span>
        {(data.isEntry || data.isBoss) && (
          <span
            className={`absolute -top-2 rounded px-1 text-[10px] font-medium ${
              data.isEntry ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
            }`}
          >
            {data.isEntry ? 'Entrada' : 'Chefe'}
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 w-[130%] text-center text-[11px] leading-tight font-medium text-gray-900">
        {data.label}
      </p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
