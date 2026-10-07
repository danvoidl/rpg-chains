import type { DraftWarning } from '@rpg-chains/campaign-rules';

const CLASS_FIELD_LABELS: Record<string, string> = {
  baseHp: 'Vida base',
  baseEnergy: 'Energia base',
  hpPerLevel: 'Vida por nível',
  energyPerLevel: 'Energia por nível',
};

/** Last field name of a path, e.g. `classes[0].skills[1].effect.magnitude.value` -> `value`. */
function lastField(path: string): string {
  return (
    path
      .split('.')
      .pop()
      ?.replace(/\[\d+\]$/, '') ?? ''
  );
}

/** Portuguese message for a balancing warning, with the value and its recommended band. */
export function warningMessage(warning: DraftWarning): string {
  const band = `${warning.band.min}–${warning.band.max}`;
  switch (warning.code) {
    case 'class_base_out_of_band':
      return `${CLASS_FIELD_LABELS[lastField(warning.path)] ?? 'Valor'} ${warning.value} fora da faixa recomendada (${band}).`;
    case 'skill_cost_out_of_band':
      return `Custo de energia ${warning.value} fora da faixa recomendada (${band}).`;
    case 'skill_cooldown_out_of_band':
      return `Recarga de ${warning.value} rodadas fora da faixa recomendada (${band}).`;
    case 'magnitude_out_of_band':
      return `Magnitude ${warning.value} fora da faixa recomendada (${band}).`;
    case 'duration_out_of_band':
      return `Duração de ${warning.value} rodadas fora da faixa recomendada (${band}).`;
    case 'total_slots_low':
      return `As classes somam ${warning.value} vagas; o recomendado é pelo menos ${warning.band.min} para caber um grupo inteiro.`;
    case 'battle_xp_out_of_band':
      return `Os vilões da batalha somam ${warning.value} de experiência, fora da faixa recomendada para o nível do nó (${band}).`;
    case 'battle_gold_out_of_band':
      return `Os vilões da batalha somam ${warning.value} de ouro, fora da faixa recomendada para o nível do nó (${band}).`;
    case 'drop_chance_high':
      return `Chance de drop de ${Math.round(warning.value * 100)}%, acima da faixa comum (${Math.round(warning.band.max * 100)}%): drops devem ser raros.`;
    case 'item_price_missing':
      return 'Item vendido numa loja sem preço.';
  }
}
