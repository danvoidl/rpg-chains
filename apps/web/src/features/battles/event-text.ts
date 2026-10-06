import type { PublicBattleEvent, PublicBattleState } from '@rpg-chains/shared-types';

/** Display name of a combatant or enemy by id. */
export function unitName(state: PublicBattleState, id: string): string {
  return (
    state.combatants.find((c) => c.profileId === id)?.name ??
    state.enemies.find((e) => e.instanceId === id)?.name ??
    '?'
  );
}

const TURN_LOST: Record<Extract<PublicBattleEvent, { type: 'TurnLost' }>['reason'], string> = {
  wrong_answer: 'Resposta errada: o grupo perdeu a vez.',
  signal_expired: 'Ninguém tocou o sinal a tempo.',
  answer_timeout: 'O tempo para responder acabou.',
  action_timeout: 'O tempo para agir acabou.',
  player_left: 'Quem estava na vez saiu: o grupo perdeu a vez.',
};

/**
 * One feed line for an event, or null for bookkeeping not worth a line (energy, cooldowns).
 * Names are looked up in `state`; they never change during a battle.
 */
export function describeEvent(event: PublicBattleEvent, state: PublicBattleState): string | null {
  const name = (id: string) => unitName(state, id);
  switch (event.type) {
    case 'TurnAdvanced':
      return event.to.side === 'group' ? 'Vez do grupo.' : `Vez de ${name(event.to.instanceId)}.`;
    case 'SignalOpened':
      return `Pergunta: ${event.question.prompt}`;
    case 'SignalWonBy':
      return `${name(event.profileId)} tocou o sinal.`;
    case 'AnswerJudged':
      return event.correct
        ? `${name(event.profileId)} acertou!`
        : `${name(event.profileId)} errou.`;
    case 'TurnLost':
      return TURN_LOST[event.reason];
    case 'ActionTaken':
      return event.action.type === 'attack'
        ? `${name(event.profileId)} atacou ${name(event.action.targetInstanceId)}.`
        : null;
    case 'DamageDealt': {
      const shield = event.absorbed > 0 ? ` (escudo absorveu ${event.absorbed})` : '';
      return `${name(event.targetId)} sofreu ${event.hpDamage} de dano${shield}.`;
    }
    case 'Healed':
      return `${name(event.targetId)} recuperou ${event.amount} de vida.`;
    case 'EnemyActed': {
      const targets = event.targetIds.map(name).join(', ');
      return `${name(event.instanceId)} atacou ${targets}.`;
    }
    case 'EnemyTurnSkipped':
      return `${name(event.instanceId)} está atordoado e perdeu a vez.`;
    case 'RoundEnded':
      return `Fim da rodada ${event.round}.`;
    case 'PlayerDowned':
      return `${name(event.profileId)} caiu!`;
    case 'PlayerRevived':
      return `${name(event.profileId)} voltou à luta.`;
    case 'EnemyDefeated':
      return `${name(event.instanceId)} foi derrotado!`;
    case 'PlayerLeft':
      return `${name(event.profileId)} saiu da batalha.`;
    case 'BattlePaused':
      return 'Batalha pausada: o mestre saiu.';
    case 'MasterPresenceChanged':
      return event.online ? 'O mestre voltou.' : 'O mestre saiu.';
    case 'BattleResolved':
      return event.result === 'victory' ? 'Vitória!' : 'Derrota.';
    default:
      return null;
  }
}
