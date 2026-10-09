import type { CampaignProfile, Prisma, PrismaClient } from '@prisma/client';
import {
  consumedItems,
  profileOutcomes,
  settleProfile,
  type SettledProfile,
} from '@rpg-chains/battle-engine';
import { recordNodeCleared, rollbackDefeat } from '@rpg-chains/campaign-rules';
import { CampaignProfileSchema, CampaignSnapshotSchema } from '@rpg-chains/shared-types';
import type { BattleJournal } from './battle-journal.js';
import type { BattleListener, BattleRegistry, RunningBattle } from './battle-registry.js';
import { changeProgress } from './room-progress.js';
import { lockRoom } from './room-lock.js';

/**
 * The end of a battle (Fase 3 plan decision 11, Fase 4 plan M3, Fase 5 plan decision 5): once
 * `BattleResolved` is folded, each participant's profile is settled — HP, energy and downed flag
 * as the battle ended, used consumables out, and the victory's XP, gold and drops in (or a
 * defeat's gold loss and the return to the campfire) — as a delta on the profile read under the
 * room lock; and the room's progress records it — a victory clears the node, a defeat undoes what
 * the defeated cleared since the chapter's campfire. All in one transaction, and only then does
 * the battle leave the registry — so the room cannot roll forward to a newer version, or close,
 * before the profiles and the progress are written. The battle's journal is deleted in the same
 * transaction (Fase 6 plan decision 6): a journal found on boot is a battle not yet written back.
 */
export class BattleResolution implements BattleListener {
  private readonly writing = new Map<string, Promise<void>>();

  constructor(
    private readonly registry: BattleRegistry,
    private readonly journal: BattleJournal,
    private readonly prisma: PrismaClient,
    private readonly onResolved: (roomId: string) => void,
    private readonly onError: (error: unknown) => void,
  ) {
    registry.subscribe(this);
  }

  /** Also called on boot for a journaled battle that had resolved but was not written back. */
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
    // The batch that resolved the battle is journaled first, so the delete below finds every row.
    await this.journal.idle(battle.battleId);
    await this.prisma.$transaction(async (tx) => {
      await lockRoom(tx, battle.roomId);
      await tx.battleJournal.deleteMany({ where: { battleId: battle.battleId } });
      // Read under the lock: the settlement is a delta on the profile as it is now.
      const rows = await tx.campaignProfile.findMany({
        where: { id: { in: outcomes.map((o) => o.profileId) } },
      });
      await this.recordProgress(
        tx,
        battle,
        outcomes.map((o) => o.profileId),
      );
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

  /**
   * The battle's node in the room's progress, under the lock already held. The battle's version is
   * the room's: a room never rolls forward while a battle is active.
   */
  private async recordProgress(
    tx: Prisma.TransactionClient,
    battle: RunningBattle,
    profileIds: string[],
  ): Promise<void> {
    const [room, version] = await Promise.all([
      tx.room.findUniqueOrThrow({
        where: { id: battle.roomId },
        select: { id: true, status: true },
      }),
      tx.campaignVersion.findUniqueOrThrow({ where: { id: battle.campaignVersionId } }),
    ]);
    const snapshot = CampaignSnapshotSchema.parse(version.snapshot);
    const nodeId = battle.node.id;
    await changeProgress(tx, room, snapshot, (progress) =>
      battle.state.result === 'victory'
        ? recordNodeCleared(snapshot, progress, nodeId, profileIds)
        : rollbackDefeat(snapshot, progress, nodeId, profileIds),
    );
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
