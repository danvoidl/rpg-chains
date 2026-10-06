import { test, expect, createCampaign, signUp } from './fixtures';
import { buildPublishableChapter, importDefaultKit, publish } from './authoring';

// Long multi-page flow with two browser contexts; `next dev` compiles each route on first visit.
test.describe.configure({ timeout: 180_000 });

test('private room: join by code, pick a class, live updates, master transfer and close', async ({
  page,
  browser,
  author: _author,
}) => {
  // The e2e database persists across runs, so the catalog name must be unique.
  const campaignName = `Campanha para salas ${Date.now()}`;
  const campaignId = await createCampaign(page, campaignName);
  await buildPublishableChapter(page, campaignId);
  await importDefaultKit(page, campaignId);
  await publish(page, campaignId, 1);
  await expect(page.getByRole('status').filter({ hasText: 'Versão 1 publicada.' })).toBeVisible();

  // The master creates a private room and reads its access code.
  await page.goto('/rooms/new');
  await page.getByLabel('Campanha').selectOption({ label: `${campaignName} (versão 1)` });
  await page.getByLabel('Nome da sala').fill('Sala dos Correntes');
  await page.getByLabel('Sala privada (com código de acesso)').check();
  await page.getByRole('button', { name: 'Criar sala' }).click();
  // First visit compiles the room route under `next dev`.
  await expect(page.getByRole('heading', { name: 'Sala dos Correntes' })).toBeVisible({
    timeout: 60_000,
  });
  const codeText = await page.getByText(/Código de acesso:/).textContent();
  const code = /Código de acesso:\s*([A-Z0-9]{6})/.exec(codeText ?? '')?.[1];
  expect(code).toBeTruthy();

  // A second user joins with the code and picks a class.
  const ctx = await browser.newContext();
  const page2 = await ctx.newPage();
  await signUp(page2);
  await page2.goto('/rooms');
  await page2.getByLabel('Código de acesso').fill(code!);
  await page2.getByRole('button', { name: 'Entrar' }).click();
  await expect(page2.getByRole('heading', { name: 'Sala dos Correntes' })).toBeVisible();
  await page2.getByRole('button', { name: 'Escolher Guardião' }).click();
  await expect(page2.getByText('A aventura começa na próxima fase.')).toBeVisible();

  // The master sees the player and class without reloading, and the player as online.
  const playerRow = page.getByRole('listitem').filter({ hasText: /E2E Author.*Guardião/ });
  await expect(playerRow).toBeVisible();
  await expect(playerRow.getByText('online', { exact: true })).toBeAttached();

  // Transfer the master role to the player.
  await page.getByLabel('Transferir mestre para').selectOption({ label: 'E2E Author (Guardião)' });
  await page.getByRole('button', { name: 'Transferir' }).click();
  await expect(page2.getByRole('button', { name: 'Encerrar sala' })).toBeVisible();
  // The former master has no class, so they lose access to the private room (live, no reload).
  await expect(page.getByText('Sala não encontrada.')).toBeVisible();
  await page.goto(`${page.url().split('?')[0]}?code=${code}`);
  await expect(page.getByRole('button', { name: 'Encerrar sala' })).toBeHidden();

  // The new master closes the room; the room shows as closed.
  page2.once('dialog', (dialog) => void dialog.accept());
  await page2.getByRole('button', { name: 'Encerrar sala' }).click();
  await expect(page2.getByText('Sala encerrada')).toBeVisible();
  // The former master is only a spectator now (no realtime channel), so reload to see it.
  await page.reload();
  await expect(page.getByText('Sala encerrada')).toBeVisible();

  await ctx.close();
});
