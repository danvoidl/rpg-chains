import { test as base, expect } from '@playwright/test';
import { signUp } from './fixtures';
import { lastLinkTo } from './outbox';
import { totpFromUri } from './totp';

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

  base('refuses to sign in before the email is confirmed', async ({ page }) => {
    const email = `e2e-unconfirmed-${Date.now()}@test.local`;
    await page.goto('/signup');
    await page.getByLabel('Nome').fill('E2E Unconfirmed');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill('password1234');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.getByRole('heading', { name: 'Confirme seu e-mail' })).toBeVisible();

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill('password1234');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Confirme seu e-mail antes de entrar')).toBeVisible();
  });

  base('resets a forgotten password through the emailed link', async ({ page }) => {
    const { email } = await signUp(page);
    await page.getByRole('button', { name: 'Sair' }).click();
    await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
    await expect(page.getByRole('heading', { name: 'Esqueci minha senha' })).toBeVisible();
    await page.getByLabel('E-mail').fill(email);
    await page.getByRole('button', { name: 'Enviar link' }).click();
    await expect(page.getByRole('status')).toContainText('o link chega');

    await page.goto(await lastLinkTo(email));
    await page.getByLabel('Senha nova', { exact: true }).fill('a-brand-new-password');
    await page.getByLabel('Repita a senha nova').fill('a-brand-new-password');
    await page.getByRole('button', { name: 'Trocar senha' }).click();
    await expect(page.getByRole('status')).toContainText('Senha trocada');

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill('a-brand-new-password');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { name: 'Minhas campanhas' })).toBeVisible();
  });

  base('turns the authenticator app on and asks for its code at sign-in', async ({ page }) => {
    const { email, password } = await signUp(page);
    await page.getByRole('link', { name: 'Segurança' }).click();
    await page.getByLabel('Sua senha').fill(password);
    await page.getByRole('button', { name: 'Ativar app autenticador' }).click();

    const secret = await page.locator('code').first().textContent();
    const uri = `otpauth://totp/x?secret=${secret}`;
    await page.getByLabel('Código de 6 dígitos').fill(totpFromUri(uri));
    await page.getByRole('button', { name: 'Ativar' }).click();
    await expect(page.getByRole('status')).toContainText('ativada');

    await page.getByRole('button', { name: 'Sair' }).click();
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/two-factor$/);
    await page.getByLabel('Código').fill(totpFromUri(uri));
    await page.getByRole('button', { name: 'Verificar' }).click();
    await expect(page.getByRole('heading', { name: 'Minhas campanhas' })).toBeVisible();
  });
});
