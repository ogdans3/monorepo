/** Exercise the public headless rendering path and render every catalogue model. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {RenderSession} from '../dist/renderer.js';
import {resolveScene, sceneSchema} from '../dist/scene.js';
const root=resolve(import.meta.dirname,'../..');
const out=resolve(root,'assets/models/iphone-16-pro-full-screen/qa/app');
await mkdir(resolve(out,'models'),{recursive:true});
const session=await RenderSession.launch();
const results=[];
const hashes={};
const animatedFrames={};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function render(model, showCameraIsland, name) {
    const input=z.object(sceneSchema).parse({model,showCameraIsland,width:600,height:900,background:'#18202b',glassReflections:false});
    const options=resolveScene(input,{width:600,height:900});
    assert.equal(options.showCameraIsland,showCameraIsland);
    await session.initScene(options);
    await session.setScreenSource(resolve(root,'assets/models/iphone-16-pro-full-screen/screen-demo.png'));
    const png=await session.renderStill('image/png');
    await writeFile(resolve(out,`${name}.png`),png);
    hashes[name]=digest(png);results.push({model,showCameraIsland,name,bytes:png.length});
}
try {
    const catalog=await session.catalog();
    for (const model of catalog.models) {
        await render(model.id,undefined,`models/${model.id}`);
        console.log(`Rendered ${model.id}`);
    }
    for (const [id,prefix] of [['iphone-16-pro','original'],['iphone-16-pro-full-screen','full-screen']]) {
        for (const visible of [true,false]) {
            await render(id,visible,`${prefix}-${visible?'on':'off'}`);
            const frame=await session.renderFrame('group-center-spin-zoom',1.5,'image/png');
            const name=`${prefix}-${visible?'on':'off'}-motion.png`;
            animatedFrames[name]=digest(frame);
            await writeFile(resolve(out,name),frame);
        }
    }
    assert.equal(hashes['original-off'],hashes['full-screen-off']);
    assert.equal(hashes['original-on'],hashes['full-screen-on']);
    assert.equal(hashes['models/iphone-16-pro'],hashes['original-on']);
    assert.equal(hashes['models/iphone-16-pro-full-screen'],hashes['full-screen-off']);
    assert.notEqual(hashes['original-on'],hashes['original-off']);
    for (const state of ['on','off']) assert.equal(animatedFrames[`original-${state}-motion.png`],animatedFrames[`full-screen-${state}-motion.png`]);
    await writeFile(resolve(out,'report.json'),JSON.stringify({passed:true,renderer:'Public MCP RenderSession + resolveScene + shared SceneRenderer',catalogueModels:catalog.models.length,results,hashes,animatedFrames},null,2)+'\n');
} finally {await session.close();}
console.log('Camera island headless checks passed');
