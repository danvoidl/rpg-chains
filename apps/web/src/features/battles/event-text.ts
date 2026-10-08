import type { PublicBattleEvent, PublicBattleState } from '@rpg-chains/shared-types';
import { effectLabel } from './effect-label';

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
    case 'ActionTaken': {
      const actor = state.combatants.find((c) => c.profileId === event.profileId);
      const { action } = event;
      if (action.type === 'attack')
        return `${name(event.profileId)} atacou ${name(action.targetInstanceId)}.`;
      const what =
        action.type === 'skill'
          ? (actor?.skills.find((s) => s.id === action.skillId)?.name ?? 'uma habilidade')
          : (actor?.consumables.find((c) => c.itemId === action.itemId)?.name ?? 'um item');
      const on = action.targetId ? ` em ${name(action.targetId)}` : '';
      return `${name(event.profileId)} usou ${what}${on}.`;
    }
    case 'EffectApplied':
      return `${name(event.targetId)}: ${effectLabel(event.effect).text}.`;
    case 'EffectRemoved':
      return event.reason === 'dispelled'
        ? `Um efeito de ${name(event.targetId)} foi dissipado.`
        : null;
    case 'OverTimeTicked':
      return event.kind === 'damage_over_time'
        ? `${name(event.targetId)} sofreu ${event.amount} de dano contínuo.`
        : `${name(event.targetId)} recuperou ${event.amount} de vida.`;
    case 'ProvokeConsumed':
      return `${name(event.profileId)} atraiu o ataque.`;
    case 'OpenAnswerSubmitted':
      return `${name(event.profileId)} respondeu: “${event.text}”`;
    case 'QuestionRequested':
      return 'O mestre está escolhendo a pergunta.';
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
