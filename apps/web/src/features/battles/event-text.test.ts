import { describe, expect, it } from 'vitest';
import type { PublicBattleState } from '@rpg-chains/shared-types';
import { describeEvent } from './event-text';

const state = {
  combatants: [{ profileId: 'p1', name: 'Ana' }],
  enemies: [{ instanceId: 'enemy-1', name: 'Rato' }],
} as unknown as PublicBattleState;

describe('describeEvent', () => {
  it('names units and spells out the fight', () => {
    expect(
      describeEvent(
        { type: 'DamageDealt', sourceId: 'p1', targetId: 'enemy-1', hpDamage: 10, absorbed: 0 },
        state,
      ),
    ).toBe('Rato sofreu 10 de dano.');
    expect(
      describeEvent(
        {
          type: 'EnemyActed',
          instanceId: 'enemy-1',
          attackId: 'a-bite',
          targetIds: ['p1'],
          redirectedBy: null,
          cooldown: 0,
        },
        state,
      ),
    ).toBe('Rato atacou Ana.');
    expect(describeEvent({ type: 'TurnLost', reason: 'signal_expired' }, state)).toBe(
      'Ninguém tocou o sinal a tempo.',
    );
  });

  it('tells a dropped connection from a pause for the group (Fase 6)', () => {
    expect(describeEvent({ type: 'PlayerDisconnected', profileId: 'p1' }, state)).toBe(
      'Ana perdeu a conexão.',
    );
    expect(describeEvent({ type: 'PlayerReconnected', profileId: 'p1' }, state)).toBe(
      'Ana reconectou.',
    );
    expect(
      describeEvent({ type: 'BattlePaused', turnToken: 3, reason: 'all_disconnected' }, state),
    ).toBe('Batalha pausada: ninguém do grupo está conectado.');
  });

  it('skips bookkeeping', () => {
    expect(describeEvent({ type: 'EnergyChanged', targetId: 'p1', delta: 10 }, state)).toBeNull();
  });
});
