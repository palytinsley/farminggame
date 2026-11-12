# The Farming Game

The Farming Game slide deck rebuilt as a program, with a settings mode for changing the numbers.

## Run it

Start the small local server (needs [Node.js](https://nodejs.org)) and open http://localhost:8123:

```bash
node tools/serve.js
```

Double-clicking `index.html` to open it in Chrome or Edge should also work, but that hasn't been tested yet.

The fonts come from Google Fonts, so the game needs an internet connection to look exactly like the deck. Without one, it falls back to similar fonts.

## Presenting

| Key | Action |
|---|---|
| → / Space / click | Next build, then next slide |
| ← | Previous slide |
| F | Full screen |
| N | Speaker notes |
| Esc | Back to the home screen |

## Settings

- **Money and land:** starting capital, living and shipping costs, acres, acres per planting unit, most crops per year, and the first year.
- **Land rental (optional, off by default):** students can rent extra land each year in blocks. Settings: the landlord (default Union Pacific Railroad), the rent per block, the acres per block, and the most blocks a farm can rent each year. When it is on, the rules are split over a second slide if they no longer fit, a "Renting land" slide follows them, the homestead slide shows the extra acres, the year plan slides remind students to write rent on the Rented Land line, and the practice handout gets a Rented Land row (empty) and a strip beside the map for rented land. Rent never comes back (its Investment Return is 0).
- **Closed range (optional, off by default):** the open range is closing, so cattle and sheep need pasture on the farm's own acres. Pasture comes out of the acres, partial units round up, and it is not a crop. When it is on, the Prices table gets a "Per 10 acres of pasture" column (using the real unit size) for how many animals one unit of pasture feeds; 0 means the animal needs no pasture (hogs, by default). The homestead, rules and price menu slides change to match, and the practice round switches to a second worked example with pasture (80 acres corn, 50 acres barley, 30 acres pasture, 6 cattle, 48 hogs, $200 savings). Like the first example, it always uses the original numbers.
- **Prices:** the name and price of each crop and animal.
- **Returns:** a multiplier for each item in each year. Card colors and captions ("Doubled", "Lost half", gold for ×3 or more) update to match.
- **Newspaper:** the headline, up to four news items, speaker notes, and which of the four background animations to play.
- **Years:** add or remove years.
- **Sound:** the card flips on slide 7 ("How returns work") play whoosh, thud, rattle, chime and sparkle sounds, made in the browser by `js/sfx.js`. You can also turn the same sounds on for each year's returns.
- **Saved setups:** save setups by name, export or import them as JSON files, or reset to the original game.

Settings save automatically in this browser.

The practice round is a worked example that matches the paper handout, so it always uses the original $1,500 numbers, whatever the prices or pasture rates are set to. You can turn it off in Settings.

With both optional modes off, the game is the same as before. Old saved setups and exported JSON files still load, and come up with both modes off. Every new rule value is stored in the settings (`rentOn`, `landlord`, `rentPrice`, `rentBlock`, `rentMaxBlocks`, `closedRange`, and `perUnit` on each animal), so a future printable handout can read them.

## Student handout (PDF)

**Make handout** (on the home screen and in Settings) downloads a print-ready, letter-size PDF with one page per game year, built from whatever settings are loaded right now: prices, item names, capital, fixed costs, acres, unit size, crop limit, years, and the Land rental and Closed range modes. The design is `reference/farming-handout-v7.html`. With Land rental on it adds a Rented Land row (the rent goes in Total Cost, return 0). With Closed range on it adds a Pasture row and a pasture rule card.

The PDF is drawn in the browser as vectors with [jsPDF](https://github.com/parallax/jsPDF) and [svg2pdf.js](https://github.com/yWorks/svg2pdf.js) (both MIT, vendored in `js/vendor/` with their licenses), with Arvo and Open Sans (SIL Open Font License) embedded as base64 so it works offline and from a double-clicked `index.html`. That code loads only when the button is clicked. `handoutModel(settings)` in `js/handout.js` turns the settings into plain data (pages, rule texts, ledger rows, hints) and `renderHandoutPdf(model)` draws it, so another export (Google Doc, HTML) can reuse the model. Check the model with `node tools/test-handout.js`.

## Presets

The "Saved setups" menu has a **Presets** group. These ship with the code (`js/presets.js`), so they are there on any computer, and they can't be deleted or overwritten. Your own saved setups are under **My setups**.

- **Original**: the game exactly as the slide deck had it, with **Land rental off** and Closed range off. This is also what "Reset to original" loads.
- **Cronin** (the version Justin Cronin runs): the original game with **Land rental on**, a different set of yearly returns, and different headlines, themes, and newspaper text for 1885 to 1888. The subtitle is "Can you survive on the Great Plains?". Closed range stays off. Everything else is the original.

## Files

- `original-slides/`: the deck's slides, kept as the source. The Land rental and Closed range changes to the sheet slides are made by `tools/build-templates.js`, which builds a version of each affected slide for each mode.
- `assets/`: the deck's videos, poster images and icons.
- `tools/build-templates.js`: turns `original-slides/` into `js/templates.js`. Run `node tools/build-templates.js` after changing an original slide.
- `js/deck.js`: builds the slide list from the settings.
- `js/player.js`: runs the presentation (transitions, builds, videos, animations).
- `js/app.js`: the home screen, settings and saved setups.
- `js/handout.js`, `js/handout-icons.js`, `js/vendor/`: the handout PDF (loaded on demand).
- `tools/test-handout.js`: tests for the handout model.
