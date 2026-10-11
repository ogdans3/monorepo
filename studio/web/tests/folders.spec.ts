import { test, expect } from '@playwright/test';
import { folderTree, folderTrail, folderDescendants } from '../src/lib/folders';
import { mkdir } from 'node:fs/promises';

test('folder traversal supports depths beyond the JavaScript call stack', () => {
  const folders = Array.from({ length: 12000 }, (_, n) => ({
    id: String(n),
    name: 'Level',
    parent_id: n ? String(n - 1) : null,
  }));
  const tree = folderTree(folders);
  expect(tree.options.length).toBe(12000);
  expect(folderTrail(tree, '11999').length).toBe(12000);
  expect(folderDescendants(tree, '0').size).toBe(12000);
  expect(tree.paths.get('11999')!.split(' / ').length).toBe(12000);
});

test('nested folders navigate, move subtrees and keep ads on mobile and desktop', async ({
  page,
  baseURL,
}, info) => {
  const headers = { Origin: baseURL! };
  const credentials = { email: 'browser@example.test', password: 'studio-browser-test-password' };
  const { setup } = await (await page.request.get('/api/auth/status')).json();
  expect(
    (
      await page.request.post(setup ? '/api/auth/bootstrap' : '/api/auth/login', {
        headers,
        data: setup
          ? { ...credentials, name: 'Studio tester', token: 'test-browser-bootstrap' }
          : credentials,
      })
    ).status(),
  ).toBe(200);
  const unique = info.project.name + '-' + Date.now();
  const created = await page.request.post('/api/products', {
    headers,
    data: { name: 'Folder navigation ' + unique, restricted: true },
  });
  expect(created.status()).toBe(201);
  const product = (await created.json()).id;
  const title = 'Nested folder ad ' + unique;
  const createdAd = await page.request.post('/api/ads', {
    headers,
    data: { product_id: product, title },
  });
  expect(createdAd.status()).toBe(201);
  const ad = await createdAd.json();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/ads?product=' + product);
  const nav = page.getByRole('navigation', { name: 'Annonsemapper', exact: true });
  const trail = page.getByRole('navigation', { name: 'Mappesti', exact: true });
  const form = page.locator('.ad-folder-form');
  async function createFolder(name: string, parent = '') {
    await page
      .getByRole('button', { name: parent ? 'Ny undermappe' : 'Ny mappe', exact: true })
      .click();
    await form.getByLabel('Mappenavn').fill(name);
    await expect(form.getByLabel('Overordnet mappe')).toHaveValue(parent);
    await form.getByRole('button', { name: 'Lagre mappe', exact: true }).click();
    await expect(trail.locator('[aria-current="page"]')).toHaveText(name);
    return new URL(page.url()).searchParams.get('folder')!;
  }
  const root = await createFolder('Lansering');
  const child = await createFolder('TikTok', root);
  const leaf = await createFolder('Ferdig', child);
  await expect(trail.getByRole('link')).toHaveText(['Alle', 'Lansering', 'TikTok', 'Ferdig']);

  const archived = await page.request.post('/api/ad-folders', {
    headers,
    data: { product_id: product, name: 'Arkiv' },
  });
  expect(archived.status()).toBe(200);
  const archive = (await archived.json()).id;
  expect(
    (
      await page.request.post('/api/ad-folders', {
        headers,
        data: { product_id: product, name: 'Ferdig', parent_id: archive },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole('button', { name: 'Oppdater', exact: true }).click();
  await nav.getByRole('button', { name: /^Alle / }).click();
  const picker = page.getByLabel('Mappe for ' + title, { exact: true });
  await picker.selectOption(leaf);
  await expect(picker.locator('option:checked')).toHaveText('Lansering / TikTok / Ferdig');
  await nav.getByRole('button', { name: /^Lansering / }).click();
  await nav.getByRole('button', { name: /^TikTok / }).click();
  await nav.getByRole('button', { name: /^Ferdig / }).click();
  await expect(page.locator('.ad-card')).toHaveCount(1);
  await page.goBack();
  await expect(trail.locator('[aria-current="page"]')).toHaveText('TikTok');
  await page.goForward();
  await expect(trail.locator('[aria-current="page"]')).toHaveText('Ferdig');
  await page.reload();
  await expect(picker).toHaveValue(leaf);
  await page.locator('.ad-card-link').click();
  await expect(page).toHaveURL(new RegExp('/ads/' + ad.id));
  await expect(page.getByLabel('Mappe', { exact: true }).locator('option:checked')).toHaveText(
    'Lansering / TikTok / Ferdig',
  );
  await page.goBack();

  await trail.getByRole('link', { name: 'TikTok', exact: true }).click();
  await page.getByRole('button', { name: 'Rediger mappe', exact: true }).click();
  await expect(form.getByRole('button', { name: 'Fjern mappe', exact: true })).toBeDisabled();
  const parentPicker = form.getByLabel('Overordnet mappe');
  await expect(parentPicker.locator(`option[value="${child}"]`)).toHaveCount(0);
  await expect(parentPicker.locator(`option[value="${leaf}"]`)).toHaveCount(0);
  await parentPicker.selectOption(archive);
  await form.getByRole('button', { name: 'Lagre mappe', exact: true }).click();
  await expect(trail.getByRole('link')).toHaveText(['Alle', 'Arkiv', 'TikTok']);
  await nav.getByRole('button', { name: /^Ferdig / }).click();
  await expect(picker).toHaveValue(leaf);
  await expect(picker.locator('option:checked')).toHaveText('Arkiv / TikTok / Ferdig');
  await expect(picker.getByRole('option', { name: 'Arkiv / Ferdig', exact: true })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await mkdir('../.data/screenshots', { recursive: true });
  await page.screenshot({
    path: '../.data/screenshots/' + info.project.name + '-nested-folders.png',
    fullPage: true,
    scale: 'css',
  });

  await page.getByRole('button', { name: 'Rediger mappe', exact: true }).click();
  await form.getByRole('button', { name: 'Fjern mappe', exact: true }).click();
  await expect(page).toHaveURL(/folder=unfiled/);
  await expect(page.locator('.ad-card')).toHaveCount(1);
  await expect(picker).toHaveValue('');
  const folders = await (await page.request.get('/api/ad-folders?product=' + product)).json();
  expect(folders.find((folder: any) => folder.id === child)).toMatchObject({ parent_id: archive });
  expect(folders.some((folder: any) => folder.id === leaf)).toBe(false);
  expect(errors).toEqual([]);
});
