# Agentkjøring

## Valg

Studio eier oppgaver, tilgang, modellvalg, tilstand og stoppregler. OpenRouter
leverer modellkall. Studio bruker en liten Go-løkke med en fast verktøyliste.
Vi kan senere bytte utførelsen til en SDK eller en separat worker uten å flytte
autorisasjon, godkjenning eller budsjettansvar ut av Studio.

En SDK forenkler verktøybruk og kontekst, men er ikke i seg selv en kontroll på
kostnader eller uendelige løkker. En varig arbeidsflytmotor kan bli aktuell ved
mange lange oppgaver. Inntil videre er Postgres-køen tilstrekkelig og enklere å drifte.

## To utførere

1. **Studio:** brukerstyrt chat, søk, utkast, manus og analyse via OpenRouter;
   separat kriterievurdering hos TypeSafe. Ingen automatisk
   opprettelse av barnejobber. Kun én aktiv jobb per samtale.
2. **Ekstern agent:** egen runtime og egne kostnadsgrenser. Henter en avgrenset
   oppgave gjennom MCP, får en tidsbegrenset reservasjon og leverer en bestemt
   innholdsversjon til menneskelig gjennomgang.

Agentreservasjon og faktisk jobbkjøring er ulike ting. En utløpt reservasjon
frigjør oppgaven, men betyr ikke at en ekstern prosess ble terminert. `lease_id`
hindrer at denne prosessen leverer etter at oppgaven er overtatt av en annen agent.

## Direkte annonseiterasjon

Eksterne agenter kan levere direkte til et annonsekonsept uten å opprette en
produksjonsoppgave. `studio_create_ad` bruker produktavgrenset, stabil nøkkel og
er idempotent under samtidige kall. `studio_prepare_ad_upload` gjenbruker samme
opplastingsoperasjon som grensesnittet, med produktkontroll og forventet versjon.
Fullføring låser annonsen og oppretter neste uforanderlige filversjon. Nye filer
setter status til gjennomgang. Feedback og godkjenning peker på en eksakt versjon;
MCP tilbyr bare lesing av menneskelige vurderinger. Ingen hendelse starter ny AI.
Se [CLI- og MCP-oppskriften](../agent/README.md).

## Stopp og kostnader

- `AI_ENABLED=false` og tom nøkkel er standard.
- Nøkkelen må ha endelig bruksgrense hos OpenRouter.
- Jobben lagrer valgt modell, steggrense, output-tokenbegrensning, tidsgrense og
  kostnadsgrense ved oppstart. Senere innstillingsendringer påvirker ikke jobben.
- Pris og verktøystøtte kontrolleres før modellkall. Ukjent pris stopper jobben.
- Inputkostnad beregnes konservativt fra UTF-8-bytes og overhead, output fra
  maks tokens. Provider-ruting begrenses til kjente maksimumspriser.
- Faktisk kostnad lagres etter hvert svar. Manglende kostnadsdata stopper videre kall.
- Identiske normaliserte verktøykall stoppes. Maks fire verktøykall per modellsteg.
- Siste tillatte modellsteg får ikke starte verktøy som ikke kan følges opp.
- Stoppknappen endrer vedvarende status; worker avbryter HTTP-kallet via context.
- Ingen automatiske retries, modellen kan ikke starte nye agentkjøringer, og
  prosessrestart gir eksplisitt feilstatus til uferdige kjøringer.
- In-flight leverandørarbeid kan fortsatt bli fakturert selv om klienten avbryter.
  Derfor er leverandørbudsjett et ekstra lag, ikke en erstatning for steg/tidsgrenser.

## Produksjon, revisjoner og kontekst

Maler lagrer redigerbare felt og låste merkevarefelt. Bestillingen fryser
malversjon, kildeversjoner, produktgrunnlag, modellprofil og sjekkliste.
Agenten må levere alle avtalte formater og eventuelle kildeprosjekter med gyldig
reservasjon. Revisjoner øker revisjonsnummeret og gjør gamle reservasjoner ugyldige.
Chat kan foreslå revisjoner på idéer eller leverte oppgaver, og legger dem tilbake
som idéer for menneskelig aktivering. Pågående agentarbeid kan ikke endres fra chat.

MCP gir samme fulltekst/semantiske/visuelle søkemotor og filtre som grensesnittet.
`studio_search` og chatverktøyet `search_library` har query, mode, kind, status,
rights, author, tag, campaign, min_views og image_item. Alle argumenter er strenger;
image_item refererer til et allerede indeksert bilde i samme produkt. Agenter får
aldri private menneskechatter i søk eller eksport. Omtaler gir produktavgrensede
hendelser, ikke automatisk agentoppstart.

## Jev

Jev-adapteren kaller `/v1/systemone` med versjonert tekstgrunnlag, kriteriebaserte
Score-spørsmål og merkevaresamsvar som Noul. Modellnavn, kildeversjon, kildetekst,
vurderingsspørsmål, usikkerhet, tokenbruk og kostnad lagres. Video vurderes ut fra
transkript/OCR og eventuelle beskrevne scener; råvideo sendes ikke til Jev.

Kontrakten, ugyldige svar og budsjettstopp testes mot en kontrollert transport.
Faktiske provider-kall er ikke testet uten brukerens nøkler. Betalt AI er fortsatt
avslått lokalt. Norsk innhold må kalibreres mot deres egne vurderinger før poeng
brukes til prioritering. Poengene er ikke sannsynligheten for et salg.

## Lokal mediebehandling

FFmpeg, Tesseract, MiniLM, CLIP og Whisper kjører i lokalt avgrensede containere.
Originalfiler bevares og versjoneres. Miniatyrer og mobilproxy har hver sin
avgrensede worker, slik at analyse ikke blokkerer forhåndsvisning. Gamle manglende
previews legges i kø i små batcher; tidligere feilede forsøk krever manuell retry. Modeller lastes ned til separat cache første
gang. Jobber har tidsgrense og stoppknapp; prosessrestart gjenopptar ikke uferdige
jobber automatisk. Bare lokale «opptatt»-svar prøves på nytt, i maksimalt 30 sekunder
innenfor kallers tidsgrense. Betalte provider-kall gjentas ikke.

Et arbeidsromsbudsjett reserveres i en PostgreSQL-transaksjon før hvert betalt
kall. Bekreftet kostnad avregnes; ukjent kostnad beholder reservasjonen. Dette
kommer i tillegg til jobbgrenser og leverandørens nøkkelbudsjett.

## Kilder kontrollert under implementeringen

- [OpenRouter tool calling](https://openrouter.ai/docs/guides/features/tool-calling)
- [OpenRouter API key limits](https://openrouter.ai/docs/api/api-reference/api-keys/create-a-new-api-key)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [TypeSafe input](https://docs.typesafe.ai/concepts/state)
- [TypeSafe models](https://docs.typesafe.ai/models)
- [TypeSafe API](https://docs.typesafe.ai/api)
- [Faster-whisper/PyAV-kompatibilitet](https://github.com/SYSTRAN/faster-whisper/issues/1492)
