import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** The e2e server's EMAIL_TRANSPORT=outbox file (playwright.config.ts): one JSON email per line. */
export const E2E_OUTBOX_FILE = path.join(tmpdir(), 'rpg-chains-e2e-outbox.jsonl');

interface OutboxEmail {
  to: string;
  subject: string;
  text: string;
}

/** The link of the latest email sent to `to`, waiting briefly for it to arrive. */
export async function lastLinkTo(to: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const raw = await readFile(E2E_OUTBOX_FILE, 'utf8').catch(() => '');
    const email = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as OutboxEmail)
      .filter((e) => e.to === to)
      .at(-1);
    const link = email?.text.match(/https?:\/\/\S+/)?.[0];
    if (link) return link;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`no email with a link sent to ${to}`);
}
