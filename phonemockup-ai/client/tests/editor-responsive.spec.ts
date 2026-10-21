import {test, expect} from '@playwright/test';

for (const width of [360, 390, 768, 1024, 1440]) {
    test(`editor fits ${width}px and keeps the canvas and transport reachable`, async ({page}) => {
        await page.setViewportSize({width, height: 844});
        await page.goto('/platform/animation/soft-orbit');
        await expect(page.getByTestId('canvas').locator('canvas')).toBeVisible();
        const geometry = await page.evaluate(() => {
            const canvas = document.querySelector('[data-testid="canvas"] canvas')!.getBoundingClientRect();
            const timeline = document.querySelector('[data-testid="timeline"]')!.getBoundingClientRect();
            return {overflow: document.documentElement.scrollWidth > innerWidth, canvasHeight: canvas.height, bottom: timeline.bottom, height: innerHeight};
        });
        expect(geometry.overflow).toBe(false);
        expect(geometry.canvasHeight).toBeGreaterThan(200);
        expect(geometry.bottom).toBeLessThanOrEqual(geometry.height + 1);
        await expect(page.getByRole('button', {name: 'Play', exact: true})).toBeInViewport();
        if (width <= 900) {
            await expect(page.getByTestId('sidebar')).not.toBeVisible();
            await page.getByRole('button', {name: 'Edit scene'}).click();
            await expect(page.getByRole('dialog')).toBeInViewport();
            await page.getByRole('button', {name: 'Model', exact: true}).click();
            await expect(page.getByRole('checkbox', {name: 'Show logo', exact: true})).toBeInViewport();
            await page.keyboard.press('Escape');
            await expect(page.getByRole('dialog')).not.toBeVisible();
            await expect(page.getByRole('button', {name: 'Edit scene'})).toBeFocused();
        }
    });
}

test.describe('touch editing', () => {
    test.use({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
    test('drawer retains changes, supports device menus and opens export directly', async ({page}) => {
        const errors: string[] = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto('/platform/animation/soft-orbit');
        await expect(page.getByTestId('canvas').locator('canvas')).toBeVisible();
        await page.getByRole('button', {name: 'Edit scene'}).tap();
        await page.getByRole('button', {name: 'Model', exact: true}).tap();
        await page.getByRole('checkbox', {name: 'Show logo', exact: true}).uncheck();
        await page.getByLabel('Select 3D model').tap();
        await page.getByRole('option', {name: /Pixel 9 Pro/}).tap();
        await expect(page.getByLabel('Select 3D model')).toContainText('Pixel 9 Pro');
        await page.getByRole('button', {name: 'Close', exact: true}).tap();
        await page.getByRole('button', {name: 'Edit scene'}).tap();
        await expect(page.getByRole('checkbox', {name: 'Show logo', exact: true})).not.toBeChecked();
        await page.getByRole('button', {name: 'Close', exact: true}).tap();
        await page.getByRole('button', {name: 'Export', exact: true}).tap();
        await expect(page.getByRole('button', {name: 'Download as image', exact: true})).toBeInViewport();
        await expect(page.getByRole('button', {name: 'Download as video', exact: true})).toBeInViewport();
        await page.getByRole('button', {name: 'Close', exact: true}).tap();
        expect(errors).toEqual([]);
    });
    test('touch scrubbing, playback and the motion chooser work without losing canvas space', async ({page}) => {
        await page.goto('/platform/animation/soft-orbit');
        await expect(page.getByTestId('canvas').locator('canvas')).toBeVisible();
        const ruler = await page.getByTestId('timeline-ruler').boundingBox();
        await page.touchscreen.tap(ruler!.x + ruler!.width / 2, ruler!.y + 5);
        await expect(page.getByLabel('Playhead time in seconds')).toHaveValue('3.00');
        await page.getByRole('button', {name: 'Play', exact: true}).tap();
        await expect(page.getByRole('button', {name: 'Pause', exact: true})).toBeVisible();
        await expect.poll(async () => Number(await page.getByLabel('Playhead time in seconds').inputValue())).toBeGreaterThan(3.1);
        await page.getByRole('button', {name: 'Pause', exact: true}).tap();
        await page.getByRole('button', {name: 'Add animation', exact: true}).tap();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeInViewport();
        await dialog.getByRole('button', {name: 'Spin', exact: true}).tap();
        await expect(dialog.locator('.studio-motion-card').first()).toBeInViewport();
        await dialog.locator('.studio-motion-card').first().tap();
        await expect(dialog).not.toBeVisible();
        expect(await page.locator('.track .animation').count()).toBeGreaterThan(2);
    });
});


test('Space activates a focused setting and keyframes reveal their transform controls', async ({page}) => {
    await page.setViewportSize({width: 1440, height: 900});
    await page.goto('/platform/animation/soft-orbit');
    await expect(page.getByTestId('canvas').locator('canvas')).toBeVisible();
    await page.getByRole('button', {name: 'Model', exact: true}).click();
    const logo = page.getByRole('checkbox', {name: 'Show logo', exact: true});
    await logo.focus();
    await page.keyboard.press('Space');
    await expect(logo).not.toBeChecked();
    await expect(page.getByRole('button', {name: 'Play', exact: true})).toBeVisible();
    await page.getByRole('button', {name: 'Set start keyframe', exact: true}).first().click();
    await expect(page.getByRole('button', {name: 'Transform', exact: true})).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('Select animation curve')).toBeEnabled();
});
