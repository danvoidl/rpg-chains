import type { Page } from '@playwright/test';
import { expect } from './fixtures';

/** Which page may tap the signal now, or 'over' once the battle shows its result. */
export async function nextTurn(pages: Page[]): Promise<number | 'over'> {
  let found: number | 'over' | null = null;
  await expect
    .poll(
      async () => {
        for (const [index, p] of pages.entries()) {
          if (await p.getByRole('status').filter({ hasText: 'Vitória!' }).isVisible())
            return (found = 'over');
          if (await p.getByRole('button', { name: 'Tocar o sinal' }).isVisible()) {
            return (found = index);
          }
        }
        return null;
      },
      { timeout: 20_000 },
    )
    .not.toBeNull();
  return found!;
}

/**
 * Plays a battle on the given pages until it is won: whoever may tap the signal answers the
 * objective question (2 + 2) and attacks `villain`. Returns who tapped, in order.
 */
export async function playToVictory(pages: Page[], villain: string, maxTurns = 12) {
  const tappers: number[] = [];
  for (let turn = 0; turn < maxTurns; turn++) {
    const who = await nextTurn(pages);
    if (who === 'over') break;
    const p = pages[who]!;
    tappers.push(who);
    await p.getByRole('button', { name: 'Tocar o sinal' }).click();
    await p.getByRole('button', { name: '4', exact: true }).click();
    await p.getByRole('button', { name: `Atacar ${villain}` }).click();
  }
  for (const p of pages) {
    await expect(p.getByRole('status').filter({ hasText: 'Vitória!' })).toBeVisible();
  }
  return tappers;
}

/** Leaves the running battle on purpose (spec §7): confirms the dialog and lands in the room. */
export async function leaveBattle(page: Page) {
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Sair da batalha' }).click();
  await page.waitForURL(/\/rooms\/[^/]+$/, { timeout: 60_000 });
}
