# Swaply — brief for runde 5

Endringene fra møtet 06.09.2026, skrevet som en komplett bestilling til neste
skjemaeksport. Runde 4 er utgangspunktet. Skjermtekst skal være norsk, som i
alle tidligere runder.

Eksportene i `swapply-design/public/docs/` er artefakter og skal ikke
redigeres. Denne fila er kilden til runde 5.

---

## Det denne runden avgjør

To ting på lista er større enn skjermendringer, og bør noteres som
beslutninger framfor å bli oppdaget senere i en HTML-fil.

**1. Vi fasiliterer ikke byttet.** «Ta bort 07a–07h» sletter hele den
fasiliterte treveis-flyten — sending, fraktetiketter, Vipps. Igjen står
07i–07k, som er treveis *uten* fasilitering. Det var det åpne spørsmålet fra
31.07 om hvem som er ansvarlig for frakten hvis pengene går gjennom oss, og
det er nå besvart: pengene går ikke gjennom oss. `DESIGN.md` må si det.

**2. Oppdag og Søk blir én side.** «Ta bort oppdag siden, vi skal kun ha søk
siden» og «kall søkesiden for oppdag» leses sammen: det er søkesidens
oppførsel som overlever, under Oppdags navn. Collagen uten søkefelt er ute.

---

## Navigasjon

Bunn-nav har fem plasser. Sammenslåingen over frigjør én, og den nye
chat-fanen tar den:

```
Oppdag  ·  Bytter  ·  [ Legg ut ⇄ ]  ·  Chats  ·  Profil
```

`Legg ut` blir stående som midtstilt handlingsknapp, slik den er i runde 4.

**Chats-fanen har en uleste-indikator**: fylt sirkel i coral (`#FF6B5E`) med
hvitt tall, plassert oppe til høyre på ikonet. Tegn tre tilstander: uten
merke, med `3`, og med `9+`. Ved null uleste vises ingenting — ikke en null.

---

## Skjermene

### 02 Interesser (ny, førstegang)

Erstatter onboarding-slidene som ble kuttet i runde 4.

- Overskrift: «Hva er du ute etter?» Underlinje: «Velg minst 3, så finner vi
  ting du faktisk vil ha.»
- Rutenett av kategori-chips med ikon: Verktøy, Gaming, Sykkel, Klær, Sport,
  Båt og fritid, Møbler, Elektronikk, Barn, Hage, Musikk, Bil og MC.
- Valgt chip: fylt i primærgrønn med hvit tekst og hake. Uvalgt: hvit med
  grå kant.
- Teller nederst: «3 av 5 valgt». Primærknapp `Fortsett` er deaktivert under
  3 og valgene låses på 5, med en rolig melding om at fem er nok framfor en
  feilmelding.
- Tegn to tilstander: tom (knapp deaktivert) og tre valgt.

### 03 Oppdag (erstatter både gammel 03 og 05)

Søkesidens oppførsel under Oppdags navn.

- Søkefelt øverst, alltid synlig. Filterknapp ved siden åpner avansert søk
  (05b, beholdes uendret).
- Under feltet, før man har søkt: radene «Basert på interessene dine» med
  kategoriene fra 02.
- Resultater som collage, samme kort som runde 4, men **med synlig
  hjerteknapp på hvert kort**. Langtrykk beholder kontekstmenyen for det
  sjeldne: Ikke vis meg slike, Se profil, Rapporter.
- Tegn to tilstander: før søk (interessebaserte rader) og med søketreff.

> Hjertet må være synlig. Det er den eneste handlingen som skaper en rettet
> kant i match-grafen, og i runde 4 lå den bak et langtrykk uten affordans.

### 04 Gjenstand, detalj

- Uendret over folden.
- **Ny samtaleboks nederst på siden**, med tekstfelt rett i produktsiden, så
  man kan snakke med eier før det finnes noe bytte. Overskrift: «Snakk med
  Ola». Tomt felt med plassholder «Skriv en melding».
- Over tekstfeltet: chip-knapper `Jeg vil ha` · `Foreslå ting` · `Foreslå
  mellomlegg`.
- Tegn to tilstander: tom samtale, og en samtale med tre meldinger der en av
  chipene er brukt.

### 06a Swap, toveis

Uendret fra runde 4.

### 06b Byttedetalj, din tur

- **Tre handlinger, ikke én**: `Avslå` (sekundær, grå) · `Foreslå motbytte`
  (sekundær) · `Godta bytte` (primær grønn).
- **Samtaleboks i skjermen**, samme komponent som 04, med de samme chipene
  over tekstfeltet.
- Byttet kan omfatte **flere ting per side**. Vis «Du gir» og «Du får» som
  to lister som tåler 1–3 miniatyrer hver, med totalverdi under hver liste
  og differansen mellom dem som en egen linje: «Mellomlegg: du legger til
  200 kr».
- Tegn to tilstander: én ting mot én ting, og to ting mot én med mellomlegg.

### 06b-2 Avtalen (ny, mellom 06b og 06c)

Den eksplisitte avtalen man faktisk godtar.

- Overskrift: «Dette er avtalen».
- Punktvis oppsummering i klartekst, ikke ikoner: hvem gir hva til hvem,
  hvor overleveringen skjer, og eventuelt mellomlegg.
- Vilkårsblokk med avkryssingsboks: «Jeg har lest og godtar vilkårene for
  bytte». Lenke til vilkårene ved siden.
- Setning som må stå ordrett: **«Swaply er ikke part i byttet og
  fasiliterer ikke frakt eller betaling. Avtalen er mellom dere.»**
- Nederst en **sveip-for-å-godta**: bred pille med tekst «Sveip for å godta
  byttet» og en gripeflate til venstre som dras til høyre. Tegn tre
  tilstander: urørt, halvveis dratt, og fullført med hake.
- Sveipen er deaktivert til avkryssingsboksen er huket av.

### 06c BankID-prompt

Uendret, men kommer nå etter 06b-2.

### 06d Venter på andre

- Uendret, men **samtalen skal alltid være tilgjengelig herfra**: samme
  samtaleboks i skjermen, ikke bare en lenke videre. Man skal kunne skrive
  til motparten mens man venter.

### 06e, 06f

Uendret.

### 07a–07c Treveis uten fasilitering (var 07i–07k)

07a–07h fra runde 4 utgår i sin helhet. Den gjenværende alternativflyten
rykker opp og overtar nummereringen, så eksporten ikke har et hull fra 07a
til 07i.

- **07a Swap, treveis** (var 07i). Uendret innhold.
- **07b Ditt bytte, oversikt** (var 07j). **Legg til chatvindu** i skjermen,
  samme komponent som 06b.
- **07c Chat for byttet** (var 07k). **Fast banner øverst i tråden**, ikke en
  melding i strømmen, i dempet gul/varm tone med informasjonsikon:
  «Swaply fasiliterer ikke dette byttet. Dere avtaler overlevering og
  eventuelt mellomlegg selv.» Banneret skal ikke kunne lukkes.

### 08a–08c Trekke seg

Uendret fra runde 4.

### 12 Likt

Uendret innhold. Se «Åpne punkter» under for hvordan man kommer hit.

### 13 Profil (egen)

- Legg til en rad **«Likt»** med antall, som går til 12.

### 13b Profil, annen person (ny)

- Samme oppsett som 13, men uten redigering og innstillinger.
- Navn, sted, vurderingssnitt med antall vurderinger, BankID-merke hvis
  verifisert, og medlem-siden-dato.
- **Rutenett av personens ting**, som er hele poenget med skjermen: derfra
  kan man hjerte noe og lukke en løkke raskere.
- Handlinger øverst til høyre: `⋯` som åpner Rapporter / blokkér (16a).
- Nås fra 12 (hvem som likte tingene dine), fra kontekstmenyen på et kort
  («Se profil»), og fra en avatar i en samtale.

### 14a Anmeldelse (etter fullført bytte)

- «Hvordan gikk byttet med Ola?»
- Fem stjerner, valgfritt tekstfelt, og tre hurtig-chips: `Kom som avtalt` ·
  `God kommunikasjon` · `Møtte ikke opp`.
- Primærknapp `Send vurdering`, sekundær `Hopp over`.

### 14b Tilbakemelding om Swaply (etter fullført bytte)

Egen skjerm, og ikke det samme som 14a: 14a handler om motparten, denne om
appen.

- «Hvordan var det å bruke Swaply?»
- Tre ansikter eller en 1–5-skala, ett fritekstfelt med plassholder «Hva
  kunne vært bedre?», og `Send` / `Ikke nå`.
- Vises sjeldnere enn 14a. Tegn den som et ark som glir opp fra bunnen over
  14a sin kvitteringstilstand.

### 15 Varsler

- Ny varseltype: **«Ola likte Bosch drill 18V»**, med miniatyr av tingen og
  avataren til den som likte. Trykk går til 12.
- Tegn lista med tre typer over hverandre: en like, en ny swap, og en ny
  melding.

### 16a Rapporter / blokkér

- Rødfargen byttes til en kraftigere rød. Bruk `#E5484D` framfor dagens
  coral `#FF6B5E`. Coral beholdes ellers i appen som «nei»-farge, så de to
  skal ikke være samme verdi.

### 16b Innstillinger

- Fjern invitasjonsfargen, altså den fargede raden for invitasjoner. Raden
  settes i samme nøytrale stil som de andre.

### 16c Logg inn

- **Kun e-post.** Fjern alle andre innloggingsmåter fra skjermen. Ett felt,
  én knapp, og en linje om at vi sender en lenke.

---

## Åpne punkter og tolkninger

Tre steder tok jeg en avgjørelse for å komme videre. Alle er billige å
snu.

**Hvordan kommer man til 12 (Likt)?** Spørsmålet ditt. Fanen forsvant da
Likes ble tatt ut av bunn-nav, og med Chats inn er det ingen plass igjen.
Forslaget over er to veier inn: en rad på egen profil (13), og trykk på
like-varselet (15). Varselet er den som faktisk kommer til å bli brukt,
siden man går dit i det øyeblikket det har skjedd noe. Alternativet er å
ofre `Bytter` i nav-en, men det virker som en dårligere bytte.

**Chipene.** Jeg leste «Skriv en melding» som plassholderen i tekstfeltet,
og de tre andre som chipene over det. Hvis `Jeg vil ha` var ment som noe
annet enn en chip, si fra.

**Nummereringen.** 07i–07k rykker opp til 07a–07c. Alternativet er å la
hullet stå, som er tydeligere mot runde 4, men rart i en frisk eksport.

---

## Konsekvenser utenfor skjermene

Disse følger av lista og hører hjemme i `DESIGN.md` og datamodellen.

- **Flere ting per bytte** bryter dagens modell. `matches` har i dag «ordered
  participants + per-hop give/get» med én ting per hopp. Det må bli en liste
  per retning, pluss et beløp for mellomlegg.
- **Mellomlegg** innfører penger i modellen for første gang, samtidig som vi
  har bestemt at vi ikke fasiliterer betaling. Beløpet er altså en avtale
  mellom partene som vi noterer, ikke en transaksjon vi utfører. Det skillet
  må stå i vilkårene på 06b-2.
- **Motbytte** er en ny tilstand i byttets livsløp, ikke bare en knapp. Et
  bytte kan nå gå tilbake til forhandling framfor bare `pending → accepted`.
- **Interesser fra 02** er et nytt felt på `users`, og den første
  personaliseringen i produktet. Merk at `DESIGN.md` slår fast «no
  recommendation algorithm in v1» — interessebaserte rader på Oppdag er ikke
  en algoritme, men det er heller ikke ingenting.
- **Uleste meldinger** krever at `messages` får lest-status per deltaker.
- **Chat før bytte** betyr at en samtale ikke lenger alltid henger på en
  `match`. Tråder må kunne eksistere mellom to brukere om én gjenstand.
