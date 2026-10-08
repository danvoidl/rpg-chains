import { describe, expect, it } from 'vitest';
import type { BattleContent, BattleState, Command } from '@rpg-chains/shared-types';
import { buildBattleContent } from './battle-content.js';
import { createBattle } from './create-battle.js';
import { decide } from './decide.js';
import { emptyBattle, replay } from './evolve.js';
import { step } from './fixtures/battle-setup.js';
import { kitSnapshot } from './fixtures/load.js';
import { rosterFor } from './fixtures/run-battle.js';

/**
 * The master and open questions (spec §3.2, Fase 3 plan M7), on the kit boss node: two objective
 * questions and an open one. `openOnly` drops the objective ones, so the master's absence pauses.
 */

function content(openOnly = false): BattleContent {
  const built = buildBattleContent(kitSnapshot(), 'n-kit-boss');
  if ('ok' in built) throw new Error(built.reason);
  if (openOnly) built.questions = built.questions.filter((q) => q.type === 'open');
  return built;
}

const roster = rosterFor(kitSnapshot(), ['cl-guardian', 'cl-penitent']);

/** A battle opening with the group's turn, the master online unless said otherwise. */
function start(c: BattleContent, masterOnline = true): BattleState {
  for (let seed = 1; seed < 500; seed++) {
    const result = createBattle(c, roster, { battleId: 'b1', seed, masterOnline });
    if (!result.ok) throw new Error(result.reason);
    const started = result.events[0]!;
    if (started.type === 'BattleStarted' && started.initiative === 'group') {
      return replay(emptyBattle('b1'), result.events);
    }
  }
  throw new Error('no group-first seed');
}

const present = (
  s: BattleState,
  question: Extract<Command, { type: 'PresentQuestion' }>['question'],
) => ({ type: 'PresentQuestion', turnToken: s.turnToken, question }) as const;

/** Presents the node's open question, taps and writes an answer with p1. */
function answerOpen(s: BattleState, c: BattleContent): BattleState {
  let next = step(s, present(s, { questionId: 'q-kit-open-1' }), c).state;
  next = step(next, { type: 'TapSignal', turnToken: next.turnToken, profileId: 'p1' }, c).state;
  return step(
    next,
    { type: 'SubmitOpenAnswer', turnToken: next.turnToken, profileId: 'p1', text: '13' },
    c,
  ).state;
}

describe('the master picks each question (spec §3.2)', () => {
  it('the group turn waits for him; nobody taps before a question is shown', () => {
    const c = content();
    const s = start(c);
    expect(s.turn.stage).toBe('awaiting_question');
    expect(decide(s, { type: 'TapSignal', turnToken: s.turnToken, profileId: 'p1' }, c)).toEqual({
      ok: false,
      reason: 'signal_not_open',
    });
  });

  it('shows a node question without its key, one written on the spot, or a drawn objective', () => {
    const c = content();
    const s = start(c);
    expect(step(s, present(s, { questionId: 'q-kit-open-1' }), c).state.turn).toEqual({
      stage: 'awaiting_signal',
      question: {
        type: 'open',
        questionId: 'q-kit-open-1',
        prompt: 'Name a prime number above 10.',
      },
    });
    expect(step(s, present(s, { prompt: 'Quem forjou a corrente?' }), c).state.turn).toEqual({
      stage: 'awaiting_signal',
      question: { type: 'open', questionId: null, prompt: 'Quem forjou a corrente?' },
    });
    const drawn = step(s, present(s, { draw: 'objective' }), c).state.turn;
    expect(drawn).toMatchObject({ stage: 'awaiting_signal', question: { type: 'objective' } });
    expect(JSON.stringify(drawn)).not.toContain('correctIndex');
  });

  it('refuses a question out of turn, an unknown one, and a draw with no objective questions', () => {
    const c = content();
    const s = start(c);
    const shown = step(s, present(s, { draw: 'objective' }), c).state;
    expect(decide(shown, present(shown, { draw: 'objective' }), c)).toEqual({
      ok: false,
      reason: 'no_question_requested',
    });
    expect(decide(s, present(s, { questionId: 'q-nope' }), c)).toEqual({
      ok: false,
      reason: 'unknown_question',
    });
    const open = content(true);
    const o = start(open);
    expect(decide(o, present(o, { draw: 'objective' }), open)).toEqual({
      ok: false,
      reason: 'no_objective_questions',
    });
  });
});

describe('open answers and judgement', () => {
  it('the written answer waits for the master; approved, the answerer acts', () => {
    const c = content();
    const waiting = answerOpen(start(c), c);
    expect(waiting.turn).toMatchObject({
      stage: 'awaiting_judgement',
      profileId: 'p1',
      answer: '13',
    });
    const judged = step(
      waiting,
      { type: 'JudgeOpenAnswer', turnToken: waiting.turnToken, approved: true },
      c,
    );
    expect(judged.state.turn).toEqual({ stage: 'awaiting_action', profileId: 'p1' });
  });

  it('failed, the turn passes like a wrong answer and nobody is blocked', () => {
    const c = content();
    const waiting = answerOpen(start(c), c);
    const { events, state } = step(
      waiting,
      { type: 'JudgeOpenAnswer', turnToken: waiting.turnToken, approved: false },
      c,
    );
    expect(events).toContainEqual({ type: 'TurnLost', reason: 'wrong_answer' });
    expect(events).toContainEqual(expect.objectContaining({ type: 'EnemyActed' }));
    expect(state.combatants.every((p) => !p.blockedFromSignal)).toBe(true);
    // Back to the group: the master is asked again.
    expect(state.turn.stage).toBe('awaiting_question');
  });

  it('answers must match the question type', () => {
    const c = content();
    const s = start(c);
    let open = step(s, present(s, { questionId: 'q-kit-open-1' }), c).state;
    open = step(open, { type: 'TapSignal', turnToken: open.turnToken, profileId: 'p1' }, c).state;
    expect(
      decide(
        open,
        { type: 'SubmitObjectiveAnswer', turnToken: open.turnToken, profileId: 'p1', index: 0 },
        c,
      ),
    ).toEqual({ ok: false, reason: 'wrong_answer_type' });
    expect(
      decide(s, { type: 'JudgeOpenAnswer', turnToken: s.turnToken, approved: true }, c),
    ).toEqual({
      ok: false,
      reason: 'nothing_to_judge',
    });
  });
});

describe("the master's presence (plan decision 2)", () => {
  const leave = { type: 'MasterPresenceChanged', online: false } as const;
  const back = { type: 'MasterPresenceChanged', online: true } as const;

  it('leaving while a question is awaited falls back to the objective questions', () => {
    const c = content();
    const { state } = step(start(c), leave, c);
    expect(state.masterOnline).toBe(false);
    expect(state.turn).toMatchObject({ stage: 'awaiting_signal', question: { type: 'objective' } });
  });

  it('with only open questions the battle pauses, enemies included, and resumes on return', () => {
    const c = content(true);
    const paused = step(start(c), leave, c);
    expect(paused.state.turn).toEqual({ stage: 'paused', reason: 'master_absent' });
    expect(paused.events.some((e) => e.type === 'EnemyActed')).toBe(false);
    // Timeouts do not apply to a paused battle.
    expect(
      decide(paused.state, { type: 'SignalExpired', turnToken: paused.state.turnToken }, c),
    ).toEqual({
      ok: false,
      reason: 'wrong_stage',
    });
    expect(step(paused.state, back, c).state.turn.stage).toBe('awaiting_question');
  });

  it('a sent answer keeps waiting for his judgement while he is away', () => {
    const c = content();
    const away = step(answerOpen(start(c), c), leave, c).state;
    expect(away.turn.stage).toBe('awaiting_judgement');
    expect(step(away, back, c).state.turn.stage).toBe('awaiting_judgement');
  });

  it('starting without the master uses the objective questions; an unchanged presence is refused', () => {
    const c = content();
    const s = start(c, false);
    expect(s.turn).toMatchObject({ stage: 'awaiting_signal', question: { type: 'objective' } });
    expect(decide(s, leave, c)).toEqual({ ok: false, reason: 'unchanged' });
  });
});
