'use client';

import { useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Connection,
  type Edge as FlowEdge,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  TRAIL_COLUMN_WIDTH,
  TRAIL_ROW_HEIGHT,
  TRAIL_WIDTH,
  type ChapterBackground,
  type DraftGraph,
  type TrailPosition,
} from '@rpg-chains/shared-types';
import { ChapterNode, type ChapterFlowNode } from './chapter-node';
import { FocusNode } from './focus-node';
import { TrailColumn } from './trail-column';

/** Empty rows drawn below the lowest node, room to drag nodes further down. */
const SPARE_ROWS = 3;

const nodeTypes = { chapterNode: ChapterNode };

interface GraphCanvasProps {
  graph: DraftGraph;
  background: ChapterBackground | null;
  labels: Map<string, string>;
  selectedId: string | null;
  /** A node just added, to pan the canvas to. */
  focusId: string | null;
  issueNodeIds: ReadonlySet<string>;
  onSelect: (id: string | null) => void;
  onMove: (id: string, position: TrailPosition) => void;
  /** A drag ended at `position` (snapped); `from` is where it started, to put it back if refused. */
  onDrop: (id: string, position: TrailPosition, from: TrailPosition) => void;
  onConnect: (from: string, to: string) => void;
  onDeleteNodes: (ids: string[]) => void;
  onDeleteEdges: (edges: Array<{ from: string; to: string }>) => void;
}

/**
 * Controlled @xyflow/react canvas: drag, connect, select and keyboard-delete over a draft graph.
 * Nodes live on the trail grid (Fase 5 plan decision 17): dragging snaps to its cells and stays
 * inside the column; where a drop lands is decided by `onDrop`.
 */
export function GraphCanvas({
  graph,
  background,
  labels,
  selectedId,
  focusId,
  issueNodeIds,
  onSelect,
  onMove,
  onDrop,
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
          type: node.type,
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

  const dragStart = useRef(new Map<string, TrailPosition>());
  const lowest = graph.nodes.reduce((max, n) => Math.max(max, n.position.y), 0);
  const columnHeight = Math.max(
    lowest + TRAIL_ROW_HEIGHT * (1 + SPARE_ROWS),
    background ? (background.height * TRAIL_WIDTH) / background.width : 0,
  );

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
        onNodeDragStart={(_, node) => dragStart.current.set(node.id, node.position)}
        onNodeDragStop={(_, node) => {
          const from = dragStart.current.get(node.id) ?? node.position;
          dragStart.current.delete(node.id);
          onDrop(node.id, node.position, from);
        }}
        snapToGrid
        snapGrid={[TRAIL_COLUMN_WIDTH, TRAIL_ROW_HEIGHT]}
        nodeExtent={[
          [0, 0],
          [TRAIL_WIDTH, Infinity],
        ]}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
      >
        <TrailColumn height={columnHeight} background={background} />
        <FocusNode target={graph.nodes.find((n) => n.id === focusId) ?? null} />
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
