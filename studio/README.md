# Studio

Privat arbeidsrom for innhold, produksjon og publisering. SvelteKit/TypeScript,
Go og PostgreSQL. Mobil først. Prosjektet er selvstendig: denne mappen kan flyttes
til et tomt repo uten endringer eller avhengigheter til andre monorepo-prosjekter.

## Start lokalt

Krever Docker med Compose. Fra denne mappen:

```sh
sh scripts/setup.sh
docker compose up --build -d
```

Åpne <http://localhost:5178>. Opprett første administrator med oppsettkoden
`BOOTSTRAP_TOKEN` fra den lokale `.env`-filen. Koden virker bare mens ingen brukere
finnes. `.env` opprettes med tilgang kun for lokal bruker og skal aldri committes.

Inviter andre fra Innstillinger. Lenken kopieres og deles manuelt; ingen e-post
sendes automatisk. Invitasjoner er engangslenker, knyttet til e-post og utløper
etter syv dager. Passord må være 12–72 tegn. Innlogging bruker hash-lagrede
sesjonstokener og HttpOnly/SameSite-cookies. Bruk nøyaktig samme origin som
`APP_ORIGIN`; localhost og 127.0.0.1 er ulike origins.

Tjenester bindes bare til loopback: web 5178, API/MCP 8088, Postgres 5448.
Filer og database ligger i egne Docker-volumer. `docker compose down` beholder
data. Ikke bruk `down -v` med mindre du vil slette databasen og filene.

## Hva den første lokale utgaven gjør

- Invitasjoner og rollene administrator, redaktør og leser i ett internt arbeidsrom.
- Teorimester som første produkt, med redigerbar produkt- og merkevarekontekst.
- Bibliotek for tekst, hooks, manus, referanser, maler og mediefiler.
- Private opplastinger (maks 250 MB), forhåndsvisning og nedlasting.
- Uforanderlige versjoner, notater og godkjenning av gjeldende versjon.
- Norsk fulltekstsøk og toleranse for lignende titler, på tvers av innhold,
  notater, egne samtaler, oppgaver og publiseringer.
- Oppgavetavle for mennesker og eksterne agenter, med atomiske reservasjoner.
- Kalender med uke-/listevisning, Oslo-tid, produksjonskobling og publiseringspakke.
- Manuell publisering med posttekst, nedlasting og registrering av publiseringslenke.
- Privat chat med OpenRouter, produktsammenheng, biblioteksøk og lagring av utkast.
- Modellinnstillinger per rolle, jobbstatus, kostnadslogg og stoppknapp.
- Autentisert MCP med tilgang begrenset til ett produkt per nøkkel.

Dette er en kjørbar første leveranse, ikke hele den avtalte lanseringsversjonen.
Full status og gjenstående funksjoner finnes i [produktplanen](docs/product-plan.md).
Semantisk/visuelt søk, transkribering, Jev-kjøring, intern medieproduksjon,
resultatmåling, avansert deling og automatiske forhåndsvisninger er ikke implementert
ennå. Modellvalgene for disse rollene lagres, men kjører ikke oppgaver.

## Aktivere chat

1. Lag en egen OpenRouter API-nøkkel med et lavt, endelig bruksbudsjett.
2. Sett `OPENROUTER_API_KEY` og `AI_ENABLED=true` i `.env`.
3. Kjør `docker compose up -d api` for å laste nye miljøvariabler.
4. Velg en nøyaktig OpenRouter-modell-ID som støtter verktøykall i Innstillinger.

Ingen modell er valgt automatisk, og betalte kall er avslått som standard.
Nøkler sendes aldri til nettleseren. Modellvalg kan overstyres per chatjobb.
Chatten kan lese biblioteket og lage utkast, men kan ikke publisere, godkjenne,
kjøre shell, starte barneagenter eller endre egne grenser.

Hver jobb har en uforanderlig kopi av grensene ved oppstart. Standard er 6
modellkall, 120 sekunder, 2048 output-tokens per kall og USD 0.10 per jobb.
Det er maksimalt fire verktøykall per steg, og identiske normaliserte kall stoppes.
Vi reserverer konservativ tokenkostnad før hvert kall og stopper ved ukjent pris
eller manglende kostnadsrapport. OpenRouter-nøkkelens grense er en separat
leverandørgrense; lokale estimater er ikke en garanti mot all faktureringsforsinkelse.
Ingen modellkall prøves automatisk på nytt. Avbrutte jobber gjenstartes ikke
automatisk etter prosessrestart. Første utgave kjører én worker, én jobb om gangen.

Les [agentarkitekturen](docs/agents.md) for begrensninger og utvidelser.

## Eksterne agenter via MCP

Opprett en agentnøkkel i Innstillinger. Den vises én gang, gjelder ett produkt,
utløper etter 90 dager og kan tilbakekalles. Koble en klient som støtter
Streamable HTTP og eksplisitt bearer-header til:

```text
URL: http://localhost:8088/mcp
Authorization: Bearer <agentnøkkel>
```

En klient kan lese produktkontekst, søke, hente elementer og hente/reservere/levere
oppgaver. Reservasjoner varer 30 minutter; en utløpt eller erstattet reservasjon
kan ikke levere. Levende reservasjoner hindrer andre agenter i å ta samme oppgave.
Agenter kan laste opp filer til `POST /api/agent/uploads` (multipart: `file`, `title`,
`body`, `rights`), og hente autoriserte versjoner via `GET /api/agent/files/{version_id}`.
Alle disse kallene bruker samme bearer-nøkkel. `product_id` bestemmes av nøkkelen.
Opplasting returnerer `id` og `version_id` til `studio_deliver_task`.

MCP styrer agentens tilgang til Studio. En ekstern agents egne modellkall og
kostnader må begrenses der agenten kjører. Studio kan avvise nye handlinger og
tilbakekalle nøkkelen, men kan ikke stoppe beregninger utenfor Studio.

## Utvikling og tester

Go 1.22+ og Node 22.12+ anbefales for lokal utvikling. Installer med `go mod download`
i `api` og `npm ci` i `web`. Docker-bygget inneholder sine egne runtimes.
For utviklingsserver, start databasen med Compose, sett `DATABASE_URL` fra `.env`
og kjør `go run ./cmd/server` i `api`, deretter `npm run dev` i `web`.

```sh
docker compose exec -T db createdb -U studio studio_test
docker compose exec -T db createdb -U studio studio_e2e
sh scripts/test.sh
cd web
npx playwright install chromium
npm run test:e2e
```

Go-integrasjonstester bruker bare `studio_test`; nettlesertestene bruker
`studio_e2e`. De skal aldri peke på arbeidsdatabasen. Testene dekker blant annet
engangsinvitasjoner, roller, origins, foreldede godkjenninger, samtidige
agentreservasjoner, produktgrenser, tilbakekalling og stopp av modellsløyfer.
Nettlesertestene dekker innhold → søk → oppgave → kalender → publisering på
desktop og mobil. Ingen tester gjør betalte AI-kall.

`cookie` overstyres til den kompatible 0.7-serien for å unngå den kjente
cookie-valideringsfeilen i SvelteKits transitive avhengighet. Fjern overstyringen
når en oppgradert SvelteKit-versjon tar inn korrigeringen selv.

## Før serverdrift

Dette oppsettet er bare satt opp lokalt. Før ekstern drift må vi etablere HTTPS,
backup med testet gjenoppretting, lagringsgrenser, passordgjenoppretting og
versjonerte databasemigreringer. Første utgave bruker et idempotent opprettelsesskjema;
fremtidige skjemaendringer skal legges i ordentlige migreringer. Private chat-samtaler
er bare synlige for eieren. Andre produktdata deles mellom medlemmene i arbeidsrommet.
