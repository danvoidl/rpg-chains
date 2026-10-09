import type {
  ActiveEffect,
  BattleEvent,
  BattleState,
  Combatant,
  Enemy,
} from '@rpg-chains/shared-types';
import { upsertEffect } from './stacking.js';
import {
  effectiveMaxHp,
  endRound,
  heal,
  rotateQueue,
  takeDamage,
  tickCooldowns,
  updateCombatant,
  updateEnemy,
  updateUnit,
} from './evolve-units.js';

/** The state a log folds from: `BattleStarted` fills in everything (Fase 3 plan decision 12). */
export function emptyBattle(battleId: string): BattleState {
  return {
    battleId,
    nodeId: '',
    round: 0,
    turnToken: 0,
    turn: { stage: 'starting' },
    enemyQueue: [],
    combatants: [],
    enemies: [],
    needsMaster: false,
    masterOnline: false,
    result: null,
    rewards: [],
    secret: { prng: { seed: 0, cursor: 0 }, questionDeck: [] },
  };
}

/**
 * Pure fold: state + event → next state (CLAUDE.md "battle engine"). Deterministic, side-effect
 * free, and it never reads campaign content: events carry resolved numbers.
 */
export function evolve(state: BattleState, event: BattleEvent): BattleState {
  switch (event.type) {
    case 'BattleStarted':
      return {
        ...state,
        battleId: event.battleId,
        nodeId: event.nodeId,
        combatants: event.combatants,
        enemies: event.enemies,
        enemyQueue: event.enemyQueue,
        needsMaster: event.needsMaster,
        masterOnline: event.masterOnline,
        secret: { prng: { seed: event.seed, cursor: 0 }, questionDeck: event.questionDeck },
      };

    case 'PrngAdvanced':
      return {
        ...state,
        secret: { ...state.secret, prng: { ...state.secret.prng, cursor: event.cursor } },
      };

    case 'QuestionDeckShuffled':
      return { ...state, secret: { ...state.secret, questionDeck: event.deck } };

    /* ------------------------------------------------------------- turn stages ---- */

    case 'TurnAdvanced':
      return event.to.side === 'group'
        ? { ...state, turnToken: event.turnToken, round: state.round + 1 }
        : {
            ...state,
            turnToken: event.turnToken,
            turn: { stage: 'enemy', instanceId: event.to.instanceId },
          };

    case 'QuestionRequested':
      return { ...state, turnToken: event.turnToken, turn: { stage: 'awaiting_question' } };

    case 'SignalOpened': {
      const [head, ...rest] = state.secret.questionDeck;
      // Drawing from the deck consumes its head; a master's question leaves the deck alone.
      const questionDeck = head === event.question.questionId ? rest : state.secret.questionDeck;
      return {
        ...state,
        turnToken: event.turnToken,
        turn: { stage: 'awaiting_signal', question: event.question },
        secret: { ...state.secret, questionDeck },
      };
    }

    case 'SignalWonBy':
      if (state.turn.stage !== 'awaiting_signal') return state;
      return {
        ...state,
        turnToken: event.turnToken,
        turn: {
          stage: 'awaiting_answer',
          question: state.turn.question,
          profileId: event.profileId,
        },
      };

    case 'OpenAnswerSubmitted':
      if (state.turn.stage !== 'awaiting_answer') return state;
      return {
        ...state,
        turnToken: event.turnToken,
        turn: {
          stage: 'awaiting_judgement',
          question: state.turn.question,
          profileId: event.profileId,
          answer: event.text,
        },
      };

    case 'AnswerJudged':
      return {
        ...state,
        turnToken: event.turnToken,
        turn: event.correct ? { stage: 'awaiting_action', profileId: event.profileId } : state.turn,
      };

    case 'BattlePaused':
      return {
        ...state,
        turnToken: event.turnToken,
        turn: { stage: 'paused', reason: event.reason },
      };

    case 'RoundEnded':
      return {
        ...state,
        combatants: state.combatants.map((c) => ({
          ...endRound(c, event.round),
          blockedFromSignal: c.profileId === event.blocked,
        })),
        enemies: state.enemies.map((e) => endRound(e, event.round)),
      };

    case 'RewardsGranted':
      return { ...state, rewards: event.rewards };

    case 'BattleResolved':
      return { ...state, result: event.result, turn: { stage: 'ended' } };

    /* ---------------------------------------------------------- unit changes ---- */

    case 'DamageDealt':
      return updateUnit(state, event.targetId, (unit) =>
        takeDamage(unit, event.hpDamage, event.absorbed),
      );

    case 'Healed':
      return updateUnit(state, event.targetId, (unit) => heal(unit, event.amount));

    case 'OverTimeTicked':
      return updateUnit(state, event.targetId, (unit) =>
        event.kind === 'damage_over_time'
          ? takeDamage(unit, event.amount, 0)
          : heal(unit, event.amount),
      );

    case 'EnergyChanged':
      return updateCombatant(state, event.targetId, (c) => ({
        ...c,
        currentEnergy: Math.min(c.maxEnergy, Math.max(0, c.currentEnergy + event.delta)),
      }));

    case 'EffectApplied':
      return updateUnit(state, event.targetId, <U extends Combatant | Enemy>(unit: U): U => {
        const next = { ...unit, effects: upsertEffect(unit.effects, event.effect) };
        return { ...next, currentHp: Math.min(next.currentHp, effectiveMaxHp(next)) };
      });

    case 'EffectRemoved':
      return updateUnit(state, event.targetId, (unit) => ({
        ...unit,
        effects: unit.effects.filter((effect) => effect.id !== event.effectId),
      }));

    case 'CooldownStarted':
      return updateCombatant(state, event.profileId, (c) => ({
        ...c,
        // The round of use does not count: back after `rounds` whole rounds (spec §5.5).
        cooldowns: { ...c.cooldowns, [event.skillId]: state.round + event.rounds + 1 },
      }));

    case 'ConsumableUsed':
      return updateCombatant(state, event.profileId, (c) => ({
        ...c,
        consumables: c.consumables.flatMap((slot) =>
          slot.itemId !== event.itemId
            ? [slot]
            : slot.quantity > 1
              ? [{ ...slot, quantity: slot.quantity - 1 }]
              : [],
        ),
      }));

    case 'EnemyActed': {
      // A villain's own turn passes: its attack cooldowns tick, then the used attack waits.
      const acted = updateEnemy(state, event.instanceId, (e) => {
        const cooldowns = tickCooldowns(e.attackCooldowns);
        if (event.cooldown > 0) cooldowns[event.attackId] = event.cooldown;
        return { ...e, attackCooldowns: cooldowns };
      });
      return rotateQueue(acted, event.instanceId);
    }

    case 'EnemyTurnSkipped': {
      const skipped = updateEnemy(state, event.instanceId, (e) => ({
        ...e,
        attackCooldowns: tickCooldowns(e.attackCooldowns),
        effects: e.effects.flatMap((effect): ActiveEffect[] =>
          effect.kind !== 'stun'
            ? [effect]
            : effect.turns > 1
              ? [{ ...effect, turns: effect.turns - 1 }]
              : [],
        ),
      }));
      return rotateQueue(skipped, event.instanceId);
    }

    case 'ProvokeConsumed':
      return updateCombatant(state, event.profileId, (c) => ({
        ...c,
        effects: c.effects.flatMap((effect): ActiveEffect[] =>
          effect.kind !== 'provoke'
            ? [effect]
            : effect.attacks > 1
              ? [{ ...effect, attacks: effect.attacks - 1 }]
              : [],
        ),
      }));

    case 'PlayerDowned':
      // Falling clears every effect; cooldowns stay (spec §3.7).
      return updateCombatant(state, event.profileId, (c) => ({
        ...c,
        currentHp: 0,
        downed: true,
        effects: [],
      }));

    case 'PlayerRevived':
      return updateCombatant(state, event.profileId, (c) => ({
        ...c,
        downed: false,
        currentHp: event.hp,
      }));

    case 'EnemyDefeated':
      return {
        ...updateEnemy(state, event.instanceId, (e) => ({ ...e, currentHp: 0, effects: [] })),
        enemyQueue: state.enemyQueue.filter((id) => id !== event.instanceId),
      };

    case 'PlayerLeft':
      return updateCombatant(state, event.profileId, (c) => ({ ...c, left: true }));

    case 'PlayerDisconnected':
      return updateCombatant(state, event.profileId, (c) => ({ ...c, connected: false }));

    case 'PlayerReconnected':
      return updateCombatant(state, event.profileId, (c) => ({ ...c, connected: true }));

    case 'MasterPresenceChanged':
      return { ...state, masterOnline: event.online };

    case 'TurnLost':
    case 'ActionTaken':
      // Narrative facts for the log and the client; the state changes they cause are separate events.
      return state;

    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

/** Fold an entire event log into final state (replay / reconnection). */
export function replay(initial: BattleState, events: readonly BattleEvent[]): BattleState {
  return events.reduce(evolve, initial);
}
