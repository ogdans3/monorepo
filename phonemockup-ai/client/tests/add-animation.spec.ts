// tests/timeline-additions.spec.ts
import {test} from "@playwright/test";
import {
    goToTimeline,
    getFirstTrack,
    getTrackBoundingBox,
    getAnimationRectanglesSortedByLeft,
    getAnimationRectangleByName,
    clickToolAddCenterAnimation,
    clickToolClearTimelineWithConfirm,
    clickToolSnugTimeline,
    expectAnimationCount,
    findAnimationRectangleClosestToSecond,
    dragRightHandleOfAnimationBySeconds,
    setTimelineEndTimeSeconds,
    movePlayheadToFractionOfTimelineWidth,
    movePlayheadToSecond,
    getTimelinePixelsPerSecond,
    assertApproximatelyEqual, getAnimationRectangleAtSecond,
} from "./helpers/timeline";

test.describe("Timeline: adding and manipulating animations", () => {
    test("1) Add animation; verify it appends to the end of the chain", async ({page}) => {
        await goToTimeline(page);
        await setTimelineEndTimeSeconds(page, 10);

        const before = await getAnimationRectanglesSortedByLeft(page);
        if (before.length === 0) {
            throw new Error(
                "Expected at least one existing animation before appending"
            );
        }

        const lastBefore = before.reduce((a, b) =>
            a.rightPixels > b.rightPixels ? a : b
        );

        const trackBox = await getTrackBoundingBox(page);
        const clickXInPixels = lastBefore.rightPixels;
        const fraction = clickXInPixels / trackBox.width;
        await movePlayheadToFractionOfTimelineWidth(page, fraction);

        const countBefore = before.length;
        await clickToolAddCenterAnimation(page);
        await expectAnimationCount(
            page,
            countBefore + 1,
            "After appending, animation count did not increase by 1"
        );

        const added = await getAnimationRectangleByName(page, "Back to center");

        const tolerancePixels = 2;
        assertApproximatelyEqual(
            added.leftPixels,
            lastBefore.rightPixels,
            tolerancePixels,
            "Appended animation did not start exactly at previous chain end"
        );
    });

    test("2) Set end to 10s; move playhead to middle; add animation; start equals playhead",
        async ({page}) => {
            await goToTimeline(page);
            await setTimelineEndTimeSeconds(page, 10);

            const trackBox = await getTrackBoundingBox(page);
            await movePlayheadToFractionOfTimelineWidth(page, 0.5);

            const countBefore = await getFirstTrack(page)
                .locator(".animation")
                .count();
            await clickToolAddCenterAnimation(page);
            await expectAnimationCount(
                page,
                countBefore + 1,
                "Adding at timeline middle did not increase animation count by 1"
            );

            const added = await getAnimationRectangleByName(page, "Back to center");
            const expectedLeftPixels = trackBox.width / 2;

            const tolerancePixels = 3;
            assertApproximatelyEqual(
                added.leftPixels,
                expectedLeftPixels,
                tolerancePixels,
                "Newly added animation did not start at playhead (middle)"
            );
        }
    );

    test("3) Add at end, then 7s (to 9s), then 8s; 8s lands between", async ({page}) => {
        await goToTimeline(page);
        await setTimelineEndTimeSeconds(page, 12);

        await clickToolClearTimelineWithConfirm(page);
        await expectAnimationCount(
            page,
            0,
            "After clearing timeline, there were still animations present"
        );

        // Add near timeline end (should clamp to end and effectively start at ~10s)
        await movePlayheadToFractionOfTimelineWidth(page, 0.99);
        await clickToolAddCenterAnimation(page);
        await expectAnimationCount(
            page,
            1,
            "After adding near end, animation count was not 1"
        );

        // Add at 7s
        await movePlayheadToSecond(page, 7);
        await clickToolAddCenterAnimation(page);
        await expectAnimationCount(
            page,
            2,
            "After adding at 7s, animation count was not 2"
        );

        // Fetch the animation that covers 7 seconds
        const pixelsPerSecond = await getTimelinePixelsPerSecond(page);
        const {rectangle: animationAtSeven} = await getAnimationRectangleAtSecond(
            page,
            7
        );

        // Validate it approximately spans 7s..9s (2 seconds long)
        const expectedLeftSevenPixels = 7 * pixelsPerSecond;
        const expectedRightNinePixels = 9 * pixelsPerSecond;

        assertApproximatelyEqual(
            animationAtSeven.leftPixels,
            expectedLeftSevenPixels,
            12,
            "Animation added at 7s did not start near 7s"
        );
        assertApproximatelyEqual(
            animationAtSeven.rightPixels,
            expectedRightNinePixels,
            14,
            "Animation added at 7s did not end near 9s"
        );

        // Add at 8s and fetch the animations at 8s and 10s
        await movePlayheadToSecond(page, 8);
        await clickToolAddCenterAnimation(page);
        await expectAnimationCount(
            page,
            3,
            "After adding at 8s, animation count was not 3"
        );

        const {rectangle: animationAtNine} = await getAnimationRectangleAtSecond(
            page,
            9.5
        );
        const {rectangle: animationAtTwelve} = await getAnimationRectangleAtSecond(
            page,
            12
        );

        // Ordering: 7s < 8s < ~10s
        if (!(animationAtSeven.leftPixels < animationAtNine.leftPixels)) {
            throw new Error(
                "Ordering incorrect: animation at 7s was not to the left of animation at 9s"
            );
        }
        if (!(animationAtNine.leftPixels < animationAtTwelve.leftPixels)) {
            throw new Error(
                "Ordering incorrect: animation at 8s was not to the left of the animation near 12s"
            );
        }

        // Sanity: 8s animation starts near 8s
        assertApproximatelyEqual(
            animationAtNine.leftPixels,
            9 * pixelsPerSecond,
            12,
            "Animation added at 9s did not start near 9s"
        );
    });

    test("4) Adding at 0s should start at time zero", async ({page}) => {
        await goToTimeline(page);
        await setTimelineEndTimeSeconds(page, 6);

        await clickToolClearTimelineWithConfirm(page);
        await expectAnimationCount(
            page,
            0,
            "After clearing timeline, there were still animations present"
        );

        await movePlayheadToSecond(page, 0);
        await clickToolAddCenterAnimation(page);
        await expectAnimationCount(
            page,
            1,
            "After adding at 0s, animation count was not 1"
        );

        const first = (await getAnimationRectanglesSortedByLeft(page))[0];
        const tolerancePixels = 2;
        assertApproximatelyEqual(
            first.leftPixels,
            0,
            tolerancePixels,
            "Animation added at 0s did not start at the very left edge"
        );
    });

    test("5) Resizing right edge cannot exceed timeline end boundary", async ({page}) => {
        await goToTimeline(page);
        await setTimelineEndTimeSeconds(page, 6);

        await clickToolClearTimelineWithConfirm(page);
        await expectAnimationCount(
            page,
            0,
            "After clearing timeline, there were still animations present"
        );

        await movePlayheadToSecond(page, 1);
        await clickToolAddCenterAnimation(page);
        await expectAnimationCount(
            page,
            1,
            "After adding base animation at 1s, animation count was not 1"
        );

        const {index} = await findAnimationRectangleClosestToSecond(page, 1);
        await dragRightHandleOfAnimationBySeconds(page, index, +10);

        const trackBox = await getTrackBoundingBox(page);
        const rectangles = await getAnimationRectanglesSortedByLeft(page);
        const resized = rectangles[index];

        const tolerancePixels = 3;
        assertApproximatelyEqual(
            resized.rightPixels,
            trackBox.width,
            tolerancePixels,
            "Resized animation right edge exceeded the timeline end boundary"
        );
    });

    test("6) Snug timeline moves earliest animation to start at 0s", async ({page}) => {
        await goToTimeline(page);
        await setTimelineEndTimeSeconds(page, 12);

        await clickToolClearTimelineWithConfirm(page);
        await expectAnimationCount(
            page,
            0,
            "After clearing timeline, there were still animations present"
        );

        await movePlayheadToSecond(page, 2);
        await clickToolAddCenterAnimation(page);
        await movePlayheadToSecond(page, 8);
        await clickToolAddCenterAnimation(page);
        await expectAnimationCount(
            page,
            2,
            "After adding two animations, animation count was not 2"
        );

        await clickToolSnugTimeline(page);

        const earliestAfterSnug =
            (await getAnimationRectanglesSortedByLeft(page))[0];

        const tolerancePixels = 2;
        assertApproximatelyEqual(
            earliestAfterSnug.leftPixels,
            0,
            tolerancePixels,
            "After snugging the timeline, the earliest animation did not start at 0s"
        );
    });
});