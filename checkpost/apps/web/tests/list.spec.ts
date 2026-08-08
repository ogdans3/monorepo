import { expect, test, type Page } from '@playwright/test';

/**
 * The browser client, against a real API and a real database.
 *
 * Everything here failed at some point during the build, which is why it is
 * written down: a Content Security Policy that blocked the API, two tabs
 * sharing one client id so a remote change was mistaken for an echo, and a
 * default list indent that pushed every row off the left of a phone.
 */

const made: string[] = [];

async function makeList(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Make a list' }).click();
  await page.waitForURL(/\/l\/[A-Za-z0-9_-]{43}/);
  const url = page.url();
  made.push(url.split('/l/')[1]!);
  return url;
}

/**
 * These tests create real lists, and the API may well be pointed at a hosted
 * database, so every one of them is deleted again rather than left behind as
 * litter somebody has to clear out by hand.
 */
test.afterEach(async ({ request }) => {
  const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';
  for (const token of made.splice(0)) {
    // A rotated link means the token is already dead, and a 410 here is a pass.
    // The list is gone either way.
    await request
      .delete(`${apiOrigin}/v1/list`, { headers: { authorization: `Bearer ${token}` } })
      .catch(() => {});
  }
});

async function addItem(page: Page, text: string) {
  const field = page.getByLabel('Add an item');
  await field.fill(text);
  await field.press('Enter');
  await expect(page.getByText(text, { exact: true })).toBeVisible();
}

test('a list can be made, filled and ticked off from a browser', async ({ page }) => {
  await makeList(page);

  await addItem(page, 'Firewood');
  await addItem(page, 'Coffee');
  // The field keeps focus so several items can be typed without stopping.
  await expect(page.getByLabel('Add an item')).toBeFocused();

  await page.getByText('Firewood', { exact: true }).click();

  // A ticked row holds its place briefly so you can see what you did.
  await expect(page.locator('.shelf')).toBeHidden();
  await expect(page.locator('.shelf')).toContainText('Done · 1');
  await expect(page.getByText('Firewood', { exact: true })).toBeVisible();
});

test('two tabs on one link see each other', async ({ page, context }) => {
  const url = await makeList(page);
  await addItem(page, 'Firewood');

  const other = await context.newPage();
  await other.goto(url);
  await expect(other.getByText('Firewood', { exact: true })).toBeVisible();

  // Presence is a count and never a name, and it only appears with company.
  await expect(page.locator('.presence')).toContainText('2');

  await addItem(other, 'Added from the other phone');
  const arrived = page.getByText('Added from the other phone', { exact: true });
  await expect(arrived).toBeVisible();

  // Somebody else's change is highlighted, which is how you notice it. Each tab
  // has its own client id, or this would look like an echo of our own write.
  await expect(page.locator('li.row.washing')).toHaveCount(1);

  await other.getByText('Firewood', { exact: true }).click();
  await expect(page.locator('.shelf')).toContainText('Done · 1');
});

test('a tick lands before the network answers', async ({ page }) => {
  await makeList(page);
  await addItem(page, 'Firewood');

  // Nothing can reach the API from here on.
  await page.route('**/v1/**', (route) => route.abort());

  await page.getByText('Firewood', { exact: true }).click();
  // Still ticked, with no server involved at all.
  await expect(page.locator('li.row.done')).toHaveCount(1);
  // And the edit is kept rather than reverted, because it is still true here.
  await expect(page.locator('.banner')).toContainText('Offline');
});

test('a replaced link is a plain sentence with a way out', async ({ page, context }) => {
  const url = await makeList(page);
  await addItem(page, 'Firewood');

  await page.getByRole('button', { name: 'Share this list' }).click();
  await page.getByRole('button', { name: 'Replace my link' }).first().click();
  await page.getByRole('button', { name: 'Replace my link' }).last().click();
  await expect(page.getByText('Link replaced.')).toBeVisible();

  // Anyone still holding the old link is told what happened, not shown a shrug.
  const stale = await context.newPage();
  await stale.goto(url);
  await expect(stale.getByRole('heading')).toContainText('This link was replaced');
  await expect(stale.getByRole('link', { name: 'Back to Checkpost' })).toBeVisible();
});

test('a long list name never pushes the buttons off the screen', async ({ page }) => {
  await makeList(page);
  await page.locator('button.title').click();
  await page.locator('input.rename').fill('Del 1: Foto i Oslo (11 stk, alle bilder) og litt til');
  await page.locator('input.rename').press('Enter');
  await expect(page.locator('h1')).toContainText('Del 1');

  const viewport = page.viewportSize()!;
  for (const label of ['Share this list', 'More']) {
    const box = await page.getByRole('button', { name: label }).boundingBox();
    expect(box, label).not.toBeNull();
    expect(box!.x + box!.width, label).toBeLessThanOrEqual(viewport.width);
  }
});

/** Mints a link at a level using the admin link that made the list. */
async function mintLink(page: Page, label: string): Promise<string> {
  await page.getByRole('button', { name: 'Share this list' }).click();
  await page.getByRole('button', { name: 'Make a link', exact: true }).click();
  await page.getByText(label, { exact: true }).click();
  await page.getByRole('button', { name: 'Make the link' }).click();
  await expect(page.getByText('shown once', { exact: false })).toBeVisible();
  const url = (await page.locator('code').innerText()).trim();
  made.push(url.split('/l/')[1]!);
  await page.getByRole('button', { name: 'Close' }).click();
  return url;
}

test('a read link can look and cannot touch', async ({ page, context }) => {
  await makeList(page);
  await addItem(page, 'Firewood');

  const readUrl = await mintLink(page, 'Can look');

  const reader = await context.newPage();
  await reader.goto(readUrl);
  await expect(reader.getByText('Firewood', { exact: true })).toBeVisible();
  await expect(reader.getByText('Read only')).toBeVisible();

  // No way in. No composer, and the controls are off rather than merely
  // ignoring you, which is also why this asserts rather than clicking.
  await expect(reader.getByLabel('Add an item')).toHaveCount(0);
  await expect(reader.locator('button.tick').first()).toBeDisabled();
  await expect(reader.locator('button.edge').first()).toBeDisabled();
  await expect(reader.locator('li.row.done')).toHaveCount(0);

  // And the owner's view still shows it unticked, so nothing slipped through.
  await expect(page.locator('li.row.done')).toHaveCount(0);
});

test('a write link can tick but cannot manage links', async ({ page, context }) => {
  await makeList(page);
  await addItem(page, 'Firewood');

  const writeUrl = await mintLink(page, 'Can tick and add');

  const writer = await context.newPage();
  await writer.goto(writeUrl);
  await expect(writer.getByText('Firewood', { exact: true })).toBeVisible();
  await expect(writer.getByText('Read only')).toHaveCount(0);

  await writer.getByText('Firewood', { exact: true }).click();
  await expect(writer.locator('.shelf')).toContainText('Done · 1');
  // It reaches the other tab, so it really was written.
  await expect(page.locator('.shelf')).toContainText('Done · 1');

  // Managing access is where it stops.
  await writer.getByRole('button', { name: 'Share this list' }).click();
  await expect(writer.getByText('Only a link that can do everything')).toBeVisible();
  await expect(writer.getByRole('button', { name: 'Make a link', exact: true })).toHaveCount(0);
});

test('a copy link hands over a private copy and hides the original', async ({ page, context }) => {
  await makeList(page);
  await addItem(page, 'Passport');
  await addItem(page, 'Charger');
  await page.getByText('Passport', { exact: true }).click();
  await expect(page.locator('.shelf')).toContainText('Done · 1');

  const copyUrl = await mintLink(page, 'Gets their own copy');

  const taker = await context.newPage();
  await taker.goto(copyUrl);
  // It says what it will make, and does not show the list itself.
  await expect(taker.getByRole('heading')).toContainText('Take your own copy');
  await expect(taker.getByText('Passport', { exact: true })).toHaveCount(0);

  await taker.getByRole('button', { name: 'Make my copy' }).click();
  await taker.waitForURL((url) => url.pathname !== new URL(copyUrl).pathname);
  made.push(taker.url().split('/l/')[1]!);

  // Everything is there, and nothing arrived already done.
  await expect(taker.getByText('Passport', { exact: true })).toBeVisible();
  await expect(taker.getByText('Charger', { exact: true })).toBeVisible();
  await expect(taker.locator('.shelf')).toHaveCount(0);

  // The two lists are strangers from here on.
  await addItem(taker, 'Only mine');
  await expect(page.getByText('Only mine', { exact: true })).toHaveCount(0);
});

test('an unreadable token is a 404, not a request', async ({ page }) => {
  const failures: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/v1/list')) failures.push(request.url());
  });
  await page.goto('/l/not-a-real-token');
  await expect(page.getByRole('heading')).toContainText('Nothing here');
  expect(failures).toEqual([]);
});

test('the composer clears the keyboard and the rows reach the edge', async ({ page }) => {
  await makeList(page);
  await addItem(page, 'Firewood');

  // The row starts at the 20px gutter. A default list indent used to push it
  // most of the way across a phone.
  const box = await page.locator('li.row .box').first().boundingBox();
  expect(box?.x).toBeLessThan(28);

  // Every touch target clears 44px.
  for (const selector of ['button.edge', 'button.tick']) {
    const size = await page.locator(selector).first().boundingBox();
    expect(size?.height).toBeGreaterThanOrEqual(44);
  }

  // The composer sits at the bottom of the shell, not off the end of the page.
  const composer = await page.locator('form.composer').boundingBox();
  const viewport = page.viewportSize();
  expect(composer && viewport && composer.y + composer.height).toBeLessThanOrEqual(
    (viewport?.height ?? 0) + 1,
  );
});
