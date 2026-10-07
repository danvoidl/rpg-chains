import type { Page } from '@playwright/test';
import { test, expect, createCampaign, signUp } from './fixtures';
import { buildPublishableChapter, importDefaultKit, publish } from './authoring';

// Two browser contexts, authoring and a whole battle; `next dev` compiles each route on first visit.
test.describe.configure({ timeout: 240_000 });

const VILLAIN = 'Guardião das Correntes';

/** Which page may tap the signal now, or 'over' once the battle shows its result. */
async function nextTurn(pages: Page[]): Promise<number | 'over'> {
  let found: number | 'over' | null = null;
  await expect
    .poll(
      async () => {
        for (const [index, p] of pages.entries()) {
          if (await p.getByRole('status').filter({ hasText: 'Vitória!' }).isVisible())
            return (found = 'over');
          if (await p.getByRole('button', { name: 'Tocar o sinal' }).isVisible()) {
            return (found = index);
          }
        }
        return null;
      },
      { timeout: 20_000 },
    )
    .not.toBeNull();
  return found!;
}

test('two players beat the villain taking turns, earn gold and trade it', async ({
  page,
  browser,
  author: _author,
}) => {
  // A weak villain (25 HP) worth 30 gold: a few hits win. BATTLE_SEED fixes the rolls
  // (playwright.config.ts).
  const campaignName = `Campanha em grupo ${Date.now()}`;
  const campaignId = await createCampaign(page, campaignName);
  await buildPublishableChapter(page, campaignId, { villainHp: 25, goldReward: 30 });
  await importDefaultKit(page, campaignId);
  await publish(page, campaignId, 1);
  await expect(page.getByRole('status').filter({ hasText: 'Versão 1 publicada.' })).toBeVisible();

  await page.goto('/rooms/new');
  await page.getByLabel('Campanha').selectOption({ label: `${campaignName} (versão 1)` });
  await page.getByLabel('Nome da sala').fill('Mesa em grupo');
  await page.getByRole('button', { name: 'Criar sala' }).click();
  await expect(page.getByRole('heading', { name: 'Mesa em grupo' })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole('button', { name: 'Escolher Guardião' }).click();
  const roomUrl = page.url();

  // The second player enters the public room and picks another class.
  const ctx = await browser.newContext();
  const page2 = await ctx.newPage();
  await signUp(page2);
  await page2.goto(roomUrl);
  await page2.getByRole('button', { name: 'Escolher Penitente' }).click();

  // One opens the formation, the other joins it live, the first starts: both go to the battle.
  await page.getByRole('button', { name: 'Abrir formação: Batalha' }).click();
  const formation2 = page2.getByRole('listitem', { name: 'Batalha 1' });
  await formation2.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('listitem', { name: 'Batalha 1' })).toContainText('(2/3)');
  await page
    .getByRole('listitem', { name: 'Batalha 1' })
    .getByRole('button', { name: 'Iniciar batalha' })
    .click();
  for (const p of [page, page2]) {
    await p.waitForURL(/\/battles\/[^/]+$/, { timeout: 60_000 });
    await expect(p.getByRole('listitem', { name: VILLAIN })).toBeVisible({ timeout: 60_000 });
  }

  // Play until the villain falls; whoever acted sits out the next signal (bell rotation).
  const pages = [page, page2];
  const tappers: number[] = [];
  for (let turn = 0; turn < 12; turn++) {
    const who = await nextTurn(pages);
    if (who === 'over') break;
    const p = pages[who]!;
    tappers.push(who);
    await p.getByRole('button', { name: 'Tocar o sinal' }).click();
    await p.getByRole('button', { name: '4', exact: true }).click();
    await p.getByRole('button', { name: `Atacar ${VILLAIN}` }).click();
  }
  for (const p of pages)
    await expect(p.getByRole('status').filter({ hasText: 'Vitória!' })).toBeVisible();
  expect(new Set(tappers)).toEqual(new Set([0, 1]));
  expect(tappers.slice(1).every((who, i) => who !== tappers[i])).toBe(true);
  // Each participant got the whole reward (Fase 4 plan decision 2): nothing is split.
  for (const p of pages) {
    await expect(p.getByRole('list', { name: 'Recompensas' }).getByRole('listitem')).toHaveCount(2);
    await expect(p.getByRole('list', { name: 'Recompensas' })).toContainText('30 de ouro');
  }

  // Back in the room: the battle is gone and the profiles carry the damage taken.
  await page.getByRole('link', { name: 'Voltar à sala' }).click();
  await expect(page.getByRole('listitem', { name: 'Batalha 1' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Abrir formação: Batalha' })).toBeEnabled();
  const resources = await page.getByText(/^Vida \d+\/\d+/).allTextContents();
  const hurt = resources.some((text) => {
    const [, current, max] = /Vida (\d+)\/(\d+)/.exec(text)!;
    return Number(current) < Number(max);
  });
  expect(hurt).toBe(true);

  // The gold is each player's own; one gives 10 to the other, who has to accept (spec §6).
  await expect(page.getByText('30 de ouro')).toBeVisible();
  await page.getByLabel(/^Ouro \(você tem/).fill('10');
  await page.getByRole('button', { name: 'Enviar oferta' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Oferta enviada' })).toBeVisible();
  await page2.goto(roomUrl);
  await expect(page2.getByText(/oferece 10 de ouro e pede nada/)).toBeVisible();
  await page2.getByRole('button', { name: 'Aceitar' }).click();
  await expect(page2.getByText('40 de ouro')).toBeVisible();
  await expect(page.getByText('20 de ouro')).toBeVisible();
  await ctx.close();
});
