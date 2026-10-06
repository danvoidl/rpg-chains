import type { Prisma } from '@prisma/client';
import type { ClassInput, DraftClass, SkillInput } from '@rpg-chains/shared-types';
import { toDraftClass } from '../mappers/character-class.js';

/** A class write referenced a skill id that is not one of the class's skills, or repeated one. */
export class InvalidSkillIdError extends Error {
  constructor(public readonly skillId: string) {
    super(`Invalid skill id for this class: ${skillId}`);
  }
}

const withSkills = {
  skills: { orderBy: [{ unlockLevel: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.CharacterClassInclude;

function classData(input: Omit<ClassInput, 'skills'>) {
  return {
    name: input.name,
    description: input.description ?? '',
    artUrl: input.artUrl ?? null,
    baseHp: input.baseHp,
    baseEnergy: input.baseEnergy,
    hpPerLevel: input.hpPerLevel,
    energyPerLevel: input.energyPerLevel,
    maxSlots: input.maxSlots,
    baseWeaponId: input.baseWeaponId ?? null,
  };
}

function skillData(input: SkillInput) {
  return {
    name: input.name,
    iconUrl: input.iconUrl ?? null,
    text: input.text ?? '',
    energyCost: input.energyCost,
    cooldownRounds: input.cooldownRounds,
    unlockLevel: input.unlockLevel,
    effect: input.effect as Prisma.InputJsonValue,
  };
}

/** Loads one class of a campaign with its skills, or null. */
export async function findClass(
  tx: Prisma.TransactionClient,
  campaignId: string,
  classId: string,
): Promise<DraftClass | null> {
  const row = await tx.characterClass.findFirst({
    where: { id: classId, campaignId },
    include: withSkills,
  });
  return row ? toDraftClass(row) : null;
}

/** Lists a campaign's classes with their skills. */
export async function listClasses(
  tx: Prisma.TransactionClient,
  campaignId: string,
): Promise<DraftClass[]> {
  const rows = await tx.characterClass.findMany({
    where: { campaignId },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    include: withSkills,
  });
  return rows.map(toDraftClass);
}

/** Creates a class and its skills; skill ids in the payload are ignored (all skills are new). */
export async function createClass(
  tx: Prisma.TransactionClient,
  campaignId: string,
  input: ClassInput,
): Promise<DraftClass> {
  const row = await tx.characterClass.create({
    data: {
      campaignId,
      ...classData(input),
      skills: { create: (input.skills ?? []).map(skillData) },
    },
    include: withSkills,
  });
  return toDraftClass(row);
}

/**
 * Replaces a class and its skill set, keeping skill ids stable (Fase 1b decision 1): a skill sent
 * with its id is updated in place, one without an id is created, one left out is deleted. The
 * compatibility gate compares versions by skill id, so recreating skills on every save would read
 * as "skill removed". Must run inside a transaction.
 */
export async function replaceClass(
  tx: Prisma.TransactionClient,
  classId: string,
  input: ClassInput,
): Promise<DraftClass> {
  const skills = input.skills ?? [];
  const current = await tx.skill.findMany({ where: { classId }, select: { id: true } });
  const currentIds = new Set(current.map((s) => s.id));
  const kept = new Set<string>();
  for (const { id } of skills) {
    if (id === undefined) continue;
    if (!currentIds.has(id) || kept.has(id)) throw new InvalidSkillIdError(id);
    kept.add(id);
  }

  await tx.skill.deleteMany({ where: { classId, id: { notIn: [...kept] } } });
  for (const skill of skills) {
    if (skill.id === undefined) {
      await tx.skill.create({ data: { classId, ...skillData(skill) } });
    } else {
      await tx.skill.update({ where: { id: skill.id }, data: skillData(skill) });
    }
  }
  const row = await tx.characterClass.update({
    where: { id: classId },
    data: classData(input),
    include: withSkills,
  });
  return toDraftClass(row);
}
