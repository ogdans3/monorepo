# Å jobbe i dette prosjektet

Les `README.md` først. `PRODUCT.md` og `DESIGN.md` er kontrakten.

Dette er en mappe i et monorepo der ingenting krysser mappegrenser.

## Invarianter

**Alt innhold fra gamle rondane.no skal være med.** 104 sider og 32
blogginnlegg. Fjernes eller endres en tekst, skal det stå i
`verktoy/endringer.md`. Tonen er hotellets egen og skal ikke poleres.

**Innholdet er MDX i `src/content/`, generert én gang av
`verktoy/konverter.py` + `verktoy/rydd.py` fra en crawl av det gamle
nettstedet.** Skriptene ligger her som dokumentasjon på hvordan innholdet
kom hit. De skal *ikke* kjøres på nytt: de sletter `src/content/sider/` og
`src/content/blogg/` først, og alt hotellet har redigert siden går tapt.
Redigér MDX-filene direkte.

**Hver gammel adresse svarer 301 til den nye.** `omdirigeringer.json` er
lista, `server.js` er det som svarer. Astro sin egen `redirects` er ikke
brukt, fordi den lager HTML med meta-refresh, ikke 301. Flytter du en side,
legg den gamle stien i lista.

**`sti` i frontmatter er sannheten om adressen.** `[...sti].astro` bygger
ruta fra den, brødsmulene slår opp i den, menyen og bunnen finner
undersider via `forelder`. Endre `sti`, og legg den gamle i
`omdirigeringer.json`.

**`hotell.varsel` i `src/data/hotell.ts` er driftsvarselet.** Tom streng =
ingenting vises. Sett teksten der når hotellet holder stengt, og topplinja
kommer på alle sider.

**Bilder ligger i `src/assets/bilder/` og går gjennom Astro.** Aldri
`public/` for innholdsbilder — da mister de avif/webp og `srcset`. Nye
bilder: legg dem i `src/assets/bilder/<mappe>/` med små bokstaver og
bindestreker, og referer relativt fra MDX (`../../assets/bilder/...`).

**Ingen eksterne skript.** Ingen Google Fonts, ingen analyse, ingen
chat-widget, ingen Facebook-boks. YouTube lastes først ved klikk, fra
`youtube-nocookie.com`. Personvernsida beskriver det som faktisk kjører.

**Kontrast måles på ferdig side.** `--fjell-lys` (logoblått) feiler som
tekst på frost. Se `DESIGN.md`.

## Bygg og drift

```bash
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # dist/ — tar noen minutter, det er ~500 bilder
pnpm start      # node server.js mot dist/, med 301-ene
```

Deploy gjennom dashboardet. `Dockerfile` bygger i to trinn; i drift kjører
bare `node server.js`, `dist/` og `omdirigeringer.json`. Ingen avhengigheter
i drift.

`PUBLIC_SITE` overstyrer kanonisk adresse (standard `https://rondane.no`).
Forhåndsvisningen på rondane.freelunch.no må settes med
`PUBLIC_SITE=https://rondane.freelunch.no` om den ikke skal peke canonical
mot rondane.no.

## Konvensjoner

- Norsk bokmål i kode, kommentarer og commit-meldinger for dette prosjektet;
  produktet er norsk.
- Conventional Commits. Commit og push hver ferdige bit.
- Kommentarer forklarer *hvorfor*.
