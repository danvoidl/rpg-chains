import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  ActiveBattle,
  Appended,
  BattleListener,
  BattleRegistry,
  RunningBattle,
} from './battle-registry.js';

/**
 * The battle journal (spec §3.7, Fase 6 plan decision 6): every accepted batch of a running battle
 * is copied to the database after `apply` — never inside it, so the per-battle lock stays
 * synchronous — in order per battle. A crash loses at most the batches still in flight. The
 * write-back deletes the journal in its own transaction (`BattleResolution`), and a cancelled
 * battle's journal goes when it leaves the registry; what is left on boot is restored.
 *
 * Subscribe it before `BattleResolution`: the write-back waits on `idle()`, which must already
 * hold the batch that resolved the battle.
 */
export class BattleJournal implements BattleListener {
  private readonly queues = new Map<string, Promise<void>>();

  constructor(
    registry: BattleRegistry,
    private readonly prisma: PrismaClient,
    private readonly onError: (error: unknown) => void,
  ) {
    registry.subscribe(this);
  }

  appended(battle: RunningBattle, { fromSeq, events }: Appended): void {
    const entry = { fromSeq, events: events as unknown as Prisma.InputJsonValue };
    this.enqueue(battle.battleId, async () => {
      if (fromSeq > 1) {
        await this.prisma.battleJournalEntry.create({
          data: { battleId: battle.battleId, ...entry },
        });
        return;
      }
      await this.prisma.battleJournal.create({
        data: {
          battleId: battle.battleId,
          roomId: battle.roomId,
          campaignVersionId: battle.campaignVersionId,
          node: battle.node as unknown as Prisma.InputJsonValue,
          needsMaster: battle.needsMaster,
          masterId: battle.masterId,
          participants: battle.participants as unknown as Prisma.InputJsonValue,
          turnTimers: battle.turnTimers as Prisma.InputJsonValue,
          entries: { create: entry },
        },
      });
    });
  }

  /** A cancelled battle leaves no journal; a resolved one already lost it in the write-back. */
  removed(battle: ActiveBattle): void {
    if (battle.status !== 'running') return;
    this.enqueue(battle.battleId, async () => {
      await this.prisma.battleJournal.deleteMany({ where: { battleId: battle.battleId } });
    });
  }

  /** Resolves once the battle's journal writes queued so far are done. */
  idle(battleId: string): Promise<void> {
    return this.queues.get(battleId) ?? Promise.resolve();
  }

  /** Resolves once every queued journal write is done (graceful shutdown, tests). */
  async settled(): Promise<void> {
    await Promise.all(this.queues.values());
  }

  private enqueue(battleId: string, write: () => Promise<void>): void {
    const queued = (this.queues.get(battleId) ?? Promise.resolve())
      .then(write)
      .catch(this.onError)
      .finally(() => {
        if (this.queues.get(battleId) === queued) this.queues.delete(battleId);
      });
    this.queues.set(battleId, queued);
  }
}
