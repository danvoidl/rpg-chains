import { describe, expect, it } from 'vitest';
import { isSinglePathNode } from './graph.js';
import type { Chapter, ChapterNode } from './content.js';

const pos = { x: 0, y: 0 };

function narrative(id: string, prerequisites: string[] = []): ChapterNode {
  return {
    type: 'narrative',
    id,
    prerequisites,
    mandatory: true,
    position: pos,
    text: '',
    videoUrl: undefined,
  };
}

function boss(id: string): ChapterNode {
  return {
    type: 'boss',
    id,
    prerequisites: [],
    mandatory: true,
    recommendedLevel: 10,
    position: pos,
    villainIds: ['v1'],
    questionIds: [],
  };
}

/** Diamond: entry → {a, b} → boss. `a` and `b` are bypassable; entry/boss are not. */
function diamond(): Chapter {
  return {
    id: 'cap',
    name: 'Cap',
    underConstruction: false,
    entryNodeId: 'entry',
    bossNodeId: 'boss',
    nodes: [narrative('entry'), narrative('a'), narrative('b'), boss('boss')],
    edges: [
      { from: 'entry', to: 'a' },
      { from: 'entry', to: 'b' },
      { from: 'a', to: 'boss' },
      { from: 'b', to: 'boss' },
    ],
  };
}

/** Linear: entry → x → boss. `x` is a mandatory pass-through. */
function linear(): Chapter {
  return {
    id: 'cap',
    name: 'Cap',
    underConstruction: false,
    entryNodeId: 'entry',
    bossNodeId: 'boss',
    nodes: [narrative('entry'), narrative('x'), boss('boss')],
    edges: [
      { from: 'entry', to: 'x' },
      { from: 'x', to: 'boss' },
    ],
  };
}

describe('isSinglePathNode', () => {
  it('marks parallel-branch nodes as NOT single-path', () => {
    const cap = diamond();
    expect(isSinglePathNode(cap, 'a')).toBe(false);
    expect(isSinglePathNode(cap, 'b')).toBe(false);
  });

  it('marks mandatory pass-through nodes as single-path', () => {
    expect(isSinglePathNode(linear(), 'x')).toBe(true);
  });

  it('treats entry and boss as single-path', () => {
    const cap = diamond();
    expect(isSinglePathNode(cap, 'entry')).toBe(true);
    expect(isSinglePathNode(cap, 'boss')).toBe(true);
  });
});
