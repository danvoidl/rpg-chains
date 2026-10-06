import type { PrismaClient } from '@prisma/client';
import { profileOutcomes } from '@rpg-chains/battle-engine';
import type { BattleListener, BattleRegistry, RunningBattle } from './battle-registry.js';
import { lockRoom } from './room-lock.js';

/**
 * The end of a battle (Fase 3 plan decision 11): once `BattleResolved` is folded, each
 * participant's HP, energy and downed flag go back to their profile in one transaction under the
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
    await this.prisma.$transaction(async (tx) => {
      await lockRoom(tx, battle.roomId);
      for (const { profileId, ...resources } of outcomes) {
        await tx.campaignProfile.updateMany({ where: { id: profileId }, data: resources });
      }
    });
  }
}
