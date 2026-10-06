import { randomUUID } from 'node:crypto';
import { buildBattleContent } from '@rpg-chains/battle-engine';
import type { CampaignSnapshot } from '@rpg-chains/shared-types';
import type {
  ActiveBattle,
  BattleParticipant,
  BattleRegistry,
  FormingBattle,
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
function admission(registry: BattleRegistry, candidate: Candidate): Refusal | null {
  // Downed players stay out until a campfire (spec §3.7).
  if (candidate.downed) return refuse(409, 'profile_downed');
  if (registry.battleOf(candidate.profileId)) return refuse(409, 'already_in_battle');
  return null;
}

/**
 * Opens a formation on a `battle`/`boss` node of the room's version, with the opener as its first
 * participant (Fase 3 plan decision 9). At most one battle per node per room; the unlock gate of
 * the chapter graph arrives in Fase 5.
 */
export function openFormation(
  registry: BattleRegistry,
  input: {
    roomId: string;
    campaignVersionId: string;
    snapshot: CampaignSnapshot;
    nodeId: string;
    opener: Candidate;
  },
): FormingBattle | Refusal {
  const content = buildBattleContent(input.snapshot, input.nodeId);
  if ('ok' in content) return refuse(422, content.reason);
  if (content.questions.length === 0) return refuse(422, 'node_without_questions');
  const needsMaster = content.questions.some((q) => q.type === 'open');
  // The master's judgement arrives in Fase 3 plan M7; until then an open question would stall.
  if (needsMaster) return refuse(422, 'open_questions_unsupported');
  const node = input.snapshot.chapters
    .flatMap((ch) => ch.nodes)
    .find((n) => n.id === input.nodeId)!;
  if (node.type !== 'battle' && node.type !== 'boss') return refuse(422, 'not_a_battle_node');

  const refused = admission(registry, input.opener);
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
  const refused = admission(registry, candidate);
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
 * Who may cancel (Fase 3 plan decision 10): the room master, or the last participant still in it.
 * Nothing of a battle is stored before it ends, so cancelling just drops it from memory.
 */
export function mayCancel(battle: ActiveBattle, userId: string, masterId: string): boolean {
  if (userId === masterId) return true;
  const remaining =
    battle.status === 'running'
      ? battle.state.combatants.filter((c) => !c.left).map((c) => c.userId)
      : battle.participants.map((p) => p.userId);
  return remaining.length === 1 && remaining[0] === userId;
}
