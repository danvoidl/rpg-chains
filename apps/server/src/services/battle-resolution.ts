import type { CampaignProfile, PrismaClient } from '@prisma/client';
import {
  consumedItems,
  profileOutcomes,
  settleProfile,
  type SettledProfile,
} from '@rpg-chains/battle-engine';
import { CampaignProfileSchema } from '@rpg-chains/shared-types';
import type { BattleListener, BattleRegistry, RunningBattle } from './battle-registry.js';
import { lockRoom } from './room-lock.js';

/**
 * The end of a battle (Fase 3 plan decision 11, Fase 4 plan M3): once `BattleResolved` is
 * folded, each participant's profile is settled — HP, energy and downed flag as the battle ended,
 * used consumables out, and the victory's XP, gold and drops in (or a defeat's gold loss) — as a
 * delta on the profile read under the room lock, in one transaction, and only then does the battle leave the registry — so the room cannot roll forward
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
    const { state, content } = battle;
    const outcomes = profileOutcomes(state);
    const consumed = consumedItems(battle.log);
    const defeat = state.result === 'defeat';
    await this.prisma.$transaction(async (tx) => {
      await lockRoom(tx, battle.roomId);
      // Read under the lock: the settlement is a delta on the profile as it is now.
      const rows = await tx.campaignProfile.findMany({
        where: { id: { in: outcomes.map((o) => o.profileId) } },
      });
      for (const outcome of outcomes) {
        const row = rows.find((r) => r.id === outcome.profileId);
        const cls = row && content.classes.find((c) => c.id === row.classId);
        if (!row || !cls) continue;
        const settled = settleProfile(cls, toSettledProfile(row), {
          outcome,
          consumed: consumed.get(row.id) ?? [],
          reward: state.rewards.find((r) => r.profileId === row.id),
          defeat,
        });
        await tx.campaignProfile.update({
          where: { id: row.id },
          data: {
            level: settled.level,
            xp: settled.xp,
            availablePoints: settled.availablePoints,
            currentHp: settled.currentHp,
            currentEnergy: settled.currentEnergy,
            downed: settled.downed,
            gold: settled.gold,
            inventory: settled.inventory,
          },
        });
      }
    });
  }
}

/** A profile row as the settlement reads it. */
function toSettledProfile(row: CampaignProfile): SettledProfile {
  return {
    level: row.level,
    xp: row.xp,
    availablePoints: row.availablePoints,
    attributes: {
      strength: row.strength,
      dexterity: row.dexterity,
      intelligence: row.intelligence,
    },
    currentHp: row.currentHp,
    currentEnergy: row.currentEnergy,
    downed: row.downed,
    gold: row.gold,
    inventory: CampaignProfileSchema.shape.inventory.parse(row.inventory),
  };
}
