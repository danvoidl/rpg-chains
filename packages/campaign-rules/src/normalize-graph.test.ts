import { describe, expect, it } from 'vitest';
import { validDraft } from './fixtures/load.js';
import { normalizeGraph } from './normalize-graph.js';

describe('normalizeGraph', () => {
  it('cleans every reference to a deleted node', () => {
    const chapter = validDraft().chapters[0]!;
    const graph = {
      entryNodeId: chapter.entryNodeId,
      bossNodeId: chapter.bossNodeId,
      // Delete the entry and the battle; the boss keeps a prerequisite on the battle.
      nodes: chapter.nodes.filter((n) => n.id !== 'n-a' && n.id !== 'n-entry'),
      edges: [...chapter.edges, { from: 'n-b', to: 'n-boss' }],
    };
    const result = normalizeGraph(graph);
    expect(result.entryNodeId).toBeNull();
    expect(result.bossNodeId).toBe('n-boss');
    expect(result.edges).toEqual([{ from: 'n-b', to: 'n-boss' }]);
    expect(result.nodes.find((n) => n.id === 'n-boss')?.prerequisites).toEqual([]);
  });
});
