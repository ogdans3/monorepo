import { test, expect, type Page } from '@playwright/test';

async function loginAdmin(page: Page, origin: string) {
  const credentials = { email: 'browser@example.test', password: 'studio-browser-test-password' };
  const { setup } = await (await page.request.get('/api/auth/status')).json();
  const response = await page.request.post(setup ? '/api/auth/bootstrap' : '/api/auth/login', {
    headers: { Origin: origin },
    data: setup
      ? { ...credentials, name: 'Studio tester', token: 'test-browser-bootstrap' }
      : credentials,
  });
  expect(response.status()).toBe(200);
}

test('invited editor opens the selected private project and reviews its ads', async ({
  page,
  baseURL,
}, info) => {
  const origin = baseURL!;
  await loginAdmin(page, origin);
  const headers = { Origin: origin };
  const unique = info.project.name + '-' + Date.now();
  const productName = 'Private ads ' + unique;
  const created = await page.request.post('/api/products', {
    headers,
    data: { name: productName, restricted: true },
  });
  expect(created.status()).toBe(201);
  const product = (await created.json()).id;
  const title = 'Shared ad ' + unique;
  const createdAd = await page.request.post('/api/ads', {
    headers,
    data: { product_id: product, title, ad_type: 'UGC', brief: 'Review this ad together' },
  });
  expect(createdAd.status()).toBe(201);
  const ad = await createdAd.json();
  const email = 'invited-' + unique + '@example.test';

  await page.goto('/settings?product=' + product);
  await page.getByRole('button', { name: 'Inviter', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Produkttilgang')).toHaveValue(product);
  await expect(dialog.getByRole('combobox', { name: 'Tilgang', exact: true })).toHaveValue(
    'editor',
  );
  await dialog.getByLabel('E-post').fill(email);
  await dialog.getByRole('button', { name: 'Lag invitasjonslenke' }).click();
  const inviteURL = await dialog.locator('.secret').innerText();
  expect(new URL(inviteURL).searchParams.get('product')).toBe(product);
  const invites = await (await page.request.get('/api/invites')).json();
  expect(invites.find((i: any) => i.email === email)).toMatchObject({
    product_id: product,
    product_name: productName,
  });

  await page.request.post('/api/auth/logout', { headers, data: {} });
  await page.goto(inviteURL);
  await page.getByLabel('Navnet ditt').fill('Invited editor');
  await page.getByLabel('E-post').fill(email);
  await page.getByLabel('Passord', { exact: true }).fill('studio-invited-test-password');
  await page.getByRole('button', { name: 'Godta invitasjon' }).click();
  await expect(page.getByRole('heading', { name: 'Annonser', exact: true })).toBeVisible();
  await expect(page.locator('.ad-card')).toHaveCount(1);
  await expect(page.locator('.ad-card')).toContainText(title);
  await expect(page.getByRole('button', { name: 'Ny annonse', exact: true })).toBeVisible();
  await expect(page.locator('.page-error')).toHaveCount(0);
  await page.locator('.ad-card-link').click();
  await expect(page).toHaveURL(new RegExp('/ads/' + ad.id));
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.locator('.ad-card')).toHaveCount(1);
  await page.goto('/library?product=' + product);
  await expect(page.getByRole('heading', { name: 'Biblioteket', exact: true })).toBeVisible();
  await expect(page.locator('.page-error')).toHaveCount(0);
});

test('no project access shows guidance and can be refreshed after membership is granted', async ({
  page,
  baseURL,
}) => {
  await loginAdmin(page, baseURL!);
  let hasAccess = false;
  const deniedRequests: string[] = [];
  await page.route('**/api/products', async (route) => {
    if (hasAccess) await route.continue();
    else await route.fulfill({ json: [] });
  });
  page.on('request', (request) => {
    if (/\/api\/(ads|ad-folders|items)\?product=$/.test(request.url()))
      deniedRequests.push(request.url());
  });
  await page.goto('/ads');
  await expect(page.getByRole('heading', { name: 'Ingen produkttilgang ennå' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ny annonse', exact: true })).toHaveCount(0);
  await page.goto('/library');
  await expect(page.getByRole('heading', { name: 'Ingen produkttilgang ennå' })).toBeVisible();
  await expect(page.locator('.page-error')).toHaveCount(0);
  expect(deniedRequests).toEqual([]);
  hasAccess = true;
  await page.getByRole('button', { name: 'Sjekk tilgang på nytt' }).click();
  await expect(page.getByRole('heading', { name: 'Biblioteket', exact: true })).toBeVisible();
});
