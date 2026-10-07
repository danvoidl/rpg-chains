'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRoom } from './api';
import { useRoomChannel } from './use-room-channel';

const RoomPresenceContext = createContext<string[]>([]);

/**
 * Holds the room lobby socket for every page under a room (Fase 3 plan M7). Living in the room
 * layout, it survives moving between the room and its battles — otherwise the master would drop
 * offline for an instant on each navigation, and a battle with open questions would fall back.
 */
export function RoomChannelProvider({ roomId, children }: { roomId: string; children: ReactNode }) {
  const code = useSearchParams().get('code') ?? undefined;
  const { data: room } = useRoom(roomId, code);
  const { onlineUserIds } = useRoomChannel(roomId, room?.viewer.hasProfile ? 'member' : 'guest');
  return (
    <RoomPresenceContext.Provider value={onlineUserIds}>{children}</RoomPresenceContext.Provider>
  );
}

/** Users online in the current room's lobby. */
export function useRoomPresence(): string[] {
  return useContext(RoomPresenceContext);
}
