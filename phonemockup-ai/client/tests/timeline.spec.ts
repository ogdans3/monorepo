import {test, expect} from "@playwright/test";
import {waitForAppReady} from "./helpers/waits";
import {goToTimeline} from "./helpers/timeline";

test.describe("Timeline: render and basics", () => {
    test("timeline renders and app is ready", async ({page}) => {
        await goToTimeline(page);
    });

    test("play/pause button present", async ({page}) => {
        await goToTimeline(page);
        await expect(page.getByRole("button", {name: /play|pause/i})).toBeVisible();
    });

    test("start time input exists", async ({page}) => {
        await goToTimeline(page);
        await expect(page.getByLabel("Start time in seconds")).toBeVisible();
    });

    test("end time input exists", async ({page}) => {
        await goToTimeline(page);
        await expect(page.getByLabel("End time in seconds")).toBeVisible();
    });
});

test.describe("Timeline: tracks and animations", () => {
    test("at least one track is rendered", async ({page}) => {
        await goToTimeline(page);
        const tracksWrapper = page
            .getByTestId("timeline")
            .locator(".pt-2.w-full.flex > .w-full");
        await expect(tracksWrapper).toBeVisible();
    });

    test("at least one animation exists", async ({page}) => {
        await goToTimeline(page);
        // If you add data-testid="animation-item" to each animation block,
        // change the locator to getByTestId("animation-item")
        const animations = page
            .getByTestId("timeline")
            .locator(
                '[data-testid="animation-item"], .animation, [data-animation], [class*="animation"]'
            );
        await expect(animations.first()).toBeVisible();
    });
});

test.describe("Timeline: interactions (basic)", () => {
    test("play toggles to pause", async ({page}) => {
        await goToTimeline(page);
        const play = page.getByRole("button", {name: /^play$/i});
        if (await play.isVisible().catch(() => false)) {
            await play.click();
            await expect(page.getByRole("button", {name: /^pause$/i})).toBeVisible();
        } else {
            // already playing
            await page.getByRole("button", {name: /^pause$/i}).click();
            await expect(play).toBeVisible();
        }
    });
});