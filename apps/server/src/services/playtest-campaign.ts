import type { Prisma } from '@prisma/client';
import { DROP_CHANCE_TIERS } from '@rpg-chains/game-config';
import { cellPosition, type Effect, type TrailCell } from '@rpg-chains/shared-types';
import { importDefaultKit } from './default-kit.js';
import { publishCampaign } from './publish-campaign.js';

/**
 * The playtest campaign (Fase 3 plan M5, Fase 4 plan M3): the default kit and two chapters — the
 * first a narrative opening, three battles, a shop and a boss; the second a narrative, a split of
 * two battle branches that rejoin, a campfire, a shop and a boss — with objective questions only, for groups
 * of 2–4 at level 1. Villains give XP, gold and drops (the whole chapter is about one level-up);
 * the shop sells potions and armor. The numbers are a first guess for the playtest to correct,
 * and they are campaign content (what an author would type), not system balancing, so they live
 * here rather than in `game-config`.
 */

type ItemKey = keyof typeof ITEMS;

interface ItemSpec {
  name: string;
  price: number;
  /** A consumable's effect, or an armor piece's slot and defense. */
  kind:
    | { category: 'consumable'; effect: Effect }
    | {
        category: 'equipment';
        slot: 'helmet' | 'chest';
        defenseBonus: number;
        requirements: { strength?: number };
      };
}

const ITEMS = {
  potion: {
    name: 'Poção de Vida',
    price: 15,
    kind: {
      category: 'consumable',
      effect: { type: 'heal', target: 'self', magnitude: { mode: 'fixed', value: 30 } },
    },
  },
  tonic: {
    name: 'Tônico de Energia',
    price: 12,
    kind: {
      category: 'consumable',
      effect: { type: 'restore_energy', target: 'self', magnitude: { mode: 'fixed', value: 20 } },
    },
  },
  helmet: {
    name: 'Elmo de Couro',
    price: 30,
    kind: { category: 'equipment', slot: 'helmet', defenseBonus: 4, requirements: {} },
  },
  chestplate: {
    name: 'Peitoral de Ferro',
    price: 60,
    kind: { category: 'equipment', slot: 'chest', defenseBonus: 8, requirements: { strength: 2 } },
  },
} satisfies Record<string, ItemSpec>;

const { common, uncommon, rare } = DROP_CHANCE_TIERS;

interface VillainSpec {
  name: string;
  hp: number;
  defense: number;
  xpReward: number;
  goldReward: number;
  drops: { item: ItemKey; chance: number }[];
  attacks: {
    name: string;
    baseDamage: number;
    targetType: 'single' | 'area';
    cooldownRounds: number;
  }[];
}

const VILLAINS = {
  rat: {
    name: 'Rato do Porão',
    hp: 25,
    defense: 0,
    xpReward: 8,
    goldReward: 3,
    drops: [{ item: 'potion', chance: common }],
    attacks: [{ name: 'Mordida', baseDamage: 5, targetType: 'single', cooldownRounds: 0 }],
  },
  bandit: {
    name: 'Bandido da Estrada',
    hp: 50,
    defense: 5,
    xpReward: 25,
    goldReward: 12,
    drops: [
      { item: 'potion', chance: common },
      { item: 'helmet', chance: uncommon },
    ],
    attacks: [
      { name: 'Corte', baseDamage: 8, targetType: 'single', cooldownRounds: 0 },
      { name: 'Areia nos Olhos', baseDamage: 5, targetType: 'area', cooldownRounds: 2 },
    ],
  },
  wolf: {
    name: 'Lobo Cinzento',
    hp: 20,
    defense: 0,
    xpReward: 6,
    goldReward: 2,
    drops: [{ item: 'tonic', chance: common }],
    attacks: [{ name: 'Dentada', baseDamage: 5, targetType: 'single', cooldownRounds: 0 }],
  },
  warden: {
    name: 'Carcereiro da Corrente',
    hp: 90,
    defense: 10,
    xpReward: 45,
    goldReward: 20,
    drops: [
      { item: 'helmet', chance: uncommon },
      { item: 'chestplate', chance: rare },
    ],
    attacks: [
      { name: 'Golpe de Corrente', baseDamage: 10, targetType: 'single', cooldownRounds: 0 },
      { name: 'Tremor', baseDamage: 6, targetType: 'area', cooldownRounds: 3 },
    ],
  },
} satisfies Record<string, VillainSpec>;

/** Prompt, options and the index of the right one. */
const QUESTIONS: [string, string[], number][] = [
  ['Quanto é 7 × 8?', ['54', '56', '64', '58'], 1],
  ['Qual é a capital do Brasil?', ['Rio de Janeiro', 'São Paulo', 'Brasília', 'Salvador'], 2],
  ['Quantos lados tem um hexágono?', ['5', '6', '7', '8'], 1],
  ['Qual planeta é conhecido como planeta vermelho?', ['Vênus', 'Júpiter', 'Marte', 'Saturno'], 2],
  ['Quanto é 15 + 27?', ['42', '32', '43', '41'], 0],
  ['Em que continente fica o Egito?', ['Ásia', 'Europa', 'África', 'Oceania'], 2],
  ['Qual é o maior oceano do mundo?', ['Atlântico', 'Índico', 'Ártico', 'Pacífico'], 3],
  ['Quanto é 100 ÷ 4?', ['20', '25', '40', '24'], 1],
  ['Quem pintou a Mona Lisa?', ['Michelangelo', 'Rafael', 'Leonardo da Vinci', 'Donatello'], 2],
  ['Qual gás as plantas absorvem do ar?', ['Oxigênio', 'Gás carbônico', 'Nitrogênio', 'Hélio'], 1],
  ['Quantos minutos há em 3 horas?', ['120', '180', '160', '200'], 1],
  ['Qual é o plural de "cidadão"?', ['Cidadões', 'Cidadãos', 'Cidadães', 'Cidadans'], 1],
  ['Quanto é 9²?', ['18', '81', '72', '99'], 1],
  ['Qual destes é um mamífero?', ['Tubarão', 'Golfinho', 'Polvo', 'Salmão'], 1],
  ['Em que ano o Brasil declarou independência?', ['1500', '1822', '1889', '1808'], 1],
];

const PARTICIPANT_LIMIT = 4;

/** Node creators bound to one chapter. */
function chapterBuilders(tx: Prisma.TransactionClient, chapterId: string, questionIds: string[]) {
  const node = (
    cell: TrailCell,
    data: Omit<Prisma.ChapterNodeUncheckedCreateInput, 'chapterId' | 'posX' | 'posY'>,
  ) => {
    const { x, y } = cellPosition(cell);
    return tx.chapterNode.create({ data: { chapterId, posX: x, posY: y, ...data } });
  };
  const battle = (title: string, cell: TrailCell, level: number, lineup: string[]) =>
    node(cell, {
      type: 'battle',
      title,
      mandatory: true,
      recommendedLevel: level,
      participantLimit: PARTICIPANT_LIMIT,
      config: { villainIds: lineup, questionIds },
    });
  return { node, battle };
}

async function connect(
  tx: Prisma.TransactionClient,
  chapterId: string,
  edges: Array<[{ id: string }, { id: string }]>,
): Promise<void> {
  await tx.nodeEdge.createMany({
    data: edges.map(([from, to]) => ({ chapterId, fromId: from.id, toId: to.id })),
  });
}

export interface PlaytestCampaign {
  campaignId: string;
  version: number;
  /** Balancing warnings of the publish; the seed aims for none. */
  warnings: unknown[];
}

/** Creates and publishes the playtest campaign for `authorId`. Throws if the gate refuses it. */
export async function createPlaytestCampaign(
  tx: Prisma.TransactionClient,
  authorId: string,
  name: string,
): Promise<PlaytestCampaign> {
  const campaign = await tx.campaign.create({
    data: {
      name,
      authorId,
      description:
        'Campanha de playtest: dois capítulos com batalhas, ramos, fogueira, loja e chefe, só perguntas objetivas.',
    },
  });
  const campaignId = campaign.id;
  await importDefaultKit(tx, campaignId);

  const itemIds: Record<ItemKey, string> = {} as never;
  for (const [key, spec] of Object.entries(ITEMS) as [ItemKey, ItemSpec][]) {
    const { kind } = spec;
    const item = await tx.item.create({
      data: {
        campaignId,
        name: spec.name,
        price: spec.price,
        category: kind.category,
        ...(kind.category === 'consumable'
          ? { effect: kind.effect }
          : {
              slot: kind.slot,
              defenseBonus: kind.defenseBonus,
              requirements: kind.requirements,
            }),
      },
    });
    itemIds[key] = item.id;
  }

  const villainIds: Record<keyof typeof VILLAINS, string> = {} as never;
  for (const [key, spec] of Object.entries(VILLAINS) as [keyof typeof VILLAINS, VillainSpec][]) {
    const villain = await tx.villain.create({
      data: {
        campaignId,
        name: spec.name,
        hp: spec.hp,
        strength: 0,
        dexterity: 0,
        intelligence: 0,
        defense: spec.defense,
        attacks: spec.attacks.map((attack, i) => ({ id: `${key}-attack-${i + 1}`, ...attack })),
        xpReward: spec.xpReward,
        goldReward: spec.goldReward,
        drops: spec.drops.map(({ item, chance }) => ({ itemId: itemIds[item], chance })),
      },
    });
    villainIds[key] = villain.id;
  }

  const questionIds: string[] = [];
  for (const [prompt, options, correctIndex] of QUESTIONS) {
    const question = await tx.question.create({
      data: { campaignId, type: 'objective', prompt, options, correctIndex },
    });
    questionIds.push(question.id);
  }

  const chapterOne = await tx.chapter.create({
    data: {
      campaignId,
      name: 'O Porão das Correntes',
      order: 0,
      openingText:
        'O velho forte ergue-se sobre a colina, e sob ele fica o porão onde as correntes ainda se arrastam.',
    },
  });
  const chapterTwo = await tx.chapter.create({
    data: {
      campaignId,
      name: 'A Torre das Correntes',
      order: 1,
      openingText:
        'Vencido o carcereiro, uma escada em espiral leva à torre. Lá em cima, alguém ainda puxa as correntes.',
    },
  });
  const { node, battle } = chapterBuilders(tx, chapterOne.id, questionIds);
  const second = chapterBuilders(tx, chapterTwo.id, questionIds);

  // Chapter 1: a zig-zag down the trail's grid (Fase 5 plan decision 17), one node per row.
  const opening = await node(
    { column: 2, row: 0 },
    {
      type: 'narrative',
      title: 'A descida',
      mandatory: true,
      config: {
        text: 'Uma corrente range no fundo do porão. Algo se mexe no escuro.',
        videoUrl: null,
      },
    },
  );
  const rats = await battle('Ratos no porão', { column: 1, row: 1 }, 1, [
    villainIds.rat,
    villainIds.rat,
  ]);
  const bandit = await battle('O bandido', { column: 2, row: 2 }, 1, [villainIds.bandit]);
  // After the bandit the trail forks: the shop on one side, the campfire on the other.
  const shop = await node(
    { column: 1, row: 3 },
    {
      type: 'shop',
      title: 'O mercador',
      mandatory: false,
      config: { itemIds: Object.values(itemIds) },
    },
  );
  const campfire = await node(
    { column: 3, row: 3 },
    { type: 'campfire', title: 'As brasas', mandatory: false, config: {} },
  );
  const pack = await battle('A matilha', { column: 2, row: 4 }, 1, [
    villainIds.wolf,
    villainIds.wolf,
    villainIds.wolf,
  ]);
  const warden = await node(
    { column: 2, row: 5 },
    {
      type: 'boss',
      title: 'O Carcereiro',
      mandatory: true,
      recommendedLevel: 1,
      config: { villainIds: [villainIds.warden], questionIds },
    },
  );
  await connect(tx, chapterOne.id, [
    [opening, rats],
    [rats, bandit],
    [bandit, shop],
    [bandit, campfire],
    [shop, pack],
    [campfire, pack],
    [pack, warden],
  ]);
  await tx.chapter.update({
    where: { id: chapterOne.id },
    data: { entryNodeId: opening.id, bossNodeId: warden.id },
  });

  // Chapter 2: a mandatory narrative, a fork of two battle branches that rejoin (the group can
  // split), then a fork of campfire / shop, and the boss.
  const gate = await second.node(
    { column: 2, row: 0 },
    {
      type: 'narrative',
      title: 'A escada',
      mandatory: true,
      config: {
        text: 'Degraus de pedra sobem em espiral. Dois corredores se abrem no primeiro patamar.',
        videoUrl: null,
      },
    },
  );
  const west = await second.battle('O corredor oeste', { column: 1, row: 1 }, 2, [
    villainIds.bandit,
    villainIds.rat,
  ]);
  const east = await second.battle('O corredor leste', { column: 3, row: 1 }, 2, [
    villainIds.bandit,
    villainIds.wolf,
  ]);
  const landing = await second.battle('O patamar', { column: 2, row: 2 }, 3, [
    villainIds.bandit,
    villainIds.bandit,
  ]);
  const restShop = await second.node(
    { column: 1, row: 3 },
    {
      type: 'shop',
      title: 'O contrabandista',
      mandatory: false,
      config: { itemIds: Object.values(itemIds) },
    },
  );
  const restFire = await second.node(
    { column: 3, row: 3 },
    { type: 'campfire', title: 'A lareira', mandatory: false, config: {} },
  );
  const jailer = await second.node(
    { column: 2, row: 4 },
    {
      type: 'boss',
      title: 'O Guardião da Torre',
      mandatory: true,
      recommendedLevel: 3,
      config: { villainIds: [villainIds.warden], questionIds },
    },
  );
  await connect(tx, chapterTwo.id, [
    [gate, west],
    [gate, east],
    [west, landing],
    [east, landing],
    [landing, restShop],
    [landing, restFire],
    [restShop, jailer],
    [restFire, jailer],
  ]);
  await tx.chapter.update({
    where: { id: chapterTwo.id },
    data: { entryNodeId: gate.id, bossNodeId: jailer.id },
  });

  const published = await publishCampaign(tx, campaignId);
  if (published.status !== 'published') {
    throw new Error(`playtest campaign refused by the publish gate: ${JSON.stringify(published)}`);
  }
  return { campaignId, version: published.version.version, warnings: published.warnings };
}
