import {
  TRAIL_COLUMN_WIDTH,
  TRAIL_ROW_HEIGHT,
  TRAIL_WIDTH,
  type ChapterProgressView,
} from '@rpg-chains/shared-types';

/**
 * Where things sit on a chapter's trail (Fase 5 plan decisions 13 and 17), in percentages of the
 * column so the same world scales to any screen width. A node's position is the top-left corner of
 * its grid cell, in world pixels; it is drawn as-is, never re-laid out.
 */

/** The chapter's world height: its background's, or enough to hold the lowest node's cell. */
export function chapterHeight(chapter: Pick<ChapterProgressView, 'nodes' | 'background'>): number {
  const lowest = Math.max(0, ...chapter.nodes.map((n) => n.position.y));
  const fromNodes = chapter.nodes.length === 0 ? TRAIL_ROW_HEIGHT : lowest + TRAIL_ROW_HEIGHT;
  if (!chapter.background) return fromNodes;
  // The background map is scaled to the trail's width, keeping its proportions.
  const scaled = (chapter.background.height * TRAIL_WIDTH) / chapter.background.width;
  return Math.max(scaled, fromNodes);
}

export interface CellBox {
  /** Percent of the column width. */
  left: number;
  width: number;
  /** Percent of the chapter height. */
  top: number;
  height: number;
}

/** The node's cell as percentages of a chapter `height` world pixels tall. */
export function cellBox(position: { x: number; y: number }, height: number): CellBox {
  return {
    left: (position.x / TRAIL_WIDTH) * 100,
    width: (TRAIL_COLUMN_WIDTH / TRAIL_WIDTH) * 100,
    top: (position.y / height) * 100,
    height: (TRAIL_ROW_HEIGHT / height) * 100,
  };
}
