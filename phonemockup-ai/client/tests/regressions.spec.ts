// tests/regressions.spec.ts
// One test per bug that a full test pass found, so each stays fixed.
import {test, expect, type Page} from "@playwright/test";
import {
    goToTimeline,
    getAnimationRectanglesSortedByLeft,
    clickToolAddCenterAnimation,
    clickToolClearTimelineWithConfirm,
    expectAnimationCount,
    setTimelineEndTimeSeconds,
    movePlayheadToSecond,
} from "./helpers/timeline";
import {waitForAppReady} from "./helpers/waits";

function playButton(page: Page) {
    return page.getByTestId("timeline").getByRole("button", {name: /^(Play|Pause)$/});
}

async function clipNames(page: Page): Promise<string[]> {
    const names = await page.getByTestId("timeline").locator(".track .animation").allInnerTexts();
    return names.map((n) => n.trim());
}

/** The colour at the middle of the editor's canvas, where the phone's screen is. */
async function canvasCentre(page: Page): Promise<number[]> {
    return page.evaluate(() => {
        const source = document.querySelector('[data-testid="canvas"] canvas') as HTMLCanvasElement;
        // Read through a 2D copy: reading the WebGL canvas directly can come back empty.
        const copy = document.createElement("canvas");
        copy.width = source.width;
        copy.height = source.height;
        const ctx = copy.getContext("2d")!;
        ctx.drawImage(source, 0, 0);
        const d = ctx.getImageData(Math.floor(copy.width / 2), Math.floor(copy.height / 2), 1, 1).data;
        return [d[0], d[1], d[2]];
    });
}

/** Put a plain white picture on the phone's screen through the Model panel. */
async function pickWhiteScreenImage(page: Page) {
    await openInspector(page);
    await page.getByRole("button", {name: "Model", exact: true}).click();
    const white = await page.evaluate(() => {
        const c = document.createElement("canvas");
        c.width = 90;
        c.height = 200;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);
        return c.toDataURL("image/png").split(",")[1];
    });
    await page.locator("#asset-file").setInputFiles({
        name: "white.png",
        mimeType: "image/png",
        buffer: Buffer.from(white, "base64"),
    });
}

async function openProjectSettings(page: Page) {
    await openInspector(page);
    const name = page.getByLabel("Project name");
    if (!(await name.isVisible())) {
        await page.getByRole("button", {name: "Project Settings"}).click();
    }
    await expect(name).toBeVisible();
    return name;
}

async function openInspector(page: Page) {
    const drawer = page.getByRole("dialog", {name: "Scene inspector", exact: true});
    const trigger = page.getByRole("button", {name: "Edit scene", exact: true});
    if (await trigger.isVisible() && !(await drawer.isVisible())) await trigger.click();
}

test.describe("Regressions", () => {
    test("a space typed in a text field is typed, and doesn't toggle playback", async ({page}) => {
        await goToTimeline(page);
        const name = await openProjectSettings(page);
        await name.fill("");
        await name.pressSequentially("My demo project");
        await expect(name).toHaveValue("My demo project");
        const drawer = page.getByRole("dialog", {name: "Scene inspector", exact: true});
        if (await drawer.isVisible()) await drawer.getByRole("button", {name: "Close", exact: true}).click();
        await expect(playButton(page)).toHaveAttribute("aria-label", "Play");
    });

    test("Space toggles playback once after the editor is opened a second time", async ({page}) => {
        await goToTimeline(page);
        // Leave and come back through the app's own links, which keeps the
        // page (and anything the first editor left behind) alive.
        await page.getByRole("button", {name: "My Projects"}).click();
        await expect(page).toHaveURL(/\/platform\/project$/);
        await page.getByRole("link", {name: "New project", exact: true}).click();
        await expect(page).toHaveURL(/\/platform\/animation$/);
        await page.locator('a[href="/platform/animation/still"]').first().click();
        await waitForAppReady(page);

        await page.getByTestId("timeline-ruler").click({position: {x: 5, y: 5}});
        await page.keyboard.press("Space");
        await expect(playButton(page)).toHaveAttribute("aria-label", "Pause");
        await page.keyboard.press("Space");
        await expect(playButton(page)).toHaveAttribute("aria-label", "Play");
    });

    test("the add-animation dialog opens again after Cancel", async ({page}) => {
        await goToTimeline(page);
        for (let attempt = 0; attempt < 2; attempt++) {
            await page.getByRole("button", {name: "Add animation", exact: true}).click();
            const dialog = page.getByRole("dialog");
            await expect(dialog).toBeVisible();
            await dialog.getByRole("button", {name: "Cancel"}).click();
            await expect(dialog).toHaveCount(0);
        }
    });

    test("an unknown animation id opens the default animation", async ({page}) => {
        await page.goto("/platform/animation/does-not-exist");
        await waitForAppReady(page);
        expect(await clipNames(page)).toEqual(["Still"]);
    });

    test("an unknown project shows a not-found page", async ({page}) => {
        await page.goto("/platform/project/does-not-exist");
        await expect(page.getByRole("heading", {name: "Project not found"})).toBeVisible();
    });

    test("picking a second preset from the gallery opens that preset", async ({page}) => {
        await page.goto("/platform/animation");
        await page.locator('a[href="/platform/animation/snap-in"]').first().click();
        await waitForAppReady(page);
        const first = await clipNames(page);

        await page.goBack();
        await page.locator('a[href="/platform/animation/soft-orbit"]').first().click();
        await expect(page).toHaveURL(/soft-orbit/);
        await expect.poll(() => clipNames(page)).not.toEqual(first);
    });

    test("playing and scrubbing an empty timeline throws nothing", async ({page}) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await goToTimeline(page);
        await clickToolClearTimelineWithConfirm(page);
        await expectAnimationCount(page, 0, "Timeline was not cleared");

        await playButton(page).click();
        await page.waitForTimeout(1000);
        await playButton(page).click();
        await page.getByTestId("timeline-ruler").click({position: {x: 40, y: 5}});
        expect(errors).toEqual([]);
    });

    test("a clip added inside a chain pushes every later clip, leaving no overlaps", async ({page}) => {
        await goToTimeline(page);
        await setTimelineEndTimeSeconds(page, 12);
        await clickToolClearTimelineWithConfirm(page);

        // A [1,3], B [3.5,5.5], C [5.5,7.5]
        for (const second of [1, 3.5, 5.5]) {
            await movePlayheadToSecond(page, second);
            await clickToolAddCenterAnimation(page);
        }
        await expectAnimationCount(page, 3, "Setup did not create three clips");

        // Adding inside A inserts at A's end and has to push B and then C.
        await movePlayheadToSecond(page, 2);
        await clickToolAddCenterAnimation(page);
        await expectAnimationCount(page, 4, "The fourth clip was not added");

        const rectangles = await getAnimationRectanglesSortedByLeft(page);
        for (let i = 1; i < rectangles.length; i++) {
            expect(
                rectangles[i].leftPixels,
                `clip ${i + 1} overlaps the clip before it`
            ).toBeGreaterThanOrEqual(rectangles[i - 1].rightPixels - 2);
        }
    });

    test("an image picked in the Model panel shows on the screen", async ({page}) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await goToTimeline(page);
        await pickWhiteScreenImage(page);
        await expect.poll(async () => Math.min(...(await canvasCentre(page)))).toBeGreaterThan(200);
        expect(errors).toEqual([]);
    });

    test("a case colour leaves the picture on the screen untinted", async ({page}) => {
        const spread = (rgb: number[]) => Math.max(...rgb) - Math.min(...rgb);

        // Case colors must leave the separate display material untinted.
        await goToTimeline(page);
        await pickWhiteScreenImage(page);
        await expect.poll(async () => Math.min(...(await canvasCentre(page)))).toBeGreaterThan(200);

        await page.getByLabel("Case color").fill("#ff0000");
        await page.waitForTimeout(1000);
        const iphone = await canvasCentre(page);
        expect(spread(iphone), `iPhone screen tinted to ${iphone}`).toBeLessThan(25);

        // The same choice carries across to the current Pixel model.
        await page.locator("#model-type").click();
        await page.getByRole("option", {name: "Google Pixel 9 Pro", exact: true}).click();
        await expect(page.locator("#model-type")).toContainText("Pixel 9 Pro");
        await page.waitForTimeout(1000);
        const glass = await canvasCentre(page);
        expect(spread(glass), `Pixel 9 Pro's screen tinted to ${glass}`).toBeLessThan(25);
    });

    test("a renamed project keeps its name after saving and reloading", async ({page}) => {
        await goToTimeline(page);
        const name = await openProjectSettings(page);
        await name.fill("Regression name");
        const drawer = page.getByRole("dialog", {name: "Scene inspector", exact: true});
        if (await drawer.isVisible()) await drawer.getByRole("button", {name: "Close", exact: true}).click();
        await page.getByRole("button", {name: "Save", exact: true}).click();
        await expect(page).toHaveURL(/\/platform\/project\//);

        await page.reload();
        await waitForAppReady(page);
        await expect(await openProjectSettings(page)).toHaveValue("Regression name");
    });
});
