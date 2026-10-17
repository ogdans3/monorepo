import { test, expect } from "@playwright/test";

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`account navigation fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    if (width <= 760)
      await page.getByRole("button", { name: "Menu", exact: true }).click();
    const signIn = page
      .getByRole("link", { name: "Sign in", exact: true })
      .filter({ visible: true });
    await expect(signIn).toBeInViewport();
    await expect(
      page
        .getByRole("link", { name: "Sign up", exact: true })
        .filter({ visible: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await signIn.click();
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(
      page.getByRole("heading", { name: "Good to see you." }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("unconfigured auth provides a way back to the local editor", async ({
  page,
}) => {
  await page.goto("/sign-in?returnTo=%2Fplatform%2Fanimation%2Fsoft-orbit");
  await expect(
    page.getByRole("heading", { name: "Sign-in is currently unavailable." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Continue to studio" }).click();
  await expect(page.getByTestId("canvas").locator("canvas")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Export", exact: true }),
  ).toBeEnabled();
});

for (const destination of [
  "https://evil.test",
  "//evil.test",
  "/\\evil.test",
  "/\tevil.test",
  "/sign-in",
  "/sign-up",
]) {
  test(`auth return path rejects ${JSON.stringify(destination)}`, async ({
    page,
  }) => {
    await page.goto(`/sign-in?returnTo=${encodeURIComponent(destination)}`);
    await expect(
      page.getByRole("link", { name: "Back to studio" }),
    ).toHaveAttribute("href", "/platform/project");
  });
}

test("sign-up and project list expose accounts without promising cloud sync", async ({
  page,
}) => {
  await page.goto("/sign-up");
  await expect(
    page.getByRole("heading", { name: "Make yourself at home." }),
  ).toBeVisible();
  await expect(
    page.getByText("Signing in doesn’t upload your files.", { exact: false }),
  ).toBeVisible();
  await page.goto("/platform/project");
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Cloud projects are automatically synced."),
  ).toHaveCount(0);
});
