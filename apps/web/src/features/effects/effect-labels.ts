import type {
  EffectType,
  MagnitudeMode,
  ModifiableStat,
  Slot,
  Target,
  Attribute,
} from '@rpg-chains/shared-types';

/** Portuguese display labels for the effect catalog (spec §5.4) and its parameters. */
export const EFFECT_TYPE_LABELS: Record<EffectType, string> = {
  damage: 'Dano',
  damage_over_time: 'Dano contínuo',
  heal: 'Cura',
  heal_over_time: 'Cura contínua',
  revive: 'Reerguer',
  restore_energy: 'Restaurar energia',
  provoke: 'Provocar',
  shield: 'Escudo',
  buff_attribute: 'Buff de atributo',
  debuff_attribute: 'Debuff de atributo',
  max_hp_reduction: 'Redução de vida máxima',
  stun: 'Atordoar',
  dispel: 'Dissipar',
};

export const TARGET_LABELS: Record<Target, string> = {
  self: 'O próprio personagem',
  ally: 'Um aliado',
  all_allies: 'Todos os aliados',
  enemy: 'Um inimigo',
  all_enemies: 'Todos os inimigos',
};

export const MAGNITUDE_MODE_LABELS: Record<MagnitudeMode, string> = {
  fixed: 'Valor fixo',
  percent: 'Percentual',
  scaling: 'Escala com atributo',
};

export const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  strength: 'Força',
  dexterity: 'Destreza',
  intelligence: 'Inteligência',
};

export const STAT_LABELS: Record<ModifiableStat, string> = {
  ...ATTRIBUTE_LABELS,
  damage: 'Dano',
  defense: 'Defesa',
};

export const SLOT_LABELS: Record<Slot, string> = {
  weapon: 'Arma',
  helmet: 'Capacete',
  chest: 'Peitoral',
  boots: 'Botas',
  bracers: 'Braceletes',
  rings: 'Anéis',
};
