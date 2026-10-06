import { describe, expect, it } from 'vitest';
import { BattleStateSchema } from '@rpg-chains/shared-types';
import type { BattleState, Command } from '@rpg-chains/shared-types';
import { decide } from './decide.js';
import { evolve } from './evolve.js';
import openSignalFixture from './fixtures/open-signal.json';

function loadState(): BattleState {
  // Parsing proves the fixture matches the shared contract (spec §6).
  return BattleStateSchema.parse(openSignalFixture);
}

function tap(profileId: string, turnToken = 5): Command {
  return { type: 'TapSignal', battleId: 'b1', profileId, turnToken };
}

describe('decide: TapSignal', () => {
  it('grants the signal to an eligible, alive player', () => {
    const result = decide(loadState(), tap('p1'));
    expect(result).toEqual({ ok: true, events: [{ type: 'SignalWonBy', profileId: 'p1' }] });
  });

  it('rejects a stale turn token (decision 2)', () => {
    expect(decide(loadState(), tap('p1', 4))).toEqual({ ok: false, reason: 'stale_turn_token' });
  });

  it('rejects a player blocked by bell rotation (spec §3.3)', () => {
    expect(decide(loadState(), tap('p2'))).toEqual({ ok: false, reason: 'blocked_this_round' });
  });

  it('rejects a downed player (spec §3.7)', () => {
    expect(decide(loadState(), tap('p3'))).toEqual({ ok: false, reason: 'player_downed' });
  });

  it('rejects tapping after the signal was already won', () => {
    const state = loadState();
    const won = evolve(state, { type: 'SignalWonBy', profileId: 'p1' });
    expect(decide(won, tap('p2'))).toEqual({ ok: false, reason: 'signal_already_won' });
  });
});

describe('bell rotation fallback (spec §3.3)', () => {
  it('ignores the block when it would leave nobody eligible', () => {
    const state = loadState();
    // Down p1, leaving only blocked p2 alive → block is lifted.
    const onlyBlocked: BattleState = {
      ...state,
      combatants: state.combatants.map((c) => (c.profileId === 'p1' ? { ...c, downed: true } : c)),
    };
    expect(decide(onlyBlocked, tap('p2'))).toEqual({
      ok: true,
      events: [{ type: 'SignalWonBy', profileId: 'p2' }],
    });
  });
});
