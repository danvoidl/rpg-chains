/**
 * Who is online in each room lobby, in memory (single process, stack §3.3). A user counts once
 * however many tabs (sockets) they have open. Lost on restart; clients re-send `room:join` on
 * reconnect.
 */
export class Presence {
  private readonly rooms = new Map<string, Map<string, Set<string>>>();

  /** Adds a socket of `userId` to the room. */
  add(roomId: string, userId: string, socketId: string): void {
    const users = this.rooms.get(roomId) ?? new Map<string, Set<string>>();
    const sockets = users.get(userId) ?? new Set<string>();
    sockets.add(socketId);
    users.set(userId, sockets);
    this.rooms.set(roomId, users);
  }

  /** Removes a socket; the user goes offline when their last socket leaves. */
  remove(roomId: string, userId: string, socketId: string): void {
    const users = this.rooms.get(roomId);
    const sockets = users?.get(userId);
    if (!users || !sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) users.delete(userId);
    if (users.size === 0) this.rooms.delete(roomId);
  }

  /** Users online in the room. */
  online(roomId: string): string[] {
    return [...(this.rooms.get(roomId)?.keys() ?? [])];
  }
}
