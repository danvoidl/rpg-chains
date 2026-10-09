import { z } from 'zod';
import { IdSchema } from './common.js';
import { ActionSchema } from './commands.js';
import { ActiveEffectSchema } from './battle-effects.js';
import { PublicQuestionSchema } from './battle-question.js';
import { BattleRewardSchema } from './battle-rewards.js';
import { CombatantSchema, EnemySchema, PauseReasonSchema } from './battle-state.js';

/**
 * Domain events — consummated facts folded by `evolve` (CLAUDE.md "Command vs Event"). They carry
 * resolved numbers (final damage, effective heal, the applied effect), so a log folds without
 * campaign content and the client renders the same fold (Fase 3 plan decision 3). Stage-changing
 * events carry the new `turnToken`.
 */
const turnToken = z.number().int().nonnegative();

/** Genesis event: the full initial roster, so a log replays on its own (plan decision 12). */
const startedFields = {
  type: z.literal('BattleStarted'),
  battleId: IdSchema,
  nodeId: IdSchema,
  initiative: z.enum(['group', 'enemies']),
  combatants: z.array(CombatantSchema),
  enemies: z.array(EnemySchema),
  enemyQueue: z.array(IdSchema),
  needsMaster: z.boolean(),
  masterOnline: z.boolean(),
};
const battleStarted = z.object({
  ...startedFields,
  /** Seed of the folded PRNG. */
  seed: z.number().int(),
  /** First shuffle of the node's objective question ids. */
  questionDeck: z.array(IdSchema),
});
const publicBattleStarted = z.object(startedFields);

/** Server-only bookkeeping, dropped from the public stream (plan decision 13). */
const prngAdvanced = z.object({
  type: z.literal('PrngAdvanced'),
  cursor: z.number().int().nonnegative(),
});
const questionDeckShuffled = z.object({
  type: z.literal('QuestionDeckShuffled'),
  deck: z.array(IdSchema),
});

const publicEvents = [
  z.object({
    type: z.literal('TurnAdvanced'),
    turnToken,
    to: z.discriminatedUnion('side', [
      z.object({ side: z.literal('group') }),
      z.object({ side: z.literal('enemy'), instanceId: IdSchema }),
    ]),
  }),
  /** A battle that needs the master waits for him to present a question (spec §3.2). */
  z.object({ type: z.literal('QuestionRequested'), turnToken }),
  z.object({ type: z.literal('SignalOpened'), turnToken, question: PublicQuestionSchema }),
  z.object({ type: z.literal('SignalWonBy'), turnToken, profileId: IdSchema }),
  z.object({
    type: z.literal('OpenAnswerSubmitted'),
    turnToken,
    profileId: IdSchema,
    text: z.string(),
  }),
  /** Objective answers are judged by the engine, open ones by the master. */
  z.object({
    type: z.literal('AnswerJudged'),
    turnToken,
    profileId: IdSchema,
    correct: z.boolean(),
  }),
  /** The group's turn passed without an action (spec §3.1, plan decision 8). */
  z.object({
    type: z.literal('TurnLost'),
    reason: z.enum([
      'wrong_answer',
      'signal_expired',
      'answer_timeout',
      'action_timeout',
      'player_left',
    ]),
  }),
  z.object({ type: z.literal('ActionTaken'), profileId: IdSchema, action: ActionSchema }),
  /** `hpDamage` reached HP; `absorbed` was taken by a shield (spec §4.2 resolution order). */
  z.object({
    type: z.literal('DamageDealt'),
    sourceId: IdSchema,
    targetId: IdSchema,
    hpDamage: z.number().int().nonnegative(),
    absorbed: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('Healed'),
    sourceId: IdSchema,
    targetId: IdSchema,
    amount: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal('EnergyChanged'), targetId: IdSchema, delta: z.number().int() }),
  /** `evolve` applies the stacking policy (spec §5.5). */
  z.object({ type: z.literal('EffectApplied'), targetId: IdSchema, effect: ActiveEffectSchema }),
  /** Removal by a rule; expiry is implicit in `RoundEnded`, provoke/stun in their own events. */
  z.object({
    type: z.literal('EffectRemoved'),
    targetId: IdSchema,
    effectId: IdSchema,
    reason: z.enum(['dispelled', 'downed']),
  }),
  z.object({
    type: z.literal('CooldownStarted'),
    profileId: IdSchema,
    skillId: IdSchema,
    rounds: z.number().int().positive(),
  }),
  z.object({ type: z.literal('ConsumableUsed'), profileId: IdSchema, itemId: IdSchema }),
  /**
   * An enemy attack; `redirectedBy` is the provoker who drew it (spec §3.6), `cooldown` the
   * villain turns the attack now waits.
   */
  z.object({
    type: z.literal('EnemyActed'),
    instanceId: IdSchema,
    attackId: IdSchema,
    targetIds: z.array(IdSchema),
    redirectedBy: IdSchema.nullable(),
    cooldown: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal('ProvokeConsumed'), profileId: IdSchema }),
  z.object({
    type: z.literal('EnemyTurnSkipped'),
    instanceId: IdSchema,
    reason: z.literal('stunned'),
  }),
  z.object({
    type: z.literal('OverTimeTicked'),
    targetId: IdSchema,
    effectId: IdSchema,
    kind: z.enum(['damage_over_time', 'heal_over_time']),
    amount: z.number().int().nonnegative(),
  }),
  /**
   * End of a group round: durations and skill cooldowns tick, zeros expire (spec §5.5). `blocked`
   * is who acted this round and sits out the next signal (spec §3.3); null if nobody acted.
   */
  z.object({
    type: z.literal('RoundEnded'),
    round: z.number().int().positive(),
    blocked: IdSchema.nullable(),
  }),
  z.object({ type: z.literal('PlayerDowned'), profileId: IdSchema }),
  z.object({
    type: z.literal('PlayerRevived'),
    profileId: IdSchema,
    hp: z.number().int().positive(),
  }),
  z.object({ type: z.literal('EnemyDefeated'), instanceId: IdSchema }),
  z.object({ type: z.literal('PlayerLeft'), profileId: IdSchema }),
  z.object({ type: z.literal('PlayerDisconnected'), profileId: IdSchema }),
  z.object({ type: z.literal('PlayerReconnected'), profileId: IdSchema }),
  z.object({ type: z.literal('MasterPresenceChanged'), online: z.boolean() }),
  z.object({ type: z.literal('BattlePaused'), turnToken, reason: PauseReasonSchema }),
  /** A victory's rewards, one entry per participant still in the battle (spec §6). */
  z.object({ type: z.literal('RewardsGranted'), rewards: z.array(BattleRewardSchema) }),
  z.object({ type: z.literal('BattleResolved'), result: z.enum(['victory', 'defeat']) }),
] as const;

/** The full log `decide` emits and `evolve` folds. */
export const BattleEventSchema = z.discriminatedUnion('type', [
  battleStarted,
  prngAdvanced,
  questionDeckShuffled,
  ...publicEvents,
]);
export type BattleEvent = z.infer<typeof BattleEventSchema>;
export type BattleEventType = BattleEvent['type'];

/** What clients receive: no seed, no deck, no PRNG bookkeeping. */
export const PublicBattleEventSchema = z.discriminatedUnion('type', [
  publicBattleStarted,
  ...publicEvents,
]);
export type PublicBattleEvent = z.infer<typeof PublicBattleEventSchema>;

/** Log envelope: server sequence number of each accepted event. */
export const LoggedEventSchema = z.object({
  seq: z.number().int().nonnegative(),
  event: BattleEventSchema,
});
export type LoggedEvent = z.infer<typeof LoggedEventSchema>;
