import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import {
  ROOM_EVENTS,
  type RoomChangedMessage,
  type RoomPresenceMessage,
} from '@rpg-chains/shared-types';
import { config } from '@/lib/config';

/** Subscribes to a room's presence and change signals; `membershipKey` re-joins when it changes. */
export function useRoomChannel(roomId: string, membershipKey?: string) {
  const queryClient = useQueryClient();
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(config.apiUrl, { withCredentials: true });
    socketRef.current = socket;

    const join = () => {
      socket.emit(ROOM_EVENTS.join, { roomId });
    };
    socket.on('connect', join);
    socket.on(ROOM_EVENTS.presence, (msg: RoomPresenceMessage) => {
      if (msg.roomId === roomId) setOnlineUserIds(msg.onlineUserIds);
    });
    socket.on(ROOM_EVENTS.changed, (msg: RoomChangedMessage) => {
      if (msg.roomId === roomId) void queryClient.invalidateQueries({ queryKey: ['rooms'] });
    });

    return () => {
      socket.emit(ROOM_EVENTS.leave, { roomId });
      socket.disconnect();
      socketRef.current = null;
      setOnlineUserIds([]);
    };
  }, [roomId, queryClient]);

  // Membership changes what the server allows for private rooms: join again.
  useEffect(() => {
    const socket = socketRef.current;
    if (socket?.connected) socket.emit(ROOM_EVENTS.join, { roomId });
  }, [roomId, membershipKey]);

  return { onlineUserIds };
}
