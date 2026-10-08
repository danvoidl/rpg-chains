import { describe, expect, it } from 'vitest';
import { dropPosition, newNodePosition, snapAllToGrid } from './grid-placement';

const at = (id: string, x: number, y: number) => ({ id, position: { x, y } });

describe('newNodePosition', () => {
  it('starts at the top of the middle column, then goes one row below the lowest', () => {
    expect(newNodePosition([])).toEqual({ x: 160, y: 0 });
    expect(newNodePosition([at('a', 0, 0), at('b', 320, 300)])).toEqual({ x: 160, y: 400 });
  });
});

describe('dropPosition', () => {
  it('snaps to the nearest cell, inside the columns', () => {
    expect(dropPosition([at('a', 0, 0)], 'a', { x: 95, y: 140 })).toEqual({ x: 80, y: 100 });
    expect(dropPosition([at('a', 0, 0)], 'a', { x: 900, y: -40 })).toEqual({ x: 320, y: 0 });
  });

  it('refuses a cell another node holds, but not the node’s own', () => {
    const nodes = [at('a', 0, 0), at('b', 80, 0)];
    expect(dropPosition(nodes, 'a', { x: 85, y: 10 })).toBeNull();
    expect(dropPosition(nodes, 'a', { x: 5, y: 5 })).toEqual({ x: 0, y: 0 });
  });
});

describe('snapAllToGrid', () => {
  it('moves only off-grid nodes, each to the nearest free cell', () => {
    const nodes = [at('on', 160, 0), at('near', 150, 20), at('far', 1100, 200)];
    expect(snapAllToGrid(nodes)).toEqual([
      at('on', 160, 0),
      // Its nearest cell (2, 0) is taken: the next column over.
      at('near', 80, 0),
      at('far', 320, 200),
    ]);
  });

  it('goes down a row when the whole row is full', () => {
    const full = [0, 80, 160, 240, 320].map((x, i) => at(`r${i}`, x, 0));
    expect(snapAllToGrid([...full, at('extra', 10, 10)]).at(-1)).toEqual(at('extra', 0, 100));
  });
});
