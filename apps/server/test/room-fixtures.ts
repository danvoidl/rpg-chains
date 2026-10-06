import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import {
  SNAPSHOT_SCHEMA_VERSION,
  type CampaignSnapshot,
  type CharacterClass,
} from '@rpg-chains/shared-types';
import { requestAs, type TestUser } from './helpers.js';

function knightClass(id: string, maxSlots: number, name = id): CharacterClass {
  return {
    id,
    name,
    description: '',
    baseHp: 100,
    baseEnergy: 50,
    hpPerLevel: 8,
    energyPerLevel: 5,
    maxSlots,
    baseWeaponId: 'it-sword',
    skills: [],
  };
}

/**
 * A published snapshot for room tests, inserted straight into `CampaignVersion` so rooms never
 * depend on the authoring editor (Fase 2 plan M0). Classes: `cl-solo` (1 slot), `cl-duo` (2 slots);
 * `withExtraClass` adds `cl-new`, an additive v2.
 */
export function roomSnapshot(
  campaignId: string,
  version: number,
  options: { withExtraClass?: boolean } = {},
): CampaignSnapshot {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    campaignId,
    version,
    name: 'As Sete Correntes',
    description: '',
    chapters: [],
    classes: [
      knightClass('cl-solo', 1, 'Solo'),
      knightClass('cl-duo', 2, 'Duo'),
      ...(options.withExtraClass ? [knightClass('cl-new', 3, 'New')] : []),
    ],
    villains: [],
    questions: [],
    items: [
      {
        category: 'equipment',
        id: 'it-sword',
        name: 'Sword',
        slot: 'weapon',
        requirements: {},
        defenseBonus: 0,
        weapon: { weaponType: 'light', baseDamage: 10, scalingAttribute: 'dexterity', scale: 2 },
      },
    ],
  };
}

/** Creates a campaign owned by `author` and publishes the fixture as its version 1. */
export async function publishedCampaign(app: FastifyInstance, author: TestUser): Promise<string> {
  const campaign = await app.prisma.campaign.create({
    data: { name: 'As Sete Correntes', authorId: author.id },
  });
  await publishVersion(app, campaign.id, 1);
  return campaign.id;
}

/** Stores the fixture snapshot as `version` of the campaign. */
export async function publishVersion(
  app: FastifyInstance,
  campaignId: string,
  version: number,
  options: { withExtraClass?: boolean } = {},
): Promise<void> {
  await app.prisma.campaignVersion.create({
    data: {
      campaignId,
      version,
      snapshot: roomSnapshot(campaignId, version, options) as unknown as Prisma.InputJsonValue,
    },
  });
}

/** Creates a room through the API and returns its id (and code, when private). */
export async function createRoom(
  app: FastifyInstance,
  master: TestUser,
  campaignId: string,
  isPublic = true,
): Promise<{ id: string; accessCode: string | null }> {
  const res = await requestAs(app, master, {
    method: 'POST',
    url: '/api/rooms',
    payload: { campaignId, name: 'Mesa de sexta', isPublic },
  });
  if (res.statusCode !== 201) throw new Error(`create room failed: ${res.statusCode} ${res.body}`);
  return res.json<{ id: string; accessCode: string | null }>();
}

/** Picks a class in a room. */
export function chooseClass(
  app: FastifyInstance,
  user: TestUser,
  roomId: string,
  classId: string,
  accessCode?: string,
) {
  return requestAs(app, user, {
    method: 'POST',
    url: `/api/rooms/${roomId}/profile`,
    payload: { classId, ...(accessCode ? { accessCode } : {}) },
  });
}
