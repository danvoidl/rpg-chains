'use client';

import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { RoomChannelProvider } from '@/features/rooms/room-channel-context';

/** Everything under a room shares one lobby connection (presence and change signals). */
export default function RoomLayout({ children }: { children: ReactNode }) {
  const roomId = useParams().roomId as string;
  return <RoomChannelProvider roomId={roomId}>{children}</RoomChannelProvider>;
}
