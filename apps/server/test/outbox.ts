import { readFile } from 'node:fs/promises';
import { config } from '../src/config.js';
import type { Email } from '../src/email/transports.js';

/** Every email sent to `to` so far in this test run, oldest first. */
export async function emailsTo(to: string): Promise<Email[]> {
  const raw = await readFile(config.EMAIL_OUTBOX_FILE!, 'utf8').catch(() => '');
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Email)
    .filter((email) => email.to === to);
}

/** The link of the latest email sent to `to` (verification or password reset). */
export async function lastLinkTo(to: string): Promise<string> {
  const email = (await emailsTo(to)).at(-1);
  const link = email?.text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`no email with a link sent to ${to}`);
  return link;
}
