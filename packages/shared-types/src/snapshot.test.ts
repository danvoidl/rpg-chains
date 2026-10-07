import { describe, expect, it } from 'vitest';
import { CampaignSnapshotSchema } from './snapshot.js';
import { MAX_DROP_CHANCE } from '@rpg-chains/game-config';
import { ItemSchema, VillainSchema } from './content.js';

const emptySnapshot = {
  schemaVersion: 1,
  campaignId: 'c1',
  version: 1,
  name: 'Campaign',
  description: '',
  chapters: [],
  classes: [],
  villains: [],
  questions: [],
  items: [],
};

describe('CampaignSnapshotSchema (publish gate foundation, decision 5)', () => {
  it('accepts a well-formed snapshot at the current schema version', () => {
    expect(CampaignSnapshotSchema.safeParse(emptySnapshot).success).toBe(true);
  });

  it('rejects a snapshot from a different schema version', () => {
    expect(CampaignSnapshotSchema.safeParse({ ...emptySnapshot, schemaVersion: 2 }).success).toBe(
      false,
    );
  });
});

describe('ItemSchema structural gate', () => {
  it('rejects a weapon slot without weapon stats (spec §6)', () => {
    const result = ItemSchema.safeParse({
      category: 'equipment',
      id: 'i1',
      name: 'Sword',
      slot: 'weapon',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid weapon', () => {
    const result = ItemSchema.safeParse({
      category: 'equipment',
      id: 'i1',
      name: 'Sword',
      slot: 'weapon',
      weapon: { weaponType: 'light', baseDamage: 10, scalingAttribute: 'dexterity', scale: 2 },
    });
    expect(result.success).toBe(true);
  });
});

describe('economy fields (Fase 4 plan decision 14)', () => {
  const rat = {
    id: 'v1',
    name: 'Rat',
    hp: 15,
    attributes: { strength: 0, dexterity: 0, intelligence: 0, defense: 0 },
    attacks: [{ id: 'a1', name: 'Bite', baseDamage: 1, targetType: 'single', cooldownRounds: 0 }],
  };
  const potion = {
    category: 'consumable',
    id: 'i1',
    name: 'Potion',
    effect: { type: 'heal', target: 'self', magnitude: { mode: 'fixed', value: 5 } },
  };

  it('keeps a snapshot published before them valid, with no reward and no price', () => {
    const parsed = CampaignSnapshotSchema.parse({
      ...emptySnapshot,
      villains: [rat],
      items: [potion],
    });
    expect(parsed.villains[0]).toMatchObject({ xpReward: 0, goldReward: 0, drops: [] });
    expect(parsed.items[0]!.price).toBe(0);
  });

  it('caps a drop chance below certainty', () => {
    const villain = (chance: number) => ({ ...rat, drops: [{ itemId: 'i1', chance }] });
    expect(VillainSchema.safeParse(villain(MAX_DROP_CHANCE)).success).toBe(true);
    expect(VillainSchema.safeParse(villain(1)).success).toBe(false);
    expect(VillainSchema.safeParse(villain(0)).success).toBe(false);
  });
});
