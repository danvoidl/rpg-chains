import type { Prisma, PrismaClient } from '@prisma/client';
import { TradeSideSchema } from '@rpg-chains/shared-types';
import type { TradeOffer } from './trade-offers.js';

/**
 * The database copy of pending trade offers (Fase 6 plan decision 9). Memory stays the index the
 * routes read inside their transactions; this mirrors each change after it, in order, and hands
 * the offers back on boot.
 */
export class TradeOfferStore {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly onError: (error: unknown) => void,
  ) {}

  save(offer: TradeOffer): void {
    this.enqueue(async () => {
      await this.prisma.tradeOffer.create({
        data: {
          id: offer.id,
          roomId: offer.roomId,
          fromProfileId: offer.fromProfileId,
          toProfileId: offer.toProfileId,
          give: offer.give as unknown as Prisma.InputJsonValue,
          ask: offer.ask as unknown as Prisma.InputJsonValue,
          expiresAt: new Date(offer.expiresAt),
        },
      });
    });
  }

  delete(id: string): void {
    this.enqueue(async () => {
      await this.prisma.tradeOffer.deleteMany({ where: { id } });
    });
  }

  /** Every stored offer, expired ones included (the caller drops those). */
  async load(): Promise<TradeOffer[]> {
    const rows = await this.prisma.tradeOffer.findMany();
    return rows.map((row) => ({
      id: row.id,
      roomId: row.roomId,
      fromProfileId: row.fromProfileId,
      toProfileId: row.toProfileId,
      give: TradeSideSchema.parse(row.give),
      ask: TradeSideSchema.parse(row.ask),
      expiresAt: row.expiresAt.getTime(),
    }));
  }

  /** Resolves once every queued write is done (shutdown, tests). */
  settled(): Promise<void> {
    return this.queue;
  }

  private enqueue(write: () => Promise<void>): void {
    this.queue = this.queue.then(write).catch(this.onError);
  }
}
