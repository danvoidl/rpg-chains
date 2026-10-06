import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Connection URL for Migrate/Studio lives here (Prisma 7 direction), never in the schema
// datasource block. The runtime client connects via the pg driver adapter (see src/db.ts).
// No hardcoded fallback — a missing value is a .env fix.
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: { url },
});
