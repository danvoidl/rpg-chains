import type { CompatibilityRule } from '@rpg-chains/campaign-rules';

export const VIOLATION_LABELS: Record<CompatibilityRule, string> = {
  entity_deleted: 'Conteúdo publicado excluído',
  class_base_changed: 'Atributos-base de classe alterados',
  class_slots_reduced: 'Vagas de classe reduzidas',
  skill_removed: 'Habilidade removida de classe',
  graph_entry_changed: 'Nó de entrada alterado',
  graph_boss_changed: 'Nó de chefe alterado',
  graph_reachability_broken: 'Nó deixou de ser alcançável',
};
