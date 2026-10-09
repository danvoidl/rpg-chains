import { randomUUID } from 'node:crypto';
import type { TradeSide } from '@rpg-chains/shared-types';
import type { TradeOfferStore } from './trade-offer-store.js';

/** A pending offer (Fase 4 plan decision 9). Never items: nothing moves until it is accepted. */
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
 * `onExpired` tells the room (its members refetch) when an offer goes away on its own. Memory is
 * the index; every change is mirrored to `store`, and `restore` brings the offers back after a
 * restart with the time they had left (Fase 6 plan decision 9).
 */
export class TradeOffers {
  private readonly offers = new Map<string, TradeOffer>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly timeoutMs: number,
    private readonly onExpired: (roomId: string) => void,
    private readonly store: TradeOfferStore,
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
    this.track(created);
    this.store.save(created);
    return created;
  }

  remove(id: string): void {
    if (!this.forget(id)) return;
    this.store.delete(id);
  }

  /** Puts back the offers stored before a restart; expired ones are dropped. */
  restore(offers: readonly TradeOffer[]): void {
    for (const offer of offers) {
      if (offer.expiresAt <= Date.now()) this.store.delete(offer.id);
      else this.track(offer);
    }
  }

  /** Drops every offer of a profile (it left the room or went into a battle); true if any. */
  dropProfile(profileId: string): boolean {
    const dropped = this.involving(profileId);
    for (const offer of dropped) this.remove(offer.id);
    return dropped.length > 0;
  }

  /** Forgets everything in memory, keeping the stored copies (server shutdown, tests). */
  clear(): void {
    for (const id of [...this.offers.keys()]) this.forget(id);
  }

  private track(offer: TradeOffer): void {
    this.offers.set(offer.id, offer);
    this.timers.set(
      offer.id,
      setTimeout(
        () => {
          this.remove(offer.id);
          this.onExpired(offer.roomId);
        },
        Math.max(0, offer.expiresAt - Date.now()),
      ),
    );
  }

  /** Drops an offer from memory; true if it was there. */
  private forget(id: string): boolean {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    return this.offers.delete(id);
  }
}
