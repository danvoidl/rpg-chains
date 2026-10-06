import type { PrngState } from '@rpg-chains/shared-types';

/**
 * Counter-based deterministic PRNG (decision 3). Values derive from (seed, cursor) in O(1)
 * via a splitmix32 hash, so the state is a small pair carried inside the folded battle
 * state and replay is exact. The engine never calls Math.random().
 */

function splitmix32(input: number): number {
  let t = (input + 0x9e3779b9) | 0;
  t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
  t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
  t = t ^ (t >>> 15);
  return (t >>> 0) / 4294967296;
}

/** A drawn value plus the advanced state — nothing is mutated. */
export interface Draw<T> {
  value: T;
  state: PrngState;
}

function mix(state: PrngState): number {
  return (state.seed ^ Math.imul(state.cursor + 1, 0x9e3779b9)) | 0;
}

function advance(state: PrngState): PrngState {
  return { seed: state.seed, cursor: state.cursor + 1 };
}

/** Uniform float in [0, 1). */
export function nextFloat(state: PrngState): Draw<number> {
  return { value: splitmix32(mix(state)), state: advance(state) };
}

/** Uniform integer in [min, max). */
export function nextInt(state: PrngState, min: number, max: number): Draw<number> {
  const { value, state: next } = nextFloat(state);
  return { value: min + Math.floor(value * (max - min)), state: next };
}

/** Uniformly pick one element; throws on an empty list. */
export function pick<T>(state: PrngState, items: readonly T[]): Draw<T> {
  if (items.length === 0) throw new Error('pick from empty list');
  const { value: index, state: next } = nextInt(state, 0, items.length);
  return { value: items[index]!, state: next };
}
