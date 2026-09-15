# Rondane Høyfjellshotell — designkontrakt

## Utgangspunktet

Malen er storfjordhotel.no: fullbredde bilde-hero med menyen over, kicker +
kondensert overskrift + kort tekst + understreket lenke, vekslende bilde og
tekst, og én varm kontrastseksjon. Det er *strukturen* vi låner. Paletten er
vår egen, fordi Rondane ikke er en fjord.

## Farger

Høyfjellet: granitt, frost og én blå aksent tatt fra Smiubelgen-logoen.
Én varm tone, furu, er reservert for restaurant og peis.

| Token | OKLCH | Bruk |
| --- | --- | --- |
| `--frost` | `0.975 0.006 235` | sidebakgrunn |
| `--frost-2` / `--frost-3` | `0.945` / `0.905` | sidefelt, kort, skillelinjer |
| `--granitt` | `0.235 0.022 240` | hero-overlegg, bunn, mørke seksjoner |
| `--blekk` | `0.205 0.02 240` | brødtekst på frost |
| `--blekk-dempet` | `0.42 0.026 240` | sekundærtekst, 7,4:1 mot frost |
| `--fjell` | `0.47 0.115 235` | lenker og fylte knapper på frost, 5,6:1 |
| `--fjell-lys` | `0.70 0.127 232` | logofargen `#42abe0`; kickere og lenker på granitt |
| `--furu` | `0.34 0.055 55` | den ene varme seksjonen |

Strategi: **committed**. Granitt bærer heisen, bunnen og én seksjon per side;
frost resten; blått gjør arbeidet som aksent. Nøytralene er tonet mot
logoblått (hue 235), ikke mot varmt.

Kontrast er sjekket i nettleseren på ferdig side, ikke antatt. Laveste forhold
på tekst er 5,6:1.

## Typografi

Én familie i to bredder: **Barlow Semi Condensed** (500/600/700) til overskrifter,
kickere og knapper, **Barlow** (400/500/600) til brødtekst. Barlow er tegnet
etter amerikanske veiskilt og har det samme skilt-DNA-et som Univers Condensed
i malen — uten å være den. Semi Condensed og ikke Condensed: Condensed-
varianten har feil bredde på Ø og Å, og norske overskrifter er fulle av dem.
Selvhostet, latin-utsnitt, ~22 kB per vekt.

Én kursiv til «stemmen»: **Source Serif 4 italic**, på nøyaktig ett sted per
side (sitatet under «Velkommen», undertittelen i forsidens hero). Det er
malens Haggard-italic-rolle, og den skal ikke spre seg.

- H1: `clamp(2.5rem, 1.7rem + 3.6vw, 4.75rem)`, versaler, 600
- H2: `clamp(1.9rem, 1.3rem + 2.4vw, 3.25rem)`, versaler, 600
- H3: `clamp(1.35rem, …, 1.85rem)`, minuskler
- Brødtekst: 1.0625rem / 1.6, maks 42rem bredde
- Kicker: 0.9rem, 600, sporing 0.12em, versaler, blå. **Ett navngitt system**:
  kickeren er seksjonsnavnet, ingenting annet.

Lys tekst på granitt får 1.68 i linjehøyde og 0.01em sporing.

## Komponenter

- **Hero**: bildet fyller, granitt-gradient nedenfra, tekst nederst til
  venstre (sentrert bare på forsida). Uten bilde: granittbånd.
- **Kort** (`Kort.astro`): bilde 3:2, kondensert tittel, undertittel (pris
  eller turfakta), pil. Brukes til undersider — det er det gamle rondane.no
  sine «bokser» het.
- **Sidefelt**: fakta, priser og «ting å se og gjøre». Frost-2, ved siden av
  teksten på ≥64rem, klistret under toppen.
- **Knapper**: fylt blå for bestill, omriss for alt annet. Versaler, 0.06em.
- **Bestill-bånd**: granitt, nederst på hver side unntatt personvern.
- **Meny**: fem seksjoner i toppen på ≥70rem, alltid en «Meny»-knapp som
  åpner hele treet på granitt.

## Bilder

Alle bilder er hotellets egne, optimalisert av Astro til avif/webp med
`srcset`. Heisen lastes `eager` med `fetchpriority=high`, alt annet `lazy`.
Alt-tekster beskriver hva som er på bildet, ikke «bilde av hotellet».

De fleste bildene fra gamle rondane.no er 640 px brede. Kort og sidefelt er
dimensjonert for det. Bare seks bilder er store nok til fullbredde-hero, og
det er de som brukes der. **Nye, store bilder er den ene tingen som ville
løftet sida mest.**

## Bevegelse

Lite, og ingen sideinnlastingskoreografi. Kort løfter seg 3 px og bildet zoomer
3 % ved hover, 220 ms ease-out. Pil-lenker skyver pila 4 px. Alt av dette går
bort under `prefers-reduced-motion: reduce`.

## Ikke gjør

- Ikke legg til flere fonter. Ikke bytt Barlow til Inter «for lesbarhet».
- Ikke kort på alt. Brødtekst er brødtekst.
- Ikke kickere over hver overskrift på forsida. De markerer seksjon.
- Ikke gradienttekst, ikke glass, ikke fargede kantstriper.
- Ikke bruk `--fjell-lys` som tekstfarge på frost: 3,0:1, den feiler.
