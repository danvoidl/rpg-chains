import { describe, expect, it } from 'vitest';
import type { NodeProgressView } from '@rpg-chains/shared-types';
import { cellBox, chapterHeight } from './trail-geometry';

const at = (x: number, y: number) => ({ position: { x, y } }) as NodeProgressView;

describe('chapterHeight', () => {
  it('holds the lowest node’s cell', () => {
    expect(chapterHeight({ nodes: [at(0, 0), at(80, 300)], background: null })).toBe(400);
  });

  it('is one row for an empty chapter', () => {
    expect(chapterHeight({ nodes: [], background: null })).toBe(100);
  });

  it('scales the background to the trail width, but never cuts a node off', () => {
    const background = { imageUrl: 'x', width: 800, height: 1200 };
    expect(chapterHeight({ nodes: [at(0, 0)], background })).toBe(600);
    expect(chapterHeight({ nodes: [at(0, 900)], background })).toBe(1000);
  });
});

describe('cellBox', () => {
  it('places the cell in percentages of the column and the chapter', () => {
    expect(cellBox({ x: 160, y: 100 }, 400)).toEqual({ left: 40, width: 20, top: 25, height: 25 });
  });
});
