'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';
import { authErrorMessage } from '@/features/auth/auth-error-messages';
import { AuthAlert, AuthField, AuthNotice, AuthSubmit } from '@/features/auth/auth-form-parts';

const resetSchema = z
  .object({
    password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'As senhas não conferem',
    path: ['confirm'],
  });

type ResetFormValues = z.infer<typeof resetSchema>;

const LINK_EXPIRED = 'O link expirou ou já foi usado. Peça um novo.';

/**
 * Where the reset email's link lands (via the API, which appends `?token=` or `?error=`). A new
 * password signs every other device out.
 */
function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get('token');
  const [serverError, setServerError] = useState<string | null>(
    token && !params.get('error') ? null : LINK_EXPIRED,
  );
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = async ({ password }: ResetFormValues) => {
    if (!token) return;
    setServerError(null);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setServerError(authErrorMessage(result.error, 'Erro ao trocar a senha.'));
        return;
      }
      setDone(true);
    } catch {
      setServerError('Falha na comunicação com o servidor.');
    }
  };

  if (done) {
    return (
      <AuthNotice>
        Senha trocada. Entre com a senha nova; os outros aparelhos foram desconectados.{' '}
        <Link href="/login" className="font-medium underline">
          Entrar
        </Link>
      </AuthNotice>
    );
  }

  return (
    <>
      {serverError && (
        <AuthAlert>
          {serverError}{' '}
          {serverError === LINK_EXPIRED && (
            <Link href="/forgot-password" className="font-medium underline">
              Pedir novo link
            </Link>
          )}
        </AuthAlert>
      )}
      {token && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <AuthField
            id="password"
            label="Senha nova"
            type="password"
            autoComplete="new-password"
            {...register('password')}
            error={errors.password?.message}
          />
          <AuthField
            id="confirm"
            label="Repita a senha nova"
            type="password"
            autoComplete="new-password"
            {...register('confirm')}
            error={errors.confirm?.message}
          />
          <AuthSubmit disabled={isSubmitting}>Trocar senha</AuthSubmit>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Criar senha nova</h1>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
