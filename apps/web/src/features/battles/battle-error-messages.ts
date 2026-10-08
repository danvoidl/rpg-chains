import { ApiError } from '@/lib/api';

const messages: Record<string, string> = {
  // Forming and starting (REST).
  node_busy: 'Já existe uma batalha neste nó.',
  already_in_battle: 'Você já está em outra batalha.',
  profile_downed: 'Seu personagem está caído. Acenda uma fogueira antes de lutar.',
  participant_downed: 'Um participante está caído. Acendam uma fogueira antes de lutar.',
  participant_limit: 'A formação está cheia.',
  node_without_questions: 'Este nó não tem perguntas.',
  open_questions_unsupported: 'Batalhas com pergunta aberta ainda não estão disponíveis.',
  battle_not_forming: 'Esta batalha já começou.',
  battle_starting: 'A batalha está começando.',
  battle_not_found: 'Batalha não encontrada.',
  battle_ended: 'A batalha já terminou.',
  battle_in_progress: 'Não é possível com uma batalha em andamento.',
  roster_changed: 'A formação mudou. Tente de novo.',
  not_a_player: 'Escolha uma classe para lutar.',
  not_a_participant: 'Você não está nesta batalha.',
  not_allowed: 'Você não pode fazer isso.',
  not_master: 'Apenas o mestre pode fazer isso.',
  // The trail (Fase 5).
  node_locked: 'Este nó ainda está bloqueado.',
  node_cleared: 'Este nó já foi concluído.',
  node_not_found: 'Nó não encontrado nesta versão da campanha.',
  in_battle: 'Você está numa batalha.',
  room_closed: 'A sala foi encerrada.',
  // In-battle commands (socket acks).
  stale_turn_token: 'Tarde demais: o turno já mudou.',
  signal_not_open: 'Outro jogador tocou o sinal primeiro.',
  blocked_this_round: 'Você agiu na rodada passada; espere a próxima.',
  player_downed: 'Seu personagem está caído.',
  player_left: 'Você saiu desta batalha.',
  not_your_turn: 'Não é a sua vez.',
  not_answering: 'Não é você quem está respondendo.',
  not_acting: 'Não é você quem escolhe a ação.',
  invalid_option: 'Opção inválida.',
  not_implemented: 'Isso ainda não está disponível.',
  invalid_target: 'Alvo inválido.',
  disconnected: 'Sem conexão com o servidor.',
  // Skills and items (M6).
  unknown_skill: 'Habilidade indisponível.',
  skill_on_cooldown: 'A habilidade ainda está em recarga.',
  not_enough_energy: 'Energia insuficiente.',
  no_such_item: 'Você não tem esse item.',
  // The master and open questions (M7).
  master_cannot_fight: 'O mestre julga as perguntas abertas e não luta nesta batalha.',
  master_offline: 'O mestre precisa estar na sala para começar esta batalha.',
  no_question_requested: 'Não é hora de escolher pergunta.',
  nothing_to_judge: 'Não há resposta para julgar.',
  unknown_question: 'Pergunta desconhecida.',
  no_objective_questions: 'Este nó não tem perguntas objetivas.',
  wrong_answer_type: 'Tipo de resposta errado para esta pergunta.',
};

/** A Portuguese message for a battle refusal code, if one is known. */
export function battleReasonMessage(reason: string): string {
  return messages[reason] ?? `Ação recusada (${reason}).`;
}

/** Maps a failed battle request to a Portuguese message. */
export function battleErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && typeof error.body === 'object' && error.body !== null) {
    const code = (error.body as { error?: unknown }).error;
    if (typeof code === 'string' && messages[code]) return messages[code];
  }
  return fallback;
}
