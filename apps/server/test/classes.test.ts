import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DraftClass, Item, SkillInput } from '@rpg-chains/shared-types';
import { createTestApp, requestAs, resetDatabase, signUp, type TestUser } from './helpers.js';

let app: FastifyInstance;

beforeEach(async () => {
  app ??= await createTestApp();
  await resetDatabase(app);
});
afterAll(async () => {
  await app.close();
});

const strike: SkillInput = {
  name: 'Strike',
  energyCost: 15,
  cooldownRounds: 2,
  unlockLevel: 1,
  effect: { type: 'damage', target: 'enemy', magnitude: { mode: 'fixed', value: 20 } },
};
const guard: SkillInput = {
  name: 'Guard',
  energyCost: 20,
  cooldownRounds: 3,
  unlockLevel: 4,
  effect: {
    type: 'shield',
    target: 'self',
    magnitude: { mode: 'percent', percent: 20 },
    duration: 2,
  },
};

function knight(baseWeaponId: string | null, skills: SkillInput[]) {
  return {
    name: 'Knight',
    baseHp: 100,
    baseEnergy: 50,
    hpPerLevel: 8,
    energyPerLevel: 5,
    maxSlots: 8,
    baseWeaponId,
    skills,
  };
}

async function setup(user: TestUser) {
  const campaign = await requestAs(app, user, {
    method: 'POST',
    url: '/api/campaigns',
    payload: { name: 'C' },
  });
  const base = `/api/campaigns/${campaign.json<{ id: string }>().id}`;
  const weapon = await requestAs(app, user, {
    method: 'POST',
    url: `${base}/items`,
    payload: {
      category: 'equipment',
      name: 'Sword',
      slot: 'weapon',
      weapon: { weaponType: 'light', baseDamage: 10, scalingAttribute: 'dexterity', scale: 2 },
    },
  });
  return { base, weaponId: weapon.json<Item>().id };
}

describe('classes REST routes', () => {
  it('creates a class with its skills, and a base weapon may be unset in the draft', async () => {
    const author = await signUp(app);
    const { base, weaponId } = await setup(author);

    const res = await requestAs(app, author, {
      method: 'POST',
      url: `${base}/classes`,
      payload: knight(weaponId, [guard, strike]),
    });
    expect(res.statusCode, res.body).toBe(201);
    const cls = res.json<DraftClass>();
    expect(cls).toMatchObject({ name: 'Knight', baseWeaponId: weaponId, artUrl: null });
    // Skills come back ordered by unlock level.
    expect(cls.skills.map((s) => s.name)).toEqual(['Strike', 'Guard']);

    const noWeapon = await requestAs(app, author, {
      method: 'POST',
      url: `${base}/classes`,
      payload: knight(null, []),
    });
    expect(noWeapon.statusCode).toBe(201);
  });

  it('keeps skill ids stable on replace: update by id, create without id, delete when left out', async () => {
    const author = await signUp(app);
    const { base, weaponId } = await setup(author);
    const created = (
      await requestAs(app, author, {
        method: 'POST',
        url: `${base}/classes`,
        payload: knight(weaponId, [strike, guard]),
      })
    ).json<DraftClass>();
    const [strikeRow, guardRow] = created.skills;

    const res = await requestAs(app, author, {
      method: 'PUT',
      url: `${base}/classes/${created.id}`,
      payload: knight(weaponId, [
        { ...strike, id: strikeRow!.id, energyCost: 20 },
        { ...strike, name: 'Cleave', unlockLevel: 8 },
      ]),
    });
    expect(res.statusCode, res.body).toBe(200);
    const skills = res.json<DraftClass>().skills;
    expect(skills[0]).toMatchObject({ id: strikeRow!.id, energyCost: 20 });
    expect(skills[1]).toMatchObject({ name: 'Cleave' });
    expect(skills.map((s) => s.id)).not.toContain(guardRow!.id);
    expect(await app.prisma.skill.count()).toBe(2);
  });

  it('refuses a skill id that is not one of the class skills', async () => {
    const author = await signUp(app);
    const { base, weaponId } = await setup(author);
    const a = (
      await requestAs(app, author, {
        method: 'POST',
        url: `${base}/classes`,
        payload: knight(weaponId, [strike]),
      })
    ).json<DraftClass>();
    const b = (
      await requestAs(app, author, {
        method: 'POST',
        url: `${base}/classes`,
        payload: knight(weaponId, [guard]),
      })
    ).json<DraftClass>();

    const res = await requestAs(app, author, {
      method: 'PUT',
      url: `${base}/classes/${a.id}`,
      payload: knight(weaponId, [{ ...guard, id: b.skills[0]!.id }]),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_skill_id', skillId: b.skills[0]!.id });
    // Nothing changed: the transaction rolled back.
    expect(
      (await app.prisma.skill.findMany({ where: { classId: a.id } })).map((s) => s.name),
    ).toEqual(['Strike']);
  });

  it('validates the effect shape on write', async () => {
    const author = await signUp(app);
    const { base, weaponId } = await setup(author);
    const res = await requestAs(app, author, {
      method: 'POST',
      url: `${base}/classes`,
      payload: knight(weaponId, [
        { ...strike, effect: { type: 'damage', target: 'enemy' } } as unknown as SkillInput,
      ]),
    });
    expect(res.statusCode).toBe(400);
    const tooMany = await requestAs(app, author, {
      method: 'POST',
      url: `${base}/classes`,
      payload: knight(weaponId, [strike, strike, strike, strike, strike]),
    });
    expect(tooMany.statusCode).toBe(400);
  });

  it('deletes a class and its skills; 404 for another campaign’s class', async () => {
    const author = await signUp(app);
    const { base, weaponId } = await setup(author);
    const other = await setup(author);
    const cls = (
      await requestAs(app, author, {
        method: 'POST',
        url: `${base}/classes`,
        payload: knight(weaponId, [strike]),
      })
    ).json<DraftClass>();

    const wrongCampaign = await requestAs(app, author, {
      method: 'DELETE',
      url: `${other.base}/classes/${cls.id}`,
    });
    expect(wrongCampaign.statusCode).toBe(404);
    const res = await requestAs(app, author, {
      method: 'DELETE',
      url: `${base}/classes/${cls.id}`,
    });
    expect(res.statusCode).toBe(204);
    expect(await app.prisma.skill.count()).toBe(0);
  });

  it('requires authentication and ownership', async () => {
    const author = await signUp(app);
    const other = await signUp(app, 'Other');
    const { base, weaponId } = await setup(author);
    const url = `${base}/classes`;
    expect((await requestAs(app, null, { method: 'GET', url })).statusCode).toBe(401);
    expect((await requestAs(app, other, { method: 'GET', url })).statusCode).toBe(403);
    expect(
      (await requestAs(app, other, { method: 'POST', url, payload: knight(weaponId, []) }))
        .statusCode,
    ).toBe(403);
    expect(
      (await requestAs(app, other, { method: 'POST', url: `${url}/import-kit` })).statusCode,
    ).toBe(403);
  });
});

describe('default kit import', () => {
  it('copies four classes with four skills each and their own base weapons', async () => {
    const author = await signUp(app);
    const { base } = await setup(author);

    const res = await requestAs(app, author, { method: 'POST', url: `${base}/classes/import-kit` });
    expect(res.statusCode, res.body).toBe(201);
    const classes = res.json<DraftClass[]>();
    expect(classes.map((c) => c.name)).toEqual(['Guardião', 'Penitente', 'Arauto', 'Sacerdote']);
    expect(classes.every((c) => c.skills.length === 4)).toBe(true);

    const items = await app.prisma.item.findMany({ where: { name: { not: 'Sword' } } });
    expect(items).toHaveLength(4);
    expect(new Set(classes.map((c) => c.baseWeaponId))).toEqual(new Set(items.map((i) => i.id)));

    // A second import makes independent copies, never a shared reference.
    await requestAs(app, author, { method: 'POST', url: `${base}/classes/import-kit` });
    expect(await app.prisma.characterClass.count()).toBe(8);
    expect(await app.prisma.skill.count()).toBe(32);
  });
});
