/**
 * Reconnection grace (Fase 6 plan decisions 1 and 4): a drop schedules its consequence, a return
 * in time cancels it. Keyed by string so battles (`battleId:profileId`) and lobby presence
 * (`lobby:roomId:userId`) share one clock. Memory only, like the battles it guards.
 */
export class GraceTimers {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(readonly ms: number) {}

  /** Runs `onExpired` after the grace unless cancelled first; a pending key keeps its clock. */
  start(key: string, onExpired: () => void): void {
    if (this.timers.has(key)) return;
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        onExpired();
      }, this.ms),
    );
  }

  /** Stops a pending grace; true if one was running. */
  cancel(key: string): boolean {
    const timer = this.timers.get(key);
    if (!timer) return false;
    clearTimeout(timer);
    this.timers.delete(key);
    return true;
  }

  has(key: string): boolean {
    return this.timers.has(key);
  }

  /** Stops every pending grace whose key starts with `prefix` (a battle that went away). */
  cancelPrefix(prefix: string): void {
    for (const key of [...this.timers.keys()]) if (key.startsWith(prefix)) this.cancel(key);
  }

  /** Stops everything (server shutdown, tests). */
  clearAll(): void {
    for (const key of [...this.timers.keys()]) this.cancel(key);
  }
}

/** The grace key of a participant in a battle. */
export const participantGraceKey = (battleId: string, profileId: string) =>
  `${battleId}:${profileId}`;

/** The grace key of a user's lobby presence in a room. */
export const lobbyGraceKey = (roomId: string, userId: string) => `lobby:${roomId}:${userId}`;
