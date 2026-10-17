import {test, expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

const modelIds = ['iphone-16-pro', 'pixel-9-pro', 'galaxy-s24-ultra', 'macbook-pro-14-m4'];

for (const id of modelIds) {
    test(`${id}: hiding the logo changes only its pixels and is reversible`, async ({page}, testInfo) => {
        await page.goto('/', {waitUntil: 'domcontentloaded'});
        const result = await page.evaluate(async id => {
            const load = (url: string) => import(url);
            const {SceneRenderer} = await load('/src/lib/render/scene-renderer.ts');
            const {getModel} = await load('/src/lib/models/3d-models/3d-models-spec.ts');
            const config = {...getModel(id), lidAngle: 0};
            const width = 640, height = 800;
            const r = new SceneRenderer({width, height, background: [30, 39, 48, 1], glassReflections: false});
            await r.setModel(config);
            r.applyTransform({x: 0, y: 0, z: id.startsWith('macbook') ? .8 : -.4},
                id.startsWith('macbook') ? {x: 55, y: 16, z: 0} : {x: 0, y: 180, z: 0});
            r.render();
            const model = r.model;
            const unrelated: any[] = [];
            model.traverse((node: any) => {
                if (!config.logo.nodes.includes(node.name)) unrelated.push({node, visible: node.visible,
                    matrix: node.matrixWorld.toArray(), material: node.material});
            });
            // Project all eight corners, covering multi-part Apple logos as well.
            const bounds = config.logo.nodes.map((name: string) => {
                const node = model.getObjectByName(name);
                node.geometry.computeBoundingBox();
                const box = node.geometry.boundingBox;
                const pts = [];
                for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
                    const p = r.camera.position.clone().set(x, y, z).applyMatrix4(node.matrixWorld).project(r.camera);
                    pts.push({x: (p.x*.5+.5)*width, y: (.5-p.y*.5)*height});
                }
                return {left: Math.floor(Math.min(...pts.map(p=>p.x)))-3, right: Math.ceil(Math.max(...pts.map(p=>p.x)))+3,
                    top: Math.floor(Math.min(...pts.map(p=>p.y)))-3, bottom: Math.ceil(Math.max(...pts.map(p=>p.y)))+3};
            });
            const copy = document.createElement('canvas');copy.width = width;copy.height = height;
            const ctx = copy.getContext('2d')!;
            function pixels() {ctx.drawImage(r.domElement, 0, 0);return ctx.getImageData(0, 0, width, height).data;}
            const on = pixels(), onImage = r.domElement.toDataURL();
            await r.setModel({...config, showLogo: false});
            const dirty = r.needsRender;
            r.render();
            const off = pixels(), offImage = r.domElement.toDataURL();
            let changed = 0, outside = 0;
            for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
                const i=(y*width+x)*4;
                if ([0,1,2,3].some(k=>on[i+k]!==off[i+k])) {
                    changed++;
                    if (!bounds.some((b: any)=>x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom)) outside++;
                }
            }
            const hidden = config.logo.nodes.every((name: string)=>!model.getObjectByName(name).visible);
            const unchanged = model===r.model && unrelated.every(({node,visible,matrix,material})=>
                node.visible===visible && node.material===material && matrix.every((v: number,i: number)=>v===node.matrixWorld.elements[i]));
            // Omission also turns logos back on, as in an older saved project.
            await r.setModel({...config, showLogo: undefined});r.render();
            const restored = pixels();
            const reversible = on.every((v,i)=>v===restored[i]);
            r.dispose();
            return {changed,outside,hidden,dirty,unchanged,reversible,onImage,offImage};
        }, id);
        for (const state of ['on', 'off'] as const) {
            await writeFile(testInfo.outputPath(`logo-${state}.png`), Buffer.from(result[`${state}Image`].split(',')[1], 'base64'));
        }
        expect(result.dirty).toBe(true);
        expect(result.hidden).toBe(true);
        expect(result.changed).toBeGreaterThan(20);
        expect(result.outside).toBe(0);
        expect(result.unchanged).toBe(true);
        expect(result.reversible).toBe(true);
    });
}

test('saved logo choices survive catalogue refresh; old saves and new projects default to on', async ({page}) => {
    await page.goto('/', {waitUntil: 'domcontentloaded'});
    const rows = await page.evaluate(async ids => {
        const load = (url: string) => import(url);
        const {ProjectState} = await load('/src/lib/stores/project.svelte.ts');
        const {getModel} = await load('/src/lib/models/3d-models/3d-models-spec.ts');
        return [...ids, 'iphone-16-pro-full-screen'].flatMap(id => [true, false, undefined].map(showLogo => {
            const p = new ProjectState();p.model = {...getModel(id), id, showLogo};
            const saved = JSON.parse(JSON.stringify(p.toProject()));
            saved.model.logo = {nodes: ['stale-logo-name']};saved.model.modelPath = '/old.glb';
            const restored = new ProjectState();restored.fromProject(saved);
            const value = restored.model.showLogo, nodes = restored.model.logo.nodes;
            restored.startNew();
            return {value, nodes, expectedNodes: getModel(id).logo.nodes, expected: showLogo ?? true, fresh: restored.model.showLogo};
        }));
    }, modelIds);
    for (const row of rows) {
        expect(row.value).toBe(row.expected);
        expect(row.nodes).toEqual(row.expectedNodes);
        expect(row.fresh).toBe(true);
    }
});

test('checkbox redraws the paused editor, carries across devices, and saves/reopens', async ({page}) => {
    await page.goto('/platform/animation/still', {waitUntil: 'domcontentloaded'});
    await expect(page.getByTestId('timeline')).toBeVisible({timeout: 30000});
    await page.getByRole('button', {name: 'Model', exact: true}).click();
    const toggle = page.getByRole('checkbox', {name: 'Show logo', exact: true});
    await expect(toggle).toBeChecked();
    const pixels = () => page.evaluate(() => (document.querySelector('[data-testid="canvas"] canvas') as HTMLCanvasElement).toDataURL());
    await expect.poll(() => page.evaluate(() => {
        const source = document.querySelector('[data-testid="canvas"] canvas') as HTMLCanvasElement;
        const copy = document.createElement('canvas');copy.width=source.width;copy.height=source.height;
        const ctx=copy.getContext('2d')!;ctx.drawImage(source,0,0);
        return ctx.getImageData(copy.width/2,copy.height/2,1,1).data[3];
    })).toBe(255);
    const front = await pixels();
    await page.evaluate(async () => {
        const load = (url: string) => import(url);
        const {transformControlRotation} = await load('/src/lib/stores/transform.svelte.ts');
        const {ChangeOrigin} = await load('/src/lib/components/mock-video/Animation.ts');
        transformControlRotation.set({vector: {x: 0, y: 180, z: 0}, origin: ChangeOrigin.User});
    });
    // Compare only after the paused canvas has drawn the requested rear pose.
    await expect.poll(pixels).not.toBe(front);
    let previous = await pixels();
    await expect.poll(async () => {const current=await pixels();const same=current===previous;previous=current;return same;}).toBe(true);
    const on = await pixels();
    await toggle.uncheck();
    await expect.poll(pixels).not.toBe(on);
    await toggle.check();
    await expect.poll(pixels).toBe(on);
    await toggle.uncheck();
    for (const name of ['iPhone 16 Pro', 'Samsung Galaxy S24 Ultra', 'MacBook Pro 14-inch M4']) {
        await page.getByLabel('Select 3D model').click();
        await page.getByRole('option', {name, exact: true}).click();
        await expect(toggle).not.toBeChecked();
    }
    await page.getByRole('button', {name: 'Save', exact: true}).click();
    await expect(page).toHaveURL(/\/platform\/project\//);
    await page.reload({waitUntil: 'domcontentloaded'});
    await expect(page.getByTestId('timeline')).toBeVisible();
    await page.getByRole('button', {name: 'Model', exact: true}).click();
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    await page.getByRole('button', {name: 'Save', exact: true}).click();
    await expect.poll(() => page.evaluate(() => {
        const id=location.pathname.split('/').pop();
        return JSON.parse(localStorage.getItem(`project:local:${id}`)!).model.showLogo;
    })).toBe(true);
    await page.reload({waitUntil: 'domcontentloaded'});
    await expect(page.getByTestId('timeline')).toBeVisible();
    await page.getByRole('button', {name: 'Model', exact: true}).click();
    await expect(toggle).toBeChecked();
});
