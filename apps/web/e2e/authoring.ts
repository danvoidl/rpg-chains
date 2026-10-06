import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect } from './fixtures';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Opens a campaign tab (Capítulos, Vilões, …) from the campaign tab nav. */
export async function openTab(page: Page, campaignId: string, segment: string, heading: string) {
  await page.goto(`/campaigns/${campaignId}/${segment}`);
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
}

export async function createVillain(
  page: Page,
  campaignId: string,
  name: string,
  withImage: boolean,
  hp = 120,
) {
  await openTab(page, campaignId, 'villains', 'Vilões');
  await page.getByLabel('Nome', { exact: true }).fill(name);
  if (withImage) {
    await page.getByLabel('Imagem').setInputFiles(path.join(here, 'assets/villain.png'));
    await expect(page.getByRole('img', { name: 'Imagem' })).toBeVisible();
  }
  await page.getByLabel('Vida').fill(String(hp));
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

export async function createObjectiveQuestion(page: Page, campaignId: string, prompt: string) {
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
export async function selectNode(page: Page, label: string) {
  await page.locator('.react-flow__node').filter({ hasText: label }).first().click();
  await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
}

export async function saveGraph(page: Page) {
  await page.getByRole('button', { name: 'Salvar grafo' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Grafo salvo' })).toBeVisible();
}

export async function publish(page: Page, campaignId: string, version: number) {
  await openTab(page, campaignId, 'publish', 'Publicar');
  const contract = page.getByLabel('Entendi as regras de compatibilidade');
  if (await contract.count()) await contract.check();
  await page.getByRole('button', { name: `Publicar versão ${version}` }).click();
}

/** Copies the default kit (4 classes + their weapons) into the campaign from the Classes tab. */
export async function importDefaultKit(page: Page, campaignId: string) {
  await openTab(page, campaignId, 'classes', 'Classes');
  await page.getByRole('button', { name: 'Importar kit padrão' }).click();
  await expect(page.getByText('Sacerdote', { exact: true })).toBeVisible();
}

/**
 * A publishable campaign body: one villain, one objective question and a chapter graph
 * Narrativa (entry) → Batalha → Chefe, saved. Classes are up to the caller; `villainHp` makes the
 * villain quick to beat in battle flows.
 */
export async function buildPublishableChapter(page: Page, campaignId: string, villainHp = 120) {
  await createVillain(page, campaignId, 'Guardião das Correntes', true, villainHp);
  await createObjectiveQuestion(page, campaignId, 'Quanto é 2 + 2?');

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
}
