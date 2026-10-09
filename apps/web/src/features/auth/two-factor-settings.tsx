'use client';

import { useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';
import { authErrorMessage } from './auth-error-messages';
import { AuthAlert, AuthField, AuthNotice, AuthSubmit } from './auth-form-parts';
import { TwoFactorSetup } from './two-factor-setup';

interface PendingSetup {
  totpURI: string;
  backupCodes: string[];
}

/**
 * Turns the authenticator app on or off. Both ask for the password, so a session left open on
 * someone else's computer cannot change it.
 */
export function TwoFactorSettings() {
  const { data: session, refetch } = authClient.useSession();
  const enabled = session?.user.twoFactorEnabled === true;
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pending, setPending] = useState<PendingSetup | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      if (enabled) {
        const result = await authClient.twoFactor.disable({ password });
        if (result.error) {
          setError(authErrorMessage(result.error, 'Não foi possível desativar.'));
          return;
        }
        setNotice('Verificação em duas etapas desativada.');
        refetch();
      } else {
        const result = await authClient.twoFactor.enable({ password });
        if (result.error) {
          setError(authErrorMessage(result.error, 'Não foi possível ativar.'));
          return;
        }
        // Without email OTP configured, enabling always returns the authenticator setup.
        if (result.data.method === 'totp') setPending(result.data);
      }
      setPassword('');
    } catch {
      setError('Falha na comunicação com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pending) {
    return (
      <TwoFactorSetup
        totpURI={pending.totpURI}
        backupCodes={pending.backupCodes}
        onConfirmed={() => {
          setPending(null);
          setNotice('Verificação em duas etapas ativada. O próximo login vai pedir o código.');
          refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        {enabled
          ? 'Ativada: o login pede, além da senha, o código do seu app autenticador.'
          : 'Desativada. Ative para que, além da senha, o login peça um código do seu app autenticador — quem descobrir sua senha não consegue entrar sem o seu celular.'}
      </p>
      {notice && <AuthNotice>{notice}</AuthNotice>}
      {error && <AuthAlert>{error}</AuthAlert>}
      <form onSubmit={onSubmit} className="max-w-sm space-y-3">
        <AuthField
          id="two-factor-password"
          label="Sua senha"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <AuthSubmit disabled={isSubmitting || password.length === 0}>
          {enabled ? 'Desativar' : 'Ativar app autenticador'}
        </AuthSubmit>
      </form>
    </div>
  );
}
