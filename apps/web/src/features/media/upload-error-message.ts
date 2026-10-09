import { ApiError } from '@/lib/api';

export type UploadKind = 'image' | 'video';

const QUOTA_MESSAGES: Record<string, string> = {
  daily: 'Você atingiu o limite de envios das últimas 24 horas. Tente mais tarde.',
  user: 'Você atingiu seu limite de armazenamento de mídia.',
  total: 'O armazenamento de mídia da plataforma está cheio. Avise o administrador.',
};

/** What the editor shows when an upload fails: size, an upload quota (429), or a generic retry. */
export function uploadErrorMessage(error: unknown, kind: UploadKind): string {
  const noun = kind === 'video' ? 'O vídeo' : 'A imagem';
  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 413) return `${noun} passa do tamanho máximo.`;
    if (error.status === 429) {
      const quota = (error.body as { quota?: unknown } | undefined)?.quota;
      const message = typeof quota === 'string' ? QUOTA_MESSAGES[quota] : undefined;
      if (message) return message;
    }
  }
  return kind === 'video'
    ? 'Falha ao enviar vídeo. Tente novamente.'
    : 'Falha ao enviar imagem. Tente novamente.';
}
