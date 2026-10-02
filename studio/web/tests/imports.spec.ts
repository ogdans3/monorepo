import { test, expect } from '@playwright/test';

test('link import, saved category, duplicate, failure and cancellation', async ({ page }, info) => {
  const suffix = info.project.name + '_' + Date.now();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  if (await page.getByRole('heading', { name: 'Opprett arbeidsrommet' }).isVisible()) {
    await page.getByLabel('Navnet ditt').fill('Studio tester');
    await page.getByLabel('Oppsettkode').fill('test-browser-bootstrap');
  }
  await page.getByLabel('E-post', { exact: true }).fill('browser@example.test');
  await page.getByLabel('Passord', { exact: true }).fill('studio-browser-test-password');
  await page.locator('.auth-form button[type=submit], .auth-form button.primary').click();
  const nav = page.getByRole('navigation', {
    name: info.project.name === 'mobile' ? 'Mobilmeny' : 'Hovedmeny',
    exact: true,
  });
  await nav.getByRole('button', { name: 'Bibliotek', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Importer video fra lenke' });
  const input = panel.getByLabel('Hent en video fra en lenke');
  const source = 'https://instagram.com/reel/e2e_ok_' + suffix + '/';
  await input.fill(source);
  await panel.getByRole('button', { name: 'Hent video', exact: true }).click();
  const row = panel
    .locator('.import-row')
    .filter({ has: page.locator('a[href*="e2e_ok_' + suffix + '"]') });
  await expect(row).toHaveAttribute('data-import-status', 'completed', { timeout: 15000 });
  await row.getByRole('button', { name: 'Åpne video' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('combobox', { name: 'Kategori', exact: true })).toBeVisible();
  await dialog
    .getByRole('combobox', { name: 'Kategori', exact: true })
    .selectOption('merkevare_design');
  await expect(dialog.getByText('Valgt av dere', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Lukk', exact: true }).click();
  await page.getByLabel('Filtrer kategori').selectOption('merkevare_design');
  await expect(page.locator('.asset-grid')).toContainText('Importtest design');
  await input.fill(source + '?igsh=tracking');
  await panel.getByRole('button', { name: 'Hent video', exact: true }).click();
  await expect(
    panel.getByRole('status').filter({ hasText: 'Lenken finnes allerede' }),
  ).toBeVisible();
  await expect(row).toHaveCount(1);
  await input.fill('https://instagram.com/reel/e2e_blocked_' + suffix + '/');
  await panel.getByRole('button', { name: 'Hent video', exact: true }).click();
  const blocked = panel
    .locator('.import-row')
    .filter({ has: page.locator('a[href*="e2e_blocked_' + suffix + '"]') });
  await expect(blocked).toHaveAttribute('data-import-status', 'failed', { timeout: 15000 });
  await expect(blocked).toContainText('krever innlogging');
  await expect(blocked.getByRole('button', { name: 'Last opp fil selv' })).toBeVisible();
  await input.fill('https://instagram.com/reel/e2e_slow_' + suffix + '/');
  await panel.getByRole('button', { name: 'Hent video', exact: true }).click();
  const slow = panel
    .locator('.import-row')
    .filter({ has: page.locator('a[href*="e2e_slow_' + suffix + '"]') });
  await expect(slow).toHaveAttribute('data-import-status', 'downloading', { timeout: 15000 });
  await slow.getByRole('button', { name: 'Stopp import' }).click();
  await expect(slow).toHaveAttribute('data-import-status', 'cancelled');
  await expect(slow.getByRole('button', { name: 'Prøv igjen' })).toBeVisible();
  await page.screenshot({
    path: '../.data/screenshots/' + info.project.name + '-imports.png',
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});
