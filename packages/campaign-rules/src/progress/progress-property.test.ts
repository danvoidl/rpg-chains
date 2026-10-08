import { describe, expect, it } from 'vitest';
import { progressSnapshot as snapshot } from './fixtures/progress-snapshot.js';
import { campaignCompleted, locateNode, nodeState } from './node-state.js';
import { recordCampfireLit, recordNodeCleared, rollbackDefeat } from './record-progress.js';
import { EMPTY_PROGRESS, type RoomProgress } from './room-progress.js';

/**
 * Property test of the progress rules (Fase 5 plan M1), in the spirit of the engine's
 * `replay.test.ts`: for 200 seeds, a random group plays the fixture campaign — winning, losing,
 * lighting campfires, visiting — and after every step the invariants must hold.
 */

const SEEDS = 200;
const STEPS = 80;
const PLAYERS = ['A', 'B', 'C', 'D'];
const ALL_NODES = snapshot.chapters.flatMap((c) => c.nodes.map((n) => n.id));

/** mulberry32: a tiny seeded generator, local to the test. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Op =
  | { kind: 'win' | 'visit'; nodeId: string; profileIds: string[] }
  | { kind: 'light'; nodeId: string; profileIds: string[] }
  | { kind: 'lose'; nodeId: string; profileIds: string[] };

const state = (progress: RoomProgress, nodeId: string) =>
  nodeState(snapshot, progress, locateNode(snapshot, nodeId)!);

function apply(progress: RoomProgress, op: Op): RoomProgress {
  switch (op.kind) {
    case 'win':
    case 'visit':
      return recordNodeCleared(snapshot, progress, op.nodeId, op.profileIds);
    case 'light':
      return recordCampfireLit(snapshot, progress, op.nodeId, op.profileIds);
    case 'lose':
      return rollbackDefeat(snapshot, progress, op.nodeId, op.profileIds);
  }
}

/** One random legal play from `progress`, or null when nothing is open. */
function randomOp(progress: RoomProgress, next: () => number): Op | null {
  const open = ALL_NODES.filter((id) => {
    const s = state(progress, id);
    const combat = ['battle', 'boss'].includes(locateNode(snapshot, id)!.node.type);
    return s === 'unlocked' || (s === 'cleared' && !combat);
  });
  if (open.length === 0) return null;
  const nodeId = open[Math.floor(next() * open.length)]!;
  const profileIds = PLAYERS.filter(() => next() < 0.5);
  if (profileIds.length === 0) profileIds.push(PLAYERS[Math.floor(next() * PLAYERS.length)]!);
  const type = locateNode(snapshot, nodeId)!.node.type;
  if (type === 'campfire') return { kind: 'light', nodeId, profileIds };
  if (type === 'battle' || type === 'boss') {
    return { kind: next() < 0.7 ? 'win' : 'lose', nodeId, profileIds };
  }
  return { kind: 'visit', nodeId, profileIds };
}

/** Clears whatever unlocks, greedily, until nothing changes. */
function playToTheEnd(progress: RoomProgress): RoomProgress {
  let current = progress;
  for (;;) {
    const open = ALL_NODES.find((id) => state(current, id) === 'unlocked');
    if (!open) return current;
    const type = locateNode(snapshot, open)!.node.type;
    current =
      type === 'campfire'
        ? recordCampfireLit(snapshot, current, open, ['A'])
        : recordNodeCleared(snapshot, current, open, ['A']);
  }
}

function checkRollback(before: RoomProgress, after: RoomProgress, op: Op): void {
  const { chapter } = locateNode(snapshot, op.nodeId)!;
  const since = before.campfires.find((c) => c.chapterId === chapter.id)?.seq ?? 0;
  const kept = new Set(after.clears);
  expect(after.clears.every((c) => before.clears.includes(c))).toBe(true);
  for (const removed of before.clears.filter((c) => !kept.has(c))) {
    expect(removed.chapterId).toBe(chapter.id);
    expect(removed.seq).toBeGreaterThan(since);
    expect(removed.nodeId).not.toBe(chapter.bossNodeId);
    expect(removed.profileIds.some((id) => op.profileIds.includes(id))).toBe(true);
  }
  expect(after.campfires).toEqual(before.campfires);
  expect(after.clearedChapterIds).toEqual(before.clearedChapterIds);
}

function checkInvariants(progress: RoomProgress): void {
  const ids = progress.clears.map((c) => c.nodeId);
  expect(new Set(ids).size).toBe(ids.length);
  expect(progress.clears.every((c) => c.seq <= progress.seq)).toBe(true);
  // A cleared chapter keeps its beaten boss.
  for (const chapterId of progress.clearedChapterIds) {
    const chapter = snapshot.chapters.find((c) => c.id === chapterId)!;
    expect(ids).toContain(chapter.bossNodeId);
  }
  // Liveness: from anywhere, playing on clears every node and completes the campaign.
  const end = playToTheEnd(progress);
  expect(end.clears.map((c) => c.nodeId).sort()).toEqual([...ALL_NODES].sort());
  expect(campaignCompleted(snapshot, end)).toBe(true);
}

describe('progress rules: property over random plays', () => {
  it(`hold their invariants for ${SEEDS} seeds`, () => {
    let rollbacks = 0;
    let completions = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const next = random(seed);
      const ops: Op[] = [];
      let progress = EMPTY_PROGRESS;
      for (let step = 0; step < STEPS; step++) {
        const op = randomOp(progress, next);
        if (!op) break;
        ops.push(op);
        const after = apply(progress, op);
        if (op.kind === 'lose') {
          checkRollback(progress, after, op);
          if (after !== progress) rollbacks++;
        } else {
          expect(after.clearedChapterIds).toEqual(
            expect.arrayContaining([...progress.clearedChapterIds]),
          );
        }
        progress = after;
        checkInvariants(progress);
      }
      if (campaignCompleted(snapshot, progress)) completions++;
      // Same plays, same progress.
      expect(ops.reduce(apply, EMPTY_PROGRESS)).toEqual(progress);
    }
    // The generator really exercises defeats and finishes campaigns.
    expect(rollbacks).toBeGreaterThan(SEEDS / 2);
    expect(completions).toBeGreaterThan(0);
  });
});
