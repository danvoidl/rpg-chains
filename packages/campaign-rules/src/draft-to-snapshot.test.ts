import { describe, expect, it } from 'vitest';
import { CampaignSnapshotSchema, DraftNodeSchema } from '@rpg-chains/shared-types';
import { validDraft } from './fixtures/load.js';
import { draftToSnapshot } from './draft-to-snapshot.js';

describe('draftToSnapshot', () => {
  it('produces a schema-valid snapshot that excludes chapters under construction', () => {
    const result = draftToSnapshot(validDraft(), 3);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(CampaignSnapshotSchema.parse(result.snapshot)).toEqual(result.snapshot);
    expect(result.snapshot.version).toBe(3);
    expect(result.snapshot.chapters.map((c) => c.id)).toEqual(['ch-1']);
    expect(result.snapshot.classes.map((c) => c.id)).toEqual(['cl-knight']);
    expect(result.snapshot.items.map((i) => i.id)).toEqual(['it-sword']);
  });

  it('round-trips classes and skills: every draft column survives (drift guard)', () => {
    const draft = validDraft();
    draft.classes[0]!.artUrl = 'https://cdn.test/knight.png';
    draft.classes[0]!.skills[0]!.iconUrl = 'https://cdn.test/strike.png';
    const result = draftToSnapshot(draft, 1);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    const { artUrl, baseWeaponId, skills, ...rest } = result.snapshot.classes[0]!;
    expect({
      ...rest,
      artUrl: artUrl ?? null,
      baseWeaponId: baseWeaponId ?? null,
      skills: skills.map((s) => ({ ...s, iconUrl: s.iconUrl ?? null })),
    }).toEqual(draft.classes[0]);
  });

  it('maps draft columns onto snapshot fields', () => {
    const result = draftToSnapshot(validDraft(), 1);
    if (!result.ok) throw new Error('expected ok');
    const nodes = result.snapshot.chapters[0]!.nodes;
    expect(nodes.find((n) => n.id === 'n-a')).toEqual({
      id: 'n-a',
      title: 'Gate battle',
      type: 'battle',
      prerequisites: ['n-entry'],
      mandatory: true,
      recommendedLevel: 1,
      participantLimit: 3,
      position: { x: -100, y: 100 },
      villainIds: ['v-1'],
      questionIds: ['q-obj'],
    });
    expect(nodes.find((n) => n.id === 'n-entry')).toMatchObject({ text: 'It begins.' });
    expect(result.snapshot.villains[0]).toEqual({
      id: 'v-1',
      name: 'Chain Warden',
      hp: 120,
      attributes: { strength: 5, dexterity: 3, intelligence: 2, defense: 4 },
      attacks: validDraft().villains[0]!.attacks,
    });
  });

  it('round-trips: every draft node field survives into the snapshot (drift guard)', () => {
    const draft = validDraft();
    const result = draftToSnapshot(draft, 1);
    if (!result.ok) throw new Error('expected ok');
    for (const draftNode of draft.chapters[0]!.nodes) {
      const snapshotNode = result.snapshot.chapters[0]!.nodes.find((n) => n.id === draftNode.id)!;
      // Re-derive the draft node from the snapshot node and compare.
      const { type, id, title, prerequisites, mandatory, position } = snapshotNode;
      const rebuilt = DraftNodeSchema.parse({
        id,
        title,
        type,
        prerequisites,
        mandatory,
        position,
        recommendedLevel: 'recommendedLevel' in snapshotNode ? snapshotNode.recommendedLevel : null,
        participantLimit: 'participantLimit' in snapshotNode ? snapshotNode.participantLimit : null,
        config:
          snapshotNode.type === 'battle' || snapshotNode.type === 'boss'
            ? { villainIds: snapshotNode.villainIds, questionIds: snapshotNode.questionIds }
            : snapshotNode.type === 'shop'
              ? { itemIds: snapshotNode.itemIds }
              : snapshotNode.type === 'narrative'
                ? { text: snapshotNode.text, videoUrl: snapshotNode.videoUrl ?? null }
                : {},
      });
      expect(rebuilt).toEqual(draftNode);
    }
  });

  it('carries the chapter background map (prepared for the map editor)', () => {
    const draft = validDraft();
    const background = { imageUrl: 'https://cdn.test/map.png', width: 2048, height: 1536 };
    draft.chapters[0]!.background = background;
    const result = draftToSnapshot(draft, 1);
    if (!result.ok) throw new Error('expected ok');
    expect(result.snapshot.chapters[0]!.background).toEqual(background);
    const withoutMap = draftToSnapshot(validDraft(), 1);
    if (!withoutMap.ok) throw new Error('expected ok');
    expect(withoutMap.snapshot.chapters[0]!.background).toBeUndefined();
  });

  it('refuses an invalid draft with its issues', () => {
    const draft = validDraft();
    draft.chapters[0]!.bossNodeId = null;
    const result = draftToSnapshot(draft, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.code).toBe('boss_missing');
  });
});
