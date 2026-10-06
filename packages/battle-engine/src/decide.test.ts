import { describe, expect, it } from 'vitest';
import {
  BattleStateSchema,
  type BattleContent,
  type BattleState,
  type Command,
} from '@rpg-chains/shared-types';
import { buildBattleContent } from './battle-content.js';
import { decide } from './decide.js';
import { evolve } from './evolve.js';
import { basicSnapshot } from './fixtures/load.js';
import openSignalFixture from './fixtures/open-signal.json';

function loadState(): BattleState {
  // Parsing proves the fixture matches the shared contract.
  return BattleStateSchema.parse(structuredClone(openSignalFixture));
}

function content(): BattleContent {
  const built = buildBattleContent(basicSnapshot(), 'n-battle');
  if ('ok' in built) throw new Error(built.reason);
  return built;
}

function tap(profileId: string, turnToken = 5): Command {
  return { type: 'TapSignal', profileId, turnToken };
}

describe('decide: TapSignal', () => {
  it('grants the signal to an eligible player and moves to a new turn token', () => {
    expect(decide(loadState(), tap('p1'), content())).toEqual({
      ok: true,
      events: [{ type: 'SignalWonBy', turnToken: 6, profileId: 'p1' }],
    });
  });

  it('rejects a stale turn token', () => {
    expect(decide(loadState(), tap('p1', 4), content())).toEqual({
      ok: false,
      reason: 'stale_turn_token',
    });
  });

  it('rejects a player blocked by bell rotation (spec §3.3)', () => {
    expect(decide(loadState(), tap('p2'), content())).toEqual({
      ok: false,
      reason: 'blocked_this_round',
    });
  });

  it('rejects a downed player (spec §3.7) and one who left (spec §7)', () => {
    expect(decide(loadState(), tap('p3'), content())).toEqual({
      ok: false,
      reason: 'player_downed',
    });
    expect(decide(loadState(), tap('p4'), content())).toEqual({ ok: false, reason: 'player_left' });
  });

  it('rejects a second tap once the signal was won: the stage and token moved on', () => {
    const won = evolve(loadState(), { type: 'SignalWonBy', turnToken: 6, profileId: 'p1' });
    expect(won.turn).toMatchObject({ stage: 'awaiting_answer', profileId: 'p1' });
    expect(decide(won, tap('p2', 6), content())).toEqual({
      ok: false,
      reason: 'signal_not_open',
    });
  });
});

describe('bell rotation fallback (spec §3.3)', () => {
  it('ignores the block when it would leave nobody eligible', () => {
    const state = loadState();
    // Down p1, leaving only blocked p2 active → the block is lifted.
    const onlyBlocked: BattleState = {
      ...state,
      combatants: state.combatants.map((c) => (c.profileId === 'p1' ? { ...c, downed: true } : c)),
    };
    expect(decide(onlyBlocked, tap('p2'), content())).toEqual({
      ok: true,
      events: [{ type: 'SignalWonBy', turnToken: 6, profileId: 'p2' }],
    });
  });
});
