'use client';

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export type ChapterFlowNode = Node<
  { label: string; isEntry: boolean; isBoss: boolean; hasIssues: boolean },
  'chapterNode'
>;

/** Custom canvas node: display label, entry/boss badges and a red border on issues. */
export function ChapterNode({ data, selected }: NodeProps<ChapterFlowNode>) {
  const border = data.hasIssues
    ? 'border-red-500'
    : selected
      ? 'border-blue-600'
      : 'border-gray-300';

  return (
    <div className={`min-w-32 rounded-md border-2 bg-white px-3 py-2 text-sm shadow-sm ${border}`}>
      <Handle type="target" position={Position.Top} />
      <p className="font-medium text-gray-900">{data.label}</p>
      <div className="mt-1 flex gap-1">
        {data.isEntry && (
          <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">Entrada</span>
        )}
        {data.isBoss && (
          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-800">Chefe</span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
