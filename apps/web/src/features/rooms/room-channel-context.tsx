'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRoom } from './api';
import { ConnectionBanner } from './connection-banner';
import { useRoomChannel } from './use-room-channel';
import { useTabSocket, type TabSocket } from './use-tab-socket';

const RoomPresenceContext = createContext<string[]>([]);
const RoomSocketContext = createContext<TabSocket>({
  socket: null,
  connected: false,
  reconnecting: false,
});

/**
 * Holds the tab's socket for every page under a room (Fase 3 plan M7, Fase 6 plan decision 5).
 * Living in the room layout, it survives moving between the room and its battles — otherwise the
 * master would drop offline for an instant on each navigation — and the lobby and the battle
 * channel share it, so one reconnection brings both back.
 */
export function RoomChannelProvider({ roomId, children }: { roomId: string; children: ReactNode }) {
  const code = useSearchParams().get('code') ?? undefined;
  const { data: room } = useRoom(roomId, code);
  const tab = useTabSocket();
  const { onlineUserIds } = useRoomChannel(
    tab.socket,
    roomId,
    room?.viewer.hasProfile ? 'member' : 'guest',
  );
  return (
    <RoomSocketContext.Provider value={tab}>
      <RoomPresenceContext.Provider value={onlineUserIds}>
        {tab.reconnecting && <ConnectionBanner />}
        {children}
      </RoomPresenceContext.Provider>
    </RoomSocketContext.Provider>
  );
}

/** Users online in the current room's lobby. */
export function useRoomPresence(): string[] {
  return useContext(RoomPresenceContext);
}

/** The tab's socket and whether it is connected, for the room's pages and the battle. */
export function useRoomSocket(): TabSocket {
  return useContext(RoomSocketContext);
}
