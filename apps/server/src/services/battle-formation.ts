import { randomUUID } from 'node:crypto';
import { buildBattleContent } from '@rpg-chains/battle-engine';
import type { CampaignSnapshot } from '@rpg-chains/shared-types';
import type {
  ActiveBattle,
  BattleParticipant,
  BattleRegistry,
  FormingBattle,
  RunningBattle,
} from './battle-registry.js';

/** A refused battle mutation, as the route replies it. */
export interface Refusal {
  status: 403 | 404 | 409 | 422;
  error: string;
}

/** A room member about to fight, read from their Campaign Profile. */
export interface Candidate extends BattleParticipant {
  downed: boolean;
}

const refuse = (status: Refusal['status'], error: string): Refusal => ({ status, error });

/** Whether `candidate` may take a place in a forming battle. Synchronous: run it after every read. */
function admission(
  registry: BattleRegistry,
  candidate: Candidate,
  battle: { needsMaster: boolean; masterId: string },
): Refusal | null {
  // Downed players stay out until a campfire (spec §3.7).
  if (candidate.downed) return refuse(409, 'profile_downed');
  // In a battle with open questions the master judges; he cannot judge his own answer (spec §3.2).
  if (battle.needsMaster && candidate.userId === battle.masterId) {
    return refuse(409, 'master_cannot_fight');
  }
  if (registry.battleOf(candidate.profileId)) return refuse(409, 'already_in_battle');
  return null;
}

/**
 * Opens a formation on a `battle`/`boss` node of the room's version, with the opener as its first
 * participant (Fase 3 plan decision 9). At most one battle per node per room; the route checks
 * first that the node is unlocked and not yet won (Fase 5, `checkNodeEntry`).
 */
export function openFormation(
  registry: BattleRegistry,
  input: {
    roomId: string;
    campaignVersionId: string;
    snapshot: CampaignSnapshot;
    nodeId: string;
    opener: Candidate;
    /** The room master; fixed for the battle's life when it needs him (transfer is refused). */
    masterId: string;
  },
): FormingBattle | Refusal {
  const content = buildBattleContent(input.snapshot, input.nodeId);
  if ('ok' in content) return refuse(422, content.reason);
  if (content.questions.length === 0) return refuse(422, 'node_without_questions');
  const needsMaster = content.questions.some((q) => q.type === 'open');
  const node = input.snapshot.chapters
    .flatMap((ch) => ch.nodes)
    .find((n) => n.id === input.nodeId)!;
  if (node.type !== 'battle' && node.type !== 'boss') return refuse(422, 'not_a_battle_node');

  const refused = admission(registry, input.opener, { needsMaster, masterId: input.masterId });
  if (refused) return refused;
  if (registry.inRoom(input.roomId).some((b) => b.node.id === input.nodeId)) {
    return refuse(409, 'node_busy');
  }

  const { downed: _downed, ...opener } = input.opener;
  const battle: FormingBattle = {
    status: 'forming',
    starting: false,
    battleId: randomUUID(),
    roomId: input.roomId,
    node: {
      id: node.id,
      title: node.title,
      type: node.type,
      participantLimit: node.type === 'battle' ? node.participantLimit : null,
    },
    needsMaster,
    masterId: input.masterId,
    campaignVersionId: input.campaignVersionId,
    participants: [opener],
  };
  registry.add(battle);
  return battle;
}

/** The battle as a formation that still takes changes, or why not. */
export function forming(battle: ActiveBattle): FormingBattle | Refusal {
  if (battle.status !== 'forming') return refuse(409, 'battle_not_forming');
  if (battle.starting) return refuse(409, 'battle_starting');
  return battle;
}

export function joinFormation(
  registry: BattleRegistry,
  battle: FormingBattle,
  candidate: Candidate,
): Refusal | null {
  const refused = admission(registry, candidate, battle);
  if (refused) return refused;
  const limit = battle.node.participantLimit;
  if (limit !== null && battle.participants.length >= limit) {
    return refuse(409, 'participant_limit');
  }
  const { downed: _downed, ...participant } = candidate;
  battle.participants.push(participant);
  return null;
}

/** Leaves a formation; the last one out dissolves it. */
export function leaveFormation(
  registry: BattleRegistry,
  battle: FormingBattle,
  profileId: string,
): Refusal | null {
  const index = battle.participants.findIndex((p) => p.profileId === profileId);
  if (index < 0) return refuse(404, 'not_a_participant');
  battle.participants.splice(index, 1);
  if (battle.participants.length === 0) registry.remove(battle.battleId);
  return null;
}

/**
 * Who may cancel (Fase 3 plan decision 10, Fase 6 plan decision 8): a formation, the room master
 * or its last participant; a running battle, only the master — the players ask together instead
 * (`requestCancel`), so cancelling is never a way out of a defeat. Nothing of a battle is stored
 * before it ends, so cancelling just drops it.
 */
export function mayCancel(battle: ActiveBattle, userId: string, masterId: string): boolean {
  if (userId === masterId) return true;
  if (battle.status === 'running') return false;
  return battle.participants.length === 1 && battle.participants[0]!.userId === userId;
}

/**
 * A participant asks to cancel a running battle while the master is away (spec §7). The request
 * gathers the askers for `timeoutMs`; once every connected participant still in the battle has
 * asked, it is granted. Returns how many are still missing, or 0 when granted.
 */
export function requestCancel(
  battle: RunningBattle,
  userId: string,
  now: number,
  timeoutMs: number,
): number | Refusal {
  const inBattle = battle.state.combatants.filter((c) => !c.left);
  if (!inBattle.some((c) => c.userId === userId)) return refuse(404, 'not_a_participant');
  if (!battle.cancelRequest || battle.cancelRequest.expiresAt <= now) {
    battle.cancelRequest = { userIds: new Set(), expiresAt: now + timeoutMs };
  }
  battle.cancelRequest.userIds.add(userId);
  const asked = battle.cancelRequest.userIds;
  return inBattle.filter((c) => c.connected && !asked.has(c.userId)).length;
}

/**
 * Restarts a running battle (spec §7, Fase 6 plan decision 7): it is dropped without writing
 * anything — like a cancel — and a formation on the same node, with everyone who had not left,
 * takes its place at once. Synchronous, so nobody can take the node in between.
 */
export function restartBattle(registry: BattleRegistry, battle: RunningBattle): FormingBattle {
  const stillIn = new Set(battle.state.combatants.filter((c) => !c.left).map((c) => c.profileId));
  const next: FormingBattle = {
    status: 'forming',
    starting: false,
    battleId: randomUUID(),
    roomId: battle.roomId,
    node: battle.node,
    needsMaster: battle.needsMaster,
    masterId: battle.masterId,
    campaignVersionId: battle.campaignVersionId,
    participants: battle.participants.filter((p) => stillIn.has(p.profileId)),
  };
  battle.restartedAs = next.battleId;
  registry.remove(battle.battleId);
  registry.add(next);
  return next;
}
