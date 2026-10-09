import { describe, expect, it } from 'vitest';
import {
  BattleStateSchema,
  type BattleContent,
  type BattleEvent,
  type BattleState,
  type Villain,
} from '@rpg-chains/shared-types';
import { buildBattleContent } from './battle-content.js';
import { createBattle } from './create-battle.js';
import { decide } from './decide.js';
import { emptyBattle, replay } from './evolve.js';
import {
  attackWith,
  basicContent,
  fencers,
  passTurn,
  startWith,
  step,
  withVillains,
} from './fixtures/battle-setup.js';
import { kitSnapshot } from './fixtures/load.js';
import openSignalFixture from './fixtures/open-signal.json';
import { rosterFor } from './fixtures/run-battle.js';

/**
 * Connections as facts in the log (Fase 6 plan decisions 1 and 3, spec §3.3, §3.7, §7): a dropped
 * player stays in the battle and stays a target but cannot tap; whoever the turn waits on keeps
 * the stage's clock; with nobody who could act connected, the battle pauses until one returns.
 */

const types = (events: readonly BattleEvent[]) => events.map((e) => e.type);
const drop = (profileId: string) => ({ type: 'PlayerDisconnected', profileId }) as const;
const back = (profileId: string) => ({ type: 'PlayerReconnected', profileId }) as const;
const tap = (s: BattleState, profileId: string) =>
  ({ type: 'TapSignal', turnToken: s.turnToken, profileId }) as const;

/** A villain whose only attack hits the whole group, so a dropped player is visibly hit. */
const swarm: Villain = {
  id: 'v-swarm',
  name: 'Swarm',
  hp: 500,
  attributes: { strength: 0, dexterity: 0, intelligence: 0, defense: 0 },
  attacks: [{ id: 'a-all', name: 'All', baseDamage: 5, targetType: 'area', cooldownRounds: 0 }],
};

describe('a dropped player (spec §3.3, §7)', () => {
  it('cannot tap, and the signal goes on for the others', () => {
    const content = basicContent();
    const { state } = startWith(content, fencers(2), 'group');
    const away = step(state, drop('p1'), content);
    expect(types(away.events)).toEqual(['PlayerDisconnected']);
    // A drop off-turn does not touch the stage, so the running clock keeps its token.
    expect(away.state.turnToken).toBe(state.turnToken);
    expect(decide(away.state, tap(away.state, 'p1'), content)).toEqual({
      ok: false,
      reason: 'player_disconnected',
    });
    expect(step(away.state, tap(away.state, 'p2'), content).state.turn.stage).toBe(
      'awaiting_answer',
    );
  });

  it('the rotation fallback counts only who is connected (spec §3.3)', () => {
    const content = basicContent();
    const { state } = startWith(content, fencers(2), 'group');
    const enemy = state.enemies[0]!.instanceId;
    // p1 acted, so the next signal is p2's alone…
    const acted = attackWith(state, content, 'p1', enemy).state;
    expect(acted.turn.stage).toBe('awaiting_signal');
    expect(decide(acted, tap(acted, 'p1'), content)).toEqual({
      ok: false,
      reason: 'blocked_this_round',
    });
    // …until p2 drops: then the block is ignored for whoever is still there.
    const away = step(acted, drop('p2'), content).state;
    expect(decide(away, tap(away, 'p1'), content).ok).toBe(true);
  });

  it('stays a target: an area attack hits them too', () => {
    const content = basicContent('n-battle', (c) => withVillains(c, [swarm], ['v-swarm']));
    const { state } = startWith(content, fencers(2), 'group');
    const away = step(state, drop('p1'), content).state;
    const { events } = passTurn(away, content);
    const acted = events.find((e) => e.type === 'EnemyActed');
    expect(acted).toMatchObject({ targetIds: ['p1', 'p2'] });
  });

  it('whose turn it was keeps the clock: back in time they answer, otherwise it times out', () => {
    const content = basicContent();
    const { state } = startWith(content, fencers(2), 'group');
    const tapped = step(state, tap(state, 'p1'), content).state;
    const away = step(tapped, drop('p1'), content).state;
    expect(away.turn).toMatchObject({ stage: 'awaiting_answer', profileId: 'p1' });
    expect(away.turnToken).toBe(tapped.turnToken);

    const turn = away.turn as Extract<BattleState['turn'], { stage: 'awaiting_answer' }>;
    const answer = {
      type: 'SubmitObjectiveAnswer',
      turnToken: away.turnToken,
      profileId: 'p1',
      index: 0,
    } as const;
    expect(decide(away, answer, content)).toEqual({ ok: false, reason: 'player_disconnected' });
    expect(turn.question.type).toBe('objective');

    const returned = step(away, back('p1'), content);
    expect(types(returned.events)).toEqual(['PlayerReconnected']);
    expect(decide(returned.state, answer, content).ok).toBe(true);

    const timedOut = step(away, { type: 'AnswerTimedOut', turnToken: away.turnToken }, content);
    expect(types(timedOut.events).slice(0, 2)).toEqual(['TurnLost', 'RoundEnded']);
  });

  it('refuses a drop or a return that changes nothing, and a return after leaving', () => {
    const content = basicContent();
    const { state } = startWith(content, fencers(2), 'group');
    expect(decide(state, back('p1'), content)).toEqual({ ok: false, reason: 'unchanged' });
    const away = step(state, drop('p1'), content).state;
    expect(decide(away, drop('p1'), content)).toEqual({ ok: false, reason: 'unchanged' });
    const gone = step(away, { type: 'PlayerLeft', profileId: 'p1' }, content).state;
    expect(decide(gone, back('p1'), content)).toEqual({ ok: false, reason: 'player_left' });
    expect(decide(gone, drop('p1'), content)).toEqual({ ok: false, reason: 'player_left' });
    expect(decide(gone, back('p9'), content)).toEqual({ ok: false, reason: 'unknown_player' });
  });
});

describe('the whole group dropped (spec §3.7, plan decision 3)', () => {
  it('pauses at once on the signal: no clock, no enemy; the first back reopens the signal', () => {
    const content = basicContent();
    const { state } = startWith(content, fencers(2), 'group');
    const one = step(state, drop('p1'), content).state;
    const both = step(one, drop('p2'), content);
    expect(types(both.events)).toEqual(['PlayerDisconnected', 'BattlePaused']);
    expect(both.state.turn).toEqual({ stage: 'paused', reason: 'all_disconnected' });
    expect(
      decide(both.state, { type: 'SignalExpired', turnToken: one.turnToken }, content),
    ).toEqual({ ok: false, reason: 'stale_turn_token' });

    const resumed = step(both.state, back('p2'), content);
    expect(types(resumed.events)).toContain('SignalOpened');
    expect(types(resumed.events)).not.toContain('EnemyActed');
    expect(resumed.state.turn.stage).toBe('awaiting_signal');
    expect(resumed.state.round).toBe(state.round);
  });

  it('a turn waiting on one player runs out first; the pause comes when the next turn opens', () => {
    const content = basicContent();
    const { state } = startWith(content, fencers(2), 'group');
    const tapped = step(state, tap(state, 'p1'), content).state;
    const away = step(step(tapped, drop('p2'), content).state, drop('p1'), content).state;
    expect(away.turn.stage).toBe('awaiting_answer');

    const { events, state: after } = step(
      away,
      { type: 'AnswerTimedOut', turnToken: away.turnToken },
      content,
    );
    // At most one enemy acts after the group is gone.
    expect(types(events).filter((t) => t === 'EnemyActed')).toHaveLength(1);
    expect(after.turn).toEqual({ stage: 'paused', reason: 'all_disconnected' });
  });

  it('a downed player watching does not keep the battle running', () => {
    const content = basicContent();
    // p1 and p2 can act; p3 is downed and connected; p4 left.
    const state = BattleStateSchema.parse(structuredClone(openSignalFixture));
    const away = step(step(state, drop('p1'), content).state, drop('p2'), content).state;
    expect(away.turn).toEqual({ stage: 'paused', reason: 'all_disconnected' });
    // Coming back downed does not resume either: nobody could tap.
    const stillPaused = step(away, drop('p3'), content).state;
    expect(step(stillPaused, back('p3'), content).state.turn.stage).toBe('paused');
  });

  it('the last one who could act leaving for good pauses; everyone gone is a defeat', () => {
    const content = basicContent();
    const { state } = startWith(content, fencers(2), 'group');
    const away = step(state, drop('p1'), content).state;
    const left = step(away, { type: 'PlayerLeft', profileId: 'p2' }, content);
    expect(left.state.turn).toEqual({ stage: 'paused', reason: 'all_disconnected' });
    const gone = step(left.state, { type: 'PlayerLeft', profileId: 'p1' }, content);
    expect(gone.state.result).toBe('defeat');
  });
});

describe('the group and the master away together (spec §3.2, §3.7)', () => {
  function openOnly(): BattleContent {
    const built = buildBattleContent(kitSnapshot(), 'n-kit-boss');
    if ('ok' in built) throw new Error(built.reason);
    built.questions = built.questions.filter((q) => q.type === 'open');
    return built;
  }

  function start(content: BattleContent): BattleState {
    const roster = rosterFor(kitSnapshot(), ['cl-guardian']);
    for (let seed = 1; seed < 500; seed++) {
      const result = createBattle(content, roster, { battleId: 'b1', seed, masterOnline: true });
      if (!result.ok) throw new Error(result.reason);
      const started = result.events[0]!;
      if (started.type === 'BattleStarted' && started.initiative === 'group') {
        return replay(emptyBattle('b1'), result.events);
      }
    }
    throw new Error('no group-first seed');
  }

  it('the master coming back does not resume a battle paused for the group, and vice versa', () => {
    const content = openOnly();
    const s = start(content);
    expect(s.turn.stage).toBe('awaiting_question');
    const paused = step(s, drop('p1'), content).state;
    expect(paused.turn).toEqual({ stage: 'paused', reason: 'all_disconnected' });

    const masterGone = step(paused, { type: 'MasterPresenceChanged', online: false }, content);
    expect(types(masterGone.events)).toEqual(['MasterPresenceChanged']);
    const masterBack = step(
      masterGone.state,
      { type: 'MasterPresenceChanged', online: true },
      content,
    );
    expect(masterBack.state.turn).toEqual({ stage: 'paused', reason: 'all_disconnected' });

    // The master away and the player back: it now waits for the master.
    const playerBack = step(masterGone.state, back('p1'), content).state;
    expect(playerBack.turn).toEqual({ stage: 'paused', reason: 'master_absent' });
    expect(
      step(playerBack, { type: 'MasterPresenceChanged', online: true }, content).state.turn.stage,
    ).toBe('awaiting_question');
  });
});
