import { appendFile } from 'node:fs/promises';
import { config } from '../config.js';

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const RESEND_URL = 'https://api.resend.com/emails';

/** Production: Resend's HTTP API. A non-2xx answer throws, so the auth request fails loudly. */
async function sendWithResend(email: Email): Promise<void> {
  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: config.EMAIL_FROM, ...email }),
  });
  if (!res.ok) throw new Error(`Resend refused the email: ${res.status} ${await res.text()}`);
}

/** Dev: the email (with its link) goes to the server log instead of a mailbox. */
function logEmail(email: Email): void {
  console.info(`[email] to ${email.to}: ${email.subject}\n${email.text}`);
}

/** Tests: one JSON line per email, read back by the server tests and the e2e. */
async function appendToOutbox(email: Email): Promise<void> {
  await appendFile(config.EMAIL_OUTBOX_FILE!, `${JSON.stringify(email)}\n`);
}

/** Sends an auth email through the transport the env picks (`EMAIL_TRANSPORT`). */
export async function sendEmail(email: Email): Promise<void> {
  switch (config.EMAIL_TRANSPORT) {
    case 'resend':
      return sendWithResend(email);
    case 'log':
      return logEmail(email);
    case 'outbox':
      return appendToOutbox(email);
  }
}
