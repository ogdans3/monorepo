# Studio — avtalt retning og leveransestatus

Studio er et internt arbeidsrom for markedsinnhold, med Teorimester først.
Mennesker og agenter jobber mot samme bibliotek, oppgaver og godkjenningsregler.
Det skal bli mulig å følge referanse → brief → variant → publisering → resultat
→ neste forsøk. Egen chat, kalender, videoproduksjon via agenter, visuelle maler,
kraftig søk og valg av modell per oppgave er krav til lanseringsversjonen.

## Føringer fra brukeren

- Selvstendig tjeneste i monorepoet. Arbeidsnavn Studio.
- PostgreSQL, SvelteKit/TypeScript og Go.
- Alt settes opp lokalt først. Serverdrift tas senere.
- Invitasjonsbasert tilgang; ingen eksisterende innloggingsleverandør.
- Mobiloptimalisert først. Lett, minimalt og rolig design.
- Både eksterne agenter via MCP og intern kjøring gjennom OpenRouter.
- Studio eier agentlogikken og stopper løkker. Provider-nøkler kan også ha kostnadstak.
- Mulighet for spesialmodeller, særlig TypeSafe Jev for vurdering/rangering.
- Enkel oppgavetavle; kalenderen gjelder publisering, tavlen gjelder produksjon.
- Ingen automatisk publisering eller pengebruk på annonser uten menneskelig godkjenning.

## Kjører i første lokale leveranse

| Område | Implementert |
| --- | --- |
| Tilgang | Første administrator, engangsinvitasjoner, passord, sesjoner og tre roller |
| Produkt | Teorimester, beskrivelse, merkevaretekst, målgruppe |
| Bibliotek | Tekst- og medietyper, private filer, metadata, rettighetsstatus og kildelenke |
| Versjoner | Immutable versjoner, samtidighetskontroll, notater og eksplisitt godkjenning |
| Søk | Norsk fulltekst og tittel-likhet på innhold, notater, egne chatter, oppgaver og kalender |
| Oppgaver | Idé, klar, pågår, gjennomgang, ferdig; menneske/ekstern agent |
| Kalender | Uke/liste, tidspunkt i Oslo, innhold og produksjonsoppgave, posttekst og ansvarlig |
| Manuell publisering | Kopier tekst, last ned versjonsfil, åpne plattform, registrer publisert lenke |
| Chat | Persistente private samtaler, OpenRouter, produktkontekst, søk og utkastverktøy |
| Modellkontroll | Modellvalg per rolle, per-chat overstyring, snapshots av grenser og jobblogg |
| MCP | Produktnøkler, kontekst, søk, lesing, filtilgang, atomisk claim og levering med lease |
| Lokalt | Egne Docker-tjenester og data, separate integrasjons-/nettleserdatabaser |

## Gjenstår før full lanseringsversjon

### Bibliotek og innsamling

- Flere produkter via grensesnittet og mer detaljert tilgang per produkt.
- Samlinger, favoritter, etikettredigering, lagrede søk og bulk-handlinger.
- Import/eksport av hooks som CSV, lenkemetadata og innboks for usortert innhold.
- Opplastinger i gjenopptakbare deler, duplikatsjekk, miniatyrbilder og mobilproxyer.
- Automatisk transkript, OCR og tidsfestede videosekvenser.
- Visuell tekst-diff, side-ved-side-visning og filbytte som ny versjon.
- Synlige relasjoner mellom hook, brief, mal, referanse, variant og kampanje.
- Versjonert produktgrunnlag og strukturerte, kildebelagte produktpåstander.

### Søk

- Semantisk søk i tillegg til fulltekst; visuell likhet og bildesøk.
- Søk i tale, skjermtekst og handlinger i video når analysene er tilgjengelige.
- Treff med riktig tidskode/slide, forklaring, versjon og kilde.
- Kombiner innholds- og resultatfiltre, rettigheter, opphavsperson og kampanje.
- Samme søkeevne i chat/MCP; lagrede søk, oppdatert indeks og bulkvalg av treff.

### Chat, modeller og agenter

- Vedlegg og eksplisitt valg av bibliotekelementer/kampanjer i samtalen.
- Modellvalg per produkt og egendefinerte oppgaveprofiler med kapabilitetssjekk.
- Bestilling og endring av eksterne produksjonsoppgaver gjennom chatverktøy.
- Kjøringer for manus, videoanalyse og Jev, med definerte vurderingskriterier.
- Kontekstpakker med versjoner/kilder, kostnadsoversikt og kontrollert reservemodell.
- Strømming av chatsvar og tydelig fremdrift for hver produksjonsfase.
- Hendelser/omtaler som foreslår oppgaver; ingen ukontrollert automatisk rekursjon.

### Produksjon

- Strukturerte maler med redigerbare felt, låste merkevareelementer og eksempelbilder.
- Videoagent: klipp, lyd, undertekster, logo, appopptak/telefonmockup og formatvarianter.
- Visuell agent: bilder, karuseller og malbaserte videoer.
- Hooks × hoveddeler × CTA-er, navngitt og sporbart til komponentversjoner.
- Revisjoner fra chat, kildeprosjekter der mulig, eksportpakker og avhengigheter.
- AI-sjekk mot brief/merkevare, vurderinger med sporbarhet og menneskelig godkjenning.

### Planlegging, samarbeid og læring

- Redigering av hele publiseringspakken, månedskalender og påminnelser.
- Tidsfestede notater, @omtaler, vurderinger og løste kommentarer.
- Kampanjer og eksperimenter med hypotese, varianter og konklusjon.
- Resultatimport, måletidspunkt, betalt/organisk skille og sammenlignbar post-alder.
- UTM-er, konverteringsmottak fra Teorimester, deduplisering og refusjoner.
- Kunnskapsbase med kilder, usikkerhet, kundesitater og motstridende funn.

### Deling og drift

- Tidsbegrensede delingslenker, detaljert rettighetsdokumentasjon og utløp.
- Papirkurv, samlet dataeksport, backup og verifisert gjenoppretting.
- Passordgjenoppretting og invitasjonsadministrasjon utover opprettelse/listing.
- Ordentlige migreringer, lagrings-/arbeidsromsbudsjetter og driftsvarsler.
- Faktiske provider-kall testes først når brukeren har lagt inn nøkler og modellvalg.

## Senere

Direkte plattformpublisering og annonsekjøp, konkurrent-/trendovervåking,
influensersystem, avansert Elo/prediksjoner, agent-/modellrangering basert på
produksjonsresultater, egen mobilapp og stemmechat. Plattformtilgang må bekreftes
før integrasjoner loves. TikToks Direct Post-regler utelukker rene interne
opplastingsverktøy; manuell publisering og eksport er en fullverdig arbeidsflyt.
