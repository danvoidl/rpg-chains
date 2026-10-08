import { describe, expect, it } from 'vitest';
import type { Effect } from '@rpg-chains/shared-types';
import { useOutOfBattle, type Holder } from './out-of-battle.js';

// Max 100 HP and 50 energy at level 1 with no points.
const cls = { baseHp: 100, baseEnergy: 50, hpPerLevel: 8, energyPerLevel: 5 };
const hurt: Holder = {
  cls,
  level: 1,
  attributes: { strength: 0, dexterity: 0, intelligence: 2 },
  currentHp: 40,
  currentEnergy: 10,
  downed: false,
};
const fallen: Holder = { ...hurt, currentHp: 0, downed: true };

const heal = (value: number): Effect => ({
  type: 'heal',
  target: 'self',
  magnitude: { mode: 'fixed', value },
});

describe('useOutOfBattle (Fase 4 plan decision 13)', () => {
  it('heals up to the ceiling', () => {
    expect(useOutOfBattle(heal(30), hurt, hurt)).toMatchObject({ currentHp: 70 });
    expect(useOutOfBattle(heal(90), hurt, hurt)).toMatchObject({ currentHp: 100 });
  });

  it('restores energy, scaling with the user attributes', () => {
    // 5 + intelligence 2 × 3 = 11 (max 50 + 2 × 3 = 56).
    const tonic: Effect = {
      type: 'restore_energy',
      target: 'self',
      magnitude: { mode: 'scaling', base: 5, attribute: 'intelligence', scale: 3 },
    };
    expect(useOutOfBattle(tonic, hurt, hurt)).toMatchObject({ currentEnergy: 21 });
  });

  it('revives a downed character with a share of max HP', () => {
    const phoenix: Effect = { type: 'revive', target: 'ally', healthPercent: 25 };
    expect(useOutOfBattle(phoenix, hurt, fallen)).toEqual({
      currentHp: 25,
      currentEnergy: 10,
      downed: false,
    });
    expect(useOutOfBattle(phoenix, hurt, hurt)).toEqual({ ok: false, reason: 'target_not_downed' });
  });

  it('refuses what would change nothing and what only works in battle', () => {
    expect(useOutOfBattle(heal(30), hurt, fallen)).toEqual({ ok: false, reason: 'target_downed' });
    expect(useOutOfBattle(heal(30), hurt, { ...hurt, currentHp: 100 })).toEqual({
      ok: false,
      reason: 'nothing_to_restore',
    });
    const fire: Effect = {
      type: 'damage',
      target: 'enemy',
      magnitude: { mode: 'fixed', value: 9 },
    };
    expect(useOutOfBattle(fire, hurt, hurt)).toEqual({ ok: false, reason: 'battle_only' });
  });
});
