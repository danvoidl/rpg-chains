import { test as base, expect } from '@playwright/test';
import { signUp } from './fixtures';

base.describe('authentication', () => {
  base('redirects an anonymous visitor to the login page', async ({ page }) => {
    await page.goto('/campaigns');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  });

  base('signs up, signs out and signs back in', async ({ page }) => {
    const { email, password } = await signUp(page);
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { name: 'Minhas campanhas' })).toBeVisible();
  });

  base('shows an error for a wrong password', async ({ page }) => {
    const { email } = await signUp(page);
    await page.getByRole('button', { name: 'Sair' }).click();
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill('wrong-password');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
