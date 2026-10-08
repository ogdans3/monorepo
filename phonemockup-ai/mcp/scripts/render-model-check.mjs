/**
 * Render a new model with every preset, plus one still of every catalogue model.
 * Run after `cd mcp && npm run build`:
 * node scripts/render-model-check.mjs MODEL_ID SCREENSHOT OUTPUT_DIRECTORY
 * Uses the shipped RenderSession API; no alternate scene or lighting.
 */
import {readFile, readdir, mkdir, writeFile} from "node:fs/promises";
import {resolve, join, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {RenderSession} from "../dist/renderer.js";

const [modelId, screenshot, output] = process.argv.slice(2);
if (!modelId || !screenshot || !output) {
    throw new Error("Usage: node scripts/render-model-check.mjs MODEL_ID SCREENSHOT OUTPUT_DIRECTORY");
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = resolve(output);
const source = resolve(screenshot);
const groups = [];
for (const name of await readdir(join(root, "client/src/lib/animations/presets"))) {
    if (name.endsWith(".json")) {
        groups.push(JSON.parse(await readFile(join(root, "client/src/lib/animations/presets", name), "utf8")));
    }
}
await mkdir(out, {recursive: true});
const report = {modelId, renderer: "shared SceneRenderer / MCP RenderSession / Chromium SwiftShader", renders: [], errors: []};
const session = await RenderSession.launch();
const options = {width: 432, height: 648, background: [0, 0, 0, 0], glassReflections: false, antialias: true};
async function save(file, pixels, details) {
    const path = join(out, file);
    await mkdir(dirname(path), {recursive: true});
    await writeFile(path, pixels);
    report.renders.push({file, bytes: pixels.length, ...details});
    // Keep verifiable progress if an external process limit interrupts a long sweep.
    await writeFile(join(out, "report-in-progress.json"), JSON.stringify(report, null, 2) + "\n");
}
async function init(id, overrides = {}) {
    await session.initScene({...options, modelId: id, ...overrides});
    await session.setScreenSource(source);
}
try {
    const catalog = await session.catalog();
    const model = catalog.models.find((m) => m.id === modelId);
    if (!model) throw new Error(`Unknown model: ${modelId}`);
    report.catalog = catalog;
    report.glbSha256 = createHash("sha256").update(await readFile(join(root, "client/static", model.modelPath))).digest("hex");
    for (const m of catalog.models) {
        try {
            await init(m.id);
            await save(`models/${m.id}.png`, await session.renderStill("image/png"), {modelId: m.id, kind: "still"});
            console.log(`Still: ${m.id}`);
        } catch (error) { report.errors.push({modelId: m.id, message: String(error)}); }
    }
    await init(modelId);
    for (const animation of catalog.animations) {
        const group = groups.find((g) => g.id === animation.id);
        const times = new Set([0, .25, .5, .75, 1].map((f) => +(f * animation.duration).toFixed(5)));
        for (const a of group.animations) {
            for (const t of [a.start, (a.start + a.end) / 2, a.end]) times.add(+t.toFixed(5));
        }
        for (const time of [...times].sort((a, b) => a - b)) {
            await save(`presets/${animation.id}/${time.toFixed(5)}.png`,
                await session.renderFrame(animation.id, time, "image/png"),
                {modelId, animationId: animation.id, time, kind: "preset"});
        }
        console.log(`Preset: ${animation.id} (${times.size} frames)`);
    }
    for (const [name, overrides] of [
        ["front", {width: 600, height: 900}],
        ["landscape", {width: 1280, height: 720}],
        ["glass-reflections", {width: 600, height: 900, glassReflections: true}],
        ["recolour", {width: 600, height: 900, caseColor: "#2765df"}],
        ["front-4k", {width: 2160, height: 3840}],
    ]) {
        await init(modelId, overrides);
        await save(`${name}.png`, await session.renderStill("image/png"), {modelId, kind: name, ...overrides});
        console.log(`Detail: ${name}`);
    }
} finally {
    await session.close();
    await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
}
if (report.errors.length) throw new Error(JSON.stringify(report.errors));
console.log(`Done: ${report.renders.length} renders. Inspect the PNGs before accepting the model.`);
