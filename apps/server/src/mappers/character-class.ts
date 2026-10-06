import type { CharacterClass as ClassModel, Skill as SkillModel } from '@prisma/client';
import { EffectSchema, type DraftClass, type DraftSkill } from '@rpg-chains/shared-types';

/** Maps a database skill row to the client-facing DraftSkill representation. */
export function toDraftSkill(row: SkillModel): DraftSkill {
  return {
    id: row.id,
    name: row.name,
    iconUrl: row.iconUrl ?? null,
    text: row.text,
    energyCost: row.energyCost,
    cooldownRounds: row.cooldownRounds,
    unlockLevel: row.unlockLevel,
    effect: EffectSchema.parse(row.effect),
  };
}

/** Maps a class row with its skills to the client-facing DraftClass representation. */
export function toDraftClass(row: ClassModel & { skills: SkillModel[] }): DraftClass {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    artUrl: row.artUrl ?? null,
    baseHp: row.baseHp,
    baseEnergy: row.baseEnergy,
    hpPerLevel: row.hpPerLevel,
    energyPerLevel: row.energyPerLevel,
    maxSlots: row.maxSlots,
    baseWeaponId: row.baseWeaponId ?? null,
    skills: row.skills.map(toDraftSkill),
  };
}
