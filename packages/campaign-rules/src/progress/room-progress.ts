/**
 * A room's progress as stored facts (Fase 5 plan decisions 1 and 14). Only what happened is
 * kept — a node cleared, a campfire lit, a chapter cleared — and every fact carries the room's
 * sequence number, which orders "after the campfire" (never the clock). Unlocked is never
 * stored: it is derived from these facts and the snapshot.
 */

/** A node the room cleared, and who took part (the defeat rollback reads them, decision 5). */
export interface NodeClear {
  chapterId: string;
  nodeId: string;
  seq: number;
  profileIds: readonly string[];
}

/** The campfire lit last in a chapter: where a defeat in that chapter returns to. */
export interface LitCampfire {
  chapterId: string;
  nodeId: string;
  seq: number;
}

export interface RoomProgress {
  /** Last sequence number used; the next fact takes `seq + 1`. */
  seq: number;
  clears: readonly NodeClear[];
  /** At most one per chapter. */
  campfires: readonly LitCampfire[];
  /** Chapters whose boss was beaten; permanent (decision 7). */
  clearedChapterIds: readonly string[];
}

export const EMPTY_PROGRESS: RoomProgress = {
  seq: 0,
  clears: [],
  campfires: [],
  clearedChapterIds: [],
};
