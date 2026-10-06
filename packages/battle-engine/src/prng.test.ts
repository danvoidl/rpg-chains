import { describe, expect, it } from 'vitest';
import type { PrngState } from '@rpg-chains/shared-types';
import { nextFloat, nextInt, pick } from './prng.js';

const seed: PrngState = { seed: 42, cursor: 0 };

describe('prng determinism (decision 3)', () => {
  it('is pure — same state yields same value without mutation', () => {
    const a = nextFloat(seed);
    const b = nextFloat(seed);
    expect(a.value).toBe(b.value);
    expect(seed.cursor).toBe(0);
  });

  it('advances the cursor and threads state', () => {
    const first = nextFloat(seed);
    expect(first.state.cursor).toBe(1);
    const second = nextFloat(first.state);
    expect(second.value).not.toBe(first.value);
  });

  it('reproduces a full sequence from the same seed (replay)', () => {
    const seq = (s: PrngState, n: number): number[] => {
      const out: number[] = [];
      let cur = s;
      for (let i = 0; i < n; i++) {
        const d = nextInt(cur, 0, 100);
        out.push(d.value);
        cur = d.state;
      }
      return out;
    };
    expect(seq(seed, 5)).toEqual(seq(seed, 5));
  });

  it('produces in-range values', () => {
    const { value } = nextInt(seed, 0, 6);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(6);
  });

  it('picks from a list deterministically', () => {
    const items = ['a', 'b', 'c'];
    expect(pick(seed, items).value).toBe(pick(seed, items).value);
  });
});
