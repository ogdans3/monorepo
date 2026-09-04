# Hva koster Norge?

Statsbudsjettet regnet om til vanlige årslønner, med partienes alternative
budsjetter ved siden av. Mobil først, norsk, ingen konto og ingenting å
logge inn på.

Ideen er én enkelt oversettelse: et budsjett på tusen milliarder betyr
ingenting for noen, men "så mange menneskers årslønn" gjør det. Hvert merke
i feltene på siden er én gjennomsnittlig årslønn i Norge.

## Status

Lønnstallet er ekte og hentet fra SSB. **Budsjettallene er ikke.** De er
plassholdere, merket `foreløpig: true` i `src/lib/data.ts`, og siden viser
en tydelig advarsel så lenge flagget står. Ingenting kan publiseres før de
er byttet ut.

Grunnen er at `statsbudsjettet.no` og `regjeringen.no` begge svarer 403 bak
botbeskyttelse, også fra en ekte nettleser, og partienes alternative
budsjetter finnes bare som PDF hos hvert enkelt parti. De må lastes ned for
hånd og legges i `data/kilder/`.

## Stack

- **SvelteKit** (Svelte 5 runes) med `@sveltejs/adapter-node`
- **vitest** for de rene delene
- Ingen komponentbibliotek, ingen CSS-rammeverk, ingen avhengigheter i
  nettleseren utover det Svelte selv legger igjen
- Schibsted Grotesk, selvhostet som woff2, så siden ikke gjør en
  tredjepartsforespørsel per besøk

## Kommandoer

```sh
pnpm install
pnpm dev
pnpm test      # rene funksjoner, særlig omregningen
pnpm check     # svelte-check
pnpm build     # prerendrer alt
pnpm start     # serverer bygget, PORT styrer porten
```

## Hvordan det henger sammen

- `src/lib/data.ts` — alle tall, og en `Kilde` på hvert av dem. Typene
  håndhever at ingenting kan vises uten kilde.
- `src/lib/format.ts` — oversettelsen fra kroner til årslønner, og norsk
  tallformatering. Ren og testet, fordi en plausibel feil her ser nøyaktig
  ut som et riktig svar.
- `src/lib/Merkefelt.svelte` — feltet, tegnet på canvas.

### Målestokken er felles, og det er med vilje

Alle felt på en side deler én målestokk, satt ut fra det største feltet og
sendt inn som `skala`. Første versjon lot hvert felt velge sin egen, og da
tegnet en post på 350 milliarder og en på 45 milliarder omtrent like store
rektangler. Det er akkurat løgnen bildet finnes for å unngå: to felt som
ikke står i samme målestokk kan ikke sammenlignes, og å sammenligne dem er
det eneste en leser kommer til å gjøre.

Konsekvensen er at små poster blir tynne striper. Det er ikke et
layoutproblem som skal løses, det er funnet.

## Deploy

Enkeltcontainer via master-dashboard, som beskrevet i `/home/ai_user/git/README.md`.
`Dockerfile` og `.dashboard.yaml` er alt som trengs, og dashbordet håndterer
TLS og ingress selv.

Én ting er lett å glemme: dashbordet oppdager bare mapper som ligger rett i
`/home/ai_user/git/`. Dette prosjektet bor i monorepoet, så det finnes en
symlink `git/hva-koster-norge -> monorepo/hva-koster-norge`, samme mønster
som checkpost og image-tools. Uten den dukker prosjektet aldri opp.

Verifisert lokalt med `docker build` og `docker run`: containeren svarer 200
og logger `Listening on http://0.0.0.0:3000`.

## Design

`PRODUCT.md` (register, brukere, prinsipper) og `DESIGN.md` (farger,
typografi, felt, bevegelse) er autoriteten. Kortversjonen: ren hvit flate,
mineralsk grønn, én skriftfamilie, og all visuell vekt i merkefeltet.
