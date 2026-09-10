// Renders each frame of the export to out/ref/<id>.png at 3×, in Roboto.
// The design says -apple-system, which is SF Pro on the phone it is for; a
// Linux box has neither, and the goldens render in Roboto, so the reference
// gets Roboto too. Whatever differs after this is not the font.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { FRAMES, HTML, OUT, launch, tagFrames } from './frames.mjs'

const F = process.env.FLUTTER_ROOT
  ? `${process.env.FLUTTER_ROOT}/bin/cache/artifacts/material_fonts`
  : (() => { throw new Error('Set FLUTTER_ROOT so the Roboto files under bin/cache can be found.') })()

mkdirSync(`${OUT}/ref`, { recursive: true })
const browser = await launch(chromium)
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 3 })
await page.goto('file://' + HTML, { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await page.addStyleTag({ content: `
  @font-face{font-family:R;font-weight:400;src:url(file://${F}/Roboto-Regular.ttf)}
  @font-face{font-family:R;font-weight:500;src:url(file://${F}/Roboto-Medium.ttf)}
  @font-face{font-family:R;font-weight:600;src:url(file://${F}/Roboto-Bold.ttf)}
  @font-face{font-family:R;font-weight:700;src:url(file://${F}/Roboto-Bold.ttf)}
  @font-face{font-family:R;font-weight:800;src:url(file://${F}/Roboto-Black.ttf)}
  @font-face{font-family:R;font-weight:900;src:url(file://${F}/Roboto-Black.ttf)}
  * { font-family: R, sans-serif !important; }` })
await page.waitForTimeout(1500)
const n = await tagFrames(page)
for (let i = 0; i < n && i < FRAMES.length; i++) {
  await page.locator(`[data-frame="${i}"]`).screenshot({ path: `${OUT}/ref/${FRAMES[i]}.png` })
}
console.log(n, 'frames rendered in Roboto to', `${OUT}/ref`)
await browser.close()
