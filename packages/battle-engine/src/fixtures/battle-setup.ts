import type {
  ActiveEffect,
  BattleContent,
  BattleEvent,
  BattleState,
  Command,
  Villain,
} from '@rpg-chains/shared-types';
import { buildBattleContent } from '../battle-content.js';
import { createBattle, type RosterEntry } from '../create-battle.js';
import { decide } from '../decide.js';
import { emptyBattle, evolve, replay } from '../evolve.js';
import { basicSnapshot } from './load.js';
import { rosterFor } from './run-battle.js';

/** Content of a node of the basic fixture, optionally reshaped for one scenario. */
export function basicContent(
  nodeId = 'n-battle',
  reshape: (content: BattleContent) => void = () => {},
): BattleContent {
  const content = buildBattleContent(basicSnapshot(), nodeId);
  if ('ok' in content) throw new Error(content.reason);
  reshape(content);
  return content;
}

/** A villain for a scenario, replacing the rat. */
export function withVillains(content: BattleContent, villains: Villain[], lineup: string[]): void {
  content.villains = villains;
  content.lineup = lineup;
}

export const fencers = (count: number): RosterEntry[] =>
  rosterFor(
    basicSnapshot(),
    Array.from({ length: count }, () => 'cl-fencer'),
  );

/** The first seed (from 1) whose battle opens with the given side, and its folded start. */
export function startWith(
  content: BattleContent,
  roster: readonly RosterEntry[],
  initiative: 'group' | 'enemies',
): { seed: number; state: BattleState; events: BattleEvent[] } {
  for (let seed = 1; seed < 1000; seed++) {
    const result = createBattle(content, roster, { battleId: 'b1', seed, masterOnline: true });
    if (!result.ok) throw new Error(result.reason);
    const started = result.events[0]!;
    if (started.type === 'BattleStarted' && started.initiative === initiative) {
      return { seed, state: replay(emptyBattle('b1'), result.events), events: result.events };
    }
  }
  throw new Error(`no seed starts with ${initiative}`);
}

/** Decides and folds one command; throws on rejection. */
export function step(
  state: BattleState,
  command: Command,
  content: BattleContent,
): { state: BattleState; events: BattleEvent[] } {
  const result = decide(state, command, content);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.reason}`);
  return { state: result.events.reduce(evolve, state), events: result.events };
}

/** Lets the group's turn expire, so the next enemy acts. */
export function passTurn(state: BattleState, content: BattleContent) {
  return step(state, { type: 'SignalExpired', turnToken: state.turnToken }, content);
}

/** Taps, answers correctly and attacks `target` with `profileId`. */
export function attackWith(
  state: BattleState,
  content: BattleContent,
  profileId: string,
  target: string,
): { state: BattleState; events: BattleEvent[] } {
  const tapped = step(state, { type: 'TapSignal', turnToken: state.turnToken, profileId }, content);
  const turn = tapped.state.turn;
  if (turn.stage !== 'awaiting_answer' || turn.question.type !== 'objective') {
    throw new Error('expected an objective question');
  }
  const question = content.questions.find((q) => q.id === turn.question.questionId)!;
  const index = question.type === 'objective' ? question.correctIndex : 0;
  const answered = step(
    tapped.state,
    { type: 'SubmitObjectiveAnswer', turnToken: tapped.state.turnToken, profileId, index },
    content,
  );
  const acted = step(
    answered.state,
    {
      type: 'ChooseAction',
      turnToken: answered.state.turnToken,
      profileId,
      action: { type: 'attack', targetInstanceId: target },
    },
    content,
  );
  return { state: acted.state, events: [...tapped.events, ...answered.events, ...acted.events] };
}

/** Puts an active effect on a unit, the way `decide` would via `EffectApplied`. */
export function withEffect(
  state: BattleState,
  targetId: string,
  effect: ActiveEffect,
): BattleState {
  return evolve(state, { type: 'EffectApplied', targetId, effect });
}
