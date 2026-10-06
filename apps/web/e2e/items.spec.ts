import { test, expect, createCampaign } from './fixtures';
import { openTab } from './authoring';

test.describe.configure({ timeout: 120_000 });

test('creates a weapon, a helmet and a consumable, then uses the weapon as a base weapon', async ({
  page,
  author: _author,
}) => {
  const campaignId = await createCampaign(page, 'Campanha com itens');
  await openTab(page, campaignId, 'items', 'Itens');
  const form = page.locator('form');

  // Weapon: the default slot shows the weapon stats.
  await form.getByLabel('Nome', { exact: true }).fill('Espada Curta');
  await form.getByLabel('Dano base').fill('9');
  await form.getByLabel('Atributo de escala').selectOption({ label: 'Força' });
  await form.getByLabel('Tipo', { exact: true }).selectOption({ label: 'Pesada' });
  await form.getByLabel('Req. Força').fill('3');
  await form.getByRole('button', { name: 'Criar item' }).click();
  await expect(page.getByText('Arma · Dano 9 (pesada) · Defesa +0')).toBeVisible();

  // Helmet: switching slot drops the weapon stats.
  await form.getByLabel('Nome', { exact: true }).fill('Elmo');
  await form.getByLabel('Slot').selectOption({ label: 'Capacete' });
  await expect(form.getByLabel('Dano base')).toBeHidden();
  await form.getByLabel('Bônus de defesa').fill('6');
  await form.getByRole('button', { name: 'Criar item' }).click();
  await expect(page.getByText('Capacete · Defesa +6')).toBeVisible();

  // Consumable: the shared effect editor, with targets filtered by effect type.
  await form.getByLabel('Nome', { exact: true }).fill('Poção');
  await form.getByLabel('Categoria').selectOption({ label: 'Consumível' });
  await expect(form.getByLabel('Tipo de efeito')).toHaveValue('heal');
  await expect(form.getByLabel('Alvo').locator('option')).toHaveText([
    'O próprio personagem',
    'Um aliado',
    'Todos os aliados',
  ]);
  await form.getByLabel('Valor').fill('30');
  await form.getByRole('button', { name: 'Criar item' }).click();
  await expect(page.getByText('Consumível · Cura')).toBeVisible();

  // Only the weapon is offered as a class base weapon.
  await openTab(page, campaignId, 'classes', 'Classes');
  await expect(page.locator('form').getByLabel('Arma base').locator('option')).toHaveText([
    '— nenhuma —',
    'Espada Curta',
  ]);
});
