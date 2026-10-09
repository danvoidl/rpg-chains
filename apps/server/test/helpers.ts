import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { buildApp, type AppOptions } from '../src/app.js';
import { config } from '../src/config.js';

/** Reconnection grace in tests: long enough for a reconnect, short enough to wait out. */
export const TEST_GRACE_MS = 150;

/** Builds a ready, non-listening app for `app.inject()` contract tests. */
export async function createTestApp(
  options: Omit<AppOptions, 'logger'> = {},
): Promise<FastifyInstance> {
  const app = await buildApp({
    logger: false,
    ...options,
    // Tests share one database: only a restart test brings journaled battles back.
    battles: { reconnectGraceMs: TEST_GRACE_MS, restore: false, ...options.battles },
    trades: { restore: false, ...options.trades },
  });
  await app.ready();
  return app;
}

/** Empties every table (except Prisma's migration log) so each test starts clean. */
export async function resetDatabase(app: FastifyInstance): Promise<void> {
  const rows = await app.prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const tables = rows.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await app.prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE`);
}

export interface TestUser {
  id: string;
  /** `Cookie` header value carrying the Better Auth session. */
  cookie: string;
}

let userCounter = 0;

export const TEST_PASSWORD = 'password1234';

/** `Cookie` header value from a response's Set-Cookie headers. */
export function cookieFrom(res: LightMyRequestResponse): string {
  const setCookie = res.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

/** Signs in through the real Better Auth route. */
export function signIn(
  app: FastifyInstance,
  email: string,
  password = TEST_PASSWORD,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { origin: config.WEB_ORIGIN },
    payload: { email, password },
  });
}

/** Creates an account through the real sign-up route, without confirming its email. */
export async function signUpUnverified(
  app: FastifyInstance,
  name = 'Author',
): Promise<{ id: string; email: string }> {
  userCounter += 1;
  const email = `user${userCounter}-${Date.now()}@test.local`;
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: { origin: config.WEB_ORIGIN },
    payload: { name, email, password: TEST_PASSWORD },
  });
  if (res.statusCode !== 200) throw new Error(`sign-up failed: ${res.statusCode} ${res.body}`);
  return { id: res.json<{ user: { id: string } }>().user.id, email };
}

/**
 * A fresh, signed-in user: signs up, confirms the email (sign-in requires it; `auth.test.ts`
 * covers the real link) and signs in, returning the session cookie.
 */
export async function signUp(app: FastifyInstance, name = 'Author'): Promise<TestUser> {
  const { id, email } = await signUpUnverified(app, name);
  await app.prisma.user.update({ where: { id }, data: { emailVerified: true } });
  const res = await signIn(app, email);
  if (res.statusCode !== 200) throw new Error(`sign-in failed: ${res.statusCode} ${res.body}`);
  return { id, cookie: cookieFrom(res) };
}

/** `app.inject` as a given user (or anonymous when `user` is null). */
export function requestAs(
  app: FastifyInstance,
  user: TestUser | null,
  options: Omit<InjectOptions, 'headers'>,
): Promise<LightMyRequestResponse> {
  return app.inject({
    ...options,
    headers: { origin: config.WEB_ORIGIN, ...(user ? { cookie: user.cookie } : {}) },
  } as InjectOptions);
}
