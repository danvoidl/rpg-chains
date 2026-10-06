import { z } from 'zod';
import { IdSchema } from './common.js';

/**
 * Socket.IO contract of the room lobby (Fase 2). Kept apart from battle Commands/Events: presence
 * is not a battle fact and never enters a replay. Mutations go through REST; the socket only says
 * who is online and that something changed (`room:changed` → the client refetches).
 */

/** Client → server: subscribe to a room's presence and change signals (members only). */
export const RoomJoinMessageSchema = z.object({ roomId: IdSchema });
export type RoomJoinMessage = z.infer<typeof RoomJoinMessageSchema>;

/** Client → server: unsubscribe (navigating away without closing the socket). */
export const RoomLeaveMessageSchema = z.object({ roomId: IdSchema });
export type RoomLeaveMessage = z.infer<typeof RoomLeaveMessageSchema>;

/** Acknowledgement of `room:join`. */
export type RoomJoinAck = { ok: true } | { ok: false; error: 'invalid_message' | 'not_a_member' };

/** Server → client: who is online in the room right now (several tabs count once). */
export const RoomPresenceMessageSchema = z.object({
  roomId: IdSchema,
  onlineUserIds: z.array(IdSchema),
});
export type RoomPresenceMessage = z.infer<typeof RoomPresenceMessageSchema>;

/** Server → client: the room changed; refetch it. */
export const RoomChangedMessageSchema = z.object({ roomId: IdSchema });
export type RoomChangedMessage = z.infer<typeof RoomChangedMessageSchema>;

/** Event names of the lobby channel, shared by server and client. */
export const ROOM_EVENTS = {
  join: 'room:join',
  leave: 'room:leave',
  presence: 'room:presence',
  changed: 'room:changed',
} as const;
