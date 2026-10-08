import {
  ChapterNodeSchema,
  TRAIL_WIDTH,
  VillainSchema,
  isOnTrailGrid,
  isSinglePathNode,
  reachableNodeIds,
  type CampaignDraft,
  type DraftChapter,
  type Question,
} from '@rpg-chains/shared-types';
import type { ZodIssue } from 'zod';
import { formatPath, type DraftIssue } from './issues.js';
import { neverUnlockingNodes } from './progress/unlock.js';
import { publishableChapters, toSnapshotNode, toSnapshotVillain } from './snapshot-mapping.js';
import { validateClasses } from './validate-classes.js';

/** Campaign-wide content a chapter's nodes may reference by id. */
export interface ContentPools {
  villainIds: ReadonlySet<string>;
  questions: ReadonlyMap<string, Question>;
  itemIds: ReadonlySet<string>;
}

export function contentPools(draft: CampaignDraft): ContentPools {
  return {
    villainIds: new Set(draft.villains.map((v) => v.id)),
    questions: new Map(draft.questions.map((q) => [q.id, q])),
    itemIds: new Set(draft.items.map((i) => i.id)),
  };
}

/** Whether the chapter graph has a directed cycle (iterative three-color DFS). */
function hasCycle(chapter: DraftChapter): boolean {
  const adjacency = new Map<string, string[]>(chapter.nodes.map((n) => [n.id, []]));
  for (const { from, to } of chapter.edges) adjacency.get(from)?.push(to);
  const state = new Map<string, 'visiting' | 'done'>();
  for (const start of adjacency.keys()) {
    if (state.has(start)) continue;
    const stack: Array<{ id: string; next: number }> = [{ id: start, next: 0 }];
    state.set(start, 'visiting');
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const neighbors = adjacency.get(frame.id) ?? [];
      if (frame.next >= neighbors.length) {
        state.set(frame.id, 'done');
        stack.pop();
        continue;
      }
      const neighbor = neighbors[frame.next++]!;
      const seen = state.get(neighbor);
      if (seen === 'visiting') return true;
      if (seen === undefined && adjacency.has(neighbor)) {
        state.set(neighbor, 'visiting');
        stack.push({ id: neighbor, next: 0 });
      }
    }
  }
  return false;
}

function schemaIssues(
  issues: readonly ZodIssue[],
  basePath: ReadonlyArray<string | number>,
  ids: Pick<DraftIssue, 'chapterId' | 'nodeId'>,
): DraftIssue[] {
  return issues.map((issue) => ({
    code: 'schema',
    path: formatPath([...basePath, ...issue.path]),
    message: issue.message,
    ...ids,
  }));
}

/**
 * Validation-gate checks for one chapter (spec §2.3, §3.2): entry and boss defined, every node
 * reachable from the entry, no cycles, battle parameters set, referenced ids exist, and open
 * questions only on single-path nodes. Usable on its own by the editor for live feedback.
 */
export function validateChapter(
  chapter: DraftChapter,
  pools: ContentPools,
  chapterIndex: number,
): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const chapterPath = ['chapters', chapterIndex] as const;
  const at = (...rest: Array<string | number>) => formatPath([...chapterPath, ...rest]);
  const chapterId = chapter.id;
  const nodeIds = new Set(chapter.nodes.map((n) => n.id));

  const entryOk = chapter.entryNodeId !== null && nodeIds.has(chapter.entryNodeId);
  const bossNode = chapter.nodes.find((n) => n.id === chapter.bossNodeId);
  if (!entryOk) {
    issues.push({
      code: 'entry_missing',
      path: at('entryNodeId'),
      message: 'Chapter has no entry node',
      chapterId,
    });
  }
  if (!bossNode) {
    issues.push({
      code: 'boss_missing',
      path: at('bossNodeId'),
      message: 'Chapter has no boss node',
      chapterId,
    });
  } else if (bossNode.type !== 'boss') {
    issues.push({
      code: 'boss_wrong_type',
      path: at('bossNodeId'),
      message: 'The chapter boss must be a node of type "boss"',
      chapterId,
      nodeId: bossNode.id,
    });
  }

  // The map is drawn at the trail's width (Fase 5 plan decision 17).
  if (chapter.background && chapter.background.width !== TRAIL_WIDTH) {
    issues.push({
      code: 'background_width_mismatch',
      path: at('background', 'width'),
      message: `The background map must be ${TRAIL_WIDTH} wide, the trail's width`,
      chapterId,
    });
  }

  const cyclic = hasCycle(chapter);
  if (cyclic) {
    issues.push({
      code: 'cycle',
      path: at('edges'),
      message: 'Chapter graph has a cycle',
      chapterId,
    });
  }

  const graph =
    entryOk && bossNode
      ? {
          entryNodeId: chapter.entryNodeId!,
          bossNodeId: bossNode.id,
          nodes: chapter.nodes,
          edges: chapter.edges,
        }
      : null;
  const reachable = graph ? reachableNodeIds(graph) : null;
  // Reachable by edges yet stuck behind prerequisites (spec §2.3, Fase 5 plan decision 8). A
  // prerequisite on an unknown node is already a missing_reference, so it does not count here.
  const stuck =
    graph && !cyclic
      ? new Set(
          neverUnlockingNodes({
            ...graph,
            nodes: graph.nodes.map((n) => ({
              ...n,
              prerequisites: n.prerequisites.filter((id) => nodeIds.has(id)),
            })),
          }),
        )
      : new Set<string>();

  chapter.nodes.forEach((node, n) => {
    const ids = { chapterId, nodeId: node.id };
    const nodeIssues: DraftIssue[] = [];
    const push = (issue: Omit<DraftIssue, 'chapterId' | 'nodeId'>) =>
      nodeIssues.push({ ...issue, ...ids });

    if (reachable && !reachable.has(node.id)) {
      push({
        code: 'unreachable_node',
        path: at('nodes', n),
        message: 'Node is not reachable from the entry',
      });
    }
    if (reachable?.has(node.id) && stuck.has(node.id)) {
      push({
        code: 'node_never_unlocks',
        path: at('nodes', n, 'prerequisites'),
        message: 'Node can never be unlocked: its prerequisites or the boss rule can never be met',
      });
    }
    if (!isOnTrailGrid(node.position)) {
      push({
        code: 'node_off_grid',
        path: at('nodes', n, 'position'),
        message: 'Node is not on a cell of the trail grid',
      });
    }
    if (node.type === 'boss' && node.id !== chapter.bossNodeId) {
      push({
        code: 'extra_boss',
        path: at('nodes', n, 'type'),
        message: 'Only the chapter boss may be of type "boss"',
      });
    }
    node.prerequisites.forEach((id, p) => {
      if (!nodeIds.has(id)) {
        push({
          code: 'missing_reference',
          path: at('nodes', n, 'prerequisites', p),
          message: `Unknown node "${id}"`,
        });
      }
    });

    if (node.type === 'battle' || node.type === 'boss') {
      if (node.recommendedLevel === null) {
        push({
          code: 'battle_incomplete',
          path: at('nodes', n, 'recommendedLevel'),
          message: 'Recommended level is required',
        });
      }
      if (node.type === 'battle' && node.participantLimit === null) {
        push({
          code: 'battle_incomplete',
          path: at('nodes', n, 'participantLimit'),
          message: 'Participant limit is required',
        });
      }
      if (node.config.villainIds.length === 0) {
        push({
          code: 'no_villains',
          path: at('nodes', n, 'villainIds'),
          message: 'A battle needs at least one villain',
        });
      }
      node.config.villainIds.forEach((id, v) => {
        if (!pools.villainIds.has(id)) {
          push({
            code: 'missing_reference',
            path: at('nodes', n, 'villainIds', v),
            message: `Unknown villain "${id}"`,
          });
        }
      });
      const singlePath = graph && !cyclic ? isSinglePathNode(graph, node.id) : true;
      node.config.questionIds.forEach((id, q) => {
        const question = pools.questions.get(id);
        if (!question) {
          push({
            code: 'missing_reference',
            path: at('nodes', n, 'questionIds', q),
            message: `Unknown question "${id}"`,
          });
        } else if (question.type === 'open' && !singlePath) {
          push({
            code: 'open_question_on_branch',
            path: at('nodes', n, 'questionIds', q),
            message: 'Open questions are only allowed on single-path nodes',
          });
        }
      });
    }
    if (node.type === 'shop') {
      node.config.itemIds.forEach((id, i) => {
        if (!pools.itemIds.has(id)) {
          push({
            code: 'missing_reference',
            path: at('nodes', n, 'itemIds', i),
            message: `Unknown item "${id}"`,
          });
        }
      });
    }

    // Shape check against the snapshot schema; skip paths already explained above.
    const parsed = ChapterNodeSchema.safeParse(toSnapshotNode(node));
    if (!parsed.success) {
      const covered = nodeIssues.filter((i) => i.code !== 'unreachable_node').map((i) => i.path);
      for (const issue of schemaIssues(parsed.error.issues, [...chapterPath, 'nodes', n], ids)) {
        if (!covered.some((path) => issue.path.startsWith(path))) nodeIssues.push(issue);
      }
    }
    issues.push(...nodeIssues);
  });

  if (chapter.name.trim() === '') {
    issues.push({
      code: 'schema',
      path: at('name'),
      message: 'Chapter name is required',
      chapterId,
    });
  }
  return issues;
}

/**
 * A chapter under construction must come after every finished one (spec §2.2, Fase 5 plan
 * decision 18): publishing it later appends it, never inserts it before chapters rooms passed.
 */
function underConstructionOrder(draft: CampaignDraft): DraftIssue[] {
  const ordered = [...draft.chapters].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const lastFinished = ordered.map((chapter) => !chapter.underConstruction).lastIndexOf(true);
  return ordered.slice(0, Math.max(0, lastFinished)).flatMap((chapter) =>
    chapter.underConstruction
      ? [
          {
            code: 'chapter_under_construction_not_last' as const,
            path: formatPath(['chapters', draft.chapters.indexOf(chapter), 'underConstruction']),
            message: 'A chapter under construction must come after every finished chapter',
            chapterId: chapter.id,
          },
        ]
      : [],
  );
}

/**
 * The publish validation gate (Fase 1 plan, M3): every blocking problem of the draft, empty
 * when it can be published. Chapters under construction are skipped — they never publish.
 */
export function validateDraft(draft: CampaignDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];
  if (draft.name.trim() === '') {
    issues.push({ code: 'schema', path: 'name', message: 'Campaign name is required' });
  }

  const publishable = new Set(publishableChapters(draft.chapters).map((c) => c.id));
  if (publishable.size === 0) {
    issues.push({
      code: 'no_chapters',
      path: 'chapters',
      message: 'At least one finished chapter is required',
    });
  }
  issues.push(...underConstructionOrder(draft));
  const pools = contentPools(draft);
  draft.chapters.forEach((chapter, index) => {
    if (publishable.has(chapter.id)) issues.push(...validateChapter(chapter, pools, index));
  });

  draft.villains.forEach((villain, index) => {
    const parsed = VillainSchema.safeParse(toSnapshotVillain(villain));
    if (!parsed.success) issues.push(...schemaIssues(parsed.error.issues, ['villains', index], {}));
    villain.drops.forEach((drop, d) => {
      if (!pools.itemIds.has(drop.itemId)) {
        issues.push({
          code: 'missing_reference',
          path: formatPath(['villains', index, 'drops', d, 'itemId']),
          message: `Unknown item "${drop.itemId}"`,
        });
      }
    });
  });
  issues.push(...validateClasses(draft));
  return issues;
}
