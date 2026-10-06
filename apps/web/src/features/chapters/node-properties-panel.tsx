'use client';

import { useId } from 'react';
import type { DraftGraph, DraftNode, DraftVillain, Question } from '@rpg-chains/shared-types';

const inputClass =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700';
const buttonClass =
  'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50';

interface NodePropertiesPanelProps {
  node: DraftNode;
  graph: DraftGraph;
  labels: Map<string, string>;
  villains: DraftVillain[];
  questions: Question[];
  onUpdate: (updater: (node: DraftNode) => DraftNode) => void;
  onToggleEdge: (from: string, to: string) => void;
  onSetEntry: () => void;
  onSetBoss: () => void;
  onDelete: () => void;
}

/** Parses a number input; empty or non-positive becomes null. */
function toNullablePositive(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Returns the list with the id added or removed. */
function toggleId(ids: string[], id: string, on: boolean): string[] {
  return on ? [...ids.filter((i) => i !== id), id] : ids.filter((i) => i !== id);
}

/** Returns how many times the id appears in the list. */
function countOf(ids: string[], id: string): number {
  return ids.filter((i) => i === id).length;
}

/** Rewrites the villain list so each villain appears `count` times, keeping villain order stable. */
function withVillainCount(
  ids: string[],
  villains: DraftVillain[],
  villainId: string,
  count: number,
): string[] {
  return villains.flatMap((v) =>
    Array<string>(v.id === villainId ? count : countOf(ids, v.id)).fill(v.id),
  );
}

/** Side panel editing the selected node's properties, links and entry/boss role. */
export function NodePropertiesPanel({
  node,
  graph,
  labels,
  villains,
  questions,
  onUpdate,
  onToggleEdge,
  onSetEntry,
  onSetBoss,
  onDelete,
}: NodePropertiesPanelProps) {
  const uid = useId();
  const others = graph.nodes.filter((n) => n.id !== node.id);

  const setVillainCount = (villainId: string, raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    const count = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    onUpdate((n) =>
      n.type === 'battle' || n.type === 'boss'
        ? {
            ...n,
            config: {
              ...n.config,
              villainIds: withVillainCount(n.config.villainIds, villains, villainId, count),
            },
          }
        : n,
    );
  };

  const setCombatIds = (key: 'questionIds', id: string, on: boolean) =>
    onUpdate((n) =>
      n.type === 'battle' || n.type === 'boss'
        ? { ...n, config: { ...n.config, [key]: toggleId(n.config[key], id, on) } }
        : n,
    );

  return (
    <section
      aria-labelledby={`${uid}-title`}
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-4"
    >
      <h2 id={`${uid}-title`} className="text-lg font-semibold text-gray-900">
        {labels.get(node.id)}
      </h2>

      <div>
        <label htmlFor={`${uid}-name`} className={labelClass}>
          Nome do nó
        </label>
        <input
          id={`${uid}-name`}
          type="text"
          className={inputClass}
          value={node.title}
          onChange={(e) => onUpdate((n) => ({ ...n, title: e.target.value }))}
        />
      </div>

      {node.type !== 'boss' && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={node.mandatory}
            onChange={(e) => onUpdate((n) => ({ ...n, mandatory: e.target.checked }))}
          />
          Obrigatório
        </label>
      )}

      {(node.type === 'battle' || node.type === 'boss') && (
        <div>
          <label htmlFor={`${uid}-level`} className={labelClass}>
            Nível recomendado
          </label>
          <input
            id={`${uid}-level`}
            type="number"
            min={1}
            className={inputClass}
            value={node.recommendedLevel ?? ''}
            onChange={(e) =>
              onUpdate((n) => ({ ...n, recommendedLevel: toNullablePositive(e.target.value) }))
            }
          />
        </div>
      )}

      {node.type === 'battle' && (
        <div>
          <label htmlFor={`${uid}-limit`} className={labelClass}>
            Limite de participantes
          </label>
          <input
            id={`${uid}-limit`}
            type="number"
            min={1}
            className={inputClass}
            value={node.participantLimit ?? ''}
            onChange={(e) =>
              onUpdate((n) => ({ ...n, participantLimit: toNullablePositive(e.target.value) }))
            }
          />
        </div>
      )}

      {(node.type === 'battle' || node.type === 'boss') && (
        <>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium text-gray-700">Vilões</legend>
            {villains.length === 0 && (
              <p className="text-sm text-gray-500">Nenhum vilão cadastrado.</p>
            )}
            {villains.map((villain) => (
              <label key={villain.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="number"
                  min={0}
                  className="w-16 rounded-md border border-gray-300 px-2 py-1 text-gray-900"
                  value={countOf(node.config.villainIds, villain.id)}
                  onChange={(e) => setVillainCount(villain.id, e.target.value)}
                />
                {villain.name}
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="text-sm font-medium text-gray-700">Perguntas</legend>
            {questions.length === 0 && (
              <p className="text-sm text-gray-500">Nenhuma pergunta cadastrada.</p>
            )}
            {questions.map((question) => (
              <label key={question.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={node.config.questionIds.includes(question.id)}
                  onChange={(e) => setCombatIds('questionIds', question.id, e.target.checked)}
                />
                {question.prompt}
                {question.type === 'open' && ' (aberta)'}
              </label>
            ))}
          </fieldset>
        </>
      )}

      {node.type === 'narrative' && (
        <>
          <div>
            <label htmlFor={`${uid}-text`} className={labelClass}>
              Texto
            </label>
            <textarea
              id={`${uid}-text`}
              rows={4}
              className={inputClass}
              value={node.config.text}
              onChange={(e) =>
                onUpdate((n) =>
                  n.type === 'narrative'
                    ? { ...n, config: { ...n.config, text: e.target.value } }
                    : n,
                )
              }
            />
          </div>
          <div>
            <label htmlFor={`${uid}-video`} className={labelClass}>
              URL do vídeo
            </label>
            <input
              id={`${uid}-video`}
              type="text"
              className={inputClass}
              value={node.config.videoUrl ?? ''}
              onChange={(e) =>
                onUpdate((n) =>
                  n.type === 'narrative'
                    ? { ...n, config: { ...n.config, videoUrl: e.target.value.trim() || null } }
                    : n,
                )
              }
            />
          </div>
        </>
      )}

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-gray-700">Pré-requisitos</legend>
        {others.length === 0 && <p className="text-sm text-gray-500">Nenhum outro nó.</p>}
        {others.map((other) => (
          <label key={other.id} className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={node.prerequisites.includes(other.id)}
              onChange={(e) =>
                onUpdate((n) => ({
                  ...n,
                  prerequisites: toggleId(n.prerequisites, other.id, e.target.checked),
                }))
              }
            />
            {labels.get(other.id)}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-gray-700">Liga para</legend>
        {others.length === 0 && <p className="text-sm text-gray-500">Nenhum outro nó.</p>}
        {others.map((other) => (
          <label key={other.id} className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={graph.edges.some((e) => e.from === node.id && e.to === other.id)}
              onChange={() => onToggleEdge(node.id, other.id)}
            />
            {labels.get(other.id)}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onSetEntry} className={buttonClass}>
          Definir como entrada
        </button>
        <button type="button" onClick={onSetBoss} className={buttonClass}>
          Definir como chefe
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          Excluir nó
        </button>
      </div>
    </section>
  );
}
