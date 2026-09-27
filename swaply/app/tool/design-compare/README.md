# Design compare

Lays the app's goldens beside the frames of the round-5 export and says, per
screen, how much differs. This is how «is it the same as the drawing?» gets an
answer that is not an opinion.

The export is the file `round-5.html` in the design repository; it is not part
of this one, so its path is given by hand.

```sh
cd app/tool/design-compare && npm install
export ROUND5_HTML=/path/to/round-5.html
export FLUTTER_ROOT=$HOME/flutter            # for the Roboto files
export CHROME_PATH=$(node -e "console.log(require('playwright-core').chromium.executablePath())")

npm run blueprint   # out/blueprint/<screen>.txt — geometry and style, the numbers the screens are built from
npm run ref         # out/ref/<screen>.png — each frame rendered in Roboto, 3×
(cd ../.. && flutter test --update-goldens test/goldens_test.dart)
npm run pairs       # out/pairs/<screen>.png — design | app | heat map, and a percentage
```

`CHROME_PATH` may point at any Chromium; `npx playwright install chromium`
fetches one if the machine has none.

The percentage counts pixels that differ by more than a little between the
golden and the phone in the frame. A frame is more than its phone — the badge
and the screen's name above it, 28 points with the gap, and on a few a note
under it — so `pairs.mjs` cuts the phone out of the frame at 28 and compares
that. Until 27.09.2026 it squashed the whole frame into 844 instead, which put
the drawing up to 27 points below the golden and counted every row twice;
percentages from before then are two to eleven points higher and not
comparable with these. Photographs, fixture names and the phone's own
glyphs (★ ♥ ⇄) keep it from ever reaching zero; use it to rank screens, not to
pass or fail them. The blueprint is what to build from — the pairs are what to
look at.
