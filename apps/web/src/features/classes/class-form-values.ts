import type { z } from 'zod';
import type { ClassInputSchema, DraftClass, Effect } from '@rpg-chains/shared-types';

/** Class form state before the schema fills its defaults. */
export type ClassFormValues = z.input<typeof ClassInputSchema>;

/** Form values for a new class, or for editing an existing one (skill ids included). */
export function classFormValues(cls?: DraftClass): ClassFormValues {
  if (!cls) {
    return {
      name: '',
      description: '',
      artUrl: null,
      baseHp: 100,
      baseEnergy: 50,
      hpPerLevel: 8,
      energyPerLevel: 5,
      maxSlots: 2,
      baseWeaponId: null,
      skills: [],
    };
  }
  const { id: _id, ...rest } = cls;
  return rest;
}

/**
 * The form state as a `DraftClass`, so the editor can run the same rules as the publish gate
 * (`validateClass`, `classWarnings`) while the author types. New skills get placeholder ids.
 */
export function formToDraftClass(values: ClassFormValues, classId: string): DraftClass {
  return {
    id: classId,
    name: values.name ?? '',
    description: values.description ?? '',
    artUrl: values.artUrl ?? null,
    baseHp: values.baseHp,
    baseEnergy: values.baseEnergy,
    hpPerLevel: values.hpPerLevel,
    energyPerLevel: values.energyPerLevel,
    maxSlots: values.maxSlots,
    baseWeaponId: values.baseWeaponId ?? null,
    skills: (values.skills ?? []).map((skill, i) => ({
      id: skill.id ?? `new-skill-${i}`,
      name: skill.name ?? '',
      iconUrl: skill.iconUrl ?? null,
      text: skill.text ?? '',
      energyCost: skill.energyCost,
      cooldownRounds: skill.cooldownRounds,
      unlockLevel: skill.unlockLevel,
      effect: skill.effect as Effect,
    })),
  };
}
