import { test, expect, createCampaign } from './fixtures';

test.describe('campaigns', () => {
  test('creates, renames and deletes a campaign', async ({ page, author: _author }) => {
    await expect(page.getByText('Nenhuma campanha ainda.')).toBeVisible();
    await createCampaign(page, 'Campanha E2E');

    await page.getByLabel('Nome').fill('Campanha Renomeada');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Salvo')).toBeVisible();

    await page.getByRole('link', { name: 'Campanhas' }).first().click();
    await expect(page.getByRole('link', { name: 'Campanha Renomeada' })).toBeVisible();

    await page.getByRole('link', { name: 'Campanha Renomeada' }).click();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Excluir campanha' }).click();
    await expect(page).toHaveURL(/\/campaigns$/);
    await expect(page.getByText('Nenhuma campanha ainda.')).toBeVisible();
  });

  test('another author cannot see my campaign', async ({ page, browser, author: _author }) => {
    const id = await createCampaign(page, 'Privada');
    const other = await browser.newPage();
    const { signUp } = await import('./fixtures');
    await signUp(other);
    await expect(other.getByText('Privada')).toHaveCount(0);
    await other.goto(`/campaigns/${id}`);
    await expect(other.getByLabel('Nome')).toHaveCount(0);
    await other.close();
  });
});
