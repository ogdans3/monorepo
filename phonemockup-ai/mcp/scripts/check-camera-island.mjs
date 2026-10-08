/** Curated catalogue, reversible camera cutouts, and legacy iPhone compatibility. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {RenderSession} from '../dist/renderer.js';
import {DEFAULT_MODEL, resolveScene, sceneSchema} from '../dist/scene.js';
const root=resolve(import.meta.dirname,'../..');
const out=resolve(root,'assets/models/pixel-9-pro-full-screen/qa/app');
await mkdir(resolve(out,'models'),{recursive:true});
const session=await RenderSession.launch();
const results=[], hashes={}, animatedFrames={};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function render(model, showCameraIsland, name) {
    const input=z.object(sceneSchema).parse({model,showCameraIsland,width:600,height:900,background:'#18202b',glassReflections:false});
    const options=resolveScene(input,{width:600,height:900});
    assert.equal(options.showCameraIsland,showCameraIsland);
    await session.initScene(options);
    const source=model==='macbook-pro-14-m4'?'macbook-pro-14-m4':model.startsWith('pixel')?'pixel-9-pro':'iphone-16-pro-full-screen';
    await session.setScreenSource(resolve(root,`assets/models/${source}/screen-demo.png`));
    const png=await session.renderStill('image/png');
    await writeFile(resolve(out,`${name}.png`),png);
    hashes[name]=digest(png);results.push({model,showCameraIsland,name,bytes:png.length});
}
try {
    const catalog=await session.catalog();
    assert.deepEqual(catalog.models.map(m=>m.id),['iphone-16-pro','pixel-9-pro','galaxy-s24-ultra','macbook-pro-14-m4']);
    assert.equal(DEFAULT_MODEL,'pixel-9-pro');
    for (const model of catalog.models) {
        await render(model.id,undefined,`models/${model.id}`);
        console.log(`Rendered ${model.id}`);
    }
    for (const id of ['iphone-16-pro','pixel-9-pro','iphone-16-pro-full-screen']) {
        for (const visible of [true,false]) {
            const name=`${id}-${visible?'on':'off'}`;
            await render(id,visible,name);
            // At 0.2s the screen is visible; 0.5s has already turned past 90 degrees.
            const frame=await session.renderFrame('group-center-spin-zoom',.2,'image/png');
            animatedFrames[name]=digest(frame);
            await writeFile(resolve(out,`${name}-motion.png`),frame);
        }
        assert.notEqual(hashes[`${id}-on`],hashes[`${id}-off`]);
    }
    for (const id of ['iphone-16-pro','pixel-9-pro']) {
        assert.equal(hashes[`models/${id}`],hashes[`${id}-on`]);
        assert.notEqual(animatedFrames[`${id}-on`],animatedFrames[`${id}-off`]);
    }
    await render('iphone-16-pro-full-screen',undefined,'legacy-full-screen-default');
    assert.equal(hashes['legacy-full-screen-default'],hashes['iphone-16-pro-off']);
    for (const state of ['on','off']) {
        assert.equal(hashes[`iphone-16-pro-${state}`],hashes[`iphone-16-pro-full-screen-${state}`]);
        assert.equal(animatedFrames[`iphone-16-pro-${state}`],animatedFrames[`iphone-16-pro-full-screen-${state}`]);
    }
    await writeFile(resolve(out,'report.json'),JSON.stringify({passed:true,renderer:'Public MCP RenderSession + shared SceneRenderer',catalogueModels:catalog.models.length,animationTime:0.2,results,hashes,animatedFrames},null,2)+'\n');
} finally {await session.close();}
console.log('Camera cutout and curated catalogue checks passed');
