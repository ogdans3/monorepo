import {test, expect} from '@playwright/test';

// Read actual rendered pixels, not just the visibility flag: the entire
// island area must show screen content, including both separate lens meshes.
test('island toggles in place and exposes continuous screen pixels', async ({page}) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const load = (url: string) => import(url);
        const {SceneRenderer} = await load('/src/lib/render/scene-renderer.ts');
        const {models} = await load('/src/lib/models/3d-models/3d-models-spec.ts');
        const config = models.find((m: any) => m.id === 'iphone-16-pro');
        const r = new SceneRenderer({width: 640, height: 960, background: [20, 27, 38, 1]});
        await r.setModel(config);
        r.applyTransform({x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 0});
        const media = document.createElement('canvas');media.width = 1206;media.height = 2622;
        const ctx = media.getContext('2d')!;ctx.fillStyle = '#ffffff';ctx.fillRect(0, 0, 1206, 2622);
        r.setMedia({kind: 'image', el: media});r.render();
        const model = r.model;
        const screen = model.getObjectByName('screen');
        const uvs = Array.from(screen.geometry.attributes.uv.array);
        const pivot = model.matrixWorld.toArray();
        const copy = document.createElement('canvas');copy.width = 640;copy.height = 960;
        const c = copy.getContext('2d')!;
        function pixels() {c.drawImage(r.domElement, 0, 0);return c.getImageData(0, 0, 640, 960).data;}
        const on = pixels();
        const lensPoints = config.cameraIsland.nodes.map((name: string) => {
            const node = model.getObjectByName(name);node.geometry.computeBoundingBox();
            const p = node.geometry.boundingBox.getCenter(r.camera.position.clone());
            p.applyMatrix4(node.matrixWorld).project(r.camera);
            return {x: Math.round((p.x * .5 + .5) * 640), y: Math.round((.5 - p.y * .5) * 960)};
        });
        await r.setModel({...config, showCameraIsland: false});
        const dirty = r.needsRender;r.render();const off = pixels();
        const hidden = config.cameraIsland.nodes.every((name: string) => !model.getObjectByName(name).visible);
        let changed = 0, outsideIslandChanged = 0;
        for (let y = 0; y < 960; y++) for (let x = 0; x < 640; x++) {
            const i = (y * 640 + x) * 4;
            if ([0, 1, 2].some(k => on[i + k] !== off[i + k])) {
                changed++;
                // Projected island occupies only the narrow upper-centre region.
                if (Math.abs(x - lensPoints[0].x) > 65 || Math.abs(y - lensPoints[0].y) > 18) outsideIslandChanged++;
            }
        }
        const samples = lensPoints.map(({x, y}: {x: number; y: number}) => Array.from(off.slice((y * 640 + x) * 4, (y * 640 + x) * 4 + 3)));
        const unchanged = model === r.model && pivot.every((n: number, i: number) => n === model.matrixWorld.elements[i]) && uvs.every((n, i) => n === screen.geometry.attributes.uv.array[i]);
        await r.setModel({...config, showCameraIsland: true});r.render();
        const restoredPixels = pixels();const restored = on.every((n, i) => n === restoredPixels[i]);
        await r.setModel(models.find((m: any) => m.id === 'iphone-16-pro-full-screen'));
        const variantHidden = config.cameraIsland.nodes.every((name: string) => !r.model.getObjectByName(name).visible);
        await r.setModel({...models.find((m: any) => m.id === 'iphone-16-pro-full-screen'), showCameraIsland: true});
        const variantCanRestore = config.cameraIsland.nodes.every((name: string) => r.model.getObjectByName(name).visible);
        r.dispose();
        return {dirty, hidden, changed, outsideIslandChanged, samples, unchanged, restored, variantHidden, variantCanRestore};
    });
    expect(result.dirty).toBe(true);expect(result.hidden).toBe(true);
    expect(result.changed).toBeGreaterThan(250);expect(result.outsideIslandChanged).toBe(0);
    expect(result.samples.every((rgb: number[]) => rgb.every((n: number) => n > 220))).toBe(true);
    expect(result.unchanged).toBe(true);expect(result.restored).toBe(true);
    expect(result.variantHidden).toBe(true);expect(result.variantCanRestore).toBe(true);
});

test('saved projects preserve both states and old projects keep model defaults', async ({page}) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const load = (url: string) => import(url);
        const {ProjectState} = await load('/src/lib/stores/project.svelte.ts');
        const {models} = await load('/src/lib/models/3d-models/3d-models-spec.ts');
        return ['iphone-16-pro', 'iphone-16-pro-full-screen'].flatMap(id => [true, false, undefined].map(showCameraIsland => {
            const p = new ProjectState();p.model = {...models.find((m: any) => m.id === id), showCameraIsland};
            const saved = JSON.parse(JSON.stringify(p.toProject()));
            saved.model.modelPath = '/stale.glb';saved.model.cameraIsland = {nodes: ['stale']};
            const restored = new ProjectState();restored.fromProject(saved);
            return {id, input: showCameraIsland, visible: restored.model.showCameraIsland, path: restored.model.modelPath, nodes: restored.model.cameraIsland.nodes};
        }));
    });
    for (const r of result) {
        expect(r.visible).toBe(r.input ?? (r.id === 'iphone-16-pro'));
        expect(r.path).toBe('/iphone-16-pro.glb');
        expect(r.nodes).toEqual(['camera_cutout', 'front_camera_optical_lens', 'front_camera_pupil']);
    }
});

test('latest island choice wins while the model is still loading', async ({page}) => {
    await page.goto('/');
    const requests: string[] = [];
    page.on('request', req => {if (req.url().endsWith('/iphone-16-pro.glb')) requests.push(req.url());});
    const hidden = await page.evaluate(async () => {
        const load = (url: string) => import(url);
        const {SceneRenderer} = await load('/src/lib/render/scene-renderer.ts');
        const {models} = await load('/src/lib/models/3d-models/3d-models-spec.ts');
        const config = models.find((m: any) => m.id === 'iphone-16-pro');
        const r = new SceneRenderer({width: 160, height: 240, background: [0, 0, 0, 0]});
        await Promise.all([r.setModel(config), r.setModel({...config, showCameraIsland: false})]);
        const hidden = config.cameraIsland.nodes.every((name: string) => !r.model.getObjectByName(name).visible);
        r.dispose();return hidden;
    });
    expect(hidden).toBe(true);expect(requests).toHaveLength(1);
});

test('editor switch changes the paused canvas and follows model defaults', async ({page}) => {
    await page.goto('/platform/animation/still');
    await expect(page.getByTestId('timeline')).toBeVisible({timeout: 30000});
    await page.getByRole('button', {name: 'Model', exact: true}).click();
    async function select(name: string) {
        await page.getByLabel('Select 3D model').click();
        await page.getByRole('option', {name, exact: true}).click();
    }
    const loaded = page.waitForResponse(response => response.url().endsWith('/iphone-16-pro.glb'));
    await select('iPhone 16 Pro');await loaded;
    const toggle = page.getByRole('switch', {name: 'Show Dynamic Island'});
    await expect(toggle).toBeChecked();
    const white = await page.evaluate(() => {
        const c = document.createElement('canvas');c.width = 1206;c.height = 2622;
        const ctx = c.getContext('2d')!;ctx.fillStyle = '#ffffff';ctx.fillRect(0, 0, c.width, c.height);
        return c.toDataURL('image/png').split(',')[1];
    });
    await page.getByLabel('Choose an image or video file').setInputFiles({name: 'white.png', mimeType: 'image/png', buffer: Buffer.from(white, 'base64')});
    await expect.poll(() => page.evaluate(() => {
        const canvas = document.querySelector('[data-testid="canvas"] canvas') as HTMLCanvasElement;
        const c = document.createElement('canvas');c.width = canvas.width;c.height = canvas.height;
        const ctx = c.getContext('2d')!;ctx.drawImage(canvas, 0, 0);
        return Math.min(...Array.from(ctx.getImageData(c.width / 2, c.height / 2, 1, 1).data).slice(0, 3));
    })).toBeGreaterThan(200);
    const pixels = () => page.evaluate(() => (document.querySelector('[data-testid="canvas"] canvas') as HTMLCanvasElement).toDataURL());
    const on = await pixels();
    await toggle.uncheck();await expect(toggle).not.toBeChecked();
    await expect.poll(pixels).not.toBe(on);
    await toggle.check();await expect(toggle).toBeChecked();
    await expect.poll(pixels).toBe(on);
    await select('iPhone 16 Pro · Full Screen');await expect(toggle).not.toBeChecked();
    await toggle.check();await expect(toggle).toBeChecked();
    await select('Google Pixel 9 Pro');await expect(toggle).toHaveCount(0);
});
