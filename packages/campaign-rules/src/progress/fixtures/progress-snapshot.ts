import { CampaignSnapshotSchema, type CampaignSnapshot } from '@rpg-chains/shared-types';

/**
 * Two chapters to walk (Fase 5 plan M1). Chapter 1:
 *
 *   intro (narrative, entry) ─┬─ a (battle, mandatory) ── fire (campfire) ── a2 (battle, mandatory) ─┐
 *                             ├─ b (battle) ── shop ─────────────────────────────────────────────────┼─ boss1
 *                             └─ p (battle, prerequisite: shop) ─────────────────────────────────────┘
 *
 * Chapter 2: c (battle, entry) ── boss2 (open question: needs the master). Then "Epílogo" is
 * under construction.
 */
const at = (column: number, row: number) => ({ x: column * 80, y: row * 100 });

const battle = (id: string, mandatory: boolean, prerequisites: string[] = []) => ({
  type: 'battle' as const,
  id,
  title: id,
  prerequisites,
  mandatory,
  recommendedLevel: 1,
  participantLimit: 4,
  position: at(2, 1),
  villainIds: ['v-rat'],
  questionIds: ['q-obj'],
});

export const progressSnapshot: CampaignSnapshot = CampaignSnapshotSchema.parse({
  schemaVersion: 1,
  campaignId: 'c-progress',
  version: 1,
  name: 'Progress',
  chapters: [
    {
      id: 'ch1',
      name: 'Capítulo 1',
      entryNodeId: 'intro',
      bossNodeId: 'boss1',
      opening: { text: 'Era uma vez', videoUrl: 'https://example.com/ch1.mp4' },
      nodes: [
        {
          type: 'narrative',
          id: 'intro',
          title: 'Intro',
          mandatory: false,
          position: at(2, 0),
          text: 'Era uma vez',
        },
        battle('a', true),
        battle('b', false),
        battle('p', false, ['shop']),
        { type: 'campfire', id: 'fire', title: 'Fogueira', mandatory: false, position: at(1, 2) },
        battle('a2', true),
        { type: 'shop', id: 'shop', title: 'Loja', mandatory: false, position: at(3, 2) },
        {
          type: 'boss',
          id: 'boss1',
          title: 'Chefe 1',
          mandatory: true,
          recommendedLevel: 2,
          position: at(2, 4),
          villainIds: ['v-rat'],
          questionIds: ['q-obj'],
        },
      ],
      edges: [
        { from: 'intro', to: 'a' },
        { from: 'intro', to: 'b' },
        { from: 'intro', to: 'p' },
        { from: 'a', to: 'fire' },
        { from: 'fire', to: 'a2' },
        { from: 'b', to: 'shop' },
        { from: 'a2', to: 'boss1' },
        { from: 'shop', to: 'boss1' },
        { from: 'p', to: 'boss1' },
      ],
    },
    {
      id: 'ch2',
      name: 'Capítulo 2',
      entryNodeId: 'c',
      bossNodeId: 'boss2',
      nodes: [
        battle('c', true),
        {
          type: 'boss',
          id: 'boss2',
          title: 'Chefe 2',
          mandatory: true,
          recommendedLevel: 3,
          position: at(2, 2),
          villainIds: ['v-rat'],
          questionIds: ['q-open'],
        },
      ],
      edges: [{ from: 'c', to: 'boss2' }],
    },
  ],
  upcomingChapters: [{ id: 'ch3', name: 'Epílogo' }],
  classes: [],
  villains: [
    {
      id: 'v-rat',
      name: 'Rato',
      hp: 10,
      attributes: { strength: 1, dexterity: 1, intelligence: 1, defense: 0 },
      attacks: [
        { id: 'bite', name: 'Mordida', baseDamage: 2, targetType: 'single', cooldownRounds: 0 },
      ],
    },
  ],
  questions: [
    { type: 'objective', id: 'q-obj', prompt: '1+1?', options: ['1', '2'], correctIndex: 1 },
    { type: 'open', id: 'q-open', prompt: 'Por quê?' },
  ],
  items: [],
});

/** Every node id of chapter 1, in fixture order. */
export const CHAPTER_1_NODES = ['intro', 'a', 'b', 'p', 'fire', 'a2', 'shop', 'boss1'] as const;
