import { test, expect } from "@playwright/test";

// Opt in against a configured instance. These checks never submit credentials,
// create users, or send verification emails.
test.skip(!process.env.CLERK_LIVE_TEST, "Requires a configured Clerk instance");

for (const route of ["sign-in", "sign-up"]) {
  test(`live Clerk ${route} renders its form`, async ({ page }) => {
    await page.goto(`/${route}`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByLabel("Email address", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Sign-in is currently unavailable."),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("Clerk form links preserve the return to the editor", async ({ page }) => {
  const returnTo = "/platform/animation/soft-orbit";
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("link", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-up\?/);
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to studio" }),
  ).toHaveAttribute("href", returnTo);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in\?/);
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to studio" }),
  ).toHaveAttribute("href", returnTo);
});
