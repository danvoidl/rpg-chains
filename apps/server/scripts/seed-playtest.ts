import { prisma } from '../src/db.js';
import { createPlaytestCampaign } from '../src/services/playtest-campaign.js';

/**
 * Seeds the Fase 3 playtest campaign (plan M5) for an existing account, which becomes its author:
 *   pnpm --filter @rpg-chains/server seed:playtest <author e-mail>
 * Then, in the web app, that author creates a room from it in the catalog.
 */
const email = process.argv[2];
if (!email) {
  console.error('usage: seed:playtest <author e-mail>');
  process.exit(1);
}

const author = await prisma.user.findUnique({ where: { email }, select: { id: true } });
if (!author) {
  console.error(`no account with e-mail ${email}: sign up in the web app first`);
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const { campaignId, version } = await prisma.$transaction((tx) =>
  createPlaytestCampaign(tx, author.id, `Playtest Fase 3 (${stamp})`),
);
console.log(`published campaign ${campaignId} as version ${version}`);
await prisma.$disconnect();
