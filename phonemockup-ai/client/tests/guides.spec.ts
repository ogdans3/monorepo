import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test, expect } from "@playwright/test";
import { SITE, guidePath, guides, hubs } from "../src/lib/guides/guides";

const pages = [
  ...hubs.map((hub) => ({ path: `/${hub.section}`, title: hub.title, h1: hub.h1 })),
  ...guides.map((guide) => ({
    path: guidePath(guide),
    title: guide.title,
    h1: guide.h1,
  })),
];

// The sixteen offered motions. The studio opens an unknown id as the default
// animation, so a link to one would quietly open the wrong thing.
const motionIds = readdirSync(resolve("src/lib/animations/presets")).map((file) =>
  file.replace(/\.json$/, ""),
);

test.beforeEach(async ({ page }) => {
  await page.route("https://e.phonemockup.app/**", (route) =>
    route.fulfill({ status: 200, body: "{}", contentType: "application/json" }),
  );
});

test("every hub and guide has its own title, H1, canonical URL and breadcrumbs", async ({
  page,
}) => {
  for (const entry of pages) {
    const response = await page.goto(entry.path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), entry.path).toBe(200);
    await expect(page).toHaveTitle(entry.title);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(entry.h1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${SITE}${entry.path}`,
    );
    const description =
      (await page.locator('meta[name="description"]').getAttribute("content")) ?? "";
    expect(description.length, entry.path).toBeGreaterThan(80);
    expect(description.length, entry.path).toBeLessThanOrEqual(170);
    const breadcrumbs = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}",
    );
    expect(breadcrumbs["@type"]).toBe("BreadcrumbList");
    expect(breadcrumbs.itemListElement.at(-1).item).toBe(`${SITE}${entry.path}`);
  }
});

test("each guide's keyword is in its title, H1 and first sentence", async ({
  page,
}) => {
  for (const guide of guides) {
    await page.goto(guidePath(guide), { waitUntil: "domcontentloaded" });
    const lead = (await page.locator(".g-lead").textContent()) ?? "";
    const firstSentence = lead.split(/(?<=[.:])\s/)[0].toLowerCase();
    const h1 = ((await page.locator("h1").textContent()) ?? "").toLowerCase();
    const title = guide.title.toLowerCase();
    for (const word of guide.keyword.split(" ")) {
      expect(title, `${guide.slug} title`).toContain(word);
      expect(h1, `${guide.slug} H1`).toContain(word);
      expect(firstSentence, `${guide.slug} first sentence`).toContain(word);
    }
  }
});

test("the motion on show is the one the studio opens", async ({ page }) => {
  const guide = guides.find((g) => g.slug === "iphone-16-pro")!;
  await page.goto(guidePath(guide));
  const ctas = page.getByRole("link", { name: guide.cta });
  await expect(ctas).toHaveCount(2);
  for (const cta of await ctas.all())
    await expect(cta).toHaveAttribute("href", `/platform/animation/${guide.motions[0]}`);

  const choice = page
    .getByRole("group", { name: "Preview a motion" })
    .getByRole("button", { name: "Edge Reveal", exact: true });
  await choice.click();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
  for (const cta of await ctas.all())
    await expect(cta).toHaveAttribute("href", "/platform/animation/edge-reveal");
  await expect(page.locator(".g-opens")).toContainText("Edge Reveal");
  await expect(page.locator(".g-stage video")).toHaveAttribute(
    "aria-label",
    /Edge Reveal on the iPhone 16 Pro/,
  );
});

test("every link on the guides leads somewhere real", async ({ page, request }) => {
  const hrefs = new Set<string>();
  for (const entry of pages) {
    await page.goto(entry.path, { waitUntil: "domcontentloaded" });
    for (const href of await page
      .locator("main a[href^='/'], footer a[href^='/'], .crumbs a[href^='/']")
      .evaluateAll((links) => links.map((a) => a.getAttribute("href")!)))
      hrefs.add(href.split(/[?#]/)[0]);
  }
  for (const href of hrefs) {
    if (href.startsWith("/platform/animation/")) {
      expect(motionIds, href).toContain(href.split("/").pop());
      continue;
    }
    const response = await request.get(href);
    expect(response.status(), href).toBeLessThan(400);
  }
});

test("an unknown guide is a 404", async ({ request }) => {
  for (const hub of hubs) {
    const response = await request.get(`/${hub.section}/no-such-guide`);
    expect(response.status()).toBe(404);
  }
});

test("the sitemap lists the homepage, the hubs and every guide", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locations).toEqual([
    `${SITE}/`,
    ...hubs.map((hub) => `${SITE}/${hub.section}`),
    ...guides.map((guide) => `${SITE}${guidePath(guide)}`),
  ]);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
});

test("the guides fit phone, tablet and desktop widths", async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/mockups",
      "/mockups/iphone-16-pro",
      "/alternatives/rotato",
      "/use-cases/product-hunt-launch-video",
    ]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      );
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
    }
  }
});

test("the phone menu opens, closes with Escape and gives focus back", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mockups/pixel-9-pro");
  const toggle = page.getByRole("button", { name: "Menu" });
  await expect(toggle).toBeEnabled();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "Use cases" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Mockups" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
});

test("the homepage links to every hub", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("navigation", { name: "Guides" });
  for (const hub of hubs)
    await expect(footer.getByRole("link", { name: hub.name, exact: true })).toHaveAttribute(
      "href",
      `/${hub.section}`,
    );
});

test("comparison pages lead with the table, and the hub lists dated verdicts", async ({
  page,
}) => {
  await page.goto("/alternatives/rotato");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("heading", { name: "The short version." })).toHaveCount(0);
  await page.goto("/alternatives");
  const rows = page.locator(".g-verdicts li");
  await expect(rows).toHaveCount(guides.filter((g) => g.section === "alternatives").length);
  for (const guide of guides.filter((g) => g.section === "alternatives")) {
    const row = rows.filter({ hasText: `PhoneMockup vs ${guide.name}` });
    await expect(row).toContainText(guide.verdict!);
    await expect(row).toContainText(`Checked ${guide.comparison!.checkedOn}`);
  }
});
