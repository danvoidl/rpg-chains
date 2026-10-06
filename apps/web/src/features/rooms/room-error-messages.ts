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
};

/** Maps a failed request to a Portuguese message, falling back to the given text. */
export function roomErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && typeof error.body === 'object' && error.body !== null) {
    const code = (error.body as { error?: unknown }).error;
    if (typeof code === 'string' && messages[code]) return messages[code];
  }
  return fallback;
}
