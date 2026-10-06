import { Prisma } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { ACCESS_CODE_LENGTH } from '@rpg-chains/shared-types';

/** Uppercase letters and digits without look-alikes (0/O, 1/I), so codes survive being read aloud. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A fresh random access code for a private room; callers retry on a unique-constraint clash. */
export function generateAccessCode(): string {
  let code = '';
  for (let i = 0; i < ACCESS_CODE_LENGTH; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

const MAX_CODE_ATTEMPTS = 5;

/**
 * Runs a write that stores a fresh access code, retrying with a new code when the unique
 * constraint rejects a clash. Must not run inside an interactive transaction — Postgres aborts the
 * transaction on the failed statement, so the retry would fail too.
 */
export async function withFreshAccessCode<T>(write: (code: string) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await write(generateAccessCode());
    } catch (error) {
      const clash = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!clash || attempt >= MAX_CODE_ATTEMPTS) throw error;
    }
  }
}
