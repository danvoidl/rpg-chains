import { createAuthClient } from 'better-auth/react';

// Next public env is the framework-sanctioned way to read client config (no hardcoded fallback).
const baseURL = process.env.NEXT_PUBLIC_AUTH_URL;
if (!baseURL) throw new Error('NEXT_PUBLIC_AUTH_URL is required');

export const authClient = createAuthClient({ baseURL });
