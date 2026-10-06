'use client';

import { useParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { BattleView } from '@/features/battles/battle-view';

/** A running battle of the room, for its fighters and anyone watching. */
export default function BattlePage() {
  const params = useParams();
  const { data: session } = authClient.useSession();
  if (!session) return null;
  return (
    <BattleView
      key={params.battleId as string}
      battleId={params.battleId as string}
      roomId={params.roomId as string}
      userId={session.user.id}
    />
  );
}
