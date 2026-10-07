import { randomUUID } from 'node:crypto';
import type { TradeSide } from '@rpg-chains/shared-types';

/** A pending offer (Fase 4 plan decision 9). Memory only: a crash loses offers, never items. */
export interface TradeOffer {
  id: string;
  roomId: string;
  fromProfileId: string;
  toProfileId: string;
  give: TradeSide;
  ask: TradeSide;
  expiresAt: number;
}

/**
 * Pending trade offers of the process. One per pair of players at a time, whichever proposed it;
 * each expires after `timeoutMs`. Nothing moves until an offer is accepted, so dropping one —
 * expiry, cancel, decline, a player leaving or joining a battle — never needs a rollback.
 * `onExpired` tells the room (its members refetch) when an offer goes away on its own.
 */
export class TradeOffers {
  private readonly offers = new Map<string, TradeOffer>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly timeoutMs: number,
    private readonly onExpired: (roomId: string) => void,
  ) {}

  /** The pending offer between two players, in either direction. */
  between(a: string, b: string): TradeOffer | undefined {
    return [...this.offers.values()].find(
      (o) =>
        (o.fromProfileId === a && o.toProfileId === b) ||
        (o.fromProfileId === b && o.toProfileId === a),
    );
  }

  get(id: string): TradeOffer | undefined {
    return this.offers.get(id);
  }

  /** The offers a profile is a party to, oldest first. */
  involving(profileId: string): TradeOffer[] {
    return [...this.offers.values()].filter(
      (o) => o.fromProfileId === profileId || o.toProfileId === profileId,
    );
  }

  propose(offer: Omit<TradeOffer, 'id' | 'expiresAt'>): TradeOffer {
    const created = { ...offer, id: randomUUID(), expiresAt: Date.now() + this.timeoutMs };
    this.offers.set(created.id, created);
    this.timers.set(
      created.id,
      setTimeout(() => {
        this.remove(created.id);
        this.onExpired(created.roomId);
      }, this.timeoutMs),
    );
    return created;
  }

  remove(id: string): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.offers.delete(id);
  }

  /** Drops every offer of a profile (it left the room or went into a battle); true if any. */
  dropProfile(profileId: string): boolean {
    const dropped = this.involving(profileId);
    for (const offer of dropped) this.remove(offer.id);
    return dropped.length > 0;
  }

  /** Forgets everything (server shutdown, tests). */
  clear(): void {
    for (const id of [...this.offers.keys()]) this.remove(id);
  }
}
