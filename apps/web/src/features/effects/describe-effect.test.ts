import { describe, expect, it } from 'vitest';
import { describeEffect, type EffectUser } from './describe-effect';

const user: EffectUser = {
  attribute: (name) => ({ strength: 3, dexterity: 0, intelligence: 4 })[name],
  basicAttack: 16,
};

describe('describeEffect', () => {
  it('works out damage from the basic attack, and scaling from the user attributes', () => {
    expect(
      describeEffect(
        { type: 'damage', target: 'enemy', magnitude: { mode: 'percent', percent: 150 } },
        user,
      ),
    ).toBe('Causa 24 de dano (150% do ataque básico) em um inimigo, reduzido pela defesa.');
    expect(
      describeEffect(
        {
          type: 'heal',
          target: 'ally',
          magnitude: { mode: 'scaling', base: 10, attribute: 'intelligence', scale: 2 },
        },
        user,
      ),
    ).toBe('Cura 18 de vida (10 + Inteligência × 2) em um aliado.');
  });

  it('keeps a percentage of what only the target knows', () => {
    expect(
      describeEffect(
        {
          type: 'shield',
          target: 'all_allies',
          magnitude: { mode: 'percent', percent: 20 },
          duration: 2,
        },
        user,
      ),
    ).toBe(
      'Escudo de 20% da vida máxima do alvo em todos os aliados, por 2 rodadas: absorve dano antes da vida.',
    );
  });

  it('says what control and modifiers do, with their duration', () => {
    expect(describeEffect({ type: 'stun', target: 'enemy', duration: 1 }, user)).toBe(
      'Atordoa um inimigo: perde o próximo turno.',
    );
    expect(
      describeEffect(
        {
          type: 'buff_attribute',
          target: 'self',
          attribute: 'damage',
          magnitude: { mode: 'percent', percent: 30 },
          duration: 3,
        },
        user,
      ),
    ).toBe('+30% de Dano em você, por 3 rodadas.');
    expect(describeEffect({ type: 'provoke', duration: 2 }, user)).toBe(
      'Atrai para você os próximos 2 ataques inimigos.',
    );
  });
});
