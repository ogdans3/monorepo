import { test, expect, type Page } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const presetDirectory = fileURLToPath(
  new URL("../src/lib/animations/presets/", import.meta.url),
);
import { waitForAppReady } from "./helpers/waits";
const presets = readdirSync(presetDirectory)
  .filter((n) => n.endsWith(".json"))
  .map((n) => JSON.parse(readFileSync(resolve(presetDirectory, n), "utf8")));
const hero = (p: Page) => p.locator(".hero-media video");
const playing = (p: Page) =>
  hero(p).evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0);
async function go(p: Page, url = "/") {
  await p.goto(url, { waitUntil: "domcontentloaded" });
  if (url === "/")
    await expect(
      p.locator(".hero-media [data-motion-preview]"),
    ).toHaveAttribute("data-visible", "true");
}

test("sixteen shipped motions have continuous clips and closed loops", () => {
  expect(presets).toHaveLength(16);
  for (const group of presets) {
    const clips = group.animations;
    expect(clips[0].start).toBe(0);
    for (let i = 0; i < clips.length; i++) {
      expect(clips[i].end).toBeGreaterThan(clips[i].start);
      if (i) {
        expect(clips[i].start).toBe(clips[i - 1].end);
        for (const field of ["position", "rotation"])
          expect(clips[i].startKeyframe[field]).toEqual(
            clips[i - 1].endKeyframe[field],
          );
      }
    }
    const first = clips[0].startKeyframe,
      last = clips.at(-1).endKeyframe;
    expect(last.position).toEqual(first.position);
    for (const axis of ["x", "y", "z"])
      expect((last.rotation[axis] - first.rotation[axis]) % 360).toBeCloseTo(0);
  }
});
for (const width of [320, 390, 768, 1440])
  test(`landing fits ${width}px without horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await go(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Your work.",
    );
    await expect(page.locator(".motion-card")).toHaveCount(16);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const box = await page.locator(".hero-actions").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  });
test("mobile autoplays without touch, pauses offscreen and resumes", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await go(page);
  await expect.poll(() => playing(page)).toBe(true);
  expect(
    await hero(page).evaluate(
      (v: HTMLVideoElement) => v.muted && v.playsInline,
    ),
  ).toBe(true);
  expect(await page.locator(".motion-card video[src]").count()).toBe(0);
  await page.locator(".motion-card").first().scrollIntoViewIfNeeded();
  await expect
    .poll(() => hero(page).evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
  await expect
    .poll(() =>
      page
        .locator(".motion-card video")
        .evaluateAll((vs) => vs.some((v) => !(v as HTMLVideoElement).paused)),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Pause animations", exact: true })
    .click();
  await expect
    .poll(() =>
      page.locator("video").evaluateAll((vs) => vs.every((v) => (v as HTMLVideoElement).paused)),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Play animations", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator(".motion-card video")
        .evaluateAll((vs) => vs.some((v) => !(v as HTMLVideoElement).paused)),
    )
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => playing(page)).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});
test("reduced motion waits for an explicit press of play", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await go(page);
  await expect(hero(page)).toHaveAttribute("src", /soft-orbit.mp4/);
  await page.waitForTimeout(400);
  expect(
    await hero(page).evaluate(
      (v: HTMLVideoElement) => v.paused && v.currentTime === 0,
    ),
  ).toBe(true);
  await page
    .locator(".hero-media")
    .getByRole("button", { name: "Play Soft Orbit" })
    .click();
  await expect.poll(() => playing(page)).toBe(true);
});
test("rejected autoplay offers a working tap-to-play fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const native = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      return (window as any).__allowVideo
        ? native.call(this)
        : Promise.reject(
            new DOMException("Autoplay blocked", "NotAllowedError"),
          );
    };
  });
  await go(page);
  const play = page
    .locator(".hero-media")
    .getByRole("button", { name: "Play Soft Orbit" });
  await expect(play).toContainText("Tap to play");
  await page.evaluate(() => {
    (window as any).__allowVideo = true;
  });
  await play.click();
  await expect.poll(() => playing(page)).toBe(true);
});
test("featured choices and gallery filters use the new collection", async ({
  page,
}) => {
  await go(page);
  await page
    .locator(".hero-selector")
    .getByRole("button", { name: "03 Top Down" })
    .click();
  await expect(hero(page)).toHaveAttribute("src", /top-down.mp4/);
  await expect(
    page.getByRole("link", { name: "Use Top Down", exact: true }),
  ).toHaveAttribute("href", "/platform/animation/top-down");
  await page.getByRole("button", { name: "Reveal", exact: true }).click();
  await expect(page.locator(".motion-card")).toHaveCount(3);
  await expect(page.locator(".motion-card")).toContainText([
    "Edge Reveal",
    "Lift Off",
    "Snap In",
  ]);
  await page.getByRole("button", { name: "All motions", exact: true }).click();
  await expect(page.locator(".motion-card")).toHaveCount(16);
  await go(page, "/platform/animation");
  await expect(page.locator("a .preset-preview")).toHaveCount(16);
  await expect(
    page.getByRole("button", { name: "Fancy", exact: true }),
  ).toHaveCount(0);
});
for (const [id, modelId, sample] of [
  ["soft-orbit", "iphone-16-pro", "focus"],
  ["top-down", "macbook-pro-14-m4", "workspace"],
])
  test(`${id} opens the matching scene and preserves its demo after reload`, async ({
    page,
  }) => {
    const images: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes(`/media/studio/${sample}.png`)) images.push(r.url());
    });
    await go(page, `/platform/animation/${id}`);
    await waitForAppReady(page);
    await expect.poll(() => images.length).toBeGreaterThan(0);
    await expect(page.getByLabel("End time in seconds")).toHaveValue("6.00");
    await page.getByRole("button", { name: "Model", exact: true }).click();
    await expect(page.locator("#model-type")).toContainText(
      modelId === "iphone-16-pro" ? "iPhone 16 Pro" : "MacBook Pro 14",
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/platform\/project\//);
    const saved = await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem(
          Object.keys(localStorage).find((k) =>
            k.startsWith("project:local:"),
          )!,
        )!,
      ),
    );
    expect(saved.model.id).toBe(modelId);
    expect(saved.demoMediaId).toBe(sample);
    expect(saved.sceneSettings.selectedPreset).toBe("Portrait (4:5)");
    expect(saved.sceneSettings.glassReflections).toBe(false);
    expect(saved.screenMedia).toBeNull();
    images.length = 0;
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppReady(page);
    await expect.poll(() => images.length).toBeGreaterThan(0);
    await expect(page.getByLabel("End time in seconds")).toHaveValue("6.00");
  });
