import { describe, expect, it } from 'vitest';
import type { BattleContent, BattleState } from '@rpg-chains/shared-types';
import { buildBattleContent } from './battle-content.js';
import type { RosterEntry } from './create-battle.js';
import { evolvePublic } from './client-fold.js';
import { emptyBattle, replay } from './evolve.js';
import { effectiveMaxHp } from './evolve-units.js';
import { basicSnapshot, catalogSnapshot, kitSnapshot } from './fixtures/load.js';
import {
  assertValidState,
  robot,
  rosterFor,
  runBattle,
  skilledRobot,
  masterRobot,
  type Policy,
} from './fixtures/run-battle.js';
import { toPublicEvent, toPublicState } from './public-view.js';

/**
 * The property that closes Fase 3 (plan, "critério de pronto"): for any seed, a battle driven
 * through `decide` + `evolve` ends, every state on the way is sound, and folding the log from
 * scratch reproduces the live state exactly.
 */

const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);

function content(hard: boolean): BattleContent {
  const built = buildBattleContent(basicSnapshot(), 'n-boss');
  if ('ok' in built) throw new Error(built.reason);
  // Rewards with a common and a rare drop, so victories roll loot through the log (Fase 4 M2).
  built.villains = built.villains.map((v) => ({
    ...v,
    xpReward: 20,
    goldReward: 10,
    drops: [
      { itemId: 'it-tail', chance: 0.35 },
      { itemId: 'it-fang', chance: 0.03 },
    ],
  }));
  if (hard) {
    // Tough enough that some groups lose.
    built.villains = built.villains.map((v) => ({
      ...v,
      hp: 60,
      attacks: [
        { id: 'a-bite', name: 'Bite', baseDamage: 9, targetType: 'single', cooldownRounds: 0 },
        { id: 'a-swarm', name: 'Swarm', baseDamage: 5, targetType: 'area', cooldownRounds: 3 },
      ],
    }));
  }
  return built;
}

const roster = rosterFor(basicSnapshot(), ['cl-fencer', 'cl-brute', 'cl-fencer']);

/** Every effect type in play: the catalog classes against two training dummies (plan M6). */
function catalogContent(): BattleContent {
  const built = buildBattleContent(catalogSnapshot(), 'n-dummies');
  if ('ok' in built) throw new Error(built.reason);
  // Lighter dummies, so both endings happen.
  built.villains = built.villains.map((v) => ({ ...v, hp: 90 }));
  return built;
}
// The robot drops the third player at round 4: keep the healer out of that seat.
const catalogRoster = rosterFor(catalogSnapshot(), [
  'cl-cat-strike',
  'cl-cat-support',
  'cl-cat-buff',
  'cl-cat-control',
]);

function soundnessIssues(state: BattleState): string[] {
  const issues: string[] = [];
  for (const unit of [...state.combatants, ...state.enemies]) {
    const id = 'profileId' in unit ? unit.profileId : unit.instanceId;
    if (!Number.isInteger(unit.currentHp)) issues.push(`${id}: hp ${unit.currentHp}`);
    if (unit.currentHp < 0 || unit.currentHp > effectiveMaxHp(unit)) issues.push(`${id}: hp range`);
  }
  for (const c of state.combatants) {
    if (c.downed !== (c.currentHp === 0)) issues.push(`${c.profileId}: downed ⇔ 0 hp`);
    if (c.currentEnergy < 0 || c.currentEnergy > c.maxEnergy) issues.push(`${c.profileId}: energy`);
  }
  for (const e of state.enemies) {
    if (e.currentHp === 0 && state.enemyQueue.includes(e.instanceId)) {
      issues.push(`${e.instanceId}: defeated but queued`);
    }
  }
  // A battle rests waiting for someone, or paused for the master (spec §3.2).
  if (
    state.result === null &&
    !state.turn.stage.startsWith('awaiting') &&
    state.turn.stage !== 'paused'
  ) {
    issues.push(`at rest in stage ${state.turn.stage}`);
  }
  return issues;
}

/** The kit boss node — objective and open questions — or only its open question (plan M7). */
function masterContent(openOnly: boolean): BattleContent {
  const built = buildBattleContent(kitSnapshot(), 'n-kit-boss');
  if ('ok' in built) throw new Error(built.reason);
  if (openOnly) built.questions = built.questions.filter((q) => q.type === 'open');
  return built;
}
const kitRoster = rosterFor(kitSnapshot(), ['cl-guardian', 'cl-priest', 'cl-penitent']);

describe.each<[string, () => BattleContent, RosterEntry[], Policy]>([
  ['normal villains', () => content(false), roster, robot],
  ['hard villains', () => content(true), roster, robot],
  ['every effect type, skills in play', catalogContent, catalogRoster, skilledRobot],
  ['a master who judges, leaves and returns', () => masterContent(false), kitRoster, masterRobot],
  ['a master and only open questions (pauses)', () => masterContent(true), kitRoster, masterRobot],
])('replay property, %s', (_name, makeContent, group, policy) => {
  const battle = makeContent();
  const runs = SEEDS.map((seed) => ({ seed, run: runBattle(battle, group, seed, policy) }));

  it('every battle ends', () => {
    const unfinished = runs.filter(({ run }) => run.state.result === null).map(({ seed }) => seed);
    expect(unfinished).toEqual([]);
  });

  it('every state on the way is sound and matches the contract', () => {
    for (const { seed, run } of runs) {
      let token = -1;
      for (const state of run.states) {
        expect(soundnessIssues(state), `seed ${seed}`).toEqual([]);
        // Stage changes bump the token; presence commands (a player leaving) do not.
        expect(state.turnToken, `seed ${seed}`).toBeGreaterThanOrEqual(token);
        token = state.turnToken;
      }
      assertValidState(run.state);
    }
  });

  it('records every draw: the PRNG cursor never rewinds and keeps moving after the start', () => {
    for (const { seed, run } of runs) {
      const cursors = run.states.map((state) => state.secret.prng.cursor);
      cursors
        .slice(1)
        .forEach((cursor, i) => expect(cursor, `seed ${seed}`).toBeGreaterThanOrEqual(cursors[i]!));
      // Enemy targets and reshuffles draw after the opening, so a log that forgot them would stall here.
      expect(cursors.at(-1), `seed ${seed}`).toBeGreaterThan(cursors[0]!);
    }
  });

  it('folding the log from scratch reproduces the live state', () => {
    for (const { seed, run } of runs) {
      expect(replay(emptyBattle('b-test'), run.log), `seed ${seed}`).toEqual(run.state);
    }
  });

  it('a client folding public events from any sync point reaches the public state', () => {
    for (const { seed, run } of runs) {
      for (const from of [1, Math.floor(run.log.length / 2)]) {
        const sync = toPublicState(replay(emptyBattle('b-test'), run.log.slice(0, from)));
        const folded = run.log
          .slice(from)
          .map(toPublicEvent)
          .reduce((state, event) => (event ? evolvePublic(state, event) : state), sync);
        expect(folded, `seed ${seed} from ${from}`).toEqual(toPublicState(run.state));
      }
    }
  });

  it('the same seed replays the same battle', () => {
    for (const { seed, run } of runs.slice(0, 20)) {
      expect(runBattle(battle, group, seed, policy).log).toEqual(run.log);
    }
  });
});

describe('rewards in the log (Fase 4 plan decision 4)', () => {
  const runs = SEEDS.map((seed) => runBattle(content(false), roster, seed, robot));

  it('a victory grants rewards right before resolving; a defeat never does', () => {
    const hardRuns = SEEDS.map((seed) => runBattle(content(true), roster, seed, robot));
    for (const { log, state } of [...runs, ...hardRuns]) {
      const types = log.map((e) => e.type);
      const granted = types.indexOf('RewardsGranted');
      if (state.result === 'victory') {
        expect(types[granted + 1]).toBe('BattleResolved');
        expect(state.rewards.map((r) => r.profileId)).toEqual(
          state.combatants.filter((c) => !c.left).map((c) => c.profileId),
        );
      } else {
        expect(granted).toBe(-1);
        expect(state.rewards).toEqual([]);
      }
    }
  });

  it('drops vary by seed: some victories drop items, some drop none', () => {
    const dropped = runs.map(({ state }) => state.rewards.some((r) => r.items.length > 0));
    expect(dropped).toContain(true);
    expect(dropped).toContain(false);
  });
});

describe('the robot exercises both endings and every turn path', () => {
  it('normal villains are beaten, hard ones beat some groups', () => {
    const results = (hard: boolean) =>
      new Set(SEEDS.map((seed) => runBattle(content(hard), roster, seed, robot).state.result));
    expect(results(false)).toContain('victory');
    expect(results(true)).toEqual(new Set(['victory', 'defeat']));
  });

  it('with skills in play, every catalog skill is used and both endings happen', () => {
    const used = new Set<string>();
    const results = new Set<string | null>();
    for (const seed of SEEDS) {
      const run = runBattle(catalogContent(), catalogRoster, seed, skilledRobot);
      results.add(run.state.result);
      for (const event of run.log) {
        if (event.type === 'ActionTaken' && event.action.type === 'skill') {
          used.add(event.action.skillId);
        }
      }
    }
    const catalogSkills = catalogSnapshot().classes.flatMap((c) => c.skills.map((s) => s.id));
    expect([...used].sort()).toEqual(catalogSkills.sort());
    expect(results).toEqual(new Set(['victory', 'defeat']));
  });

  it('with a master, every open-question path happens: judgement both ways, ad hoc, fallback, pause', () => {
    const seen = new Set<string>();
    for (const openOnly of [false, true]) {
      for (const seed of SEEDS.slice(0, 50)) {
        for (const e of runBattle(masterContent(openOnly), kitRoster, seed, masterRobot).log) {
          if (e.type === 'AnswerJudged' && e.turnToken > 0) seen.add(`judged:${e.correct}`);
          if (e.type === 'SignalOpened')
            seen.add(
              `shown:${e.question.type}:${e.question.questionId === null ? 'ad-hoc' : 'node'}`,
            );
          if (e.type === 'BattlePaused' || e.type === 'OpenAnswerSubmitted') seen.add(e.type);
          if (e.type === 'MasterPresenceChanged') seen.add(`master:${e.online}`);
        }
      }
    }
    expect([...seen].sort()).toEqual(
      [
        'BattlePaused',
        'OpenAnswerSubmitted',
        'judged:false',
        'judged:true',
        'master:false',
        'master:true',
        'shown:objective:node',
        'shown:open:ad-hoc',
        'shown:open:node',
      ].sort(),
    );
  });

  it('wrong answers, timeouts and a player leaving all happen', () => {
    const seen = new Set<string>();
    for (const seed of SEEDS.slice(0, 50)) {
      for (const event of runBattle(content(true), roster, seed, robot).log) {
        if (event.type === 'TurnLost') seen.add(event.reason);
        if (event.type === 'PlayerLeft') seen.add('left');
      }
    }
    expect(seen).toEqual(
      new Set(['wrong_answer', 'signal_expired', 'answer_timeout', 'action_timeout', 'left']),
    );
  });
});
