import type { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

/** Layout for authentication pages, centering a card on the screen. */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 text-gray-900">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}
