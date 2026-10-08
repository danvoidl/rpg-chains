import { test, expect, createCampaign } from './fixtures';
import { buildPublishableChapter, importDefaultKit, publish } from './authoring';
import { continueNarrative, formBattle } from './trail';

// Authoring, a room and a battle in one flow; `next dev` compiles each route on first visit.
test.describe.configure({ timeout: 180_000 });

test('a player forms a battle, is taken to it, answers, attacks and uses a skill', async ({
  page,
  author: _author,
}) => {
  const campaignName = `Campanha de batalha ${Date.now()}`;
  const campaignId = await createCampaign(page, campaignName);
  await buildPublishableChapter(page, campaignId);
  await importDefaultKit(page, campaignId);
  await publish(page, campaignId, 1);
  await expect(page.getByRole('status').filter({ hasText: 'Versão 1 publicada.' })).toBeVisible();

  await page.goto('/rooms/new');
  await page.getByLabel('Campanha').selectOption({ label: `${campaignName} (versão 1)` });
  await page.getByLabel('Nome da sala').fill('Mesa de batalha');
  await page.getByRole('button', { name: 'Criar sala' }).click();
  await expect(page.getByRole('heading', { name: 'Mesa de batalha' })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole('button', { name: 'Escolher Guardião' }).click();

  // The entry narrative unlocks the battle; a formation opens from the battle node's balloon and
  // starting it takes the fighter to the battle.
  await continueNarrative(page);
  await formBattle(page);
  const formation = page.getByRole('listitem', { name: 'Batalha' });
  await expect(formation.getByText('em formação')).toBeVisible();
  await formation.getByRole('button', { name: 'Iniciar batalha' }).click();
  await page.waitForURL(/\/battles\/[^/]+$/, { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: 'Batalha' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('listitem', { name: 'Guardião das Correntes' })).toBeVisible();

  // The signal runs against a visible clock (spec §3.3).
  await expect(page.getByRole('progressbar', { name: 'Prazo do turno' })).toBeVisible();
  await expect(page.getByLabel('Tempo restante')).toHaveText(/^\d+s$/);

  // Signal → answer → attack. If the villain struck first, the signal opens right after.
  await page.getByRole('button', { name: 'Tocar o sinal' }).click();
  await page.getByRole('button', { name: '4', exact: true }).click();
  await page.getByRole('button', { name: 'Atacar Guardião das Correntes' }).click();

  const feed = page.getByRole('region', { name: 'Acontecimentos' });
  await expect(feed.getByText(/tocou o sinal/)).toBeVisible();
  await expect(feed.getByText(/acertou!/)).toBeVisible();
  await expect(feed.getByText(/Guardião das Correntes sofreu \d+ de dano/)).toBeVisible();
  const villainHp = page
    .getByRole('listitem', { name: 'Guardião das Correntes' })
    .getByRole('meter', { name: 'Vida' });
  await expect(villainHp).not.toHaveAttribute('aria-valuenow', '120');
  // The enemy's reply is paced, then the next signal opens.
  await expect(page.getByRole('button', { name: 'Tocar o sinal' })).toBeVisible();

  // Next round, a skill: the Guardian's provoke draws the villain's attack, then waits its cooldown.
  await page.getByRole('button', { name: 'Tocar o sinal' }).click();
  await page.getByRole('button', { name: '4', exact: true }).click();
  await page.getByRole('button', { name: /Corrente de Ferro/ }).click();
  await expect(feed.getByText('E2E Author usou Corrente de Ferro.')).toBeVisible();
  await expect(feed.getByText('E2E Author atraiu o ataque.')).toBeVisible();
  await page.getByRole('button', { name: 'Tocar o sinal' }).click();
  await page.getByRole('button', { name: '4', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /Corrente de Ferro.*volta na rodada/ }),
  ).toBeDisabled();
  await page.screenshot({ path: 'test-results/battle-page.png', fullPage: true });
  await page.getByRole('button', { name: 'Atacar Guardião das Correntes' }).click();

  // Leaving the battle page takes the fighter out (spec §7); alone, that loses the battle. A defeat
  // returns to the chapter entry (no campfire lit): the fighter is restored, and the narrative they
  // continued is undone, which locks the battle again (spec §3.7).
  await page.goto(page.url().replace(/\/battles\/[^/]+$/, ''));
  const me = page.getByRole('listitem').filter({ hasText: 'E2E Author' }).first();
  await expect(page.getByRole('listitem', { name: 'Batalha' })).toBeHidden();
  await expect(me.getByText(/Vida 120\/120/)).toBeVisible();
  await expect(me.getByText('caído')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Narrativa 1 (liberado)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Batalha 1 (bloqueado)' })).toBeVisible();
});
