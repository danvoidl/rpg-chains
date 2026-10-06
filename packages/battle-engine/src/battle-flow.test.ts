import { describe, expect, it } from 'vitest';
import type { BattleEvent, Villain } from '@rpg-chains/shared-types';
import { createBattle } from './create-battle.js';
import { decide } from './decide.js';
import {
  attackWith,
  basicContent,
  fencers,
  passTurn,
  startWith,
  step,
  withEffect,
  withVillains,
} from './fixtures/battle-setup.js';

const types = (events: readonly BattleEvent[]) => events.map((e) => e.type);

const brute = (attacks: Villain['attacks'], hp = 500): Villain => ({
  id: 'v-brute',
  name: 'Brute',
  hp,
  attributes: { strength: 0, dexterity: 0, intelligence: 0, defense: 0 },
  attacks,
});

describe('createBattle (spec §3.1, plan decision 12)', () => {
  it('is reproducible from the seed and opens with the genesis event', () => {
    const content = basicContent();
    const setup = { battleId: 'b1', seed: 7, masterOnline: true };
    const first = createBattle(content, fencers(2), setup);
    expect(createBattle(content, fencers(2), setup)).toEqual(first);
    expect(first.ok && first.events[0]!.type).toBe('BattleStarted');
    expect(first.ok && first.events.at(-1)!.type).toBe('PrngAdvanced');
  });

  it('draws both initiatives across seeds', () => {
    const content = basicContent();
    const initiatives = new Set(
      Array.from({ length: 40 }, (_, seed) => {
        const r = createBattle(content, fencers(1), { battleId: 'b1', seed, masterOnline: true });
        return r.ok && r.events[0]!.type === 'BattleStarted' ? r.events[0]!.initiative : null;
      }),
    );
    expect(initiatives).toEqual(new Set(['group', 'enemies']));
  });

  it('stops at the group signal whichever side starts; enemies first means one enemy acted', () => {
    const content = basicContent();
    const group = startWith(content, fencers(1), 'group');
    expect(group.state.turn.stage).toBe('awaiting_signal');
    expect(types(group.events)).not.toContain('EnemyActed');

    const enemies = startWith(content, fencers(1), 'enemies');
    expect(enemies.state.turn.stage).toBe('awaiting_signal');
    expect(types(enemies.events).filter((t) => t === 'EnemyActed')).toHaveLength(1);
  });

  it('numbers repeated villains and keeps one instance per lineup entry', () => {
    const { state } = startWith(basicContent('n-boss'), fencers(1), 'group');
    expect(state.enemies.map((e) => [e.instanceId, e.name])).toEqual([
      ['enemy-1', 'Giant rat 1'],
      ['enemy-2', 'Giant rat 2'],
    ]);
    expect(state.enemyQueue).toEqual(['enemy-1', 'enemy-2']);
  });

  it('refuses an empty, duplicated, downed or unknown roster and a node without questions', () => {
    const content = basicContent();
    const setup = { battleId: 'b1', seed: 1, masterOnline: true };
    const [p1] = fencers(1);
    const reason = (r: ReturnType<typeof createBattle>) => (r.ok ? 'ok' : r.reason);
    expect(reason(createBattle(content, [], setup))).toBe('no_participants');
    expect(reason(createBattle(content, [p1!, p1!], setup))).toBe('duplicate_participant');
    expect(reason(createBattle(content, [{ ...p1!, downed: true }], setup))).toBe(
      'participant_downed',
    );
    expect(reason(createBattle(content, [{ ...p1!, classId: 'cl-x' }], setup))).toBe(
      'unknown_class',
    );
    const silent = basicContent('n-battle', (c) => (c.questions = []));
    expect(reason(createBattle(silent, [p1!], setup))).toBe('node_without_questions');
  });
});

describe('the group turn (spec §3.1–3.4)', () => {
  it('a correct answer and an attack: damage through defense, energy back, enemy replies', () => {
    const content = basicContent();
    const roster = fencers(1).map((p) => ({ ...p, currentEnergy: 30 }));
    const { state } = startWith(content, roster, 'group');
    const { events, state: after } = attackWith(state, content, 'p1', 'enemy-1');

    // Rapier 12 raw vs defense 10: 12 × (1 − 10/130) = 11.07 → 11 (spec §4.2).
    expect(events).toContainEqual({
      type: 'DamageDealt',
      sourceId: 'p1',
      targetId: 'enemy-1',
      hpDamage: 11,
      absorbed: 0,
    });
    expect(events).toContainEqual({ type: 'EnergyChanged', targetId: 'p1', delta: 10 });
    // Bite 6 vs a fencer with no defense: 6.
    expect(events).toContainEqual({
      type: 'DamageDealt',
      sourceId: 'enemy-1',
      targetId: 'p1',
      hpDamage: 6,
      absorbed: 0,
    });
    expect(after.enemies[0]!.currentHp).toBe(19);
    expect(after.combatants[0]!.currentHp).toBe(84);
    expect(after.turn.stage).toBe('awaiting_signal');
    expect(after.round).toBe(2);
  });

  it('a wrong answer passes the turn straight to the next enemy', () => {
    const content = basicContent();
    const { state } = startWith(content, fencers(2), 'group');
    const tapped = step(
      state,
      { type: 'TapSignal', turnToken: state.turnToken, profileId: 'p1' },
      content,
    );
    const turn = tapped.state.turn;
    if (turn.stage !== 'awaiting_answer' || turn.question.type !== 'objective') throw new Error();
    const question = content.questions.find((q) => q.id === turn.question.questionId)!;
    const wrong =
      question.type === 'objective' ? (question.correctIndex + 1) % question.options.length : 0;
    const { events } = step(
      tapped.state,
      {
        type: 'SubmitObjectiveAnswer',
        turnToken: tapped.state.turnToken,
        profileId: 'p1',
        index: wrong,
      },
      content,
    );
    expect(types(events)).toEqual([
      'AnswerJudged',
      'TurnLost',
      'RoundEnded',
      'TurnAdvanced',
      'EnemyActed',
      'DamageDealt',
      'TurnAdvanced',
      'SignalOpened',
      'PrngAdvanced',
    ]);
    expect(events).toContainEqual({ type: 'RoundEnded', round: 1, blocked: null });
  });

  it('bell rotation: whoever acted sits out the next signal only (spec §3.3)', () => {
    const content = basicContent();
    const { state } = startWith(content, fencers(2), 'group');
    const round1 = attackWith(state, content, 'p1', 'enemy-1').state;
    expect(round1.combatants.map((c) => c.blockedFromSignal)).toEqual([true, false]);
    expect(
      decide(round1, { type: 'TapSignal', turnToken: round1.turnToken, profileId: 'p1' }, content),
    ).toEqual({ ok: false, reason: 'blocked_this_round' });

    const round2 = attackWith(round1, content, 'p2', 'enemy-1').state;
    expect(round2.combatants.map((c) => c.blockedFromSignal)).toEqual([false, true]);
  });

  it('rejects answers and actions from anyone but the signal winner, and stale tokens', () => {
    const content = basicContent();
    const { state } = startWith(content, fencers(2), 'group');
    const tapped = step(
      state,
      { type: 'TapSignal', turnToken: state.turnToken, profileId: 'p1' },
      content,
    ).state;
    const answer = {
      type: 'SubmitObjectiveAnswer',
      turnToken: tapped.turnToken,
      index: 0,
    } as const;
    expect(decide(tapped, { ...answer, profileId: 'p2' }, content)).toEqual({
      ok: false,
      reason: 'not_your_turn',
    });
    expect(
      decide(tapped, { ...answer, profileId: 'p1', turnToken: state.turnToken }, content),
    ).toEqual({
      ok: false,
      reason: 'stale_turn_token',
    });
    expect(decide(tapped, { ...answer, profileId: 'p1', index: 9 }, content)).toEqual({
      ok: false,
      reason: 'invalid_option',
    });
  });
});

describe('enemy turns (spec §3.1, §3.5, §3.6)', () => {
  it('enemies act from a circular queue, one per group turn', () => {
    const content = basicContent('n-battle', (c) => (c.lineup = ['v-rat', 'v-rat', 'v-rat']));
    let { state } = startWith(
      content,
      fencers(1).map((p) => ({ ...p, currentHp: 90 })),
      'group',
    );
    const actors: string[] = [];
    for (let i = 0; i < 4; i++) {
      const turn = passTurn(state, content);
      state = turn.state;
      for (const e of turn.events) if (e.type === 'EnemyActed') actors.push(e.instanceId);
    }
    expect(actors).toEqual(['enemy-1', 'enemy-2', 'enemy-3', 'enemy-1']);
  });

  it('a provoker draws an area attack as a single hit, once (spec §3.6)', () => {
    const content = basicContent('n-battle', (c) =>
      withVillains(
        c,
        [
          brute([
            { id: 'a-quake', name: 'Quake', baseDamage: 9, targetType: 'area', cooldownRounds: 0 },
          ]),
        ],
        ['v-brute'],
      ),
    );
    const { state } = startWith(content, fencers(3), 'group');
    const provoked = withEffect(state, 'p2', {
      id: 'fx-1',
      sourceId: 'p2',
      kind: 'provoke',
      attacks: 1,
    });

    const first = passTurn(provoked, content);
    expect(first.events).toContainEqual(
      expect.objectContaining({ type: 'EnemyActed', targetIds: ['p2'], redirectedBy: 'p2' }),
    );
    expect(types(first.events)).toContain('ProvokeConsumed');
    expect(first.state.combatants[1]!.effects).toEqual([]);

    const second = passTurn(first.state, content);
    expect(second.events).toContainEqual(
      expect.objectContaining({
        type: 'EnemyActed',
        targetIds: ['p1', 'p2', 'p3'],
        redirectedBy: null,
      }),
    );
  });

  it('a stunned enemy loses its own next turn, and the stun is spent', () => {
    const content = basicContent();
    const { state } = startWith(content, fencers(1), 'group');
    const stunned = withEffect(state, 'enemy-1', {
      id: 'fx-1',
      sourceId: 'p1',
      kind: 'stun',
      turns: 1,
    });
    const skipped = passTurn(stunned, content);
    expect(skipped.events).toContainEqual({
      type: 'EnemyTurnSkipped',
      instanceId: 'enemy-1',
      reason: 'stunned',
    });
    expect(types(skipped.events)).not.toContain('EnemyActed');
    expect(types(passTurn(skipped.state, content).events)).toContain('EnemyActed');
  });

  it('an attack on cooldown waits that many of the villain’s own turns', () => {
    const attacks: Villain['attacks'] = [
      { id: 'a-big', name: 'Big', baseDamage: 1, targetType: 'single', cooldownRounds: 2 },
      { id: 'a-small', name: 'Small', baseDamage: 1, targetType: 'single', cooldownRounds: 0 },
    ];
    const content = basicContent('n-battle', (c) => withVillains(c, [brute(attacks)], ['v-brute']));
    let { state } = startWith(content, fencers(1), 'group');
    const used: string[] = [];
    for (let i = 0; i < 30; i++) {
      const turn = passTurn(state, content);
      state = turn.state;
      for (const e of turn.events) if (e.type === 'EnemyActed') used.push(e.attackId);
    }
    expect(used).toContain('a-big');
    used.forEach((attack, i) => {
      if (attack === 'a-big') expect(used.slice(i + 1, i + 3)).not.toContain('a-big');
    });
  });
});

describe('end of battle (spec §3.7)', () => {
  it('victory when every enemy falls; then every command is refused', () => {
    const content = basicContent();
    let { state } = startWith(content, fencers(1), 'group');
    for (let i = 0; i < 3; i++) state = attackWith(state, content, 'p1', 'enemy-1').state;
    expect(state.result).toBe('victory');
    expect(state.enemyQueue).toEqual([]);
    expect(decide(state, { type: 'PlayerLeft', profileId: 'p1' }, content)).toEqual({
      ok: false,
      reason: 'battle_ended',
    });
  });

  it('defeat when every player is down', () => {
    const content = basicContent('n-battle', (c) =>
      withVillains(
        c,
        [
          brute([
            { id: 'a-crush', name: 'Crush', baseDamage: 40, targetType: 'area', cooldownRounds: 0 },
          ]),
        ],
        ['v-brute'],
      ),
    );
    let { state } = startWith(content, fencers(2), 'group');
    while (state.result === null) state = passTurn(state, content).state;
    expect(state.result).toBe('defeat');
    expect(state.combatants.every((c) => c.downed && c.currentHp === 0)).toBe(true);
  });
});

describe('server-issued commands (plan decisions 8, 10)', () => {
  it('a timeout loses the turn and blocks nobody; a timeout for another stage is refused', () => {
    const content = basicContent();
    const { state } = startWith(content, fencers(1), 'group');
    expect(decide(state, { type: 'AnswerTimedOut', turnToken: state.turnToken }, content)).toEqual({
      ok: false,
      reason: 'wrong_stage',
    });
    const { events } = passTurn(state, content);
    expect(events.slice(0, 2)).toEqual([
      { type: 'TurnLost', reason: 'signal_expired' },
      { type: 'RoundEnded', round: 1, blocked: null },
    ]);
  });

  it('a player who drops while the turn waits on them loses it; the last one out loses the battle', () => {
    const content = basicContent();
    const { state } = startWith(content, fencers(2), 'group');
    const tapped = step(
      state,
      { type: 'TapSignal', turnToken: state.turnToken, profileId: 'p1' },
      content,
    ).state;
    const left = step(tapped, { type: 'PlayerLeft', profileId: 'p1' }, content);
    expect(types(left.events).slice(0, 2)).toEqual(['PlayerLeft', 'TurnLost']);
    expect(left.state.combatants[0]!.left).toBe(true);
    expect(left.state.turn.stage).toBe('awaiting_signal');

    const gone = step(left.state, { type: 'PlayerLeft', profileId: 'p2' }, content);
    expect(gone.state.result).toBe('defeat');
  });
});
