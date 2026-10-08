import { describe, expect, it } from 'vitest';
import { isNodeUnlocked, neverUnlockingNodes, type FlowChapter } from './unlock.js';

const node = (id: string, extra: Partial<FlowChapter['nodes'][number]> = {}) => ({
  id,
  type: 'battle' as const,
  mandatory: false,
  prerequisites: [],
  ...extra,
});

/** entry ─┬─ a ─┐
 *          └─ b ─┴─ boss   (a mandatory; b optional) */
const branches: FlowChapter = {
  entryNodeId: 'entry',
  bossNodeId: 'boss',
  nodes: [
    node('entry', { type: 'narrative' }),
    node('a', { mandatory: true }),
    node('b'),
    node('boss', { type: 'boss', mandatory: true }),
  ],
  edges: [
    { from: 'entry', to: 'a' },
    { from: 'entry', to: 'b' },
    { from: 'a', to: 'boss' },
    { from: 'b', to: 'boss' },
  ],
};

const unlocked = (chapter: FlowChapter, cleared: string[]) =>
  chapter.nodes.map((n) => n.id).filter((id) => isNodeUnlocked(chapter, new Set(cleared), id));

describe('isNodeUnlocked (spec §2.3, Fase 5 plan decision 2)', () => {
  it('starts with only the entry', () => {
    expect(unlocked(branches, [])).toEqual(['entry']);
  });

  it('opens every branch out of a cleared node (edges are OR)', () => {
    expect(unlocked(branches, ['entry'])).toEqual(['entry', 'a', 'b']);
  });

  it('keeps the boss until every mandatory node is cleared, of any type', () => {
    // b is cleared and has an edge into the boss, but the mandatory a is not.
    expect(isNodeUnlocked(branches, new Set(['entry', 'b']), 'boss')).toBe(false);
    expect(isNodeUnlocked(branches, new Set(['entry', 'a']), 'boss')).toBe(true);

    const mandatoryNarrative: FlowChapter = {
      ...branches,
      nodes: branches.nodes.map((n) => (n.id === 'entry' ? { ...n, mandatory: true } : n)),
    };
    expect(isNodeUnlocked(mandatoryNarrative, new Set(['a']), 'boss')).toBe(false);
  });

  it('locks a node until all its prerequisites are cleared (prerequisites are AND)', () => {
    const gated: FlowChapter = {
      ...branches,
      nodes: branches.nodes.map((n) => (n.id === 'b' ? { ...n, prerequisites: ['a'] } : n)),
    };
    expect(isNodeUnlocked(gated, new Set(['entry']), 'b')).toBe(false);
    expect(isNodeUnlocked(gated, new Set(['entry', 'a']), 'b')).toBe(true);
  });

  it('needs the path as well as the prerequisites', () => {
    const gated: FlowChapter = {
      ...branches,
      nodes: branches.nodes.map((n) => (n.id === 'b' ? { ...n, prerequisites: ['a'] } : n)),
    };
    // a is cleared but nothing on b's path (entry) is.
    expect(isNodeUnlocked(gated, new Set(['a']), 'b')).toBe(false);
  });

  it('refuses an unknown node', () => {
    expect(isNodeUnlocked(branches, new Set(['entry']), 'ghost')).toBe(false);
  });
});

describe('neverUnlockingNodes (Fase 5 plan decision 8)', () => {
  it('finds nothing in a playable chapter', () => {
    expect(neverUnlockingNodes(branches)).toEqual([]);
  });

  it('finds a node whose prerequisite comes after it, and what waits on it', () => {
    const stuck: FlowChapter = {
      ...branches,
      nodes: branches.nodes.map((n) => (n.id === 'a' ? { ...n, prerequisites: ['boss'] } : n)),
    };
    // a waits for the boss, the boss waits for the mandatory a.
    expect(neverUnlockingNodes(stuck)).toEqual(['a', 'boss']);
  });

  it('finds prerequisites waiting on each other', () => {
    const deadlock: FlowChapter = {
      ...branches,
      nodes: branches.nodes.map((n) =>
        n.id === 'a'
          ? { ...n, prerequisites: ['b'] }
          : n.id === 'b'
            ? { ...n, prerequisites: ['a'] }
            : n,
      ),
    };
    expect(neverUnlockingNodes(deadlock)).toEqual(['a', 'b', 'boss']);
  });

  it('finds a mandatory node behind the boss', () => {
    const behind: FlowChapter = {
      ...branches,
      nodes: [...branches.nodes, node('after', { mandatory: true })],
      edges: [...branches.edges, { from: 'boss', to: 'after' }],
    };
    expect(neverUnlockingNodes(behind)).toEqual(['boss', 'after']);
  });
});
