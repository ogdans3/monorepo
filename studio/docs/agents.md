# Agentkjøring

## Valg

Studio eier oppgaver, tilgang, modellvalg, tilstand og stoppregler. OpenRouter
leverer modellkall. Første utgave bruker en liten Go-løkke med en fast verktøyliste.
Vi kan senere bytte utførelsen til en SDK eller en separat worker uten å flytte
autorisasjon, godkjenning eller budsjettansvar ut av Studio.

En SDK forenkler verktøybruk og kontekst, men er ikke i seg selv en kontroll på
kostnader eller uendelige løkker. En varig arbeidsflytmotor kan bli aktuell ved
mange lange oppgaver. Inntil videre er Postgres-køen tilstrekkelig og enklere å drifte.

## To utførere

1. **Studio:** brukerstyrt chat, søk og utkast via OpenRouter. Ingen automatisk
   opprettelse av barnejobber. Kun én aktiv jobb per samtale.
2. **Ekstern agent:** egen runtime og egne kostnadsgrenser. Henter en avgrenset
   oppgave gjennom MCP, får en tidsbegrenset reservasjon og leverer en bestemt
   innholdsversjon til menneskelig gjennomgang.

Agentreservasjon og faktisk jobbkjøring er ulike ting. En utløpt reservasjon
frigjør oppgaven, men betyr ikke at en ekstern prosess ble terminert. `lease_id`
hindrer at denne prosessen leverer etter at oppgaven er overtatt av en annen agent.

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

## Jev

Jev er planlagt som en separat vurderingsadapter, ikke som chatmodell.
Dagens API tar tekst og returnerer Choice, Score eller Noul. Video krever en
egen analysefase først. Den analysen og vurderingskriteriene må versjoneres
slik at en rangering kan spores tilbake til nøyaktig grunnlag.

Jev-kjøring er ikke aktivert i første utgave. Norsk innhold og deres egne vurderinger
skal inngå i valideringen før vi bruker vurderingene til prioritering. Scores
må ikke fremstilles som sannsynligheten for et salg.

## Kilder kontrollert under implementeringen

- [OpenRouter tool calling](https://openrouter.ai/docs/guides/features/tool-calling)
- [OpenRouter API key limits](https://openrouter.ai/docs/api/api-reference/api-keys/create-a-new-api-key)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [TypeSafe input](https://docs.typesafe.ai/concepts/state)
- [TypeSafe models](https://docs.typesafe.ai/models)
