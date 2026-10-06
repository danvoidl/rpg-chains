import { z } from 'zod';
import { AttributeSchema, IdSchema } from './common.js';
import { InvestedAttributesSchema } from './accounts.js';
import { ActiveEffectSchema } from './battle-effects.js';
import { WeaponTypeSchema } from './content.js';
import { PublicQuestionSchema } from './battle-question.js';

/**
 * Deterministic PRNG state (CLAUDE.md "Determinism"). The engine advances `cursor`; replaying
 * from the same seed reproduces every roll exactly.
 */
export const PrngStateSchema = z.object({
  seed: z.number().int(),
  cursor: z.number().int().nonnegative(),
});
export type PrngState = z.infer<typeof PrngStateSchema>;

/** The equipped weapon, resolved from the snapshot when the battle starts (spec §4.2). */
export const ResolvedWeaponSchema = z.object({
  itemId: IdSchema,
  name: z.string(),
  weaponType: WeaponTypeSchema,
  baseDamage: z.number().nonnegative(),
  scalingAttribute: AttributeSchema,
  scale: z.number().nonnegative(),
});
export type ResolvedWeapon = z.infer<typeof ResolvedWeaponSchema>;

/** A player character in a battle, built from their Campaign Profile at start. */
export const CombatantSchema = z.object({
  profileId: IdSchema,
  userId: IdSchema,
  name: z.string(),
  classId: IdSchema,
  level: z.number().int().positive(),
  /** Invested points; buffs apply on top at read time (spec §4.1, §5.5). */
  attributes: InvestedAttributesSchema,
  weapon: ResolvedWeaponSchema,
  /** Sum of `defenseBonus` of equipped items; derived defense adds attributes at read time. */
  equipmentDefense: z.number().nonnegative(),
  currentHp: z.number().nonnegative(),
  /** Max HP without reductions; fixed for the battle (spec §4.1). */
  maxHp: z.number().positive(),
  currentEnergy: z.number().nonnegative(),
  maxEnergy: z.number().nonnegative(),
  downed: z.boolean(),
  /** Disconnected mid-battle: no longer eligible nor targetable, cannot return (spec §7). */
  left: z.boolean(),
  /** Acted last round: blocked from the next signal (spec §3.3). */
  blockedFromSignal: z.boolean(),
  /** Skills unlocked at this level, by id into the battle content. */
  skillIds: z.array(IdSchema),
  consumables: z.array(z.object({ itemId: IdSchema, quantity: z.number().int().positive() })),
  effects: z.array(ActiveEffectSchema),
  /** Group rounds left per skill id; absent = ready. */
  cooldowns: z.record(z.string(), z.number().int().positive()),
});
export type Combatant = z.infer<typeof CombatantSchema>;

/** A villain instance (copies of one villain get distinct instance ids). Defeated at 0 HP. */
export const EnemySchema = z.object({
  instanceId: IdSchema,
  villainId: IdSchema,
  name: z.string(),
  imageUrl: z.string().url().optional(),
  currentHp: z.number().nonnegative(),
  maxHp: z.number().positive(),
  /** Base defense; modifiers apply at read time. */
  defense: z.number().nonnegative(),
  effects: z.array(ActiveEffectSchema),
  /** This villain's own turns left per attack id (spec §3.5); absent = ready. */
  attackCooldowns: z.record(z.string(), z.number().int().positive()),
});
export type Enemy = z.infer<typeof EnemySchema>;

/**
 * Where the battle stands (Fase 3 plan, contracts). Group turns walk awaiting_signal →
 * awaiting_answer → (awaiting_judgement, open questions) → awaiting_action; a battle that needs
 * the master asks him for a question first (`awaiting_question`) and may pause while he is away
 * (spec §3.2). `enemy` is transient: enemy turns resolve inside one `decide` call, so a battle at
 * rest is never in it, but folding the log passes through it.
 */
export const TurnSchema = z.discriminatedUnion('stage', [
  z.object({ stage: z.literal('starting') }),
  z.object({ stage: z.literal('enemy'), instanceId: IdSchema }),
  z.object({ stage: z.literal('awaiting_question') }),
  z.object({ stage: z.literal('awaiting_signal'), question: PublicQuestionSchema }),
  z.object({
    stage: z.literal('awaiting_answer'),
    question: PublicQuestionSchema,
    profileId: IdSchema,
  }),
  z.object({
    stage: z.literal('awaiting_judgement'),
    question: PublicQuestionSchema,
    profileId: IdSchema,
    answer: z.string(),
  }),
  z.object({ stage: z.literal('awaiting_action'), profileId: IdSchema }),
  z.object({ stage: z.literal('paused'), reason: z.literal('master_absent') }),
  z.object({ stage: z.literal('ended') }),
]);
export type Turn = z.infer<typeof TurnSchema>;
export type TurnStage = Turn['stage'];

/** What every participant may see of a battle (Fase 3 plan decision 13). */
export const PublicBattleStateSchema = z.object({
  battleId: IdSchema,
  nodeId: IdSchema,
  /** Group rounds started so far; durations and cooldowns count these (spec §5.5). */
  round: z.number().int().nonnegative(),
  /** Bumped on every stage change; commands carrying another token are stale. */
  turnToken: z.number().int().nonnegative(),
  turn: TurnSchema,
  /** Circular queue of living enemy instance ids; the head acts next (spec §3.1). */
  enemyQueue: z.array(IdSchema),
  combatants: z.array(CombatantSchema),
  enemies: z.array(EnemySchema),
  /** The node has open questions, so the master judges and does not fight (spec §3.2). */
  needsMaster: z.boolean(),
  masterOnline: z.boolean(),
  result: z.enum(['victory', 'defeat']).nullable(),
});
export type PublicBattleState = z.infer<typeof PublicBattleStateSchema>;

/**
 * Server-only part of the state: the PRNG would let a client predict draws, and the deck reveals
 * the upcoming questions. Kept in its own object so projecting to the public view is one omit.
 */
export const BattleSecretSchema = z.object({
  prng: PrngStateSchema,
  /** Objective question ids still to draw, in order; reshuffled when empty. */
  questionDeck: z.array(IdSchema),
});
export type BattleSecret = z.infer<typeof BattleSecretSchema>;

/** Authoritative in-memory state of one battle (spec §2.1 "Batalha Ativa", §3.7). */
export const BattleStateSchema = PublicBattleStateSchema.extend({ secret: BattleSecretSchema });
export type BattleState = z.infer<typeof BattleStateSchema>;
