/** Data the auth middleware attaches to every socket. */
export interface SocketData {
  userId: string;
  /** Lobbies this socket joined, so a disconnect can leave all of them. */
  roomIds: Set<string>;
  /** Battles this socket watches, so a disconnect can take the player out of them (spec §7). */
  battleIds: Set<string>;
}
