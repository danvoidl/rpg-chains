import 'dotenv/config';

/** The isolated database contract tests run against. Never the dev database. */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is required to run the server tests');
  return url;
}
