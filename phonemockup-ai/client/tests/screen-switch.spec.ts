import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { screenCutCues } from "../src/lib/animations/screen-switch";
import type { Track } from "../src/lib/components/mock-video/Project";
import { waitForAppReady } from "./helpers/waits";

const flip = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../src/lib/animations/presets/flip-cut.json", import.meta.url),
    ),
    "utf8",
  ),
);

test("screen cut follows shifted clips and disappears when the held pose is edited", () => {
  const track: Track = {
    id: "track",
    phoneName: "Phone 1",
    animations: structuredClone(flip.animations),
  };
  expect(screenCutCues([track])[0].at).toBe(2.5);
  for (const clip of track.animations) {
    clip.start += 4;
    clip.end += 4;
  }
  expect(screenCutCues([track])[0].at).toBe(6.5);
  const hold = track.animations.find((a) => a.screenCut)!;
  hold.startKeyframe.rotation.y = hold.endKeyframe.rotation.y = 0;
  expect(screenCutCues([track])).toHaveLength(0);
  hold.startKeyframe.rotation.y = hold.endKeyframe.rotation.y = 180;
  hold.endKeyframe.position.x = 0.1;
  expect(screenCutCues([track])).toHaveLength(0);
  hold.endKeyframe.position.x = Number.NaN;
  expect(screenCutCues([track])).toHaveLength(0);
  hold.endKeyframe.position.x = hold.startKeyframe.position.x;
  hold.start = Number.NaN;
  expect(screenCutCues([track])).toHaveLength(0);
});

async function centre(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const source = document.querySelector(
      '[data-testid="canvas"] canvas',
    ) as HTMLCanvasElement;
    const copy = document.createElement("canvas");
    copy.width = source.width;
    copy.height = source.height;
    const ctx = copy.getContext("2d")!;
    ctx.drawImage(source, 0, 0);
    return Array.from(
      ctx.getImageData(
        Math.floor(copy.width / 2),
        Math.floor(copy.height / 2),
        1,
        1,
      ).data,
    ).slice(0, 3);
  });
}
async function seek(page: Page, time: number) {
  await page.getByLabel("Start time in seconds").fill(String(time));
  await page.getByLabel("Start time in seconds").blur();
}

test("two uploaded screens switch during the flip and survive saving and reopening", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/platform/animation/flip-cut", {
    waitUntil: "domcontentloaded",
  });
  await waitForAppReady(page);
  await expect(page.getByTestId("screen-switch-bar")).toContainText("2.50s");
  await page.getByRole("button", { name: "Go to cut", exact: true }).click();
  await expect(page.getByLabel("Start time in seconds")).toHaveValue("2.50");
  await page
    .getByRole("button", { name: "Switch screens", exact: true })
    .click();
  const colors = await page.evaluate(() =>
    ["#ff2020", "#20ff20"].map((color) => {
      const c = document.createElement("canvas");
      c.width = 160;
      c.height = 320;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, c.width, c.height);
      return c.toDataURL("image/png").split(",")[1];
    }),
  );
  await page.getByLabel("Before the flip", { exact: true }).setInputFiles({
    name: "before.png",
    mimeType: "image/png",
    buffer: Buffer.from(colors[0], "base64"),
  });
  await page.getByLabel("After the flip", { exact: true }).setInputFiles({
    name: "after.png",
    mimeType: "image/png",
    buffer: Buffer.from(colors[1], "base64"),
  });
  await page
    .getByRole("button", { name: "Create screen switch", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Screen switch ready at 2.50s",
    { timeout: 45_000 },
  );
  await page.getByRole("button", { name: "Back to editor" }).click();
  await seek(page, 0);
  await expect
    .poll(async () => {
      const [r, g] = await centre(page);
      return r - g;
    })
    .toBeGreaterThan(100);
  await seek(page, 5);
  await expect
    .poll(async () => {
      const [r, g] = await centre(page);
      return g - r;
    })
    .toBeGreaterThan(100);
  // Inspect the actual generated source on each side of the cut as well.
  const samples = await page.evaluate(async () => {
    const load = (url: string) => import(url);
    const { videoController } = await load("/src/lib/stores/video.svelte.ts");
    const { get } = await load("/node_modules/.vite/deps/svelte_store.js");
    const video = get(videoController).video as HTMLVideoElement;
    const c = document.createElement("canvas");
    c.width = 10;
    c.height = 10;
    const ctx = c.getContext("2d")!;
    const values = [];
    for (const time of [2.4, 2.6]) {
      await new Promise<void>((resolve) => {
        video.addEventListener("seeked", () => resolve(), { once: true });
        video.currentTime = time;
      });
      ctx.drawImage(video, 0, 0, 10, 10);
      values.push(Array.from(ctx.getImageData(5, 5, 1, 1).data).slice(0, 3));
    }
    return values;
  });
  expect(samples[0][0] - samples[0][1]).toBeGreaterThan(100);
  expect(samples[1][1] - samples[1][0]).toBeGreaterThan(100);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/platform\/project\//);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppReady(page);
  await expect(page.getByTestId("screen-switch-bar")).toContainText("2.50s");
  await seek(page, 5);
  await expect
    .poll(
      async () => {
        const [r, g] = await centre(page);
        return g - r;
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(100);
});

test("unsupported encoding leaves the existing screen unchanged and explains the fallback", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "VideoEncoder", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/platform/animation/flip-cut", {
    waitUntil: "domcontentloaded",
  });
  await waitForAppReady(page);
  await page
    .getByRole("button", { name: "Switch screens", exact: true })
    .click();
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("video encoding support");
  await expect(
    page.getByRole("button", { name: "Try demo", exact: true }),
  ).toBeEnabled();
});

test("Zoom, Spin and Flip filters expose the additional collection", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.locator(".hero-media [data-motion-preview]"),
  ).toHaveAttribute("data-visible", "true");
  for (const [name, count] of [
    ["Zoom", 2],
    ["Spin", 2],
    ["Flip", 3],
  ] as const) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".motion-card")).toHaveCount(count);
  }
  await expect(page.locator(".cut-label")).toHaveCount(3);
});

// Exercise the real sample images at their normal resolution, not just tiny test fixtures.
test("the built-in screen-switch demo works at full sample resolution", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/platform/animation/flip-cut", {
    waitUntil: "domcontentloaded",
  });
  await waitForAppReady(page);
  await page
    .getByRole("button", { name: "Switch screens", exact: true })
    .click();
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Screen switch ready at 2.50s",
    { timeout: 75_000 },
  );
  const directory = fileURLToPath(
    new URL("../../assets/motion-2026/qa/", import.meta.url),
  );
  mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: directory + "screen-switch-dialog.png" });
  await page.getByRole("button", { name: "Back to editor" }).click();
  await seek(page, 5);
  await expect
    .poll(async () => Math.min(...(await centre(page))))
    .toBeGreaterThan(120);
  await page.screenshot({ path: directory + "screen-switch-editor.png" });
});
