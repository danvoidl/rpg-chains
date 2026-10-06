import { describe, expect, it } from 'vitest';
import { CampaignSnapshotSchema } from './snapshot.js';
import { ItemSchema } from './content.js';

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
