import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { config } from '../src/config.js';
import {
  TEST_PASSWORD,
  cookieFrom,
  createTestApp,
  resetDatabase,
  signIn,
  signUp,
  signUpUnverified,
} from './helpers.js';
import { emailsTo, lastLinkTo } from './outbox.js';
import { totpFromUri } from './totp.js';

let app: FastifyInstance;

beforeEach(async () => {
  app ??= await createTestApp();
  await resetDatabase(app);
});

afterAll(async () => {
  await app.close();
});

/** Follows a Better Auth email link (it points at the API) the way a browser would. */
function follow(link: string, cookie?: string) {
  const url = new URL(link);
  return app.inject({
    method: 'GET',
    url: url.pathname + url.search,
    headers: cookie ? { cookie } : {},
  });
}

function post(url: string, payload: object, cookie?: string) {
  return app.inject({
    method: 'POST',
    url,
    headers: { origin: config.WEB_ORIGIN, ...(cookie ? { cookie } : {}) },
    payload,
  });
}

function getSession(cookie: string) {
  return app.inject({ method: 'GET', url: '/api/auth/get-session', headers: { cookie } });
}

describe('email confirmation', () => {
  it('signs up without a session and emails a confirmation link', async () => {
    const { email } = await signUpUnverified(app);
    expect(await emailsTo(email)).toHaveLength(1);
    expect((await emailsTo(email))[0]!.subject).toBe('Confirme seu e-mail');
  });

  it('refuses sign-in until the email is confirmed, sending a fresh link', async () => {
    const { email } = await signUpUnverified(app);
    const res = await signIn(app, email);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
    expect(cookieFrom(res)).toBe('');
    expect(await emailsTo(email)).toHaveLength(2);
  });

  it('the link confirms the email and signs the user in', async () => {
    const { id, email } = await signUpUnverified(app);
    const res = await follow(await lastLinkTo(email));
    expect(res.statusCode).toBe(302);
    const session = await getSession(cookieFrom(res));
    expect(session.json()).toMatchObject({ user: { id, emailVerified: true } });
    expect((await signIn(app, email)).statusCode).toBe(200);
  });

  it('a tampered link confirms nothing', async () => {
    const { id, email } = await signUpUnverified(app);
    const link = new URL(await lastLinkTo(email));
    link.searchParams.set('token', 'forged');
    await follow(link.toString());
    expect((await app.prisma.user.findUniqueOrThrow({ where: { id } })).emailVerified).toBe(false);
  });
});

describe('password reset', () => {
  const NEW_PASSWORD = 'another-password-5678';

  async function requestReset(email: string) {
    const res = await post('/api/auth/request-password-reset', {
      email,
      redirectTo: `${config.WEB_ORIGIN}/reset-password`,
    });
    expect(res.statusCode).toBe(200);
  }

  it('emails a link that leads to the web page with a token that sets a new password', async () => {
    const user = await signUp(app);
    const { email } = await app.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    await requestReset(email);

    const redirect = await follow(await lastLinkTo(email));
    expect(redirect.statusCode).toBe(302);
    const landing = new URL(redirect.headers.location as string);
    expect(landing.origin + landing.pathname).toBe(`${config.WEB_ORIGIN}/reset-password`);
    const token = landing.searchParams.get('token')!;

    const reset = await post('/api/auth/reset-password', { token, newPassword: NEW_PASSWORD });
    expect(reset.statusCode).toBe(200);
    expect((await signIn(app, email)).statusCode).toBe(401);
    expect((await signIn(app, email, NEW_PASSWORD)).statusCode).toBe(200);
    // Whoever held the old password loses the session too.
    expect((await getSession(user.cookie)).json()).toBeNull();
    // A token works once.
    expect(
      (await post('/api/auth/reset-password', { token, newPassword: 'x'.repeat(12) })).statusCode,
    ).toBe(400);
  });

  it('answers the same for an unknown email, and sends nothing', async () => {
    await requestReset('nobody@test.local');
    expect(await emailsTo('nobody@test.local')).toHaveLength(0);
  });
});

describe('two-factor authentication (authenticator app)', () => {
  /** Turns 2FA on for a fresh user: enable with the password, then confirm with a first code. */
  async function userWithTwoFactor() {
    const user = await signUp(app);
    const { email } = await app.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const enabled = await post(
      '/api/auth/two-factor/enable',
      { password: TEST_PASSWORD },
      user.cookie,
    );
    expect(enabled.statusCode).toBe(200);
    const { totpURI, backupCodes } = enabled.json<{ totpURI: string; backupCodes: string[] }>();
    const confirmed = await post(
      '/api/auth/two-factor/verify-totp',
      { code: totpFromUri(totpURI) },
      user.cookie,
    );
    expect(confirmed.statusCode).toBe(200);
    return { ...user, email, totpURI, backupCodes };
  }

  it('is off until the first code confirms it', async () => {
    const user = await signUp(app);
    await post('/api/auth/two-factor/enable', { password: TEST_PASSWORD }, user.cookie);
    const { email } = await app.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect((await signIn(app, email)).json()).not.toHaveProperty('twoFactorRedirect');
  });

  it('a password alone gives no session; the authenticator code completes the sign-in', async () => {
    const { id, email, totpURI } = await userWithTwoFactor();
    const first = await signIn(app, email);
    expect(first.json()).toMatchObject({ twoFactorRedirect: true });
    const pending = cookieFrom(first);
    expect((await getSession(pending)).json()).toBeNull();

    expect(
      (await post('/api/auth/two-factor/verify-totp', { code: '000000' }, pending)).statusCode,
    ).toBe(401);
    const verified = await post(
      '/api/auth/two-factor/verify-totp',
      { code: totpFromUri(totpURI) },
      pending,
    );
    expect(verified.statusCode).toBe(200);
    expect((await getSession(cookieFrom(verified))).json()).toMatchObject({ user: { id } });
  });

  it('a backup code signs in once', async () => {
    const { email, backupCodes } = await userWithTwoFactor();
    const code = backupCodes[0]!;
    const useBackup = async () =>
      post(
        '/api/auth/two-factor/verify-backup-code',
        { code },
        cookieFrom(await signIn(app, email)),
      );
    expect((await useBackup()).statusCode).toBe(200);
    expect((await useBackup()).statusCode).toBe(401);
  });

  it('turning it off needs the password', async () => {
    const user = await userWithTwoFactor();
    const session = cookieFrom(
      await post(
        '/api/auth/two-factor/verify-totp',
        { code: totpFromUri(user.totpURI) },
        cookieFrom(await signIn(app, user.email)),
      ),
    );
    expect(
      (await post('/api/auth/two-factor/disable', { password: 'wrong-password' }, session))
        .statusCode,
    ).not.toBe(200);
    expect(
      (await post('/api/auth/two-factor/disable', { password: TEST_PASSWORD }, session)).statusCode,
    ).toBe(200);
    expect((await signIn(app, user.email)).json()).not.toHaveProperty('twoFactorRedirect');
  });
});
