'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthAlert, AuthNotice } from '@/features/auth/auth-form-parts';

/**
 * Where the confirmation link lands (via the API, which confirms the email, signs the user in
 * and redirects here — with `?error=` when the link was bad or expired).
 */
function EmailVerifiedMessage() {
  const failed = useSearchParams().has('error');
  if (failed) {
    return (
      <AuthAlert>
        O link expirou ou já foi usado.{' '}
        <Link href="/login" className="font-medium underline">
          Entre
        </Link>{' '}
        com seu e-mail e senha para receber um link novo.
      </AuthAlert>
    );
  }
  return (
    <AuthNotice>
      E-mail confirmado.{' '}
      <Link href="/campaigns" className="font-medium underline">
        Continuar
      </Link>
    </AuthNotice>
  );
}

export default function EmailVerifiedPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Confirmação de e-mail</h1>
      <Suspense>
        <EmailVerifiedMessage />
      </Suspense>
    </div>
  );
}
