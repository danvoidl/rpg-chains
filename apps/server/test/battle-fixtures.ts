import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import type { CampaignSnapshot, ChapterNode } from '@rpg-chains/shared-types';
import { requestAs, type TestUser } from './helpers.js';
import { roomSnapshot } from './room-fixtures.js';

const at = { x: 0, y: 0 };

function battleNode(
  id: string,
  villainIds: string[],
  questionIds: string[],
  participantLimit = 2,
): ChapterNode {
  return {
    type: 'battle',
    id,
    title: id,
    prerequisites: [],
    mandatory: false,
    recommendedLevel: 1,
    participantLimit,
    position: at,
    villainIds,
    questionIds,
  };
}

/**
 * The room fixture plus one chapter to fight in (Fase 3 plan M3). Knights (100 HP, sword 10 dmg)
 * against a 15 HP rat without defense that bites for 1: two hits win, nobody falls.
 * Nodes: `n-rat` (limit 2), `n-boss`, `n-open` (an open question), `n-silent` (no questions),
 * `n-camp` (a campfire), `n-shop` (sells the potion, the helmet and the phoenix feather). The entry
 * is the narrative `n-gate`, with an edge to every other node (Fase 5): until it is cleared only
 * the gate is unlocked — `clearGate` clears it, which unlocks them all (the boss too: no other
 * node is mandatory).
 */
export function battleSnapshot(campaignId: string, version: number): CampaignSnapshot {
  const base = roomSnapshot(campaignId, version);
  return {
    ...base,
    chapters: [
      {
        id: 'ch-1',
        name: 'Cellar',
        underConstruction: false,
        entryNodeId: 'n-gate',
        bossNodeId: 'n-boss',
        nodes: [
          {
            type: 'narrative',
            id: 'n-gate',
            title: 'Gate',
            prerequisites: [],
            mandatory: false,
            position: at,
            text: 'The cellar door creaks open.',
          },
          battleNode('n-rat', ['v-rat'], ['q-1', 'q-2']),
          {
            type: 'boss',
            id: 'n-boss',
            title: 'Rat king',
            prerequisites: [],
            mandatory: true,
            recommendedLevel: 1,
            position: at,
            villainIds: ['v-rat', 'v-rat'],
            questionIds: ['q-1'],
          },
          battleNode('n-open', ['v-rat'], ['q-1', 'q-open']),
          battleNode('n-silent', ['v-rat'], []),
          {
            type: 'campfire',
            id: 'n-camp',
            title: '',
            prerequisites: [],
            mandatory: false,
            position: at,
          },
          {
            type: 'shop',
            id: 'n-shop',
            title: 'Merchant',
            prerequisites: [],
            mandatory: false,
            position: at,
            itemIds: ['it-potion', 'it-helmet', 'it-phoenix'],
          },
        ],
        edges: ['n-rat', 'n-boss', 'n-open', 'n-silent', 'n-camp', 'n-shop'].map((to) => ({
          from: 'n-gate',
          to,
        })),
      },
    ],
    villains: [
      {
        id: 'v-rat',
        name: 'Rat',
        hp: 15,
        attributes: { strength: 0, dexterity: 0, intelligence: 0, defense: 0 },
        attacks: [
          { id: 'a-bite', name: 'Bite', baseDamage: 1, targetType: 'single', cooldownRounds: 0 },
        ],
      },
    ],
    questions: [
      { type: 'objective', id: 'q-1', prompt: '2 + 2?', options: ['3', '4'], correctIndex: 1 },
      { type: 'objective', id: 'q-2', prompt: '3 + 3?', options: ['6', '7'], correctIndex: 0 },
      { type: 'open', id: 'q-open', prompt: 'Why?' },
    ],
  };
}

/** The correct option of an objective question of the fixture. */
export function correctIndex(questionId: string): number {
  const question = battleSnapshot('c', 1).questions.find((q) => q.id === questionId);
  if (question?.type !== 'objective') throw new Error(`not objective: ${questionId}`);
  return question.correctIndex;
}

/** Stores the battle fixture as `version` of the campaign. */
export async function publishBattleVersion(
  app: FastifyInstance,
  campaignId: string,
  version: number,
): Promise<string> {
  const row = await app.prisma.campaignVersion.create({
    data: {
      campaignId,
      version,
      snapshot: battleSnapshot(campaignId, version) as unknown as Prisma.InputJsonValue,
    },
  });
  return row.id;
}

/** A campaign whose version 1 is the battle fixture. */
export async function battleCampaign(app: FastifyInstance, author: TestUser): Promise<string> {
  const campaign = await app.prisma.campaign.create({
    data: { name: 'As Sete Correntes', authorId: author.id },
  });
  await publishBattleVersion(app, campaign.id, 1);
  return campaign.id;
}

/** Clears the fixture's entry narrative in `roomId`, unlocking every other node (Fase 5). */
export async function clearGate(app: FastifyInstance, roomId: string): Promise<void> {
  await app.prisma.$transaction([
    app.prisma.roomNodeClear.create({
      data: { roomId, chapterId: 'ch-1', nodeId: 'n-gate', seq: 1, profileIds: [] },
    }),
    app.prisma.room.update({ where: { id: roomId }, data: { progressSeq: 1 } }),
  ]);
}

export function openBattle(app: FastifyInstance, user: TestUser, roomId: string, nodeId: string) {
  return requestAs(app, user, {
    method: 'POST',
    url: `/api/rooms/${roomId}/battles`,
    payload: { nodeId },
  });
}

/** POSTs (or DELETEs) a battle sub-resource: `participants`, `start`, `cancel`. */
export function battleAction(
  app: FastifyInstance,
  user: TestUser,
  battleId: string,
  action: 'participants' | 'start' | 'cancel',
  method: 'POST' | 'DELETE' = 'POST',
) {
  return requestAs(app, user, { method, url: `/api/battles/${battleId}/${action}` });
}
