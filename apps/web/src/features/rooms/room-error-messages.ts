import { ApiError } from '@/lib/api';

const messages: Record<string, string> = {
  campaign_not_published: 'Essa campanha ainda não foi publicada.',
  invalid_access_code: 'Código inválido.',
  room_not_found: 'Sala não encontrada.',
  class_full: 'Essa classe lotou. Escolha outra.',
  already_member: 'Você já tem um personagem nesta sala.',
  room_closed: 'Esta sala foi encerrada.',
  unknown_class: 'Classe desconhecida.',
  master_must_transfer: 'Transfira o mestre para outro jogador antes de abandonar a sala.',
  not_master: 'Apenas o mestre pode fazer isso.',
  room_is_public: 'Salas públicas não têm código de acesso.',
  invalid_new_master: 'O novo mestre precisa ter escolhido uma classe.',
  battle_needs_master: 'Há uma batalha com pergunta aberta: o mestre não pode ser trocado agora.',
  in_battle: 'Você está numa batalha. Saia dela antes de abandonar a sala.',
  battle_in_progress: 'Não é possível com uma batalha em andamento.',
  not_enough_points: 'Você não tem tantos pontos para distribuir.',
  invalid_points: 'Distribua pelo menos um ponto, em números inteiros.',
  not_a_player: 'Você não tem personagem nesta sala.',
  requirements_not_met: 'Seus atributos não alcançam os requisitos do item.',
  weapon_required: 'A arma só pode ser trocada, nunca removida.',
  slot_empty: 'Não há nada nesse espaço.',
  not_in_inventory: 'Esse item não está no seu inventário.',
  not_consumable: 'Esse item não é consumível.',
  invalid_target: 'Escolha quem reerguer.',
  target_in_battle: 'Esse jogador está numa batalha.',
  target_downed: 'Você está caído: só reerguer funciona agora.',
  target_not_downed: 'Esse jogador não está caído.',
  nothing_to_restore: 'Já está cheio: o item seria desperdiçado.',
  battle_only: 'Esse item só funciona em batalha.',
  insufficient_gold: 'Ouro insuficiente.',
  not_sold_here: 'Essa loja não vende esse item.',
  shop_not_found: 'Loja não encontrada.',
};

/** Maps a failed request to a Portuguese message, falling back to the given text. */
export function roomErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && typeof error.body === 'object' && error.body !== null) {
    const code = (error.body as { error?: unknown }).error;
    if (typeof code === 'string' && messages[code]) return messages[code];
  }
  return fallback;
}
