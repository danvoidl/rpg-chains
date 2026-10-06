import type { CompatibilityViolation } from '@rpg-chains/campaign-rules';

const DELETED_MESSAGES: Record<CompatibilityViolation['entityType'], string> = {
  class: 'Classe publicada não pode ser excluída.',
  skill: 'Habilidade publicada não pode ser excluída.',
  question: 'Pergunta publicada não pode ser excluída.',
  item: 'Item publicado não pode ser excluído.',
  villain: 'Vilão publicado não pode ser excluído.',
  node: 'Nó publicado não pode ser excluído.',
};

/** Portuguese message for a compatibility violation, derived from its rule (and entity type). */
export function violationMessage(v: CompatibilityViolation): string {
  switch (v.rule) {
    case 'entity_deleted':
      return DELETED_MESSAGES[v.entityType];
    case 'class_base_changed':
      return 'Atributos-base da classe não podem mudar.';
    case 'class_slots_reduced':
      return 'Vagas da classe não podem diminuir.';
    case 'skill_removed':
      return 'Habilidade não pode ser removida da classe.';
    case 'graph_entry_changed':
      return 'O nó de entrada do capítulo não pode mudar.';
    case 'graph_boss_changed':
      return 'O nó de chefe do capítulo não pode mudar.';
    case 'graph_reachability_broken':
      return 'Nó publicado deixou de ser alcançável.';
  }
}
