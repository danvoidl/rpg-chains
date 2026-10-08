import { describe, expect, it } from 'vitest';
import { progressSnapshot as snapshot } from './fixtures/progress-snapshot.js';
import { campaignProgress } from './progress-view.js';
import { recordCampfireLit, recordNodeCleared } from './record-progress.js';
import { EMPTY_PROGRESS } from './room-progress.js';

const states = (view: ReturnType<typeof campaignProgress>, chapter: number) =>
  Object.fromEntries(view.chapters[chapter]!.nodes.map((n) => [n.nodeId, n.state]));

describe('campaignProgress (the trail read model, Fase 5 plan decision 13)', () => {
  it('opens a new room on the first chapter entry, with the rest locked', () => {
    const view = campaignProgress(snapshot, EMPTY_PROGRESS);
    expect(view.chapters.map((c) => c.state)).toEqual(['current', 'locked']);
    expect(states(view, 0)).toEqual({
      intro: 'unlocked',
      a: 'locked',
      b: 'locked',
      p: 'locked',
      fire: 'locked',
      a2: 'locked',
      shop: 'locked',
      boss1: 'locked',
    });
    // A locked chapter's entry stays locked.
    expect(states(view, 1)).toEqual({ c: 'locked', boss2: 'locked' });
    expect(view.completed).toBe(false);
  });

  it('carries what the trail draws: opening, campfire, chapters under construction', () => {
    let progress = recordNodeCleared(snapshot, EMPTY_PROGRESS, 'intro', ['A']);
    progress = recordNodeCleared(snapshot, progress, 'a', ['A']);
    progress = recordCampfireLit(snapshot, progress, 'fire', ['A']);
    const view = campaignProgress(snapshot, progress);
    const chapter = view.chapters[0]!;
    expect(chapter.opening).toEqual({
      text: 'Era uma vez',
      videoUrl: 'https://example.com/ch1.mp4',
    });
    expect(chapter.background).toBeNull();
    expect(chapter.campfireNodeId).toBe('fire');
    expect(view.upcomingChapters).toEqual([{ id: 'ch3', name: 'Epílogo' }]);
  });

  it('describes each node for its balloon', () => {
    const view = campaignProgress(snapshot, EMPTY_PROGRESS);
    const node = (chapter: number, id: string) =>
      view.chapters[chapter]!.nodes.find((n) => n.nodeId === id)!;
    expect(node(0, 'a')).toMatchObject({
      type: 'battle',
      mandatory: true,
      recommendedLevel: 1,
      participantLimit: 4,
      needsMaster: false,
      battleId: null,
      position: { x: 160, y: 100 },
    });
    expect(node(0, 'shop')).toMatchObject({ recommendedLevel: null, participantLimit: null });
    expect(node(1, 'boss2')).toMatchObject({ participantLimit: null, needsMaster: true });
  });
});
