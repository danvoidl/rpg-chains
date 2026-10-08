import { magnitudeAmount } from '@rpg-chains/battle-engine';
import type { Attribute, Effect, Magnitude, Target } from '@rpg-chains/shared-types';
import { ATTRIBUTE_LABELS, STAT_LABELS } from './effect-labels';

/** What a magnitude reads from whoever uses the effect. */
export interface EffectUser {
  /** The attribute value scaling magnitudes multiply (with buffs, in battle). */
  attribute: (name: Attribute) => number;
  /** Basic-attack raw damage, what a damage percentage is a percentage of. */
  basicAttack: number;
}

/** Who an effect lands on, as the end of a sentence. */
const TARGET_TEXT: Record<Target, string> = {
  self: 'em você',
  ally: 'em um aliado',
  all_allies: 'em todos os aliados',
  enemy: 'em um inimigo',
  all_enemies: 'em todos os inimigos',
};

const rounds = (n: number) => (n === 1 ? '1 rodada' : `${n} rodadas`);

/**
 * "24 de dano (150% do ataque básico)", "18 de vida (10 + Inteligência × 2)", "30 de vida", or —
 * for a percentage of something only the target knows — "25% da vida máxima do alvo": what a
 * magnitude comes to for this user, with how it is made when it is not a plain value.
 */
function quantity(
  magnitude: Magnitude,
  user: EffectUser,
  unit: string,
  percentOf: string,
  base?: number,
): string {
  switch (magnitude.mode) {
    case 'fixed':
      return `${Math.floor(Math.max(0, magnitude.value))} ${unit}`;
    case 'percent':
      return base === undefined
        ? `${magnitude.percent}% ${percentOf}`
        : `${Math.floor(magnitudeAmount(magnitude, user.attribute, base))} ${unit} (${magnitude.percent}% ${percentOf})`;
    case 'scaling': {
      const value = Math.floor(magnitudeAmount(magnitude, user.attribute, 0));
      const attribute = ATTRIBUTE_LABELS[magnitude.attribute];
      const formula = magnitude.base
        ? `${magnitude.base} + ${attribute} × ${magnitude.scale}`
        : `${attribute} × ${magnitude.scale}`;
      return `${value} ${unit} (${formula})`;
    }
  }
}

/**
 * One sentence saying what an effect does when this user uses it (spec §5.4), with the numbers
 * worked out: what a skill or consumable will deal, heal or change. Percent bases follow the
 * engine's per-type table (`effects/resolve-effect.ts`).
 */
export function describeEffect(effect: Effect, user: EffectUser): string {
  switch (effect.type) {
    case 'damage':
      return `Causa ${quantity(effect.magnitude, user, 'de dano', 'do ataque básico', user.basicAttack)} ${TARGET_TEXT[effect.target]}, reduzido pela defesa.`;
    case 'damage_over_time':
      return `Causa ${quantity(effect.magnitudePerRound, user, 'de dano', 'da vida máxima do alvo')} por rodada ${TARGET_TEXT[effect.target]}, durante ${rounds(effect.duration)}.`;
    case 'heal':
      return `Cura ${quantity(effect.magnitude, user, 'de vida', 'da vida máxima do alvo')} ${TARGET_TEXT[effect.target]}.`;
    case 'heal_over_time':
      return `Cura ${quantity(effect.magnitudePerRound, user, 'de vida', 'da vida máxima do alvo')} por rodada ${TARGET_TEXT[effect.target]}, durante ${rounds(effect.duration)}.`;
    case 'revive':
      return `Reergue um aliado caído com ${Math.min(100, effect.healthPercent)}% da vida máxima.`;
    case 'restore_energy':
      return `Restaura ${quantity(effect.magnitude, user, 'de energia', 'da energia máxima do alvo')} ${TARGET_TEXT[effect.target]}.`;
    case 'provoke':
      return effect.duration === 1
        ? 'Atrai para você o próximo ataque inimigo.'
        : `Atrai para você os próximos ${effect.duration} ataques inimigos.`;
    case 'shield':
      return `Escudo de ${quantity(effect.magnitude, user, 'de vida', 'da vida máxima do alvo')} ${TARGET_TEXT[effect.target]}, por ${rounds(effect.duration)}: absorve dano antes da vida.`;
    case 'buff_attribute':
    case 'debuff_attribute': {
      const sign = effect.type === 'buff_attribute' ? '+' : '−';
      const value =
        effect.magnitude.mode === 'percent'
          ? `${effect.magnitude.percent}%`
          : quantity(effect.magnitude, user, `de ${STAT_LABELS[effect.attribute]}`, '');
      return `${sign}${value}${effect.magnitude.mode === 'percent' ? ` de ${STAT_LABELS[effect.attribute]}` : ''} ${TARGET_TEXT[effect.target]}, por ${rounds(effect.duration)}.`;
    }
    case 'max_hp_reduction':
      return `Reduz a vida máxima ${TARGET_TEXT[effect.target]} em ${quantity(effect.magnitude, user, 'pontos', 'da vida máxima')}, por ${rounds(effect.duration)}.`;
    case 'stun':
      return effect.duration === 1
        ? `Atordoa ${TARGET_TEXT[effect.target].replace(/^em /, '')}: perde o próximo turno.`
        : `Atordoa ${TARGET_TEXT[effect.target].replace(/^em /, '')}: perde os próximos ${effect.duration} turnos.`;
    case 'dispel': {
      const what = effect.removes === 'buffs' ? 'efeitos positivos' : 'efeitos negativos';
      return `Remove até ${effect.amount} ${what} ${TARGET_TEXT[effect.target]}.`;
    }
  }
}
