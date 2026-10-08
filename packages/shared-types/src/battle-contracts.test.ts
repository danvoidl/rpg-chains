import { describe, expect, it } from 'vitest';
import { ActiveEffectSchema } from './battle-effects.js';
import { BattleCommandMessageSchema } from './battle-realtime.js';
import { TurnSchema } from './battle-state.js';
import { ClientIntentSchema, CommandSchema } from './commands.js';
import { BattleEventSchema, PublicBattleEventSchema } from './events.js';

describe('client intents (Fase 3 plan, contracts)', () => {
  it('strips a forged profileId: the server binds the actor from the session', () => {
    const parsed = ClientIntentSchema.parse({ type: 'TapSignal', turnToken: 3, profileId: 'p-x' });
    expect(parsed).toEqual({ type: 'TapSignal', turnToken: 3 });
  });

  it('cannot carry a system command', () => {
    for (const type of ['PlayerLeft', 'MasterPresenceChanged', 'SignalExpired']) {
      expect(ClientIntentSchema.safeParse({ type, turnToken: 1, online: true }).success).toBe(
        false,
      );
    }
  });

  it('lets the master present a node question or one written on the spot (spec §3.2)', () => {
    for (const question of [{ questionId: 'q1' }, { prompt: 'Why?' }]) {
      expect(
        BattleCommandMessageSchema.safeParse({
          battleId: 'b1',
          intent: { type: 'PresentQuestion', turnToken: 1, question },
        }).success,
      ).toBe(true);
    }
  });

  it('refuses an empty open answer', () => {
    expect(
      ClientIntentSchema.safeParse({ type: 'SubmitOpenAnswer', turnToken: 1, text: '   ' }).success,
    ).toBe(false);
  });
});

describe('engine commands', () => {
  it('requires the actor on player commands', () => {
    expect(CommandSchema.safeParse({ type: 'TapSignal', turnToken: 1 }).success).toBe(false);
    expect(
      CommandSchema.safeParse({ type: 'TapSignal', turnToken: 1, profileId: 'p1' }).success,
    ).toBe(true);
  });

  it('accepts presence system commands without a turn token (they never go stale)', () => {
    expect(CommandSchema.parse({ type: 'PlayerLeft', profileId: 'p1' })).toEqual({
      type: 'PlayerLeft',
      profileId: 'p1',
    });
    expect(CommandSchema.safeParse({ type: 'MasterPresenceChanged', online: false }).success).toBe(
      true,
    );
  });
});

describe('events', () => {
  it('keeps server bookkeeping out of the public stream', () => {
    for (const event of [
      { type: 'PrngAdvanced', cursor: 1 },
      { type: 'QuestionDeckShuffled', deck: ['q1'] },
    ]) {
      expect(BattleEventSchema.safeParse(event).success).toBe(true);
      expect(PublicBattleEventSchema.safeParse(event).success).toBe(false);
    }
  });

  it('reports damage split between shield and HP', () => {
    const event = { type: 'DamageDealt', sourceId: 'e1', targetId: 'p1', hpDamage: 4, absorbed: 6 };
    expect(PublicBattleEventSchema.parse(event)).toEqual(event);
  });
});

describe('battle state pieces', () => {
  it('requires a channel on stat modifiers and resolved numbers on the rest', () => {
    const modifier = {
      id: 'x1',
      sourceId: 'p1',
      appliedRound: 1,
      kind: 'stat_modifier',
      polarity: 'buff',
      stat: 'damage',
      value: 15,
      rounds: 3,
    };
    expect(ActiveEffectSchema.safeParse(modifier).success).toBe(false);
    expect(ActiveEffectSchema.safeParse({ ...modifier, channel: 'percent' }).success).toBe(true);
    const shield = { id: 'x2', sourceId: 'p1', appliedRound: 1, kind: 'shield', rounds: 2 };
    expect(ActiveEffectSchema.safeParse(shield).success).toBe(false);
    expect(ActiveEffectSchema.safeParse({ ...shield, remaining: 30 }).success).toBe(true);
    // The round of application is part of every effect: durations skip it (spec §5.5).
    const { appliedRound: _round, ...undated } = { ...shield, remaining: 30 };
    expect(ActiveEffectSchema.safeParse(undated).success).toBe(false);
  });

  it('ties the answering stage to the player who won the signal', () => {
    const question = { type: 'open', questionId: null, prompt: 'Name a prime.' };
    expect(TurnSchema.safeParse({ stage: 'awaiting_answer', question }).success).toBe(false);
    expect(
      TurnSchema.safeParse({ stage: 'awaiting_judgement', question, profileId: 'p1', answer: '13' })
        .success,
    ).toBe(true);
  });
});
