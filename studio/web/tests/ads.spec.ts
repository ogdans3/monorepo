import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';

test('agent renders stay under one ad, with real previews and page navigation', async ({
  page,
  baseURL,
}, info) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15000);
  const request = page.request,
    origin = baseURL!;
  const errors: string[] = [],
    fileRequests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.url().includes('/api/files/')) fileRequests.push(r.url());
  });
  const credentials = { email: 'browser@example.test', password: 'studio-browser-test-password' };
  const setup = (await (await request.get('/api/auth/status')).json()).setup;
  expect(
    (
      await request.post(setup ? '/api/auth/bootstrap' : '/api/auth/login', {
        headers: { Origin: origin },
        data: setup
          ? { ...credentials, name: 'Studio tester', token: 'test-browser-bootstrap' }
          : credentials,
      })
    ).status(),
  ).toBe(200);
  const product = (await (await request.get('/api/products')).json())[0].id;
  const key = await (
    await request.post('/api/agent-tokens', {
      headers: { Origin: origin },
      data: { name: 'Ad test', product_id: product },
    })
  ).json();
  const headers = { Authorization: 'Bearer ' + key.token };
  let rpcID = 0;
  async function tool(name: string, args: Record<string, string>) {
    const res = await request.post('/mcp', {
      headers,
      data: {
        jsonrpc: '2.0',
        id: ++rpcID,
        method: 'tools/call',
        params: { name, arguments: args },
      },
    });
    expect(res.status()).toBe(200);
    const rpc = await res.json();
    expect(rpc.result.isError, JSON.stringify(rpc.result)).toBe(false);
    return JSON.parse(rpc.result.content[0].text);
  }
  const unique = info.project.name + '-' + Date.now();
  const title =
    'Bestå teoriprøven med korte økter – elevhistorien med en ny åpning og tydelig avslutning ' +
    unique;
  const fileName =
    'teorimester-elevhistorie-standing-9x16-shorter-intro-clear-subtitles-new-cta-render-final-review-' +
    unique +
    '.mp4';
  const ad = await tool('studio_create_ad', {
    title,
    external_key: unique,
    ad_type: 'UGC',
    brief: 'Vis appen tidlig, test to hooks.',
  });
  expect((await tool('studio_create_ad', { title, external_key: unique })).id).toBe(ad.id);
  const content = await readFile(new URL('./fixtures/ad-render.mp4', import.meta.url));
  async function upload(expected: string, name: string) {
    const start = await tool('studio_prepare_ad_upload', {
      ad_id: ad.id,
      expected_version_id: expected,
      file_name: name,
      size: String(content.length),
      body: 'Kortere intro og tydeligere CTA.',
    });
    expect(
      (
        await request.patch(start.upload_path, {
          headers: { ...headers, 'Upload-Offset': '0', 'Content-Type': 'application/octet-stream' },
          data: content,
        })
      ).status(),
    ).toBe(200);
    const complete = await request.post(start.complete_path, { headers, data: {} });
    expect(complete.status()).toBe(201);
    const result = await complete.json();
    expect(result.id).toBe(ad.id);
    return result.version_id as string;
  }
  try {
    const v1 = await upload('', 'first-' + fileName);
    const v2 = await upload(v1, fileName);
    // These are real ffmpeg artifacts, not mocked image responses.
    await expect
      .poll(
        async () => {
          const detail = await (await request.get('/api/ads/' + ad.id)).json();
          return detail.versions.every((v: any) => v.has_thumbnail && v.has_proxy);
        },
        { timeout: 60_000, intervals: [1000, 2000] },
      )
      .toBe(true);
    await tool('studio_organize_ad', {
      payload: JSON.stringify({ ad_id: ad.id, version_id: v1, channels: ['snapchat'] }),
    });
    await page.goto('/ads?product=' + product + '&q=' + unique);
    await expect(page.locator('.ad-card')).toHaveCount(1);
    await expect(page.locator('.ad-card')).toContainText('2 versjoner');
    await expect(page.locator('.ad-filename')).toHaveText(fileName);
    await expect
      .poll(() =>
        page
          .locator('.ad-card img')
          .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
      )
      .toBe(true);
    expect(fileRequests, 'list must not download original files').toEqual([]);
    expect(
      await page
        .locator('.ad-filename')
        .evaluate((e) => ({ overflow: getComputedStyle(e).textOverflow, height: e.clientHeight })),
    ).toMatchObject({ overflow: 'clip' });
    await mkdir('../.data/screenshots', { recursive: true });
    await page.screenshot({
      path: '../.data/screenshots/' + info.project.name + '-ads.png',
      fullPage: true,
      scale: 'css',
    });
    // Playback is explicit, stays on the list, and only mounts one video at a time.
    const listURL = page.url();
    await page.getByRole('button', { name: 'Spill av ' + title, exact: true }).click();
    await expect(page).toHaveURL(listURL);
    const inlineVideo = page.locator('.ad-inline-preview video');
    await expect(inlineVideo).toHaveAttribute('src', '/api/previews/' + v2 + '?kind=proxy');
    await expect
      .poll(() => inlineVideo.evaluate((v: HTMLVideoElement) => v.currentTime))
      .toBeGreaterThan(0);
    const secondAd = await tool('studio_create_ad', {
      title: title + ' ekstra',
      external_key: unique + '-extra',
    });
    const attached = await (
      await request.post('/api/ads/' + secondAd.id + '/versions/from-item', {
        headers: { Origin: origin },
        data: { source_version_id: v2, expected_version_id: '' },
      })
    ).json();
    await page.getByRole('button', { name: 'Oppdater', exact: true }).click();
    await page.getByRole('button', { name: 'Spill av ' + title + ' ekstra', exact: true }).click();
    await expect(inlineVideo).toHaveCount(1);
    await expect(inlineVideo).toHaveAttribute(
      'src',
      '/api/previews/' + attached.version_id + '?kind=proxy',
    );
    await expect(page).toHaveURL(listURL);
    await page.getByRole('button', { name: 'Lukk video', exact: true }).click();
    await expect(inlineVideo).toHaveCount(0);
    expect(
      (
        await request.post('/api/items/bulk', {
          headers: { Origin: origin },
          data: { ids: [secondAd.id], action: 'trash' },
        })
      ).status(),
    ).toBe(200);
    await page.getByRole('button', { name: 'Oppdater', exact: true }).click();
    await expect(page.locator('.ad-card')).toHaveCount(1);

    // Folders can be created, used from cards, and survive navigation and reload.
    const folderName = 'Ferdig ' + unique;
    await page.getByRole('button', { name: 'Ny mappe', exact: true }).click();
    await page.getByLabel('Mappenavn', { exact: true }).fill(folderName);
    await page.getByRole('button', { name: 'Lagre mappe', exact: true }).click();
    await expect(page.locator('.ad-card')).toHaveCount(0);
    const folder = (await (await request.get('/api/ad-folders?product=' + product)).json()).find(
      (f: any) => f.name === folderName,
    );
    const folders = page.getByRole('navigation', { name: 'Annonsemapper' });
    await folders.getByRole('button', { name: /^Alle / }).click();
    await page.getByLabel('Mappe for ' + title, { exact: true }).selectOption(folder.id);
    await folders.getByRole('button', { name: new RegExp('^' + folderName) }).click();
    await expect(page).toHaveURL(new RegExp('folder=' + folder.id));
    await page.reload();
    await expect(page.getByLabel('Mappe for ' + title, { exact: true })).toHaveValue(folder.id);
    await page.locator('.ad-card-link').click();
    await expect(page).toHaveURL(new RegExp('/ads/' + ad.id));
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByLabel('Mappe', { exact: true })).toHaveValue(folder.id);
    const adChannels = page.getByRole('group', { name: 'Kanaler for annonsen', exact: true });
    const versionChannels = page.getByRole('group', { name: 'Kanaler for v2', exact: true });
    await adChannels.getByRole('button', { name: 'LinkedIn', exact: true }).click();
    await expect(adChannels.getByRole('button', { name: 'LinkedIn', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await versionChannels.getByRole('button', { name: 'TikTok', exact: true }).click();
    await expect(
      versionChannels.getByRole('button', { name: 'TikTok', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await versionChannels.getByRole('button', { name: 'Instagram', exact: true }).click();
    await expect(
      versionChannels.getByRole('button', { name: 'Instagram', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    const video = page.locator('.review-media video').first();
    await expect(video).toHaveAttribute('src', '/api/previews/' + v2 + '?kind=proxy');
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
      .toBeGreaterThanOrEqual(1);
    await page.goto(page.url() + '&t=0.8');
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
      .toBeGreaterThanOrEqual(0.75);
    await page.goBack();
    await page.getByText('Visningsvalg', { exact: true }).click();
    await page.getByLabel('Vis omtrentlige trygge soner for vertikal video').check();
    await expect(page.locator('.safe-overlay')).toBeVisible();
    await page.getByLabel('Vis omtrentlige trygge soner for vertikal video').uncheck();
    await page.getByText('Visningsvalg', { exact: true }).click();
    await video.evaluate((v: HTMLVideoElement) => v.play());
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
      .toBeGreaterThan(0);
    await video.evaluate((v: HTMLVideoElement) => v.pause());
    await page.getByLabel('Tilbakemelding til agenten').fill('Vis appen allerede i første sekund.');
    await page.getByRole('button', { name: 'Be om endringer', exact: true }).click();
    await expect(page.locator('.review-player-header .review-status')).toHaveText(
      'Trenger endringer',
    );
    await page.getByLabel('Kommentar', { exact: true }).fill('Denne overgangen kan være kortere.');
    await page.getByLabel('Tidspunkt i video · sekunder').fill('1.2');
    await page.getByText('Nevn noen', { exact: true }).click();
    await page.getByLabel('Person eller agent').selectOption(key.id);
    await page.getByRole('button', { name: 'Legg til notat' }).click();
    await expect(page.locator('.review-comments')).toContainText(
      'Denne overgangen kan være kortere.',
    );
    await page.getByRole('button', { name: 'Marker løst', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Åpne igjen', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Åpne igjen', exact: true }).click();
    const feedback = await tool('studio_get_ad', { ad_id: ad.id });
    expect(feedback.notes.some((n: any) => n.version_id === v2 && n.at_seconds === 1.2)).toBe(true);
    expect(feedback.reviews[0].status).toBe('changes_requested');
    expect(feedback.notes[0].mentions).toContain(key.id);
    await page.getByLabel('Sammenlign med').selectOption(v1);
    await expect(page.locator('.review-media video')).toHaveCount(2);
    await page.getByLabel('Sammenlign med').selectOption('');
    await page.screenshot({
      path: '../.data/screenshots/' + info.project.name + '-ad-review.png',
      fullPage: true,
      scale: 'css',
    });
    await page.getByLabel('Vis versjon', { exact: true }).selectOption(v1);
    await expect(page).toHaveURL(new RegExp('version=' + v1));
    const olderChannels = page.getByRole('group', { name: 'Kanaler for v1', exact: true });
    await expect(
      olderChannels.getByRole('button', { name: 'Snapchat', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      olderChannels.getByRole('button', { name: 'TikTok', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: /Godkjenn v/ })).not.toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Vis versjon', { exact: true })).toHaveValue(v1);
    await page.goBack();
    await expect(page.getByLabel('Vis versjon', { exact: true })).toHaveValue(v2);
    await page.getByRole('button', { name: 'Godkjenn v2', exact: true }).click();
    await expect(page.locator('.review-player-header .review-status')).toHaveText('Godkjent');
    // Upload a third render from the browser; no new ad card and no phantom version.
    await page
      .getByLabel('Video eller bilde', { exact: true })
      .setInputFiles({ name: 'third-' + fileName, mimeType: 'video/mp4', buffer: content });
    await page.getByLabel('Hva er endret?').fill('Appen vises tidligere.');
    await page.getByRole('button', { name: 'Lagre filversjon' }).click();
    await expect(page.getByRole('button', { name: 'Godkjenn v3', exact: true })).toBeVisible();
    await expect(
      page
        .getByRole('group', { name: 'Kanaler for v3', exact: true })
        .getByRole('button', { name: 'TikTok', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(adChannels.getByRole('button', { name: 'LinkedIn', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.review-player-header .review-status')).toHaveText(
      'Til gjennomgang',
    );
    await page.getByRole('link', { name: 'Til annonser', exact: true }).click();
    await expect(page.getByLabel('Søk i annonser')).toHaveValue(unique);
    await expect(page.locator('.ad-card')).toHaveCount(1);
    await expect(page.locator('.ad-card')).toContainText('3 versjoner');
    await page.goBack();
    await expect(page.locator('.review-page')).toBeVisible();
    await page.goForward();
    await expect(page.locator('.ad-card')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await expect(page).toHaveURL(new RegExp('folder=' + folder.id));
    await page.getByLabel('Kanalfilter').selectOption('linkedin');
    await expect(page.locator('.ad-card')).toHaveCount(1);
    await page.getByLabel('Kanalfilter').selectOption('snapchat');
    await expect(page.locator('.ad-card')).toHaveCount(0); // Only ad + current render labels filter the list.
    await page.getByLabel('Kanalfilter').selectOption('');
    await page.getByRole('button', { name: 'Rediger mappe', exact: true }).click();
    await page.getByLabel('Mappenavn', { exact: true }).fill('Levert ' + unique);
    await page.getByRole('button', { name: 'Lagre mappe', exact: true }).click();
    await expect(
      page.getByLabel('Mappe for ' + title, { exact: true }).locator('option:checked'),
    ).toHaveText('Levert ' + unique);
    await page.screenshot({
      path: '../.data/screenshots/' + info.project.name + '-ad-folders.png',
      fullPage: true,
      scale: 'css',
    });
    await page.getByRole('button', { name: 'Rediger mappe', exact: true }).click();
    await page.getByRole('button', { name: 'Fjern mappe', exact: true }).click();
    await expect(page).toHaveURL(/folder=unfiled/);
    await expect(page.locator('.ad-card')).toHaveCount(1);
    await expect(page.locator('.ad-card')).toContainText('3 versjoner');
    await expect(page.getByLabel('Mappe for ' + title, { exact: true })).toHaveValue('');
    expect(errors).toEqual([]);
  } finally {
    await request
      .delete('/api/agent-tokens/' + key.id, { headers: { Origin: origin } })
      .catch(() => {});
  }
});

test('organize an existing upload as an ad without losing its approved version', async ({
  page,
  baseURL,
}, info) => {
  const headers = { Origin: baseURL! };
  const credentials = { email: 'browser@example.test', password: 'studio-browser-test-password' };
  const setup = (await (await page.request.get('/api/auth/status')).json()).setup;
  await page.request.post(setup ? '/api/auth/bootstrap' : '/api/auth/login', {
    headers,
    data: setup
      ? { ...credentials, name: 'Studio tester', token: 'test-browser-bootstrap' }
      : credentials,
  });
  const product = (await (await page.request.get('/api/products')).json())[0].id;
  await page.goto('/ads?product=' + product);
  await expect(page.getByRole('heading', { name: 'Annonser', exact: true })).toBeVisible();
  const title = 'Samlet bildeannonse ' + info.project.name + '-' + Date.now();
  const png = await page.screenshot({ scale: 'css' });
  const session = await (
    await page.request.post('/api/upload-sessions', {
      headers,
      data: {
        product_id: product,
        title,
        file_name: title + '.png',
        size: png.length,
        rights: 'owned',
      },
    })
  ).json();
  expect(
    (
      await page.request.patch(session.upload_path, {
        headers: { ...headers, 'Upload-Offset': '0' },
        data: png,
      })
    ).status(),
  ).toBe(200);
  const source = await (
    await page.request.post(session.complete_path, { headers, data: {} })
  ).json();
  expect(
    (
      await page.request.post('/api/items/' + source.id + '/approve', {
        headers,
        data: { version_id: source.version_id },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole('button', { name: 'Ny annonse', exact: true }).click();
  await page.getByLabel('Start med eksisterende innhold').selectOption(source.id);
  await expect(page.getByLabel('Annonsetittel', { exact: true })).toHaveValue(title);
  await page
    .locator('.ad-create-panel')
    .getByLabel('Annonsetype', { exact: true })
    .fill('Bildeannonse');
  await page.getByRole('button', { name: 'Opprett annonse', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/ads/' + source.id));
  await expect(page.locator('.review-version-list > a')).toHaveCount(1);
  await expect(page.getByLabel('Vis versjon', { exact: true })).toHaveValue(source.version_id);
  await expect(page.locator('.review-player-header .review-status')).toHaveText('Godkjent');
  await page.getByRole('link', { name: 'Til annonser', exact: true }).click();
  await page.getByLabel('Søk i annonser').fill(title);
  await expect(page.locator('.ad-card')).toHaveCount(1);
  await expect(page.locator('.ad-card')).toContainText('Bildeannonse');

  const listURL = page.url();
  await page.getByRole('button', { name: 'Lagre favoritt', exact: true }).click();
  await expect(page).toHaveURL(listURL); // A star click must not open the review page.
  await expect(page.getByRole('button', { name: 'Fjern favoritt', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Fjern favoritt', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Favoritter', exact: true }).click();
  await expect(page).toHaveURL(/favorites=1/);
  await expect(page.locator('.ad-card')).toHaveCount(1);
  await page.locator('.ad-card-link').click();
  await expect(page.locator('.review-page')).toBeVisible();
  await page.getByRole('link', { name: 'Til annonser', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Favoritter', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await mkdir('../.data/screenshots', { recursive: true });
  await page.screenshot({
    path: '../.data/screenshots/' + info.project.name + '-ad-favorites.png',
    fullPage: true,
    scale: 'css',
  });
  await page.getByRole('button', { name: 'Fjern favoritt', exact: true }).click();
  await expect(page.locator('.ad-card')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Ingen favoritter passer søket' })).toBeVisible();
  await page.getByRole('button', { name: 'Favoritter', exact: true }).click();
  await expect(page.locator('.ad-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Lagre favoritt', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
