import { test, expect, type Page } from "@playwright/test";

async function go(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
}
async function editor(page: Page) {
  await go(page, "/platform/animation/soft-orbit");
  await expect(page.getByTestId("canvas").locator("canvas")).toBeVisible();
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
}
async function save(page: Page) {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Project saved", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/platform\/project\//);
}
test.beforeEach(async ({ page }) => {
  // Analytics and account controls are outside these local editing tests.
  await page.route("https://e.phonemockup.app/**", (route) =>
    route.fulfill({ status: 200, body: "{}", contentType: "application/json" }),
  );
});

test("library navigation, search and filters work at phone, tablet and desktop widths", async ({
  page,
}) => {
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await go(page, "/platform/project");
    await expect(
      page.getByRole("heading", { name: "A place for your next idea." }),
    ).toBeVisible();
    await page.getByRole("link", { name: "New project", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Find your next move." }),
    ).toBeVisible();
    await expect(page.locator("[data-motion-id]")).toHaveCount(16);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const first = await page.locator("[data-motion-id]").first().boundingBox();
    expect(first!.y).toBeLessThan(700);
    await page.getByLabel("Search animations").fill("no matching animation");
    await expect(page.getByText("No matching motions.")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.getByRole("button", { name: "Spin", exact: true }).click();
    expect(await page.locator("[data-motion-id]").count()).toBeGreaterThan(0);
    expect(await page.locator("[data-motion-id]").count()).toBeLessThan(16);
    await expect(
      page.getByRole("button", { name: "Spin", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  }
});

test("returning from a motion preserves the search and filter", async ({
  page,
}) => {
  await go(page, "/platform/animation");
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  await page.getByLabel("Search animations").fill("slow");
  await page.getByRole("link", { name: "Use Slow Spin", exact: true }).click();
  await expect(page.getByTestId("canvas").locator("canvas")).toBeVisible();
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Search animations")).toHaveValue("slow");
  await expect(
    page.getByRole("button", { name: "Spin", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-motion-id]")).toHaveCount(1);
});

test("save is unobtrusive; projects have previews, rename and safe deletion", async ({
  page,
}) => {
  await editor(page);
  await save(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(
      Object.entries(localStorage).find(([k]) =>
        k.startsWith("project:local:"),
      )![1],
    ),
  );
  expect(saved.name).toBe("Soft Orbit");
  expect(saved.thumbnail).toMatch(/^data:image\/webp;base64,/);
  await page.getByRole("button", { name: "My Projects", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Preview of Soft Orbit" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Rename Soft Orbit", exact: true })
    .click();
  await expect(page.getByLabel("Project name", { exact: true })).toBeFocused();
  await page.getByLabel("Project name", { exact: true }).fill("   ");
  await expect(page.getByRole("button", { name: "Save name" })).toBeDisabled();
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Launch / social");
  await page.getByLabel("Project name", { exact: true }).press("Enter");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const del = page.getByRole("button", {
    name: "Delete Launch / social",
    exact: true,
  });
  await del.click();
  await expect(page.getByRole("alertdialog")).toContainText("Launch / social");
  await expect(
    page.getByRole("button", { name: "Keep it", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(del).toBeFocused();
  await expect(page.locator("[data-project-id]")).toHaveCount(1);
  await page.getByLabel("Search projects").fill("missing");
  await expect(
    page.getByRole("heading", { name: "No projects found." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await del.click();
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A place for your next idea." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((k) => k.startsWith("project:local:")),
    ),
  ).toBe(false);
});

test("storage failure gives a recoverable save dialog without losing the editor", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("project:local:") && !(window as any).__allowSave)
        throw new DOMException("Quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await editor(page);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Your work is still open");
  await page.evaluate(() => {
    (window as any).__allowSave = true;
  });
  await dialog.getByRole("button", { name: "Try saving again" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Project saved", { exact: true })).toBeVisible();
});

test("motion dialog separates playback from selection and returns keyboard focus", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await editor(page);
  const trigger = page.getByRole("button", {
    name: "Add animation",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeInViewport();
  const card = dialog.locator('[data-motion-id="soft-orbit"]');
  await expect(card.locator("video")).toHaveJSProperty("paused", true);
  await card
    .getByRole("button", { name: "Play Soft Orbit", exact: true })
    .click();
  await expect
    .poll(() =>
      card.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeGreaterThan(0.1);
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Search animations").fill("nothing here");
  await expect(dialog.getByText("No matching motions.")).toBeVisible();
  await dialog.getByRole("button", { name: "Clear filters" }).click();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  const before = await page.locator(".track .animation").count();
  await dialog
    .getByRole("button", { name: "Add Soft Orbit", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(await page.locator(".track .animation").count()).toBeGreaterThan(
    before,
  );
});

test("newest saves sort first and unreadable entries do not hide valid projects", async ({
  page,
}) => {
  await editor(page);
  await save(page);
  await page.evaluate(() => {
    const saved = JSON.parse(
      Object.entries(localStorage).find(([k]) =>
        k.startsWith("project:local:"),
      )![1],
    );
    const entries = [
      { id: "older", name: "Alpha", savedAt: "2026-10-01T10:00:00Z" },
      { id: "newer", name: "Zebra", savedAt: "2026-10-02T10:00:00Z" },
    ];
    for (const key of Object.keys(localStorage))
      if (key.startsWith("project:local:")) localStorage.removeItem(key);
    for (const e of entries)
      localStorage.setItem(
        `project:local:${e.id}`,
        JSON.stringify({
          ...saved,
          id: e.id,
          name: e.name,
          _metadata: { savedAt: e.savedAt },
        }),
      );
    localStorage.setItem("project:local:unreadable", "{bad");
  });
  await go(page, "/platform/project");
  await expect(page.locator("[data-project-id]").first()).toHaveAttribute(
    "data-project-id",
    "newer",
  );
  await expect(
    page.getByText("1 saved project couldn't be read.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Sort by").selectOption("name");
  await expect(page.locator("[data-project-id]").first()).toHaveAttribute(
    "data-project-id",
    "older",
  );
});

test("missing projects offer working routes back to the library", async ({
  page,
}) => {
  await go(page, "/platform/project/does-not-exist");
  await expect(
    page.getByRole("heading", { name: "Project not found." }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Start a new one", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Find your next move." }),
  ).toBeVisible();
});

test("failed project deletion keeps the project and can be retried", async ({
  page,
}) => {
  await editor(page);
  await save(page);
  await page.getByRole("button", { name: "My Projects", exact: true }).click();
  await page.evaluate(() => {
    const remove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (key.startsWith("project:local:") && !(window as any).allowDelete) {
        throw new DOMException("Storage is unavailable", "SecurityError");
      }
      return remove.call(this, key);
    };
  });
  await page
    .getByRole("button", { name: "Delete Soft Orbit", exact: true })
    .click();
  const dialog = page.getByRole("alertdialog");
  await dialog
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        Object.keys(localStorage).filter((k) => k.startsWith("project:local:"))
          .length,
    ),
  ).toBe(1);
  await page.evaluate(() => {
    (window as any).allowDelete = true;
  });
  await dialog
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "A place for your next idea." }),
  ).toBeVisible();
});

test("clip removal and clearing the timeline require a deliberate choice", async ({
  page,
}) => {
  await editor(page);
  const clips = page.locator(".track .animation");
  const count = await clips.count();
  await clips.first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("button", { name: "Keep it" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(clips).toHaveCount(count);
  await clips.first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Remove animation", exact: true })
    .click();
  await expect(clips).toHaveCount(count - 1);
  const clear = page.getByTestId("timeline-tool-clear-timeline");
  await clear.click();
  await expect(dialog.getByRole("button", { name: "Keep it" })).toBeFocused();
  await dialog.getByRole("button", { name: "Keep it" }).click();
  await expect(clear).toBeFocused();
  await expect(clips).toHaveCount(count - 1);
  await clear.click();
  await dialog
    .getByRole("button", { name: "Clear timeline", exact: true })
    .click();
  await expect(clips).toHaveCount(0);
});

test("image export downloads a PNG and returns to the editor", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await editor(page);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download as image", exact: true })
    .click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  expect(await download.failure()).toBeNull();
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(bytes.length).toBeGreaterThan(5_000);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add animation", exact: true }),
  ).toBeVisible();
});

test("video export waits for the chosen format and completes a short image sequence", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await editor(page);
  await page.getByLabel("End time in seconds").fill("0.1");
  await page.getByLabel("End time in seconds").blur();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page
    .getByRole("button", { name: "Download as video", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Export video",
    exact: true,
  });
  await expect(
    dialog.getByText("Ready to export", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Pause export" }),
  ).toBeDisabled();
  await dialog.getByLabel("Select output format").click();
  await page
    .getByRole("option", { name: "Image sequence (ZIP of PNGs)" })
    .click();
  const downloading = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Export video", exact: true })
    .click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/-frames\.zip$/);
  expect(await download.failure()).toBeNull();
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 4).toString("hex")).toBe("504b0304");
  expect(bytes.length).toBeGreaterThan(5_000);
  await expect(
    dialog.getByText("Export finished.", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add animation", exact: true }),
  ).toBeVisible();
});

test("bulk video export fits the dialog and waits for format selection", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await editor(page);
  await page.getByLabel("End time in seconds").fill("0.02");
  await page.getByLabel("End time in seconds").blur();
  const compact = await page
    .getByRole("button", { name: "Edit scene", exact: true })
    .isVisible();
  if (compact) {
    await page.getByRole("button", { name: "Edit scene", exact: true }).click();
  }
  await page.getByRole("button", { name: "Bulk upload", exact: true }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 64;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#f3ede1";
    context.fillRect(0, 0, 32, 64);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByRole("region", { name: "Bulk upload", exact: true })
    .locator('input[type="file"][accept="image/*"]')
    .setInputFiles([
      {
        name: "screen-one.png",
        mimeType: "image/png",
        buffer: Buffer.from(png, "base64"),
      },
      {
        name: "screen-two.png",
        mimeType: "image/png",
        buffer: Buffer.from(png, "base64"),
      },
    ]);
  if (
    await page
      .getByRole("dialog", { name: "Scene inspector", exact: true })
      .isVisible()
  ) {
    await page
      .getByRole("dialog", { name: "Scene inspector", exact: true })
      .getByRole("button", { name: "Close", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Bulk Export", exact: true }).click();
  await page
    .getByRole("button", { name: "Bulk download videos", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Export video",
    exact: true,
  });
  await expect(
    dialog.getByText("Ready for bulk export", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Select file to preview")).toBeInViewport();
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await dialog.getByLabel("Select file to preview").click();
  await page.getByRole("option", { name: /screen-two\.png/ }).click();
  await expect(dialog.getByLabel("Select file to preview")).toContainText(
    "screen-two.png",
  );
  await dialog.getByLabel("Select output format").click();
  await page
    .getByRole("option", { name: "Image sequence (ZIP of PNGs)" })
    .click();
  const downloading = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export all", exact: true }).click();
  await expect(dialog.getByLabel("Select file to preview")).toBeDisabled();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/-videos\.zip$/);
  expect(await download.failure()).toBeNull();
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 4).toString("hex")).toBe("504b0304");
  await expect(
    dialog.getByText("Bulk export finished", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: compact ? "Bulk Export" : "Bulk download videos",
      exact: true,
    }),
  ).toBeFocused();
});
