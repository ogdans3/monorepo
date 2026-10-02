# Studio — lokal lanseringsversjon

Studio samler referanse → brief → produksjon → godkjenning → publisering → resultat.
Go og PostgreSQL håndterer data og jobber, SvelteKit gir et lett grensesnitt for
mobil og desktop. Lokal mediebehandling kjører i en egen CPU-container.

## Implementert

| Område | Funksjoner |
| --- | --- |
| Tilgang | Invitasjoner, tre arbeidsromsroller, produktmedlemmer/roller, begrensede produkter, engangslenker for passordbytte og tilbakekalling |
| Produkt | Flere produkter, versjonert merkevare-/produktgrunnlag, kildebelagte påstander og kontekstpakker |
| Bibliotek | Medier, manus, hooks, referanser, samlinger, favoritter, etiketter, innboks, CSV, massehandlinger, relasjoner, papirkurv og eksport |
| Versjoner | Uforanderlige tekst-/filversjoner, samtidig redigeringsvern, tekstsammenligning, medier side ved side og godkjenning av en bestemt versjon |
| Opplasting | Gjenopptakbare 8 MB-deler, opptil 2 GB per fil, SHA-256-duplikatsjekk, private filer og rettighetsdokumentasjon med utløp |
| Lenkeimport | Instagram, TikTok og Snapchat Spotlight; varig kø, fremdrift, stopp, eksplisitt nytt forsøk, kilde/opphav, duplikater og lokal kategorisering med manuell overstyring |
| Medier | FFmpeg-miniatyrer, mobilproxy, rammeuttrekk, norsk/engelsk OCR, lokal Whisper-transkribering og tidsfestede segmenter |
| Søk | Norsk fulltekst, tittel-likhet, flerspråklig semantikk, visuell tekst-/bildelikhet, tidskoder, filtre, lagrede søk og massevalg |
| Chat | Private samtaler, vedlegg/faste versjoner/kampanjer, strømmede svar, søk, utkast og produksjonsidéer; stopp og kjøringslogg |
| Modeller | Rolle-/produktprofiler, modelloverstyring, kontrollert reservemodell, bounded manus/analyse og separat TypeSafe Jev-adapter |
| Produksjon | Versjonerte maler, redigerbare felt/låste merkevarefelt, brief/kilder/formater/sjekklister, hooks × hoveddeler × CTA, revisjoner og leveransepakker |
| Agenter | Produktavgrenset MCP, CLI, atomisk reservasjon, fremdrift, avgrenset fornyelse, kildefiler, vurderinger, kontekst og hendelser |
| Planlegging | Oppgavetavle, uke/liste/måned, full redigering av postpakken, ansvarlig, UTM, påminnelser og manuell publiseringslenke |
| Samarbeid | Tidsfestede kommentarer, omtaler av folk/agenter, innboksvarsler, løste kommentarer og menneskelige vurderinger |
| Resultater | Kampanjer, eksperimenter, hypoteser/konklusjoner, måleimport, organisk/betalt, måletidspunkt, postalder og valuta |
| Konverteringer | Egen produktnøkkel, idempotente kjøp/refusjoner, validering av beløp og attribusjon til publisering |
| Kunnskap | Påstander, funn, kundesitater, kilder, sikkerhet, omfang og eksplisitt motstridende kunnskap |
| Drift | Versjonerte/checksum-kontrollerte migreringer, lagringsgrense, daglig AI-budsjett, jobbgrenser, status, delingslenker, eksport og backup/restore-verktøy |

## Aktivivering og praktiske grenser

- **Betalte modeller er avslått lokalt.** OpenRouter og TypeSafe trenger egne nøkler
  og eksplisitt modellvalg. Adapterne testes uten betaling mot kontrollerte svar.
  Faktiske provider-kall er ikke kjørt uten brukerens nøkler.
- Lenkeimport krever en offentlig enkeltvideo i et støttet direkte HTTP-format.
  Plattformblokkering og innlogging kan hindre import. Private snaps/stories, album
  og profiler støttes ikke. Standardrettigheten er «Kun referanse». Kategorier er
  lokale likhetsforslag, med usikkerhet og mulighet for manuell retting.
- **Video/design utføres av en tilkoblet ekstern agent.** Studio leverer brief,
  låste malfelt, referanser, ønskede klipp/lyd/undertekster/logo/mockup, formater og
  sjekkliste. Agenten må ha produksjonsverktøy og eget kostnadstak. Ingen automatisk
  videoprodusent eller ferdige videoer simuleres i Studio. Se [agentoppsettet](../agent/README.md).
- **Jev vurderer tekstgrunnlag.** Tale, skjermtekst og eventuelle agentbeskrevne
  scener må finnes før en video vurderes. Poeng er kriteriebasert kvalitet, ikke
  en salgsprognose. Modell, grunnlag, kriterier og usikkerhet lagres.
- Automatisk bildeanalyse bruker CLIP-likhet og OCR. Beskrivelse av handlinger/scener
  krever analyse fra en ekstern visuell agent. Tekstmodellen får ikke råvideo.
- Mobilproxy dekker inntil 10 minutter (maks 256 MB); visuelle rammer hentes hvert
  tiende sekund til 4 minutter. Originalen beholdes. Lokal talegjenkjenning bruker
  Whisper base, med avgrenset jobbvarighet og maks 2000 segmenter.
- Søkeindeksen fylles i bakgrunnen. Norsk tekstsøk virker umiddelbart; semantiske
  treff og bildeindeks blir tilgjengelige etter behandling. Modellene lastes ned
  ved første bruk. Ingen innholdsdata sendes til modellverten for lokal behandling.
- Varsler er inne i Studio. Invitasjoner og passordlenker deles manuelt. Automatisk
  e-post, push og publisering hos sosiale plattformer er ikke aktivert.
- Koblinger til Teorimester mottar hendelser via API; Studio endrer ikke andre
  monorepo-prosjekter. Avsenderen må koble seg til mottaket.
- Delingslenker gjelder én fast versjon, har utløp og kan tilbakekalles.
- Kun lokal loopback-drift er satt opp. Sikkerhetskopier må kjøres og flyttes til
  ønsket backupmål av driftsansvarlig. Ingen ekstern tjeneste eller server er satt opp.

## Senere, utenfor avtalt lokal lanseringsversjon

Direkte plattformpublisering og annonsekjøp, konkurrent-/trendovervåking,
influensersystem, avansert Elo/prediksjoner, agent-/modellrangering basert på
produksjonsresultater, egen mobilapp og stemmechat. Tilgang og vilkår må avklares
før eksterne plattformintegrasjoner bygges.
