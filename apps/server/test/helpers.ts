import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { buildApp, type AppOptions } from '../src/app.js';
import { config } from '../src/config.js';

/** Builds a ready, non-listening app for `app.inject()` contract tests. */
export async function createTestApp(
  options: Omit<AppOptions, 'logger'> = {},
): Promise<FastifyInstance> {
  const app = await buildApp({ logger: false, ...options });
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

/** Signs a fresh user up through the real Better Auth route and returns its session cookie. */
export async function signUp(app: FastifyInstance, name = 'Author'): Promise<TestUser> {
  userCounter += 1;
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: { origin: config.WEB_ORIGIN },
    payload: {
      name,
      email: `user${userCounter}-${Date.now()}@test.local`,
      password: 'password1234',
    },
  });
  if (res.statusCode !== 200) throw new Error(`sign-up failed: ${res.statusCode} ${res.body}`);
  const setCookie = res.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookie = cookies.map((c) => c.split(';')[0]).join('; ');
  return { id: res.json<{ user: { id: string } }>().user.id, cookie };
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
