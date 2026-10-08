import { describe, expect, it } from 'vitest';
import { hasSeenOpening, markOpeningSeen, openingSeenKey } from './opening-seen';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const broken = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('opening seen', () => {
  it('keys by room and chapter', () => {
    expect(openingSeenKey('r1', 'c1')).toBe('rpg-chains:opening-seen:r1:c1');
  });

  it('remembers a chapter per room', () => {
    const storage = memoryStorage();
    expect(hasSeenOpening(storage, 'r1', 'c1')).toBe(false);
    markOpeningSeen(storage, 'r1', 'c1');
    expect(hasSeenOpening(storage, 'r1', 'c1')).toBe(true);
    expect(hasSeenOpening(storage, 'r2', 'c1')).toBe(false);
    expect(hasSeenOpening(storage, 'r1', 'c2')).toBe(false);
  });

  it('never throws when storage is missing or blocked', () => {
    expect(hasSeenOpening(undefined, 'r1', 'c1')).toBe(false);
    expect(hasSeenOpening(broken, 'r1', 'c1')).toBe(false);
    expect(() => markOpeningSeen(broken, 'r1', 'c1')).not.toThrow();
    expect(() => markOpeningSeen(undefined, 'r1', 'c1')).not.toThrow();
  });
});
