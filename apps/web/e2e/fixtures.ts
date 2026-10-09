import { expect, test as base, type Page } from '@playwright/test';
import { lastLinkTo } from './outbox';

/**
 * Signs a brand-new user up through the UI, confirms the email through the link the server sent
 * (sign-in requires it) and lands on the campaigns page.
 */
export async function signUp(page: Page): Promise<{ email: string; password: string }> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  const password = 'password1234';
  await page.goto('/signup');
  await page.getByLabel('Nome').fill('E2E Author');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('heading', { name: 'Confirme seu e-mail' })).toBeVisible();
  await page.goto(await lastLinkTo(email));
  await expect(page.getByText('E-mail confirmado.')).toBeVisible();
  await page.goto('/campaigns');
  await expect(page.getByRole('heading', { name: 'Minhas campanhas' })).toBeVisible();
  return { email, password };
}

/** Creates a campaign from the campaigns page and returns its id (from the URL). */
export async function createCampaign(page: Page, name: string): Promise<string> {
  await page.goto('/campaigns');
  await page.getByLabel('Nome').fill(name);
  await page.getByRole('button', { name: 'Criar campanha' }).click();
  await page.waitForURL(/\/campaigns\/[^/]+$/);
  return page.url().split('/').pop()!;
}

/** Every test gets a freshly signed-up author. */
export const test = base.extend<{ author: { email: string; password: string } }>({
  author: async ({ page }, use) => {
    await use(await signUp(page));
  },
});

export { expect };
