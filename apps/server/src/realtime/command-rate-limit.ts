/** Battle intents one socket may send per second; far above any person tapping (decision 10). */
export const COMMANDS_PER_SECOND = 20;

/**
 * A sliding one-second window of a socket's battle intents (Fase 6 plan decision 10): a client that
 * hammers the signal or replays intents in a loop gets `rate_limited` instead of reaching the
 * registry. Per socket, in memory, forgotten with the socket.
 */
export class CommandRateLimit {
  private readonly times: number[] = [];

  constructor(private readonly limit = COMMANDS_PER_SECOND) {}

  /** Records an intent at `now` (ms); false if the window is already full. */
  allow(now: number): boolean {
    while (this.times.length > 0 && this.times[0]! <= now - 1000) this.times.shift();
    if (this.times.length >= this.limit) return false;
    this.times.push(now);
    return true;
  }
}
