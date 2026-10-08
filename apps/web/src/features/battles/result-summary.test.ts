import { describe, expect, it } from 'vitest';
import type { CampaignProgressView } from '@rpg-chains/shared-types';
import { clearedNodeIds, defeatReturnText, findNode, reopenedNodes } from './result-summary';

const node = (nodeId: string, type: string, title: string, state: string) =>
  ({ nodeId, type, title, state }) as never;

const progress = {
  completed: false,
  upcomingChapters: [],
  chapters: [
    {
      chapterId: 'c1',
      name: 'Um',
      state: 'current',
      campfireNodeId: 'f1',
      nodes: [
        node('b1', 'battle', 'Ratos', 'unlocked'),
        node('s1', 'shop', '', 'cleared'),
        node('f1', 'campfire', 'Brasas', 'cleared'),
      ],
    },
  ],
} as unknown as CampaignProgressView;

describe('result summary', () => {
  it('finds a node with its chapter', () => {
    expect(findNode(progress, 's1')?.chapter.chapterId).toBe('c1');
    expect(findNode(progress, 'x')).toBeNull();
  });

  it('lists nodes that stopped being cleared', () => {
    expect(clearedNodeIds(progress)).toEqual(new Set(['s1', 'f1']));
    const names = reopenedNodes(new Set(['b1', 's1']), progress).map((n) => n.nodeId);
    expect(names).toEqual(['b1']);
  });

  it('says where the group went back to', () => {
    const chapter = progress.chapters[0]!;
    expect(defeatReturnText(chapter)).toBe('O grupo voltou à fogueira Brasas.');
    expect(defeatReturnText({ ...chapter, campfireNodeId: null })).toBe(
      'O grupo voltou ao início do capítulo.',
    );
  });
});
