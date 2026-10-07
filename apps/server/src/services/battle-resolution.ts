import type { Prisma, PrismaClient } from '@prisma/client';
import { consumedItems, profileOutcomes } from '@rpg-chains/battle-engine';
import { CampaignProfileSchema } from '@rpg-chains/shared-types';
import type { BattleListener, BattleRegistry, RunningBattle } from './battle-registry.js';
import { lockRoom } from './room-lock.js';

/**
 * The end of a battle (Fase 3 plan decision 11): once `BattleResolved` is folded, each
 * participant's HP, energy and downed flag go back to their profile, and the consumables they used
 * leave their inventory (as a delta, Fase 4 plan decision 12), in one transaction under the
 * room lock, and only then does the battle leave the registry — so the room cannot roll forward
 * to a newer version, or close, before the profiles are written.
 */
export class BattleResolution implements BattleListener {
  private readonly writing = new Map<string, Promise<void>>();

  constructor(
    private readonly registry: BattleRegistry,
    private readonly prisma: PrismaClient,
    private readonly onResolved: (roomId: string) => void,
    private readonly onError: (error: unknown) => void,
  ) {
    registry.subscribe(this);
  }

  appended(battle: RunningBattle): void {
    if (battle.state.result === null || this.writing.has(battle.battleId)) return;
    const done = this.writeBack(battle)
      .catch(this.onError)
      .finally(() => {
        this.writing.delete(battle.battleId);
        this.registry.remove(battle.battleId);
        this.onResolved(battle.roomId);
      });
    this.writing.set(battle.battleId, done);
  }

  /** Resolves once every write-back in flight has finished (tests, graceful shutdown). */
  async settled(): Promise<void> {
    await Promise.all(this.writing.values());
  }

  private async writeBack(battle: RunningBattle): Promise<void> {
    const outcomes = profileOutcomes(battle.state);
    const consumed = consumedItems(battle.log);
    await this.prisma.$transaction(async (tx) => {
      await lockRoom(tx, battle.roomId);
      for (const { profileId, ...resources } of outcomes) {
        const used = consumed.get(profileId) ?? [];
        const inventory = used.length > 0 ? await this.spend(tx, profileId, used) : undefined;
        await tx.campaignProfile.updateMany({
          where: { id: profileId },
          data: { ...resources, ...(inventory ? { inventory } : {}) },
        });
      }
    });
  }

  /** The profile's inventory minus the units used in battle, one occurrence per unit. */
  private async spend(
    tx: Prisma.TransactionClient,
    profileId: string,
    used: string[],
  ): Promise<string[] | undefined> {
    const row = await tx.campaignProfile.findUnique({
      where: { id: profileId },
      select: { inventory: true },
    });
    if (!row) return undefined;
    const inventory = CampaignProfileSchema.shape.inventory.parse(row.inventory);
    for (const itemId of used) {
      const index = inventory.indexOf(itemId);
      if (index !== -1) inventory.splice(index, 1);
    }
    return inventory;
  }
}
