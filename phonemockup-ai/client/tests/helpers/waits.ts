import {expect, type Page} from "@playwright/test";

/**
 * Waits for the app to be ready for timeline tests:
 * - Canvas <canvas> is present inside [data-testid="canvas"]
 * - Timeline has at least one animation in the first track
 */
export async function waitForAppReady(page: Page) {
    // 1) Canvas ready
    const canvasHost = page.getByTestId("canvas");
    await expect(canvasHost).toBeVisible({timeout: 30_000});
    await expect(canvasHost.locator("canvas")).toBeVisible({timeout: 30_000});

    // 2) At least one animation in the timeline track
    // Prefer a stable selector. If you can, add data-testid to animation items:
    // e.g., <div data-testid="animation-item">…</div>
    // Then replace the locator below with page.getByTestId("animation-item")
    await page.waitForFunction(() => {
        const timeline = document.querySelector('[data-testid="timeline"]');
        if (!timeline) return false;

        // Find the tracks container
        const tracksWrapper = timeline.querySelector(".track");
        if (!tracksWrapper) return false;

        // Heuristic: look for an element that represents an animation block.
        // If you add a data-testid, use that instead of this heuristic:
        const candidates = tracksWrapper.querySelectorAll(".animation");
        return candidates.length > 0;
    });
}