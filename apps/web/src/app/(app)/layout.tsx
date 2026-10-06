'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

interface AppLayoutProps {
  children: ReactNode;
}

/** Authenticated layout guarding routes and providing common top navigation. */
export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.replace('/login');
    }
  }, [isPending, session, router]);

  if (isPending || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-600">Carregando…</div>
    );
  }

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-6">
            <Link
              href="/campaigns"
              className="text-lg font-semibold text-gray-900 hover:text-blue-600"
            >
              Campanhas
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">{session.user.name}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
