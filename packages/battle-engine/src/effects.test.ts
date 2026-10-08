import { describe, expect, it } from 'vitest';
import type {
  Action,
  BattleContent,
  BattleEvent,
  BattleState,
  Combatant,
} from '@rpg-chains/shared-types';
import { buildBattleContent } from './battle-content.js';
import type { RosterEntry } from './create-battle.js';
import { decide, type DecideResult } from './decide.js';
import { evolve } from './evolve.js';
import { actWith, answerWith, startWith, withEffect } from './fixtures/battle-setup.js';
import { catalogSnapshot } from './fixtures/load.js';
import { rosterFor } from './fixtures/run-battle.js';

/**
 * The effect catalog (spec §5.4, Fase 3 plan M6), one case per type with exact numbers, on the
 * catalog fixture: p1 strike (blade 12), p2 control, p3 support, p4 buff, against two 200 HP
 * training dummies without defense.
 */

function content(): BattleContent {
  const built = buildBattleContent(catalogSnapshot(), 'n-dummies');
  if ('ok' in built) throw new Error(built.reason);
  return built;
}

const squad = (): RosterEntry[] =>
  rosterFor(catalogSnapshot(), [
    'cl-cat-strike',
    'cl-cat-control',
    'cl-cat-support',
    'cl-cat-buff',
  ]);

function start(roster: RosterEntry[] = squad()): { state: BattleState; content: BattleContent } {
  const c = content();
  return { state: startWith(c, roster, 'group').state, content: c };
}

const skill = (skillId: string, targetId?: string): Action => ({
  type: 'skill',
  skillId,
  ...(targetId ? { targetId } : {}),
});

/** Answers with `profileId` and decides the action, without throwing on a refusal. */
function tryAction(
  state: BattleState,
  c: BattleContent,
  profileId: string,
  action: Action,
): DecideResult {
  const answered = answerWith(state, c, profileId).state;
  return decide(
    answered,
    { type: 'ChooseAction', turnToken: answered.turnToken, profileId, action },
    c,
  );
}

/** Events of a skill use up to the end of the group's round (before the enemy replies). */
function ownEvents(events: BattleEvent[]): BattleEvent[] {
  const end = events.findIndex((e) => e.type === 'RoundEnded');
  return end < 0 ? events : events.slice(0, end + 1);
}

const unit = (state: BattleState, id: string) =>
  state.combatants.find((c) => c.profileId === id) ??
  state.enemies.find((e) => e.instanceId === id)!;

describe('paying for a skill (spec §3.4, §5.3)', () => {
  it('spends energy, starts the cooldown and does not give the attack energy', () => {
    const { state, content: c } = start();
    const { events, state: after } = actWith(state, c, 'p1', skill('sk-cat-damage', 'enemy-1'));
    expect(ownEvents(events)).toContainEqual({ type: 'EnergyChanged', targetId: 'p1', delta: -15 });
    expect(events).toContainEqual({
      type: 'CooldownStarted',
      profileId: 'p1',
      skillId: 'sk-cat-damage',
      rounds: 2,
    });
    expect((unit(after, 'p1') as Combatant).currentEnergy).toBe(45);
  });

  it('refuses an unknown skill, an empty purse and a wrong target', () => {
    const { state, content: c } = start();
    expect(tryAction(state, c, 'p1', skill('sk-cat-heal', 'p1'))).toEqual({
      ok: false,
      reason: 'unknown_skill',
    });
    const broke = {
      ...state,
      combatants: state.combatants.map((x) =>
        x.profileId === 'p1' ? { ...x, currentEnergy: 10 } : x,
      ),
    };
    expect(tryAction(broke, c, 'p1', skill('sk-cat-damage', 'enemy-1'))).toEqual({
      ok: false,
      reason: 'not_enough_energy',
    });
    expect(tryAction(state, c, 'p1', skill('sk-cat-damage', 'p2'))).toEqual({
      ok: false,
      reason: 'invalid_target',
    });
  });

  it('the round of use does not count: cooldown 2 used in round 1 is back in round 4', () => {
    // Alone, the bell rotation is lifted, so p1 acts every round.
    const { state, content: c } = start(rosterFor(catalogSnapshot(), ['cl-cat-strike']));
    expect(state.round).toBe(1);
    let s = actWith(state, c, 'p1', skill('sk-cat-damage', 'enemy-1')).state;
    expect((unit(s, 'p1') as Combatant).cooldowns).toEqual({ 'sk-cat-damage': 4 });
    for (const round of [2, 3]) {
      expect(s.round).toBe(round);
      expect(tryAction(s, c, 'p1', skill('sk-cat-damage', 'enemy-1'))).toEqual({
        ok: false,
        reason: 'skill_on_cooldown',
      });
      s = actWith(s, c, 'p1', { type: 'attack', targetInstanceId: 'enemy-1' }).state;
    }
    expect(s.round).toBe(4);
    expect(tryAction(s, c, 'p1', skill('sk-cat-damage', 'enemy-1')).ok).toBe(true);
  });
});

describe('damage effects', () => {
  it('damage: a fixed 20 through the attack chain', () => {
    const { state, content: c } = start();
    const { events } = actWith(state, c, 'p1', skill('sk-cat-damage', 'enemy-1'));
    expect(events).toContainEqual({
      type: 'DamageDealt',
      sourceId: 'p1',
      targetId: 'enemy-1',
      hpDamage: 20,
      absorbed: 0,
    });
  });

  it('damage over time: 5 × 3, ticking at the end of the three rounds after the cast', () => {
    const { state, content: c } = start(rosterFor(catalogSnapshot(), ['cl-cat-strike']));
    let s = actWith(state, c, 'p1', skill('sk-cat-dot', 'enemy-1')).state;
    const ticks = (events: BattleEvent[]) => events.filter((e) => e.type === 'OverTimeTicked');
    // Cast in round 1: no tick at the end of round 1.
    expect(unit(s, 'enemy-1').effects).toMatchObject([
      { kind: 'damage_over_time', perRound: 5, rounds: 3, appliedRound: 1 },
    ]);
    const seen: BattleEvent[] = [];
    for (let i = 0; i < 4; i++) {
      const r = actWith(s, c, 'p1', { type: 'attack', targetInstanceId: 'enemy-2' });
      seen.push(...ticks(r.events));
      s = r.state;
    }
    expect(seen).toHaveLength(3);
    expect(seen[0]).toMatchObject({ targetId: 'enemy-1', kind: 'damage_over_time', amount: 5 });
    expect(unit(s, 'enemy-1').currentHp).toBe(185);
    expect(unit(s, 'enemy-1').effects).toEqual([]);
  });

  it('max HP reduction: 10% of 200 lowers the ceiling and cuts HP above it', () => {
    const { state, content: c } = start();
    const { state: after } = actWith(state, c, 'p1', skill('sk-cat-max-hp', 'enemy-1'));
    expect(unit(after, 'enemy-1').effects).toMatchObject([
      { kind: 'max_hp_reduction', amount: 20 },
    ]);
    expect(unit(after, 'enemy-1').currentHp).toBe(180);
  });

  it('debuff: defense −20% in the percent channel, for 2 rounds', () => {
    const { state, content: c } = start();
    const { state: after } = actWith(state, c, 'p1', skill('sk-cat-debuff', 'enemy-1'));
    expect(unit(after, 'enemy-1').effects).toMatchObject([
      {
        kind: 'stat_modifier',
        polarity: 'debuff',
        stat: 'defense',
        channel: 'percent',
        value: 20,
        rounds: 2,
      },
    ]);
  });
});

describe('buffs and durations', () => {
  it('buff: +15% damage on every ally, read live by the next attack (12 → 13)', () => {
    const { state, content: c } = start();
    const buffed = actWith(state, c, 'p4', skill('sk-cat-buff')).state;
    for (const id of ['p1', 'p2', 'p3', 'p4']) {
      expect(unit(buffed, id).effects).toMatchObject([
        { kind: 'stat_modifier', polarity: 'buff', stat: 'damage', value: 15 },
      ]);
    }
    const { events } = actWith(buffed, c, 'p1', { type: 'attack', targetInstanceId: 'enemy-1' });
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'DamageDealt', sourceId: 'p1', hpDamage: 13 }),
    );
  });

  it('a duration of 3 covers the three rounds after the cast, then expires', () => {
    const { state, content: c } = start(rosterFor(catalogSnapshot(), ['cl-cat-buff']));
    let s = actWith(state, c, 'p1', skill('sk-cat-buff')).state;
    const rounds: number[] = [];
    for (let i = 0; i < 3; i++) {
      rounds.push(unit(s, 'p1').effects.length);
      s = actWith(s, c, 'p1', { type: 'attack', targetInstanceId: 'enemy-1' }).state;
    }
    // Present during rounds 2, 3 and 4; gone once round 4 ends.
    expect(rounds).toEqual([1, 1, 1]);
    expect(unit(s, 'p1').effects).toEqual([]);
  });
});

describe('control effects', () => {
  it('stun: the stunned enemy loses its next turn', () => {
    const { state, content: c } = start();
    const head = state.enemyQueue[0]!;
    const { events } = actWith(state, c, 'p2', skill('sk-cat-stun', head));
    expect(events).toContainEqual({
      type: 'EnemyTurnSkipped',
      instanceId: head,
      reason: 'stunned',
    });
  });

  it('provoke: the next enemy attack goes to the provoker', () => {
    const { state, content: c } = start();
    const { events } = actWith(state, c, 'p2', skill('sk-cat-provoke'));
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'EnemyActed', targetIds: ['p2'], redirectedBy: 'p2' }),
    );
    expect(events).toContainEqual({ type: 'ProvokeConsumed', profileId: 'p2' });
  });

  it('shield: 30 on self, absorbing before HP', () => {
    const { state, content: c } = start();
    const { state: after } = actWith(state, c, 'p2', skill('sk-cat-shield'));
    const shield = unit(after, 'p2').effects.find((e) => e.kind === 'shield');
    // The dummy may have hit p2 already; whatever it took came off the shield, not HP.
    expect(shield).toMatchObject({ rounds: 2 });
    expect(unit(after, 'p2').currentHp).toBe(110);
  });

  it('dispel: removes the most recent debuff of an ally', () => {
    const { state, content: c } = start();
    const debuffed = withEffect(
      withEffect(state, 'p1', {
        id: 'fx-old',
        sourceId: 'enemy-1',
        kind: 'stat_modifier',
        polarity: 'debuff',
        stat: 'damage',
        channel: 'flat',
        value: 2,
        rounds: 3,
      }),
      'p1',
      { id: 'fx-new', sourceId: 'enemy-1', kind: 'stun', turns: 1 },
    );
    const { events } = actWith(debuffed, c, 'p2', skill('sk-cat-dispel', 'p1'));
    expect(events).toContainEqual({
      type: 'EffectRemoved',
      targetId: 'p1',
      effectId: 'fx-new',
      reason: 'dispelled',
    });
    expect(events.filter((e) => e.type === 'EffectRemoved')).toHaveLength(1);
  });
});

describe('support effects', () => {
  const hurt = (state: BattleState, id: string, hp: number): BattleState => ({
    ...state,
    combatants: state.combatants.map((c) => (c.profileId === id ? { ...c, currentHp: hp } : c)),
  });

  it('heal: base 20 (int 0), never above max HP', () => {
    const { state, content: c } = start();
    const first = actWith(hurt(state, 'p1', 50), c, 'p3', skill('sk-cat-heal', 'p1'));
    expect(first.events).toContainEqual({
      type: 'Healed',
      sourceId: 'p3',
      targetId: 'p1',
      amount: 20,
    });
    const second = actWith(hurt(state, 'p1', 95), c, 'p3', skill('sk-cat-heal', 'p1'));
    expect(second.events).toContainEqual({
      type: 'Healed',
      sourceId: 'p3',
      targetId: 'p1',
      amount: 5,
    });
  });

  it('heal over time: 6% of each ally max HP per round', () => {
    const { state, content: c } = start();
    const { state: after } = actWith(state, c, 'p3', skill('sk-cat-hot'));
    expect(unit(after, 'p1').effects).toMatchObject([{ kind: 'heal_over_time', perRound: 6 }]);
    expect(unit(after, 'p4').effects).toMatchObject([{ kind: 'heal_over_time', perRound: 5 }]);
  });

  it('revive: a downed ally comes back with 40%; a standing one is not a target', () => {
    const { state, content: c } = start();
    const downed = evolve(state, { type: 'PlayerDowned', profileId: 'p1' });
    const { events, state: after } = actWith(downed, c, 'p3', skill('sk-cat-revive', 'p1'));
    expect(events).toContainEqual({ type: 'PlayerRevived', profileId: 'p1', hp: 40 });
    expect(unit(after, 'p1')).toMatchObject({ downed: false });
    expect(tryAction(state, c, 'p3', skill('sk-cat-revive', 'p1'))).toEqual({
      ok: false,
      reason: 'invalid_target',
    });
  });

  it('restore energy: up to 20, capped at the maximum', () => {
    const { state, content: c } = start();
    const tired = {
      ...state,
      combatants: state.combatants.map((x) =>
        x.profileId === 'p1' ? { ...x, currentEnergy: 50 } : x,
      ),
    };
    const { events } = actWith(tired, c, 'p3', skill('sk-cat-energy', 'p1'));
    expect(events).toContainEqual({ type: 'EnergyChanged', targetId: 'p1', delta: 10 });
  });
});

describe('consumables (spec §3.4, §6)', () => {
  it('a potion heals 30 and leaves the inventory one lighter', () => {
    const roster = squad().map((r) =>
      r.profileId === 'p1'
        ? { ...r, currentHp: 40, inventory: [{ itemId: 'it-cat-potion', quantity: 2 }] }
        : r,
    );
    const { state, content: c } = start(roster);
    expect(unit(state, 'p1')).toMatchObject({
      consumables: [{ itemId: 'it-cat-potion', name: 'Healing potion', quantity: 2 }],
    });
    const { events, state: after } = actWith(state, c, 'p1', {
      type: 'consumable',
      itemId: 'it-cat-potion',
    });
    expect(events).toContainEqual({
      type: 'ConsumableUsed',
      profileId: 'p1',
      itemId: 'it-cat-potion',
    });
    expect(events).toContainEqual({ type: 'Healed', sourceId: 'p1', targetId: 'p1', amount: 30 });
    expect((unit(after, 'p1') as Combatant).consumables).toMatchObject([{ quantity: 1 }]);
    expect(tryAction(state, c, 'p1', { type: 'consumable', itemId: 'it-cat-tonic' })).toEqual({
      ok: false,
      reason: 'no_such_item',
    });
  });
});
