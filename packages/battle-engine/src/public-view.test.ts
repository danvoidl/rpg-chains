import { describe, expect, it } from 'vitest';
import {
  BattleStateSchema,
  PublicBattleEventSchema,
  PublicBattleStateSchema,
  type BattleEvent,
} from '@rpg-chains/shared-types';
import { basicSnapshot, kitSnapshot } from './fixtures/load.js';
import openSignalFixture from './fixtures/open-signal.json';
import { toPublicEvent, toPublicQuestion, toPublicState } from './public-view.js';

/** Keys that would let a client cheat: predict draws, see upcoming questions, read answers. */
const SECRET_KEYS = ['secret', 'seed', 'prng', 'cursor', 'questionDeck', 'deck', 'correctIndex'];

/** Every object key anywhere in a JSON-serializable value. */
function keysOf(value: unknown): Set<string> {
  const keys = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v !== null && typeof v === 'object') {
      for (const [key, inner] of Object.entries(v)) {
        keys.add(key);
        walk(inner);
      }
    }
  };
  walk(value);
  return keys;
}

function leaked(value: unknown): string[] {
  const keys = keysOf(value);
  return SECRET_KEYS.filter((key) => keys.has(key));
}

const state = () => BattleStateSchema.parse(structuredClone(openSignalFixture));

describe('public projections leak nothing (Fase 3 plan decision 13)', () => {
  it('the fixture state does carry secrets, so the check below is meaningful', () => {
    expect(leaked(state())).not.toEqual([]);
  });

  it('toPublicState drops the secret part and matches the public contract', () => {
    const visible = toPublicState(state());
    expect(leaked(visible)).toEqual([]);
    expect(PublicBattleStateSchema.parse(visible)).toEqual(visible);
  });

  it('toPublicEvent drops server-only events and strips the genesis secrets', () => {
    const { combatants, enemies } = state();
    const log: BattleEvent[] = [
      {
        type: 'BattleStarted',
        battleId: 'b1',
        nodeId: 'n-battle',
        initiative: 'group',
        combatants,
        enemies,
        enemyQueue: ['e1'],
        needsMaster: false,
        masterOnline: true,
        seed: 42,
        questionDeck: ['q-obj-2', 'q-obj-1'],
      },
      { type: 'PrngAdvanced', cursor: 3 },
      { type: 'QuestionDeckShuffled', deck: ['q-obj-3'] },
      { type: 'TurnAdvanced', turnToken: 1, to: { side: 'group' } },
      {
        type: 'SignalOpened',
        turnToken: 2,
        question: toPublicQuestion(basicSnapshot().questions[0]!),
      },
    ];
    const visible = log.map(toPublicEvent).filter((e) => e !== null);
    expect(visible.map((e) => e.type)).toEqual(['BattleStarted', 'TurnAdvanced', 'SignalOpened']);
    expect(leaked(visible)).toEqual([]);
    for (const event of visible) expect(PublicBattleEventSchema.parse(event)).toEqual(event);
  });

  it('toPublicQuestion never carries the answer key, for objective and open questions', () => {
    const questions = [...basicSnapshot().questions, ...kitSnapshot().questions];
    expect(questions.some((q) => q.type === 'open')).toBe(true);
    expect(leaked(questions.map(toPublicQuestion))).toEqual([]);
  });
});
