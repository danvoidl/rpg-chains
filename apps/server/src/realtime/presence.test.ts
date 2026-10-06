import { describe, expect, it } from 'vitest';
import { Presence } from './presence.js';

describe('Presence', () => {
  it('counts a user once across tabs and drops them with their last socket', () => {
    const presence = new Presence();
    presence.add('r1', 'u1', 's1');
    presence.add('r1', 'u1', 's2');
    presence.add('r1', 'u2', 's3');
    expect(presence.online('r1')).toEqual(['u1', 'u2']);

    presence.remove('r1', 'u1', 's1');
    expect(presence.online('r1')).toEqual(['u1', 'u2']);
    presence.remove('r1', 'u1', 's2');
    expect(presence.online('r1')).toEqual(['u2']);
  });

  it('keeps rooms apart and ignores unknown removals', () => {
    const presence = new Presence();
    presence.add('r1', 'u1', 's1');
    presence.remove('r2', 'u1', 's1');
    expect(presence.online('r1')).toEqual(['u1']);
    expect(presence.online('r2')).toEqual([]);
  });
});
