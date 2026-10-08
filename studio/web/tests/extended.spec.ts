import { test, expect } from '@playwright/test';
test('production, campaigns, library tools and sharing work on both screen sizes', async ({
  page,
  context,
}, info) => {
  const suffix = info.project.name + '-' + Date.now();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  if (await page.getByRole('heading', { name: 'Opprett arbeidsrommet' }).isVisible()) {
    await page.getByLabel('Navnet ditt').fill('Studio tester');
    await page.getByLabel('Oppsettkode').fill('test-browser-bootstrap');
  }
  await page.getByLabel('E-post', { exact: true }).fill('browser@example.test');
  await page.getByLabel('Passord', { exact: true }).fill('studio-browser-test-password');
  await page.locator('.auth-form button.primary').click();
  await expect(page.getByRole('heading', { name: 'Annonser', exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', {
    name: info.project.name === 'mobile' ? 'Mobilmeny' : 'Hovedmeny',
    exact: true,
  });
  await nav.getByRole('button', { name: 'Bibliotek', exact: true }).click();
  await page.getByRole('button', { name: 'Legg til', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tittel', { exact: true }).fill('Materiale ' + suffix);
  await dialog.getByLabel('Innhold eller beskrivelse').fill('Testmateriale til produksjon.');
  await dialog.getByLabel('Bruksrettigheter').selectOption('owned');
  await dialog.getByRole('button', { name: 'Lagre', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByText('Organiser og importer', { exact: true }).click();
  await page.getByLabel('Ny samling', { exact: true }).fill('Samling ' + suffix);
  await page.getByRole('button', { name: 'Opprett samling' }).click();
  await expect(page.getByLabel('Samling', { exact: true }).first()).toContainText(
    'Samling ' + suffix,
  );
  await page.getByRole('button', { name: new RegExp('Materiale ' + suffix) }).click();
  await page
    .getByText('Flere verktøy · rettigheter, behandling og deling', { exact: true })
    .click();
  await page.locator('.review-page').getByRole('button', { name: 'Lagre favoritt' }).click();
  await page
    .locator('.review-page')
    .getByText('Del med noen utenfor arbeidsrommet', { exact: true })
    .click();
  await page.locator('.review-page').getByRole('button', { name: 'Lag delingslenke' }).click();
  const share = await page
    .locator('.review-page')
    .getByLabel('Delingslenke', { exact: true })
    .inputValue();
  const visitor = await context.browser()!.newContext();
  const shared = await visitor.newPage();
  await shared.goto(share.replace('http://localhost:5178', 'http://localhost:15178'));
  await expect(shared.getByRole('heading', { name: 'Materiale ' + suffix })).toBeVisible();
  await visitor.close();
  await page.getByRole('link', { name: 'Til biblioteket' }).click();
  await page
    .locator('.topbar-actions')
    .getByRole('button', { name: 'Produksjon og innsikt', exact: true })
    .click();
  await page.getByRole('button', { name: 'Ny mal', exact: true }).click();
  let form = page.locator('.form-card');
  await form.getByLabel('Malnavn').fill('Mal ' + suffix);
  await form.getByLabel('Instruksjoner', { exact: true }).fill('En kort video med tydelig tekst.');
  await form.getByRole('button', { name: 'Lagre', exact: true }).click();
  await expect(form).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mal ' + suffix, exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Arbeidsområder' })
    .getByRole('button', { name: 'Kampanjer', exact: true })
    .click();
  await page.getByRole('button', { name: 'Ny kampanje' }).click();
  form = page.locator('.form-card');
  await form.getByLabel('Kampanjenavn').fill('Kampanje ' + suffix);
  await form.getByLabel('Mål', { exact: true }).fill('Flere som øver til teoriprøven');
  await form.getByRole('button', { name: 'Lagre', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kampanje ' + suffix })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Arbeidsområder' })
    .getByRole('button', { name: 'Produksjon', exact: true })
    .click();
  await page.getByRole('button', { name: 'Bestill produksjon', exact: true }).click();
  form = page.locator('.form-card');
  await form.getByLabel('Tittel', { exact: true }).fill('Produksjon ' + suffix);
  await form
    .getByLabel('Brief', { exact: true })
    .fill('Lag en 15 sekunders video med undertekster.');
  await form
    .getByRole('combobox', { name: 'Mal', exact: true })
    .selectOption({ label: 'Mal ' + suffix });
  await form.getByLabel('Overskrift', { exact: true }).fill('Klar for teoriprøven?');
  await form
    .getByRole('combobox', { name: 'Kampanje', exact: true })
    .selectOption({ label: 'Kampanje ' + suffix });
  await form.getByLabel('Materiale ' + suffix, { exact: true }).check();
  await form.getByRole('button', { name: 'Opprett produksjon' }).click();
  await expect(form).not.toBeVisible();
  await nav.getByRole('button', { name: 'Oppgaver', exact: true }).click();
  await page.getByRole('button', { name: 'Produksjon ' + suffix, exact: true }).click();
  await expect(
    dialog.getByRole('heading', { name: 'Produksjon ' + suffix, exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText('Kildefiler', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Lukk', exact: true }).click();
  await nav.getByRole('button', { name: 'Kalender', exact: true }).click();
  await page.getByRole('button', { name: 'Måned', exact: true }).click();
  await expect(page.locator('.month-grid button')).toHaveCount(42);
  await page
    .locator('.topbar-actions')
    .getByRole('button', { name: 'Produksjon og innsikt', exact: true })
    .click();
  await page
    .getByRole('navigation', { name: 'Arbeidsområder' })
    .getByRole('button', { name: 'Kunnskap', exact: true })
    .click();
  await page.getByRole('button', { name: 'Legg til kunnskap' }).click();
  form = page.locator('.form-card');
  await form.getByLabel('Påstand eller kundesitat').fill('Elevene ønsker korte økter ' + suffix);
  await form.getByLabel('Kilder – én per linje').fill('Intervju med testbruker');
  await form.getByRole('button', { name: 'Lagre', exact: true }).click();
  await expect(
    page.getByText('Elevene ønsker korte økter ' + suffix, { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: '../.data/screenshots/' + info.project.name + '-knowledge.png',
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});
