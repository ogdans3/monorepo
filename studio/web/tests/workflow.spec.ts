import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('mobile-first content to publication workflow', async ({ page }, info) => {
  const suffix = `${info.project.name}-${Date.now()}`;
  const failures: string[] = [];
  page.on('pageerror', (e) => failures.push(e.message));
  await page.goto('/');
  await expect(page.getByLabel('E-post', { exact: true })).toBeVisible();
  if (await page.getByRole('heading', { name: 'Opprett arbeidsrommet' }).isVisible()) {
    await page.getByLabel('Navnet ditt').fill('Studio tester');
    await page.getByLabel('Oppsettkode').fill('test-browser-bootstrap');
  }
  await page.getByLabel('E-post', { exact: true }).fill('browser@example.test');
  await page.getByLabel('Passord', { exact: true }).fill('studio-browser-test-password');
  await page.locator('.auth-form button[type=submit], .auth-form button.primary').click();
  await expect(page.getByRole('heading', { name: 'Plass til neste idé.' })).toBeVisible();
  await mkdir('../.data/screenshots', { recursive: true });
  await page.screenshot({
    path: `../.data/screenshots/${info.project.name}-home.png`,
    fullPage: true,
  });
  const nav = page.getByRole('navigation', {
    name: info.project.name === 'mobile' ? 'Mobilmeny' : 'Hovedmeny',
    exact: true,
  });
  await nav.getByRole('button', { name: 'Bibliotek', exact: true }).click();
  await page.getByRole('button', { name: 'Legg til', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tittel', { exact: true }).fill('Vinterføre ' + suffix);
  await dialog
    .getByLabel('Innhold eller beskrivelse')
    .fill('Tre grep for bedre kontroll på glatt føre. Bremselengde betyr noe.');
  await dialog.getByLabel('Bruksrettigheter').selectOption('owned');
  await dialog.getByRole('button', { name: 'Lagre', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: new RegExp('Vinterføre ' + suffix) }).click();
  await dialog.getByRole('button', { name: 'Godkjenn', exact: true }).click();
  await expect(dialog.locator('.status')).toHaveText('Godkjent');
  await dialog
    .getByPlaceholder('En tanke eller tilbakemelding …')
    .fill('Bruk denne til ukens publisering.');
  await dialog.getByRole('button', { name: 'Legg til notat' }).click();
  await expect(dialog.getByText('Bruk denne til ukens publisering.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Lukk', exact: true }).click();
  await page.getByRole('button', { name: 'Søk i Studio', exact: true }).click();
  await dialog.getByLabel('Søk', { exact: true }).fill('bremselengde');
  await expect(dialog.getByRole('heading', { name: 'Vinterføre ' + suffix })).toBeVisible();
  await dialog.getByRole('button', { name: 'Lukk', exact: true }).click();
  await nav.getByRole('button', { name: 'Oppgaver', exact: true }).click();
  await page.getByRole('button', { name: 'Ny oppgave', exact: true }).click();
  await dialog.getByLabel('Tittel', { exact: true }).fill('Klipp vintervideo ' + suffix);
  await dialog
    .getByLabel('Brief', { exact: true })
    .fill('Lag en 15 sekunders video av hooken om vinterføre.');
  await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('ready');
  await dialog.getByRole('button', { name: 'Lagre', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Klipp vintervideo ' + suffix })).toBeVisible();
  if (info.project.name === 'mobile') {
    const tabs = page.locator('.board-tabs');
    await tabs.getByRole('button', { name: /^Idé/ }).click();
    await expect(
      page.getByRole('heading', { name: 'Klipp vintervideo ' + suffix }),
    ).not.toBeVisible();
    await tabs.getByRole('button', { name: /^Klar/ }).click();
    await expect(page.getByRole('heading', { name: 'Klipp vintervideo ' + suffix })).toBeVisible();
  }
  await page.screenshot({
    path: `../.data/screenshots/${info.project.name}-tasks.png`,
    fullPage: true,
  });
  await nav.getByRole('button', { name: 'Kalender', exact: true }).click();
  await page.getByRole('button', { name: 'Planlegg', exact: true }).click();
  await dialog.getByLabel('Tittel', { exact: true }).fill('Vinterpost ' + suffix);
  await dialog
    .getByLabel('Posttekst', { exact: true })
    .fill('Klar for vinterføre? Her er tre ting å huske.');
  await dialog.getByLabel('Koble til innhold').selectOption({ label: 'Vinterføre ' + suffix });
  await dialog.getByRole('button', { name: 'Lagre', exact: true }).click();
  await page.getByRole('button', { name: new RegExp('Vinterpost ' + suffix) }).click();
  await expect(dialog.getByText('Godkjent innhold er klart')).toBeVisible();
  await dialog.getByLabel('Lenke til publisert post').fill('https://example.test/post/' + suffix);
  await dialog.getByRole('button', { name: 'Marker som publisert' }).click();
  await expect(
    page.getByRole('button', { name: new RegExp('Vinterpost ' + suffix) }),
  ).toContainText('Publisert');
  await page.screenshot({
    path: `../.data/screenshots/${info.project.name}-calendar.png`,
    fullPage: true,
  });
  await nav.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hva har du på hjertet?' })).toBeVisible();
  await page.getByLabel('Melding til Studio').fill('Lag tre hooks');
  await page.getByRole('button', { name: 'Send melding' }).click();
  await expect(page.getByRole('alert')).toContainText('OpenRouter-nøkkel');
  await expect(page.getByLabel('Melding til Studio')).toHaveValue('Lag tre hooks');
  await page.screenshot({
    path: `../.data/screenshots/${info.project.name}-chat.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Innstillinger', exact: true }).click();
  if (info.project.name === 'desktop') {
    const chat = page.locator('.model-row').filter({ hasText: 'Chat og planlegging' });
    await chat.getByLabel('Modell-ID').fill('test/model');
    await chat.getByRole('button', { name: 'Lagre', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Modellvalg lagret');
    await page.getByRole('button', { name: 'Inviter', exact: true }).click();
    await dialog
      .getByLabel('E-post', { exact: true })
      .fill('colleague-' + suffix + '@example.test');
    await dialog.getByRole('button', { name: 'Lag invitasjonslenke' }).click();
    await expect(dialog.locator('.secret')).toContainText('#invite=');
    await dialog.getByRole('button', { name: 'Lukk', exact: true }).click();
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow, 'page must not overflow the mobile viewport').toBe(false);
  expect(failures, 'no client-side exceptions').toEqual([]);
});
