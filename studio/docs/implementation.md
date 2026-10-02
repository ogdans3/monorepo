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
