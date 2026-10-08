'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { contentPools, validateChapter } from '@rpg-chains/campaign-rules';
import type {
  CampaignDraft,
  DraftChapter,
  DraftGraph,
  NodeType,
  TrailPosition,
} from '@rpg-chains/shared-types';
import { ApiError } from '@/lib/api';
import { useCampaignDraft } from '@/features/campaigns/draft-api';
import { useChapter, useSaveGraph } from '@/features/chapters/api';
import { GraphCanvas } from '@/features/chapters/graph-canvas';
import {
  addNode,
  connect,
  disconnect,
  moveNode,
  removeNodes,
  toggleEdge,
  updateNode,
} from '@/features/chapters/graph-ops';
import { dropPosition, newNodePosition, snapAllToGrid } from '@/features/chapters/grid-placement';
import { IssuesPanel } from '@/features/chapters/issues-panel';
import { createNode, NODE_TYPE_LABELS } from '@/features/chapters/node-defaults';
import { nodeLabels } from '@/features/chapters/node-labels';
import { NodePropertiesPanel } from '@/features/chapters/node-properties-panel';

const NODE_TYPES: NodeType[] = ['battle', 'boss', 'shop', 'campfire', 'narrative'];

function toGraph(chapter: DraftChapter): DraftGraph {
  return {
    entryNodeId: chapter.entryNodeId,
    bossNodeId: chapter.bossNodeId,
    nodes: chapter.nodes,
    edges: chapter.edges,
  };
}

/** Chapter graph editor page: loads the chapter and draft, then renders the editor. */
export default function ChapterEditorPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;
  const chapterId = params.chapterId as string;

  const { data: chapter, isLoading } = useChapter(campaignId, chapterId);
  const { data: draft } = useCampaignDraft(campaignId);

  if (isLoading || !chapter || !draft) {
    return <p className="text-sm text-gray-500">Carregando…</p>;
  }

  return <ChapterEditor key={chapterId} campaignId={campaignId} chapter={chapter} draft={draft} />;
}

interface ChapterEditorProps {
  campaignId: string;
  chapter: DraftChapter;
  draft: CampaignDraft;
}

/** Editable graph state, toolbar, canvas, properties and issues panels for one chapter. */
function ChapterEditor({ campaignId, chapter, draft }: ChapterEditorProps) {
  const saveGraph = useSaveGraph(campaignId, chapter.id);

  // Initialized once from the server and re-initialized after each save; refetches don't clobber edits.
  const [graph, setGraph] = useState<DraftGraph>(() => toGraph(chapter));
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(toGraph(chapter)));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const isDirty = JSON.stringify(graph) !== savedJson;
  const labels = useMemo(() => nodeLabels(graph.nodes), [graph.nodes]);

  const issues = useMemo(() => {
    const chapterIndex = Math.max(
      0,
      draft.chapters.findIndex((c) => c.id === chapter.id),
    );
    return validateChapter({ ...chapter, ...graph }, contentPools(draft), chapterIndex);
  }, [chapter, graph, draft]);

  const issueNodeIds = useMemo(
    () => new Set(issues.flatMap((i) => (i.nodeId ? [i.nodeId] : []))),
    [issues],
  );

  const selectedNode = graph.nodes.find((n) => n.id === selectedId) ?? null;

  const edit = (updater: (g: DraftGraph) => DraftGraph) => {
    setJustSaved(false);
    setGraph(updater);
  };

  const handleAddNode = (type: NodeType) => {
    const node = createNode(type, newNodePosition(graph.nodes), graph.nodes);
    edit((g) => addNode(g, node));
    setSelectedId(node.id);
  };

  // A drop on a taken cell puts the node back where the drag started: one node per cell.
  const handleDrop = (id: string, position: TrailPosition, from: TrailPosition) =>
    edit((g) => moveNode(g, id, dropPosition(g.nodes, id, position) ?? from));

  const offGrid = issues.some((i) => i.code === 'node_off_grid');

  const handleDeleteNodes = (ids: string[]) => {
    edit((g) => removeNodes(g, ids));
    if (selectedId && ids.includes(selectedId)) setSelectedId(null);
  };

  const handleSave = async () => {
    const saved = await saveGraph.mutateAsync(graph).catch(() => null);
    if (!saved) return;
    const next = toGraph(saved);
    setGraph(next);
    setSavedJson(JSON.stringify(next));
    if (selectedId && !next.nodes.some((n) => n.id === selectedId)) setSelectedId(null);
    setJustSaved(true);
  };

  const saveError =
    saveGraph.error instanceof ApiError
      ? `Erro ao salvar o grafo (${saveGraph.error.status}).`
      : saveGraph.error
        ? 'Erro ao salvar o grafo.'
        : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/campaigns/${campaignId}/chapters`}
          className="text-sm text-blue-600 hover:underline"
        >
          Voltar aos capítulos
        </Link>
        <h2 className="text-xl font-semibold text-gray-900">{chapter.name}</h2>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {NODE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleAddNode(type)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Adicionar {NODE_TYPE_LABELS[type]}
          </button>
        ))}

        {offGrid && (
          <button
            type="button"
            onClick={() => edit((g) => ({ ...g, nodes: snapAllToGrid(g.nodes) }))}
            className="rounded-md border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            Encaixar na grade
          </button>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saveGraph.isPending}
          className="ml-auto rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          Salvar grafo
        </button>
        {isDirty && <span className="text-sm text-yellow-700">Alterações não salvas</span>}
        {justSaved && !isDirty && (
          <span role="status" className="text-sm text-green-700">
            Grafo salvo
          </span>
        )}
      </div>

      {saveError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {saveError}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <GraphCanvas
          graph={graph}
          background={chapter.background}
          labels={labels}
          selectedId={selectedId}
          issueNodeIds={issueNodeIds}
          onSelect={setSelectedId}
          onMove={(id, position) => edit((g) => moveNode(g, id, position))}
          onDrop={handleDrop}
          onConnect={(from, to) => edit((g) => connect(g, from, to))}
          onDeleteNodes={handleDeleteNodes}
          onDeleteEdges={(edges) => edit((g) => disconnect(g, edges))}
        />

        {selectedNode ? (
          <NodePropertiesPanel
            node={selectedNode}
            graph={graph}
            labels={labels}
            villains={draft.villains}
            questions={draft.questions}
            onUpdate={(updater) => edit((g) => updateNode(g, selectedNode.id, updater))}
            onToggleEdge={(from, to) => edit((g) => toggleEdge(g, from, to))}
            onSetEntry={() => edit((g) => ({ ...g, entryNodeId: selectedNode.id }))}
            onSetBoss={() => edit((g) => ({ ...g, bossNodeId: selectedNode.id }))}
            onDelete={() => handleDeleteNodes([selectedNode.id])}
          />
        ) : (
          <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
            Selecione um nó para editar suas propriedades.
          </p>
        )}
      </div>

      <IssuesPanel
        issues={issues}
        labels={labels}
        underConstruction={chapter.underConstruction}
        onSelectNode={setSelectedId}
      />
    </div>
  );
}
