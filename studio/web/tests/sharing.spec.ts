import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

async function adWithVersions(page: Page, origin: string) {
  const headers = { Origin: origin };
  const credentials = { email: 'browser@example.test', password: 'studio-browser-test-password' };
  const setup = (await (await page.request.get('/api/auth/status')).json()).setup;
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
  const product = (await (await page.request.get('/api/products')).json())[0].id;
  const ad = await (
    await page.request.post('/api/ads', {
      headers,
      data: { product_id: product, title: 'Del til Bilder ' + Date.now() },
    })
  ).json();
  const content = await readFile(new URL('./fixtures/ad-render.mp4', import.meta.url));
  const versions: string[] = [];
  for (let n = 1; n <= 2; n++) {
    const session = await (
      await page.request.post('/api/upload-sessions', {
        headers,
        data: {
          product_id: product,
          ad_id: ad.id,
          expected_version_id: versions.at(-1) || '',
          file_name: `original-v${n}.mp4`,
          size: content.length,
        },
      })
    ).json();
    expect(
      (
        await page.request.patch(session.upload_path, {
          headers: { ...headers, 'Upload-Offset': '0' },
          data: content,
        })
      ).status(),
    ).toBe(200);
    const complete = await page.request.post(session.complete_path, { headers, data: {} });
    expect(complete.status()).toBe(201);
    versions.push((await complete.json()).version_id);
  }
  return { id: ad.id, product, versions, content };
}

// The browser's native share sheet is an OS surface. Mock only that boundary;
// authentication, original bytes, version changes and the UI are real Studio.
async function nativeShareStub(page: Page, supported = true) {
  await page.addInitScript((supported) => {
    const state = { mode: 'success', calls: [] as any[] };
    (window as any).nativeShareTest = state;
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data: ShareData) =>
        (supported || sessionStorage.getItem('enable-test-file-sharing') === 'true') &&
        !!data.files?.length,
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files![0];
        const call = {
          name: file.name,
          size: file.size,
          type: file.type,
          keys: Object.keys(data),
          active: navigator.userActivation.isActive,
          hash: '',
        };
        state.calls.push(call);
        const bytes = await file.arrayBuffer();
        call.hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        if (state.mode === 'cancel') throw new DOMException('Cancelled', 'AbortError');
        if (state.mode === 'error') throw new DOMException('Blocked', 'NotAllowedError');
      },
    });
  }, supported);
}

test('share the selected original on a fresh tap, preserve download and handle cancel/retry', async ({
  page,
  baseURL,
}, info) => {
  await nativeShareStub(page);
  const ad = await adWithVersions(page, baseURL!);
  const downloads: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('?download=1')) downloads.push(r.url());
  });
  await page.goto(`/ads/${ad.id}?product=${ad.product}`);
  const exports = page.locator('.media-export');
  await expect(exports.getByRole('button', { name: 'Del / lagre', exact: true })).toBeVisible();
  expect(downloads).toEqual([]);
  await exports.getByRole('button', { name: 'Del / lagre', exact: true }).click();
  await expect(
    exports.getByRole('button', { name: 'Åpne delingsmenyen', exact: true }),
  ).toBeVisible();
  expect(downloads).toHaveLength(1);
  expect(downloads[0]).toContain(`/api/files/${ad.versions[1]}?download=1`);
  expect(await page.evaluate(() => (window as any).nativeShareTest.calls.length)).toBe(0);
  // Changing versions discards the prepared file, including if metadata polls occur.
  await page.getByLabel('Vis versjon', { exact: true }).selectOption(ad.versions[0]);
  await expect(
    exports.getByRole('button', { name: 'Åpne delingsmenyen', exact: true }),
  ).toHaveCount(0);
  await exports.getByRole('button', { name: 'Del / lagre', exact: true }).click();
  await expect(
    exports.getByRole('button', { name: 'Åpne delingsmenyen', exact: true }),
  ).toBeVisible();
  await page.evaluate(() => ((window as any).nativeShareTest.mode = 'cancel'));
  await exports.getByRole('button', { name: 'Åpne delingsmenyen', exact: true }).click();
  await expect(
    exports.getByRole('button', { name: 'Åpne delingsmenyen', exact: true }),
  ).toBeEnabled();
  await expect(exports.getByRole('alert')).toHaveCount(0);
  await page.evaluate(() => ((window as any).nativeShareTest.mode = 'error'));
  await exports.getByRole('button', { name: 'Åpne delingsmenyen', exact: true }).click();
  await expect(exports.getByRole('alert')).toContainText('Kunne ikke åpne delingsmenyen');
  await expect(exports.getByRole('link', { name: 'Last ned', exact: true })).toHaveAttribute(
    'href',
    `/api/files/${ad.versions[0]}?download=1`,
  );
  await page.evaluate(() => ((window as any).nativeShareTest.mode = 'success'));
  await exports.getByRole('button', { name: 'Åpne delingsmenyen', exact: true }).click();
  await expect(exports.getByRole('button', { name: 'Del / lagre', exact: true })).toBeVisible();
  const calls = await page.evaluate(() => (window as any).nativeShareTest.calls);
  expect(calls).toHaveLength(3);
  for (const call of calls)
    expect(call).toEqual({
      name: 'original-v1.mp4',
      size: ad.content.length,
      type: 'video/mp4',
      keys: ['files'],
      active: true,
      hash: createHash('sha256').update(ad.content).digest('hex'),
    });
  expect(downloads).toHaveLength(2); // Retrying the native dialog reuses the file.
  await exports.getByText('Bilder på iPhone', { exact: true }).click();
  await expect(exports).toContainText('Lagre video');
  await expect(exports).toContainText('Tilgjengelige valg avhenger av iOS og filformatet');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await exports.screenshot({
    path: `../.data/screenshots/${info.project.name}-media-export.png`,
    scale: 'css',
  });
});

test('unsupported sharing, large files and failed downloads keep a usable fallback', async ({
  page,
  baseURL,
}) => {
  await nativeShareStub(page, false);
  const ad = await adWithVersions(page, baseURL!);
  await page.goto(`/ads/${ad.id}?product=${ad.product}`);
  const exports = page.locator('.media-export');
  await expect(exports.getByRole('link', { name: 'Last ned', exact: true })).toBeVisible();
  await expect(exports.getByRole('button', { name: 'Del / lagre', exact: true })).toHaveCount(0);
  await page.evaluate(() => sessionStorage.setItem('enable-test-file-sharing', 'true'));
  let large = true;
  await page.route('**/api/items/' + ad.id, async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    if (large) data.versions[0].bytes = 101 * 1024 * 1024;
    await route.fulfill({ response, json: data });
  });
  await page.reload();
  let fetches = 0;
  await page.route('**/api/files/*?download=1', async (route) => {
    fetches++;
    await route.fulfill({ status: 503, body: 'Unavailable' });
  });
  await exports.getByRole('button', { name: 'Del / lagre', exact: true }).click();
  await expect(exports.getByRole('alert')).toContainText('Filer over 100 MB');
  expect(fetches).toBe(0);
  large = false;
  await page.reload();
  await exports.getByRole('button', { name: 'Del / lagre', exact: true }).click();
  await expect(exports.getByRole('alert')).toContainText('Kunne ikke hente filen');
  await expect(exports.getByRole('button', { name: 'Del / lagre', exact: true })).toBeEnabled();
  expect(fetches).toBe(1);
  await page.unroute('**/api/files/*?download=1');
  // A version switch also aborts an in-flight preparation without offering stale bytes.
  let release!: () => void;
  const hold = new Promise<void>((resolve) => (release = resolve));
  let started!: () => void;
  const requested = new Promise<void>((resolve) => (started = resolve));
  await page.route('**/api/files/*?download=1', async (route) => {
    started();
    await hold;
    await route
      .fulfill({ status: 200, contentType: 'video/mp4', body: ad.content })
      .catch(() => {});
  });
  await exports.getByRole('button', { name: 'Del / lagre', exact: true }).click();
  await requested;
  await page.getByLabel('Vis versjon', { exact: true }).selectOption(ad.versions[0]);
  release();
  await expect(exports.getByRole('button', { name: 'Del / lagre', exact: true })).toBeVisible();
  await expect(
    exports.getByRole('button', { name: 'Åpne delingsmenyen', exact: true }),
  ).toHaveCount(0);
  await expect(exports.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).nativeShareTest.calls.length)).toBe(0);
});
