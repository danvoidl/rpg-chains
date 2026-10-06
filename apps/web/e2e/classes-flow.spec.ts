import type { Locator, Page } from '@playwright/test';
import { test, expect, createCampaign } from './fixtures';
import { buildPublishableChapter, importDefaultKit, openTab, publish } from './authoring';

// Long multi-page flows; `next dev` also compiles each route on its first visit.
test.describe.configure({ timeout: 180_000 });

/** Opens the inline editor of a class on the Classes tab and returns its row. */
async function editClass(page: Page, campaignId: string, name: string): Promise<Locator> {
  await openTab(page, campaignId, 'classes', 'Classes');
  await page
    .getByRole('listitem')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Editar' })
    .click();
  await expect(page.getByText(`Editando: ${name}`)).toBeVisible();
  return page.getByRole('listitem').filter({ hasText: `Editando: ${name}` });
}

test('kit classes publish, a skill rebalance rolls forward, removing a skill is refused', async ({
  page,
  author: _author,
}) => {
  const campaignId = await createCampaign(page, 'Campanha com classes');
  await buildPublishableChapter(page, campaignId);
  await importDefaultKit(page, campaignId);
  await expect(page.getByText('Guardião', { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Vida 120 · Energia 40 · Vagas 2 · Arma: Maça de Ferro/),
  ).toBeVisible();

  await publish(page, campaignId, 1);
  await expect(page.getByRole('status').filter({ hasText: 'Versão 1 publicada.' })).toBeVisible();

  // v2 — rebalance a skill: the skill id is kept, so the version is compatible.
  let editor = await editClass(page, campaignId, 'Guardião');
  await editor.getByLabel('Custo de energia').first().fill('20');
  await editor.getByRole('button', { name: 'Salvar classe' }).click();
  await expect(page.getByText('Editando: Guardião')).toBeHidden();
  await publish(page, campaignId, 2);
  await expect(page.getByRole('status').filter({ hasText: 'Versão 2 publicada.' })).toBeVisible();

  // v3 — remove a published skill from the class: refused.
  editor = await editClass(page, campaignId, 'Guardião');
  await editor.getByRole('button', { name: 'Remover habilidade' }).last().click();
  await editor.getByRole('button', { name: 'Salvar classe' }).click();
  await expect(page.getByText('Editando: Guardião')).toBeHidden();
  await publish(page, campaignId, 3);
  const refusal = page
    .getByRole('alert')
    .filter({ hasText: 'Publicação recusada: mudanças incompatíveis' });
  await expect(refusal).toBeVisible();
  await expect(refusal.getByText('Habilidade publicada não pode ser excluída.')).toBeVisible();
});

test('the class editor flags blocking rules and asks to confirm out-of-band values', async ({
  page,
  author: _author,
}) => {
  const campaignId = await createCampaign(page, 'Classe desbalanceada');
  await openTab(page, campaignId, 'classes', 'Classes');

  const form = page.locator('form');
  await form.getByLabel('Nome', { exact: true }).fill('Mago Livre');
  await form.getByLabel('Vida base').fill('200');
  await form.getByRole('button', { name: 'Adicionar habilidade' }).click();
  await form.getByLabel('Nome da habilidade').fill('Raio Infinito');
  await form.getByLabel('Custo de energia').fill('0');
  await form.getByLabel('Recarga (rodadas)').fill('0');
  await form.getByLabel('Tipo de efeito').selectOption({ label: 'Atordoar' });
  await form.getByLabel('Duração (rodadas)').fill('2');

  await expect(
    form.getByText('Classe: A classe precisa de uma arma base (um item no slot de arma).'),
  ).toBeVisible();
  await expect(
    form.getByText('Habilidade 1: Habilidade sem custo de energia e sem recarga não é permitida.'),
  ).toBeVisible();
  await expect(form.getByText(/Habilidade 1: Duração acima do limite/)).toBeVisible();
  await expect(
    form.getByText('Classe: Vida base 200 fora da faixa recomendada (80–120).'),
  ).toBeVisible();

  // Saving with balancing warnings asks to confirm; blocking issues still save as a draft.
  page.once('dialog', (dialog) => void dialog.accept());
  await form.getByRole('button', { name: 'Criar classe' }).click();
  await expect(page.getByText('Mago Livre', { exact: true })).toBeVisible();

  await openTab(page, campaignId, 'publish', 'Publicar');
  await expect(
    page.getByText('Habilidade sem custo de energia e sem recarga não é permitida.'),
  ).toBeVisible();
  // The edited effect reached the server: the publish page validates the stored draft.
  await expect(page.getByText(/Duração acima do limite para este efeito/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publicar versão 1' })).toBeDisabled();
});
