import { describe, expect, it } from 'vitest';
import type { CampaignDraft } from '@rpg-chains/shared-types';
import { validDraft } from './fixtures/load.js';
import { defaultKitInputs } from './default-kit.js';
import { draftWarnings } from './draft-warnings.js';
import { validateDraft } from './validate-draft.js';

/** The fixture draft with its classes replaced by the default kit, as an import would leave it. */
function draftWithKit(): CampaignDraft {
  const draft = validDraft();
  const kit = defaultKitInputs();
  draft.items = kit.map(
    ({ key, weapon }) => ({ ...weapon, id: `it-${key}` }) as CampaignDraft['items'][number],
  );
  // The fixture's drop points at an item the kit replaced.
  for (const villain of draft.villains) villain.drops = [];
  draft.classes = kit.map(({ key, class: cls }) => ({
    id: `cl-${key}`,
    name: cls.name,
    description: cls.description ?? '',
    artUrl: null,
    baseHp: cls.baseHp,
    baseEnergy: cls.baseEnergy,
    hpPerLevel: cls.hpPerLevel,
    energyPerLevel: cls.energyPerLevel,
    maxSlots: cls.maxSlots,
    baseWeaponId: `it-${key}`,
    skills: (cls.skills ?? []).map((skill, s) => ({
      id: `sk-${key}-${s}`,
      name: skill.name,
      iconUrl: null,
      text: skill.text ?? '',
      energyCost: skill.energyCost,
      cooldownRounds: skill.cooldownRounds,
      unlockLevel: skill.unlockLevel,
      effect: skill.effect,
    })),
  }));
  return draft;
}

describe('default kit (spec §4.3, §9)', () => {
  it('parses into four classes with four skills and a weapon each', () => {
    const kit = defaultKitInputs();
    expect(kit.map((entry) => entry.key)).toEqual(['guardian', 'penitent', 'herald', 'priest']);
    for (const entry of kit) {
      expect(entry.class.skills).toHaveLength(4);
      expect(entry.weapon).toMatchObject({ category: 'equipment', slot: 'weapon' });
    }
  });

  it('passes the publish gate with no issues and no balancing warnings', () => {
    const draft = draftWithKit();
    expect(validateDraft(draft)).toEqual([]);
    expect(draftWarnings(draft)).toEqual([]);
  });
});
