import type { PrismaClient } from '@prisma/client';
import { buildBattleContent, createBattle } from '@rpg-chains/battle-engine';
import { CampaignSnapshotSchema } from '@rpg-chains/shared-types';
import { toRosterEntry } from '../mappers/roster.js';
import type { Refusal } from './battle-formation.js';
import type { BattleRegistry, FormingBattle, RunningBattle } from './battle-registry.js';

export interface BattleStartDeps {
  prisma: PrismaClient;
  registry: BattleRegistry;
  /** Draws the battle seed; the only randomness the server feeds the engine. */
  seed: () => number;
  /** Whether the room master is online in the lobby (spec §3.2). */
  masterOnline: (roomId: string, masterId: string) => boolean;
}

/** Engine rejections that are about the content rather than the roster. */
const CONTENT_ERRORS = new Set([
  'node_without_questions',
  'unknown_villain',
  'unknown_class',
  'unknown_weapon',
]);

/**
 * Starts a formation (Fase 3 plan decision 12): reads every participant's profile fresh, cuts the
 * battle content from the version it was formed on, and lets `createBattle` validate and open it.
 * The formation is locked (`starting`) across the reads, so nobody joins or leaves meanwhile.
 */
export async function startBattle(
  deps: BattleStartDeps,
  battle: FormingBattle,
): Promise<RunningBattle | Refusal> {
  battle.starting = true;
  try {
    const [version, profiles, room] = await Promise.all([
      deps.prisma.campaignVersion.findUniqueOrThrow({ where: { id: battle.campaignVersionId } }),
      deps.prisma.campaignProfile.findMany({
        where: { id: { in: battle.participants.map((p) => p.profileId) } },
        include: { user: { select: { name: true } } },
      }),
      deps.prisma.room.findUniqueOrThrow({
        where: { id: battle.roomId },
        select: { masterId: true },
      }),
    ]);

    // Initiative ties and the target order follow the formation order, not the query's.
    const roster = battle.participants.flatMap((p) => {
      const profile = profiles.find((row) => row.id === p.profileId);
      return profile ? [toRosterEntry(profile)] : [];
    });
    if (roster.length !== battle.participants.length) {
      return { status: 409, error: 'roster_changed' };
    }
    const masterOnline = deps.masterOnline(battle.roomId, room.masterId);
    // Only the master judges open questions: such a battle starts with him there (spec §3.2).
    if (battle.needsMaster && !masterOnline) return { status: 409, error: 'master_offline' };

    const content = buildBattleContent(
      CampaignSnapshotSchema.parse(version.snapshot),
      battle.node.id,
    );
    if ('ok' in content) return { status: 422, error: content.reason };
    const started = createBattle(content, roster, {
      battleId: battle.battleId,
      seed: deps.seed(),
      masterOnline,
    });
    if (!started.ok) {
      return { status: CONTENT_ERRORS.has(started.reason) ? 422 : 409, error: started.reason };
    }
    return deps.registry.run(battle, content, started.events);
  } finally {
    battle.starting = false;
  }
}
