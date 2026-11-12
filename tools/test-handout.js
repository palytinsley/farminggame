// Checks handoutModel() against the settings. No browser needed:  node tools/test-handout.js
// With --pdf <file> it also writes a text-only PDF (icons need a browser) to check the layout fits.
const assert = require('assert');
const path = require('path');
const root = path.join(__dirname, '..');
globalThis.window = globalThis;
['templates', 'defaults', 'presets'].forEach(f => require(path.join(root, 'js', f + '.js')));
const { handoutModel } = require(path.join(root, 'js', 'handout.js'));

const D = window.DEFAULT_SETTINGS, CRONIN = window.BUILT_IN_PRESETS.Cronin;
const text = parts => parts.map(p => p.t).join('');
const rows = m => m.sections.flatMap(s => s.rows);

// default game
let m = handoutModel(D);
assert.equal(m.pages.length, 4);
assert.deepEqual(m.pages.map(p => p.year), [1885, 1886, 1887, 1888]);
assert.equal(m.pages[0].yearLabel, 'Year 1 of 4');
assert.equal(m.pages[0].regionLine, 'Central Nebraska · 1885–1888');
assert.equal(m.pages[0].capital.prefilled, true);
assert.equal(m.pages[0].capital.text, '$1,500');
assert.equal(m.pages[1].capital.prefilled, false);
assert.equal(m.pages[0].spent.hint, 'Add the whole Total Cost column. It should equal your $1,500 Capital.');
assert.equal(m.pages[1].spent.hint, 'Add the whole Total Cost column. It should equal your Capital.');
assert.equal(m.pages[0].revenue.hint, 'Add the whole Revenue column. This becomes your Capital for 1886.');
assert.equal(m.pages[3].revenue.hint, 'Add the whole Revenue column. This is your final total for the game.');
assert.deepEqual(m.pages[2].footer, { left: 'The Farming Game · Activity Handout', right: '1887' });
assert.equal(m.rules.length, 4);
assert.equal(text(m.rules[0].parts), 'Fixed costs are $500 every year: $300 to live, $200 to ship crops by railroad.');
assert.equal(text(m.rules[1].parts), 'Plant up to 160 acres, in 10-acre units, with no more than three different crops.');
assert.equal(text(m.rules[2].parts), 'Livestock don’t use any acres. Buy as many animals as you can afford.');
assert.equal(text(m.rules[3].parts), 'Money you don’t spend goes on the Savings line.');
assert.deepEqual(m.sections.map(s => s.rows.length), [8, 3, 3]);
assert.deepEqual(rows(m).slice(0, 3).map(r => r.name), ['Corn', 'Beans', 'Wheat']);
assert.equal(m.sections[0].rows[0].cells[1].text, '$5');
const [living, shipping, savings] = m.sections[2].rows;
assert.equal(living.cells[2].text, '$300');
assert.equal(shipping.cells[2].text, '$200');
assert.deepEqual([living.cells[3].text, living.cells[4].text], ['0', '0']);
assert.equal(savings.cells[3].text, '1');
assert.equal(m.sections[0].rows[0].cells[3].text, undefined);   // Investment Return is blank
assert.equal(m.sections[0].rows[0].cells[4].text, undefined);   // Revenue is blank

// settings change the handout: names, prices, money, acres, units, crop limit, years
const s = window.cloneSettings(D);
s.items[0].name = 'Sweet Corn'; s.items[0].price = 7;
s.capital = 2000; s.living = 350; s.shipping = 150; s.acres = 80; s.unit = 5; s.maxCrops = 1; s.startYear = 1900; s.rounds = s.rounds.slice(0, 2);
m = handoutModel(s);
assert.equal(m.pages.length, 2);
assert.equal(m.pages[0].regionLine, 'Central Nebraska · 1900–1901');
assert.equal(text(m.rules[0].parts), 'Fixed costs are $500 every year: $350 to live, $150 to ship crops by railroad.');
assert.equal(text(m.rules[1].parts), 'Plant up to 80 acres, in 5-acre units, with only one crop.');
assert.equal(m.sections[0].rows[0].name, 'Sweet Corn');
assert.equal(m.sections[0].rows[0].cells[1].text, '$7');
assert.equal(m.pages[0].capital.text, '$2,000');
assert.equal(m.pages[1].revenue.hint, 'Add the whole Revenue column. This is your final total for the game.');
s.maxCrops = 5; assert.ok(text(handoutModel(s).rules[1].parts).includes('no more than five different crops'));

// Cronin: Land rental on
m = handoutModel(CRONIN);
assert.equal(m.rules.length, 5);
assert.equal(text(m.rules[2].parts).startsWith('Rent more land in blocks of 50 acres for $100 each, up to 2 blocks.'), true);
const rent = m.sections[0].rows[8];
assert.equal(rent.name, 'Rented Land');
assert.equal(rent.cells[0].fill, 'a');
assert.equal(rent.cells[1].text, '$100 / 50 ac');
assert.equal(rent.cells[2].fill, 'c');
assert.deepEqual([rent.cells[3].text, rent.cells[4].text], ['0', '0']);
assert.equal(m.sections[0].rows.length, 9);
assert.equal(m.sections[1].rows.length, 3);

// Closed range: a Pasture row and pasture rules
const cr = window.cloneSettings(D); cr.closedRange = true;
m = handoutModel(cr);
assert.equal(m.sections[1].rows.length, 4);
assert.equal(m.sections[1].rows[3].name, 'Pasture');
assert.equal(text(m.rules[2].parts), 'Cattle and sheep need pasture. One 10-acre unit feeds 2 cattle or 10 sheep. Partial units round up. Hogs are kept in pens and need none.');
cr.rentOn = true; assert.equal(handoutModel(cr).rules.length, 5);

// the model is plain data: it survives a JSON round trip
assert.deepEqual(JSON.parse(JSON.stringify(m)), m);
console.log('handoutModel: all checks passed');

const i = process.argv.indexOf('--pdf');
const inter = (p, q) => p.x < q.x + q.w - 0.01 && q.x < p.x + p.w - 0.01 && p.y < q.y + q.h - 0.01 && q.y < p.y + p.h - 0.01;
function checkCards(name, doc) {
  const cards = doc.__geometry.cards;
  assert.ok(cards.length > 0, name + ': no cards recorded');
  const pages = [...new Set(cards.map(c => c.page))];
  pages.forEach(pg => {
    const cs = cards.filter(c => c.page === pg);
    cs.forEach(c => {
      const b = c.box, t = c.content;
      assert.ok(t.x >= b.x && t.y >= b.y && t.x + t.w <= b.x + b.w + 0.01 && t.y + t.h <= b.y + b.h + 0.01, name + ' page ' + pg + ': card ' + c.n + ' content is outside its box');
      assert.ok(b.x >= 36 - 0.01 && b.x + b.w <= 576 + 0.01, name + ': card ' + c.n + ' is outside the margins');
    });
    for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) assert.ok(!inter(cs[a].box, cs[b].box), name + ' page ' + pg + ': cards ' + cs[a].n + ' and ' + cs[b].n + ' overlap');
  });
}
if (i > 0) {
  const fs = require('fs');
  globalThis.jspdf = require(path.join(root, 'js/vendor/jspdf-4.2.1.umd.min.js'));
  require(path.join(root, 'js/vendor/handout-fonts.js'));
  const { renderHandoutPdf } = require(path.join(root, 'js', 'handout.js'));
  const five = window.cloneSettings(D);
  five.rounds = five.rounds.concat([window.cloneSettings(five.rounds[3])]);
  five.items.forEach((it, k) => { it.name = 'Renamed ' + it.name; });
  five.rentOn = true;
  const both = window.cloneSettings(D); both.closedRange = true; both.rentOn = true;
  const setups = { default: D, cronin: CRONIN, both, five };
  (async () => {
    for (const [name, st] of Object.entries(setups)) {
      const doc = await renderHandoutPdf(handoutModel(st));
      assert.ok(doc.__layout.overflow <= 0.01, name + ' handout does not fit on the page');
      checkCards(name, doc);
      const out = process.argv[i + 1].replace(/.pdf$/, '') + '-' + name + '.pdf';
      fs.writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
      console.log(name, 'pages', doc.getNumberOfPages(), 'cards ok, row height', doc.__layout.rowHeight.toFixed(2), '->', out);
    }
    console.log('layout checks passed: no overlapping cards, all content inside its box');
  })().catch(e => { console.error(e.message); process.exit(1); });
}
