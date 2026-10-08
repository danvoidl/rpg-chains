import { describe, expect, it } from 'vitest';
import { ALLOWED_TARGETS } from '@rpg-chains/shared-types';
import { DEFAULT_CLASS_KIT } from '@rpg-chains/game-config';
import { EffectSchema, type CampaignSnapshot, type Effect } from '@rpg-chains/shared-types';
import { basicSnapshot, catalogSnapshot, kitSnapshot } from './load.js';

/** Every id a node, class or edge points at must resolve inside the same snapshot. */
function brokenReferences(snapshot: CampaignSnapshot): string[] {
  const villains = new Set(snapshot.villains.map((v) => v.id));
  const questions = new Set(snapshot.questions.map((q) => q.id));
  const weapons = new Set(
    snapshot.items
      .filter((i) => i.category === 'equipment' && i.slot === 'weapon')
      .map((i) => i.id),
  );
  const broken: string[] = [];
  for (const cls of snapshot.classes) {
    if (!weapons.has(cls.baseWeaponId)) broken.push(`${cls.id} → ${cls.baseWeaponId}`);
  }
  for (const chapter of snapshot.chapters) {
    const nodes = new Set(chapter.nodes.map((n) => n.id));
    for (const id of [chapter.entryNodeId, chapter.bossNodeId]) {
      if (!nodes.has(id)) broken.push(`${chapter.id} → ${id}`);
    }
    for (const edge of chapter.edges) {
      if (!nodes.has(edge.from) || !nodes.has(edge.to)) broken.push(`${edge.from} → ${edge.to}`);
    }
    for (const node of chapter.nodes) {
      if (node.type !== 'battle' && node.type !== 'boss') continue;
      for (const id of node.villainIds) if (!villains.has(id)) broken.push(`${node.id} → ${id}`);
      for (const id of node.questionIds) if (!questions.has(id)) broken.push(`${node.id} → ${id}`);
    }
  }
  return broken;
}

/** Every effect a fixture carries, from skills and consumables. */
function effects(snapshot: CampaignSnapshot): Effect[] {
  return [
    ...snapshot.classes.flatMap((cls) => cls.skills.map((skill) => skill.effect)),
    ...snapshot.items.flatMap((item) => (item.category === 'consumable' ? [item.effect] : [])),
  ];
}

function invalidTargets(snapshot: CampaignSnapshot): Effect[] {
  return effects(snapshot).filter(
    (effect) => effect.type !== 'provoke' && !ALLOWED_TARGETS[effect.type].includes(effect.target),
  );
}

const fixtures = { basic: basicSnapshot, catalog: catalogSnapshot, kit: kitSnapshot };

describe.each(Object.entries(fixtures))('engine fixture %s', (_name, load) => {
  it('parses as a published snapshot with every reference resolved', () => {
    expect(brokenReferences(load())).toEqual([]);
  });

  it('only targets what each effect type allows', () => {
    expect(invalidTargets(load())).toEqual([]);
  });

  it('keeps skill ids unique across classes', () => {
    const ids = load().classes.flatMap((cls) => cls.skills.map((skill) => skill.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('fixture coverage', () => {
  it('basic has no skills: stage A is basic attacks only', () => {
    expect(basicSnapshot().classes.flatMap((cls) => cls.skills)).toEqual([]);
  });

  it('catalog covers all 13 effect types as level-1 skills', () => {
    const allTypes = EffectSchema.options.map((option) => option.shape.type.value);
    const skills = catalogSnapshot().classes.flatMap((cls) => cls.skills);
    expect(new Set(skills.map((skill) => skill.effect.type))).toEqual(new Set(allTypes));
    expect(skills.every((skill) => skill.unlockLevel === 1)).toBe(true);
  });

  it('kit mirrors the default kit from game-config', () => {
    const kit = kitSnapshot();
    expect(kit.classes.map((cls) => cls.id)).toEqual(DEFAULT_CLASS_KIT.map((t) => `cl-${t.key}`));
    expect(kit.classes.map((cls) => cls.skills.length)).toEqual(
      DEFAULT_CLASS_KIT.map((t) => t.skills.length),
    );
    expect(kit.questions.some((q) => q.type === 'open')).toBe(true);
  });
});
