import { DEFAULT_SKILL_UNLOCK_LEVELS } from './progression.js';

/** Recommended class balancing bands (spec §4.3). Enforced with confirmation in the editor. */
export const CLASS_BASE_RANGES = {
  baseHp: { min: 80, max: 120 },
  baseEnergy: { min: 40, max: 70 },
  hpPerLevel: { min: 5, max: 12 },
  energyPerLevel: { min: 3, max: 8 },
} as const;

/** Base weapon of a default-kit class; same shape as an equipment item in the weapon slot. */
export interface DefaultWeaponTemplate {
  name: string;
  weaponType: 'light' | 'heavy';
  baseDamage: number;
  scalingAttribute: 'strength' | 'dexterity' | 'intelligence';
  scale: number;
}

/**
 * A default-kit skill. `effect` is a plain literal because `game-config` cannot import the effect
 * schema (`shared-types` depends on this package); `campaign-rules` parses every kit entry in a
 * test, and the import route parses it again before writing.
 */
export interface DefaultSkillTemplate {
  name: string;
  text: string;
  energyCost: number;
  cooldownRounds: number;
  unlockLevel: number;
  effect: Readonly<Record<string, unknown>>;
}

/** A default-kit class template (spec §4.3, §9; numbers in docs/phase-1b-kit-draft.md). */
export interface DefaultClassTemplate {
  /** Stable code key; `name` is the display text copied into the campaign. */
  key: string;
  name: string;
  description: string;
  baseHp: number;
  baseEnergy: number;
  hpPerLevel: number;
  energyPerLevel: number;
  maxSlots: number;
  baseWeapon: DefaultWeaponTemplate;
  skills: readonly DefaultSkillTemplate[];
}

const [UNLOCK_1, UNLOCK_2, UNLOCK_3, UNLOCK_4] = DEFAULT_SKILL_UNLOCK_LEVELS;

/**
 * Reference default kit (spec §4.3). Imported by COPY into a campaign (spec §5.1) —
 * the author receives four new, independent, editable classes, never a shared reference.
 */
export const DEFAULT_CLASS_KIT: readonly DefaultClassTemplate[] = [
  {
    key: 'guardian',
    name: 'Guardião',
    description: 'Tanque: troca a ação do grupo por segurar os ataques inimigos.',
    baseHp: 120,
    baseEnergy: 40,
    hpPerLevel: 12,
    energyPerLevel: 3,
    maxSlots: 2,
    baseWeapon: {
      name: 'Maça de Ferro',
      weaponType: 'heavy',
      baseDamage: 10,
      scalingAttribute: 'strength',
      scale: 1.5,
    },
    skills: [
      {
        name: 'Corrente de Ferro',
        text: 'Atrai o próximo ataque inimigo para si.',
        energyCost: 15,
        cooldownRounds: 3,
        unlockLevel: UNLOCK_1,
        effect: { type: 'provoke', duration: 1 },
      },
      {
        name: 'Muralha',
        text: 'Ergue um escudo de 25% da vida máxima.',
        energyCost: 20,
        cooldownRounds: 4,
        unlockLevel: UNLOCK_2,
        effect: {
          type: 'shield',
          target: 'self',
          magnitude: { mode: 'percent', percent: 25 },
          duration: 2,
        },
      },
      {
        name: 'Brado Intimidador',
        text: 'Reduz em 20% o dano de todos os inimigos.',
        energyCost: 25,
        cooldownRounds: 4,
        unlockLevel: UNLOCK_3,
        effect: {
          type: 'debuff_attribute',
          target: 'all_enemies',
          attribute: 'damage',
          magnitude: { mode: 'percent', percent: 20 },
          duration: 2,
        },
      },
      {
        name: 'Bastião',
        text: 'Concede +20 de defesa a todos os aliados.',
        energyCost: 35,
        cooldownRounds: 5,
        unlockLevel: UNLOCK_4,
        effect: {
          type: 'buff_attribute',
          target: 'all_allies',
          attribute: 'defense',
          magnitude: { mode: 'fixed', value: 20 },
          duration: 3,
        },
      },
    ],
  },
  {
    key: 'penitent',
    name: 'Penitente',
    description: 'Dano físico: golpes pesados e sangramento.',
    baseHp: 90,
    baseEnergy: 50,
    hpPerLevel: 7,
    energyPerLevel: 5,
    maxSlots: 4,
    baseWeapon: {
      name: 'Lâmina Penitente',
      weaponType: 'light',
      baseDamage: 12,
      scalingAttribute: 'dexterity',
      scale: 2,
    },
    skills: [
      {
        name: 'Golpe Expiatório',
        text: 'Golpe de 160% do ataque básico.',
        energyCost: 15,
        cooldownRounds: 2,
        unlockLevel: UNLOCK_1,
        effect: { type: 'damage', target: 'enemy', magnitude: { mode: 'percent', percent: 160 } },
      },
      {
        name: 'Sangria',
        text: 'Causa 8 de dano por rodada durante 3 rodadas.',
        energyCost: 20,
        cooldownRounds: 3,
        unlockLevel: UNLOCK_2,
        effect: {
          type: 'damage_over_time',
          target: 'enemy',
          magnitudePerRound: { mode: 'fixed', value: 8 },
          duration: 3,
        },
      },
      {
        name: 'Fervor',
        text: 'Aumenta o próprio dano em 30%.',
        energyCost: 25,
        cooldownRounds: 4,
        unlockLevel: UNLOCK_3,
        effect: {
          type: 'buff_attribute',
          target: 'self',
          attribute: 'damage',
          magnitude: { mode: 'percent', percent: 30 },
          duration: 3,
        },
      },
      {
        name: 'Juízo Final',
        text: 'Golpe devastador que cresce com a destreza.',
        energyCost: 40,
        cooldownRounds: 5,
        unlockLevel: UNLOCK_4,
        effect: {
          type: 'damage',
          target: 'enemy',
          magnitude: { mode: 'scaling', base: 25, attribute: 'dexterity', scale: 2.5 },
        },
      },
    ],
  },
  {
    key: 'herald',
    name: 'Arauto',
    description: 'Dano mágico e controle: fogo, trovão e silêncio.',
    baseHp: 85,
    baseEnergy: 65,
    hpPerLevel: 6,
    energyPerLevel: 7,
    maxSlots: 2,
    baseWeapon: {
      name: 'Cetro do Arauto',
      weaponType: 'light',
      baseDamage: 8,
      scalingAttribute: 'intelligence',
      scale: 1.5,
    },
    skills: [
      {
        name: 'Chama Anunciada',
        text: 'Chama que cresce com a inteligência.',
        energyCost: 15,
        cooldownRounds: 2,
        unlockLevel: UNLOCK_1,
        effect: {
          type: 'damage',
          target: 'enemy',
          magnitude: { mode: 'scaling', base: 14, attribute: 'intelligence', scale: 2 },
        },
      },
      {
        name: 'Trovão do Arauto',
        text: 'Atinge todos os inimigos.',
        energyCost: 25,
        cooldownRounds: 3,
        unlockLevel: UNLOCK_2,
        effect: {
          type: 'damage',
          target: 'all_enemies',
          magnitude: { mode: 'scaling', base: 8, attribute: 'intelligence', scale: 1 },
        },
      },
      {
        name: 'Proclamação',
        text: 'Aumenta em 15% o dano de todos os aliados.',
        energyCost: 30,
        cooldownRounds: 4,
        unlockLevel: UNLOCK_3,
        effect: {
          type: 'buff_attribute',
          target: 'all_allies',
          attribute: 'damage',
          magnitude: { mode: 'percent', percent: 15 },
          duration: 3,
        },
      },
      {
        name: 'Silêncio Imposto',
        text: 'O inimigo perde o próximo turno.',
        energyCost: 35,
        cooldownRounds: 5,
        unlockLevel: UNLOCK_4,
        effect: { type: 'stun', target: 'enemy', duration: 1 },
      },
    ],
  },
  {
    key: 'priest',
    name: 'Sacerdote',
    description: 'Cura e reerguer: mantém o grupo de pé.',
    baseHp: 80,
    baseEnergy: 70,
    hpPerLevel: 5,
    energyPerLevel: 8,
    maxSlots: 2,
    baseWeapon: {
      name: 'Cajado Consagrado',
      weaponType: 'light',
      baseDamage: 7,
      scalingAttribute: 'intelligence',
      scale: 1,
    },
    skills: [
      {
        name: 'Prece',
        text: 'Cura um aliado; cresce com a inteligência.',
        energyCost: 15,
        cooldownRounds: 2,
        unlockLevel: UNLOCK_1,
        effect: {
          type: 'heal',
          target: 'ally',
          magnitude: { mode: 'scaling', base: 20, attribute: 'intelligence', scale: 2 },
        },
      },
      {
        name: 'Reerguer',
        text: 'Devolve um aliado caído com 40% da vida.',
        energyCost: 35,
        cooldownRounds: 5,
        unlockLevel: UNLOCK_2,
        effect: { type: 'revive', target: 'ally', healthPercent: 40 },
      },
      {
        name: 'Bênção Contínua',
        text: 'Cura 6% da vida de todos os aliados por rodada.',
        energyCost: 25,
        cooldownRounds: 4,
        unlockLevel: UNLOCK_3,
        effect: {
          type: 'heal_over_time',
          target: 'all_allies',
          magnitudePerRound: { mode: 'percent', percent: 6 },
          duration: 3,
        },
      },
      {
        name: 'Graça Plena',
        text: 'Cura 30% da vida de todos os aliados.',
        energyCost: 40,
        cooldownRounds: 5,
        unlockLevel: UNLOCK_4,
        effect: {
          type: 'heal',
          target: 'all_allies',
          magnitude: { mode: 'percent', percent: 30 },
        },
      },
    ],
  },
];
