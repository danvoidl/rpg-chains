import { testDatabaseUrl } from './test-database-url.js';

// Runs before each test file's imports, so `config.ts` parses the test database url.
process.env.DATABASE_URL = testDatabaseUrl();
