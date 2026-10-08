// tests/helpers/timeline.ts
import {expect, type Locator, type Page} from "@playwright/test";
import {waitForAppReady} from "../helpers/waits";

export type AnimationRectangle = {
    leftPixels: number;
    rightPixels: number;
    widthPixels: number;
};

export async function goToTimeline(page: Page) {
    await page.goto("/platform/animation/still");
    // The editor renders in the browser only, so on a cold dev server the
    // timeline appears once its JavaScript has compiled and run.
    await expect(
        page.getByTestId("timeline"),
        "Timeline root did not become visible"
    ).toBeVisible({timeout: 30_000});
    await waitForAppReady(page);
}

export function getTimelineRoot(page: Page): Locator {
    return page.getByTestId("timeline");
}

export function getFirstTrack(page: Page): Locator {
    return getTimelineRoot(page).locator(".track").first();
}

export function getTimelineInteractiveArea(page: Page): Locator {
    return getTimelineRoot(page)
        .getByTestId("timeline-ruler")
        .first();
}

export async function getTrackBoundingBox(page: Page) {
    const track = getFirstTrack(page);
    const box = await track.boundingBox();
    if (!box) throw new Error("Track bounding box could not be measured");
    return box;
}

export function getStartTimeInput(page: Page): Locator {
    return page.getByLabel("Start time in seconds");
}

export function getEndTimeInput(page: Page): Locator {
    return page.getByLabel("End time in seconds");
}

export async function setTimelineEndTimeSeconds(
    page: Page,
    seconds: number
): Promise<void> {
    const endInput = getEndTimeInput(page);
    await endInput.click();
    await endInput.fill(String(seconds));
    await endInput.blur();
    const expected = seconds.toFixed(2);
    await expect(
        endInput,
        `End time input did not reflect ${expected} seconds`
    ).toHaveValue(expected);
}

export async function getTimelineEndTimeSeconds(page: Page): Promise<number> {
    const endInput = getEndTimeInput(page);
    const raw = await endInput.inputValue();
    const value = parseFloat(raw);
    if (Number.isNaN(value)) {
        throw new Error(`End time input had a non-numeric value: "${raw}"`);
    }
    return value;
}

export async function getTimelineStartTimeSeconds(): Promise<number> {
    return 0;
}

// Prefer ruler width if present to compute pixels-per-second
export async function getTimelinePixelsPerSecond(
    page: Page
): Promise<number> {
    const endSeconds = await getTimelineEndTimeSeconds(page);
    const startSeconds = await getTimelineStartTimeSeconds();
    const durationSeconds = endSeconds - startSeconds;
    if (durationSeconds <= 0) throw new Error("Timeline duration is not positive");

    const ruler = page.getByTestId("timeline-ruler");
    const hasRuler = (await ruler.count()) > 0;

    if (hasRuler) {
        await expect(ruler, "Timeline ruler not visible").toBeVisible();
        const width = await ruler.evaluate(
            (el) => (el as HTMLElement).getBoundingClientRect().width
        );
        return width / durationSeconds;
    }

    // Fallback to track width if no ruler test id exists
    const trackBox = await getTrackBoundingBox(page);
    return trackBox.width / durationSeconds;
}

export async function movePlayheadToFractionOfTimelineWidth(
    page: Page,
    fraction: number
) {
    const area = getTimelineInteractiveArea(page);
    const box = await area.boundingBox();
    if (!box) throw new Error("Timeline interactive area not found");
    const clamped = Math.max(0, Math.min(1, fraction));
    const x = box.x + clamped * box.width;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();
}

export async function movePlayheadToSecond(page: Page, second: number) {
    const startSeconds = await getTimelineStartTimeSeconds();
    const endSeconds = await getTimelineEndTimeSeconds(page);
    const duration = endSeconds - startSeconds;
    if (second < startSeconds || second > endSeconds) {
        throw new Error(
            `Requested playhead second ${second} is outside [${startSeconds}, ${endSeconds}]`
        );
    }
    const fraction = (second - startSeconds) / duration;
    await movePlayheadToFractionOfTimelineWidth(page, fraction);
}

/* Tool buttons by data-testid */
export async function clickToolAddCenterAnimation(page: Page) {
    const button = page.getByTestId("timeline-tool-add-center-animation");
    await expect(button, "Add center animation tool not visible").toBeVisible();
    await button.click();
}

export async function clickToolToggleSnapping(page: Page) {
    const button = page.getByTestId("timeline-tool-toggle-snapping");
    await expect(button, "Toggle snapping tool not visible").toBeVisible();
    await button.click();
}

export async function clickToolSnugTimeline(page: Page) {
    const button = page.getByTestId("timeline-tool-snug-timeline");
    await expect(button, "Snug timeline tool not visible").toBeVisible();
    await button.click();
}

export async function clickToolClearTimelineWithConfirm(page: Page) {
    const button = page.getByTestId("timeline-tool-clear-timeline");
    await expect(button, "Clear timeline tool not visible").toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await button.click();
}

export async function getAnimationCount(page: Page): Promise<number> {
    return await getFirstTrack(page).locator(".animation").count();
}

export async function expectAnimationCount(
    page: Page,
    expectedCount: number,
    message: string
) {
    const actual = await getAnimationCount(page);
    if (actual !== expectedCount) {
        throw new Error(
            `${message}. Expected ${expectedCount} animations, got ${actual}.`
        );
    }
}

export async function getAnimationRectanglesSortedByLeft(
    page: Page
): Promise<AnimationRectangle[]> {
    const track = getFirstTrack(page);
    await expect(track, "Track container is not visible").toBeVisible();

    return await track.evaluate((trackElement) => {
        const wrappers = Array.from(
            trackElement.querySelectorAll<HTMLElement>(":scope > div.absolute")
        );
        const trackRect = trackElement.getBoundingClientRect();
        return wrappers
            .map((element) => {
                const r = element.getBoundingClientRect();
                const leftPixels = r.left - trackRect.left;
                const widthPixels = r.width;
                return {
                    leftPixels,
                    widthPixels,
                    rightPixels: leftPixels + widthPixels,
                };
            })
            .sort((a, b) => a.leftPixels - b.leftPixels);
    });
}

export async function getAnimationRectangleByName(
    page: Page,
    name: string
): Promise<AnimationRectangle> {
    const track = getFirstTrack(page);
    const target = track.locator(".animation", {hasText: name}).last();
    await expect(target, `Animation "${name}" not visible`).toBeVisible();

    const [trackBox, elementBox] = await Promise.all([
        track.boundingBox(),
        target.boundingBox(),
    ]);
    if (!trackBox || !elementBox) {
        throw new Error(`Failed to measure animation "${name}"`);
    }

    const leftPixels = elementBox.x - trackBox.x;
    const widthPixels = elementBox.width;
    return {
        leftPixels,
        widthPixels,
        rightPixels: leftPixels + widthPixels,
    };
}

export async function findAnimationRectangleClosestToSecond(
    page: Page,
    second: number
): Promise<{ rectangle: AnimationRectangle; index: number }> {
    const rectangles = await getAnimationRectanglesSortedByLeft(page);
    const pixelsPerSecond = await getTimelinePixelsPerSecond(page);
    const expectedLeft = second * pixelsPerSecond;

    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    rectangles.forEach((rect, index) => {
        const distance = Math.abs(rect.leftPixels - expectedLeft);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
        }
    });

    return {rectangle: rectangles[bestIndex], index: bestIndex};
}

// NEW: fetch the animation that covers a given second on the timeline
export async function getAnimationRectangleAtSecond(
    page: Page,
    second: number,
    options?: { toleranceSeconds?: number }
): Promise<{ rectangle: AnimationRectangle; index: number }> {
    const toleranceSeconds = options?.toleranceSeconds ?? 0.2;

    const rectangles = await getAnimationRectanglesSortedByLeft(page);
    const pixelsPerSecond = await getTimelinePixelsPerSecond(page);

    const targetX = second * pixelsPerSecond;
    const tolerancePixels = toleranceSeconds * pixelsPerSecond;

    // Prefer the animation whose span contains the second (with tolerance)
    let bestIndex = -1;
    for (let i = 0; i < rectangles.length; i++) {
        const r = rectangles[i];
        if (
            targetX >= r.leftPixels - tolerancePixels &&
            targetX <= r.rightPixels + tolerancePixels
        ) {
            bestIndex = i;
            break;
        }
    }

    // Fallback: choose the animation with the nearest span to targetX
    if (bestIndex === -1) {
        let bestDistance = Number.POSITIVE_INFINITY;
        rectangles.forEach((r, i) => {
            const clamped =
                targetX < r.leftPixels
                    ? r.leftPixels
                    : targetX > r.rightPixels
                        ? r.rightPixels
                        : targetX;
            const distance = Math.abs(clamped - targetX);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = i;
            }
        });
    }

    return {rectangle: rectangles[bestIndex], index: bestIndex};
}

export async function dragRightHandleOfAnimationBySeconds(
    page: Page,
    animationIndex: number,
    deltaSeconds: number
) {
    const track = getFirstTrack(page);
    const wrapper = track.locator(":scope > div.absolute").nth(animationIndex);
    await expect(
        wrapper,
        `Animation wrapper at index ${animationIndex} not visible`
    ).toBeVisible();

    const rightHandle = wrapper.locator(".marked-area-right");
    await expect(
        rightHandle,
        `Right resize handle not visible for animation index ${animationIndex}`
    ).toBeVisible();

    const handleBox = await rightHandle.boundingBox();
    if (!handleBox) {
        throw new Error(
            `Could not measure right handle for animation index ${animationIndex}`
        );
    }

    const pixelsPerSecond = await getTimelinePixelsPerSecond(page);
    const deltaPixels = deltaSeconds * pixelsPerSecond;

    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaPixels, startY, {steps: 10});
    await page.mouse.up();
}

export function assertApproximatelyEqual(
    actual: number,
    expected: number,
    tolerance: number,
    message: string
) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(
            `${message}. Expected ≈ ${expected} ±${tolerance}, got ${actual}.`
        );
    }
}