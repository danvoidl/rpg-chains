import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  CampaignSnapshotSchema,
  type DraftClass,
  type DraftGraph,
  type DraftNode,
} from '@rpg-chains/shared-types';
import { createTestApp, requestAs, resetDatabase, signUp, type TestUser } from './helpers.js';

let app: FastifyInstance;

beforeEach(async () => {
  app ??= await createTestApp();
  await resetDatabase(app);
});
afterAll(async () => {
  await app.close();
});

function node(type: DraftNode['type'], overrides: Partial<DraftNode> = {}): DraftNode {
  const base = {
    id: randomUUID(),
    mandatory: type === 'boss',
    recommendedLevel: null,
    participantLimit: null,
    position: { x: 0, y: 0 },
    prerequisites: [],
  };
  const config =
    type === 'battle' || type === 'boss'
      ? { villainIds: [], questionIds: [] }
      : type === 'shop'
        ? { itemIds: [] }
        : type === 'narrative'
          ? { text: '', videoUrl: null }
          : {};
  return { ...base, type, config, ...overrides } as DraftNode;
}

/** Authors a publishable campaign through the REST API: entry → battle → boss. */
async function authorCampaign(user: TestUser) {
  const post = async (url: string, payload: object) => {
    const res = await requestAs(app, user, { method: 'POST', url, payload });
    expect(res.statusCode, res.body).toBe(201);
    return res.json<{ id: string }>();
  };
  const campaign = await post('/api/campaigns', { name: 'As Sete Correntes' });
  const base = `/api/campaigns/${campaign.id}`;
  await post(`${base}/classes/import-kit`, {});
  const villain = await post(`${base}/villains`, {
    name: 'Chain Warden',
    hp: 100,
    strength: 5,
    dexterity: 3,
    intelligence: 2,
    defense: 4,
    attacks: [{ name: 'Lash', baseDamage: 10, targetType: 'single', cooldownRounds: 0 }],
    // Inside the reward guide of the level 1 and 2 nodes, so the kit publishes warning-free.
    xpReward: 30,
    goldReward: 15,
  });
  const question = await post(`${base}/questions`, {
    type: 'objective',
    prompt: '2 + 2?',
    options: ['3', '4'],
    correctIndex: 1,
  });
  const chapter = await post(`${base}/chapters`, { name: 'Chapter 1' });

  const entry = node('narrative', { mandatory: true });
  const battle = node('battle', {
    mandatory: true,
    recommendedLevel: 1,
    participantLimit: 3,
    config: { villainIds: [villain.id], questionIds: [question.id] },
  } as Partial<DraftNode>);
  const boss = node('boss', {
    recommendedLevel: 2,
    config: { villainIds: [villain.id], questionIds: [] },
  } as Partial<DraftNode>);
  const graph: DraftGraph = {
    entryNodeId: entry.id,
    bossNodeId: boss.id,
    nodes: [entry, battle, boss],
    edges: [
      { from: entry.id, to: battle.id },
      { from: battle.id, to: boss.id },
    ],
  };
  return { base, chapterId: chapter.id, graph };
}

async function saveGraph(user: TestUser, base: string, chapterId: string, graph: DraftGraph) {
  const res = await requestAs(app, user, {
    method: 'PUT',
    url: `${base}/chapters/${chapterId}/graph`,
    payload: graph,
  });
  expect(res.statusCode, res.body).toBe(200);
}

function publish(user: TestUser | null, base: string) {
  return requestAs(app, user, { method: 'POST', url: `${base}/publish` });
}

describe('publish flow (Fase 1 done criterion)', () => {
  it('publishes v1, accepts an additive v2, refuses a destructive v3 with violations', async () => {
    const author = await signUp(app);
    const { base, chapterId, graph } = await authorCampaign(author);
    await saveGraph(author, base, chapterId, graph);

    const v1 = await publish(author, base);
    expect(v1.statusCode, v1.body).toBe(201);
    expect(v1.json()).toMatchObject({ version: 1 });

    // v2: add a campfire branch — additive, so it must publish.
    const campfire = node('campfire');
    const v2Graph: DraftGraph = {
      ...graph,
      nodes: [...graph.nodes, campfire],
      edges: [
        ...graph.edges,
        { from: graph.entryNodeId!, to: campfire.id },
        { from: campfire.id, to: graph.bossNodeId! },
      ],
    };
    await saveGraph(author, base, chapterId, v2Graph);
    const v2 = await publish(author, base);
    expect(v2.statusCode, v2.body).toBe(201);
    expect(v2.json()).toMatchObject({ version: 2 });

    // v3: delete the campfire again — a published node, so the gate refuses.
    await saveGraph(author, base, chapterId, graph);
    const v3 = await publish(author, base);
    expect(v3.statusCode).toBe(422);
    expect(v3.json()).toEqual({
      error: 'incompatible_changes',
      violations: [
        expect.objectContaining({
          rule: 'entity_deleted',
          entityType: 'node',
          entityId: campfire.id,
        }),
      ],
    });

    const versions = await requestAs(app, author, { method: 'GET', url: `${base}/versions` });
    expect(versions.json<Array<{ version: number }>>().map((v) => v.version)).toEqual([2, 1]);

    const stored = await app.prisma.campaignVersion.findFirstOrThrow({ where: { version: 2 } });
    const snapshot = CampaignSnapshotSchema.parse(stored.snapshot);
    expect(snapshot.chapters[0]!.nodes.map((n) => n.id)).toContain(campfire.id);
  });

  it('refuses an invalid draft with the validation issues and stores nothing', async () => {
    const author = await signUp(app);
    const { base, chapterId, graph } = await authorCampaign(author);
    await saveGraph(author, base, chapterId, { ...graph, bossNodeId: null });

    const res = await publish(author, base);
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('invalid_draft');
    expect(res.json().issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'boss_missing' })]),
    );
    expect(await app.prisma.campaignVersion.count()).toBe(0);
  });

  it('excludes chapters under construction from the snapshot', async () => {
    const author = await signUp(app);
    const { base, chapterId, graph } = await authorCampaign(author);
    await saveGraph(author, base, chapterId, graph);
    await requestAs(app, author, {
      method: 'POST',
      url: `${base}/chapters`,
      payload: { name: 'WIP', underConstruction: true },
    });

    expect((await publish(author, base)).statusCode).toBe(201);
    const stored = await app.prisma.campaignVersion.findFirstOrThrow();
    expect(CampaignSnapshotSchema.parse(stored.snapshot).chapters.map((c) => c.name)).toEqual([
      'Chapter 1',
    ]);
  });

  it('requires authentication and ownership', async () => {
    const author = await signUp(app);
    const other = await signUp(app, 'Other');
    const { base } = await authorCampaign(author);
    expect((await publish(null, base)).statusCode).toBe(401);
    expect((await publish(other, base)).statusCode).toBe(403);
    expect(
      (await requestAs(app, other, { method: 'GET', url: `${base}/versions` })).statusCode,
    ).toBe(403);
  });
});

describe('publish flow with classes (Fase 1b done criterion)', () => {
  async function kitClasses(user: TestUser, base: string) {
    const res = await requestAs(app, user, { method: 'GET', url: `${base}/classes` });
    return res.json<DraftClass[]>();
  }

  function putClass(user: TestUser, base: string, cls: DraftClass) {
    return requestAs(app, user, {
      method: 'PUT',
      url: `${base}/classes/${cls.id}`,
      payload: { ...cls },
    });
  }

  it('publishes the kit, accepts a skill rebalance, refuses a removed skill or a base change', async () => {
    const author = await signUp(app);
    const { base, chapterId, graph } = await authorCampaign(author);
    await saveGraph(author, base, chapterId, graph);

    const v1 = await publish(author, base);
    expect(v1.statusCode, v1.body).toBe(201);
    expect(v1.json()).toMatchObject({ version: 1, warnings: [] });
    const stored = await app.prisma.campaignVersion.findFirstOrThrow();
    const snapshot = CampaignSnapshotSchema.parse(stored.snapshot);
    expect(snapshot.classes).toHaveLength(4);
    expect(snapshot.items).toHaveLength(4);

    // v2: rebalance one skill's numbers — the skill id is kept, so it rolls forward.
    const [guardian] = await kitClasses(author, base);
    const rebalanced = {
      ...guardian!,
      skills: guardian!.skills.map((s, i) => (i === 0 ? { ...s, energyCost: 20 } : s)),
    };
    expect((await putClass(author, base, rebalanced)).statusCode).toBe(200);
    const v2 = await publish(author, base);
    expect(v2.statusCode, v2.body).toBe(201);

    // v3: drop a skill from the class — refused.
    const removed = guardian!.skills[3]!;
    await putClass(author, base, { ...rebalanced, skills: rebalanced.skills.slice(0, 3) });
    const v3 = await publish(author, base);
    expect(v3.statusCode).toBe(422);
    expect(v3.json().violations).toEqual([
      expect.objectContaining({
        rule: 'entity_deleted',
        entityType: 'skill',
        entityId: removed.id,
      }),
    ]);

    // A base-stat change on top is its own violation.
    const baseChange = await putClass(author, base, {
      ...rebalanced,
      skills: rebalanced.skills.slice(0, 3),
      baseHp: 130,
    });
    expect(baseChange.statusCode, baseChange.body).toBe(200);
    const v4 = await publish(author, base);
    expect(v4.statusCode).toBe(422);
    expect(v4.json().violations.map((v: { rule: string }) => v.rule)).toContain(
      'class_base_changed',
    );
  });

  it('refuses a draft without classes', async () => {
    const author = await signUp(app);
    const { base, chapterId, graph } = await authorCampaign(author);
    await saveGraph(author, base, chapterId, graph);
    await app.prisma.characterClass.deleteMany();

    const res = await publish(author, base);
    expect(res.statusCode).toBe(422);
    expect(res.json().issues).toEqual([expect.objectContaining({ code: 'no_classes' })]);
  });

  it('publishes with balancing warnings and echoes them back', async () => {
    const author = await signUp(app);
    const { base, chapterId, graph } = await authorCampaign(author);
    await saveGraph(author, base, chapterId, graph);
    const [guardian] = await kitClasses(author, base);
    await putClass(author, base, { ...guardian!, baseHp: 200 });

    const res = await publish(author, base);
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json().warnings).toEqual([
      expect.objectContaining({
        code: 'class_base_out_of_band',
        classId: guardian!.id,
        value: 200,
      }),
    ]);
  });
});
