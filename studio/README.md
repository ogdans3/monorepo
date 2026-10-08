# Studio

Privat arbeidsrom for annonser, innhold, produksjon og publisering. PostgreSQL, Go og
SvelteKit/TypeScript, med lokal CPU-behandling av medier. Mobil først. Mappen er
selvstendig og kan flyttes til et tomt repo uten avhengigheter til andre prosjekter.

## Start lokalt

Krever Docker med Compose, minst 8 GB tilgjengelig minne og diskplass til medier
og modellene. Fra denne mappen:

```sh
sh scripts/setup.sh
docker compose up --build -d
```

Åpne <http://localhost:5178>. Opprett første administrator med `BOOTSTRAP_TOKEN`
fra `.env`. Oppsettkoden virker bare før første bruker er opprettet. `.env` har
filmodus 600, holdes utenfor Git og skal ikke deles. Bruk samme origin som
`APP_ORIGIN`; localhost og 127.0.0.1 er ulike origins.

Inviter kolleger fra Innstillinger. Engangslenkene gjelder syv dager og deles
manuelt. Administrator kan opprette 30-minutters passordlenker fra Arbeidsrom;
passordbytte avslutter eksisterende sesjoner. Arbeidsrom har administrator,
redaktør og leser, og produkter kan begrenses til utvalgte medlemmer.

Web (5178), API/MCP (8088) og Postgres (5448) er bundet til loopback. Mediemotoren
har ingen publisert port. Database, originalfiler og modellcache ligger i separate
Docker-volumer. `docker compose down` beholder data; `down -v` sletter dem.

## Funksjoner

- Annonser som startside: én annonse-ID, annonsetype, brief og nummererte filversjoner.
  Egne gjennomgangssider med video, sammenligning, tidsfestede kommentarer og
  godkjenning/endringsønsker for eksakt versjon. Vanlig tilbake-/fremovernavigasjon.
- Bibliotek med versjoner, filer, samlinger, favoritter, etiketter, innboks,
  rettigheter, kommentarer, CSV, papirkurv, delingslenker og eksportpakker.
- Gjenopptakbar opplasting opptil 2 GB, duplikatsjekk, miniatyrer, mobilvideo,
  norsk/engelsk OCR og lokal Whisper-transkribering.
- Lenkeimport av offentlige Instagram-/TikTok-videoer og Snapchat Spotlight,
  med importkø, kildeinformasjon og redigerbare kategoriforslag.
- Fulltekst, semantisk søk, visuell likhet, bildesøk, tidskoder, filtre og lagrede søk.
- Privat chat med vedlegg, strømmede svar, produkt-/rolleprofiler, oppgaveidéer,
  manus, analyse og TypeSafe Jev-vurdering.
- Produksjonstavle, versjonerte maler, variantkombinasjoner, agentbestillinger,
  faste kilder, revisjoner, leveransemanifest og menneskelig godkjenning.
- Publiseringskalender i Oslo-tid med uke/liste/måned, postpakke, påminnelser og UTM.
- Kampanjer, eksperimenter, resultatimport, kjøp/refusjoner og kildebelagt kunnskap.
- MCP/CLI, produktroller, lagringsgrenser, daglig AI-budsjett og driftsoversikt.

[Produktplanen](docs/product-plan.md) beskriver detaljene og de praktiske grensene.
Compose binder tjenestene til loopback. Publisering på sosiale plattformer gjøres manuelt.

## Annonser og iterasjon

Start i **Annonser**. Opprett én annonse per konsept, velg en annonsetype og legg
inn briefen. «Last opp neste versjon» legger ny video eller nytt bilde til samme
annonse. Tittelen på konseptet beholdes, mens hvert render beholder fullt filnavn.
Ny filversjon krever ny gjennomgang; tidligere vurderinger og kommentarer bevares.
Stjernen på annonsekortet lagrer annonsen som personlig favoritt. Bruk
«Favoritter» for å vise bare disse; valget deles med bibliotekets favoritter.

Eksisterende bibliotekinnhold kan velges når annonsen opprettes. Flere opplastinger
som hører sammen kan samles fra gjennomgangssiden med «Bruk en eksisterende
opplasting». Originalene beholdes. Studio gjetter ikke grupper ut fra filnavn.

Eksterne agenter bruker `studio_create_ad` med en stabil `external_key`, leser
`studio_get_ad` for feedback og leverer hver render med `studio_prepare_ad_upload`
eller `agent/studio.py upload --ad-id`. Se [den konkrete agentflyten](agent/README.md).
Vanlig opplasting uten annonse-ID oppretter fortsatt bibliotekinnhold.

## Lokale modeller og medier

Kortene laster små, lazy-loadede miniatyrer i stedet for originalvideoer/-bilder.
Egne thumbnail- og proxy-workers kjører uavhengig av OCR/transkribering/modellkøen.
Eksisterende medier som mangler forhåndsvisning, legges i små reparasjonsbatcher
etter oppstart. Feilede forsøk gjentas bare på forespørsel. Gjennomgangssiden bruker
mobilproxy når den er klar, med mulighet til å spille av originalen.
Private medier mellomlagres med autorisert revalidering og støtte for byte ranges.
Annonselisten henter bare relevant metadata, oppdateres mens den er synlig og har
knapp for manuell oppdatering; bakgrunnsoppdateringen er avgrenset.

Første bruk laster ned flerspråklig MiniLM, CLIP med flerspråklig tekstmodell og
Whisper base til modellvolumet. Nedlasting kan ta flere minutter; senere kjører
behandlingen lokalt uten å sende innholdsdata til modellverten. Bilder indekseres
etter opplasting. Tekstindeksen oppdateres i bakgrunnen i små grupper.

Automatisk behandling lager proxy av inntil 10 minutter / 256 MB, og visuelle
rammer hvert tiende sekund til fire minutter. Originalen beholdes. Talegjenkjenning
og OCR er søkehjelp og kan inneholde feil. Handlinger i video må beskrives av en
visuell agent; tekstmodellen får transkript/analyse, ikke råvideo. Feil og delvis
behandling vises på elementet; de lokale jobbene kan kjøres på nytt derfra.

PyAV er låst til 16.1.0 fordi 19 fjernet argumentet som faster-whisper 1.2.1 bruker.
`intelligence/requirements.lock` låser hele det testede Python-miljøet.

## Importere sosiale videoer

Lim inn lenken under **Bibliotek → Hent en video fra en lenke**. Velg eventuelt
tittel, samling og rettigheter. Studio lagrer videoen, opphavet og en fast første
versjon, og legger forhåndsvisning, OCR, transkript og kategorisering i lokal kø.
Kategorier foreslås fra tekst og eventuelt videobildet med MiniLM/CLIP. Usikre
forslag blir «Ukategorisert». Kategorien kan endres på videoen og brukes som
bibliotekfilter; kategori, opphav og transkript inngår i søket.

Støtten gjelder enkeltvideoer i offentlige Instagram-poster/Reels, TikTok og
Snapchat Spotlight. Private snaps, innloggingsbeskyttet innhold, hele profiler,
album, direktesendinger og HLS-strømmer importeres ikke. Plattformene kan blokkere
nedlastingen; statusen viser feilen og tilbyr manuell opplasting. Ingen innlogging,
nettleser-cookies eller tredjeparts nedlastingsserver brukes.

Importen har fem minutters tidsgrense, maks 512 MiB og 30 minutter video, og velger
direkte nedlastbare HTTP-formater opptil 1080p, også stående. Lagring reserveres
før start. Like lenker og filer dedupliseres innen produktet. Stopp avbryter
prosessen; en feil eller omstart krever et nytt, eksplisitt forsøk. Den lokale
API-containeren skal ha én instans, som øvrige Studio-workers.

Rettigheter settes til **Kun referanse** som standard. Import godkjenner aldri
publisering. Klassifisering bruker de lokale modellene og ingen betalte API-kall.
`api/importer/requirements.txt` låser yt-dlp; oppdater og test låsen når plattformene
endrer format. FFprobe validerer faktiske spor, også Instagrams ISO5-MP4-filer.
Nedlasterens nettverkstilgang avviser private adresser, inkludert videresendinger.

## Aktivere betalt AI

1. Opprett en OpenRouter-nøkkel med et lavt, endelig leverandørbudsjett.
2. Sett `OPENROUTER_API_KEY` og `AI_ENABLED=true` i `.env`.
3. Kjør `docker compose up -d api` og velg nøyaktige modell-ID-er i Innstillinger
   eller produktprofiler under Arbeidsrom. Ingen betalt modell velges automatisk.
4. For Jev: sett `TYPESAFE_API_KEY`, velg TypeSafe og en aktuell Jev-modell i
   vurderingsprofilen. Bekreft prisen i `TYPESAFE_PRICE_PER_MTOK`.

Standard chatgrense er seks modellsteg, 120 sekunder, 2048 output-tokens per steg
og USD 0.10 per jobb. Modeller må støtte verktøykall der dette brukes. Ukjent pris,
manglende kostnadsrapport, gjentatte verktøykall og overskredne grenser stopper
kjøringen. Daglig AI-budsjett er USD 5 som standard, lagringsgrensen 20 GiB og
jobbkøgrensen 20. Administrator kan endre disse. Betalte kall prøves ikke automatisk
på nytt. Reservemodell brukes bare hvis hovedmodellen ikke kan valideres før kall.

Chat lager oppgaver/revisjoner som idéer; et menneske må aktivere dem. Ingen
rekursjon, shell, automatiske barneagenter, godkjenning eller publisering er
mulig fra modellverktøyene. [Agentarkitekturen](docs/agents.md) forklarer grensene.

## Video og design via eksterne agenter

Opprett produktavgrenset agentnøkkel i Innstillinger. Nøkkelen vises én gang,
utløper etter 90 dager og kan tilbakekalles. MCP-klienten må støtte Streamable
HTTP med eksplisitt header:

```text
URL: https://studio.freelunch.no/mcp
Authorization: Bearer <agentnøkkel>
```

Lokalt brukes `http://localhost:5178/mcp` gjennom samme webproxy; direkte API på
`http://localhost:8088/mcp` virker også. Innstillinger og nye agentnøkler viser
adressen til det aktuelle arbeidsrommet. `POST /mcp` håndterer MCP-meldinger.
Et autentisert `GET /mcp` gir 405 fordi serveren ikke tilbyr en separat SSE-strøm;
det er forventet for denne [Streamable HTTP-transporten](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
En vanlig nettleser uten agentnøkkel får 401.

På serveren skal `APP_ORIGIN=https://studio.freelunch.no`. Domenet peker til
`web:5178`, som videresender både `/api/*` og `/mcp` til API-et og beholder
Authorization, Origin og MCP-headere. Port 8088 skal fortsatt være intern.
Etter pull av `studio`-branchen må **både api og web** bygges og startes på nytt:

```sh
docker compose up -d --build api web
```

Deploy startes manuelt. Cloudflare må slippe MCP-trafikken frem til applikasjonens
Bearer-autentisering; MCP-klienter kan ikke fullføre nettleserutfordringer. En
Cloudflare-feil før forespørselen når Studio må rettes i domenets Cloudflare-oppsett.

Agenten trenger egne verktøy for video/design og eget kostnadstak. Studio leverer
brief, mal, kilder, ønskede formater og sjekkliste. Leveranser valideres og legges
til menneskelig gjennomgang. [CLI og arbeidsflyt](agent/README.md) viser oppsettet.
En agents eksterne prosess stoppes ikke fysisk av en utløpt Studio-reservasjon;
foreldede reservasjoner kan likevel ikke levere.

## Resultater og konverteringer

Opprett kampanjer/eksperimenter under Produksjon og innsikt. Resultater registreres
manuelt eller med CSV (skjemaet viser kolonnene). Målinger skiller organisk/betalt,
kanal, postens alder og valuta; de dokumenterer sammenheng, ikke sikker årsak.

Opprett en egen konverteringsnøkkel under Arbeidsrom. Avsenderen poster til
`POST /api/conversions` med `Authorization: Bearer <konverteringsnøkkel>` og JSON:

```json
{"event_id":"order-123-paid","kind":"purchase","occurred_at":"2026-10-02T12:00:00Z","order_id":"123","amount":199,"currency":"NOK","publication_id":"UUID-fra-utm_content"}
```

Bruk `refund` for refusjon, nytt unikt `event_id` og samme `order_id`/valuta.
Identiske hendelser dedupliseres, endret payload med samme ID avvises, og refusjoner
kan ikke overstige kjøpet. Avsenderen og det andre prosjektet må kobles opp separat.

## Backup og gjenoppretting

```sh
sh scripts/backup.sh
sh scripts/verify-backup.sh .data/backups/studio-<tidspunkt>
```

Backup pauser API/worker kort mens data kopieres, og gjenopptar automatisk etterpå.
Den inneholder database og filer, har private filrettigheter og sjekksummer.
Verifisering gjenoppretter i `studio_restore_test`, pakker ut i en midlertidig
mappe og sjekker databasehenvisninger og filenes SHA-256. Arbeidsdata overskrives
ikke. Flytt kopier til eget backupmål; ingen automatisk ekstern backup er aktivert.
`.env` inngår ikke i kopien. Bevar den separat. Ved faktisk katastrofegjenoppretting
stoppes skriving først, databasen gjenopprettes med `pg_restore`, og filarkivet til
filvolumet. Ta kopi av eksisterende data før en slik overskriving.

Nye skjemaendringer legges som neste nummererte SQL-fil i
`api/internal/studio/migrations`. Allerede anvendte migreringer må aldri endres.
Oppstart låser migreringene og kontrollerer sjekksummene.

## Utvikling og tester

Go 1.22+, Node 22.12+ og Python 3.12 for CLI/backupverifisering. Installer med `go mod download` i `api` og `npm ci` i `web`.
Nettlesertestene krever FFmpeg/FFprobe/Tesseract på verten eller et bygget
`studio-api`-image (`docker compose build api`). Testserveren bruker automatisk
containerverktøyene når verten mangler dem, med kun isolert testlagring montert.
Integrasjonstester bruker bare `studio_test`, nettlesere `studio_e2e`, medier
`studio_media_test`. Opprett testdatabasene én gang:

```sh
docker compose exec -T db createdb -U studio studio_test
docker compose exec -T db createdb -U studio studio_e2e
docker compose exec -T db createdb -U studio studio_media_test
sh scripts/test.sh
cd web
npx playwright install chromium
npm run test:e2e
```

For faktisk lokal bilde-/lyd-/videobehandling, fra prosjektroten:

```sh
docker compose -f compose.yml -f compose.test.yml up -d api-test intelligence-test
docker compose -f compose.yml -f compose.test.yml exec -T -u 0 api-test apk add --no-cache espeak
python3 scripts/media-smoke.py --video
sh scripts/backup.sh --test
# Verifiser mappen scriptet returnerte med verify-backup.sh.
docker compose -f compose.yml -f compose.test.yml stop api-test intelligence-test
```

Testene dekker tilgang, versjoner, deling, invitasjoner, gjenoppretting, samtidige
reservasjoner, opplastinger, budsjetter, provider-kontrakter, konverteringer og
brukerflyter på desktop/mobil. De gjør ingen betalte API-kall. Se
[verifiseringsstatus](docs/implementation.md).

Ekstra importtester, etter at containerne er bygget:

```sh
docker run --rm -v "$PWD:/workspace:ro" -w /workspace/api/importer --entrypoint /opt/importer/bin/python studio-api -m unittest -v test_download
docker compose -f compose.yml -f compose.test.yml exec -T intelligence-test python < intelligence/test_categories.py
python3 scripts/import-smoke.py '<offentlig-videolenke>'
```

Siste kommando bruker kun den isolerte API-porten 18089. Nettlesertestene bruker
en lokal syntetisk nedlaster i `studio_e2e`, slik at plattformblokkering ikke gjør
testene ustabile. Vanlig Studio bruker alltid den ekte nedlasteren.
