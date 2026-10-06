import { DEFAULT_CLASS_KIT } from '@rpg-chains/game-config';
import {
  CampaignSnapshotSchema,
  SNAPSHOT_SCHEMA_VERSION,
  type CampaignSnapshot,
} from '@rpg-chains/shared-types';

/**
 * A campaign built on the default kit (Fase 3 plan M0). Classes and weapons are derived from
 * `DEFAULT_CLASS_KIT` instead of copied, so kit scenario tests follow every playtest tuning. Ids
 * are stable: `cl-<key>`, `it-<key>-weapon`, `sk-<key>-<1..4>` in unlock order. Villains: a brute
 * with a single and an area attack, and a cultist; the boss node mixes in an open question.
 */
export function kitSnapshot(): CampaignSnapshot {
  return CampaignSnapshotSchema.parse({
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    campaignId: 'camp-kit',
    version: 1,
    name: 'Default kit',
    chapters: [
      {
        id: 'ch-kit',
        name: 'Seven chains',
        entryNodeId: 'n-kit-battle',
        bossNodeId: 'n-kit-boss',
        nodes: [
          {
            type: 'battle',
            id: 'n-kit-battle',
            mandatory: true,
            recommendedLevel: 1,
            participantLimit: 4,
            position: { x: 100, y: 100 },
            villainIds: ['v-brute', 'v-cultist'],
            questionIds: ['q-kit-1', 'q-kit-2', 'q-kit-3', 'q-kit-4'],
          },
          {
            type: 'boss',
            id: 'n-kit-boss',
            prerequisites: ['n-kit-battle'],
            mandatory: true,
            recommendedLevel: 1,
            position: { x: 300, y: 100 },
            villainIds: ['v-brute'],
            questionIds: ['q-kit-1', 'q-kit-2', 'q-kit-open-1'],
          },
        ],
        edges: [{ from: 'n-kit-battle', to: 'n-kit-boss' }],
      },
    ],
    classes: DEFAULT_CLASS_KIT.map(({ key, baseWeapon: _weapon, skills, ...cls }) => ({
      ...cls,
      id: `cl-${key}`,
      baseWeaponId: `it-${key}-weapon`,
      skills: skills.map((skill, index) => ({ ...skill, id: `sk-${key}-${index + 1}` })),
    })),
    villains: [
      {
        id: 'v-brute',
        name: 'Chain brute',
        hp: 120,
        attributes: { strength: 0, dexterity: 0, intelligence: 0, defense: 20 },
        attacks: [
          { id: 'a-smash', name: 'Smash', baseDamage: 14, targetType: 'single', cooldownRounds: 0 },
          { id: 'a-quake', name: 'Quake', baseDamage: 9, targetType: 'area', cooldownRounds: 2 },
        ],
      },
      {
        id: 'v-cultist',
        name: 'Cultist',
        hp: 70,
        attributes: { strength: 0, dexterity: 0, intelligence: 0, defense: 5 },
        attacks: [
          { id: 'a-curse', name: 'Curse', baseDamage: 10, targetType: 'single', cooldownRounds: 0 },
        ],
      },
    ],
    questions: [
      {
        type: 'objective',
        id: 'q-kit-1',
        prompt: '5 − 3 = ?',
        options: ['1', '2'],
        correctIndex: 1,
      },
      {
        type: 'objective',
        id: 'q-kit-2',
        prompt: '10 ÷ 2 = ?',
        options: ['5', '4'],
        correctIndex: 0,
      },
      {
        type: 'objective',
        id: 'q-kit-3',
        prompt: '7 + 1 = ?',
        options: ['9', '8'],
        correctIndex: 1,
      },
      {
        type: 'objective',
        id: 'q-kit-4',
        prompt: '2 × 6 = ?',
        options: ['12', '14'],
        correctIndex: 0,
      },
      { type: 'open', id: 'q-kit-open-1', prompt: 'Name a prime number above 10.' },
    ],
    items: DEFAULT_CLASS_KIT.map(({ key, baseWeapon: { name, ...weapon } }) => ({
      category: 'equipment',
      id: `it-${key}-weapon`,
      name,
      slot: 'weapon',
      weapon,
    })),
  });
}
