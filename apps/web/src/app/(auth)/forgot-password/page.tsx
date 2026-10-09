'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';
import { authErrorMessage } from '@/features/auth/auth-error-messages';
import { AuthAlert, AuthField, AuthNotice, AuthSubmit } from '@/features/auth/auth-form-parts';
import { useCaptcha } from '@/features/auth/use-captcha';

const forgotSchema = z.object({
  email: z.string().trim().min(1, 'E-mail é obrigatório').email('E-mail inválido'),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

/**
 * Asks for a password-reset link. The answer is the same whether or not the email has an
 * account, so the page cannot be used to find out who is registered.
 */
export default function ForgotPasswordPage() {
  const captcha = useCaptcha();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async ({ email }: ForgotFormValues) => {
    setServerError(null);
    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
        fetchOptions: { headers: captcha.headers },
      });
      if (result.error) {
        setServerError(authErrorMessage(result.error, 'Erro ao pedir o link.'));
        return;
      }
      setSent(true);
    } catch {
      setServerError('Falha na comunicação com o servidor.');
    } finally {
      captcha.reset();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Esqueci minha senha</h1>
        <p className="mt-1 text-sm text-gray-600">
          Informe o e-mail da conta e enviaremos um link para criar uma senha nova.
        </p>
      </div>

      {serverError && <AuthAlert>{serverError}</AuthAlert>}

      {sent ? (
        <AuthNotice>
          Se existir uma conta com este e-mail, o link chega em alguns minutos. Ele vale por 1 hora.
        </AuthNotice>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <AuthField
            id="email"
            label="E-mail"
            type="email"
            autoComplete="email"
            {...register('email')}
            error={errors.email?.message}
          />
          {captcha.widget}
          <AuthSubmit disabled={isSubmitting || !captcha.ready}>Enviar link</AuthSubmit>
        </form>
      )}

      <div className="text-center text-sm text-gray-600">
        <Link href="/login" className="font-medium text-blue-600 hover:underline">
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
