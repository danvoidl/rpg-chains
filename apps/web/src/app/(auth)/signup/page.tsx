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

const signupSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório'),
  email: z.string().trim().min(1, 'E-mail é obrigatório').email('E-mail inválido'),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
});

type SignupFormValues = z.infer<typeof signupSchema>;

/** Signup page: creates the account and asks the user to confirm the email before signing in. */
export default function SignupPage() {
  const captcha = useCaptcha();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = async (values: SignupFormValues) => {
    setServerError(null);
    try {
      const result = await authClient.signUp.email({
        ...values,
        fetchOptions: { headers: captcha.headers },
      });
      if (result.error) {
        setServerError(authErrorMessage(result.error, 'Erro ao criar conta.'));
        return;
      }
      setSentTo(values.email);
    } catch {
      setServerError('Falha na comunicação com o servidor.');
    } finally {
      captcha.reset();
    }
  };

  if (sentTo) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Confirme seu e-mail</h1>
        <AuthNotice>
          Enviamos um link de confirmação para <strong>{sentTo}</strong>. Abra o link para entrar na
          sua conta.
        </AuthNotice>
        <p className="text-sm text-gray-600">
          Não chegou? Confira o spam. Tentar{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            entrar
          </Link>{' '}
          com o e-mail ainda não confirmado envia um link novo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Criar conta</h1>
        <p className="mt-1 text-sm text-gray-600">Preencha os dados abaixo para começar.</p>
      </div>

      {serverError && <AuthAlert>{serverError}</AuthAlert>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <AuthField
          id="name"
          label="Nome"
          type="text"
          autoComplete="name"
          {...register('name')}
          error={errors.name?.message}
        />
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
          autoComplete="new-password"
          {...register('password')}
          error={errors.password?.message}
        />
        {captcha.widget}
        <AuthSubmit disabled={isSubmitting || !captcha.ready}>Criar conta</AuthSubmit>
      </form>

      <div className="text-center text-sm text-gray-600">
        Já tem uma conta?{' '}
        <Link href="/login" className="font-medium text-blue-600 hover:underline">
          Entrar
        </Link>
      </div>
    </div>
  );
}
