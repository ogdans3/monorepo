"""Redaksjonell rydding etter konverteringen. Alt som endres, listes i
verktoy/endringer.md så hotellet kan se nøyaktig hva som ble gjort."""
import json, re, os, glob, urllib.parse
UT = '/home/ai_user/git/monorepo/rondane'
omdir = json.load(open('/tmp/rondane/verktoy/omdirigeringer.json'))
dok = json.load(open('/tmp/rondane/verktoy/dokumenter.json'))
logg = []

# Lenker som pekte til sider som ikke fantes på gamle rondane.no (404).
DODE = {
    '/restaurant': '/om-hotellet/restaurant/', '/pizza-og-basseng': '/om-hotellet/restaurant/',
    '/rafting': None, '/toghoyfjellskonferanser': None, '/rondane-business-center': None,
    '/kurs_og_konferanse_priser': '/kurs-og-konferanse/pakker/', '/smittevern': '/guide/sikkerhet/',
    '/lunsj': '/om-hotellet/restaurant/', '/middag': '/om-hotellet/restaurant/', '/spa': '/basseng/',
    '/pakker': 'https://booking.rondane.no/no/package/list', '/gjestebilder': '/bilder/',
    '/juleferie-2017': None, '/Les mer om skoleferiene her': None,
}
PATCHER = [  # (fil-glob, gammel tekst (regex), ny tekst, forklaring)
    ('sider/guide__hvordan-bruker-jeg.mdx', r'Svømmebassenget er nå stengt frem til 17\. februar 2023\.\s*', '', 'Fjernet utdatert melding om at bassenget var stengt til februar 2023.'),
    ('sider/tur-og-aktiviteter__fotturer__kvitskriuprestein.mdx', r'NB\. STEINENE HAR PR MAI 2023 RAST SAMMEN!!', '**Merk:** Flere av formasjonene raste sammen i mai 2023.', 'Skrev om varselet om Kvitskriuprestein til en vanlig setning.'),
    ('sider/guide__fjellguide.mdx', r'Dette er våre priser til 2023:', 'Veiledende priser (2023):', 'Merket moskussafari-prisene med årstall.'),
    ('sider/guide__fjellguide.mdx', r'Booking er åpent for vanlig moskussafari på følgende datoer\.', 'Booking var åpent for vanlig moskussafari på følgende datoer (2023):', 'Merket safari-datoene som 2023-datoer.'),
    ('sider/guide__velkommen-til-oss.mdx', r'Pr nå har ikke skianlegget en operativ heis eller tilbud grunnet økonomiske årsaker og rullering av arealplanen\. Skisentret vil tidligst være i normal drift fra 2023\.', 'Skianlegget har de siste sesongene ikke hatt heisen i ordinær drift. Sjekk rondane-skianlegg.no for status.', 'Skrev om utdatert setning om skianlegget (2022).'),
    ('sider/guide__sikkerhet.mdx', r'Se rondane\.no/smittevern for oppdatert info\. Vi holder nå tilnærmet normal drift\. ', '', 'Fjernet henvisning til smittevernsiden (Covid), som er tatt bort.'),
    ('sider/guide__takk-for-na.mdx', r'\*\*Rondane Rewards\*\*', '**Bestill direkte, få fordeler**', 'Rondane Rewards het det ikke noe annet sted; brukte samme navn som på fordelssiden.'),
    ('sider/*.mdx', r'\n\s*Bestill ditt opphold her\s*\n', '\n', 'Fjernet løse «Bestill ditt opphold her»-linjer i teksten (knappen ligger i toppen og bunnen av alle sider).'),
    ('sider/*.mdx', r'\n\s*Bestill på epost\s*\n', '\n', 'Fjernet løse «Bestill på epost»-linjer.'),
    ('sider/*.mdx', r'\n\s*Bestill lokale på epost\s*\n', '\n', 'Fjernet løse «Bestill lokale på epost»-linjer.'),
    ('sider/*.mdx', r'\n\s*Kontakt oss på epost\s*\n', '\n', 'Fjernet løse «Kontakt oss på epost»-linjer.'),
    ('sider/*.mdx', r'\n\s*Sjekk skisporene her\s*\n', '\n', 'Fjernet løse «Sjekk skisporene her»-linjer (lenka finnes under Tur og aktiviteter).'),
    ('sider/*.mdx', r'\(Trykk på bildet for større kart\)', '', 'Fjernet «trykk på bildet»-instruks som ikke lenger stemmer.'),
    ('blogg/*.mdx', r'\n\s*Gå tilbake\s*$', '\n', 'Fjernet «Gå tilbake»-lenke nederst i innlegg.'),
]
def ny_lenke(href):
    href = urllib.parse.unquote(href)
    # ødelagte lenker fra gamle CMS-et: « https://…» med mellomrom foran, og «rondane.no/…» uten skjema
    href = re.sub(r'^/?\s*(https?:)/+', r'\1//', href.strip())
    href = re.sub(r'^/?rondane\.no/', '/', href)
    if href.startswith('/file://localhost/tel/'): return 'tel:' + re.sub(r'\s', '', href.split('/tel/')[1])
    h = href.replace('https://rondane.no', '').replace('http://rondane.no', '').replace('https://www.rondane.no', '')
    if h.startswith('http') or h.startswith('mailto:') or h.startswith('tel:') or h.startswith('#'): return href
    if not h.startswith('/'): h = '/' + h
    if h.startswith('/uploads/'):
        return dok.get(h) or dok.get(urllib.parse.quote(h)) or None
    base = h.split('#')[0].split('?')[0].rstrip('/') or '/'
    if base in DODE: return DODE[base]
    if base in omdir: return omdir[base]
    if base == '/': return '/'
    if base.startswith('/blogg'): return '/blogg/'
    return None

antall_lenker = 0; dode = 0
for fil in glob.glob(f'{UT}/src/content/**/*.mdx', recursive=True):
    t = open(fil).read(); o = t
    def bytt(m):
        global antall_lenker, dode
        tekst, href = m.group(1), m.group(2)
        ny = ny_lenke(href)
        if ny is None: dode += 1; return tekst
        if ny != href: antall_lenker += 1
        return f'[{tekst}]({ny})'
    t = re.sub(r'(?<!!)\[((?:!\[[^\]]*\]\([^)]*\)|[^\]])*)\]\(([^)\s]+)\)', bytt, t)
    for g, gammel, ny, hvorfor in PATCHER:
        if glob.fnmatch.fnmatch(fil.replace(f'{UT}/src/content/', ''), g):
            t2 = re.sub(gammel, ny, t, flags=re.M)
            if t2 != t:
                logg.append((fil.replace(f'{UT}/src/content/', ''), hvorfor)); t = t2
    t = re.sub(r'\n{3,}', '\n\n', t)
    if t != o: open(fil, 'w').write(t)

sett = []
for f, h in logg:
    if (f, h) not in sett: sett.append((f, h))
with open(f'{UT}/verktoy/endringer.md', 'w') as f:
    f.write('# Redaksjonelle endringer fra gamle rondane.no\n\nAlt innhold er med. Dette er det som ble endret i flyttingen, utover ny struktur og nye adresser.\n\n')
    f.write('## Sider som ble tatt bort\n\n- `/smittevern` (Covid-tiltak fra 2020–22) → sender videre til `/guide/sikkerhet/`.\n- `/konkurranse-for-lag-og-forening` (konkurranse med frist 30. januar 2020) → sender videre til `/selskap/lodge/lag-og-foreninger/`.\n\n')
    f.write('## Sider som ble slått sammen eller flyttet\n\n- To «Historie»-sider: oversikten ligger på `/om-hotellet/historie/`, den lange fortellingen på `/om-hotellet/historie/hotellets-historie/`.\n- «Selskap» (indeks) og «Selskap | Utleie lokaler | Konfirmasjon» ligger nå på `/selskap/` og `/selskap/konfirmasjon-og-utleie/`.\n- Gjesteguidens «Velkommen til oss» og «Kurs og konferanse» ligger under `/guide/`, adskilt fra sidene med samme navn i hovedmenyen.\n- Ny side `/om-hotellet/restaurant/`, satt sammen av restauranttekstene som lå spredt på Miljøprofil, Ankomst og Vanlige spørsmål. Gamle rondane.no lenket til `/restaurant`, som ikke fantes.\n\n')
    f.write('## Tekst som ble endret\n\n' + ''.join(f'- `{fi}`: {h}\n' for fi, h in sett))
    f.write(f'\n## Dokumenter\n\n- {len(set(dok.values()))} PDF-er (løypekart, turguider, turkart) er flyttet til `/dokumenter/` og lenkene oppdatert.\n')
    f.write(f'\n## Lenker\n\n- {antall_lenker} interne lenker skrevet om til de nye adressene.\n- {dode} lenker til sider som ikke fantes på gamle rondane.no (f.eks. /rafting, /toghoyfjellskonferanser) er gjort om til vanlig tekst.\n- Alle gamle adresser svarer med 301 til den nye (se `omdirigeringer.json`).\n')
print(f'rydd: {len(sett)} tekstendringer, {antall_lenker} lenker skrevet om, {dode} døde lenker fjernet')
