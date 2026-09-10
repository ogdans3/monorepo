// Dumps each frame of the export as a text tree of geometry and computed
// style — position, size, font, colour, padding, radius, border, gaps —
// which is what the Flutter screens are built from. One file per screen in
// out/blueprint/. Measured in the browser's fallback font, so widths of text
// runs are not to be trusted; everything else is.
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { FRAMES, HTML, OUT, launch, tagFrames } from './frames.mjs'

mkdirSync(`${OUT}/blueprint`, { recursive: true })
const browser = await launch(chromium)
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } })
await page.goto('file://' + HTML, { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
const n = await tagFrames(page)
const all = await page.evaluate(() => {
  const rgb = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return c
    const [r, g, b, a] = m[1].split(',').map((x) => parseFloat(x))
    const hex = '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()
    return a !== undefined && a < 1 ? `${hex}@${a}` : hex
  }
  return [...document.querySelectorAll('[data-frame]')].map((frame) => {
    const fr = frame.getBoundingClientRect()
    const rows = []
    const walk = (el, depth) => {
      const s = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1 || depth > 9) return
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ')
      const geo = `[${Math.round(r.left - fr.left)},${Math.round(r.top - fr.top)} ${Math.round(r.width)}×${Math.round(r.height)}]`
      const bits = []
      if (own) bits.push(`"${own.slice(0, 40)}" ${s.fontSize}/${s.fontWeight} ${rgb(s.color)}${s.letterSpacing !== 'normal' ? ' ls' + s.letterSpacing : ''}${s.textTransform !== 'none' ? ' ' + s.textTransform : ''}`)
      if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') bits.push(`bg ${rgb(s.backgroundColor)}`)
      if (s.borderRadius !== '0px') bits.push(`r${s.borderRadius.replace(/px/g, '')}`)
      if (s.borderTopWidth !== '0px' && s.borderTopStyle !== 'none') bits.push(`bd${s.borderTopWidth.replace('px', '')} ${rgb(s.borderTopColor)}`)
      const pad = [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map((p) => p.replace('px', ''))
      if (pad.some((p) => p !== '0')) bits.push(`p${pad.join('/')}`)
      if (s.display === 'flex') bits.push(`flex${s.flexDirection === 'column' ? '↓' : '→'} gap${s.gap === 'normal' ? 0 : s.gap.replace('px', '')}`)
      if (bits.length || own) rows.push('  '.repeat(depth) + geo + ' ' + bits.join(' | '))
      for (const c of el.children) walk(c, depth + 1)
    }
    walk(frame, 0)
    return rows.join('\n')
  })
})
all.forEach((text, i) => { if (FRAMES[i]) writeFileSync(`${OUT}/blueprint/${FRAMES[i]}.txt`, text) })
console.log(n, 'frames,', all.length, 'blueprints in', `${OUT}/blueprint`)
await browser.close()
