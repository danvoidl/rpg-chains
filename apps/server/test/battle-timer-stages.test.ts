import { describe, expect, it } from 'vitest';
import { timeoutOf } from '../src/services/battle-timers.js';

const objective = { type: 'objective', questionId: 'q', prompt: '?', options: ['a', 'b'] } as const;
const open = { type: 'open', questionId: null, prompt: '?' } as const;

describe('which clock each stage runs (spec §3.3)', () => {
  it('players are timed; an open answer gets its own, longer clock', () => {
    expect(timeoutOf({ stage: 'awaiting_signal', question: open })?.key).toBe('signalMs');
    expect(timeoutOf({ stage: 'awaiting_answer', question: objective, profileId: 'p' })?.key).toBe(
      'answerMs',
    );
    expect(timeoutOf({ stage: 'awaiting_answer', question: open, profileId: 'p' })?.key).toBe(
      'openAnswerMs',
    );
    expect(timeoutOf({ stage: 'awaiting_action', profileId: 'p' })?.key).toBe('actionMs');
  });

  it('the master and a pause are never timed (plan decision 2)', () => {
    expect(timeoutOf({ stage: 'awaiting_question' })).toBeNull();
    expect(
      timeoutOf({ stage: 'awaiting_judgement', question: open, profileId: 'p', answer: 'x' }),
    ).toBeNull();
    expect(timeoutOf({ stage: 'paused', reason: 'master_absent' })).toBeNull();
  });
});
