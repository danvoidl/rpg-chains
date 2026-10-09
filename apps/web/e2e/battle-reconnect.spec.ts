import { test, expect, createCampaign } from './fixtures';
import { buildPublishableChapter, importDefaultKit, publish } from './authoring';
import { leaveBattle } from './battle-turns';
import { continueNarrative, formBattle } from './trail';

// Authoring, a room and a battle in one flow; `next dev` compiles each route on first visit.
test.describe.configure({ timeout: 180_000 });

test('a fighter who reloads or walks to the room comes back to the same battle (spec §7)', async ({
  page,
  author: _author,
}) => {
  const campaignName = `Campanha de reconexão ${Date.now()}`;
  const campaignId = await createCampaign(page, campaignName);
  await buildPublishableChapter(page, campaignId);
  await importDefaultKit(page, campaignId);
  await publish(page, campaignId, 1);
  await expect(page.getByRole('status').filter({ hasText: 'Versão 1 publicada.' })).toBeVisible();

  await page.goto('/rooms/new');
  await page.getByLabel('Campanha').selectOption({ label: `${campaignName} (versão 1)` });
  await page.getByLabel('Nome da sala').fill('Mesa da conexão');
  await page.getByRole('button', { name: 'Criar sala' }).click();
  await expect(page.getByRole('heading', { name: 'Mesa da conexão' })).toBeVisible({
    timeout: 60_000,
  });
  const roomUrl = page.url();
  await page.getByRole('button', { name: 'Escolher Guardião' }).click();
  await continueNarrative(page);
  await formBattle(page);
  await page
    .getByRole('listitem', { name: 'Batalha' })
    .getByRole('button', { name: 'Iniciar batalha' })
    .click();
  await page.waitForURL(/\/battles\/[^/]+$/, { timeout: 60_000 });
  const battleUrl = page.url();
  const me = page.getByRole('listitem', { name: 'E2E Author' });
  await expect(me).toBeVisible({ timeout: 60_000 });

  // A reload is a drop inside the grace, not a departure: the fighter is still in, and plays on.
  await page.reload();
  await expect(me).toBeVisible({ timeout: 60_000 });
  await expect(me.getByText('saiu')).toBeHidden();
  await expect(me.getByText('sem conexão')).toBeHidden();
  // Alone, the drop paused the battle; coming back reopened the signal.
  const feed = page.getByRole('region', { name: 'Acontecimentos' });
  await page.getByRole('button', { name: 'Tocar o sinal' }).click();
  await page.getByRole('button', { name: '4', exact: true }).click();
  await page.getByRole('button', { name: 'Atacar Guardião das Correntes' }).click();
  await expect(feed.getByText(/Guardião das Correntes sofreu \d+ de dano/)).toBeVisible();

  // Walking to the room is a drop too; the room offers the way back.
  await page.goto(roomUrl);
  await page
    .getByRole('listitem', { name: 'Batalha' })
    .getByRole('link', { name: 'Voltar à batalha' })
    .click();
  await page.waitForURL(battleUrl);
  await expect(me).toBeVisible({ timeout: 60_000 });
  await expect(me.getByText('saiu')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Tocar o sinal' })).toBeVisible();

  // The master (here also the fighter) restarts it: a fresh formation of the same group.
  await page.goto(roomUrl);
  const card = page.getByRole('listitem', { name: 'Batalha' });
  page.once('dialog', (dialog) => void dialog.accept());
  await card.getByRole('button', { name: 'Reiniciar' }).click();
  await expect(card.getByText('em formação')).toBeVisible();
  await card.getByRole('button', { name: 'Iniciar batalha' }).click();
  await page.waitForURL(/\/battles\/[^/]+$/, { timeout: 60_000 });
  expect(page.url()).not.toBe(battleUrl);
  await expect(page.getByRole('button', { name: 'Tocar o sinal' })).toBeVisible({
    timeout: 60_000,
  });

  // Leaving on purpose is for good: alone, that is a defeat back at the chapter entry.
  await leaveBattle(page);
  await expect(page.getByRole('listitem', { name: 'Batalha' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Batalha 1 (bloqueado)' })).toBeVisible();
});
