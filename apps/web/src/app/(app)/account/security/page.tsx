'use client';

import { TwoFactorSettings } from '@/features/auth/two-factor-settings';

/** Account security: the optional second factor (authenticator app). */
export default function SecurityPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Segurança</h1>
      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Verificação em duas etapas</h2>
        <TwoFactorSettings />
      </section>
    </div>
  );
}
