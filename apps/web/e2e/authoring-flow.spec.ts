import { test, expect, createCampaign } from './fixtures';
import {
  buildPublishableChapter,
  importDefaultKit,
  openTab,
  publish,
  saveGraph,
  selectNode,
} from './authoring';

// Long multi-page flows; `next dev` also compiles each route on its first visit.
test.describe.configure({ timeout: 180_000 });

test('author builds a campaign, publishes v1, an additive v2, and is refused a destructive v3', async ({
  page,
  author: _author,
}) => {
  const campaignId = await createCampaign(page, 'As Sete Correntes');
  await buildPublishableChapter(page, campaignId);
  await importDefaultKit(page, campaignId);

  // v1 — first publish shows the compatibility contract.
  await publish(page, campaignId, 1);
  await expect(page.getByRole('status').filter({ hasText: 'Versão 1 publicada.' })).toBeVisible();

  // v2 — additive: a campfire branch entry → campfire → boss.
  await openTab(page, campaignId, 'chapters', 'Capítulos');
  await page.getByRole('link', { name: 'Abrir editor' }).click();
  await page.getByRole('button', { name: 'Adicionar Fogueira' }).click();
  await page.getByLabel('Nome do nó').fill('Acampamento');
  await expect(page.getByRole('heading', { name: 'Acampamento', exact: true })).toBeVisible();
  await page.getByRole('group', { name: 'Liga para' }).getByLabel('Chefe 1').check();
  await selectNode(page, 'Narrativa 1');
  await page.getByRole('group', { name: 'Liga para' }).getByLabel('Acampamento').check();
  await saveGraph(page);
  await publish(page, campaignId, 2);
  await expect(page.getByRole('status').filter({ hasText: 'Versão 2 publicada.' })).toBeVisible();

  // v3 — destructive: deleting the published campfire is refused with the violation list.
  await openTab(page, campaignId, 'chapters', 'Capítulos');
  await page.getByRole('link', { name: 'Abrir editor' }).click();
  await selectNode(page, 'Acampamento');
  await page.getByRole('button', { name: 'Excluir nó' }).click();
  await saveGraph(page);
  await publish(page, campaignId, 3);
  const refusal = page
    .getByRole('alert')
    .filter({ hasText: 'Publicação recusada: mudanças incompatíveis' });
  await expect(refusal).toBeVisible();
  await expect(refusal.getByRole('heading', { name: 'Conteúdo publicado excluído' })).toBeVisible();

  const history = page.getByRole('table');
  await expect(history.getByRole('row')).toHaveCount(3); // header + v2 + v1
});

test('the editor flags problems live before saving', async ({ page, author: _author }) => {
  const campaignId = await createCampaign(page, 'Campanha incompleta');
  await openTab(page, campaignId, 'chapters', 'Capítulos');
  await page.getByLabel('Nome do capítulo').fill('Rascunho');
  await page.getByRole('button', { name: 'Criar capítulo' }).click();
  await page.getByRole('link', { name: 'Abrir editor' }).click();

  await page.getByRole('button', { name: 'Adicionar Batalha' }).click();
  const problems = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Problemas' }) });
  await expect(problems.getByText('O capítulo não tem nó de entrada.')).toBeVisible();
  await expect(problems.getByText('A batalha precisa de pelo menos um vilão.')).toBeVisible();
  await expect(page.getByText('Alterações não salvas')).toBeVisible();
});
