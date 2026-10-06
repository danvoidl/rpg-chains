import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { test, expect, createCampaign } from './fixtures';

const here = path.dirname(fileURLToPath(import.meta.url));

// Long multi-page flows; `next dev` also compiles each route on its first visit.
test.describe.configure({ timeout: 180_000 });

/** Opens a campaign tab (Capítulos, Vilões, …) from the campaign tab nav. */
async function openTab(page: Page, campaignId: string, segment: string, heading: string) {
  await page.goto(`/campaigns/${campaignId}/${segment}`);
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
}

async function createVillain(page: Page, campaignId: string, name: string, withImage: boolean) {
  await openTab(page, campaignId, 'villains', 'Vilões');
  await page.getByLabel('Nome', { exact: true }).fill(name);
  if (withImage) {
    await page.getByLabel('Imagem').setInputFiles(path.join(here, 'assets/villain.png'));
    await expect(page.getByRole('img', { name: 'Imagem' })).toBeVisible();
  }
  await page.getByLabel('Vida').fill('120');
  await page.getByLabel('Força').fill('5');
  await page.getByLabel('Destreza').fill('3');
  await page.getByLabel('Inteligência').fill('2');
  await page.getByLabel('Defesa').fill('4');
  if ((await page.getByLabel('Nome do ataque').count()) === 0) {
    await page.getByRole('button', { name: 'Adicionar ataque' }).click();
  }
  await page.getByLabel('Nome do ataque').fill('Chicotada');
  await page.getByLabel('Dano base').fill('10');
  await page.getByLabel('Recarga (rodadas)').fill('0');
  await page.getByRole('button', { name: 'Criar vilão' }).click();
  await expect(page.getByText(name).first()).toBeVisible();
}

async function createObjectiveQuestion(page: Page, campaignId: string, prompt: string) {
  await openTab(page, campaignId, 'questions', 'Banco de perguntas');
  await page.getByLabel('Tipo', { exact: true }).selectOption('objective');
  await page.getByLabel('Enunciado').fill(prompt);
  await page.getByLabel('Alternativa 1', { exact: true }).fill('3');
  await page.getByLabel('Alternativa 2', { exact: true }).fill('4');
  await page.getByLabel('Resposta correta').selectOption({ label: 'Alternativa 2' });
  await page.getByRole('button', { name: /Criar pergunta/ }).click();
  await expect(page.getByText(prompt).first()).toBeVisible();
}

/** Selects a node on the canvas by its display label. */
async function selectNode(page: Page, label: string) {
  await page.locator('.react-flow__node').filter({ hasText: label }).first().click();
  await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
}

async function saveGraph(page: Page) {
  await page.getByRole('button', { name: 'Salvar grafo' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Grafo salvo' })).toBeVisible();
}

async function publish(page: Page, campaignId: string, version: number) {
  await openTab(page, campaignId, 'publish', 'Publicar');
  const contract = page.getByLabel('Entendi as regras de compatibilidade');
  if (await contract.count()) await contract.check();
  await page.getByRole('button', { name: `Publicar versão ${version}` }).click();
}

test('author builds a campaign, publishes v1, an additive v2, and is refused a destructive v3', async ({
  page,
  author: _author,
}) => {
  const campaignId = await createCampaign(page, 'As Sete Correntes');
  await createVillain(page, campaignId, 'Guardião das Correntes', true);
  await createObjectiveQuestion(page, campaignId, 'Quanto é 2 + 2?');

  // Chapter + graph: Narrativa (entry) → Batalha → Chefe.
  await openTab(page, campaignId, 'chapters', 'Capítulos');
  await page.getByLabel('Nome do capítulo').fill('A Primeira Corrente');
  await page.getByRole('button', { name: 'Criar capítulo' }).click();
  await page.getByRole('link', { name: 'Abrir editor' }).click();

  await page.getByRole('button', { name: 'Adicionar Narrativa' }).click();
  await page.getByRole('button', { name: 'Definir como entrada' }).click();
  await page.getByRole('button', { name: 'Adicionar Batalha' }).click();
  await page.getByLabel('Nível recomendado').fill('1');
  await page.getByLabel('Limite de participantes').fill('3');
  await page.getByRole('group', { name: 'Vilões' }).getByLabel('Guardião das Correntes').fill('1');
  await page.getByRole('group', { name: 'Perguntas' }).getByLabel('Quanto é 2 + 2?').check();
  await page.getByRole('button', { name: 'Adicionar Chefe' }).click();
  await page.getByRole('button', { name: 'Definir como chefe' }).click();
  await page.getByLabel('Nível recomendado').fill('2');
  await page.getByRole('group', { name: 'Vilões' }).getByLabel('Guardião das Correntes').fill('1');

  await selectNode(page, 'Narrativa 1');
  await page.getByRole('group', { name: 'Liga para' }).getByLabel('Batalha 1').check();
  await selectNode(page, 'Batalha 1');
  await page.getByRole('group', { name: 'Liga para' }).getByLabel('Chefe 1').check();

  await expect(page.getByText('Nenhum problema — capítulo pronto para publicar.')).toBeVisible();
  await saveGraph(page);

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
