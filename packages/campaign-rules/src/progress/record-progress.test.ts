import { describe, expect, it } from 'vitest';
import { progressSnapshot as snapshot } from './fixtures/progress-snapshot.js';
import { checkNodeEntry } from './node-entry.js';
import { campaignCompleted, locateNode, nodeState } from './node-state.js';
import { recordCampfireLit, recordNodeCleared, rollbackDefeat } from './record-progress.js';
import { EMPTY_PROGRESS, type RoomProgress } from './room-progress.js';

type Step = [kind: 'clear' | 'fire', nodeId: string, profileIds: string[]];

function play(steps: Step[], from: RoomProgress = EMPTY_PROGRESS): RoomProgress {
  return steps.reduce(
    (progress, [kind, nodeId, profileIds]) =>
      kind === 'fire'
        ? recordCampfireLit(snapshot, progress, nodeId, profileIds)
        : recordNodeCleared(snapshot, progress, nodeId, profileIds),
    from,
  );
}

const state = (progress: RoomProgress, nodeId: string) =>
  nodeState(snapshot, progress, locateNode(snapshot, nodeId)!);

const cleared = (progress: RoomProgress) => progress.clears.map((c) => c.nodeId).sort();

const FIGHT = ['battle', 'boss'] as const;

/** Chapter 1 played up to its boss: A and B split into the two branches after the intro. */
const throughChapter1: Step[] = [
  ['clear', 'intro', ['A']],
  ['clear', 'a', ['A']],
  ['fire', 'fire', ['A']],
  ['clear', 'a2', ['A']],
  ['clear', 'b', ['B']],
  ['clear', 'shop', ['B']],
];

describe('recording progress (Fase 5 plan decisions 1–7)', () => {
  it('numbers every fact and keeps the first clear', () => {
    const progress = play([
      ['clear', 'intro', ['A']],
      ['clear', 'intro', ['B']],
    ]);
    expect(progress.seq).toBe(1);
    expect(progress.clears).toEqual([
      { chapterId: 'ch1', nodeId: 'intro', seq: 1, profileIds: ['A'] },
    ]);
  });

  it('closes a won battle but keeps a visited shop open (decision 3)', () => {
    const progress = play(throughChapter1);
    expect(checkNodeEntry(snapshot, progress, 'a', FIGHT)).toBe('node_cleared');
    expect(checkNodeEntry(snapshot, progress, 'shop', ['shop'])).toBeNull();
    expect(checkNodeEntry(snapshot, progress, 'fire', ['campfire'])).toBeNull();
  });

  it('refuses locked, unknown and mistyped nodes', () => {
    expect(checkNodeEntry(snapshot, EMPTY_PROGRESS, 'a', FIGHT)).toBe('node_locked');
    expect(checkNodeEntry(snapshot, EMPTY_PROGRESS, 'ghost', FIGHT)).toBe('node_not_found');
    expect(checkNodeEntry(snapshot, EMPTY_PROGRESS, 'intro', FIGHT)).toBe('wrong_node_type');
    expect(checkNodeEntry(snapshot, EMPTY_PROGRESS, 'intro', ['narrative'])).toBeNull();
  });

  it('opens the prerequisite-gated battle only after the shop', () => {
    const progress = play([['clear', 'intro', ['A']]]);
    expect(state(progress, 'p')).toBe('locked');
    expect(
      state(
        play(
          [
            ['clear', 'b', ['B']],
            ['clear', 'shop', ['B']],
          ],
          progress,
        ),
        'p',
      ),
    ).toBe('unlocked');
  });

  it('beating the boss clears the chapter and reaches the next one (decision 6)', () => {
    const before = play(throughChapter1);
    expect(state(before, 'boss1')).toBe('unlocked');
    expect(state(before, 'c')).toBe('locked');

    const after = play([['clear', 'boss1', ['A', 'B']]], before);
    expect(after.clearedChapterIds).toEqual(['ch1']);
    expect(state(after, 'c')).toBe('unlocked');
    // The optional battle left behind in chapter 1 stays playable.
    expect(checkNodeEntry(snapshot, after, 'p', FIGHT)).toBeNull();
  });

  it('completes the campaign with the last boss', () => {
    const progress = play([...throughChapter1, ['clear', 'boss1', ['A']], ['clear', 'c', ['A']]]);
    expect(campaignCompleted(snapshot, progress)).toBe(false);
    expect(campaignCompleted(snapshot, play([['clear', 'boss2', ['A']]], progress))).toBe(true);
  });
});

describe('rollbackDefeat (spec §3.7, decision 5 option b)', () => {
  it('undoes only what the defeated took part in after the campfire', () => {
    // A lit the fire and won a2; B, on the other branch, won b and visited the shop.
    const progress = play(throughChapter1);
    const back = rollbackDefeat(snapshot, progress, 'p', ['B']);
    expect(cleared(back)).toEqual(['a', 'a2', 'fire', 'intro']);
  });

  it('never undoes what came before the campfire, nor the campfire itself', () => {
    const progress = play(throughChapter1);
    const back = rollbackDefeat(snapshot, progress, 'boss1', ['A', 'B']);
    // intro and a came before the fire (seq 3); the fire stays lit.
    expect(cleared(back)).toEqual(['a', 'fire', 'intro']);
    expect(back.campfires).toEqual([{ chapterId: 'ch1', nodeId: 'fire', seq: 3 }]);
  });

  it('returns to the chapter entry without a lit campfire', () => {
    const progress = play([
      ['clear', 'intro', ['A']],
      ['clear', 'b', ['A']],
    ]);
    expect(cleared(rollbackDefeat(snapshot, progress, 'shop', ['A']))).toEqual([]);
  });

  it('keeps a node cleared when what unlocked it is undone', () => {
    // B won b; A (alone) visited the shop b unlocked. B loses: b reopens, the shop stays.
    const progress = play([
      ['clear', 'intro', ['A', 'B']],
      ['clear', 'b', ['B']],
      ['clear', 'shop', ['A']],
    ]);
    const back = rollbackDefeat(snapshot, progress, 'p', ['B']);
    expect(cleared(back)).toEqual(['shop']);
    expect(state(back, 'shop')).toBe('cleared');
  });

  it('stays inside the chapter of the lost battle and never undoes a beaten boss', () => {
    const progress = play([
      ...throughChapter1,
      ['clear', 'boss1', ['A', 'B']],
      ['clear', 'c', ['A']],
    ]);
    // A loses the optional p of chapter 1 after the chapter was cleared.
    const back = rollbackDefeat(snapshot, progress, 'p', ['A']);
    expect(cleared(back)).toEqual(['a', 'b', 'boss1', 'c', 'fire', 'intro', 'shop']);
    expect(back.clearedChapterIds).toEqual(['ch1']);
  });

  it('relighting an older campfire moves the point of return to it', () => {
    const progress = play([...throughChapter1, ['fire', 'fire', ['B']]]);
    // The relight (seq 7) is after everything: nothing to undo.
    expect(rollbackDefeat(snapshot, progress, 'p', ['A', 'B'])).toBe(progress);
  });
});
