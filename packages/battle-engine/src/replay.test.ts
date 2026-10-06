import { describe, expect, it } from 'vitest';
import type { BattleContent, BattleState } from '@rpg-chains/shared-types';
import { buildBattleContent } from './battle-content.js';
import { evolvePublic } from './client-fold.js';
import { emptyBattle, replay } from './evolve.js';
import { effectiveMaxHp } from './evolve-units.js';
import { basicSnapshot } from './fixtures/load.js';
import { assertValidState, robot, rosterFor, runBattle } from './fixtures/run-battle.js';
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
  if (state.result === null && !state.turn.stage.startsWith('awaiting')) {
    issues.push(`at rest in stage ${state.turn.stage}`);
  }
  return issues;
}

describe.each([
  ['normal', false],
  ['hard', true],
])('replay property, %s villains', (_name, hard) => {
  const battle = content(hard);
  const runs = SEEDS.map((seed) => ({ seed, run: runBattle(battle, roster, seed, robot) }));

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
      expect(runBattle(battle, roster, seed, robot).log).toEqual(run.log);
    }
  });
});

describe('the robot exercises both endings and every turn path', () => {
  it('normal villains are beaten, hard ones beat some groups', () => {
    const results = (hard: boolean) =>
      new Set(SEEDS.map((seed) => runBattle(content(hard), roster, seed, robot).state.result));
    expect(results(false)).toContain('victory');
    expect(results(true)).toEqual(new Set(['victory', 'defeat']));
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
