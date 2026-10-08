import type { Page } from '@playwright/test';
import { expect } from './fixtures';

/** A node of the room's trail, by its title, while it is unlocked (a battle may be running on it). */
function unlockedNode(page: Page, title: string) {
  return page.getByRole('button', { name: new RegExp(`^${title} \\(liberado`) });
}

/**
 * Opens the narrative's balloon on the trail, reads it on its page and continues past it
 * (Fase 5 plan decisions 11 and 12).
 */
export async function continueNarrative(page: Page, title = 'Narrativa 1') {
  await unlockedNode(page, title).click();
  await page.getByRole('dialog', { name: title }).getByRole('link', { name: 'Ler' }).click();
  await page.waitForURL(/\/narratives\//);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.waitForURL(/\/rooms\/[^/]+(\?.*)?$/);
  await expect(page.getByRole('button', { name: `${title} (lida)` })).toBeVisible();
}

/** Opens a formation from the battle node's balloon on the trail. */
export async function formBattle(page: Page, title = 'Batalha 1') {
  await unlockedNode(page, title).click();
  await page
    .getByRole('dialog', { name: title })
    .getByRole('button', { name: `Formar batalha: ${title}` })
    .click();
}
