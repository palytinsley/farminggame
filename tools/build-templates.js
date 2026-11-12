// Turns the original slide files (original-slides/*.html) into js/templates.js.
// Run with:  node tools/build-templates.js
// Each replacement is checked, so if an original slide changes the script stops
// and says which text it could not find.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'original-slides');
const ASSETS = path.join(ROOT, 'assets');
const OUT = path.join(ROOT, 'js', 'templates.js');

const assetFiles = fs.readdirSync(ASSETS);
function assetPath(id) {
  const f = assetFiles.find(n => n.startsWith(id + '.'));
  if (!f) throw new Error('Missing asset for blob ' + id);
  return 'assets/' + f;
}

function read(id) {
  let html = fs.readFileSync(path.join(SRC, id + '.html'), 'utf8').trim();
  html = html.replace(/\/_blob\/([0-9a-f]{32})/g, (_, b) => assetPath(b));
  return html;
}

// Pull every <x-embed> body out so it can be loaded into an iframe later.
const EMBEDS = {};
function extractEmbeds(id, html) {
  let n = 0;
  return html.replace(/<x-embed style="([^"]*)">([\s\S]*?)<\/x-embed>/g, (_, style, body) => {
    const key = id + '#' + n++;
    EMBEDS[key] = body;
    return `<x-embed data-embed="${key}" style="${style}"></x-embed>`;
  });
}

function rep(id, html, find, replace, all) {
  const count = html.split(find).length - 1;
  if (count === 0) throw new Error(`[${id}] could not find: ${String(find).slice(0, 80)}`);
  if (!all && count > 1) throw new Error(`[${id}] found ${count} times (expected 1): ${String(find).slice(0, 80)}`);
  return html.split(find).join(replace);
}
function repEmbed(key, find, replace) {
  EMBEDS[key] = rep(key, EMBEDS[key], find, replace);
}
function repEmbedRegex(key, re, replace) {
  if (!re.test(EMBEDS[key])) throw new Error(`[${key}] regex did not match: ${re}`);
  EMBEDS[key] = EMBEDS[key].replace(re, replace);
}

const T = {};

// ---------- static slides (shown exactly as in the deck) ----------
for (const id of ['returns-explained', 'sheet-map', 'sheet-crops',
  'p4-livestock', 'sheet-rest', 'p6-returns-idle', 'p6-returns', 'sheet-rev-crops', 'sheet-rev-rest']) {
  T[id] = extractEmbeds(id, read(id));
}

// ---------- sound cues inside the card-flip animations ----------
// The embeds run in a sandboxed iframe, so they ask the page to play each sound.
// The player decides whether a slide's sounds are on.
function addSfx(key) {
  repEmbed(key, '<script>\n', "<script>\nconst SFX=n=>{try{parent.postMessage({farmSfx:n},'*')}catch(e){}};\n");
  repEmbed(key, 'async function rev(o){\nif(o.r){', "async function rev(o){\nif(o.r){SFX('rattle');");
  repEmbed(key, 'await A(o.i,[tf(y0,s0,0,0),tf(-52', "SFX(o.r?'whooshBig':'whoosh');await A(o.i,[tf(y0,s0,0,0),tf(-52");
  repEmbed(key, 'await W(90);const m=o.r?16:5;', "await W(90);SFX(o.r?'chime':o.t=='l'?'thudLow':'thud');const m=o.r?16:5;");
  repEmbed(key, "if(o.r){o.f.classList.add('glow');", "if(o.r){o.f.classList.add('glow');SFX('sparkle');");
}

// ---------- slide 7: the $100 example, now flipped live instead of a video ----------
{
  let h = extractEmbeds('returns-reveal', read('returns-explained'));
  h = rep('returns-reveal', h, 'id="returns-explained"', 'id="returns-reveal"');
  repEmbed('returns-reveal#0',
    "function run(){cards.forEach((o,k)=>o.i.animate([tf(0,1,0,0),tf(-8,1.02,0,0),tf(0,1,0,0)],{duration:1800,iterations:Infinity,delay:k*140,easing:'ease-in-out'}))}",
    "async function run(){const fl=cards.map((o,k)=>o.i.animate([tf(0,1,0,0),tf(-8,1.02,0,0),tf(0,1,0,0)],{duration:900,iterations:2,delay:k*60,easing:'ease-in-out'}));await W(1500);fl.forEach(a=>a.cancel());for(const o of cards)await rev(o)}");
  addSfx('returns-reveal#0');
  T['returns-reveal'] = h;
}
addSfx('p6-returns#0');

// ---------- cover ----------
{
  let h = read('cover');
  h = rep('cover', h, 'Central Nebraska · 1885–1888', '{{region}} · {{yearRange}}');
  h = rep('cover', h, '>The Farming Game</h1>', '>{{title}}</h1>');
  h = rep('cover', h, 'Four years on a homestead along the Platte River', '{{subtitle}}');
  T.cover = h;
}

// ---------- homestead ----------
{
  let h = read('homestead');
  h = rep('homestead', h, 'Your 160 acres sit along', 'Your {{acres}} acres sit along');
  h = rep('homestead', h, 'color:#E0A526">160</p>', 'color:#E0A526">{{acres}}</p>');
  h = rep('homestead', h, 'color:#E0A526">3</p>', 'color:#E0A526">{{maxCrops}}</p>');
  h = rep('homestead', h, '>crops at most each year<', '>{{cropWord}} at most each year<');
  h = rep('homestead', h, 'color:#E0A526">4</p>', 'color:#E0A526">{{numYears}}</p>');
  h = rep('homestead', h, '>years: 1885 to 1888<', '>{{yearSpan}}<');
  // Land rental changes the acres card. Closed range changes the grazing line.
  h = rep('homestead', h, '>acres to farm<', '>{{acresLabel}}<');
  h = rep('homestead', h, 'Your livestock can graze on public land for free.', '{{rangeLine}}');
  h = rep('homestead', h, '<aside>The Homestead Act of 1862 gave settlers 160 acres if they lived on the land and farmed it for five years.</aside>', '<aside>{{homesteadNotes}}</aside>');
  T.homestead = h;
}

// ---------- money ----------
{
  let h = read('money');
  h = rep('money', h, 'Where your $1,500 goes', 'Where your {{capital}} goes');
  h = rep('money', h, 'left:128px;top:330px;width:1100px', 'left:128px;top:330px;width:{{w1}}px');
  h = rep('money', h, 'left:1236px;top:330px;width:330px', 'left:{{l2}}px;top:330px;width:{{w2}}px');
  h = rep('money', h, 'left:1574px;top:330px;width:218px', 'left:{{l3}}px;top:330px;width:{{w3}}px');
  h = rep('money', h, 'color:#F6F0E1">$1,000</p>', 'color:#F6F0E1">{{invest}}</p>');
  h = rep('money', h, 'color:#1F3A2B">$300</p>', 'color:#1F3A2B">{{living}}</p>');
  h = rep('money', h, 'color:#F6F0E1">$200</p>', 'color:#F6F0E1">{{shipping}}</p>');
  h = rep('money', h, 'They stay at $500 every year.', 'They stay at {{fixed}} every year.');
  T.money = h;
}

// Pieces that deck.js assembles at run time (rule rows, map squares).
const PARTS = {};

// ---------- rules ----------
// The rule rows are built in deck.js, so the list can grow with the optional modes
// and split across more than one slide. The row markup and the five original icons come from rules.html.
{
  let h = read('rules');
  const rowRe = /<div data-build-in="rise (\d) auto" style="position:absolute;left:128px;top:(\d+)px;width:1664px;display:flex;flex-direction:row;align-items:center;gap:32px">\n(<p style="width:72px[^\n]*>)(\d)<\/p>\n(<svg aria-label="(\w+)"[^\n]*<\/svg>)\n<p style="flex:1;font-size:36px;line-height:1.35">([^\n]*)<\/p>\n<\/div>\n/g;
  const rows = [...h.matchAll(rowRe)];
  if (rows.length !== 5) throw new Error('[rules] expected 5 rule rows, found ' + rows.length);
  PARTS.ruleIcons = {};
  rows.forEach(m => { PARTS.ruleIcons[m[6]] = m[5]; });
  const first = rows[0];
  PARTS.ruleRow = first[0]
    .replace('rise 1 auto', 'rise {{order}} auto').replace('top:290px', 'top:{{top}}px')
    .replace('>1</p>', '>{{n}}</p>').replace(first[5], '{{icon}}').replace(first[7], '{{text}}');
  // The first row comes before the others, so cut the whole run of rows out in one piece.
  const run = rows.map(m => m[0]).join('');
  if (!h.includes(run)) throw new Error('[rules] rows are not one block');
  h = h.replace(run, '{{rulesBody}}\n');
  h = rep('rules', h, '>Rules of the land</h2>', '>{{rulesTitle}}</h2>');
  h = h.replace(/<aside>[\s\S]*?<\/aside>/, '{{rulesNotes}}');
  T.rules = h;

  // New icons for the optional rules, drawn the same way as the originals.
  const icon = (name, paths) => `<svg aria-label="${name}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8A4A1E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:60px;height:60px">${paths}</svg>`;
  PARTS.ruleIcons.home = icon('home', '<path d="M5 12l-2 0l9 -9l9 9l-2 0" /> <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /> <path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" />');
  PARTS.ruleIcons.calendar = icon('calendar', '<path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z" /> <path d="M16 3v4" /> <path d="M8 3v4" /> <path d="M4 11h16" />');
  PARTS.ruleIcons.nobacksies = icon('no-return', '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /> <path d="M5.7 5.7l12.6 12.6" />');
  PARTS.ruleIcons.fence = icon('fence', '<path d="M4 4v16" /> <path d="M12 4v16" /> <path d="M20 4v16" /> <path d="M2 9h20" /> <path d="M2 15h20" />');
}

// ---------- renting land (new slide, shown only when Land rental is on) ----------
{
  let h = read('renting');
  h = rep('renting', h, 'You can rent extra land from Union Pacific Railroad.', 'You can rent extra land from {{landlord}}.');
  h = rep('renting', h, 'Each block is 50 acres and costs $100.', 'Each block is {{rentBlock}} acres and costs {{rentPriceM}}.');
  h = rep('renting', h, 'You can rent up to 2 blocks each year.', 'You can rent up to {{rentMaxBlocks}} {{blockWord}} each year.');
  h = rep('renting', h, 'color:#E0A526">$100</p>', 'color:#E0A526">{{rentPriceM}}</p>');
  h = rep('renting', h, '>for each 50-acre block<', '>for each {{rentBlock}}-acre block<');
  h = rep('renting', h, 'color:#E0A526">2</p>', 'color:#E0A526">{{rentMaxBlocks}}</p>');
  h = rep('renting', h, '>blocks at most each year<', '>{{blockWord}} at most each year<');
  h = h.replace(/<aside>[\s\S]*?<\/aside>/, '<aside>{{rentNotes}}</aside>');
  T.renting = h;
}

// ---------- practice round: variants for the optional modes ----------
// A line-by-line editor: each original element sits on its own line.
function editLine(id, html, test, fn) {
  const lines = html.split('\n');
  const hits = lines.map((l, i) => (typeof test === 'string' ? l.includes(test) : test.test(l)) ? i : -1).filter(i => i >= 0);
  if (hits.length !== 1) throw new Error(`[${id}] expected 1 line for ${test}, found ${hits.length}`);
  const out = fn(lines[hits[0]]);
  lines.splice(hits[0], 1, ...(out === null ? [] : [out]));
  return lines.join('\n');
}
function sub(line, find, replace) {
  if (!line.includes(find)) throw new Error('could not find ' + find + ' in ' + line.slice(0, 100));
  return line.split(find).join(replace);
}
function addAfter(id, html, test, extra) {
  return editLine(id, html, test, l => l + '\n' + extra);
}
const ARVO = "font-family:'Arvo', Georgia, serif;";
const box = (order, left, top, w, bg, text) =>
  `<p ${order ? `data-build-in="pop ${order}" ` : ''}style="position:absolute;left:${left}px;top:${top}px;width:${w}px;height:48px;background:${bg};${ARVO}font-size:34px;font-weight:700;line-height:48px;text-align:center;color:#1F3A2B;border-radius:4px">${text}</p>`;
const AC = '#8FDCE4', TOT = '#BCE08A', RET = '#F3DE6A', REV = '#EE8B72';

// Table rows that the handout gets in the optional modes (same cell styles as the originals).
const hatch = '#FFFFFF 0px, #FFFFFF 8px, #D9D4C6 8px, #D9D4C6 11px';
const rowIcon = (name, color, sw, size, paths) =>
  `<svg aria-label="${name}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="width:${size}px;height:${size}px">${paths}</svg>`;
const cellDiv = (left, top, w, bg, inner) =>
  `<div style="position:absolute;left:${left}px;top:${top}px;width:${w}px;height:56px;background:${bg};border:1px solid #BFB08A;display:flex;align-items:center;justify-content:center">${inner}</div>`;
const dashP = '<p style="font-size:30px;text-align:center;color:#9E9273">—</p>';
const zeroP = '<p style="font-size:30px;text-align:center;color:#5E5640">0</p>';
function labelDiv(top, bg, inner) {
  return `<div style="position:absolute;left:128px;top:${top}px;width:350px;height:56px;background:${bg};border:1px solid #BFB08A;display:flex;flex-direction:row;align-items:center;gap:14px;padding:0 14px">${inner}</div>`;
}
const pastureRow = top => [
  labelDiv(top, '#FFFFFF', rowIcon('Pasture', '#1F3A2B', 1.6, 40, '<path d="M3 20h18" /><path d="M12 20V8" /><path d="M12 20c-.4 -4 -2.4 -7 -5.5 -9" /><path d="M12 20c.4 -4 2.4 -7 5.5 -9" /><path d="M8 20c-.2 -2 -1.2 -3.6 -3 -4.8" /><path d="M16 20c.2 -2 1.2 -3.6 3 -4.8" />') +
    '<p style="font-size:28px;font-weight:700;color:#1F3A2B">Pasture <span style="color:#5E5640">(acres)</span></p>'),
  cellDiv(478, top, 250, '#F1F8F9', ''),
  cellDiv(728, top, 216, '#F6F0E1', dashP),
  cellDiv(944, top, 233, '#D6E4C4', dashP),
  `<div style="position:absolute;left:1177px;top:${top}px;width:266px;height:56px;background:#F6F0E1;border:1px solid #BFB08A;display:flex;align-items:center;justify-content:center">${dashP}</div>`,
  `<div style="position:absolute;left:1443px;top:${top}px;width:349px;height:56px;background:#F6F0E1;border:1px solid #BFB08A;display:flex;align-items:center;justify-content:center">${dashP}</div>`,
].join('\n');
const rentRow = top => [
  labelDiv(top, '#F6F0E1', rowIcon('Rented Land', '#8A4A1E', 2, 34, '<path d="M5 12l-2 0l9 -9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" />') +
    '<p style="font-size:28px;font-weight:700;color:#1F3A2B">Rented Land</p>'),
  cellDiv(478, top, 250, '#F1F8F9', ''),
  cellDiv(728, top, 216, '#F6F0E1', `<p style="font-size:21px;line-height:1.15;text-align:center;${ARVO}font-weight:700;color:#8A4A1E">{{rentPriceM}} per<br>{{rentBlock}} acres</p>`),
  cellDiv(944, top, 233, '#D6E4C4', ''),
  cellDiv(1177, top, 266, '#F6F0E1', zeroP),
  cellDiv(1443, top, 349, '#F6F0E1', zeroP),
].join('\n');

// The "rest of the sheet" slides. rent adds the Rented Land row; ex2 is the second worked example (pasture).
// Tops below are in the original slide's coordinates; rows that move down are shifted by shiftTops.
function shiftTops(html, past, rent) {
  const P = past ? 56 : 0, R = rent ? 56 : 0;
  return html.replace(/(?<![\w-])top:(\d+)px/g, (m, n) => {
    n = +n;
    const d = (n >= 526 ? P : 0) + (n >= 560 ? R : 0);
    return d ? `top:${n + d}px` : m;
  });
}
function restVariant(id, rent, ex2) {
  const rev = id === 'sheet-rev-rest';
  const P = ex2 ? 56 : 0, R = rent ? 56 : 0;
  let h = read(id);
  let note = null;
  if (ex2) {
    if (!rev) {
      h = editLine(id, h, 'data-build-in="pop 1"', l => sub(l, '>38<', '>6<'));
      h = editLine(id, h, 'data-build-in="pop 2"', l => sub(l, '>$380<', '>$60<'));
      h = editLine(id, h, 'data-build-in="fade 3"', l => sub(l, 'fade 3', 'fade 6'));
      h = editLine(id, h, 'data-build-in="pop 3"', l => sub(l, 'pop 3', 'pop 6'));
      h = editLine(id, h, 'data-build-in="pop 4"', l => sub(sub(sub(l, 'pop 4', 'pop 7'), '>$0<', '>$200<'), '#F4BE6B', TOT));
      h = editLine(id, h, 'data-build-in="pop 5"', l => sub(l, 'pop 5', 'pop 8'));
      h = editLine(id, h, 'data-build-in="rise 6"', l => sub(l, 'rise 6', 'rise 9'));
      h = addAfter(id, h, 'data-build-in="pop 2"', [box(3, 482, 474, 242, AC, '48'), box(4, 948, 474, 225, TOT, '$240')].join('\n'));
      h = editLine(id, h, '<aside>', () => '<aside>Total Amount Spent = $400 on corn + $100 on barley + $60 on cattle + $240 on hogs + $500 in fixed costs + $200 in savings = $1,500. Pasture costs nothing extra, so it adds nothing to the total.</aside>');
    } else {
      h = editLine(id, h, '>38</p>', l => sub(l, '>38<', '>6<'));
      h = editLine(id, h, /left:948px;top:362px/, l => sub(l, '>$380<', '>$60<'));
      h = editLine(id, h, 'data-build-in="pop 2"', l => sub(l, '>$380<', '>$60<'));
      h = editLine(id, h, /left:948px;top:680px/, l => sub(sub(l, '>$0<', '>$200<'), '#F4BE6B', TOT));
      h = editLine(id, h, 'data-build-in="pop 5"', l => sub(l, 'pop 5', 'pop 7'));
      h = editLine(id, h, 'data-build-in="pop 4"', l => sub(sub(sub(l, 'pop 4', 'pop 6'), '>$0<', '>$200<'), '#F4BE6B', REV));
      h = editLine(id, h, 'data-build-in="fade 3"', l => sub(l, 'fade 3', 'fade 5'));
      h = editLine(id, h, 'data-build-in="pop 3"', l => sub(l, 'pop 3', 'pop 5'));
      h = editLine(id, h, 'data-build-in="rise 6"', l => sub(l, 'rise 6', 'rise 8'));
      h = editLine(id, h, 'data-build-in="rise 7"', l => { note = l; return null; });
      h = editLine(id, h, '<aside>', () => '<aside>Total Revenue = $400 corn + $100 barley + $60 cattle + $240 hogs + $0 fixed costs + $200 savings = $1,000. Pasture has no revenue line, because it is not an investment.</aside>');
      // hogs row: filled in already, plus its return and revenue
      h = addAfter(id, h, /left:482px;top:362px/, box(0, 482, 474, 242, AC, '48') + '\n' + box(0, 948, 474, 225, TOT, '$240'));
      h = addAfter(id, h, 'data-build-in="pop 2"', box(3, 1181, 474, 258, RET, '1') + '\n' + box(4, 1447, 474, 341, REV, '$240'));
    }
  }
  h = shiftTops(h, ex2, rent);
  // The shaded "After the news" block covers the livestock rows, so it grows with the Pasture row.
  if (P && h.includes('top:358px;width:615px;height:168px')) h = h.replace('top:358px;width:615px;height:168px', `top:358px;width:615px;height:${168 + P}px`);
  if (rent) h = rep(id, h, 'Fixed costs &amp; savings', 'Rented land, fixed costs &amp; savings');
  // New table rows go in front of the fixed-costs header, so the callouts stay on top of them.
  const marker = `<div style="position:absolute;left:128px;top:${526 + P}px;width:1664px;height:38px`;
  const rows = [];
  if (ex2) rows.push(pastureRow(526));
  if (rent) rows.push(rentRow(564 + P));
  if (rows.length) h = rep(id, h, marker, rows.join('\n') + '\n' + marker);
  if (ex2) {
    const pastureAcres = box(rev ? 0 : 5, 482, 530, 242, AC, '30');
    // The pasture acres pop in with the livestock rows (or are already filled in on the revenue slide).
    h = rep(id, h, rows[0], rows[0] + '\n' + pastureAcres);
    if (rev) {
      // Punchline moves below the totals boxes, since the hogs row now fills the spot it used to sit in.
      const boxBottom = 756 + P + R + 150;
      note = note.replace('rise 7', 'rise 9').replace('left:1193px;top:418px;width:583px', `left:128px;top:${boxBottom + 8}px;width:1628px`).replace('padding:10px 18px', 'padding:6px 18px');
      h = rep(id, h, '</section>', note + '\n</section>');
    }
  }
  return h;
}
for (const id of ['sheet-rest', 'sheet-rev-rest']) {
  T[id] = read(id);
  T[id + '+r'] = restVariant(id, true, false);
  T[id + '+c'] = restVariant(id, false, true);
  T[id + '+r+c'] = restVariant(id, true, true);
}

// Crops slides in the second example: 80 acres of corn and 50 acres of barley.
{
  let h = read('sheet-crops');
  const id = 'sheet-crops';
  h = editLine(id, h, '">100</p>', l => sub(l, '>100<', '>80<'));
  h = editLine(id, h, '100 × $5 = $500', l => sub(l, '100 × $5 = $500', '80 × $5 = $400'));
  h = editLine(id, h, /left:948px;top:446px/, l => sub(l, '>$500<', '>$400<'));
  h = editLine(id, h, '">60</p>', l => sub(l, '>60<', '>50<'));
  h = editLine(id, h, '60 × $2 = $120', l => sub(l, '60 × $2 = $120', '50 × $2 = $100'));
  h = editLine(id, h, /left:948px;top:614px/, l => sub(l, '>$120<', '>$100<'));
  h = editLine(id, h, 'data-build-in="rise 6"', l => sub(sub(l, 'Crops cost $620.', 'Crops cost $500.'), '>$380</span> for livestock.', '>$500</span> for pasture and livestock.'));
  h = editLine(id, h, '<aside>', () => '<aside>Your 1885 Capital is already printed in the Capital box. $1,500 capital − $500 fixed costs − $500 on crops = $500 left for livestock and savings. Pasture comes out of your acres and costs nothing extra.</aside>');
  T['sheet-crops+c'] = h;

  h = read('sheet-rev-crops');
  const rid = 'sheet-rev-crops';
  h = editLine(rid, h, '">100</p>', l => sub(l, '>100<', '>80<'));
  h = editLine(rid, h, /left:948px;top:446px/, l => sub(l, '>$500<', '>$400<'));
  h = editLine(rid, h, 'data-build-in="pop 2"', l => sub(l, '>$500<', '>$400<'));
  h = editLine(rid, h, '">60</p>', l => sub(l, '>60<', '>50<'));
  h = editLine(rid, h, /left:948px;top:614px/, l => sub(l, '>$120<', '>$100<'));
  h = editLine(rid, h, 'data-build-in="pop 4"', l => sub(l, '>$120<', '>$100<'));
  h = editLine(rid, h, '<aside>', () => '<aside>Revenue = Total Cost × Investment Return. Corn: $400 × 1 = $400. Barley: $100 × 1 = $100.</aside>');
  T['sheet-rev-crops+c'] = h;
}

// The livestock slide in the second example: why only 6 cattle fit, and why hogs don't need land.
{
  const id = 'p4-livestock';
  let h = read(id);
  T[id] = h;
  h = rep(id, h, '>Buy livestock or save?<', '>Livestock and savings<');
  h = rep(id, h, 'width:140px;height:140px', 'width:96px;height:96px');
  h = rep(id, h, `<p style="${ARVO}font-size:48px;font-weight:700;color:#E0A526">38 cattle × $10 = $380</p>\n<p style="font-size:30px;color:#D9E2CF">That uses all $380.</p>`,
    `<p style="${ARVO}font-size:48px;font-weight:700;color:#E0A526">6 cattle × $10 = $60</p>\n<p style="font-size:30px;color:#D9E2CF">Cattle need pasture. 30 acres feed only 6 cattle.</p>\n` +
    `<p style="${ARVO}font-size:48px;font-weight:700;color:#E0A526">48 hogs × $5 = $240</p>\n<p style="font-size:30px;color:#D9E2CF">Hogs need no pasture, so this farm buys 48.</p>`);
  h = rep(id, h, '>or</p>', '>and</p>');
  h = rep(id, h, 'color:#2F5E3A">$380</p>', 'color:#2F5E3A">$200</p>');
  h = rep(id, h, '>Save it</h3>', '>Save the rest</h3>');
  h = rep(id, h, 'Write it on the Savings line. It comes back next year, no gain and no loss.', '$500 − $300 = $200. Write it on the Savings line. It comes back next year, no gain and no loss.');
  h = editLine(id, h, '<aside>', () => '<aside>After the crops, the farm has $500 left. Three units of pasture (30 acres) feed 6 cattle, so the farm buys 6 cattle for $60. Hogs need no pasture, so the farm buys 48 hogs for $240. The last $200 goes on the Savings line.</aside>');
  T[id + '+c'] = h;
}

// Planting slide: the plan, the map and its notes depend on the mode, so deck.js fills them in.
{
  let h = read('p2-plant');
  const id = 'p2-plant';
  h = rep(id, h, 'Our plan: 100 acres of corn and 60 acres of barley.', '{{p2Plan}}');
  h = rep(id, h, 'Write your acres in the Acres Planted column.', '{{p2Write}}');
  h = rep(id, h, 'width:980px', 'width:{{p2W}}px', true);
  const lines = h.split('\n');
  const g0 = lines.findIndex(l => l.startsWith('<div data-build-in="scale 4"'));
  const g1 = lines.findIndex(l => l.startsWith('<p data-build-in="fade 4 auto"'));
  if (g0 < 0 || g1 < g0) throw new Error('[p2-plant] could not find the map');
  PARTS.mapCornSrc = assetPath('7cdf60d71969d1a99f43e33648c4e985');
  PARTS.mapBarleySrc = assetPath('7f69873abe0aebf1f392ccce3870a138');
  lines.splice(g0, g1 - g0 + 1, '{{p2Map}}');
  h = lines.join('\n');
  h = editLine(id, h, '<aside>', () => '<aside>{{p2Notes}}</aside>');
  T[id] = h;
}

// ---------- menu (prices) ----------
{
  let h = extractEmbeds('menu', read('menu'));
  repEmbedRegex('menu#0', /const D=\[[^;]*\];/, 'const D={{menuD}};');
  // Closed range: an optional fourth value per animal is shown under its price.
  repEmbed('menu#0', ".p{font:700 32px Rockwell,'Roboto Slab',Georgia,serif;color:#8A4A1E}",
    ".p{font:700 32px Rockwell,'Roboto Slab',Georgia,serif;color:#8A4A1E}.q{font-size:26px;line-height:1.15;font-weight:600;color:#5E6B4E;margin-top:2px}");
  repEmbed('menu#0', "'<div><div class=n>'+d[1]+'</div><div class=p>'+d[2]+'</div></div>'",
    "'<div><div class=n>'+d[1]+'</div><div class=p>'+d[2]+'</div>'+(d[3]?'<div class=q>'+d[3]+'</div>':'')+'</div>'");
  T.menu = h;
}

// ---------- ready / final ----------
{
  let h = read('ready');
  h = rep('ready', h, 'Next up: 1885, with real money.', 'Next up: {{firstYear}}, with real money.');
  T.ready = h;
  let f = read('final');
  f = rep('final', f, 'Final harvest · 1888', 'Final harvest · {{lastYear}}');
  T.final = f;
}

// ---------- year templates (built from 1885, used for every round) ----------
{
  let h = read('y1885-plan');
  h = rep('plan', h, 'id="y1885-plan"', 'id="{{slideId}}"');
  h = rep('plan', h, '>Year 1 of 4</p>', '>{{yearOf}}</p>');
  h = rep('plan', h, '>1885</h1>', '>{{year}}</h1>');
  h = rep('plan', h, 'font-size:80px;font-weight:700;line-height:1.1;color:#F6F0E1">$1,500</p>',
    'font-size:{{capSize}}px;font-weight:700;line-height:{{capLine}};color:#F6F0E1">{{capText}}</p>');
  h = rep('plan', h, 'Your 1885 Capital of $1,500 is already printed.', '{{step1}}');
  h = rep('plan', h, 'Include your $500 in fixed costs.', 'Include your {{fixed}} in fixed costs.');
  // Room for a fifth step (the Land rental reminder). Empty unless rent is on.
  h = rep('plan', h, '</section>', '{{step5}}\n</section>');
  T['year-plan'] = h;
}
{
  let h = read('y1885-profits');
  h = rep('profits', h, 'id="y1885-profits"', 'id="{{slideId}}"');
  h = rep('profits', h, '>Year 1 of 4</p>', '>{{yearOf}}</p>');
  h = rep('profits', h, '>1885</h1>', '>{{year}}</h1>');
  h = rep('profits', h, 'Add up the Revenue column. That’s your Total Revenue for 1885.', '{{step3}}');
  h = rep('profits', h, 'Your Total Revenue becomes your 1886 Capital.', '{{step4}}');
  T['year-profits'] = h;
}
for (const kind of ['returns', 'returns-idle']) {
  const id = 'y1885-' + kind;
  let h = extractEmbeds('year-' + kind, read(id));
  h = rep(id, h, `id="${id}"`, 'id="{{slideId}}"');
  h = rep(id, h, '>1885 · Copy into the Investment Return column<', '>{{year}} · Copy into the Investment Return column<');
  h = rep(id, h, '>1885 returns</h2>', '>{{year}} returns</h2>');
  repEmbedRegex('year-' + kind + '#0', /const D=\[[^;]*\];/, 'const D={{returnsD}};');
  if (kind === 'returns') addSfx('year-returns#0');
  T['year-' + kind] = h;
}

// ---------- newspaper: template + the four original editions ----------
const NEWS = [];
function newsParts(html) {
  const lines = html.split('\n');
  const first = lines.findIndex(l => l.includes('data-build-in="fade 1'));
  let last = -1;
  lines.forEach((l, i) => { if (/data-build-in="fade \d/.test(l)) last = i; });
  const items = lines.slice(first, last + 1)
    .filter(l => l.startsWith('<p data-build-in'))
    .map(l => ({ order: +l.match(/fade (\d)/)[1], text: l.replace(/^.*?&#10070;<\/span>\s*/, '').replace(/<\/p>$/, '') }))
    .sort((a, b) => a.order - b.order)
    .map(o => decode(o.text));
  return { lines, first, last, items };
}
function decode(s) {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
}
function grab(html, re, label) {
  const m = html.match(re);
  if (!m) throw new Error('news: could not find ' + label);
  return m[1];
}
const THEMES = {};
['drought', 'blizzard', 'grasshoppers', 'flood'].forEach((theme, i) => {
  const html = read('y' + (1885 + i) + '-news');
  const bg = grab(html, /<section[^>]*style="background:(#[0-9A-Fa-f]{6})/, 'bg');
  const poster = grab(html, /<img src="([^"]+)"/, 'poster');
  const video = grab(html, /data-video="([^"]+)"/, 'video');
  const alt = grab(html, /<img[^>]*alt="([^"]*)"/, 'alt');
  THEMES[theme] = { bg, poster, video, alt };
  const p = newsParts(html);
  NEWS.push({
    theme,
    headline: decode(grab(html, /letter-spacing:1px;color:#231F18">([^<]*)<\/p>/, 'headline')),
    items: p.items,
    notes: decode(grab(html, /<aside>([\s\S]*?)<\/aside>/, 'notes')),
  });
});
{
  let h = read('y1885-news');
  const p = newsParts(h);
  h = [...p.lines.slice(0, p.first), '{{newsItems}}', ...p.lines.slice(p.last + 1)].join('\n');
  h = rep('news', h, 'id="y1885-news"', 'id="{{slideId}}"');
  h = rep('news', h, 'style="background:#C9672F;', 'style="background:{{bg}};');
  h = h.replace(/<img [^>]*>/, '{{backdrop}}');
  h = rep('news', h, '>Vol. I, No. 41</p>', '>Vol. {{vol}}, No. 41</p>');
  h = rep('news', h, '>Kearney, Neb.</p>', '>{{dateline}}</p>');
  h = rep('news', h, '>The Platte Valley Gazette</p>', '>{{paper}}</p>');
  h = rep('news', h, 'Central Nebraska &#160;·&#160; Harvest Edition, 1885', '{{region}} &#160;·&#160; Harvest Edition, {{year}}');
  h = rep('news', h, 'letter-spacing:1px;color:#231F18">Dry May Withers the Small Grains</p>', 'letter-spacing:1px;color:#231F18">{{headline}}</p>');
  h = rep('news', h, 'border-radius:16px">1885</p>', 'border-radius:16px">{{year}}</p>');
  h = h.replace(/<aside>[\s\S]*?<\/aside>/, '{{notesAside}}');
  T['year-news'] = h;
}

// ---------- original returns for each year, read from the embeds ----------
const RETURNS = [];
for (let y = 1885; y <= 1888; y++) {
  const raw = fs.readFileSync(path.join(SRC, `y${y}-returns.html`), 'utf8');
  const D = JSON.parse(raw.match(/const D=(\[[^;]*\]);/)[1]);
  const r = {};
  D.forEach(d => { r[d[0]] = parseFloat(d[2].replace('×', '')); });
  RETURNS.push(r);
}

const out = '// GENERATED by tools/build-templates.js from original-slides/. Do not edit by hand.\n' +
  'window.TEMPLATES = ' + JSON.stringify(T, null, 1) + ';\n' +
  'window.EMBEDS = ' + JSON.stringify(EMBEDS, null, 1) + ';\n' +
  'window.NEWS_THEMES = ' + JSON.stringify(THEMES, null, 1) + ';\n' +
  'window.ORIGINAL_NEWS = ' + JSON.stringify(NEWS, null, 1) + ';\n' +
  'window.ORIGINAL_RETURNS = ' + JSON.stringify(RETURNS) + ';\n' +
  'window.PARTS = ' + JSON.stringify(PARTS, null, 1) + ';\n';
fs.writeFileSync(OUT, out);
console.log('Wrote', path.relative(ROOT, OUT), (out.length / 1024).toFixed(0) + ' KB,',
  Object.keys(T).length, 'templates,', Object.keys(EMBEDS).length, 'embeds');
console.log(JSON.stringify(NEWS.map(n => [n.theme, n.headline, n.items.length]), null, 0));
console.log(JSON.stringify(RETURNS));
