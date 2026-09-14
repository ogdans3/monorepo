# RUNDT — landingsside

Én side om et spill som ikke er ute, og ett skjema som samler e-postadresser
til den dagen det er det.

Spillet er et trafikkpuslespill for telefon: du tegner ruta hver bil skal
kjøre gjennom krysset, og bilen kjører den. Sju baner, fra Rundkjøringen til
Fergekaia.

`PRODUCT.md` og `DESIGN.md` er kontrakten for hva sida sier og hvordan den ser
ut. `CLAUDE.md` er for den som skal endre noe.

## Kom i gang

```bash
npm start           # http://localhost:3000
npm run dev         # samme, men starter på nytt når en fil endrer seg
npm test            # 30 tester, ingen avhengigheter, ingen database
```

Det er ingen `npm install`. Prosjektet har **null avhengigheter** — serveren er
`node:http`, sida er HTML, CSS og 90 linjer JavaScript. Node 20 eller nyere.

## Hva som ligger hvor

```
src/server.js      starter http-serveren
src/app.js         rutene: statiske filer, påmelding, sletting, helsesjekk
src/statisk.js     leser public/ inn i minnet ved oppstart
src/lager.js       e-postlista, som JSON-linjer på disk
src/epost.js       validering og normalisering av adresser
src/kvote.js       bremse per avsender
src/kvittering.html  svarsida til den som sender skjemaet uten JavaScript
public/            hele nettsida
public/bilder/     skjermbilder fra spillet, webp i to bredder
public/skrift/     Archivo variabel, selvhostet
test/              node:test
```

## Miljøvariabler

| Variabel | Standard | Hva den gjør |
| --- | --- | --- |
| `PORT` | `3000` | porten serveren lytter på |
| `DATA_DIR` | `./data` | katalogen lista ligger i |
| `KONTAKT_EPOST` | tom | vises som kontaktadresse på personvernsida. Er den tom, forsvinner hele avsnittet |

## Lista

Adressene ligger i `$DATA_DIR/liste.jsonl`, én JSON-linje per person:

```json
{"epost":"ola@eksempel.no","tidspunkt":"2026-09-14T14:02:47.780Z","kilde":"apning"}
```

Eksport er `cat`. Det er med vilje: den mest sannsynlige måten denne fila noen
gang blir lest på, er at noen skal sende én e-post til alle sammen.

```bash
docker compose exec web cat /data/liste.jsonl | node -e \
  'process.stdin.on("data",d=>d.toString().trim().split("\n").forEach(l=>console.log(JSON.parse(l).epost)))'
```

## Drift

Bygges og startes gjennom dashboardet, ikke for hånd — `.dashboard.yaml`
peker på `web`-tjenesten, og det er dashboardet som kobler containeren på
`aicentral`-nettet som proxyen slår opp i.

Det er compose og ikke en enslig container av én grunn: lista ligger på et
navngitt volum. Dashboardet sletter og gjenskaper en enslig container ved hver
start, og da hadde adressene vært borte.

## Personvern

Sida lagrer e-postadresse, tidspunkt og hvilket skjema som ble brukt. Ikke
IP-adresse. Ingen informasjonskapsler, ingen analyse, ingen eksterne ressurser
— skrift, bilder og skript kommer fra samme server, og innholdspolicyen i
`src/app.js` sier nei til alt annet. `/personvern` har et sletteskjema som
faktisk fjerner rada fra fila.
