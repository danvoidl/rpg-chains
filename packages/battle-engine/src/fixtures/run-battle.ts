import {
  BattleStateSchema,
  type BattleContent,
  type BattleEvent,
  type BattleState,
  type CampaignSnapshot,
  type Command,
} from '@rpg-chains/shared-types';
import { createBattle, type RosterEntry } from '../create-battle.js';
import { decide } from '../decide.js';
import { deriveStats } from '../derive-stats.js';
import { emptyBattle, evolve, replay } from '../evolve.js';

const NO_POINTS = { strength: 0, dexterity: 0, intelligence: 0 };

/** Fresh level-1 characters of the given classes, ids `p1`, `p2`, … (Fase 3 plan M2 helper). */
export function rosterFor(snapshot: CampaignSnapshot, classIds: readonly string[]): RosterEntry[] {
  return classIds.map((classId, index) => {
    const cls = snapshot.classes.find((c) => c.id === classId)!;
    const { maxHp, maxEnergy } = deriveStats(cls, 1, NO_POINTS);
    return {
      profileId: `p${index + 1}`,
      userId: `u${index + 1}`,
      name: `Player ${index + 1}`,
      classId,
      level: 1,
      attributes: NO_POINTS,
      currentHp: maxHp,
      currentEnergy: maxEnergy,
      downed: false,
      equipment: { weapon: cls.baseWeaponId },
      inventory: [],
    };
  });
}

/** Chooses the next command for a battle at rest, or null to stop. */
export type Policy = (state: BattleState, content: BattleContent) => Command | null;

export interface BattleRun {
  state: BattleState;
  log: BattleEvent[];
  /** State after each accepted command, for invariant checks. */
  states: BattleState[];
}

/**
 * Starts a battle and drives it with `policy` through `decide` + `evolve`, exactly as the server
 * will. Throws if the policy sends a command the engine rejects — policies send valid ones.
 */
export function runBattle(
  content: BattleContent,
  roster: readonly RosterEntry[],
  seed: number,
  policy: Policy,
  maxSteps = 1000,
): BattleRun {
  const started = createBattle(content, roster, { battleId: 'b-test', seed, masterOnline: true });
  if (!started.ok) throw new Error(`createBattle rejected: ${started.reason}`);
  let state = replay(emptyBattle('b-test'), started.events);
  const log = [...started.events];
  const states = [state];

  for (let step = 0; step < maxSteps && state.result === null; step++) {
    const command = policy(state, content);
    if (!command) break;
    const result = decide(state, command, content);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.reason}`);
    state = result.events.reduce(evolve, state);
    log.push(...result.events);
    states.push(state);
  }
  return { state, log, states };
}

/** Parses the state, so every reachable state is proven to match the shared contract. */
export function assertValidState(state: BattleState): void {
  BattleStateSchema.parse(state);
}

/**
 * A deterministic stand-in for a group of players: taps in rotation, mostly answers right, now and
 * then answers wrong, lets a timer run out, and one player drops at round 4. Its choices derive
 * only from the state, so a run is a pure function of (content, roster, seed).
 */
export const robot: Policy = (state, content) => {
  const { turn, turnToken, round } = state;
  const active = state.combatants.filter((c) => !c.downed && !c.left);

  if (turn.stage === 'awaiting_signal') {
    const leaver = state.combatants[2];
    if (round === 4 && leaver && !leaver.left && !leaver.downed) {
      return { type: 'PlayerLeft', profileId: leaver.profileId };
    }
    if (turnToken % 9 === 0) return { type: 'SignalExpired', turnToken };
    const rested = active.filter((c) => !c.blockedFromSignal);
    const pool = rested.length > 0 ? rested : active;
    return { type: 'TapSignal', turnToken, profileId: pool[round % pool.length]!.profileId };
  }

  if (turn.stage === 'awaiting_answer' && turn.question.type === 'objective') {
    if (turnToken % 13 === 0) return { type: 'AnswerTimedOut', turnToken };
    const question = content.questions.find((q) => q.id === turn.question.questionId)!;
    if (question.type !== 'objective') return null;
    const index =
      turnToken % 4 === 0
        ? (question.correctIndex + 1) % question.options.length
        : question.correctIndex;
    return { type: 'SubmitObjectiveAnswer', turnToken, profileId: turn.profileId, index };
  }

  if (turn.stage === 'awaiting_action') {
    if (turnToken % 17 === 0) return { type: 'ActionTimedOut', turnToken };
    const alive = state.enemies.filter((e) => e.currentHp > 0);
    const target = alive[round % alive.length]!;
    return {
      type: 'ChooseAction',
      turnToken,
      profileId: turn.profileId,
      action: { type: 'attack', targetInstanceId: target.instanceId },
    };
  }

  return null;
};
