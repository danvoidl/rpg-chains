import type { CommandRateLimit } from './command-rate-limit.js';

/** Data the auth middleware attaches to every socket. */
export interface SocketData {
  userId: string;
  /** Lobbies this socket joined, so a disconnect can leave all of them. */
  roomIds: Set<string>;
  /** Battles this socket watches, so a disconnect counts as a drop from them (spec §7). */
  battleIds: Set<string>;
  /** Battle intents sent in the last second (Fase 6 plan decision 10). */
  commands: CommandRateLimit;
}
