import { ATTRIBUTE_POINTS_PER_LEVEL, MAX_LEVEL, xpForNextLevel } from '@rpg-chains/game-config';
import type { CharacterClass, InvestedAttributes, Rejection } from '@rpg-chains/shared-types';
import { deriveStats } from './derive-stats.js';
import type { CombatResources } from './restore.js';

type ClassGains = Pick<CharacterClass, 'baseHp' | 'baseEnergy' | 'hpPerLevel' | 'energyPerLevel'>;

/** The durable progression of a profile (spec §4.4): what XP, levels and points change. */
export interface Progress extends CombatResources {
  level: number;
  xp: number;
  availablePoints: number;
  attributes: InvestedAttributes;
}

/**
 * Adds XP and levels up as many times as it reaches (spec §4.4: `xpForNextLevel(level)` to leave
 * a level, `ATTRIBUTE_POINTS_PER_LEVEL` points per level). A late joiner may gain several levels
 * at once (spec §4.5); at `MAX_LEVEL` the XP stops accumulating.
 */
export function gainXp(
  level: number,
  xp: number,
  amount: number,
): { level: number; xp: number; pointsGained: number } {
  let next = { level, xp: xp + amount, pointsGained: 0 };
  while (next.level < MAX_LEVEL && next.xp >= xpForNextLevel(next.level)) {
    next = {
      level: next.level + 1,
      xp: next.xp - xpForNextLevel(next.level),
      pointsGained: next.pointsGained + ATTRIBUTE_POINTS_PER_LEVEL,
    };
  }
  return next.level >= MAX_LEVEL ? { ...next, xp: 0 } : next;
}

/**
 * Current HP and energy after the ceilings rose from `before` to `after` (Fase 4 plan decision
 * 6): they go up by the same amount the maximums did — no full heal, no lost gain. A downed
 * character stays at 0 HP.
 */
function raiseResources(
  cls: ClassGains,
  before: Progress,
  after: Pick<Progress, 'level' | 'attributes'>,
): Pick<CombatResources, 'currentHp' | 'currentEnergy'> {
  const old = deriveStats(cls, before.level, before.attributes);
  const next = deriveStats(cls, after.level, after.attributes);
  return {
    currentHp: before.downed
      ? before.currentHp
      : before.currentHp + Math.max(0, next.maxHp - old.maxHp),
    currentEnergy: before.currentEnergy + Math.max(0, next.maxEnergy - old.maxEnergy),
  };
}

/** A profile after gaining `amount` XP: levels, points and the raised resources (spec §4.4). */
export function applyXp(cls: ClassGains, progress: Progress, amount: number): Progress {
  const { level, xp, pointsGained } = gainXp(progress.level, progress.xp, amount);
  return {
    ...progress,
    level,
    xp,
    availablePoints: progress.availablePoints + pointsGained,
    ...raiseResources(cls, progress, { level, attributes: progress.attributes }),
  };
}

/**
 * Invests available points (Fase 4 plan decision 7): free, permanent, any split among the three
 * attributes. Rejected if the split is not whole non-negative points, spends nothing, or spends
 * more than the profile has.
 */
export function spendPoints(
  cls: ClassGains,
  progress: Progress,
  spend: InvestedAttributes,
): Progress | Rejection {
  const amounts = [spend.strength, spend.dexterity, spend.intelligence];
  if (amounts.some((n) => !Number.isInteger(n) || n < 0) || amounts.every((n) => n === 0)) {
    return { ok: false, reason: 'invalid_points' };
  }
  const total = amounts.reduce((sum, n) => sum + n, 0);
  if (total > progress.availablePoints) return { ok: false, reason: 'not_enough_points' };

  const attributes = {
    strength: progress.attributes.strength + spend.strength,
    dexterity: progress.attributes.dexterity + spend.dexterity,
    intelligence: progress.attributes.intelligence + spend.intelligence,
  };
  return {
    ...progress,
    availablePoints: progress.availablePoints - total,
    attributes,
    ...raiseResources(cls, progress, { level: progress.level, attributes }),
  };
}
