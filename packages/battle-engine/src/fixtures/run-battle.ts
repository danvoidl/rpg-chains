import {
  BattleStateSchema,
  type BattleContent,
  type BattleEvent,
  type BattleState,
  type CampaignSnapshot,
  type Combatant,
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
  const active = state.combatants.filter((c) => !c.downed && !c.left && c.connected);

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

/**
 * The robot, plus skills (Fase 3 plan M6): when it may act, it tries its skills in an order that
 * shifts every turn — each with every target — and attacks only if none is accepted. Validity is
 * asked of `decide` itself, so the policy never sends a command the engine refuses.
 */
export const skilledRobot: Policy = (state, content) => {
  const { turn, turnToken } = state;
  if (turn.stage !== 'awaiting_action') return robot(state, content);
  const actor = state.combatants.find((c) => c.profileId === turn.profileId)!;
  // Shifted by the high bits of a token hash: plain counters line up with who acts when (and the
  // action-stage token is always even).
  const shift = (Math.imul(turnToken, 2654435761) >>> 0) >>> 16;
  const skills = actor.skills.map((_, i) => actor.skills[(i + shift) % actor.skills.length]!);
  const targets = [
    undefined,
    ...state.combatants.map((c) => c.profileId),
    ...state.enemies.map((e) => e.instanceId),
  ];
  for (const skill of skills) {
    for (const targetId of targets) {
      const command: Command = {
        type: 'ChooseAction',
        turnToken,
        profileId: actor.profileId,
        action: { type: 'skill', skillId: skill.id, ...(targetId ? { targetId } : {}) },
      };
      if (decide(state, command, content).ok) return command;
    }
  }
  return robot(state, content);
};

/**
 * A master for battles with open questions (Fase 3 plan M7), on top of the skilled robot: he
 * shows a drawn objective, the node's open question or one written on the spot, fails one open
 * answer in four, leaves during round 3's signal and comes back from round 5, or as soon as the
 * battle pauses.
 */
export const masterRobot: Policy = (state, content) => {
  const { turn, turnToken, round, masterOnline } = state;
  if (turn.stage === 'paused' || (!masterOnline && round >= 5)) {
    return { type: 'MasterPresenceChanged', online: true };
  }
  // He leaves mid-signal, so the next group turn is the one that falls back or pauses.
  if (masterOnline && round === 3 && turn.stage === 'awaiting_signal') {
    return { type: 'MasterPresenceChanged', online: false };
  }
  if (turn.stage === 'awaiting_question') {
    const open = content.questions.find((q) => q.type === 'open')!;
    const hasObjective = content.questions.some((q) => q.type === 'objective');
    const pick = turnToken % 3;
    const question =
      pick === 0 && hasObjective
        ? ({ draw: 'objective' } as const)
        : pick === 1
          ? { questionId: open.id }
          : { prompt: `Pergunta improvisada ${turnToken}` };
    return { type: 'PresentQuestion', turnToken, question };
  }
  if (turn.stage === 'awaiting_answer' && turn.question.type === 'open') {
    return { type: 'SubmitOpenAnswer', turnToken, profileId: turn.profileId, text: 'resposta' };
  }
  if (turn.stage === 'awaiting_judgement') {
    return { type: 'JudgeOpenAnswer', turnToken, approved: turnToken % 4 !== 0 };
  }
  return skilledRobot(state, content);
};

/** Who drops this round, by seat. */
const dropperOf = (present: readonly Combatant[], round: number) => present[round % present.length];

/**
 * The robot with flaky connections (Fase 6 plan decision 11): one player drops every third round
 * and everyone comes back the round after; at round 6 the whole group drops in order, so the
 * battle pauses until the first of them returns; and whoever is answering or acting drops now and
 * then and does not come back in time (the turn times out; they return with the others). Its
 * choices still derive only from the state.
 */
export const connectionRobot: Policy = (state, content) => {
  const { turn, turnToken, round } = state;
  const present = state.combatants.filter((c) => !c.left);
  const away = present.filter((c) => !c.connected);
  const online = present.filter((c) => c.connected);

  if (turn.stage === 'paused') {
    return { type: 'PlayerReconnected', profileId: away[0]!.profileId };
  }
  if (turn.stage === 'awaiting_signal') {
    if (round % 3 === 1 && away.length > 0) {
      return { type: 'PlayerReconnected', profileId: away[0]!.profileId };
    }
    // Dropping in seat order keeps the ones away a prefix; after the pause the first seat is back,
    // which breaks the prefix and lets the turn go on.
    const awayIsPrefix = away.every((c, i) => c === present[i]);
    if (round === 6 && awayIsPrefix && online.length > 0) {
      return { type: 'PlayerDisconnected', profileId: online[0]!.profileId };
    }
    // A lone drop never empties the battle: someone who can act stays.
    const canStillAct = online.filter((c) => !c.downed && c !== dropperOf(present, round));
    const dropper = dropperOf(present, round);
    if (round % 3 === 0 && round !== 6 && dropper?.connected && canStillAct.length > 0) {
      return { type: 'PlayerDisconnected', profileId: dropper.profileId };
    }
  }
  if (turn.stage === 'awaiting_answer' || turn.stage === 'awaiting_action') {
    const actor = state.combatants.find((c) => c.profileId === turn.profileId)!;
    if (!actor.connected) {
      const timeout = turn.stage === 'awaiting_answer' ? 'AnswerTimedOut' : 'ActionTimedOut';
      return { type: timeout, turnToken };
    }
    if (turnToken % 7 === 0) return { type: 'PlayerDisconnected', profileId: actor.profileId };
  }
  return robot(state, content);
};
