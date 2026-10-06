import type { BattleContent, BattleEvent, BattleState, PrngState } from '@rpg-chains/shared-types';
import { evolve } from './evolve.js';
import type { Draw } from './prng.js';

/**
 * Working memory of one `decide` call. Rules emit events one at a time and each is folded at once,
 * so later rules see its effect (a hit that downs a player changes who the next attack may
 * target). The PRNG is threaded here and recorded once, at the end, as `PrngAdvanced` — the only
 * way a draw reaches the log, which is what makes replay exact.
 */
export interface DecideContext {
  readonly content: BattleContent;
  state: BattleState;
  events: BattleEvent[];
  prng: PrngState;
}

export function createContext(state: BattleState, content: BattleContent): DecideContext {
  return { content, state, events: [], prng: state.secret.prng };
}

export function emit(ctx: DecideContext, event: BattleEvent): void {
  ctx.events.push(event);
  ctx.state = evolve(ctx.state, event);
}

/** Token for the next stage change; every stage-changing event carries a fresh one. */
export function nextToken(ctx: DecideContext): number {
  return ctx.state.turnToken + 1;
}

/** Runs one PRNG draw and threads the advanced state. */
export function draw<T>(ctx: DecideContext, roll: (prng: PrngState) => Draw<T>): T {
  const { value, state } = roll(ctx.prng);
  ctx.prng = state;
  return value;
}

/** The events of this call, closing with the PRNG position if anything was drawn. */
export function finish(ctx: DecideContext): BattleEvent[] {
  if (ctx.prng.cursor !== ctx.state.secret.prng.cursor) {
    emit(ctx, { type: 'PrngAdvanced', cursor: ctx.prng.cursor });
  }
  return ctx.events;
}

/** Monotonic id for a new active effect, unique within the battle. */
export function nextEffectId(ctx: DecideContext): string {
  // The log index is unique and deterministic for a given log.
  return `fx-${ctx.state.turnToken}-${ctx.events.length}`;
}
