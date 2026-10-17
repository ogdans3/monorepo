import { test, expect } from '@playwright/test';

// Start a second production client with the synthetic key below. These tests
// exercise the real bundled SDK while intercepting every fixture API request.
// pk_test_Y2xlcmstZml4dHVyZS5jbGVyay5hY2NvdW50cy5kZXYk
const fixtureURL = process.env.CLERK_FAILURE_TEST_URL;
test.skip(!fixtureURL, 'Requires a separate client with the synthetic Clerk key.');

test('Clerk network failure supports retry and leaves local projects accessible', async ({ page }) => {
    let attempts = 0;
    await page.route('https://clerk-fixture.clerk.accounts.dev/**', async (route) => {
        attempts++;
        await route.abort('failed');
    });
    await page.goto(`${fixtureURL}/sign-in`);
    const unavailable = page.getByRole('heading', { name: 'Sign-in is currently unavailable.' });
    await expect(unavailable).toBeVisible({ timeout: 60_000 });
    expect(attempts).toBeGreaterThan(0);
    const before = attempts;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect.poll(() => attempts).toBeGreaterThan(before);
    await expect(unavailable).toBeVisible({ timeout: 60_000 });
    await page.getByRole('link', { name: 'Continue to studio' }).click();
    await expect(page).toHaveURL(/\/platform\/project/);
});
