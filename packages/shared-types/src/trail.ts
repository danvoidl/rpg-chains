/**
 * The trail every chapter is drawn on (Fase 5 plan decisions 13 and 17): a fixed-width column
 * that only grows downward, the same on a phone and a desktop. Node positions are absolute
 * pixels of this world (never normalized); the editor snaps each node to a cell of a
 * `TRAIL_COLUMNS`-wide grid, so the trail always fits a phone with room for touch. Shared by the
 * editor, the publish gate and the player trail — interface numbers, not balancing.
 */

/** Logical width of every chapter's world; a background map is scaled to it. */
export const TRAIL_WIDTH = 400;
export const TRAIL_COLUMNS = 5;
export const TRAIL_COLUMN_WIDTH = TRAIL_WIDTH / TRAIL_COLUMNS;
export const TRAIL_ROW_HEIGHT = 100;

export interface TrailPosition {
  x: number;
  y: number;
}

/** A grid cell; a node's position is the top-left corner of its cell. */
export interface TrailCell {
  column: number;
  row: number;
}

export function cellPosition({ column, row }: TrailCell): TrailPosition {
  return { x: column * TRAIL_COLUMN_WIDTH, y: row * TRAIL_ROW_HEIGHT };
}

/** The cell nearest to `position`, clamped into the trail's columns and below its top. */
export function nearestCell({ x, y }: TrailPosition): TrailCell {
  const column = Math.min(TRAIL_COLUMNS - 1, Math.max(0, Math.round(x / TRAIL_COLUMN_WIDTH)));
  const row = Math.max(0, Math.round(y / TRAIL_ROW_HEIGHT));
  return { column, row };
}

export function snapToTrail(position: TrailPosition): TrailPosition {
  return cellPosition(nearestCell(position));
}

/** Whether `position` is exactly a cell of the trail grid. */
export function isOnTrailGrid(position: TrailPosition): boolean {
  const snapped = snapToTrail(position);
  return snapped.x === position.x && snapped.y === position.y;
}
