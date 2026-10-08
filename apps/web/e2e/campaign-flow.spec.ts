import type { Page } from '@playwright/test';
import { test, expect, createCampaign, signUp } from './fixtures';
import {
  buildTrailChapter,
  createObjectiveQuestion,
  createVillain,
  importDefaultKit,
  publish,
} from './authoring';
import { playToVictory } from './battle-turns';
import { continueNarrative, formBattle } from './trail';

// The whole chapter flow of Fase 5 with two players: authoring two chapters, then playing them to
// the end, a defeat included, and closing into the history. `next dev` compiles each route once.
test.describe.configure({ timeout: 480_000 });

const VILLAIN = 'Guardião das Correntes';

/** Closes the chapter opening shown on first reaching it (Fase 5 plan decision 11). */
async function dismissOpening(page: Page, chapter: string) {
  const opening = page.getByRole('dialog', { name: `Abertura: ${chapter}` });
  await expect(opening).toBeVisible();
  await opening.getByRole('button', { name: 'Começar' }).click();
  await expect(opening).toBeHidden();
}

/** `first` forms a battle on `node`, `second` joins it, `first` starts it: both are taken there. */
async function fightTogether(first: Page, second: Page, node: string) {
  await formBattle(first, node);
  await second
    .getByRole('listitem', { name: node })
    .getByRole('button', { name: 'Entrar' })
    .click();
  // Both in (a boss has no seat limit, so no "n/m" to read).
  await expect(first.getByRole('listitem', { name: node })).toContainText('E2E Author, E2E Author');
  await first
    .getByRole('listitem', { name: node })
    .getByRole('button', { name: 'Iniciar batalha' })
    .click();
  for (const p of [first, second]) {
    await p.waitForURL(/\/battles\/[^/]+$/, { timeout: 60_000 });
    await expect(p.getByRole('listitem', { name: VILLAIN })).toBeVisible({ timeout: 60_000 });
  }
  await playToVictory([first, second], VILLAIN);
}

test('two players play a campaign to the end: openings, a defeat, two bosses, the history', async ({
  page,
  browser,
  author: _author,
}) => {
  // A weak villain (25 HP) that pays: every battle falls in a few hits. BATTLE_SEED fixes the
  // rolls (playwright.config.ts).
  const campaignName = `Campanha completa ${Date.now()}`;
  const campaignId = await createCampaign(page, campaignName);
  await createVillain(page, campaignId, VILLAIN, false, 25, 30);
  await createObjectiveQuestion(page, campaignId, 'Quanto é 2 + 2?');
  await importDefaultKit(page, campaignId);
  await buildTrailChapter(
    page,
    campaignId,
    'A Primeira Corrente',
    { narrative: 'Prólogo', battle: 'Ponte', campfire: 'Brasas', boss: 'Portão' },
    'Uma corrente range no escuro.',
  );
  await buildTrailChapter(
    page,
    campaignId,
    'A Segunda Corrente',
    { narrative: 'Epílogo', boss: 'Torre' },
    'A torre espera no alto.',
  );
  await publish(page, campaignId, 1);
  await expect(page.getByRole('status').filter({ hasText: 'Versão 1 publicada.' })).toBeVisible();

  // The author opens a room and plays; a second player joins.
  await page.goto('/rooms/new');
  await page.getByLabel('Campanha').selectOption({ label: `${campaignName} (versão 1)` });
  await page.getByLabel('Nome da sala').fill('Mesa completa');
  await page.getByRole('button', { name: 'Criar sala' }).click();
  await expect(page.getByRole('heading', { name: 'Mesa completa' })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole('button', { name: 'Escolher Guardião' }).click();
  await dismissOpening(page, 'A Primeira Corrente');
  const roomUrl = page.url();

  const ctx = await browser.newContext();
  const page2 = await ctx.newPage();
  await signUp(page2);
  await page2.goto(roomUrl);
  await page2.getByRole('button', { name: 'Escolher Penitente' }).click();
  await dismissOpening(page2, 'A Primeira Corrente');

  // Chapter 1: the narrative unlocks the battle; both win it; the author lights the campfire.
  await continueNarrative(page, 'Prólogo');
  await fightTogether(page, page2, 'Ponte');
  for (const p of [page, page2]) await p.getByRole('link', { name: 'Voltar à sala' }).click();
  await expect(page.getByRole('button', { name: 'Ponte (vencido)' })).toBeVisible();
  await page.getByRole('button', { name: 'Brasas (liberado)' }).click();
  await page
    .getByRole('dialog', { name: 'Brasas' })
    .getByRole('button', { name: 'Acender a fogueira' })
    .click();
  await expect(page.getByRole('button', { name: 'Brasas (acesa)' })).toBeVisible();

  // A defeat: the author faces the boss alone and walks out (spec §7). The group returns to the
  // lit campfire — what came before it stays won, and the author is back on their feet.
  await formBattle(page, 'Portão');
  await page
    .getByRole('listitem', { name: 'Portão' })
    .getByRole('button', { name: 'Iniciar batalha' })
    .click();
  await page.waitForURL(/\/battles\/[^/]+$/, { timeout: 60_000 });
  await page.goto(roomUrl);
  await expect(page.getByRole('listitem', { name: 'Portão' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Ponte (vencido)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Brasas (acesa)' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Portão \(liberado/ })).toBeVisible();
  await expect(page.getByText('caído')).toBeHidden();

  // Together they beat the boss: the chapter is cleared and chapter 2 opens.
  await fightTogether(page, page2, 'Portão');
  for (const p of [page, page2]) {
    await expect(p.getByText('Capítulo concluído!')).toBeVisible();
    await p.getByRole('link', { name: 'Voltar à sala' }).click();
    await dismissOpening(p, 'A Segunda Corrente');
  }

  // Chapter 2: the narrative, then the last boss completes the campaign.
  await continueNarrative(page, 'Epílogo');
  await fightTogether(page, page2, 'Torre');
  for (const p of [page, page2]) {
    await expect(p.getByText('Campanha concluída!')).toBeVisible();
    await p.getByRole('link', { name: 'Voltar à sala' }).click();
  }
  const banner = page.getByRole('region', { name: 'Campanha concluída' });
  await expect(banner).toBeVisible();

  // The master closes the room; each player finds the campaign in their history.
  page.once('dialog', (dialog) => dialog.accept());
  await banner.getByRole('button', { name: 'Encerrar a sala' }).click();
  await expect(page.getByText('Sala encerrada')).toBeVisible();
  await page.getByRole('link', { name: 'Ver no histórico' }).click();
  for (const p of [page, page2]) {
    if (p === page2) await p.goto('/history');
    const entry = p.getByRole('listitem', { name: campaignName });
    await expect(entry).toBeVisible();
    await expect(entry).toContainText('Campanha concluída');
    await expect(entry).toContainText('Mesa completa');
  }
  await page.screenshot({ path: 'test-results/history-page.png', fullPage: true });
  await ctx.close();
});
