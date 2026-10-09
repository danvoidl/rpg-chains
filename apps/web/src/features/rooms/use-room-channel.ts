import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import {
  ROOM_EVENTS,
  type RoomChangedMessage,
  type RoomPresenceMessage,
} from '@rpg-chains/shared-types';

/**
 * Subscribes the tab's socket to a room's presence and change signals; `membershipKey` re-joins
 * when it changes. Every (re)connection joins again and refetches the room, since a
 * `room:changed` sent while the socket was down is lost (Fase 6 plan decision 5).
 */
export function useRoomChannel(socket: Socket | null, roomId: string, membershipKey?: string) {
  const queryClient = useQueryClient();
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!socket) return;
    const join = () => {
      socket.emit(ROOM_EVENTS.join, { roomId });
    };
    const onConnect = () => {
      join();
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
    };
    const onPresence = (msg: RoomPresenceMessage) => {
      if (msg.roomId === roomId) setOnlineUserIds(msg.onlineUserIds);
    };
    const onChanged = (msg: RoomChangedMessage) => {
      if (msg.roomId === roomId) void queryClient.invalidateQueries({ queryKey: ['rooms'] });
    };
    socket.on('connect', onConnect);
    socket.on(ROOM_EVENTS.presence, onPresence);
    socket.on(ROOM_EVENTS.changed, onChanged);
    if (socket.connected) join();

    return () => {
      socket.emit(ROOM_EVENTS.leave, { roomId });
      socket.off('connect', onConnect);
      socket.off(ROOM_EVENTS.presence, onPresence);
      socket.off(ROOM_EVENTS.changed, onChanged);
      setOnlineUserIds([]);
    };
  }, [socket, roomId, queryClient]);

  // Membership changes what the server allows for private rooms: join again.
  useEffect(() => {
    if (socket?.connected) socket.emit(ROOM_EVENTS.join, { roomId });
  }, [socket, roomId, membershipKey]);

  return { onlineUserIds };
}
