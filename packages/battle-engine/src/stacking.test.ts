import { describe, expect, it } from 'vitest';
import type { ActiveEffect, StatModifierEffect } from '@rpg-chains/shared-types';
import { applyModifiers, netModifiers, upsertEffect } from './stacking.js';

let nextId = 0;
const modifier = (
  polarity: 'buff' | 'debuff',
  channel: 'flat' | 'percent',
  value: number,
  stat: StatModifierEffect['stat'] = 'damage',
): ActiveEffect => ({
  id: `e${nextId++}`,
  sourceId: 'p1',
  appliedRound: 0,
  kind: 'stat_modifier',
  polarity,
  stat,
  channel,
  value,
  rounds: 2,
});
const stun = (turns: number): ActiveEffect => ({
  id: `e${nextId++}`,
  sourceId: 'p1',
  appliedRound: 0,
  kind: 'stun',
  turns,
});

describe('upsertEffect (spec §5.5)', () => {
  it('keeps every stat modifier, even identical ones', () => {
    const after = upsertEffect([modifier('buff', 'percent', 10)], modifier('buff', 'percent', 10));
    expect(after).toHaveLength(2);
  });

  it('replaces any other effect of the same kind, resetting its duration', () => {
    const second = stun(1);
    expect(upsertEffect([stun(1)], second)).toEqual([second]);
  });

  it('leaves effects of other kinds alone', () => {
    const buff = modifier('buff', 'flat', 5);
    expect(upsertEffect([buff], stun(1))).toHaveLength(2);
  });
});

describe('netModifiers (spec §5.5)', () => {
  it('sums each channel with sign: three +10% buffs net +30%', () => {
    const effects = [10, 10, 10].map((v) => modifier('buff', 'percent', v));
    expect(netModifiers(effects, 'damage')).toEqual({ flat: 0, percent: 30 });
  });

  it('nets a buff against a debuff: +20% and −10% leave +10%', () => {
    const effects = [modifier('buff', 'percent', 20), modifier('debuff', 'percent', 10)];
    expect(netModifiers(effects, 'damage')).toEqual({ flat: 0, percent: 10 });
  });

  it('keeps flat and percent apart and ignores other stats', () => {
    const effects = [
      modifier('buff', 'flat', 5),
      modifier('buff', 'percent', 20),
      modifier('buff', 'flat', 99, 'defense'),
      stun(1),
    ];
    expect(netModifiers(effects, 'damage')).toEqual({ flat: 5, percent: 20 });
  });
});

describe('applyModifiers (spec §5.3, §5.5)', () => {
  it('multiplies base + flat by the summed percents, not by each in turn', () => {
    // (50 + 10) × (1 + 0.20 + 0.10) = 78, not (60 × 1.2 × 1.1 = 79.2).
    expect(applyModifiers(50, { flat: 10, percent: 30 })).toBe(78);
  });

  it('floors and never goes below zero', () => {
    expect(applyModifiers(10, { flat: 0, percent: 15 })).toBe(11);
    expect(applyModifiers(10, { flat: -20, percent: 0 })).toBe(0);
  });
});
