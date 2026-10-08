import {test, expect} from "@playwright/test";
import {goToTimeline} from "./helpers/timeline";

test.describe("Layout smoke", () => {
    test("renders Sidebar, Canvas, and Timeline", async ({page}) => {
        await goToTimeline(page);

        const sidebar = page.getByTestId("sidebar");
        const canvas = page.getByTestId("canvas");
        const timeline = page.getByTestId("timeline");

        await expect(sidebar).toBeVisible();
        await expect(canvas).toBeVisible();
        await expect(timeline).toBeVisible();
    });

    test("Space key is handled (prevent default scrolling)", async ({page}) => {
        await goToTimeline(page);

        // Record initial scroll position
        const start = await page.evaluate(() => ({
            x: window.scrollX,
            y: window.scrollY,
        }));

        await page.keyboard.press("Space");

        // Wait a tick to allow any handler to run
        await page.waitForTimeout(50);

        const end = await page.evaluate(() => ({
            x: window.scrollX,
            y: window.scrollY,
        }));

        // If Space was prevented, the page shouldn't scroll
        expect(end.y).toBe(start.y);
        expect(end.x).toBe(start.x);
    });
});