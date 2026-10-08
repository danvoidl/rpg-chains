import { describe, expect, it } from 'vitest';
import type { BattleContent, BattleEvent, InvestedAttributes } from '@rpg-chains/shared-types';
import { buildBattleContent } from './battle-content.js';
import type { RosterEntry } from './create-battle.js';
import { deriveStats } from './derive-stats.js';
import { actWith, startWith, withVillains } from './fixtures/battle-setup.js';
import { kitSnapshot } from './fixtures/load.js';

/**
 * The example numbers of docs/phase-1b-kit-draft.md, as assertions (Fase 3 plan M6), against a
 * villain without defense so the skill's own number shows.
 */

function content(): BattleContent {
  const built = buildBattleContent(kitSnapshot(), 'n-kit-battle');
  if ('ok' in built) throw new Error(built.reason);
  withVillains(
    built,
    [
      {
        id: 'v-target',
        name: 'Target',
        hp: 500,
        attributes: { strength: 0, dexterity: 0, intelligence: 0, defense: 0 },
        attacks: [
          { id: 'a-tap', name: 'Tap', baseDamage: 1, targetType: 'single', cooldownRounds: 0 },
        ],
      },
    ],
    ['v-target'],
  );
  return built;
}

const NO_POINTS = { strength: 0, dexterity: 0, intelligence: 0 };

function hero(key: string, level: number, attributes: InvestedAttributes = NO_POINTS): RosterEntry {
  const cls = kitSnapshot().classes.find((c) => c.id === `cl-${key}`)!;
  const { maxHp, maxEnergy } = deriveStats(cls, level, attributes);
  return {
    profileId: 'p1',
    userId: 'u1',
    name: cls.name,
    classId: cls.id,
    level,
    attributes,
    currentHp: maxHp,
    currentEnergy: maxEnergy,
    downed: false,
    equipment: {},
    inventory: [],
  };
}

const hitOnTarget = (events: BattleEvent[]) =>
  events.find((e) => e.type === 'DamageDealt' && e.targetId === 'enemy-1');

describe('kit examples (phase-1b kit draft)', () => {
  it('Golpe Expiatório at level 1: 160% of the 12 blade → 19', () => {
    const c = content();
    const { state } = startWith(c, [hero('penitent', 1)], 'group');
    const { events } = actWith(state, c, 'p1', {
      type: 'skill',
      skillId: 'sk-penitent-1',
      targetId: 'enemy-1',
    });
    expect(hitOnTarget(events)).toMatchObject({ hpDamage: 19 });
  });

  it('Juízo Final with 20 dexterity: 25 + 20 × 2.5 = 75, and 97 under Fervor (+30%)', () => {
    const c = content();
    const penitent = hero('penitent', 13, { strength: 0, dexterity: 20, intelligence: 0 });
    const { state } = startWith(c, [penitent], 'group');
    const judgement = { type: 'skill', skillId: 'sk-penitent-4', targetId: 'enemy-1' } as const;

    expect(hitOnTarget(actWith(state, c, 'p1', judgement).events)).toMatchObject({ hpDamage: 75 });

    const fervent = actWith(state, c, 'p1', { type: 'skill', skillId: 'sk-penitent-3' }).state;
    expect(hitOnTarget(actWith(fervent, c, 'p1', judgement).events)).toMatchObject({
      hpDamage: 97,
    });
  });

  it('Muralha: a shield of 25% of the Guardian max HP, for 2 rounds', () => {
    const c = content();
    const guardian = hero('guardian', 4);
    const { state } = startWith(c, [guardian], 'group');
    const { maxHp } = deriveStats(
      kitSnapshot().classes.find((x) => x.id === 'cl-guardian')!,
      4,
      NO_POINTS,
    );
    const { events } = actWith(state, c, 'p1', { type: 'skill', skillId: 'sk-guardian-2' });
    const applied = events.find((e) => e.type === 'EffectApplied');
    // 120 base HP + 3 levels × 12 = 156 → 39; at level 1's 120 it is the kit's 30.
    expect(maxHp).toBe(156);
    expect(applied).toMatchObject({
      targetId: 'p1',
      effect: { kind: 'shield', remaining: 39, rounds: 2 },
    });
  });
});
