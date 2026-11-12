// Student handout (print-ready PDF), built from the same settings the game uses.
//
// Two parts:
//   handoutModel(settings)  pure function. Plain data only: no drawing, no DOM. Testable in Node.
//   renderHandoutPdf(model) draws the model with jsPDF (+ svg2pdf for the icons) and returns the document.
//
// The design is reference/farming-handout-v7.html. Letter size, 0.5in margins, one game year per page.
// Layout is in points, so it comes out the same everywhere. Sizes taken from the v7 CSS: 1 CSS px = 0.75 pt.
(function (root) {
  'use strict';

  // ------------------------------------------------------------------ model
  const HANDOUT_TITLE = 'Farming on the Frontier';
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const word = n => WORDS[n] || String(n);
  const num = n => String(+(+n).toFixed(2));
  const lc = x => String(x == null ? '' : x).toLowerCase();
  const cap = x => x.charAt(0).toUpperCase() + x.slice(1);
  const joinList = a => a.length < 2 ? a.join('') : a.length === 2 ? a.join(' and ') : a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1];
  const money = n => {
    n = +n || 0;
    const a = Math.abs(n);
    const t = Number.isInteger(a) ? a.toLocaleString('en-US') : a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '-$' : '$') + t;
  };
  const P = t => ({ t });
  const B = t => ({ t, b: true });

  function ruleCards(s) {
    const unit = num(s.unit);
    const living = +s.living || 0, shipping = +s.shipping || 0;
    const maxCrops = +s.maxCrops;
    const animals = s.items.filter(it => it.kind === 'animal');
    const needers = animals.filter(a => +a.perUnit > 0);
    const free = animals.filter(a => !(+a.perUnit > 0));
    const name = a => lc(a.name);
    const cards = [];

    cards.push({ icon: 'coins', parts: [P('Fixed costs are '), B(`${money(living + shipping)} every year`),
      P(`: ${money(living)} to live, ${money(shipping)} to ship crops by railroad.`)] });

    cards.push({ icon: 'plant', parts: [P('Plant up to '), B(`${(+s.acres).toLocaleString('en-US')} acres`), P(`, in ${unit}-acre units, with `),
      ...(maxCrops === 1 ? [B('only one crop'), P('.')] : [B(`no more than ${word(maxCrops)}`), P(' different crops.')])] });

    if (s.rentOn) {
      const blocks = +s.rentMaxBlocks === 1 ? 'block' : 'blocks';
      cards.push({ icon: 'home', parts: [P('Rent more land in blocks of '), B(`${num(s.rentBlock)} acres`), P(' for '), B(`${money(s.rentPrice)} each`),
        P(`, up to ${num(s.rentMaxBlocks)} ${blocks}. Rent is paid every year and never comes back. Write it on the `), B('Rented Land'),
        P(' line.' + (s.closedRange ? ' Rented land can be pasture.' : ''))] });
    }

    if (s.closedRange) {
      if (needers.length) {
        cards.push({ icon: 'paw', parts: [B(`${cap(joinList(needers.map(name)))} ${needers.length === 1 ? 'needs' : 'need'} pasture.`),
          P(` One ${unit}-acre unit feeds ${needers.map(a => `${num(a.perUnit)} ${name(a)}`).join(' or ')}. Partial units round up.` + (free.length ? ` ${cap(joinList(free.map(name)))} are kept in pens and need none.` : ''))] });
      } else {
        cards.push({ icon: 'paw', parts: [P('Your animals are kept in pens and fed, so they '), B('need no pasture'), P('.')] });
      }
    } else {
      cards.push({ icon: 'paw', parts: [P('Livestock '), B('don’t use any acres'), P('. Buy as many animals as you can afford.')] });
    }

    cards.push({ icon: 'piggy', parts: [P('Money you don’t spend goes on the '), B('Savings'), P(' line.')] });
    return cards.map((c, i) => Object.assign({ n: i + 1 }, c));
  }

  const X = { style: 'x', text: '—' };
  function ledgerSections(s) {
    const item = it => ({
      kind: 'item', icon: it.id, name: it.name, cells: [{ fill: 'a' }, { style: 'price', text: money(it.price) }, { fill: 'c' }, { fill: 'l' }, { fill: 'l' }],
    });
    const crops = s.items.filter(it => it.kind === 'crop').map(item);
    const livestock = s.items.filter(it => it.kind === 'animal').map(item);
    if (s.rentOn) {
      // Rent never comes back, so its return is 0. Students write the rent in Total Cost.
      crops.push({ kind: 'fixed', icon: 'home', name: 'Rented Land', cells: [{ fill: 'a' }, { style: 'price', text: `${money(s.rentPrice)} / ${num(s.rentBlock)} ac` }, { fill: 'c' }, { style: 'zero', text: '0' }, { style: 'zero', text: '0' }] });
    }
    if (s.closedRange && s.items.some(it => it.kind === 'animal' && +it.perUnit > 0)) {
      // Pasture comes out of the acres and costs nothing extra.
      livestock.push({ kind: 'fixed', icon: 'livestock', name: 'Pasture', sub: '(acres)', cells: [{ fill: 'a' }, X, X, X, X] });
    }
    const living = +s.living || 0, shipping = +s.shipping || 0;
    return [
      { title: 'Crops', icon: 'crops', rows: crops },
      { title: 'Livestock', icon: 'livestock', rows: livestock },
      { title: 'Fixed costs & savings', icon: 'home', rows: [
        { kind: 'fixed', icon: 'living', name: 'Living', cells: [X, X, { style: 'pre', text: money(living) }, { style: 'zero', text: '0' }, { style: 'zero', text: '0' }] },
        { kind: 'fixed', icon: 'shipping', name: 'Shipping', cells: [X, X, { style: 'pre', text: money(shipping) }, { style: 'zero', text: '0' }, { style: 'zero', text: '0' }] },
        { kind: 'fixed', icon: 'savings', name: 'Savings', sub: '(unspent)', cells: [X, X, { fill: 'c' }, { style: 'pre', text: '1' }, {}] },
      ] },
    ];
  }

  function handoutModel(s) {
    const N = s.rounds.length;
    const first = +s.startYear;
    const last = first + N - 1;
    const gameTitle = s.title || 'The Farming Game';
    const rules = ruleCards(s);
    const sections = ledgerSections(s);
    const span = N > 1 ? `${first}–${last}` : String(first);
    const pages = s.rounds.map((_, i) => {
      const year = first + i;
      const isFirst = i === 0, isLast = i === N - 1;
      return {
        index: i,
        year,
        yearLabel: `Year ${i + 1} of ${N}`,
        regionLine: [s.region, span].filter(Boolean).join(' · '),
        capital: isFirst ? { prefilled: true, text: money(s.capital) } : { prefilled: false, text: '' },
        spent: { title: `Total Amount Spent for ${year}`, hint: `Add the whole Total Cost column. It should equal your ${isFirst ? money(s.capital) + ' ' : ''}Capital.` },
        revenue: { title: `Total Revenue for ${year}`, hint: `Add the whole Revenue column. ${isLast ? 'This is your final total for the game.' : `This becomes your Capital for ${year + 1}.`}` },
        footer: { left: `${gameTitle} · Activity Handout`, right: String(year) },
      };
    });
    return {
      fileName: (gameTitle.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'farming-game') + '-handout.pdf',
      gameTitle,
      handoutTitle: HANDOUT_TITLE,
      yearsText: span,
      rules,
      key: { label: ['Each', 'row'], rows: [
        [{ icon: 'acres', text: 'Acres or Animals', fill: 'a' }, '×', { icon: 'costper', text: 'Cost Per' }, '=', { icon: 'calc', text: 'Total Cost', fill: 'c' }],
        [{ icon: 'calc', text: 'Total Cost', fill: 'c' }, '×', { icon: 'ret', text: 'Investment Return', fill: 'l' }, '=', { icon: 'rev', text: 'Revenue', fill: 'l' }],
      ] },
      columns: [
        { icon: null, lines: [] },
        { icon: 'acres', lines: ['Acres Planted', 'or Animals'], fill: 'a' },
        { icon: 'costper', lines: ['Cost Per', 'Acre or Animal'] },
        { icon: 'calc', lines: ['Total Cost'], fill: 'c' },
        { icon: 'ret', lines: ['Investment Return'], fill: 'l', later: 'after the news' },
        { icon: 'rev', lines: ['Revenue'], fill: 'l', later: 'after the news' },
      ],
      sections,
      pages,
    };
  }

  // ---------------------------------------------------------------- drawing
  const C = {
    green: '#1F3A2B', cream: '#F6F0E1', tan: '#EDE3C8', line: '#BFB08A', line2: '#9E8F68', rust: '#8A4A1E', gold: '#E0A526',
    red: '#A8432C', ink: '#1F2A22', muted: '#5E5640', paper: '#FFFFFF', xgray: '#9E9273',
    acres: '#F1F8F9', acresH: '#DDF0F2', cost: '#D6E4C4', costH: '#C3D6AA',
    hatchA: '#FFFFFF', hatchB: '#D9D4C6', hatchHA: '#EDE3C8', hatchHB: '#C9BC98',
  };
  const PX = 0.75;
  const MX = 36, MY = 36, W = 540, H = 720;          // 0.5in margins on letter
  const FONT_FILES = { 'Arvo 400': 'Arvo400', 'Arvo 700': 'Arvo700', 'Open Sans 400': 'OpenSans400', 'Open Sans 600': 'OpenSans600', 'Open Sans 700': 'OpenSans700', 'Open Sans 800': 'OpenSans800' };
  const SANS = w => 'OpenSans' + w, SERIF = w => 'Arvo' + w;

  function drawing(doc) {
    const canSvg = typeof doc.svg === 'function' && typeof DOMParser !== 'undefined';
    const d = {
      doc,
      font(f, size) { doc.setFont(f, 'normal'); doc.setFontSize(size); },
      w(str, f, size, cs) { d.font(f, size); return doc.getTextWidth(str) + (cs || 0) * str.length; },
      // y is the vertical centre of the line: baselines sit a little below it.
      text(str, x, cy, o) {
        o = o || {};
        d.font(o.f, o.size);
        doc.setTextColor(o.color || C.ink);
        const tw = d.w(str, o.f, o.size, o.cs);
        const x0 = o.align === 'center' ? x - tw / 2 : o.align === 'right' ? x - tw : x;
        doc.text(str, x0, cy + 0.36 * o.size, o.cs ? { charSpace: o.cs } : undefined);
        return tw;
      },
      fill(c) { doc.setFillColor(c); },
      stroke(c, lw) { doc.setDrawColor(c); doc.setLineWidth(lw); },
      rect(x, y, w, h, fill, line, lw, r) {
        const style = fill && line ? 'FD' : fill ? 'F' : 'S';
        if (fill) d.fill(fill);
        if (line) d.stroke(line, lw);
        if (r) doc.roundedRect(x, y, w, h, r, r, style); else doc.rect(x, y, w, h, style);
      },
      clipRect(x, y, w, h, r, fn) {
        doc.saveGraphicsState();
        if (r) doc.roundedRect(x, y, w, h, r, r, null); else doc.rect(x, y, w, h, null);
        doc.clip(); doc.discardPath();
        fn();
        doc.restoreGraphicsState();
      },
      // Diagonal stripes ("/" direction), clipped to the box. Same pitch as the v7 gradient: 5.5 css px, 1.5 px stripe.
      hatch(x, y, w, h, bg, fg) {
        d.rect(x, y, w, h, bg);
        d.clipRect(x, y, w, h, 0, () => {
          d.stroke(fg, 1.5 * PX);
          const step = 5.5 * PX * Math.SQRT2;
          for (let c = x + y; c <= x + w + y + h + step; c += step) doc.line(c - y, y, c - (y + h), y + h);
        });
      },
      async icon(key, x, y, size, color) {
        const ic = root.HANDOUT_ICONS && root.HANDOUT_ICONS[key];
        if (!ic || !canSvg) return;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="${ic.sw}" stroke-linecap="round" stroke-linejoin="round">${ic.d}</svg>`;
        const el = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
        await doc.svg(el, { x, y, width: size, height: size });
      },
    };
    return d;
  }

  // Break rich text (runs of {t, b}) into lines of at most `width` points.
  function wrapRich(d, parts, width, size) {
    const words = [];
    let cur = null;
    parts.forEach(p => {
      (p.t.match(/\s+|\S+/g) || []).forEach(tok => {
        if (/^\s+$/.test(tok)) { cur = null; return; }
        if (!cur) { cur = { runs: [], w: 0 }; words.push(cur); }
        const f = SANS(p.b ? 700 : 400);
        cur.runs.push({ t: tok, f });
        cur.w += d.w(tok, f, size);
      });
    });
    const sp = d.w(' ', SANS(400), size);
    const lines = [];
    let line = null;
    words.forEach(wd => {
      if (line && line.w + sp + wd.w <= width) { line.words.push(wd); line.w += sp + wd.w; }
      else { line = { words: [wd], w: wd.w }; lines.push(line); }
    });
    return { lines, sp };
  }

  function drawRich(d, wrapped, x, firstCy, lh, size, color) {
    wrapped.lines.forEach((ln, i) => {
      let cx = x;
      ln.words.forEach((wd, k) => {
        if (k) cx += wrapped.sp;
        wd.runs.forEach(r => { cx += d.text(r.t, cx, firstCy + i * lh, { f: r.f, size, color }); });
      });
    });
  }

  function fitText(d, str, f, size, maxW, minSize) {
    let s = size;
    while (s > minSize && d.w(str, f, s) > maxW) s = Math.max(minSize, s - 0.25);
    let t = str;
    if (d.w(t, f, s) > maxW) {                       // still too long at the smallest size: cut it short rather than wrap
      while (t.length > 1 && d.w(t + '…', f, s) > maxW) t = t.slice(0, -1);
      t += '…';
    }
    return { text: t, size: s };
  }

  // Rule cards. Each card's rectangle (x, y, w, h) is worked out once here; the box and everything inside it are drawn from it.
  // Cards in a row share the tallest card's height. Row gap = card gap. Rows are left-aligned, never stretched.
  const RULE = { G: 6, SIZE: 9, LH: 9 * 1.3, TOP: 5.25, HEAD: 17, GAP: 3, BOT: 6, PADX: 0.75 + 6.75 };
  function placeRules(d, cards, cols) {
    const R = RULE, cw = (W - R.G * (cols - 1)) / cols;
    const placed = cards.map((card, i) => ({ card, col: i % cols, row: Math.floor(i / cols), x: MX + (i % cols) * (cw + R.G), w: cw,
      wrapped: wrapRich(d, card.parts, cw - 2 * R.PADX, R.SIZE) }));
    const nRows = Math.ceil(cards.length / cols);
    let y = 0;
    for (let r = 0; r < nRows; r++) {
      const row = placed.filter(p => p.row === r);
      const h = 0.75 + R.TOP + R.HEAD + R.GAP + Math.max(...row.map(p => p.wrapped.lines.length)) * R.LH + R.BOT + 0.75;
      row.forEach(p => { p.y = y; p.h = h; });
      y += h + R.G;
    }
    return { cards: placed, h: y - R.G, cols };
  }
  function layoutRules(d, cards) {
    const n = cards.length;
    if (n <= 4) return placeRules(d, cards, n);
    // v7's own row (four default cards) is the height to beat; one row of five may be at most about 0.35in taller.
    const v7 = ruleCards({ living: 300, shipping: 200, acres: 160, unit: 10, maxCrops: 3, items: [], rentOn: false, closedRange: false });
    const limit = placeRules(d, v7, 4).h + 0.35 * 72;
    const one = placeRules(d, cards, n);
    if (n === 5 && one.h <= limit) return one;
    return placeRules(d, cards, 3);
  }

  async function renderHandoutPdf(model) {
    const jsPDF = (root.jspdf && root.jspdf.jsPDF) || root.jsPDF;
    if (!jsPDF) throw new Error('jsPDF is not loaded');
    const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait', compress: true });
    const fonts = root.HANDOUT_FONTS;
    if (!fonts) throw new Error('Handout fonts are not loaded');
    Object.keys(FONT_FILES).forEach(k => {
      const file = FONT_FILES[k] + '.ttf';
      doc.addFileToVFS(file, fonts[k]);
      doc.addFont(file, FONT_FILES[k], 'normal');
    });
    doc.setProperties({ title: `${model.gameTitle} · Activity Handout`, subject: 'Student activity handout', creator: 'The Farming Game' });
    const d = drawing(doc);
    const geo = { cards: [] };

    // ---- measurements shared by every page, so all the pages line up
    const rules = layoutRules(d, model.rules);
    const prefilled = model.pages.find(p => p.capital.prefilled);
    const amtFilledW = prefilled ? d.w(prefilled.capital.text, SERIF(700), 18) + 20 * PX + 3 : 0;
    const amtW = Math.max(1.05 * 72, amtFilledW);
    const capLblW = 12 + 5 * PX + d.w('CAPITAL', SANS(700), 8, 0.14 * 8);
    const capW = Math.max(amtW, capLblW) + 28 * PX + 1.5;
    const yearW = Math.max(d.w('YEAR 10 OF 10', SANS(700), 8, 0.16 * 8) * 0.9, d.w('1885', SERIF(700), 28)) + 32 * PX;
    const HEAD_H = 62;
    const MATH_H = 54;
    const TH = 44, SEC_H = 15, FOOT_H = 18, GAP = 6;
    const TB_PAD = 9, TB_IN = TB_PAD + 1.5;
    const tw = (W - 10 * PX) / 2;
    const hintW = tw - 2 * TB_IN - 11 - 4.5;
    const hintLines = Math.max(...model.pages.map(p => Math.max(
      wrapRich(d, [P(p.spent.hint)], hintW, 9).lines.length, wrapRich(d, [P(p.revenue.hint)], hintW, 9).lines.length)));
    const HINT_LH = 9 * 1.35;
    const TOT_H = 1.5 + 4.5 + 16 + 2.25 + 17.5 + 2.25 + hintLines * HINT_LH + 5.25 + 1.5;
    const bodyRows = model.sections.reduce((n, s) => n + s.rows.length, 0);
    const fixedH = HEAD_H + rules.h + MATH_H + TH + model.sections.length * SEC_H + TOT_H + FOOT_H + GAP * 5;
    const rh = Math.max(13, Math.min(21.5, (H - fixedH) / bodyRows));
    const overflow = fixedH + rh * bodyRows - H;
    const layout = { rowHeight: rh, overflow };

    const cols = [0.21, 0.15, 0.13, 0.14, 0.16, 0.21].map(f => f * W);
    const colX = cols.reduce((a, w) => { a.push(a[a.length - 1] + w); return a; }, [MX]);

    for (let pi = 0; pi < model.pages.length; pi++) {
      if (pi) doc.addPage('letter', 'portrait');
      const pg = model.pages[pi];
      let y = MY;

      // ---- header
      {
        const x = MX, w = W, h = HEAD_H;
        d.clipRect(x, y, w, h, 7.5, () => {
          d.rect(x, y, yearW, h, C.green);
          d.rect(x + w - capW, y, capW, h, C.cream);
          d.rect(x + w - capW, y, 1.5, h, C.green);
        });
        d.rect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, null, C.green, 1.5, 7);
        // year block
        const yc = y + h / 2;
        d.text(pg.yearLabel.toUpperCase(), x + 12, yc - 14.5, { f: SANS(700), size: 8, color: C.gold, cs: 0.16 * 8 });
        d.text(String(pg.year), x + 12, yc + 6.5, { f: SERIF(700), size: 28, color: C.cream });
        // title block
        const mx = x + yearW + 10.5;
        d.text(pg.regionLine.toUpperCase(), mx, y + 12.5, { f: SANS(700), size: 8, color: C.rust, cs: 0.16 * 8 });
        d.text(model.handoutTitle, mx, y + 28.5, { f: SERIF(700), size: 16, color: C.green });
        const wy = y + 47;
        let wx = mx;
        wx += d.text('Name of Farm', wx, wy, { f: SANS(600), size: 10 }) + 6 * PX * 1.3;
        d.stroke(C.ink, 1.5 * PX); doc.line(wx, wy + 5.5, wx + 144, wy + 5.5);
        wx += 144 + 14 * PX;
        wx += d.text('Period', wx, wy, { f: SANS(600), size: 10 }) + 6 * PX * 1.3;
        doc.line(wx, wy + 5.5, wx + 36, wy + 5.5);
        // capital
        const cx0 = x + w - capW + 1.5, cw = capW - 1.5, ccx = cx0 + cw / 2;
        const lblW = capLblW;
        const lx = ccx - lblW / 2;
        await d.icon('capital', lx, y + 16.5 - 6, 12, C.rust);
        d.text('CAPITAL', lx + 12 + 5 * PX, y + 16.5, { f: SANS(700), size: 8, color: C.green, cs: 0.14 * 8 });
        const bw = amtW, bx = ccx - bw / 2, by = y + 26, bh = 18 * 1.15 + 3;
        if (pg.capital.prefilled) {
          d.rect(bx, by, bw, bh, C.paper, C.gold, 1.5, 4.5);
          d.text(pg.capital.text, ccx, by + bh / 2, { f: SERIF(700), size: 18, color: C.red, align: 'center' });
        } else {
          d.rect(bx, by, bw, bh, C.paper, C.gold, 1.5, 4.5);   // same gold box as year 1, with just a $ in it
          d.text('$', bx + 1.5 + 7.5, by + bh / 2, { f: SERIF(700), size: 18, color: C.ink });
        }
        y += h + GAP;
      }

      // ---- rules
      for (const rc of rules.cards) {
        const R = RULE, cy0 = y + rc.y;
        d.rect(rc.x + 0.375, cy0 + 0.375, rc.w - 0.75, rc.h - 0.75, C.cream, C.line, 0.75, 7.5);
        const ix = rc.x + R.PADX, top = cy0 + 0.75 + R.TOP;
        doc.setFillColor(C.green); doc.circle(ix + 8.25, top + R.HEAD / 2, 8.25, 'F');
        d.text(String(rc.card.n), ix + 8.25, top + R.HEAD / 2, { f: SERIF(700), size: 10.5, color: C.gold, align: 'center' });
        await d.icon(rc.card.icon, ix + 16.5 + 5.25, top + (R.HEAD - 17) / 2, 17, C.rust);
        drawRich(d, rc.wrapped, ix, top + R.HEAD + R.GAP + R.LH / 2, R.LH, R.SIZE, C.ink);
        const lines = rc.wrapped.lines.length;
        geo.cards.push({ page: pi, n: rc.card.n, box: { x: rc.x, y: cy0, w: rc.w, h: rc.h },
          content: { x: ix, y: top, w: Math.max(16.5 + 5.25 + 17, ...rc.wrapped.lines.map(l => l.w)), h: R.HEAD + R.GAP + lines * R.LH } });
      }
      y += rules.h + GAP;

      // ---- "Each row" key
      {
        d.stroke(C.line2, 1.5 * PX);
        doc.setLineDashPattern([3.5, 2.5], 0);
        doc.roundedRect(MX + 0.55, y + 0.55, W - 1.1, MATH_H - 1.1, 7.5, 7.5, 'S');
        doc.setLineDashPattern([], 0);
        const kx = MX + 9 + 0.75;
        d.text('EACH', kx, y + MATH_H / 2 - 6, { f: SANS(700), size: 9, color: C.rust, cs: 0.12 * 9 });
        d.text('ROW', kx, y + MATH_H / 2 + 6, { f: SANS(700), size: 9, color: C.rust, cs: 0.12 * 9 });
        const keyW = d.w('EACH', SANS(700), 9, 0.12 * 9);
        const startX = kx + keyW + 9;
        for (let r = 0; r < 2; r++) {
          const cy = y + 4.5 + 0.75 + 9.75 + r * (19.5 + 3.75);
          let cx = startX;
          for (const el of model.key.rows[r]) {
            if (typeof el === 'string') {
              d.text(el, cx + 4.5, cy, { f: SERIF(700), size: 12, color: C.muted, align: 'center' });
              cx += 9 + 6;
              continue;
            }
            const tx = d.w(el.text, SANS(600), 10);
            const cwid = 6 + 13 + 4.5 + tx + 7.5 + (el.fill === 'l' ? 6 : 0) + 1.5;
            const chH = 19.5, top = cy - chH / 2;
            const bg = el.fill === 'a' ? C.acresH : el.fill === 'c' ? C.costH : C.paper;
            if (el.fill === 'l') d.hatch(cx, top, cwid, chH, C.hatchHA, C.hatchHB); else d.rect(cx, top, cwid, chH, bg);
            d.rect(cx + 0.375, top + 0.375, cwid - 0.75, chH - 0.75, null, C.line2, 0.75, 4.5);
            let ix = cx + 0.75 + 6;
            await d.icon(el.icon, ix, cy - 6.5, 13, C.rust);
            ix += 13 + 4.5;
            if (el.fill === 'l') d.rect(ix - 2.25, cy - 6.5, tx + 4.5, 13, C.paper, null, 0, 2.25);
            d.text(el.text, ix, cy, { f: SANS(600), size: 10 });
            cx += cwid + 6;
          }
        }
        y += MATH_H + GAP;
      }

      // ---- ledger
      {
        const lw = 0.75;
        const top = y;
        // head
        for (let c = 0; c < 6; c++) {
          const col = model.columns[c], x = colX[c], w = cols[c];
          const fill = col.fill === 'a' ? C.acresH : col.fill === 'c' ? C.costH : C.tan;
          if (col.fill === 'l') d.hatch(x, y, w, TH, C.hatchHA, C.hatchHB); else d.rect(x, y, w, TH, fill);
          if (c === 0) continue;
          const cx = x + w / 2;
          let bottom = y + TH - 3.75;
          if (col.later) {
            const lt = col.later.toUpperCase() === col.later ? col.later : col.later;
            const lwid = d.w(lt, SANS(700), 7.5, 0.04 * 7.5) + 6;
            d.rect(cx - lwid / 2, bottom - 9.5, lwid, 9.5, C.paper, null, 0, 2.25);
            d.text(lt, cx - lwid / 2 + 3, bottom - 4.75, { f: SANS(700), size: 7.5, color: C.muted, cs: 0.04 * 7.5 });
            bottom -= 9.5 + 2.25;
          }
          const n = col.lines.length;
          for (let i = n - 1; i >= 0; i--) {
            const cy = bottom - 4.9 - (n - 1 - i) * 9.8;
            const t = col.lines[i];
            const tx = d.w(t, SANS(700), 8.5);
            if (col.later) d.rect(cx - tx / 2 - 2.25, cy - 5.5, tx + 4.5, 11, C.tan, null, 0, 2.25);
            d.text(t, cx, cy, { f: SANS(700), size: 8.5, color: C.green, align: 'center' });
          }
          const topLine = bottom - n * 9.8 - 1.5;
          await d.icon(col.icon, cx - 6.5, topLine - 13, 13, C.rust);
        }
        y += TH;
        const rowsTop = y;
        const nameCol = cols[0];
        const bands = [];
        for (const sec of model.sections) {
          bands.push({ y, sec });   // a band is one merged cell; it is drawn after all the rows so no grid line crosses it
          y += SEC_H;
          for (const row of sec.rows) {
            const isFixed = row.kind === 'fixed';
            const cy2 = y + rh / 2;
            // name cell
            d.rect(MX, y, nameCol, rh, isFixed ? C.cream : C.paper);
            const isz = Math.min(isFixed ? 14 : 16, rh - 1.5);
            await d.icon(row.icon, MX + 6, cy2 - isz / 2, isz, isFixed ? C.rust : C.green);
            const tx0 = MX + 6 + isz + 6;
            const room = nameCol - 12 - isz - 6;
            const wt = isFixed ? 700 : 600;
            const subW = row.sub ? d.w(' ' + row.sub, SANS(400), 8.5) : 0;
            const fit = fitText(d, row.name, SANS(wt), 11, room - subW, 9);
            const nw = d.text(fit.text, tx0, cy2, { f: SANS(wt), size: fit.size });
            if (row.sub) d.text(' ' + row.sub, tx0 + nw, cy2, { f: SANS(400), size: 8.5, color: C.muted });
            // other cells
            row.cells.forEach((cell, k) => {
              const c = k + 1, x = colX[c], w = cols[c];
              if (cell.fill === 'a') d.rect(x, y, w, rh, C.acres);
              else if (cell.fill === 'c') d.rect(x, y, w, rh, C.cost);
              else if (cell.fill === 'l') d.hatch(x, y, w, rh, C.hatchA, C.hatchB);
              else d.rect(x, y, w, rh, isFixed ? C.cream : C.paper);
              if (cell.text) {
                const st = cell.style;
                const mid = x + w / 2;
                if (st === 'price' || st === 'pre') {
                  const fit = fitText(d, cell.text, SERIF(700), 11, w - 6, 9);   // shrink to fit, 9pt at the smallest
                  d.text(fit.text, mid, cy2, { f: SERIF(700), size: fit.size, color: st === 'price' ? C.rust : C.ink, align: 'center' });
                }
                else if (st === 'zero') d.text(cell.text, mid, cy2, { f: SANS(400), size: 11, color: C.muted, align: 'center' });
                else d.text(cell.text, mid, cy2, { f: SANS(400), size: 9, color: C.xgray, align: 'center' });
              }
            });
            // grid lines for this row
            d.stroke(C.line, lw);
            doc.line(MX, y + rh, MX + W, y + rh);
            colX.forEach(x => doc.line(x, y, x, y + rh));   // column lines one row at a time, so bands stay clear
            y += rh;
          }
        }
        d.stroke(C.line, lw);
        colX.forEach(x => doc.line(x, top, x, top + TH));
        doc.line(MX, top, MX + W, top);
        doc.line(MX, top + TH, MX + W, top + TH);
        for (const bd of bands) {
          d.rect(MX, bd.y, W, SEC_H, C.tan);
          d.stroke(C.line, lw);
          doc.line(MX, bd.y, MX, bd.y + SEC_H); doc.line(MX + W, bd.y, MX + W, bd.y + SEC_H);
          doc.line(MX, bd.y + SEC_H, MX + W, bd.y + SEC_H);
          d.stroke(C.green, 1.5); doc.line(MX, bd.y + 0.75, MX + W, bd.y + 0.75);
          const cy = bd.y + 0.75 + (SEC_H - 0.75) / 2;
          await d.icon(bd.sec.icon, MX + 6, cy - 7, 14, C.rust);
          d.text(bd.sec.title.toUpperCase(), MX + 6 + 14 + 5.25, cy, { f: SANS(800), size: 9, color: C.green, cs: 0.12 * 9 });
        }
        y += GAP;
      }

      // ---- totals
      {
        const boxes = [
          { x: MX, t: pg.spent, icon: 'calc', hintIcon: null, fill: null },
          { x: MX + tw + 10 * PX, t: pg.revenue, icon: 'rev', hintIcon: 'arrow', fill: C.cream },
        ];
        for (const b of boxes) {
          d.rect(b.x + 0.75, y + 0.75, tw - 1.5, TOT_H - 1.5, b.fill, C.green, 1.5, 7.5);
          if (!b.fill) { /* border only */ }
          const ix = b.x + TB_IN;
          let cy = y + 1.5 + 4.5 + 8;
          await d.icon(b.icon, ix, cy - 8, 16, C.rust);
          d.text(b.t.title, ix + 16 + 6, cy, { f: SANS(700), size: 11, color: C.green });
          cy += 8 + 2.25 + 8.75;
          const dw = d.text('$', ix, cy, { f: SERIF(700), size: 14 });
          d.stroke(C.ink, 2 * PX * 1.33);
          doc.line(ix + dw + 6, cy + 8.75, b.x + tw - TB_IN, cy + 8.75);
          cy += 8.75 + 2.25;
          const hy = cy + HINT_LH / 2;
          if (b.hintIcon) await d.icon(b.hintIcon, ix, hy - 5.5 + 0.7, 11, C.green);
          else { d.stroke(C.ink, 1.5 * PX); doc.roundedRect(ix + 0.56, hy - 4.5 + 0.7, 9 - 1.1, 9 - 1.1, 1.5, 1.5, 'S'); }
          const wr = wrapRich(d, [P(b.t.hint)], hintW, 9);
          drawRich(d, wr, ix + 11 + 4.5, hy, HINT_LH, 9, C.muted);
        }
        y += TOT_H;
      }

      // ---- footer, pinned to the bottom margin
      {
        const fy = MY + H - FOOT_H;
        d.stroke(C.line, 0.75); doc.line(MX, fy + 0.375, MX + W, fy + 0.375);
        const cy = fy + 6 + 5.5;
        d.text(pg.footer.left, MX, cy, { f: SANS(400), size: 8.5, color: C.muted });
        d.text(pg.footer.right, MX + W, cy, { f: SANS(400), size: 8.5, color: C.muted, align: 'right' });
      }
    }
    doc.__layout = layout;
    doc.__geometry = geo;
    return doc;
  }

  const api = { model: handoutModel, render: renderHandoutPdf };
  root.Handout = api;
  root.handoutModel = handoutModel;
  root.renderHandoutPdf = renderHandoutPdf;
  if (typeof module !== 'undefined' && module.exports) module.exports = Object.assign({ handoutModel, renderHandoutPdf }, api);
})(typeof window !== 'undefined' ? window : globalThis);
