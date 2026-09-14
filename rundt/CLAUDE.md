# Å jobbe i dette prosjektet

Les `README.md` først. `PRODUCT.md` og `DESIGN.md` er kontrakten, ikke pynt.

Dette er en mappe i et monorepo der ingen prosjekter henger sammen. Ingenting
her skal peke ut av `rundt/`.

## Invarianter

**Null avhengigheter.** Det er ingen `package-lock.json` og ingen
`node_modules`. Serveren er `node:http`, testene er `node:test`, sida er tre
filer. Skal du legge til en pakke, må du først ha prøvd uten.

**`public/` leses inn i minnet ved oppstart, og en URL som ikke er en nøkkel i
det kartet er 404.** Det er derfor det ikke finnes noen stinormalisering å
gjøre feil: `/../package.json` er ikke en nøkkel. Endrer du dette til å slå
opp på disk per forespørsel, har du innført en katalogtraversering.

**Innholdspolicyen er `default-src 'none'` med bare `'self'`.** Ingen
skrifter fra Google, ingen analyse, ingen innebygde videoer. Legger du til noe
utenfra, må du endre `CSP` i `src/app.js`, og da har du tatt en beslutning om
personvern som `PRODUCT.md` sier nei til.

**Skjemaet må virke uten JavaScript.** `src/app.js` forgrener på
`Content-Type`: kommer det inn som `application/x-www-form-urlencoded`, går
svaret ut som en HTML-side fra `src/kvittering.html`; kommer det som JSON, går
det ut som JSON. Legger du til et felt, må begge veier ta det.

**Sletting fjerner rada fra fila.** Den markeres ikke som slettet. En person
som ber om å bli borte, skal være borte fra `liste.jsonl`, ellers er
sletteknappen en løgn. `Lager.slett` skriver hele fila om og bytter den inn
med `rename`, så en strømstans ikke etterlater en halv liste.

**Både påmelding og sletting svarer likt uansett om adressen fantes fra før.**
Ellers er skjemaet et oppslagsverk over hvem som står på lista.

**Lista ligger på et volum, og derfor er dette compose og ikke en enslig
container.** Dashboardet sletter og gjenskaper enslige containere ved hver
start, uten volum. Bytter du til `http_port` i `.dashboard.yaml`, forsvinner
alle adressene neste gang noen trykker Start.

**Deploy gjennom dashboardet, aldri for hånd.** `docker compose up` fra
kommandolinja lager containeren på nytt uten å koble den på `aicentral`-nettet,
og da svarer proxyen 502.

**Ingen BuildKit-syntaks i Dockerfila.** Dashboardets docker-klient har ikke
buildx og faller tilbake på den klassiske byggeren, som stopper på `RUN --mount`.

**Kroppen leses med en grense, og forbindelsen rives ikke når grensa sprekker.**
Første versjon kalte `req.destroy()` med en gang, og da fikk avsenderen en
nullstilt forbindelse i stedet for 413. Se kommentaren i `lesKropp`.

## Innhold

**Alt som står på sida, står i spillet.** Banenavn, nivåtall, oppgraderinger,
krefter. Er du usikker, se etter i skjermbildene i `public/bilder/` eller la
det være. Sida skal ikke inneholde ett eneste påfunn.

**Norsk bokmål, ingen utropstegn.** Se `PRODUCT.md`.

## Design

`DESIGN.md` har fargene med kilde, de to tillatte visuelle sitatene fra
spillet, og den ene bevegelsen. Tre ting derfra som blir slitt bort først:

- Ingen kort, ingen telefonrammer, ingen skråstilte skjermbilder.
- `01–07` er spillets egen nummerering. Ikke nummerer noe annet.
- Alt som beveger seg har en vei ut gjennom `prefers-reduced-motion`.

Fargene finnes ett sted, `public/stil.css`, og er dokumentert i `DESIGN.md`.
Endrer du en, endrer du begge.

## Testing

```bash
npm test
```

30 tester over fire filer, ingen database, ingen nettverk ut. `test/app.test.js`
kjører mot en ekte http-server på en tilfeldig port, fordi det er der
stitraversering, ETag, gzip, kvote og skjema-uten-JavaScript faktisk lever.

Endrer du noe i `public/index.html` som teksten i en test slår opp, får du vite
det med en gang. Det er meningen.

## Konvensjoner

- Conventional Commits. Commit og push hver ferdige bit.
- Kommentarer forklarer *hvorfor*, særlig der koden ser rar ut med vilje.
- Norske navn i koden, fordi produktet er norsk og det holder de to i takt.
