import { createAuthClient } from 'better-auth/react';
import { twoFactorClient } from 'better-auth/client/plugins';
import { config } from './config';

export const authClient = createAuthClient({
  baseURL: config.apiUrl,
  // A password accepted for an account with an authenticator app still needs its code: the
  // login page sends the user on to /two-factor itself (client-side, no reload).
  plugins: [twoFactorClient()],
});
