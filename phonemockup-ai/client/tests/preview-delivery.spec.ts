import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

// Vite is not the production HTTP/CDN path. This must also run on the deployed URL.
test.skip(
  !process.env.PLAYWRIGHT_BASE_URL,
  "Set PLAYWRIGHT_BASE_URL to the production server or deployed site",
);
const bytes = readFileSync(
  new URL("../static/previews/motion-2026/soft-orbit.mp4", import.meta.url),
);

test("uncached Safari range probes receive exact bytes and untransformed length headers", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const video = page.locator(".hero-media video");
  await expect(video).toHaveAttribute("src", /soft-orbit\.mp4/);
  const source = (await video.getAttribute("src"))!;
  for (const [range, start, end] of [
    ["bytes=0-1", 0, 1],
    ["bytes=1000-1999", 1000, 1999],
    [`bytes=${bytes.length - 1005}-`, bytes.length - 1005, bytes.length - 1],
  ] as const) {
    const result = await page.evaluate(
      async ({ range, nonce, source }) => {
        const response = await fetch(
          `${source}${source.includes("?") ? "&" : "?"}probe=${nonce}`,
          { headers: { Range: range }, cache: "no-store" },
        );
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers),
          bytes: Array.from(new Uint8Array(await response.arrayBuffer())),
        };
      },
      { range, nonce: `${Date.now()}-${start}`, source },
    );
    expect(result.status).toBe(206);
    expect(result.headers["content-range"]).toBe(
      `bytes ${start}-${end}/${bytes.length}`,
    );
    expect(result.headers["content-length"]).toBe(String(end - start + 1));
    expect(result.headers["accept-ranges"]).toBe("bytes");
    expect(result.headers["cache-control"]).toContain("no-transform");
    expect(result.headers["content-encoding"]).toBeUndefined();
    expect(result.bytes).toEqual([...bytes.subarray(start, end + 1)]);
  }
});

test("full and cached preview responses preserve the complete video length", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const video = page.locator(".hero-media video");
  await expect(video).toHaveAttribute("src", /soft-orbit\.mp4/);
  const source = (await video.getAttribute("src"))!;
  const result = await page.evaluate(async (url) => {
    const full = await fetch(url);
    const length = (await full.arrayBuffer()).byteLength;
    const range = await fetch(url, { headers: { Range: "bytes=0-1" } });
    return {
      status: full.status,
      length,
      contentLength: full.headers.get("content-length"),
      cacheControl: full.headers.get("cache-control"),
      rangeStatus: range.status,
      rangeLength: (await range.arrayBuffer()).byteLength,
    };
  }, source);
  expect(result.status).toBe(200);
  expect(result.length).toBe(bytes.length);
  expect(result.contentLength).toBe(String(bytes.length));
  expect(result.cacheControl).toContain("no-transform");
  expect(result.rangeStatus).toBe(206);
  expect(result.rangeLength).toBe(2);
});
