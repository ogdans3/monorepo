// Side-by-side pictures of the export and the app, with a number: how many
// of the pixels differ once the export's frame is cut to its phone (from
// y=28, under the label) and both are 390×844, compared with a small
// tolerance, plus a heat map of where. The number is a compass, not a
// verdict — photographs and fixture text will never match — but it orders
// the work. `node pairs.mjs 13 13b` does only those.
import { chromium } from 'playwright-core'
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { PAIRS, OUT, GOLDENS, launch } from './frames.mjs'

mkdirSync(`${OUT}/pairs`, { recursive: true })
const only = process.argv.slice(2)
const browser = await launch(chromium)
const report = []
for (const [ref, app] of PAIRS) {
  if (only.length && !only.includes(ref)) continue
  const a = `${OUT}/ref/${ref}.png`
  const b = `${GOLDENS}/${app}.png`
  if (!existsSync(a) || !existsSync(b)) { console.log('missing', ref, app); continue }
  const da = 'data:image/png;base64,' + readFileSync(a).toString('base64')
  const db = 'data:image/png;base64,' + readFileSync(b).toString('base64')
  const html = `<!doctype html><meta charset=utf-8><style>
    body{margin:0;background:#EDEDEA;font:600 15px/1.3 Roboto,-apple-system,sans-serif;color:#141C18}
    .wrap{display:flex;gap:24px;padding:24px;align-items:flex-start}
    figure{margin:0;flex:1}
    figcaption{padding:0 0 10px 2px;color:#41514A}
    img,canvas{width:100%;display:block;border-radius:22px;box-shadow:0 2px 10px rgba(0,0,0,.10)}
    h1{font-size:17px;margin:0;padding:20px 24px 0}
  </style>
  <h1 id=h>${ref}</h1>
  <div class=wrap>
    <figure><figcaption>Designet (runde 5)</figcaption><img id=a src="${da}"></figure>
    <figure><figcaption>Appen nå</figcaption><img id=b src="${db}"></figure>
    <figure><figcaption id=c>Avvik</figcaption><canvas id=d width=390 height=844></canvas></figure>
  </div>`
  const tmp = `${OUT}/pair.html`
  writeFileSync(tmp, html)
  const page = await browser.newPage({ viewport: { width: 1400, height: 400 }, deviceScaleFactor: 2 })
  await page.goto('file://' + tmp, { waitUntil: 'networkidle' })
  const pct = await page.evaluate(async () => {
    const [a, b] = [document.getElementById('a'), document.getElementById('b')]
    await Promise.all([a, b].map(i => i.complete ? 1 : new Promise(r => i.onload = r)))
    const W = 390, H = 844
    // A frame in the export is its label row — the badge and the screen's
    // name, 18 tall and 10 above the phone — then the phone, 844 tall, and on
    // some frames a note under it. Only the phone is compared: scaled whole
    // into 844, the drawing sat up to 27 points below the golden at the top
    // and every row counted twice.
    const draw = (img, phone) => { const c = document.createElement('canvas'); c.width = W; c.height = H
      const s = img.naturalWidth / W
      if (phone) c.getContext('2d').drawImage(img, 0, 28 * s, W * s, H * s, 0, 0, W, H)
      else c.getContext('2d').drawImage(img, 0, 0, W, H)
      return c.getContext('2d').getImageData(0, 0, W, H).data }
    const [pa, pb] = [draw(a, true), draw(b, false)]
    const d = document.getElementById('d'), ctx = d.getContext('2d')
    const out = ctx.createImageData(W, H); let diff = 0
    for (let i = 0; i < pa.length; i += 4) {
      const e = Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2])
      const bad = e > 48
      if (bad) diff++
      out.data[i] = bad ? 220 : 250; out.data[i + 1] = bad ? 60 : 250; out.data[i + 2] = bad ? 50 : 248; out.data[i + 3] = 255
    }
    ctx.putImageData(out, 0, 0)
    const pct = (100 * diff / (W * H)).toFixed(1)
    document.getElementById('c').textContent = `Avvik: ${pct} % av pikslene`
    document.getElementById('h').textContent += `  ·  ${pct} % avvik`
    return pct
  })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/pairs/${ref}.png`, fullPage: true })
  await page.close()
  report.push([ref, pct])
  console.log('paired', ref, pct + '%')
}
await browser.close()
writeFileSync(`${OUT}/pairs/report.json`, JSON.stringify(report))
