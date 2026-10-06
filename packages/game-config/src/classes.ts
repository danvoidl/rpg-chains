import { DEFAULT_SKILL_UNLOCK_LEVELS } from './progression.js';

/** Recommended class balancing bands (spec §4.3). Enforced with confirmation in the editor. */
export const CLASS_BASE_RANGES = {
  baseHp: { min: 80, max: 120 },
  baseEnergy: { min: 40, max: 70 },
  hpPerLevel: { min: 5, max: 12 },
  energyPerLevel: { min: 3, max: 8 },
} as const;

/** A default-kit class template. Skills are assembled in Phase 1b (spec §9, open item). */
export interface DefaultClassTemplate {
  name: string;
  baseHp: number;
  baseEnergy: number;
  hpPerLevel: number;
  energyPerLevel: number;
  skillUnlockLevels: readonly number[];
}

/**
 * Reference default kit (spec §4.3). Imported by COPY into a campaign (spec §5.1) —
 * the author receives four new, independent, editable classes, never a shared reference.
 */
export const DEFAULT_CLASS_KIT: readonly DefaultClassTemplate[] = [
  {
    name: 'Guardian',
    baseHp: 120,
    baseEnergy: 40,
    hpPerLevel: 12,
    energyPerLevel: 3,
    skillUnlockLevels: DEFAULT_SKILL_UNLOCK_LEVELS,
  },
  {
    name: 'Penitent',
    baseHp: 90,
    baseEnergy: 50,
    hpPerLevel: 7,
    energyPerLevel: 5,
    skillUnlockLevels: DEFAULT_SKILL_UNLOCK_LEVELS,
  },
  {
    name: 'Herald',
    baseHp: 85,
    baseEnergy: 65,
    hpPerLevel: 6,
    energyPerLevel: 7,
    skillUnlockLevels: DEFAULT_SKILL_UNLOCK_LEVELS,
  },
  {
    name: 'Priest',
    baseHp: 80,
    baseEnergy: 70,
    hpPerLevel: 5,
    energyPerLevel: 8,
    skillUnlockLevels: DEFAULT_SKILL_UNLOCK_LEVELS,
  },
] as const;
