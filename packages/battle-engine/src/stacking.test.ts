import { describe, expect, it } from 'vitest';
import type { ActiveEffect } from '@rpg-chains/shared-types';
import { upsertEffect, netAttributeModifier } from './stacking.js';

const buff = (attribute: 'damage', value: number, dur: number): ActiveEffect => ({
  type: 'buff_attribute',
  attribute,
  value,
  roundsRemaining: dur,
});
const debuff = (attribute: 'damage', value: number, dur: number): ActiveEffect => ({
  type: 'debuff_attribute',
  attribute,
  value,
  roundsRemaining: dur,
});

describe('upsertEffect (decision 7, spec §5.5)', () => {
  it('replaces same (type, attribute) instead of adding', () => {
    const after = upsertEffect([buff('damage', 20, 2)], buff('damage', 30, 3));
    expect(after).toHaveLength(1);
    expect(after[0]).toEqual(buff('damage', 30, 3));
  });

  it('keeps a buff and a debuff of the same attribute as separate entries', () => {
    const after = upsertEffect([buff('damage', 20, 2)], debuff('damage', 10, 2));
    expect(after).toHaveLength(2);
  });

  it('replaces a non-attribute effect by type', () => {
    const stun1: ActiveEffect = { type: 'stun', value: 0, roundsRemaining: 1 };
    const stun2: ActiveEffect = { type: 'stun', value: 0, roundsRemaining: 2 };
    const after = upsertEffect([stun1], stun2);
    expect(after).toEqual([stun2]);
  });
});

describe('netAttributeModifier (spec §5.5)', () => {
  it('nets buff against debuff by signed sum', () => {
    const effects = [buff('damage', 20, 2), debuff('damage', 10, 2)];
    expect(netAttributeModifier(effects, 'damage')).toBe(10);
  });

  it('ignores other attributes', () => {
    expect(netAttributeModifier([buff('damage', 20, 2)], 'defense')).toBe(0);
  });
});
