'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';
import { authErrorMessage } from '@/features/auth/auth-error-messages';
import { AuthAlert, AuthField, AuthSubmit } from '@/features/auth/auth-form-parts';
import { useCaptcha } from '@/features/auth/use-captcha';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'E-mail é obrigatório').email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * Login page. An unconfirmed email is refused (the server sends a fresh link); an account with
 * an authenticator app goes on to `/two-factor` for its code.
 */
export default function LoginPage() {
  const router = useRouter();
  const captcha = useCaptcha();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      const result = await authClient.signIn.email({
        ...values,
        fetchOptions: { headers: captcha.headers },
      });
      if (result.error) {
        setServerError(authErrorMessage(result.error, 'Erro ao realizar login.'));
        return;
      }
      const needsSecondFactor = 'twoFactorRedirect' in result.data && result.data.twoFactorRedirect;
      router.push(needsSecondFactor ? '/two-factor' : '/campaigns');
    } catch {
      setServerError('Falha na comunicação com o servidor.');
    } finally {
      captcha.reset();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Entrar</h1>
        <p className="mt-1 text-sm text-gray-600">
          Acesse sua conta para gerenciar suas campanhas.
        </p>
      </div>

      {serverError && <AuthAlert>{serverError}</AuthAlert>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <AuthField
          id="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          {...register('email')}
          error={errors.email?.message}
        />
        <AuthField
          id="password"
          label="Senha"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          error={errors.password?.message}
        />
        <div className="text-right text-sm">
          <Link href="/forgot-password" className="font-medium text-blue-600 hover:underline">
            Esqueci minha senha
          </Link>
        </div>
        {captcha.widget}
        <AuthSubmit disabled={isSubmitting || !captcha.ready}>Entrar</AuthSubmit>
      </form>

      <div className="text-center text-sm text-gray-600">
        Não tem uma conta?{' '}
        <Link href="/signup" className="font-medium text-blue-600 hover:underline">
          Criar conta
        </Link>
      </div>
    </div>
  );
}
