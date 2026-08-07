import { expect, test, type Page } from '@playwright/test';

/**
 * The browser client, against a real API and a real database.
 *
 * Everything here failed at some point during the build, which is why it is
 * written down: a Content Security Policy that blocked the API, two tabs
 * sharing one client id so a remote change was mistaken for an echo, and a
 * default list indent that pushed every row off the left of a phone.
 */

async function makeList(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Make a list' }).click();
  await page.waitForURL(/\/l\/[A-Za-z0-9_-]{43}/);
  return page.url();
}

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
  await page.getByRole('button', { name: 'Replace link' }).click();
  await page.getByRole('button', { name: 'Replace the link' }).click();
  await expect(page.getByText('Link replaced.')).toBeVisible();

  // Anyone still holding the old link is told what happened, not shown a shrug.
  const stale = await context.newPage();
  await stale.goto(url);
  await expect(stale.getByRole('heading')).toContainText('This link was replaced');
  await expect(stale.getByRole('link', { name: 'Back to Checkpost' })).toBeVisible();
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
