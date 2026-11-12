// Builds the list of slides from the settings.
(function () {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const money = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  const word = n => WORDS[n] || String(n);
  const roman = n => {
    const t = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let s = '';
    for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
    return s;
  };

  // Turns a return multiplier into the card's color class and caption.
  function returnInfo(x) {
    x = Number(x) || 0;
    const shown = '×' + String(+x.toFixed(2));
    if (x <= 0) return { shown: '×0', cls: 'l', label: 'Wiped out' };
    if (x < 1) {
      const lost = Math.round((1 - x) * 100);
      return { shown, cls: 'l', label: lost === 50 ? 'Lost half' : 'Lost ' + lost + '%' };
    }
    if (x === 1) return { shown, cls: 'e', label: 'Broke even' };
    const cls = x >= 3 ? 'r' : 'g';
    const named = { 2: 'Doubled', 3: 'Tripled', 4: 'Quadrupled' };
    if (named[x]) return { shown, cls, label: named[x] };
    if (Number.isInteger(x) && x <= 12) {
      const w = word(x);
      return { shown, cls, label: w[0].toUpperCase() + w.slice(1) + ' times over' };
    }
    return { shown, cls, label: 'Up ' + Math.round((x - 1) * 100) + '%' };
  }

  function render(tpl, vals) {
    return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => {
      if (!(k in vals)) { console.warn('Missing value for', k); return ''; }
      return vals[k];
    });
  }

  function newsItemsHtml(items) {
    items = items.map(s => String(s || '').trim()).filter(Boolean).slice(0, 4);
    const leftCount = Math.ceil(items.length / 2);
    const cols = [items.slice(0, leftCount), items.slice(leftCount)];
    const longest = Math.max(0, ...cols.map(c => c.reduce((a, s) => a + s.length, 0)));
    // The columns hold about 190 characters at the original size; shrink a little past that.
    // Longer columns step down further (the original game never goes past 190, so it is unchanged).
    const size = longest > 290 ? 24 : longest > 225 ? 26 : longest > 190 ? 29 : 33;
    let order = 0;
    return cols.map((col, ci) => {
      if (!col.length) return '';
      const parts = col.map((text, i) => {
        order++;
        const rule = i > 0 ? '<div style="height:0px;border-top:1px solid #8C7D5C"></div>' : '';
        return rule + `<p data-build-in="fade ${order} auto" style="font-family:'Old Standard TT', Georgia, serif;font-size:${size}px;line-height:1.3;color:#231F18"><span style="color:#8A2E1C">&#10070;</span> ${esc(text)}</p>`;
      }).join('');
      return `<div style="position:absolute;left:${ci ? 676 : 176}px;top:566px;width:444px;height:340px;display:flex;flex-direction:column;gap:20px;overflow:hidden">${parts}</div>`;
    }).join('\n');
  }

  // ---------- optional modes: Land rental and Closed range ----------
  const numStr = n => String(+(+n).toFixed(2));
  const lc = s => String(s == null ? '' : s).toLowerCase();
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const joinList = a => a.length < 2 ? a.join('') : a.length === 2 ? a.join(' and ') : a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1];

  function pastureInfo(s) {
    const animals = s.items.filter(it => it.kind === 'animal');
    return { animals, needers: animals.filter(a => +a.perUnit > 0), free: animals.filter(a => !(+a.perUnit > 0)) };
  }
  // Acres of pasture that `count` animals need. Partial units round up.
  const pastureNeed = (item, count, unit) => (+item.perUnit > 0 ? Math.ceil(count / +item.perUnit) * unit : 0);
  const pastureRate = (it, unit) => (+it.perUnit > 0 ? `${numStr(it.perUnit)} per ${unit} acres` : 'No pasture needed');

  // The pasture rules, written from the settings. Each string is one rule.
  function pastureRules(s) {
    const unit = +s.unit;
    const { animals, needers, free } = pastureInfo(s);
    const name = a => esc(lc(a.name));
    const out = [];
    if (needers.length) {
      out.push(`${cap(joinList(needers.map(name)))} ${needers.length === 1 ? 'needs' : 'need'} pasture. One ${unit}-acre unit feeds ${needers.map(a => `${numStr(a.perUnit)} ${name(a)}`).join(' or ')}.`);
    }
    if (free.length) {
      out.push(free.length === animals.length ? 'Your animals are kept in pens and fed, so they need no pasture.'
        : `${cap(joinList(free.map(name)))} are kept in pens and fed, so they need no pasture.`);
    }
    if (needers.length) {
      const a = needers[0];
      out.push(`Pasture comes out of your acres. Partial units round up: 3 ${name(a)} need ${pastureNeed(a, 3, unit)} acres.`);
      out.push('Pasture isn’t a crop. It doesn’t count toward the crop limit and costs nothing extra.');
    }
    return out;
  }

  function rangeLine(s) {
    if (!s.closedRange) return 'Your livestock can graze on public land for free.';
    const { needers } = pastureInfo(s);
    if (!needers.length) return 'The open range is closing. Your animals are kept in pens and fed.';
    return `The open range is closing. ${cap(joinList(needers.map(a => esc(lc(a.name)))))} ${needers.length === 1 ? 'needs' : 'need'} pasture on your land.`;
  }
  function homesteadNotes(s) {
    return 'The Homestead Act of 1862 gave settlers 160 acres if they lived on the land and farmed it for five years.' +
      (s.closedRange ? ' By the mid-1880s the open range was closing, as settlers fenced their land and the hard winters of 1886 to 1888 killed many cattle left out on it.' : '');
  }

  // Rules slide. The rows are built here so the list can grow and split across slides.
  const CPL = 84;        // about how many characters fit on one line at 36px (used when the page can't measure)
  let ruler = null;
  // How many lines a rule takes. The page measures it, so it follows whichever font is loaded.
  function ruleLines(html) {
    if (typeof document === 'undefined' || !document.body) return Math.max(1, Math.ceil(html.length / CPL));
    if (!ruler) {
      ruler = document.createElement('div');
      ruler.style.cssText = "position:fixed;left:-9999px;top:0;width:1468px;font:400 36px/1.35 'Open Sans', Arial, sans-serif;visibility:hidden";
      document.body.appendChild(ruler);
    }
    ruler.innerHTML = html;
    return Math.max(1, Math.round(ruler.getBoundingClientRect().height / 48.6));
  }
  const RULES_CAP = 730; // tallest a page of rules can be (top 290 down to about 1020)
  function ruleList(s) {
    const unit = +s.unit;
    const list = [
      { icon: 'plant', text: `Plant up to ${(+s.acres).toLocaleString('en-US')} acres, in ${unit}-acre units.` },
      { icon: 'dots', text: +s.maxCrops === 1 ? 'Plant only one crop in one year.' : `Plant no more than ${word(+s.maxCrops)} different crops in one year.` },
    ];
    if (s.rentOn) {
      list.push(
        { icon: 'home', text: `You can rent more land in blocks of ${numStr(s.rentBlock)} acres for ${money(s.rentPrice)} each, up to ${numStr(s.rentMaxBlocks)} ${+s.rentMaxBlocks === 1 ? 'block' : 'blocks'}.` },
        { icon: 'calendar', text: 'Rent is paid every year. Land you rented last year is gone unless you rent it again.' },
        { icon: 'nobacksies', text: 'Rent never comes back. Its Investment Return is 0, like living and shipping costs.' },
        { icon: 'home', text: `Rented land follows the same rules as your homestead: ${unit}-acre units and the same crop limit.` + (s.closedRange ? ' Rented land can be used as pasture.' : '') });
    }
    if (s.closedRange) pastureRules(s).forEach(t => list.push({ icon: 'fence', text: t }));
    else list.push({ icon: 'paw', text: 'Buy as many animals as you can afford. They don’t use any of your acres.' });
    list.push({ icon: 'costper', text: 'Seed, labor, supplies, taxes, and upkeep are already in the price.', cost: true });
    list.push({ icon: 'piggy', text: 'Money you don’t spend goes on the Savings line.' });
    return list;
  }

  // Split the rules over as few slides as fit, with the rows spread evenly.
  function splitRows(rows) {
    const n = rows.length;
    const H = (a, b) => {
      const sl = rows.slice(a, b);
      return sl.reduce((t, r) => t + r.h, 0) + (sl.length - 1) * (sl.some(r => r.lines > 1) ? 36 : 48);
    };
    for (let k = 1; k <= n; k++) {
      const best = Array.from({ length: k + 1 }, () => Array(n + 1).fill(Infinity));
      const cut = Array.from({ length: k + 1 }, () => Array(n + 1).fill(0));
      best[0][0] = 0;
      for (let j = 1; j <= k; j++) for (let i = 1; i <= n; i++) for (let m = j - 1; m < i; m++) {
        const v = Math.max(best[j - 1][m], H(m, i));
        if (v < best[j][i]) { best[j][i] = v; cut[j][i] = m; }
      }
      if (best[k][n] <= RULES_CAP || k === n) {
        const pages = [];
        let i = n;
        for (let j = k; j >= 1; j--) { const m = cut[j][i]; pages.unshift(rows.slice(m, i)); i = m; }
        return pages;
      }
    }
  }
  function rulePages(s) {
    const rows = ruleList(s).map((r, i) => {
      const lines = ruleLines(r.text);
      return Object.assign({ n: i + 1, lines, h: Math.max(72, Math.round(lines * 48.6)) }, r);
    });
    return splitRows(rows).map((page, p) => {
      const gap = page.some(r => r.lines > 1) ? 36 : 48;
      let y = 290;
      const body = page.map((r, i) => {
        const html = render(window.PARTS.ruleRow, { order: i + 1, top: y, n: r.n, icon: window.PARTS.ruleIcons[r.icon], text: r.text });
        y += r.h + gap;
        return html;
      }).join('');
      const cost = page.find(r => r.cost);
      return {
        rulesTitle: p ? 'Rules of the land, continued' : 'Rules of the land',
        rulesBody: body,
        rulesNotes: cost ? `<aside>Rule ${cost.n} means the price per acre or per animal is the only cost you pay for that crop or herd. Your fixed costs are separate.</aside>` : '',
      };
    });
  }

  // Year plan reminder (step 5) for Land rental.
  function rentStep(s) {
    if (!s.rentOn) return '';
    return '<div data-build-in="rise 5 auto" style="position:absolute;left:848px;top:880px;width:944px;display:flex;flex-direction:row;align-items:start;gap:28px">' +
      '<p style="width:72px;height:72px;border-radius:50%;background:#E0A526;color:#1F3A2B;font-family:\'Arvo\', Georgia, serif;font-size:36px;font-weight:700;line-height:2;text-align:center">5</p>' +
      '<p style="flex:1;font-size:34px;line-height:1.35;color:#2E3B2A">Write any rent on the Rented Land line. Rent counts in your Total Amount Spent.</p></div>';
  }

  // Practice round planting slide: the plan, the map and the notes. Closed range uses the second example.
  const CORN = '#E0A526', BARLEY = '#B9C79A', PASTURE = '#8DBF8A';
  function practiceMap(s) {
    const ex2 = !!s.closedRange, rent = !!s.rentOn;
    const cells = ex2 ? [['corn', 8], ['barley', 5], ['pasture', 3]] : [['corn', 10], ['barley', 6]];
    const cell = rent ? 112 : 128, icon = rent ? 70 : 80;
    const gridW = cell * 4 + 36;
    const label = { corn: 'Corn', barley: 'Barley', pasture: 'Pasture' };
    const color = { corn: CORN, barley: BARLEY, pasture: PASTURE };
    const glyph = {
      corn: `<img src="${window.PARTS.mapCornSrc}" alt="" style="width:${icon}px;height:${icon}px;object-fit:contain">`,
      barley: `<img src="${window.PARTS.mapBarleySrc}" alt="" style="width:${icon}px;height:${icon}px;object-fit:contain">`,
      pasture: `<svg viewBox="0 0 24 24" fill="none" stroke="#1F3A2B" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:${icon}px;height:${icon}px"><path d="M3 20h18"/><path d="M12 20V8"/><path d="M12 20c-.4-4-2.4-7-5.5-9"/><path d="M12 20c.4-4 2.4-7 5.5-9"/><path d="M8 20c-.2-2-1.2-3.6-3-4.8"/><path d="M16 20c.2-2 1.2-3.6 3-4.8"/></svg>`,
    };
    const squares = cells.map(([k, n]) => `<div style="background:${color[k]};border-radius:12px;display:flex;align-items:center;justify-content:center">${glyph[k]}</div>\n`.repeat(n)).join('');

    // Rented land: an empty strip beside the grid, one column of squares for each block.
    let gx = 1244, strip = '';
    const gy = 270, capTop = rent ? gy + gridW + 16 : 836;
    if (rent) {
      const W = 232;
      gx = 1792 - W - 36 - gridW;
      const per = Math.max(1, Math.min(12, Math.ceil(+s.rentBlock / +s.unit) || 1));
      const blocks = Math.max(1, Math.min(6, Math.round(+s.rentMaxBlocks) || 1));
      const bc = per <= 5 ? 1 : per <= 10 ? 2 : 3, rows = Math.ceil(per / bc);
      const gin = 8, gbl = 20;
      const sz = Math.max(18, Math.min(88, Math.floor((gridW - (rows - 1) * gin) / rows), Math.floor((W - (blocks - 1) * gbl - blocks * (bc - 1) * gin) / (blocks * bc))));
      const block = `<div style="display:grid;grid-template-columns:repeat(${bc}, ${sz}px);grid-auto-rows:${sz}px;gap:${gin}px">` +
        '<div style="border:3px dashed #9E8F68;border-radius:12px;background:#FBF7EC;box-sizing:border-box"></div>'.repeat(per) + '</div>';
      strip = `<div data-build-in="fade 4 auto" style="position:absolute;left:${1792 - W}px;top:${gy}px;width:${W}px">` +
        `<div style="display:flex;flex-direction:row;gap:${gbl}px;height:${gridW}px">${block.repeat(blocks)}</div>` +
        `<p style="margin-top:16px;font-size:24px;font-weight:700;line-height:1.25;color:#5E6B4E">Rented from ${esc(s.landlord || window.DEFAULT_SETTINGS.landlord)}</p></div>`;
    }
    const grid = `<div data-build-in="scale 4" style="position:absolute;left:${gx}px;top:${gy}px;width:${gridW}px;height:${gridW}px;display:grid;grid-template-columns:repeat(4, ${cell}px);grid-template-rows:repeat(4, ${cell}px);gap:12px">\n${squares}</div>`;
    let legend;
    if (ex2) {
      legend = `<div data-build-in="fade 4 auto" style="position:absolute;left:${gx}px;top:${capTop}px;width:${gridW}px;display:flex;flex-direction:column;gap:8px">` +
        cells.map(([k, n]) => `<div style="display:flex;flex-direction:row;align-items:center;gap:14px"><div style="flex:none;width:28px;height:28px;border-radius:7px;background:${color[k]}"></div><p style="font-size:28px;font-weight:600;color:#1F3A2B">${label[k]}: ${n} units</p></div>`).join('') + '</div>';
    } else {
      legend = `<p data-build-in="fade 4 auto" style="position:absolute;left:${gx}px;top:${capTop}px;width:${gridW}px;font-size:28px;font-weight:600;color:#1F3A2B;text-align:center">${cells.map(([k, n]) => `${label[k]}: ${n} units`).join(' · ')}</p>`;
    }
    return {
      p2W: rent ? 870 : 980,
      p2Plan: ex2 ? 'Our plan: 80 acres of corn, 50 acres of barley, and 30 acres of pasture.' : 'Our plan: 100 acres of corn and 60 acres of barley.',
      p2Write: ex2 ? 'Write your acres in the Acres Planted column. Pasture acres go on the Pasture line.' : 'Write your acres in the Acres Planted column.',
      p2Map: grid + '\n' + legend + (strip ? '\n' + strip : ''),
      p2Notes: 'Each square is one 10-acre unit, so the 4-by-4 grid is the full 160 acres.' +
        (ex2 ? ' The three pasture squares are 30 acres, enough to feed 6 cattle.' : '') +
        (rent ? ' The empty strip is for rented land. This practice farm doesn’t rent any.' : ''),
    };
  }

  function build(s) {
    const N = s.rounds.length;
    const firstYear = +s.startYear;
    const lastYear = firstYear + N - 1;
    const fixed = (+s.living) + (+s.shipping);
    const invest = (+s.capital) - fixed;

    // The money bar keeps the deck's proportions: 1,648px shared by the three boxes.
    const total = Math.max(1, +s.capital);
    const w2 = Math.max(240, Math.round(1648 * (+s.living) / total));
    const w3 = Math.max(218, Math.round(1648 * (+s.shipping) / total));
    const w1 = Math.max(300, 1648 - w2 - w3);
    const l2 = 128 + w1 + 8, l3 = l2 + w2 + 8;

    const g = {
      title: esc(s.title), subtitle: esc(s.subtitle), region: esc(s.region),
      paper: esc(s.paper), dateline: esc(s.dateline),
      yearRange: N > 1 ? `${firstYear}–${lastYear}` : String(firstYear),
      yearSpan: N > 1 ? `years: ${firstYear} to ${lastYear}` : `year: ${firstYear}`,
      firstYear, lastYear, numYears: N,
      acres: (+s.acres).toLocaleString('en-US'), unit: +s.unit,
      maxCrops: +s.maxCrops, cropWord: +s.maxCrops === 1 ? 'crop' : 'crops',
      cropRule: +s.maxCrops === 1 ? 'Plant only one crop in one year.'
        : `Plant no more than ${word(+s.maxCrops)} different crops in one year.`,
      capital: money(s.capital), invest: money(invest), living: money(s.living),
      shipping: money(s.shipping), fixed: money(fixed),
      w1, w2, w3, l2, l3,
      menuD: JSON.stringify(s.items.map(it => {
        const row = [it.id, it.name, money(it.price)];
        // Closed range: show the pasture rate under each animal's price.
        if (s.closedRange && it.kind === 'animal') row.push(pastureRate(it, +s.unit));
        return row;
      })),
      landlord: esc(s.landlord || window.DEFAULT_SETTINGS.landlord), rentBlock: numStr(s.rentBlock), rentMaxBlocks: numStr(s.rentMaxBlocks),
      rentPriceM: money(s.rentPrice), blockWord: +s.rentMaxBlocks === 1 ? 'block' : 'blocks',
      acresLabel: s.rentOn ? `acres + up to ${(+s.rentBlock * +s.rentMaxBlocks).toLocaleString('en-US')} to rent` : 'acres to farm',
      rangeLine: rangeLine(s), homesteadNotes: homesteadNotes(s),
      rentNotes: 'The federal government gave the Union Pacific Railroad every other section of land along its track, to help pay for building the line. Homesteaders near Kearney who wanted more land often rented from the railroad.',
    };

    const slides = [];
    const add = (id, tpl, section, extra) => {
      const vals = Object.assign({}, g, extra || {}, { slideId: id });
      slides.push({ id, section, vals, html: render(window.TEMPLATES[tpl], vals) });
    };

    add('cover', 'cover', 'Setting up');
    add('homestead', 'homestead', 'Setting up');
    add('money', 'money', 'Setting up');
    rulePages(s).forEach((p, i) => add(i ? 'rules-' + (i + 1) : 'rules', 'rules', 'Setting up', p));
    if (s.rentOn) add('renting', 'renting', 'Setting up');
    add('menu', 'menu', 'Setting up');
    add('returns-explained', 'returns-explained', 'Setting up');
    add('returns-reveal', 'returns-reveal', 'Setting up', { sfx: s.introSounds !== false });
    if (s.includePractice) {
      // Closed range uses the second worked example (with pasture). Land rental adds the Rented Land row.
      const c = s.closedRange ? '+c' : '', rc = (s.rentOn ? '+r' : '') + c;
      const P = 'Practice round';
      add('sheet-map', 'sheet-map', P);
      add('p2-plant', 'p2-plant', P, practiceMap(s));
      add('sheet-crops', 'sheet-crops' + c, P);
      add('p4-livestock', 'p4-livestock' + c, P);
      add('sheet-rest', 'sheet-rest' + rc, P);
      add('p6-returns-idle', 'p6-returns-idle', P);
      add('p6-returns', 'p6-returns', P, { sfx: !!s.revealSounds });
      add('sheet-rev-crops', 'sheet-rev-crops' + c, P);
      add('sheet-rev-rest', 'sheet-rev-rest' + rc, P);
    }
    add('ready', 'ready', s.includePractice ? 'Practice round' : 'Setting up');

    s.rounds.forEach((r, i) => {
      const year = firstYear + i;
      const last = i === N - 1;
      const sec = String(year);
      const yearOf = `Year ${i + 1} of ${N}` + (last && N > 1 ? ' · Last year' : '');
      add(`y${year}-plan`, 'year-plan', sec, i === 0 ? {
        yearOf, year, capSize: 80, capLine: 1.1, capText: money(s.capital),
        step1: `Your ${year} Capital of ${money(s.capital)} is already printed.`, step5: rentStep(s),
      } : {
        yearOf, year, capSize: 44, capLine: 1.25, capText: `Your ${year - 1} Total Revenue`,
        step1: `Write your ${year - 1} Total Revenue in the Capital box.`, step5: rentStep(s),
      });

      const theme = window.NEWS_THEMES[r.theme];
      add(`y${year}-news`, 'year-news', sec, {
        year, vol: roman(i + 1),
        bg: theme ? theme.bg : '#8A6E4B',
        backdrop: theme ? `<img src="${theme.poster}" data-video="${theme.video}" alt="${theme.alt}" style="position:absolute;left:0;top:0;width:1920px;height:1080px;object-fit:cover">` : '',
        // The headline box holds two lines at 62px. Past 40 characters it can wrap to three and run into the
        // tagline, so it shrinks a little (the original headlines are all under 40 and are unchanged).
        headline: (r.headline || '').length > 40
          ? `<span style="font-size:${Math.floor(2257 / (r.headline || '').length)}px">${esc(r.headline)}</span>`
          : esc(r.headline),
        newsItems: newsItemsHtml(r.items || []),
        notesAside: r.notes ? `<aside>${esc(r.notes)}</aside>` : '',
      });

      const D = JSON.stringify(s.items.map(it => {
        const info = returnInfo(r.returns[it.id]);
        return [it.id, it.name, info.shown, info.cls, info.label];
      }));
      add(`y${year}-returns-idle`, 'year-returns-idle', sec, { year, returnsD: D });
      add(`y${year}-returns`, 'year-returns', sec, { year, returnsD: D, sfx: !!s.revealSounds });
      add(`y${year}-profits`, 'year-profits', sec, {
        yearOf, year,
        step3: last ? 'Add up the Revenue column. That’s your farm’s final total.'
          : `Add up the Revenue column. That’s your Total Revenue for ${year}.`,
        step4: last ? 'Double-check every line before we compare farms.'
          : `Your Total Revenue becomes your ${year + 1} Capital.`,
      });
    });
    add('final', 'final', 'Final harvest');
    return slides;
  }

  window.Deck = { build, render, returnInfo, money, esc, pastureNeed, pastureRules };
})();
