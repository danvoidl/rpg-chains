import { describe, expect, it } from 'vitest';
import type { CampaignSnapshot, CharacterClass } from '@rpg-chains/shared-types';
import { validDraft } from './fixtures/load.js';
import { draftToSnapshot } from './draft-to-snapshot.js';
import { checkCompatibility } from './check-compatibility.js';

function guardian(): CharacterClass {
  return {
    id: 'cls-guardian',
    name: 'Guardian',
    description: '',
    baseHp: 120,
    baseEnergy: 40,
    hpPerLevel: 12,
    energyPerLevel: 3,
    maxSlots: 2,
    baseWeaponId: 'item-sword',
    skills: [
      {
        id: 'sk-taunt',
        name: 'Taunt',
        text: '',
        energyCost: 10,
        cooldownRounds: 2,
        unlockLevel: 1,
        effect: { type: 'provoke', duration: 1 },
      },
    ],
  };
}

/** v1: the valid draft fixture, plus a class and an item (not authorable until 1b/4). */
function published(): CampaignSnapshot {
  const result = draftToSnapshot(validDraft(), 1);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return {
    ...result.snapshot,
    classes: [guardian()],
    items: [
      {
        category: 'equipment',
        id: 'item-sword',
        name: 'Sword',
        slot: 'weapon',
        requirements: {},
        defenseBonus: 0,
        weapon: { weaponType: 'light', baseDamage: 5, scalingAttribute: 'strength', scale: 1 },
      },
    ],
  };
}

function rules(prev: CampaignSnapshot, next: CampaignSnapshot): string[] {
  return checkCompatibility(prev, next).map((v) => `${v.rule}:${v.entityId}`);
}

describe('checkCompatibility — allowed (spec §2.2.1)', () => {
  it('accepts an identical version', () => {
    expect(rules(published(), { ...published(), version: 2 })).toEqual([]);
  });

  it('accepts additive content: chapter, node, edge, class, villain, attack, question, item, skill', () => {
    const next = published();
    const chapter = next.chapters[0]!;
    chapter.nodes.push({
      type: 'campfire',
      id: 'n-new',
      prerequisites: [],
      mandatory: false,
      position: { x: 0, y: 0 },
    });
    chapter.edges.push({ from: 'n-entry', to: 'n-new' }, { from: 'n-new', to: 'n-boss' });
    next.chapters.push({ ...structuredClone(chapter), id: 'ch-new', nodes: [], edges: [] });
    next.classes.push({ ...guardian(), id: 'cls-new', skills: [] });
    next.classes[0]!.skills.push({ ...guardian().skills[0]!, id: 'sk-new' });
    next.villains[0]!.attacks.push({
      id: 'atk-new',
      name: 'Bite',
      baseDamage: 3,
      targetType: 'area',
      cooldownRounds: 1,
    });
    next.villains.push({ ...next.villains[0]!, id: 'v-new' });
    next.questions.push({ id: 'q-new', type: 'open', prompt: 'Why?' });
    next.items.push({
      category: 'consumable',
      id: 'item-potion',
      name: 'Potion',
      effect: { type: 'heal', target: 'self', magnitude: { mode: 'fixed', value: 10 } },
    });
    expect(rules(published(), next)).toEqual([]);
  });

  it('accepts text/art edits (incl. node titles and chapter map), question fixes and number rebalancing', () => {
    const next = published();
    next.name = 'Renamed';
    next.chapters[0]!.nodes[0]!.title = 'Renamed node';
    next.chapters[0]!.background = {
      imageUrl: 'https://cdn.test/map.png',
      width: 800,
      height: 600,
    };
    next.villains[0]!.name = 'Renamed villain';
    next.villains[0]!.hp = 999;
    next.villains[0]!.attacks[0]!.baseDamage = 42;
    const question = next.questions[0]!;
    if (question.type !== 'objective') throw new Error('fixture drift');
    question.options = ['4', '5', '6'];
    question.correctIndex = 0;
    const skill = next.classes[0]!.skills[0]!;
    skill.energyCost = 30;
    skill.cooldownRounds = 5;
    skill.unlockLevel = 3;
    expect(rules(published(), next)).toEqual([]);
  });

  it('accepts raising class slots', () => {
    const next = published();
    next.classes[0]!.maxSlots = 5;
    expect(rules(published(), next)).toEqual([]);
  });
});

describe('checkCompatibility — forbidden (spec §2.2.1), one fixture per rule', () => {
  it.each([
    // A deleted class takes its skills with it.
    [
      'class',
      (s: CampaignSnapshot) => void (s.classes = []),
      ['entity_deleted:cls-guardian', 'entity_deleted:sk-taunt'],
    ],
    [
      'skill',
      (s: CampaignSnapshot) => void (s.classes[0]!.skills = []),
      ['entity_deleted:sk-taunt'],
    ],
    [
      'question',
      (s: CampaignSnapshot) => void (s.questions = s.questions.slice(1)),
      ['entity_deleted:q-obj'],
    ],
    ['item', (s: CampaignSnapshot) => void (s.items = []), ['entity_deleted:item-sword']],
    ['villain', (s: CampaignSnapshot) => void (s.villains = []), ['entity_deleted:v-1']],
  ])('refuses deleting a %s', (_entity, mutate, expected) => {
    const next = published();
    mutate(next);
    expect(rules(published(), next)).toEqual(expected);
  });

  it('refuses deleting a node', () => {
    const next = published();
    const chapter = next.chapters[0]!;
    chapter.nodes = chapter.nodes.filter((n) => n.id !== 'n-b');
    chapter.edges = chapter.edges.filter((e) => e.from !== 'n-b' && e.to !== 'n-b');
    expect(rules(published(), next)).toEqual(['entity_deleted:n-b']);
  });

  it('refuses deleting a chapter (its nodes go with it)', () => {
    const next = published();
    next.chapters = [];
    expect(rules(published(), next)).toEqual([
      'entity_deleted:n-entry',
      'entity_deleted:n-a',
      'entity_deleted:n-b',
      'entity_deleted:n-boss',
    ]);
  });

  it.each(['baseHp', 'baseEnergy', 'hpPerLevel', 'energyPerLevel', 'baseWeaponId'] as const)(
    'refuses changing class base attribute %s',
    (field) => {
      const next = published();
      const cls = next.classes[0]!;
      if (field === 'baseWeaponId') cls.baseWeaponId = 'item-other';
      else cls[field] += 1;
      const violations = checkCompatibility(published(), next);
      expect(violations.map((v) => v.rule)).toEqual(['class_base_changed']);
      expect(violations[0]!.message).toContain(field);
    },
  );

  it('refuses reducing class slots', () => {
    const next = published();
    next.classes[0]!.maxSlots = 1;
    expect(rules(published(), next)).toEqual(['class_slots_reduced:cls-guardian']);
  });

  it('refuses removing a skill from a class even if it lives on elsewhere', () => {
    const next = published();
    const skill = next.classes[0]!.skills.pop()!;
    next.classes.push({ ...guardian(), id: 'cls-other', skills: [skill] });
    expect(rules(published(), next)).toEqual(['skill_removed:sk-taunt']);
  });

  it('refuses an edge removal that makes a reachable node unreachable', () => {
    const next = published();
    const chapter = next.chapters[0]!;
    chapter.edges = chapter.edges.filter((e) => !(e.from === 'n-entry' && e.to === 'n-b'));
    expect(rules(published(), next)).toEqual(['graph_reachability_broken:n-b']);
  });

  it('accepts an edge removal that keeps every node reachable', () => {
    const next = published();
    const chapter = next.chapters[0]!;
    chapter.edges.push({ from: 'n-a', to: 'n-b' });
    const prev = structuredClone(next);
    chapter.edges = chapter.edges.filter((e) => !(e.from === 'n-a' && e.to === 'n-b'));
    expect(rules(prev, next)).toEqual([]);
  });

  it('refuses reordering published chapters or inserting one before them (Fase 5 plan decision 7)', () => {
    const prev = published();
    prev.chapters.push({ ...structuredClone(prev.chapters[0]!), id: 'ch-b', nodes: [], edges: [] });

    const swapped = structuredClone(prev);
    swapped.chapters.reverse();
    expect(rules(prev, swapped)).toEqual([
      'chapter_order_changed:ch-1',
      'chapter_order_changed:ch-b',
    ]);

    const inserted = structuredClone(prev);
    inserted.chapters.splice(1, 0, { ...structuredClone(prev.chapters[1]!), id: 'ch-new' });
    expect(rules(prev, inserted)).toEqual(['chapter_order_changed:ch-b']);

    const appended = structuredClone(prev);
    appended.chapters.push({ ...structuredClone(prev.chapters[1]!), id: 'ch-new' });
    appended.upcomingChapters = [{ id: 'ch-later', name: 'Later' }];
    expect(rules(prev, appended)).toEqual([]);
  });

  it('refuses changing the entry or the boss node', () => {
    const next = published();
    const chapter = next.chapters[0]!;
    chapter.nodes.push({
      type: 'campfire',
      id: 'n-pre',
      prerequisites: [],
      mandatory: false,
      position: { x: 0, y: 0 },
    });
    chapter.edges.push({ from: 'n-pre', to: 'n-entry' });
    chapter.entryNodeId = 'n-pre';
    chapter.bossNodeId = 'n-a';
    expect(rules(published(), next)).toEqual([
      'graph_entry_changed:n-entry',
      'graph_boss_changed:n-boss',
    ]);
  });
});

describe('checkCompatibility — item kind (Fase 1b plan, decision 8)', () => {
  function withSword(patch: Record<string, unknown>): CampaignSnapshot {
    const next = { ...published(), version: 2 };
    next.items = next.items.map((item) =>
      item.id === 'item-sword' ? ({ ...item, ...patch } as typeof item) : item,
    );
    return next;
  }

  it('allows rebalancing an item’s numbers and renaming it', () => {
    const sword = published().items[0]!;
    if (sword.category !== 'equipment' || !sword.weapon) throw new Error('fixture');
    expect(
      rules(published(), withSword({ name: 'Blade', weapon: { ...sword.weapon, baseDamage: 9 } })),
    ).toEqual([]);
  });

  it('refuses changing slot, weapon type or category', () => {
    const sword = published().items[0]!;
    if (sword.category !== 'equipment' || !sword.weapon) throw new Error('fixture');
    expect(rules(published(), withSword({ slot: 'helmet', weapon: undefined }))).toEqual([
      'item_kind_changed:item-sword',
    ]);
    expect(
      rules(published(), withSword({ weapon: { ...sword.weapon, weaponType: 'heavy' } })),
    ).toEqual(['item_kind_changed:item-sword']);
    expect(
      rules(
        published(),
        withSword({ category: 'consumable', effect: { type: 'provoke', duration: 1 } }),
      ),
    ).toEqual(['item_kind_changed:item-sword']);
  });
});
