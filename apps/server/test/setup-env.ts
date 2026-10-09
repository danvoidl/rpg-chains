import { tmpdir } from 'node:os';
import path from 'node:path';
import { testDatabaseUrl } from './test-database-url.js';

// Runs before each test file's imports, so `config.ts` parses the test database url — and, whatever
// the local .env says, auth emails go to an outbox file the tests read (`test/outbox.ts`) and no
// captcha is asked.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.EMAIL_TRANSPORT = 'outbox';
process.env.EMAIL_OUTBOX_FILE = path.join(tmpdir(), `rpg-chains-outbox-${process.pid}.jsonl`);
process.env.CAPTCHA_PROVIDER = 'off';
