import { describe, expect, it } from 'vitest';
import { EnvSchema } from './env-schema.js';

const valid = {
  DATABASE_URL: 'postgresql://rpg:rpg@localhost:5433/rpg_chains',
  BETTER_AUTH_SECRET: 'dev-secret',
  BETTER_AUTH_URL: 'http://localhost:3001',
  WEB_ORIGIN: 'http://localhost:3000',
  PORT: '3001',
};

describe('EnvSchema', () => {
  it('accepts a complete, well-formed env and coerces PORT to a number', () => {
    const env = EnvSchema.parse(valid);
    expect(env.PORT).toBe(3001);
  });

  it('rejects a missing secret (no hardcoded fallback)', () => {
    const { BETTER_AUTH_SECRET: _omitted, ...rest } = valid;
    expect(() => EnvSchema.parse(rest)).toThrow();
  });

  it('rejects a malformed database url', () => {
    expect(() => EnvSchema.parse({ ...valid, DATABASE_URL: 'not-a-url' })).toThrow();
  });
});
