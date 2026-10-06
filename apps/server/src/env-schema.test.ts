import { describe, expect, it } from 'vitest';
import { EnvSchema } from './env-schema.js';

const valid = {
  DATABASE_URL: 'postgresql://rpg:rpg@localhost:5433/rpg_chains',
  BETTER_AUTH_SECRET: 'dev-secret',
  BETTER_AUTH_URL: 'http://localhost:3001',
  WEB_ORIGIN: 'http://localhost:3000',
  PORT: '3001',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'rpg-chains-media',
  S3_ACCESS_KEY_ID: 'rpg',
  S3_SECRET_ACCESS_KEY: 'rpgminio123',
  S3_FORCE_PATH_STYLE: 'true',
  S3_PUBLIC_BASE_URL: 'http://localhost:9000/rpg-chains-media',
  MEDIA_MAX_UPLOAD_BYTES: '5242880',
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

  it('parses S3_FORCE_PATH_STYLE to a boolean', () => {
    expect(EnvSchema.parse(valid).S3_FORCE_PATH_STYLE).toBe(true);
    expect(EnvSchema.parse({ ...valid, S3_FORCE_PATH_STYLE: 'false' }).S3_FORCE_PATH_STYLE).toBe(
      false,
    );
  });

  it('rejects a missing S3_BUCKET', () => {
    const { S3_BUCKET: _omitted, ...rest } = valid;
    expect(() => EnvSchema.parse(rest)).toThrow();
  });

  it('leaves BATTLE_SEED unset unless given, and rejects a non-integer', () => {
    expect(EnvSchema.parse(valid).BATTLE_SEED).toBeUndefined();
    expect(EnvSchema.parse({ ...valid, BATTLE_SEED: '42' }).BATTLE_SEED).toBe(42);
    expect(() => EnvSchema.parse({ ...valid, BATTLE_SEED: '4.2' })).toThrow();
  });
});
