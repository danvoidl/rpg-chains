import {
  TRAIL_COLUMNS,
  cellPosition,
  isOnTrailGrid,
  nearestCell,
  type TrailCell,
  type TrailPosition,
} from '@rpg-chains/shared-types';

/**
 * Where nodes go on the chapter's trail grid in the editor (Fase 5 plan decision 17): every node
 * sits in a cell of the 5-column grid, one node per cell. Pure, so the editor page only applies
 * what it returns.
 */

interface Placed {
  id: string;
  position: TrailPosition;
}

const cellKey = ({ column, row }: TrailCell) => `${column}:${row}`;

function takenCells(nodes: readonly Placed[], except?: string): Set<string> {
  return new Set(nodes.filter((n) => n.id !== except).map((n) => cellKey(nearestCell(n.position))));
}

/** A new node's cell: the middle column, one row below the lowest node. */
export function newNodePosition(nodes: readonly Placed[]): TrailPosition {
  const lowest = nodes.reduce((max, n) => Math.max(max, nearestCell(n.position).row), -1);
  return cellPosition({ column: Math.floor(TRAIL_COLUMNS / 2), row: lowest + 1 });
}

/** The cell a dragged node lands on, or null when another node already holds it. */
export function dropPosition(
  nodes: readonly Placed[],
  id: string,
  dropped: TrailPosition,
): TrailPosition | null {
  const cell = nearestCell(dropped);
  return takenCells(nodes, id).has(cellKey(cell)) ? null : cellPosition(cell);
}

/**
 * Moves every node that is off the grid to its nearest free cell — the author's explicit
 * "snap to grid" for chapters drawn before the trail. Nodes already on the grid stay put and keep
 * their cells; the others are placed in order, searching the same row and then the rows below.
 */
export function snapAllToGrid<T extends Placed>(nodes: readonly T[]): T[] {
  const taken = new Set(
    nodes.filter((n) => isOnTrailGrid(n.position)).map((n) => cellKey(nearestCell(n.position))),
  );
  return nodes.map((node) => {
    if (isOnTrailGrid(node.position)) return node;
    const start = nearestCell(node.position);
    for (let row = start.row; ; row++) {
      const columns = Array.from({ length: TRAIL_COLUMNS }, (_, c) => c).sort(
        (a, b) => Math.abs(a - start.column) - Math.abs(b - start.column),
      );
      const column = columns.find((c) => !taken.has(cellKey({ column: c, row })));
      if (column !== undefined) {
        taken.add(cellKey({ column, row }));
        return { ...node, position: cellPosition({ column, row }) };
      }
    }
  });
}
