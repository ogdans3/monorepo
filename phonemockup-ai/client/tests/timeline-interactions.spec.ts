// tests/timeline-interactions.spec.ts
import {test, expect, type Page} from "@playwright/test";
import {
    goToTimeline,
    getFirstTrack,
    getAnimationRectanglesSortedByLeft,
    getAnimationRectangleAtSecond,
    clickToolAddCenterAnimation,
    clickToolClearTimelineWithConfirm,
    expectAnimationCount,
    setTimelineEndTimeSeconds,
    movePlayheadToSecond,
    getTimelinePixelsPerSecond,
    assertApproximatelyEqual,
} from "./helpers/timeline";

/**
 * Drag the "move" area of an animation by a given number of seconds.
 */
async function dragCenterOfAnimationBySeconds(
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

    const moveHandle = wrapper.getByRole("button", {
        name: "Click and drag to move",
        exact: true,
    });
    await expect(
        moveHandle,
        `Move handle not visible for animation index ${animationIndex}`
    ).toBeVisible();

    const handleBox = await moveHandle.boundingBox();
    if (!handleBox) {
        throw new Error(
            `Could not measure move handle for animation index ${animationIndex}`
        );
    }

    const pixelsPerSecond = await getTimelinePixelsPerSecond(page);
    const deltaPixels = deltaSeconds * pixelsPerSecond;

    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaPixels, startY, {steps: 12});
    await page.mouse.up();
}

/**
 * Drag the left resize handle by a given number of seconds.
 * Positive delta moves right (shortens); negative moves left (lengthens).
 */
async function dragLeftHandleOfAnimationBySeconds(
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

    const leftHandle = wrapper.locator(".marked-area-left");
    await expect(
        leftHandle,
        `Left resize handle not visible for animation index ${animationIndex}`
    ).toBeVisible();

    const handleBox = await leftHandle.boundingBox();
    if (!handleBox) {
        throw new Error(
            `Could not measure left handle for animation index ${animationIndex}`
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

/**
 * Drag the right resize handle by a given number of seconds.
 * Positive delta moves right (lengthens); negative moves left (shortens).
 */
async function dragRightHandleOfAnimationBySecondsLocal(
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

test.describe("Timeline: keyframes and animation interactions", () => {
    test("1) Clicking on the keyframe button selects a keyframe", async ({page}) => {
        await goToTimeline(page);
        await setTimelineEndTimeSeconds(page, 8);
        await clickToolClearTimelineWithConfirm(page);
        await expectAnimationCount(
            page,
            0,
            "After clearing, there were still animations present"
        );

        await movePlayheadToSecond(page, 2);
        await clickToolAddCenterAnimation(page);
        await expectAnimationCount(
            page,
            1,
            "After adding base animation at 2s, animation count was not 1"
        );

        // Locate the first animation's start and end keyframe buttons
        const track = getFirstTrack(page);

        const startButton = track.getByRole("button", {
            name: "Set start keyframe",
            exact: true,
        });
        const endButton = track.getByRole("button", {
            name: "Set end keyframe",
            exact: true,
        });

        await expect(
            startButton,
            "Start keyframe button not visible"
        ).toBeVisible();
        await expect(endButton, "End keyframe button not visible").toBeVisible();

        const startDot = startButton.locator("span").first();
        const endDot = endButton.locator("span").first();

        // Before click, start might not be selected
        await startButton.click();

        // Selected keyframe shows bg-white and ring-white
        await expect(
            startDot,
            "Start keyframe did not present selected styles after click"
        ).toHaveClass(/bg-white/);
        await expect(
            startDot,
            "Start keyframe did not present selected ring after click"
        ).toHaveClass(/ring-white/);

        // End keyframe should not be selected
        await expect(
            endDot,
            "End keyframe incorrectly presented selected styles"
        ).not.toHaveClass(/bg-white/);
    });

    test("2) Moving an animation in the timeline works", async ({page}) => {
        await goToTimeline(page);
        await setTimelineEndTimeSeconds(page, 10);
        await clickToolClearTimelineWithConfirm(page);
        await expectAnimationCount(
            page,
            0,
            "After clearing, there were still animations present"
        );

        await movePlayheadToSecond(page, 2);
        await clickToolAddCenterAnimation(page);
        await expectAnimationCount(
            page,
            1,
            "After adding base animation at 2s, animation count was not 1"
        );

        const pixelsPerSecond = await getTimelinePixelsPerSecond(page);

        const {rectangle: beforeRect, index} = await getAnimationRectangleAtSecond(page, 2);
        const moveBySeconds = 2;
        await dragCenterOfAnimationBySeconds(page, index, moveBySeconds);

        const after = await getAnimationRectangleAtSecond(page, 4);
        const movedByPixels = after.rectangle.leftPixels - beforeRect.leftPixels;
        const expectedMovePixels = moveBySeconds * pixelsPerSecond;

        assertApproximatelyEqual(
            movedByPixels,
            expectedMovePixels,
            14,
            "Animation did not move by the expected distance when dragged"
        );
    });

    test("3) Moving over another clips the moving animation, and does not change the other", async ({page}) => {
        await goToTimeline(page);
        await setTimelineEndTimeSeconds(page, 12);
        await clickToolClearTimelineWithConfirm(page);
        await expectAnimationCount(
            page,
            0,
            "After clearing, there were still animations present"
        );

        // Add A at 2s and B at 6s
        await movePlayheadToSecond(page, 2);
        await clickToolAddCenterAnimation(page);
        await movePlayheadToSecond(page, 6);
        await clickToolAddCenterAnimation(page);
        await expectAnimationCount(
            page,
            2,
            "After adding two animations, animation count was not 2"
        );

        const pixelsPerSecond = await getTimelinePixelsPerSecond(page);

        const {rectangle: rectA_before, index: indexA} =
            await getAnimationRectangleAtSecond(page, 2);
        const rectB_before = (
            await getAnimationRectangleAtSecond(page, 6)
        ).rectangle;

        // Move A right so it overlaps B: target start ≈ 5s
        await dragCenterOfAnimationBySeconds(page, indexA, +3);

        // After clipping, A should end at B's start (≈ 6s)
        const rectA_after = (
            await getAnimationRectangleAtSecond(page, 5.5)
        ).rectangle;
        const rectB_after = (
            await getAnimationRectangleAtSecond(page, 7)
        ).rectangle;

        // A's right equals B's left (clipped)
        assertApproximatelyEqual(
            rectA_after.rightPixels,
            rectB_after.leftPixels,
            4,
            "Moving animation was not clipped to the next animation's start"
        );

        // B unchanged (position and length)
        assertApproximatelyEqual(
            rectB_after.leftPixels,
            rectB_before.leftPixels,
            3,
            "Stationary animation's start changed after overlap clipping"
        );
        assertApproximatelyEqual(
            rectB_after.rightPixels,
            rectB_before.rightPixels,
            3,
            "Stationary animation's end changed after overlap clipping"
        );
    });

    test("4) Dragging animation sides changes the animation length", async ({page}) => {
        await goToTimeline(page);
        await setTimelineEndTimeSeconds(page, 8);
        await clickToolClearTimelineWithConfirm(page);
        await expectAnimationCount(
            page,
            0,
            "After clearing, there were still animations present"
        );

        await movePlayheadToSecond(page, 2);
        await clickToolAddCenterAnimation(page);
        await expectAnimationCount(
            page,
            1,
            "After adding base animation at 2s, animation count was not 1"
        );

        const pixelsPerSecond = await getTimelinePixelsPerSecond(page);
        const {rectangle: rectBefore, index} = await getAnimationRectangleAtSecond(page, 2.5);

        // 4a) Extend to the right by +1s
        await dragRightHandleOfAnimationBySecondsLocal(page, index, +1);

        const rectAfterRight = (
            await getAnimationRectangleAtSecond(page, 3)
        ).rectangle;
        const deltaWidthRight =
            rectAfterRight.widthPixels - rectBefore.widthPixels;

        assertApproximatelyEqual(
            deltaWidthRight,
            1 * pixelsPerSecond,
            14,
            "Dragging the right handle did not increase the animation length by ~1s"
        );

        // 4b) Shrink from the left by +0.5s (move handle right)
        const rectBeforeLeft = rectAfterRight;
        await dragLeftHandleOfAnimationBySeconds(page, index, +0.5);

        const rectAfterLeft = (
            await getAnimationRectangleAtSecond(page, 3.25)
        ).rectangle;
        const deltaWidthLeft =
            rectAfterLeft.widthPixels - rectBeforeLeft.widthPixels;

        assertApproximatelyEqual(
            deltaWidthLeft,
            -0.5 * pixelsPerSecond,
            6,
            "Dragging the left handle did not decrease the animation length by ~0.5s"
        );
    });
});