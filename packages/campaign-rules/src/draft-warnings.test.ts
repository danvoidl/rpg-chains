import { describe, expect, it } from 'vitest';
import type { CampaignDraft, DraftSkill, Effect } from '@rpg-chains/shared-types';
import { validDraft } from './fixtures/load.js';
import { draftWarnings } from './draft-warnings.js';

function strike(draft: CampaignDraft): DraftSkill {
  return draft.classes[0]!.skills[0]!;
}

function warningsFor(effect: Effect): string[] {
  const draft = validDraft();
  strike(draft).effect = effect;
  return draftWarnings(draft).map((w) => `${w.code}:${w.path}`);
}

describe('draftWarnings (non-blocking balancing bands)', () => {
  it('has no warnings for the in-band fixture', () => {
    expect(draftWarnings(validDraft())).toEqual([]);
  });

  it('warns about class base values outside the recommended bands', () => {
    const draft = validDraft();
    draft.classes[0]!.baseHp = 200;
    expect(draftWarnings(draft)).toEqual([
      expect.objectContaining({
        code: 'class_base_out_of_band',
        path: 'classes[0].baseHp',
        value: 200,
        band: { min: 80, max: 120 },
        classId: 'cl-knight',
      }),
    ]);
  });

  it('warns about skill cost and cooldown outside the bands', () => {
    const draft = validDraft();
    strike(draft).energyCost = 60;
    strike(draft).cooldownRounds = 1;
    expect(draftWarnings(draft).map((w) => w.code)).toEqual([
      'skill_cost_out_of_band',
      'skill_cooldown_out_of_band',
    ]);
  });

  it('uses the area band for effects that hit a whole side', () => {
    const fixed = (target: 'enemy' | 'all_enemies'): Effect => ({
      type: 'damage',
      target,
      magnitude: { mode: 'fixed', value: 30 },
    });
    expect(warningsFor(fixed('enemy'))).toEqual([]);
    expect(warningsFor(fixed('all_enemies'))).toEqual([
      'magnitude_out_of_band:classes[0].skills[0].effect.magnitude.value',
    ]);
  });

  it('checks scaling base and scale separately', () => {
    expect(
      warningsFor({
        type: 'damage',
        target: 'enemy',
        magnitude: { mode: 'scaling', base: 50, attribute: 'dexterity', scale: 5 },
      }),
    ).toEqual([
      'magnitude_out_of_band:classes[0].skills[0].effect.magnitude.base',
      'magnitude_out_of_band:classes[0].skills[0].effect.magnitude.scale',
    ]);
  });

  it('picks the flat buff band by stat kind', () => {
    const buff = (attribute: 'strength' | 'defense', value: number): Effect => ({
      type: 'buff_attribute',
      target: 'self',
      attribute,
      magnitude: { mode: 'fixed', value },
      duration: 2,
    });
    expect(warningsFor(buff('defense', 20))).toEqual([]);
    expect(warningsFor(buff('strength', 20))).toEqual([
      'magnitude_out_of_band:classes[0].skills[0].effect.magnitude.value',
    ]);
  });

  it('warns about durations, with the provoke band for provoke', () => {
    expect(warningsFor({ type: 'provoke', duration: 3 })).toEqual([
      'duration_out_of_band:classes[0].skills[0].effect.duration',
    ]);
    expect(
      warningsFor({
        type: 'shield',
        target: 'self',
        magnitude: { mode: 'fixed', value: 20 },
        duration: 6,
      }),
    ).toEqual(['duration_out_of_band:classes[0].skills[0].effect.duration']);
  });

  it('does not warn twice about a duration that is already over its hard cap', () => {
    expect(warningsFor({ type: 'stun', target: 'enemy', duration: 5 })).toEqual([]);
  });

  it('warns when class slots add up to less than a whole group', () => {
    const draft = validDraft();
    draft.classes[0]!.maxSlots = 3;
    expect(draftWarnings(draft)).toEqual([
      expect.objectContaining({ code: 'total_slots_low', path: 'classes', value: 3 }),
    ]);
  });
});
