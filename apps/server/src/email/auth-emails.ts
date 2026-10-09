import type { Email } from './transports.js';

/** Escapes text for the HTML body (the user's name is user input). */
function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function linkEmail(
  to: string,
  subject: string,
  greeting: string,
  lines: string[],
  action: string,
  url: string,
): Email {
  const text = [greeting, '', ...lines, '', `${action}: ${url}`].join('\n');
  const html = `<p>${escapeHtml(greeting)}</p>${lines
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')}<p><a href="${escapeHtml(url)}">${escapeHtml(action)}</a></p>`;
  return { to, subject, text, html };
}

/** Sent on sign-up, and again on a sign-in attempt while the email is unconfirmed. */
export function verificationEmail(user: { email: string; name: string }, url: string): Email {
  return linkEmail(
    user.email,
    'Confirme seu e-mail',
    `Olá, ${user.name}!`,
    [
      'Confirme seu e-mail para entrar na sua conta.',
      'Se você não criou esta conta, ignore este e-mail.',
    ],
    'Confirmar e-mail',
    url,
  );
}

/** Sent when someone asks to reset the password of this email's account. */
export function resetPasswordEmail(user: { email: string; name: string }, url: string): Email {
  return linkEmail(
    user.email,
    'Redefinir sua senha',
    `Olá, ${user.name}!`,
    [
      'Recebemos um pedido para redefinir a senha da sua conta. O link vale por 1 hora.',
      'Se não foi você, ignore este e-mail: sua senha continua a mesma.',
    ],
    'Redefinir senha',
    url,
  );
}
