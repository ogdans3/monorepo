"""Konverterer det crawlede rondane.no til Astro content collections.

Leser site/*.html (hele sider), plukker ut #main, og skriver
  src/content/sider/<sti>.md      med frontmatter
  src/content/blogg/<slug>.md
  src/assets/bilder/...           kopi av bildene som faktisk brukes
  verktoy/omdirigeringer.json     gammel sti -> ny sti
"""
import re, json, html, os, shutil, sys, urllib.parse
from html.parser import HTMLParser

ROT = '/tmp/rondane'
UT = '/home/ai_user/git/monorepo/rondane'
RAW = f'{ROT}/bilder/raw'
pages = json.load(open(f'{ROT}/pages.json'))

# ---------- informasjonsarkitektur ----------
SEKSJONER = {  # nøkkel = ny toppsti, verdi = gammel indeksside
    'overnatting': '/overnatting',
    'kurs-og-konferanse': '/kurs-og-konferanse',
    'selskap': '/selskap-og-arrangement',
    'tur-og-aktiviteter': '/tur-og-aktiviteter',
    'basseng': '/basseng',
    'om-hotellet': '/om_hotellet',
    'guide': '/guide',
    'bilder': '/bildegalleri',
}
# gammel slug -> ny slug (der den gamle var klønete eller kolliderte)
NYSLUG = {
    'om_hotellet': 'om-hotellet',
    'kurs_og_konferansepakker': 'pakker',
    'kurs_og_konferanselokaler': 'lokaler',
    'kurs-og-konferanse-pakke-1': 'dagpakke',
    'kurs-og-konferanse-pakke-2': 'overnattingspakke',
    'hotellrom-2': 'velkommen-til-oss',
    'velkommen-til-oss': 'ankomst',
    'kurs-og-konferanse-2': 'kurs-og-konferanse',
    'gildehallen-2': 'gildehallen',
    'furusjoen-rundt-2': 'furusjoen-rundt',
    'historie-oversikt': 'historie',
    'historie': 'hotellets-historie',
    'selskap-og-arrangement': 'selskap',
    'selskap': 'konfirmasjon-og-utleie',
    'konkurranse-for-lag-og-forening-2': 'lag-og-foreninger',
    'elbil-lading-pa-rondane-hoyfjellshotell': 'elbil-lading',
    'hvorfor-ga-fjelltur-i-rondane': 'hvorfor-rondane',
    'kvitskriupresteinene': 'kvitskriuprestein',
    'krigen-og-rondane-hoyfjellshotell': 'krigshendelser',
    'hva-sier-reiseekspertene-om-oss': 'omtaler',
    'om-behandling-av-personvernsopplysninger': 'personvern',
    'terrengrunde-via-kringsatrin-og-valasjosatrin': 'terrengrunde-kringsaetrin',
    'official-veteran-meeting-place': 'veterans',
    'offisielt-treffsted-for-veteraner': 'veteraner',
    'bestill-fra-hotellet-fa-fordeler': 'bestill-direkte',
    'leie-hytte-i-rondane': 'hytter',
    'hytter': 'utleiehyttene',
    'sykkelturer': 'sykkel',
    'fjelltur-om-vinteren': 'vinter',
    'fotturer-i-fjellet': 'fotturer',
    'smatt-og-godt-om-hotellet': 'smatt-og-godt',
    'hvordan-finner-jeg-bruker-jeg': 'hvordan-bruker-jeg',
    'om-hytta-leiligheten-rommet': 'om-enheten',
    'rondane-guiden': 'fjellguide',
    'vanlige-sporsmal': 'sporsmal-og-svar',
    'trugetur-til-ranglarhoe': 'trugetur-ranglarhoe',
    'lodge-idrettslag': 'idrettslag',
    'lodge-priser': 'priser',
    '360': '360-omvisning',
    'bildegalleri': 'bilder',
}
FJERN = {  # sider som ikke blir med, og hvor de sendes
    '/smittevern': '/guide/sikkerhet/',
    '/konkurranse-for-lag-og-forening': '/selskap/lodge/lag-og-foreninger/',
}
# sider som ligger under en annen side enn den som lister dem først
TVING_FORELDER = {
    '/erlingstugu': '/selskapslokaler',
    '/leiligheter': '/overnatting',
    '/miljoprofil': '/guide',
    '/smarte-tips': '/fotturer-i-fjellet',
    '/360': '/om_hotellet',
    '/historie': '/historie-oversikt',
    '/kurs-og-konferanse-2': '/guide',
    '/hotellrom-2': '/guide',
    '/konkurranse-for-lag-og-forening-2': '/lodge',
    '/lodge': '/selskap-og-arrangement',
    '/selskap': '/selskap-og-arrangement',
    '/bryllupsplanlegging': '/bryllup',
    '/stuer': '/fellesomrader',
    '/el-sykler-til-leie': '/sykkelturer',
    '/sykkeltur': '/sykkelturer',
    '/vinterturer-i-fjellet': '/fjelltur-om-vinteren',
    '/beromte-gjester': '/historie-oversikt',
    '/logoen-var': '/historie-oversikt',
    '/gildehallen-2': '/selskapslokaler',
    '/bassengregler': '/basseng',
}

def les(p):
    return open(pages[p]['file'], encoding='utf-8', errors='replace').read()

def main_html(s):
    m = re.search(r'<div id="main">(.*?)<div id="footerwrapper">', s, re.S)
    b = m.group(1) if m else ''
    b = re.sub(r'<script.*?</script>', '', b, flags=re.S)
    return b

# ---------- HTML -> markdown ----------
class Til_MD(HTMLParser):
    """Liten, målrettet konverter. Vet om det som faktisk finnes på rondane.no."""
    def __init__(self, bilde_fn):
        super().__init__(convert_charrefs=True)
        self.ut = []; self.stakk = []; self.bilde_fn = bilde_fn
        self.lenke = None; self.li = []; self.skip = 0
        self.tabell = None; self.rad = None; self.celle = None
        self.bilder = []; self.videoer = []
    def _s(self, t): 
        if self.celle is not None: self.celle.append(t)
        else: self.ut.append(t)
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('script', 'style', 'noscript', 'button'): self.skip += 1; return
        if self.skip: return
        if tag in ('h1',): self._s('\n\n# ')
        elif tag == 'h2': self._s('\n\n## ')
        elif tag == 'h3': self._s('\n\n### ')
        elif tag == 'h4': self._s('\n\n#### ')
        elif tag == 'p': self._s('\n\n')
        elif tag == 'br': self._s('  \n' if self.celle is None else ' ')
        elif tag in ('strong', 'b'): self._s('**')
        elif tag in ('em', 'i'): self._s('*')
        elif tag == 'ul': self.li.append('-'); self._s('\n')
        elif tag == 'ol': self.li.append('1.'); self._s('\n')
        elif tag == 'li': self._s('\n' + '  ' * (len(self.li) - 1) + (self.li[-1] if self.li else '-') + ' ')
        elif tag == 'a':
            href = a.get('href', '')
            yt = re.search(r'youtube\.com/(?:embed/|watch\?v=)([\w-]+)', href)
            if yt:
                self.lenke = 'YT:' + yt.group(1); self.skip += 1
                self.videoer.append(yt.group(1)); self.ut.append(f'\n\n<Video id="{yt.group(1)}" />\n\n'); return
            if re.search(r'\.pdf$', href, re.I):
                self.lenke = 'PDF:' + href; self.skip += 1; return
            self.lenke = href
            if not re.search(r'\.(jpe?g|png|gif)$', href, re.I): self._s('[')
        elif tag == 'img':
            src = a.get('src', '')
            if 'layout/fa/' in src or 'vektorer' in src: return
            lokal = self.bilde_fn(src)
            if lokal:
                alt = a.get('alt') or a.get('title') or ''
                self.bilder.append(lokal)
                self._s(f'\n\n![{alt}]({lokal})\n\n')
        elif tag == 'iframe':
            src = a.get('src', '')
            m = re.search(r'youtube\.com/embed/([\w-]+)', src)
            if m: self.videoer.append(m.group(1)); self._s(f'\n\n<Video id="{m.group(1)}" />\n\n')
        elif tag == 'table': self.tabell = []
        elif tag == 'tr' and self.tabell is not None: self.rad = []
        elif tag in ('td', 'th') and self.rad is not None: self.celle = []
        elif tag == 'blockquote': self._s('\n\n> ')
        elif tag == 'hr': self._s('\n\n---\n\n')
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript', 'button'): self.skip -= 1; return
        if tag == 'a' and self.lenke is not None and self.lenke.startswith('YT:'):
            self.lenke = None; self.skip -= 1; return
        if tag == 'a' and self.lenke is not None and self.lenke.startswith('PDF:'):
            href = self.lenke[4:]; self.lenke = None; self.skip -= 1
            href = href.replace('https://rondane.no', '').replace('http://rondane.no', '')
            if not href.startswith('/'): href = '/' + href
            self._s(f'{{{{PDF:{href}}}}}'); return
        if self.skip: return
        if tag in ('strong', 'b'): self._s('**')
        elif tag in ('em', 'i'): self._s('*')
        elif tag in ('ul', 'ol'):
            if self.li: self.li.pop()
            self._s('\n')
        elif tag == 'a':
            if self.lenke is not None and self.lenke.startswith('YT:'):
                self.lenke = None; self.skip -= 1; return
            if self.lenke is not None:
                href = self.lenke; self.lenke = None
                if re.search(r'\.(jpe?g|png|gif)$', href, re.I):
                    return
                href = href.replace('https://rondane.no', '').replace('http://rondane.no', '').replace('https://www.rondane.no', '')
                if href and not re.match(r'^(https?:|mailto:|tel:|/|#)', href): href = '/' + href
                self._s(f']({href})')
        elif tag in ('td', 'th') and self.celle is not None:
            self.rad.append(' '.join(''.join(self.celle).split())); self.celle = None
        elif tag == 'tr' and self.rad is not None:
            self.tabell.append(self.rad); self.rad = None
        elif tag == 'table' and self.tabell is not None:
            rader = [r for r in self.tabell if any(c for c in r)]
            if rader:
                n = max(len(r) for r in rader)
                rader = [r + [''] * (n - len(r)) for r in rader]
                md = '\n\n| ' + ' | '.join(rader[0]) + ' |\n|' + '---|' * n + '\n'
                for r in rader[1:]: md += '| ' + ' | '.join(r) + ' |\n'
                self.ut.append(md + '\n')
            self.tabell = None
        elif tag in ('p', 'div', 'h1', 'h2', 'h3', 'h4'): self._s('\n')
    def handle_data(self, d):
        if self.skip: return
        if self.celle is None:
            d = re.sub(r'[ \t\r\n]+', ' ', d)
        self._s(d)

def pdf_navn(sti):
    import urllib.parse as _u
    n = _u.unquote(sti).split('/')[-1].rsplit('.', 1)[0]
    n = re.sub(r'[_]+', ' ', n).replace(' -', ' – ').replace('  ', ' ').strip()
    return n + ' (PDF)'

def rydd_md(t):
    t = t.replace('\xa0', ' ')
    t = re.sub(r'\*\*\s*\*\*', '', t)
    t = re.sub(r'\*\s*\*', '', t)
    t = re.sub(r'[ \t]+\n', '\n', t)
    t = re.sub(r'\n{3,}', '\n\n', t)
    t = re.sub(r'(\*\*)\s+', r'\1 ', t)
    t = re.sub(r'\s+(\*\*)', r' \1', t)
    # "** tekst**" -> "**tekst**"
    t = re.sub(r'\*\* +', '**', t); t = re.sub(r' +\*\*', '**', t)
    t = re.sub(r'\n- *\n', '\n', t)
    t = re.sub(r'\{\{PDF:([^}]+)\}\}[ \t]*\n?[ \t]*([^\n{]*?)[ \t]*(?=\n|$|\{\{)', lambda m: f'\n- [{m.group(2).strip() or pdf_navn(m.group(1))}]({m.group(1)})\n', t)
    t = re.sub(r'\)\n\n(?=- \[)', ')\n', t)  # PDF-lister: tett liste, ikke løs
    t = t.replace('{', '&#123;').replace('}', '&#125;')
    t = re.sub(r'<(?!/?(Video|Sidefelt)\b)', '&lt;', t)
    return t.strip() + '\n'

# ---------- bilder ----------
kopiert = {}
def bilde_lokal(src):
    """uploads/... -> relativ sti fra content-fila til src/assets/bilder/..., og kopier fila."""
    if not src: return None
    src = html.unescape(src).replace('https://rondane.no/', '').replace('http://rondane.no/', '').lstrip('/')
    src = urllib.parse.unquote(src)
    if not src.startswith('uploads/'): return None
    rel = src[len('uploads/'):]
    kilde = os.path.join(RAW, rel)
    if not os.path.exists(kilde):
        alt = os.path.join(RAW, rel.replace(' ', '%20'))
        kilde = alt if os.path.exists(alt) else None
    # normaliser filnavn
    mappe, navn = os.path.split(rel)
    stem, ext = os.path.splitext(navn)
    stem = re.sub(r'[^a-z0-9]+', '-', stem.lower()).strip('-') or 'bilde'
    ext = ext.lower().replace('.jpeg', '.jpg')
    mappe = re.sub(r'[^a-z0-9/]+', '-', mappe.lower().replace('images/', '')).strip('-/')
    ny = f'{mappe}/{stem}{ext}' if mappe else f'{stem}{ext}'
    dest = os.path.join(UT, 'src/assets/bilder', ny)
    if os.path.exists(dest):
        kopiert.setdefault(ny, dest); return ny
    if kilde is None: return None
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    shutil.copyfile(kilde, dest); kopiert[ny] = kilde
    return ny  # relativ til src/assets/bilder; content-fila gjør om til ../../assets/bilder/

def hent(s, mønster):
    m = re.search(mønster, s, re.S)
    return m.group(1) if m else None

# ---------- sidetyper ----------
def analyser(p):
    s = les(p); b = main_html(s)
    tittel = html.unescape(re.sub(r'<[^>]+>', '', hent(b, r'<h1[^>]*>(.*?)</h1>') or '')).strip()
    hero = hent(b, r'pageblock-image" style="background-image:url\(([^)]+)\)')
    under = hent(b, r'<span class="prod-pris">(.*?)</span>')
    under = html.unescape(re.sub(r'<[^>]+>', '', under or '')).strip() or None
    # barn (prod-items)
    barn = []
    for m in re.finditer(r'<a href="([^"]+)" class="prod-item[^"]*"\s*>(.*?)</a>', b, re.S):
        href = html.unescape(m.group(1)).replace('https://rondane.no', '')
        inner = m.group(2)
        img = hent(inner, r'<img src="([^"]+)"')
        t = html.unescape(re.sub(r'<span class="prod-pris">.*?</span>', '', hent(inner, r'<div class="prod-title">(.*?)</div>') or '', flags=re.S))
        t = re.sub(r'<[^>]+>', '', t).strip()
        u = hent(inner, r'<span class="prod-pris">(.*?)</span>')
        u = html.unescape(re.sub(r'<[^>]+>', '', u or '')).strip() or None
        barn.append({'href': href, 'tittel': t, 'under': u, 'bilde': bilde_lokal(img) if img else None})
    # hovedtekst
    deler = []
    for m in re.finditer(r'<div class="block-(?:left|full)">(.*?)</div>\s*</div>\s*(?:<div class="block-right">|</div>)', b, re.S):
        deler.append(m.group(1))
    if not deler:
        # indeksside: første pageblock uten bilde
        m = re.search(r'<div class="pageblock">(.*?)</div>\s*<div class="prod-block">', b, re.S)
        if m: deler.append(m.group(1))
        else:
            m = re.search(r'<div class="pageblock">(.*?)<div class="page-right">', b, re.S)
            if m: deler.append(m.group(1))
    side = hent(b, r'<div class="block-right">(.*?)</div>\s*</div>\s*</div>\s*<div class="page-right">')
    if side is None:
        side = hent(b, r'<div class="block-right">(.*?)<div class="page-right">')
    # galleri
    galleri = []
    for m in re.finditer(r'<a class="group" href="([^"]+)"[^>]*>', b):
        loc = bilde_lokal(m.group(1))
        if loc: galleri.append(loc)
    # blogg
    dato = hent(b, r'calendar-alt\.png" alt=""> *([\d.]+)')
    bloggbilde = hent(b, r'<div class="blogdetail-image"><img src="([^"]+)"')
    return dict(tittel=tittel, hero=hero, under=under, barn=barn, deler=deler, side=side, galleri=galleri, dato=dato, bloggbilde=bloggbilde, b=b)

def md_av(htmlbit):
    p = Til_MD(bilde_lokal); p.feed(htmlbit or '')
    return rydd_md(''.join(p.ut)), p.bilder, p.videoer

# forfattere fra bloggindeksen
forf = {}
bl = main_html(les('/blogg'))
for m in re.finditer(r'<h2[^>]*>(.*?)</h2>\s*<div class="blogitem-date">(.*?)</div>', bl, re.S):
    t = html.unescape(re.sub(r'<[^>]+>', '', m.group(1))).strip()
    meta = html.unescape(re.sub(r'<[^>]+>', ' ', m.group(2)))
    mm = re.search(r'(\d\d\.\d\d\.\d{4})\s+(\d\d:\d\d)\s*(.*)', meta)
    if mm: forf[t] = (mm.group(1), mm.group(3).strip())

# ---------- bygg treet ----------
info = {}
for p in pages:
    if 'file' not in pages[p] or p in FJERN or p.startswith('/blogg') or p == '/': continue
    info[p] = analyser(p)

forelder = {}
rekke = {}
for sek, idx in SEKSJONER.items():
    for i, b in enumerate(info[idx]['barn']):
        h = b['href']
        if h.startswith('http') or h not in info: continue
        forelder.setdefault(h, idx); rekke.setdefault(h, i)
for p, d in info.items():
    for i, b in enumerate(d['barn']):
        h = b['href']
        if h.startswith('http') or h not in info: continue
        forelder.setdefault(h, p); rekke.setdefault(h, i)
for h, f in TVING_FORELDER.items():
    if h in info: forelder[h] = f
# manuelle plasseringer for sider ingen indeks lister
MANUELL = {'/dobbeltrom-mini': '/hotellrom', '/okonomi-dobbeltrom': '/hotellrom', '/fjellhytta': '/leie-hytte-i-rondane', '/hytter': '/leie-hytte-i-rondane',
           '/fangstgraver': '/fotturer-i-fjellet', '/lodge-priser': '/lodge', '/lodge-idrettslag': '/lodge', '/villmarkskroen': '/lodge'}
for h, f in MANUELL.items():
    if h in info and h not in forelder: forelder[h] = f

sek_av_idx = {v: k for k, v in SEKSJONER.items()}
def ny_sti(p):
    if p in sek_av_idx: return '/' + sek_av_idx[p] + '/'
    slug = p.strip('/').split('/')[-1]
    slug = NYSLUG.get(slug, slug)
    f = forelder.get(p)
    if f is None:
        return '/om-hotellet/' + slug + '/'
    return ny_sti(f).rstrip('/') + '/' + slug + '/'
def seksjon_av(p):
    while p not in sek_av_idx:
        p = forelder.get(p)
        if p is None: return 'om-hotellet'
    return sek_av_idx[p]

# ---------- skriv ----------
os.makedirs(f'{UT}/src/content/sider', exist_ok=True)
os.makedirs(f'{UT}/src/content/blogg', exist_ok=True)
for f in os.listdir(f'{UT}/src/content/sider'): os.remove(f'{UT}/src/content/sider/{f}')
for f in os.listdir(f'{UT}/src/content/blogg'): os.remove(f'{UT}/src/content/blogg/{f}')

omdir = dict(FJERN)
rapport = []
def fm_str(v):
    return json.dumps(v, ensure_ascii=False)

for p, d in sorted(info.items()):
    ns = ny_sti(p)
    if ns != p + '/' : omdir[p] = ns
    tekst, bilder, videoer = md_av(''.join(d['deler']))
    tekst = re.sub(r'^\s*# .*?\n', '', tekst, count=1)  # h1 er i frontmatter
    sidetekst, sbilder, svid = md_av(d['side']) if d['side'] else ('', [], [])
    # fjern bestill-knapper og tomme linjer fra sidefeltet
    sidetekst = re.sub(r'\[?Bestill (ditt opphold|på epost|lokale på epost)[^\n]*\n?', '', sidetekst)
    sidetekst = re.sub(r'\[Bestill ditt opphold her\]\([^)]*\)', '', sidetekst)
    sidetekst = rydd_md(sidetekst) if sidetekst.strip() else ''
    hero = bilde_lokal(d['hero']) if d['hero'] else None
    if not hero:
        # første bilde i barn eller tekst
        for b in d['barn']:
            if b['bilde']: hero = b['bilde']; break
    if not hero and bilder: hero = bilder[0]
    def barn_sti(h):
        if h in info: return ny_sti(h)
        if h.startswith('/blogg/'): return '/blogg/' + re.sub(r'[^a-z0-9]+', '-', h.split('/')[-1].lower()).strip('-') + '/'
        return FJERN.get(h, h)
    barn = [{'sti': barn_sti(b['href']), 'tittel': b['tittel'], 'under': b['under'], 'bilde': b['bilde']} for b in d['barn'] if b['href'] not in FJERN]
    fm = {
        'tittel': d['tittel'], 'undertittel': d['under'], 'seksjon': seksjon_av(p), 'sti': ns,
        'forelder': ny_sti(forelder[p]) if p in forelder else None, 'rekkefolge': rekke.get(p, 99),
        'hero': f'../../assets/bilder/{hero}' if hero else None,
        'barn': barn, 'galleri': [f'../../assets/bilder/{g}' for g in d['galleri']],
        'gammelSti': p,
    }
    fmtxt = '---\n' + ''.join(f'{k}: {fm_str(v)}\n' for k, v in fm.items() if v not in (None, [], '')) + '---\n\n'
    kropp = tekst.replace('](', '](').replace('![', '![')
    kropp = re.sub(r'\]\(([a-z0-9][^)]*\.(?:jpg|png|gif))\)', r'](../../assets/bilder/\1)', kropp)
    if hero:
        kropp = kropp.replace(f'![](../../assets/bilder/{hero})\n', '', 1)
    if sidetekst:
        sidetekst = re.sub(r'\]\(([a-z0-9][^)]*\.(?:jpg|png|gif))\)', r'](../../assets/bilder/\1)', sidetekst)
        kropp += '\n\n<Sidefelt>\n\n' + sidetekst + '\n</Sidefelt>\n'
    navn = ns.strip('/').replace('/', '__') + '.mdx'
    open(f'{UT}/src/content/sider/{navn}', 'w').write(fmtxt + kropp)
    rapport.append((p, ns, len(kropp.split()), len(barn), len(d['galleri'])))

# blogg
for p in sorted(pages):
    if not p.startswith('/blogg/') or 'file' not in pages[p]: continue
    d = analyser(p)
    slug = re.sub(r'[^a-z0-9]+', '-', p.split('/')[-1].lower()).strip('-')
    tekst, bilder, videoer = md_av(d['b'])
    tekst = re.sub(r'^\s*# .*?\n', '', tekst, count=1)
    tekst = re.sub(r'^\s*\d\d\.\d\d\.\d{4}\s*\d\d:\d\d[^\n]*\n', '', tekst, count=1)
    tekst = re.sub(r'\n\[Gå tilbake\]\([^)]*\)\s*$', '\n', tekst)
    tekst = re.sub(r'\]\(([a-z0-9][^)]*\.(?:jpg|png|gif))\)', r'](../../assets/bilder/\1)', tekst)
    dato, forfatter = forf.get(d['tittel'], (d['dato'] or '', ''))
    hero = bilde_lokal(d['bloggbilde']) if d['bloggbilde'] else (bilder[0] if bilder else None)
    if hero and tekst.count(hero) : pass
    iso = None
    if dato:
        dd, mm, yy = dato.split('.'); iso = f'{yy}-{mm}-{dd}'
    fm = {'tittel': d['tittel'], 'dato': iso, 'forfatter': forfatter or None, 'hero': f'../../assets/bilder/{hero}' if hero else None, 'gammelSti': p, 'sti': f'/blogg/{slug}/'}
    fmtxt = '---\n' + ''.join(f'{k}: {fm_str(v)}\n' for k, v in fm.items() if v not in (None, '')) + '---\n\n'
    # første bilde i teksten er hero-bildet; ikke vis det to ganger
    if hero: tekst = tekst.replace(f'![](../../assets/bilder/{hero})\n', '', 1)
    open(f'{UT}/src/content/blogg/{slug}.mdx', 'w').write(fmtxt + rydd_md(tekst))
    omdir[p] = f'/blogg/{slug}/'
omdir['/blogg'] = '/blogg/'

json.dump(omdir, open(f'{ROT}/verktoy/omdirigeringer.json', 'w'), ensure_ascii=False, indent=1)
json.dump({p: ny_sti(p) for p in info}, open(f'{ROT}/verktoy/stier.json', 'w'), ensure_ascii=False, indent=1)
print(len(rapport), 'sider,', len(os.listdir(f'{UT}/src/content/blogg')), 'blogginnlegg,', len(kopiert), 'bilder kopiert')
print('uten forelder:', [p for p in info if p not in forelder and p not in sek_av_idx])
for p, ns, ord_, nb, ng in rapport: print(f'{ord_:5d} ord {nb:2d} barn {ng:3d} gal  {p:50s} -> {ns}')
