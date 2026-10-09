'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { authClient } from '@/lib/auth-client';
import { authErrorMessage } from '@/features/auth/auth-error-messages';
import { AuthAlert, AuthField, AuthSubmit } from '@/features/auth/auth-form-parts';

interface CodeFormValues {
  code: string;
  trustDevice: boolean;
}

/**
 * Second step of signing in to an account with an authenticator app: the app's 6-digit code,
 * or one of the backup codes when the phone is not at hand. "Trust this device" skips the step
 * on this browser for a while.
 */
export default function TwoFactorPage() {
  const router = useRouter();
  const [useBackup, setUseBackup] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CodeFormValues>({ defaultValues: { code: '', trustDevice: false } });

  const onSubmit = async ({ code, trustDevice }: CodeFormValues) => {
    setServerError(null);
    const trimmed = code.trim();
    try {
      const result = useBackup
        ? await authClient.twoFactor.verifyBackupCode({ code: trimmed, trustDevice })
        : await authClient.twoFactor.verifyTotp({ code: trimmed, trustDevice });
      if (result.error) {
        setServerError(authErrorMessage(result.error, 'Código incorreto.'));
        return;
      }
      router.push('/campaigns');
    } catch {
      setServerError('Falha na comunicação com o servidor.');
    }
  };

  const toggleMode = () => {
    setUseBackup((value) => !value);
    setServerError(null);
    reset({ code: '' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Verificação em duas etapas
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {useBackup
            ? 'Digite um dos seus códigos de recuperação. Cada um funciona uma vez só.'
            : 'Digite o código de 6 dígitos do seu app autenticador.'}
        </p>
      </div>

      {serverError && <AuthAlert>{serverError}</AuthAlert>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <AuthField
          id="code"
          label={useBackup ? 'Código de recuperação' : 'Código'}
          type="text"
          autoComplete="one-time-code"
          inputMode={useBackup ? 'text' : 'numeric'}
          autoFocus
          {...register('code', { validate: (value) => value.trim() !== '' || 'Digite o código' })}
          error={errors.code?.message}
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" {...register('trustDevice')} />
          Confiar neste aparelho por 30 dias
        </label>
        <AuthSubmit disabled={isSubmitting}>Verificar</AuthSubmit>
      </form>

      <div className="flex justify-between text-sm">
        <button
          type="button"
          onClick={toggleMode}
          className="font-medium text-blue-600 hover:underline"
        >
          {useBackup ? 'Usar o app autenticador' : 'Usar um código de recuperação'}
        </button>
        <Link href="/login" className="font-medium text-blue-600 hover:underline">
          Voltar
        </Link>
      </div>
    </div>
  );
}
