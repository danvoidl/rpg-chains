'use client';

import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Connection,
  type Edge as FlowEdge,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { DraftGraph } from '@rpg-chains/shared-types';
import { ChapterNode, type ChapterFlowNode } from './chapter-node';

const nodeTypes = { chapterNode: ChapterNode };

interface GraphCanvasProps {
  graph: DraftGraph;
  labels: Map<string, string>;
  selectedId: string | null;
  issueNodeIds: ReadonlySet<string>;
  onSelect: (id: string | null) => void;
  onMove: (id: string, position: { x: number; y: number }) => void;
  onConnect: (from: string, to: string) => void;
  onDeleteNodes: (ids: string[]) => void;
  onDeleteEdges: (edges: Array<{ from: string; to: string }>) => void;
}

/** Controlled @xyflow/react canvas: drag, connect, select and keyboard-delete over a draft graph. */
export function GraphCanvas({
  graph,
  labels,
  selectedId,
  issueNodeIds,
  onSelect,
  onMove,
  onConnect,
  onDeleteNodes,
  onDeleteEdges,
}: GraphCanvasProps) {
  const nodes = useMemo<ChapterFlowNode[]>(
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        type: 'chapterNode',
        position: node.position,
        selected: node.id === selectedId,
        data: {
          label: labels.get(node.id) ?? node.type,
          isEntry: node.id === graph.entryNodeId,
          isBoss: node.id === graph.bossNodeId,
          hasIssues: issueNodeIds.has(node.id),
        },
      })),
    [graph.nodes, graph.entryNodeId, graph.bossNodeId, labels, selectedId, issueNodeIds],
  );

  const edges = useMemo<FlowEdge[]>(
    () => graph.edges.map((e) => ({ id: `${e.from}->${e.to}`, source: e.from, target: e.to })),
    [graph.edges],
  );

  const handleNodesChange = (changes: NodeChange<ChapterFlowNode>[]) => {
    for (const change of changes) {
      if (change.type === 'position' && change.position) onMove(change.id, change.position);
      else if (change.type === 'select' && change.selected) onSelect(change.id);
    }
  };

  const handleConnect = (connection: Connection) => onConnect(connection.source, connection.target);

  return (
    <div className="h-[560px] rounded-lg border border-gray-200 bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onConnect={handleConnect}
        onNodesDelete={(deleted) => onDeleteNodes(deleted.map((n) => n.id))}
        onEdgesDelete={(deleted) =>
          onDeleteEdges(deleted.map((e) => ({ from: e.source, to: e.target })))
        }
        onPaneClick={() => onSelect(null)}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
