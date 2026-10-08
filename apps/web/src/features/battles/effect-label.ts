import type { ActiveEffect, ModifiableStat } from '@rpg-chains/shared-types';

const STAT: Record<ModifiableStat, string> = {
  strength: 'força',
  dexterity: 'destreza',
  intelligence: 'inteligência',
  damage: 'dano',
  defense: 'defesa',
};

/** Short Portuguese label of an active effect, with what is left of it. */
export function effectLabel(effect: ActiveEffect): { text: string; harmful: boolean } {
  switch (effect.kind) {
    case 'stat_modifier': {
      const sign = effect.polarity === 'buff' ? '+' : '−';
      const unit = effect.channel === 'percent' ? '%' : '';
      return {
        text: `${sign}${effect.value}${unit} ${STAT[effect.stat]} (${effect.rounds}r)`,
        harmful: effect.polarity === 'debuff',
      };
    }
    case 'damage_over_time':
      return { text: `sangrando ${effect.perRound}/r (${effect.rounds}r)`, harmful: true };
    case 'heal_over_time':
      return { text: `regenerando ${effect.perRound}/r (${effect.rounds}r)`, harmful: false };
    case 'shield':
      return { text: `escudo ${effect.remaining} (${effect.rounds}r)`, harmful: false };
    case 'provoke':
      return { text: 'provocando', harmful: false };
    case 'stun':
      return { text: 'atordoado', harmful: true };
    case 'max_hp_reduction':
      return { text: `vida máx. −${effect.amount} (${effect.rounds}r)`, harmful: true };
  }
}
