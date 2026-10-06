import type { ReactNode } from 'react';

export const metadata = {
  title: 'rpg-chains',
  description: 'Construtor e runtime de campanhas de RPG por turnos ao vivo.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
