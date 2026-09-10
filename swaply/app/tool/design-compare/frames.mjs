// The export is one HTML file with every screen drawn as a 390-wide frame,
// in this order. The id is the one on the badge above each frame.
export const FRAMES = ['01','02','05','05b','04','06a','06b','06c','06e','06f','06g','06h','06i','09a','09b','09c','09c2','09d','09e','09f','09g','09h','09i','07i','07k','07j','07l','08a','08b','08c','10a','10b','10c','11','11a','12a','12','13','13b','16a','16b','16c','17a','17b','17c']

// Which golden answers to which frame.
export const PAIRS = [
  ['01', '01-splash'], ['02', '02-interesser'], ['04', '04-gjenstand'], ['05', '05-oppdag'],
  ['05b', '05b-avansert-sok'], ['06a', '06a-match'], ['06b', '06b-byttedetalj'],
  ['06c', '06c-avtale'], ['06g', '06g-samtale'], ['06h', '06h-vurdering'],
  ['09a', '09a-motbytte'], ['10b', '10b-legg-ut'], ['10c', '10c-lag-profil'],
  ['11', '11-mine-handler'], ['11a', '11a-chats'], ['12', '12-likt'], ['12a', '12a-varsler'],
  ['13', '13-profil'], ['13b', '13b-annen-profil'], ['16b', '16b-innstillinger'],
  ['16c', '16c-logg-inn'],
]

export const HTML = process.env.ROUND5_HTML
if (!HTML) throw new Error('Set ROUND5_HTML to the path of the round-5 export (round-5.html).')
export const OUT = process.env.OUT ?? new URL('./out/', import.meta.url).pathname
export const GOLDENS = new URL('../../test/goldens/', import.meta.url).pathname

/** Tag every frame in the page with data-frame="<index>" and return how many. */
export const tagFrames = (page) => page.evaluate(() => {
  let i = 0
  for (const el of document.querySelectorAll('div')) {
    const r = el.getBoundingClientRect()
    if (Math.round(r.width) !== 390 || r.height < 500) continue
    const pr = el.parentElement?.getBoundingClientRect()
    if (pr && Math.round(pr.width) === 390) continue
    el.setAttribute('data-frame', String(i++))
  }
  return i
})

export const launch = async (chromium) =>
  chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] })
