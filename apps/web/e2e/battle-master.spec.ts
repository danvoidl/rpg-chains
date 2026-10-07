import { test, expect, createCampaign, signUp } from './fixtures';
import { buildPublishableChapter, importDefaultKit, publish } from './authoring';

// Two browser contexts, authoring and a battle; `next dev` compiles each route on first visit.
test.describe.configure({ timeout: 240_000 });

const OPEN = 'Por que a corrente range?';

test('the master picks an open question, the player writes an answer, the master judges it', async ({
  page,
  browser,
  author: _author,
}) => {
  // The author is the master: he plays no class, he judges.
  const campaignName = `Campanha com mestre ${Date.now()}`;
  const campaignId = await createCampaign(page, campaignName);
  await buildPublishableChapter(page, campaignId, { openQuestion: OPEN });
  await importDefaultKit(page, campaignId);
  await publish(page, campaignId, 1);
  await expect(page.getByRole('status').filter({ hasText: 'Versão 1 publicada.' })).toBeVisible();

  await page.goto('/rooms/new');
  await page.getByLabel('Campanha').selectOption({ label: `${campaignName} (versão 1)` });
  await page.getByLabel('Nome da sala').fill('Mesa do mestre');
  await page.getByRole('button', { name: 'Criar sala' }).click();
  await expect(page.getByRole('heading', { name: 'Mesa do mestre' })).toBeVisible({
    timeout: 60_000,
  });
  const roomUrl = page.url();

  // A player opens the battle and starts it while the master is in the room.
  const ctx = await browser.newContext();
  const player = await ctx.newPage();
  await signUp(player);
  await player.goto(roomUrl);
  await player.getByRole('button', { name: 'Escolher Penitente' }).click();
  await player.getByRole('button', { name: 'Abrir formação: Batalha' }).click();
  const formation = player.getByRole('listitem', { name: 'Batalha 1' });
  await formation.getByRole('button', { name: 'Iniciar batalha' }).click();

  // Both are taken to the battle: the fighter, and the master who must judge.
  for (const p of [player, page]) {
    await p.waitForURL(/\/battles\/[^/]+$/, { timeout: 60_000 });
  }
  await expect(player.getByText('O mestre está escolhendo a pergunta…')).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole('button', { name: OPEN }).click();

  await player.getByRole('button', { name: 'Tocar o sinal' }).click();
  await player.getByLabel('Sua resposta').fill('Porque alguém a puxa no escuro.');
  await player.getByRole('button', { name: 'Enviar resposta' }).click();
  await expect(player.getByText('Aguardando o julgamento do mestre…')).toBeVisible();

  await expect(page.getByText('Porque alguém a puxa no escuro.').first()).toBeVisible();
  await page.getByRole('button', { name: 'Aprovar' }).click();

  // Approved: the player acts; then the turn comes back to the master's choice.
  await player.getByRole('button', { name: 'Atacar Guardião das Correntes' }).click();
  const feed = player.getByRole('region', { name: 'Acontecimentos' });
  await expect(feed.getByText(/Guardião das Correntes sofreu \d+ de dano/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sortear uma pergunta objetiva' })).toBeVisible();
  await page.screenshot({ path: 'test-results/battle-master.png', fullPage: true });
  await ctx.close();
});
