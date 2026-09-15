# Rondane Høyfjellshotell — rondane.no

Nettstedet til Rondane Høyfjellshotell på Mysuseter: et statisk Astro-nettsted
med alt innholdet fra det gamle rondane.no (104 sider, 32 blogginnlegg,
~470 bilder), bygget for telefon og for søkemotorer.

`PRODUCT.md` sier hva sida skal gjøre, `DESIGN.md` hvordan den ser ut,
`CLAUDE.md` er for den som skal endre noe.

## Kom i gang

```bash
pnpm install
pnpm dev           # utviklingsserver på http://localhost:4321
pnpm build         # bygger dist/ (noen minutter — bildene)
pnpm start         # kjører server.js mot dist/ på :3000, med 301-ene
```

Node 22 og pnpm 10.

## Hva som ligger hvor

```
src/content/sider/    104 sider som MDX, én fil per adresse
src/content/blogg/     32 blogginnlegg
src/content.config.ts  skjemaet for frontmatter
src/assets/bilder/     bildene, optimalisert av Astro ved bygg
src/pages/             forside, [...sti] (alle sider), blogg, 404, robots
src/components/        Topp, Bunn, Hero, Kort, Sidefelt, Galleri, Video …
src/data/hotell.ts     adresse, telefon, booking-lenker, driftsvarsel
src/data/meny.ts       hovedmenyen
public/fonts/          Barlow + Source Serif 4, selvhostet
server.js              node:http, serverer dist/ og svarer 301 på gamle adresser
omdirigeringer.json    gammel adresse -> ny adresse (134 stk)
verktoy/               skriptene som flyttet innholdet, og endringsloggen
```

## Innholdet

Hver side er en MDX-fil med frontmatter:

```yaml
tittel: "Dobbeltrom"
undertittel: "fra NOK 1095,-"          # sto i bildet på gamle rondane.no
seksjon: "overnatting"
sti: "/overnatting/hotellrom/dobbeltrom/"
forelder: "/overnatting/hotellrom/"
hero: "../../assets/bilder/box/dobbeltrom-delvis-oppusset2.jpg"
```

Teksten under er vanlig markdown. `<Sidefelt>…</Sidefelt>` er faktafeltet ved
siden av teksten, `<Video id="…" />` er en YouTube-video som lastes ved klikk.

Sidene som lister undersider (Hotellrommene, Fotturer …) har `barn:` i
frontmatter, i samme rekkefølge som på gamle rondane.no. Undersider som ikke
står der, men har `forelder` satt, kommer automatisk etterpå.

## Adressene

Alle gamle adresser svarer med 301 til den nye. Strukturen er
`/<seksjon>/<side>/`, f.eks. `/hotellrom` → `/overnatting/hotellrom/`. Lista
er `omdirigeringer.json`; `server.js` gjør jobben. Se `verktoy/endringer.md`
for det som ble slått sammen eller tatt bort.

## Teknisk SEO

- Én kanonisk adresse per side, alltid med skråstrek på slutten.
- `<title>` og `description` per side; description utledes fra teksten om
  frontmatter ikke har en.
- Open Graph og Twitter-kort med bilde per side (hero-bildet, 1200×630).
- Strukturert data: `Hotel` på alle sider, `BreadcrumbList` per side,
  `BlogPosting` per innlegg, `FAQPage` på spørsmål og svar.
- `sitemap-index.xml` og `robots.txt` genereres ved bygg.
- Bilder som avif/webp med `srcset` og `sizes`; heisen `fetchpriority=high`,
  alt annet `loading=lazy`. Bredde og høyde på alt, så ingenting hopper.
- Fonter selvhostet med `font-display: swap` og metrikk-tilpasset reserve.
- Ingen eksterne skript, ingen render-blokkerende ressurser.

## Drift

Bygges og startes gjennom dashboardet. Dockerfila bygger i ett trinn og kjører
i et annet; i drift finnes bare `node`, `dist/`, `server.js` og
`omdirigeringer.json`.

`PUBLIC_SITE` setter kanonisk adresse. Standard er `https://rondane.no`.
