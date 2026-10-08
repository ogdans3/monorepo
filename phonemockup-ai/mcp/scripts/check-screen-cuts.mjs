/** Prove that contrasting screen images are fully occluded at each flip cut. */
import { RenderSession } from "../dist/renderer.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
const root = resolve(import.meta.dirname, "../.."),
  out = resolve(root, "assets/motion-2026/qa/screen-cuts");
await mkdir(out, { recursive: true });
spawnSync(
  "python3",
  [
    "-c",
    `from PIL import Image\nfrom pathlib import Path\np=Path(${JSON.stringify(out)})\nImage.new('RGB',(120,260),'#ff0000').save(p/'red.png')\nImage.new('RGB',(120,260),'#00ff00').save(p/'green.png')`,
  ],
  { stdio: "inherit" },
);
const report = [];
const session = await RenderSession.launch();
try {
  for (const id of ["flip-cut", "tumble-cut", "whip-switch"]) {
    const group = JSON.parse(
      await readFile(
        resolve(root, `client/src/lib/animations/presets/${id}.json`),
        "utf8",
      ),
    );
    for (const modelId of [
      "iphone-16-pro",
      "pixel-9-pro",
      "galaxy-s24-ultra",
    ]) {
      await session.initScene({
        modelId,
        width: 320,
        height: 400,
        background: [228, 231, 222, 1],
        glassReflections: false,
        antialias: true,
      });
      for (const color of ["red", "green"]) {
        await session.setScreenSource(resolve(out, `${color}.png`));
        for (const [label, time] of [
          ["front", 0],
          ["cut", group.screenCut.at],
        ])
          await writeFile(
            resolve(out, `${id}-${modelId}-${label}-${color}.png`),
            await session.renderFrame(id, time, "image/png"),
          );
      }
      report.push({ preset: id, modelId, cutAt: group.screenCut.at });
      console.log("Checked", id, modelId);
    }
  }
} finally {
  await session.close();
}
await writeFile(
  resolve(out, "render-cases.json"),
  JSON.stringify(report, null, 2) + "\n",
);
const check = spawnSync(
  "python3",
  [
    "-c",
    `from PIL import Image,ImageChops\nfrom pathlib import Path\nimport json\np=Path(${JSON.stringify(out)})\nrows=json.loads((p/'render-cases.json').read_text())\nfor row in rows:\n prefix=row['preset']+'-'+row['modelId']\n results={}\n for pose in ['front','cut']:\n  a=Image.open(p/(prefix+'-'+pose+'-red.png')).convert('RGB')\n  b=Image.open(p/(prefix+'-'+pose+'-green.png')).convert('RGB')\n  delta=ImageChops.difference(a,b)\n  results[pose]=sum(1 for pixel in delta.getdata() if max(pixel)>2)\n assert results['front']>1000,(row,results)\n assert results['cut']==0,(row,results)\n row['changedPixels']=results\n(p/'verification.json').write_text(json.dumps(rows,indent=2)+'\\n')\nprint('PASS: all 9 phone/flip combinations hide the screen switch completely.')`,
  ],
  { stdio: "inherit" },
);
if (check.status) throw Error("Screen occlusion check failed");
