# Fullføring av lokal lanseringsversjon

Bestilt: «Lag alt». Omfatter restlisten i produkt-plan.md. Ekstern serverdrift og
punktene under «Senere» er fortsatt utenfor den lokale lanseringsversjonen.

- [x] Versjonerte migreringer, produktroller, produktgrunnlag og passordgjenoppretting.
- [x] Bibliotek: samlinger, favoritter, etiketter, bulk, CSV, innboks, relasjoner, rettigheter, papirkurv.
- [x] Medier: gjenopptakbar opplasting, duplikater, ny filversjon, miniatyr/proxy, transkript/OCR/sekvenser.
- [x] Søk: lokal semantikk og visuell likhet, filtre, tidskoder og lagrede søk.
- [x] Produksjon: maler, varianter, agentbestilling, revisjoner, leveransepakker og kildefiler.
- [x] AI: rolle-/produktprofiler, kontekst/vedlegg, Jev, analyse, strømming, budsjetter og stopp.
- [x] Planlegging: måned, redigering, varsler, kommentarer/omtaler og vurderinger.
- [x] Læring: kampanjer, eksperimenter, måleimport, UTM, konverteringer/refusjoner, kunnskap.
- [x] MCP/REST/CLI for de nye arbeidsflytene, kontekstpakker, hendelser og tilgangskontroll.
- [x] Deling, eksport, sikkerhetskopiering og verifisert gjenoppretting, driftsoversikt.
- [x] Tester på API/tilgang, leverandørkontrakter, mobil/desktop og dokumentert aktivering.

## Verifisering 2. oktober 2026

- Go-integrasjonstestene med `-race`: bestått, inkludert produktroller/private søk,
  invitasjoner/reset, deling/papirkurv, chunk-offset/idempotens/duplikater, låste
  malfelt, agentleveranser/revisjoner, daglig budsjett/lagringsgrense, Jev-kontrakt,
  strømming og stopp av verktøyløkker.
- Svelte/TypeScript: null feil og advarsler. Produksjonsbygg: bestått.
- Playwright: 4 av 4 bestått, fordelt på desktop og 390 px mobil. Bibliotek,
  versjoner, oppgave, kalender, publisering, produksjonsmal, kampanje, delingslenke
  uten innlogging, kunnskap og ingen horisontal sideoverflyt.
- Faktisk lokal medietest: bildeopplasting → miniatyr → Tesseract-OCR → semantisk
  norsk søk → bildelikhet. Syntetisk video med tale → mobilproxy og gjenkjent
  Whisper-transkript. Isolert database/filvolum, ingen kjøpte kall eller persondata.
- Backup/restore: separat database og utpakking, refererte filer og SHA-256 sjekket.
- Python-avhengigheter: `pip check` bestått. PyAV 19-kompatibilitetsfeilen ble
  funnet av ekte transkriberingstest og rettet med låst PyAV 16.1.0.

## Krever oppkobling før faktisk bruk

OpenRouter/TypeSafe trenger brukerens nøkler og valgte modeller. En ekstern agent
må kobles til MCP for å produsere video og design. Konverteringsavsenderen må
integreres mot Studio-mottaket. Disse forbindelsene, serverdrift og punktene under
«Senere» er ikke kjørt eller presentert som ferdige integrasjoner.

## Lenkeimport — 2. oktober 2026

- Implementert varig importkø, fremdrift, stopp og manuelt nytt forsøk. Kilde,
  opphav, rettigheter, filversjon og kategoriforslag følger videoen i biblioteket.
- Offentlige enkeltvideoer fra Instagram, TikTok og Snapchat Spotlight. Direkte
  HTTP-video, maks 512 MiB / 30 minutter, fem minutters nedlasting. Ingen cookies
  eller påloggede/private plattformdata. Ingen automatisk retry.
- Go/Postgres med race-detektor: produkttilgang, agentavgrensning/tilbakekalling,
  samtidige kvoter, URL-/filduplikater, avbrudd/opprydding, gjenforsøk og at et
  menneskes kategori vinner over pågående modellberegning.
- Python: faktisk yt-dlp-nedlasting fra kontrollerte HTTP-svar og FFprobe på en
  syntetisk MP4. Tester for ISO5-MP4, ugyldige filer, direktestrøm/album/størrelse,
  private nettadresser, blandet DNS og videresendinger.
- Lokale modeller: riktig kategori for design, norsk baking og norsk bilkjøring;
  tom tekst og et blankt videobilde forblir ukategorisert.
- Hele Playwright-settet: **6/6** bestått på desktop og 390 px mobil. Importens
  eksterne nedlaster er en lokal fixture i nettlesertestene; kø, API, database,
  stopp, feilhåndtering, kategoriendring og filtrering bruker reell Studio-kode.
- Faktiske plattformtester: **Instagram Reel og Snapchat Spotlight lastet ned**,
  lagret og ferdig mediebehandlet med lokal kategorisering. Instagrams ISO5-brand
  avdekket en MIME-feil som er rettet med validering av faktiske videospor.
  Lydløse importer hopper over talegjenkjenning. **TikTok blokkerte testlenken**;
  vellykket nedlasting derfra er derfor ikke bekreftet fra dette nettverket.
- TypeScript/Svelte og containerbygg bestått. Ingen betalte AI-kall eller ekstern
  publisering. Plattformenes tilgjengelighet kan endre seg mellom forespørsler.

## MCP på samme domene — 2. oktober 2026

- Rettet manglende `/mcp`-proxy i SvelteKit. Den offentlige webporten videresender
  MCP til intern API, med Bearer-, Origin- og MCP-headere og uendrede statuser.
- Innstillinger og opprettelse av agentnøkler bruker arbeidsrommets adresse.
  `.dashboard.yaml` peker fortsatt til web; API-porten forblir intern.
- Manglende/ugyldig agentnøkkel gir 401 med Bearer-challenge. Autentisert GET og
  DELETE gir 405: serveren er stateless og bruker POST med JSON-svar. Ugyldig
  Origin avvises fortsatt. Verktøyskjemaer har tom required-liste i stedet for null.
- Go/Postgres med race-detektor bestått. Åtte nettlesertester bestått; egne MCP-
  tester verifiserer initialize, notifications, tools/list, headerformidling,
  ugyldig protokoll, tilbakekalling og riktig adresse på desktop og mobil.
- Produksjonscontainerne bygget og startet lokalt; web svarer 200, og GET/POST
  på webportens `/mcp` svarer 401 uten nøkkel. Deploy til `studio.freelunch.no`
  startes manuelt. Ekstern kontroll ble stoppet foran appen av Cloudflare 403/1010;
  vellykket MCP-tilkobling på det deployede domenet er foreløpig ikke verifisert.

## Annonser, gjennomgang og ytelse — 8. oktober 2026

- Ny startside for annonser med typer, brief, stabil produktavgrenset nøkkel og
  nummererte filversjoner. Første faktiske opplasting blir v1. Konseptets tittel
  bevares, og alle versjoner viser fullstendige filnavn.
- Egne `/ads/{id}`- og `/library/{id}`-sider med tilbake/fremover, delbare lenker,
  versjonsvalg i URL, videoavspilling, side-ved-side-sammenligning og tidskoder.
  Kommentarer, omtaler, løste notater og valgfrie videoguider er beholdt.
- Godkjenning/endringsønsker knyttes til eksakt versjon. Parallelle opplastinger
  med gammel expected-version avvises. Eksisterende filer kan organiseres til en
  annonse eller kopieres inn som neste versjon uten å slette originaloppføringen.
- MCP-verktøyene `studio_list_ads`, `studio_create_ad`, `studio_get_ad` og
  `studio_prepare_ad_upload`, samt CLI `upload --ad-id`, gir eksterne agenter samme
  versjonsflyt. Agenten kan lese feedback, men aldri godkjenne eller publisere.
- Kort bruker lazy-loadede miniatyrer i stedet for originale mediefiler. Thumbnail
  og proxy har egne avgrensede workers; tidligere manglende previews repareres i
  små batcher. OCR, talegjenkjenning og modellnedlasting blokkerer ikke preview-køen.
- Private medier revaliderer tilgang ved cachetreff; proxy støtter ETag/304 og
  byte ranges. Startsidene henter bare nødvendige datasett. Vanlig sesjonsstatus
  følger lesebegrensningen; den strengere grensen på innloggingsforsøk er beholdt.
- PostgreSQL-testsett med race-detektor bestått. Nye tester dekker samtidige
  annonseopprettelser, eksakt versjon, idempotens, historiske vurderinger,
  produkt-/agent-/lesertilgang, samling av filer, delte previews og autorisert cache.
- Svelte/TypeScript uten feil/advarsler, produksjonsbygg og Docker-bygg bestått.
  Alle 12 nettlesertester bestått på desktop og 390 px mobil: ekte FFmpeg-video/miniatyr/proxy,
  MCP-opplastinger, nettleseropplasting, eksisterende innhold og de gamle flytene.
- Lokale API/web-containere er oppdatert. Deploy av begge tjenester og migrering
  005 til `studio.freelunch.no` gjøres manuelt. Produksjonens faktiske lastetider
  er ikke målt; ytelsesendringene er kontrollert lokalt.
