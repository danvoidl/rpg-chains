import { describe, expect, it } from 'vitest';
import type { CampaignDraft, DraftClass, DraftSkill, Effect } from '@rpg-chains/shared-types';
import { validDraft } from './fixtures/load.js';
import { contentPools, validateDraft } from './validate-draft.js';

function knight(draft: CampaignDraft): DraftClass {
  return draft.classes[0]!;
}

function strike(draft: CampaignDraft): DraftSkill {
  return knight(draft).skills[0]!;
}

function withEffect(effect: Effect): CampaignDraft {
  const draft = validDraft();
  strike(draft).effect = effect;
  return draft;
}

function codes(draft: CampaignDraft): string[] {
  return validateDraft(draft).map((issue) => issue.code);
}

describe('validateDraft — classes and skills (Fase 1b)', () => {
  it('accepts the valid fixture class', () => {
    expect(validateDraft(validDraft())).toEqual([]);
  });

  it('requires at least one class', () => {
    const draft = validDraft();
    draft.classes = [];
    expect(codes(draft)).toEqual(['no_classes']);
  });

  it('requires a base weapon that exists and is in the weapon slot', () => {
    const missing = validDraft();
    knight(missing).baseWeaponId = null;
    expect(validateDraft(missing)).toEqual([
      expect.objectContaining({
        code: 'base_weapon_invalid',
        path: 'classes[0].baseWeaponId',
        classId: 'cl-knight',
      }),
    ]);

    const unknown = validDraft();
    knight(unknown).baseWeaponId = 'gone';
    expect(codes(unknown)).toEqual(['base_weapon_invalid']);

    const helmet = validDraft();
    helmet.items.push({
      category: 'equipment',
      id: 'it-helm',
      name: 'Helm',
      slot: 'helmet',
      requirements: {},
      defenseBonus: 5,
    });
    knight(helmet).baseWeaponId = 'it-helm';
    expect(codes(helmet)).toEqual(['base_weapon_invalid']);
  });

  it('blocks a skill with zero energy cost and zero cooldown, but not just one of them', () => {
    const free = validDraft();
    strike(free).energyCost = 0;
    strike(free).cooldownRounds = 0;
    expect(validateDraft(free)).toEqual([
      expect.objectContaining({ code: 'skill_free', skillId: 'sk-strike' }),
    ]);

    const noCost = validDraft();
    strike(noCost).energyCost = 0;
    expect(codes(noCost)).toEqual([]);
  });

  it('rejects a target that does not fit the effect type', () => {
    const draft = withEffect({
      type: 'heal',
      target: 'enemy',
      magnitude: { mode: 'fixed', value: 20 },
    });
    expect(validateDraft(draft)).toEqual([
      expect.objectContaining({
        code: 'invalid_target',
        path: 'classes[0].skills[0].effect.target',
      }),
    ]);
    expect(codes(withEffect({ type: 'revive', target: 'self', healthPercent: 40 }))).toEqual([
      'invalid_target',
    ]);
    expect(codes(withEffect({ type: 'provoke', duration: 1 }))).toEqual([]);
  });

  it('caps stun and max-hp-reduction durations', () => {
    expect(codes(withEffect({ type: 'stun', target: 'enemy', duration: 1 }))).toEqual([]);
    expect(codes(withEffect({ type: 'stun', target: 'enemy', duration: 2 }))).toEqual([
      'duration_over_cap',
    ]);
    const reduction = (duration: number): Effect => ({
      type: 'max_hp_reduction',
      target: 'enemy',
      magnitude: { mode: 'percent', percent: 10 },
      duration,
    });
    expect(codes(withEffect(reduction(3)))).toEqual([]);
    expect(codes(withEffect(reduction(4)))).toEqual(['duration_over_cap']);
  });

  it('caps revive health at 100%', () => {
    expect(codes(withEffect({ type: 'revive', target: 'ally', healthPercent: 100 }))).toEqual([]);
    expect(codes(withEffect({ type: 'revive', target: 'ally', healthPercent: 101 }))).toEqual([
      'revive_over_cap',
    ]);
  });

  it('reports snapshot shape problems of a class as schema issues', () => {
    const draft = validDraft();
    knight(draft).name = '';
    expect(validateDraft(draft)).toEqual([
      expect.objectContaining({ code: 'schema', path: 'classes[0].name', classId: 'cl-knight' }),
    ]);
  });

  it('lets shops reference real items now that items exist', () => {
    expect(contentPools(validDraft()).itemIds).toEqual(new Set(['it-sword']));
  });
});
