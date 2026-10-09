'use client';

import { useState, type FormEvent } from 'react';
import QRCode from 'react-qr-code';
import { authClient } from '@/lib/auth-client';
import { authErrorMessage } from './auth-error-messages';
import { AuthAlert, AuthField, AuthSubmit } from './auth-form-parts';

interface TwoFactorSetupProps {
  totpURI: string;
  backupCodes: string[];
  onConfirmed: () => void;
}

/**
 * Second half of turning the authenticator app on: scan the QR code (or type the key), keep
 * the backup codes, and confirm with a first code — only then does sign-in start asking for it.
 */
export function TwoFactorSetup({ totpURI, backupCodes, onConfirmed }: TwoFactorSetupProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const secret = new URL(totpURI).searchParams.get('secret') ?? '';

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code: code.trim() });
      if (result.error) {
        setError(authErrorMessage(result.error, 'Código incorreto.'));
        return;
      }
      onConfirmed();
    } catch {
      setError('Falha na comunicação com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="font-medium text-gray-900">1. Escaneie com o app autenticador</h3>
        <p className="text-sm text-gray-600">
          Google Authenticator, Microsoft Authenticator, 1Password, Bitwarden ou similar.
        </p>
        <div className="inline-block rounded-md border border-gray-200 bg-white p-3">
          <QRCode value={totpURI} size={176} />
        </div>
        <p className="text-sm text-gray-600">
          Sem câmera? Digite a chave: <code className="break-all font-mono">{secret}</code>
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium text-gray-900">2. Guarde os códigos de recuperação</h3>
        <p className="text-sm text-gray-600">
          Cada um entra uma vez sem o app, se você perder o celular. Guarde num lugar seguro: eles
          não aparecem de novo.
        </p>
        <ul className="grid grid-cols-2 gap-1 rounded-md bg-gray-50 p-3 font-mono text-sm">
          {backupCodes.map((backupCode) => (
            <li key={backupCode}>{backupCode}</li>
          ))}
        </ul>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <h3 className="font-medium text-gray-900">3. Confirme com o código do app</h3>
        {error && <AuthAlert>{error}</AuthAlert>}
        <AuthField
          id="setup-code"
          label="Código de 6 dígitos"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <AuthSubmit disabled={isSubmitting || code.trim().length === 0}>Ativar</AuthSubmit>
      </form>
    </div>
  );
}
