import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Item } from '@rpg-chains/shared-types';
import { createTestApp, requestAs, resetDatabase, signUp, type TestUser } from './helpers.js';

let app: FastifyInstance;

beforeEach(async () => {
  app ??= await createTestApp();
  await resetDatabase(app);
});
afterAll(async () => {
  await app.close();
});

const sword = {
  category: 'equipment',
  name: 'Sword',
  slot: 'weapon',
  weapon: { weaponType: 'light', baseDamage: 10, scalingAttribute: 'dexterity', scale: 2 },
};

async function campaignOf(user: TestUser): Promise<string> {
  const res = await requestAs(app, user, {
    method: 'POST',
    url: '/api/campaigns',
    payload: { name: 'C' },
  });
  return `/api/campaigns/${res.json<{ id: string }>().id}/items`;
}

describe('items REST routes', () => {
  it('creates, lists, replaces and deletes an item', async () => {
    const author = await signUp(app);
    const url = await campaignOf(author);

    const created = await requestAs(app, author, { method: 'POST', url, payload: sword });
    expect(created.statusCode, created.body).toBe(201);
    const item = created.json<Item>();
    expect(item).toMatchObject({ ...sword, requirements: {}, defenseBonus: 0 });

    const replaced = await requestAs(app, author, {
      method: 'PUT',
      url: `${url}/${item.id}`,
      payload: {
        category: 'consumable',
        name: 'Potion',
        effect: { type: 'heal', target: 'self', magnitude: { mode: 'fixed', value: 30 } },
      },
    });
    expect(replaced.statusCode, replaced.body).toBe(200);
    expect(replaced.json()).toEqual({
      category: 'consumable',
      id: item.id,
      name: 'Potion',
      effect: { type: 'heal', target: 'self', magnitude: { mode: 'fixed', value: 30 } },
    });

    const list = await requestAs(app, author, { method: 'GET', url });
    expect(list.json<Item[]>().map((i) => i.name)).toEqual(['Potion']);

    const del = await requestAs(app, author, { method: 'DELETE', url: `${url}/${item.id}` });
    expect(del.statusCode).toBe(204);
    expect(
      (await requestAs(app, author, { method: 'DELETE', url: `${url}/${item.id}` })).statusCode,
    ).toBe(404);
  });

  it('enforces weapon stats exactly on the weapon slot', async () => {
    const author = await signUp(app);
    const url = await campaignOf(author);
    const noStats = await requestAs(app, author, {
      method: 'POST',
      url,
      payload: { ...sword, weapon: undefined },
    });
    expect(noStats.statusCode).toBe(400);
    const helmetWithStats = await requestAs(app, author, {
      method: 'POST',
      url,
      payload: { ...sword, slot: 'helmet' },
    });
    expect(helmetWithStats.statusCode).toBe(400);
    const badEffect = await requestAs(app, author, {
      method: 'POST',
      url,
      payload: { category: 'consumable', name: 'Potion', effect: { type: 'heal' } },
    });
    expect(badEffect.statusCode).toBe(400);
  });

  it('requires authentication and ownership', async () => {
    const author = await signUp(app);
    const other = await signUp(app, 'Other');
    const url = await campaignOf(author);
    expect((await requestAs(app, null, { method: 'GET', url })).statusCode).toBe(401);
    expect((await requestAs(app, other, { method: 'GET', url })).statusCode).toBe(403);
    expect((await requestAs(app, other, { method: 'POST', url, payload: sword })).statusCode).toBe(
      403,
    );
  });
});
