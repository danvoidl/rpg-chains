/** The error Better Auth's client returns (`result.error`). */
export interface AuthClientError {
  code?: string;
  status?: number;
  message?: string;
}

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'E-mail ou senha incorretos.',
  EMAIL_NOT_VERIFIED:
    'Confirme seu e-mail antes de entrar. Enviamos um novo link para a sua caixa de entrada.',
  USER_ALREADY_EXISTS: 'Já existe uma conta com este e-mail.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Já existe uma conta com este e-mail.',
  PASSWORD_TOO_SHORT: 'A senha é curta demais.',
  PASSWORD_TOO_LONG: 'A senha é longa demais.',
  INVALID_TOKEN: 'O link expirou ou já foi usado. Peça um novo.',
  INVALID_PASSWORD: 'Senha incorreta.',
  INVALID_CODE: 'Código incorreto.',
  INVALID_BACKUP_CODE: 'Código de recuperação incorreto ou já usado.',
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: 'Muitas tentativas. Entre de novo com a sua senha.',
  ACCOUNT_TEMPORARILY_LOCKED: 'Muitas tentativas erradas. Aguarde alguns minutos.',
  INVALID_TWO_FACTOR_COOKIE: 'A verificação expirou. Entre de novo com a sua senha.',
  VERIFICATION_FAILED: 'A verificação anti-robô falhou. Tente de novo.',
  MISSING_RESPONSE: 'Aguarde a verificação anti-robô terminar.',
};

/** Portuguese message for a Better Auth error, or `fallback`. */
export function authErrorMessage(error: AuthClientError, fallback: string): string {
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code]!;
  if (error.status === 429) return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
  return fallback;
}
