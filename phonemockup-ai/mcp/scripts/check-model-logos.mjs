/** Verify the public export path renders each manufacturer's logo on/off. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {RenderSession} from '../dist/renderer.js';
import {resolveScene, sceneSchema} from '../dist/scene.js';

const root = resolve(import.meta.dirname, '../..');
const out = resolve(process.argv[2] ?? resolve(root, 'assets/qa/model-logos'));
await mkdir(out, {recursive: true});
const session = await RenderSession.launch();
const results = [];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
try {
    const catalog = await session.catalog();
    assert.equal(catalog.models.length, 4);
    for (const model of catalog.models) {
        assert.equal(model.supportsLogo, true);
        assert.equal(model.showLogo, true);
        const laptop = model.id === 'macbook-pro-14-m4';
        const animation = laptop ? 'top-down' : 'flip-cut';
        const time = laptop ? 0 : 2.5;
        const hashes = {};
        for (const visible of [undefined, false, true]) {
            const state = visible === undefined ? 'default' : visible ? 'on' : 'off';
            const input = z.object(sceneSchema).parse({
                model: model.id, showLogo: visible,
                width: 640, height: 800, glassReflections: false,
                background: '#1e2730', lidAngle: 0
            });
            const options = resolveScene(input, {width: 640, height: 800});
            assert.equal(options.showLogo, visible);
            await session.initScene(options);
            await session.setScreenSource(resolve(root,
                `client/static/media/studio/${laptop ? 'workspace' : 'focus'}.png`));
            const frame = await session.renderFrame(animation, time, 'image/png');
            await writeFile(resolve(out, `${model.id}-${state}.png`), frame);
            hashes[state] = digest(frame);
            hashes[`${state}-motion`] =
                digest(await session.renderFrame(animation, time + .15, 'image/png'));
        }
        assert.equal(hashes.default, hashes.on);
        assert.notEqual(hashes.on, hashes.off);
        assert.equal(hashes['default-motion'], hashes['on-motion']);
        assert.notEqual(hashes['on-motion'], hashes['off-motion']);
        results.push({model: model.id, animation, time, hashes});
        console.log(`Verified logo export: ${model.name}`);
    }
    await writeFile(resolve(out, 'report.json'),
        JSON.stringify({passed: true, results}, null, 2) + '\n');
} finally {
    await session.close();
}
