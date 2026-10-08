import { test, expect, type Locator, type Page } from "@playwright/test";

const hero = (page: Page) => page.locator(".hero-media");
async function advances(video: Locator) {
  const start = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  await expect
    .poll(() =>
      video.evaluate(
        (v: HTMLVideoElement, time) =>
          !v.paused &&
          v.readyState >= 2 &&
          Math.abs(v.currentTime - time) > 0.1,
        start,
      ),
    )
    .toBe(true);
}

async function gestureOnlyPlayback(page: Page) {
  await page.addInitScript(() => {
    let inTap = false;
    const unlocked = new WeakSet<HTMLMediaElement>();
    document.addEventListener(
      "click",
      (e) => {
        inTap = e.isTrusted;
        setTimeout(() => {
          inTap = false;
        }, 0);
      },
      true,
    );
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (inTap) unlocked.add(this);
      if (!unlocked.has(this))
        return Promise.reject(
          new DOMException("User gesture required", "NotAllowedError"),
        );
      return nativePlay.call(this);
    };
  });
}

test("real mobile video starts inline and resumes after a pause tap", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const video = hero(page).locator("video");
  await advances(video);
  await expect(video).toHaveJSProperty("muted", true);
  await expect(video).toHaveJSProperty("playsInline", true);
  await hero(page).getByRole("button", { name: "Pause Soft Orbit" }).tap();
  await expect(video).toHaveJSProperty("paused", true);
  await hero(page).getByRole("button", { name: "Play Soft Orbit" }).tap();
  await advances(video);
});

test("blocked autoplay starts on one trusted touch tap, including gallery cards", async ({
  page,
}) => {
  await gestureOnlyPlayback(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const play = hero(page).getByRole("button", { name: "Play Soft Orbit" });
  await expect(play).toContainText("Tap to play");
  await play.tap();
  await advances(hero(page).locator("video"));
  await expect(hero(page)).not.toContainText("Tap to play");
  const card = page.locator(".motion-card").first();
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByRole("button")).toContainText("Tap to play");
  await card.getByRole("button").tap();
  await advances(card.locator("video"));
  await expect(page).toHaveURL(/\/$/);
});

test("one tap retries a failed mobile video download after the connection recovers", async ({
  page,
}) => {
  let failedConnection = true;
  await page.route("**/previews/motion-2026/soft-orbit.mp4*", (route) =>
    failedConnection
      ? route.fulfill({
          status: 503,
          contentType: "text/plain",
          body: "Temporary connection failure",
        })
      : route.continue(),
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const video = hero(page).locator("video");
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => Boolean(v.error)))
    .toBe(true);
  await expect(hero(page).getByRole("button")).toContainText("Tap to play");
  failedConnection = false;
  await hero(page).getByRole("button").tap();
  await advances(video);
  await expect(hero(page)).not.toContainText("Tap to play");
});

test("a tap before the lazy observer fires attaches the video source immediately", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = "0px";
      thresholds = [0];
    } as unknown as typeof IntersectionObserver;
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const video = hero(page).locator("video");
  await expect(video).not.toHaveAttribute("src");
  await hero(page).getByRole("button", { name: "Play Soft Orbit" }).tap();
  await advances(video);
});

test("reduced motion and global pause keep their playback policy after touch interaction", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const video = hero(page).locator("video");
  await expect(video).toHaveJSProperty("paused", true);
  await hero(page).getByRole("button", { name: "Play Soft Orbit" }).tap();
  await advances(video);
  const pause = page.getByRole("button", {
    name: "Pause animations",
    exact: true,
  });
  await pause.tap();
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluateAll((vs) => vs.every((v) => (v as HTMLVideoElement).paused)),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Play animations", exact: true })
    .tap();
  await hero(page).scrollIntoViewIfNeeded();
  await advances(video);
});

test("touch-started previews pause offscreen; explicit pause survives scrolling", async ({
  page,
}) => {
  await gestureOnlyPlayback(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const video = hero(page).locator("video");
  await expect(hero(page).getByRole("button")).toContainText("Tap to play");
  await hero(page).getByRole("button").tap();
  await advances(video);
  await page.locator(".motion-card").first().scrollIntoViewIfNeeded();
  await expect(video).toHaveJSProperty("paused", true);
  await hero(page).scrollIntoViewIfNeeded();
  await advances(video);
  await hero(page).getByRole("button", { name: "Pause Soft Orbit" }).tap();
  await page.locator(".motion-card").first().scrollIntoViewIfNeeded();
  await expect(hero(page).locator("[data-motion-preview]")).toHaveAttribute(
    "data-visible",
    "false",
  );
  await hero(page).scrollIntoViewIfNeeded();
  await expect(hero(page).locator("[data-motion-preview]")).toHaveAttribute(
    "data-visible",
    "true",
  );
  await expect(video).toHaveJSProperty("paused", true);
});

test("a touch-started preview keeps playing for two complete loops", async ({
  page,
}) => {
  await gestureOnlyPlayback(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const preview = hero(page);
  await expect(preview.getByRole("button")).toContainText("Tap to play");
  await preview.getByRole("button").tap();
  const video = preview.locator("video");
  await advances(video);
  const result = await video.evaluate(async (v: HTMLVideoElement) => {
    let previous = v.currentTime,
      elapsed = 0,
      loops = 0;
    const pauses: number[] = [];
    for (let i = 0; i < 52; i++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (v.paused || v.error) pauses.push(i);
      const now = v.currentTime;
      if (now < previous) {
        elapsed += v.duration - previous + now;
        loops++;
      } else elapsed += now - previous;
      previous = now;
    }
    return { elapsed, loops, pauses };
  });
  expect(result.pauses).toEqual([]);
  expect(result.elapsed).toBeGreaterThan(12);
  expect(result.loops).toBeGreaterThanOrEqual(2);
});
