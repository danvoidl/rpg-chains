import type { Prisma } from '@prisma/client';
import { importDefaultKit } from './default-kit.js';
import { publishCampaign } from './publish-campaign.js';

/**
 * The Fase 3 playtest campaign (plan M5): the default kit and one chapter — a narrative opening,
 * three battles and a boss — with objective questions only, for groups of 2–4 at level 1. The
 * numbers are a first guess for the playtest to correct, and they are campaign content (what an
 * author would type), not system balancing, so they live here rather than in `game-config`.
 */

interface VillainSpec {
  name: string;
  hp: number;
  defense: number;
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
    attacks: [{ name: 'Mordida', baseDamage: 5, targetType: 'single', cooldownRounds: 0 }],
  },
  bandit: {
    name: 'Bandido da Estrada',
    hp: 50,
    defense: 5,
    attacks: [
      { name: 'Corte', baseDamage: 8, targetType: 'single', cooldownRounds: 0 },
      { name: 'Areia nos Olhos', baseDamage: 5, targetType: 'area', cooldownRounds: 2 },
    ],
  },
  wolf: {
    name: 'Lobo Cinzento',
    hp: 20,
    defense: 0,
    attacks: [{ name: 'Dentada', baseDamage: 5, targetType: 'single', cooldownRounds: 0 }],
  },
  warden: {
    name: 'Carcereiro da Corrente',
    hp: 90,
    defense: 10,
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

export interface PlaytestCampaign {
  campaignId: string;
  version: number;
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
        'Campanha de playtest da Fase 3: três batalhas e um chefe, só perguntas objetivas.',
    },
  });
  const campaignId = campaign.id;
  await importDefaultKit(tx, campaignId);

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

  const chapter = await tx.chapter.create({ data: { campaignId, name: 'O Porão das Correntes' } });
  const node = (
    data: Omit<Prisma.ChapterNodeUncheckedCreateInput, 'chapterId' | 'posY'> & { posX: number },
  ) => tx.chapterNode.create({ data: { chapterId: chapter.id, posY: 200, ...data } });
  const battle = (title: string, posX: number, lineup: string[]) =>
    node({
      type: 'battle',
      title,
      mandatory: true,
      recommendedLevel: 1,
      participantLimit: PARTICIPANT_LIMIT,
      posX,
      config: { villainIds: lineup, questionIds },
    });

  const opening = await node({
    type: 'narrative',
    title: 'A descida',
    mandatory: true,
    posX: 100,
    config: {
      text: 'Uma corrente range no fundo do porão. Algo se mexe no escuro.',
      videoUrl: null,
    },
  });
  const nodes = [
    opening,
    await battle('Ratos no porão', 300, [villainIds.rat, villainIds.rat]),
    await battle('O bandido', 500, [villainIds.bandit]),
    await battle('A matilha', 700, [villainIds.wolf, villainIds.wolf, villainIds.wolf]),
    await node({
      type: 'boss',
      title: 'O Carcereiro',
      mandatory: true,
      recommendedLevel: 1,
      posX: 900,
      config: { villainIds: [villainIds.warden], questionIds },
    }),
  ];
  await tx.nodeEdge.createMany({
    data: nodes
      .slice(1)
      .map((to, i) => ({ chapterId: chapter.id, fromId: nodes[i]!.id, toId: to.id })),
  });
  await tx.chapter.update({
    where: { id: chapter.id },
    data: { entryNodeId: opening.id, bossNodeId: nodes.at(-1)!.id },
  });

  const published = await publishCampaign(tx, campaignId);
  if (published.status !== 'published') {
    throw new Error(`playtest campaign refused by the publish gate: ${JSON.stringify(published)}`);
  }
  return { campaignId, version: published.version.version };
}
