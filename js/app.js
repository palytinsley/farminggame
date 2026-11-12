// Home screen, settings mode and presets.
(function () {
  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = window.Deck.esc;
  const KEY = 'farmgame.settings.v1';
  const PRESETS = 'farmgame.presets.v1';

  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: settings last until the page closes */ } },
  };

  // Fill in anything missing from an older or imported settings file.
  function normalize(s) {
    const d = window.cloneSettings(window.DEFAULT_SETTINGS);
    if (!s || typeof s !== 'object') return d;
    const out = Object.assign(d, s);
    const byId = {};
    (s.items || []).forEach(it => { byId[it.id] = it; });
    // Older saved setups have only name and price on each item. Pasture rates fill in from the defaults.
    out.items = window.DEFAULT_SETTINGS.items.map(def => {
      const sv = byId[def.id];
      const it = Object.assign({}, def);
      if (sv) {
        it.name = sv.name;
        it.price = +sv.price || 0;
        if (def.kind === 'animal' && sv.perUnit != null && sv.perUnit !== '' && isFinite(+sv.perUnit)) it.perUnit = +sv.perUnit;
      }
      return it;
    });
    // Both modes are off unless the saved setup turned them on.
    const D = window.DEFAULT_SETTINGS;
    out.rentOn = s.rentOn === true;
    out.closedRange = s.closedRange === true;
    out.landlord = typeof s.landlord === 'string' ? s.landlord : D.landlord;
    ['rentPrice', 'rentBlock', 'rentMaxBlocks'].forEach(k => { out[k] = s[k] != null && s[k] !== '' && isFinite(+s[k]) ? +s[k] : D[k]; });
    if (!Array.isArray(out.rounds) || !out.rounds.length) out.rounds = d.rounds;
    out.rounds = out.rounds.map(r => ({
      theme: r.theme in window.THEME_LABELS ? r.theme : 'none',
      headline: r.headline || '',
      items: (r.items || []).slice(0, 4),
      notes: r.notes || '',
      returns: Object.assign(Object.fromEntries(out.items.map(it => [it.id, 1])), r.returns || {}),
    }));
    return out;
  }

  let state = normalize(store.get(KEY, null));
  const save = () => store.set(KEY, state);

  // ---------- screens ----------
  const screens = { home: $('#home'), settings: $('#settings'), player: $('#player') };
  function show(name) {
    Object.entries(screens).forEach(([k, el]) => { el.hidden = k !== name; });
    document.body.dataset.screen = name;
  }

  const player = new window.Player(screens.player, { onExit: () => { player.close(); show('home'); renderHome(); } });

  function present(slideId) {
    const slides = window.Deck.build(state);
    const i = slideId ? Math.max(0, slides.findIndex(s => s.id === slideId)) : 0;
    show('player');
    player.open(slides, i);
  }

  function renderHome() {
    $('#home-title').textContent = state.title;
    $('#home-sub').textContent = state.subtitle;
    const N = state.rounds.length;
    $('#home-summary').textContent =
      `${window.Deck.money(state.capital)} to start · ${state.acres} acres · ${N} ${N === 1 ? 'year' : 'years'} (${state.startYear}–${+state.startYear + N - 1})` +
      (state.includePractice ? ' · with practice round' : '') +
      (state.rentOn ? ' · Land rental' : '') + (state.closedRange ? ' · Closed range' : '');
  }

  document.addEventListener('pointerdown', () => window.Sfx.unlock(), { once: true });
  $('#btn-present').addEventListener('click', () => present());
  $('#btn-settings').addEventListener('click', () => { renderSettings(); show('settings'); });
  $('#btn-back').addEventListener('click', () => { show('home'); renderHome(); });
  $('#btn-present-2').addEventListener('click', () => present());

  // ---------- handout (PDF) ----------
  // The PDF code and fonts are big, so they load only when the button is clicked.
  const HANDOUT_SCRIPTS = [
    'js/vendor/jspdf-4.2.1.umd.min.js',
    'js/vendor/svg2pdf.js-2.9.0.umd.min.js',
    'js/vendor/handout-fonts.js',
    'js/handout-icons.js',
    'js/handout.js',
  ];
  let handoutLoad = null;
  function loadHandoutCode() {
    if (!handoutLoad) {
      handoutLoad = HANDOUT_SCRIPTS.reduce((p, src) => p.then(() => new Promise((ok, fail) => {
        const el = document.createElement('script');
        el.src = src;
        el.onload = ok;
        el.onerror = () => fail(new Error('Could not load ' + src));
        document.head.appendChild(el);
      })), Promise.resolve()).catch(e => { handoutLoad = null; throw e; });
    }
    return handoutLoad;
  }
  async function makeHandout() {
    const btns = [$('#btn-handout'), $('#btn-handout-2')];
    const labels = btns.map(b => b.textContent);
    btns.forEach(b => { b.disabled = true; b.textContent = 'Making handout…'; });
    try {
      await loadHandoutCode();
      const model = window.Handout.model(state);
      const doc = await window.Handout.render(model);
      doc.save(model.fileName);
      toast('Handout saved: ' + model.fileName);
    } catch (e) {
      console.error(e);
      toast('Couldn’t make the handout: ' + e.message);
    } finally {
      btns.forEach((b, i) => { b.disabled = false; b.textContent = labels[i]; });
    }
  }
  $('#btn-handout').addEventListener('click', makeHandout);
  $('#btn-handout-2').addEventListener('click', makeHandout);

  // ---------- settings ----------
  const form = $('#settings-body');

  function field(label, key, type, extra) {
    const v = state[key];
    if (type === 'checkbox') {
      return `<label class="check"><input type="checkbox" data-k="${key}" ${v ? 'checked' : ''}> ${label}</label>`;
    }
    return `<label class="field"><span>${label}</span><input type="${type}" data-k="${key}" value="${esc(v)}" ${extra || ''}></label>`;
  }

  function retCell(r, i, it) {
    const v = r.returns[it.id];
    const info = window.Deck.returnInfo(v);
    return `<td class="ret ret-${info.cls}" title="${esc(info.label)}"><input type="number" step="0.1" min="0" data-round="${i}" data-ret="${it.id}" value="${v}"><small>${esc(info.label)}</small></td>`;
  }

  function renderSettings() {
    const N = state.rounds.length;
    const years = state.rounds.map((_, i) => +state.startYear + i);
    const themeOpts = sel => Object.entries(window.THEME_LABELS)
      .map(([k, l]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${l}</option>`).join('');

    form.innerHTML = `
    <section class="card">
      <h2>Money and land</h2>
      <div class="grid">
        ${field('Starting capital ($)', 'capital', 'number', 'min="0" step="50"')}
        ${field('Living costs per year ($)', 'living', 'number', 'min="0" step="10"')}
        ${field('Shipping costs per year ($)', 'shipping', 'number', 'min="0" step="10"')}
        ${field('Total acres', 'acres', 'number', 'min="10" step="10"')}
        ${field('Acres per planting unit', 'unit', 'number', 'min="1" step="1"')}
        ${field('Most crops per year', 'maxCrops', 'number', 'min="1" max="8" step="1"')}
        ${field('First year', 'startYear', 'number', 'step="1"')}
      </div>
      ${field('Land rental', 'rentOn', 'checkbox')}
      ${state.rentOn ? `<div class="grid mode-fields">
        ${field('Landlord', 'landlord', 'text')}
        ${field('Rent per block ($)', 'rentPrice', 'number', 'min="0" step="10"')}
        ${field('Acres per block', 'rentBlock', 'number', 'min="1" step="1"')}
        ${field('Most blocks a farm can rent each year', 'rentMaxBlocks', 'number', 'min="1" step="1"')}
      </div>` : ''}
      ${field('Closed range', 'closedRange', 'checkbox')}
      ${state.closedRange ? `<div class="mode-fields">
        ${window.Deck.pastureRules(state).map(t => `<p class="hint">${t}</p>`).join('')}
        <p class="hint">Set the pasture rate for each animal in the Prices table below. 0 means the animal needs no pasture.</p>
      </div>` : ''}
      <p class="summary" id="money-summary"></p>
      ${field('Include the practice round (uses the original $1,500 worked example)', 'includePractice', 'checkbox')}
      <p class="hint">The practice round always uses its own numbers, whatever the prices, costs or pasture rates are set to. With Closed range on, it uses a second example that includes pasture.</p>
    </section>

    <section class="card">
      <h2>Sound</h2>
      ${field('Play flip sounds on the “How returns work” example', 'introSounds', 'checkbox')}
      ${field('Also play flip sounds when each year’s returns are revealed (and in the practice round)', 'revealSounds', 'checkbox')}
      <button class="btn ghost small" id="sfx-test">▶ Try the sounds</button>
    </section>

    <section class="card">
      <h2>Prices</h2>
      <p class="hint">Crops are priced per acre, livestock per animal. Prices stay the same every year.</p>
      <table class="prices">
        <thead><tr><th>Name</th><th>Type</th><th>Price ($)</th>${state.closedRange ? `<th>Per ${+state.unit} acres of pasture</th>` : ''}</tr></thead>
        <tbody>${state.items.map((it, i) => `
          <tr><td><input type="text" data-item="${i}" data-field="name" value="${esc(it.name)}"></td>
          <td>${it.kind === 'crop' ? 'per acre' : 'per animal'}</td>
          <td><input type="number" min="0" step="1" data-item="${i}" data-field="price" value="${it.price}"></td>
          ${state.closedRange ? (it.kind === 'animal'
            ? `<td><input type="number" step="1" data-item="${i}" data-field="perUnit" value="${it.perUnit}" title="Animals fed by one unit of pasture. 0 means no pasture."></td>`
            : '<td class="muted">—</td>') : ''}</tr>`).join('')}
        </tbody>
      </table>
    </section>

    <section class="card">
      <h2>Returns for each year</h2>
      <p class="hint">The multiplier each investment returns. 0 wipes it out, 1 breaks even, 2 doubles it, and 3 or more gets the gold card.</p>
      <div class="table-scroll">
      <table class="returns">
        <thead><tr><th></th>${years.map((y, i) => `<th>${y}${N > 1 ? ` <button class="mini" data-remove="${i}" title="Remove ${y}">✕</button>` : ''}</th>`).join('')}</tr></thead>
        <tbody>${state.items.map(it => `<tr><th>${esc(it.name)}</th>${state.rounds.map((r, i) => retCell(r, i, it)).join('')}</tr>`).join('')}</tbody>
      </table>
      </div>
      <button class="btn ghost" id="add-round">+ Add a year</button>
    </section>

    <section class="card">
      <h2>Newspaper for each year</h2>
      <p class="hint">Up to four news items per year. The background animation can be any of the four from the original deck.</p>
      ${state.rounds.map((r, i) => `
      <div class="round">
        <div class="round-head">
          <h3>${years[i]} <span class="muted">· Vol. ${i + 1}</span></h3>
          <button class="btn ghost small" data-preview="${years[i]}">Present from ${years[i]}</button>
        </div>
        <div class="grid two">
          <label class="field"><span>Headline</span><input type="text" data-round="${i}" data-field="headline" value="${esc(r.headline)}"></label>
          <label class="field"><span>Background animation</span><select data-round="${i}" data-field="theme">${themeOpts(r.theme)}</select></label>
        </div>
        <div class="grid two">
          ${[0, 1, 2, 3].map(j => `<label class="field"><span>News item ${j + 1}</span><textarea rows="2" data-round="${i}" data-news="${j}">${esc(r.items[j] || '')}</textarea></label>`).join('')}
        </div>
        <label class="field"><span>Speaker notes</span><textarea rows="2" data-round="${i}" data-field="notes">${esc(r.notes)}</textarea></label>
      </div>`).join('')}
    </section>

    <section class="card">
      <h2>Titles</h2>
      <div class="grid two">
        ${field('Game title', 'title', 'text')}
        ${field('Subtitle on the cover', 'subtitle', 'text')}
        ${field('Region', 'region', 'text')}
        ${field('Newspaper name', 'paper', 'text')}
        ${field('Newspaper town', 'dateline', 'text')}
      </div>
    </section>`;
    updateSummary();
    renderPresets();
  }

  function updateSummary() {
    const fixed = (+state.living) + (+state.shipping);
    const invest = (+state.capital) - fixed;
    const warn = [];
    if (invest <= 0) warn.push('Fixed costs use up all the starting capital, so there is nothing left to invest.');
    if (+state.unit > 0 && +state.acres % +state.unit) warn.push(`${state.acres} acres doesn’t divide evenly into ${state.unit}-acre units.`);
    const unit = +state.unit;
    if (state.rentOn && unit > 0 && +state.rentBlock % unit) warn.push(`A rental block of ${state.rentBlock} acres doesn’t divide evenly into ${unit}-acre units.`);
    if (state.closedRange) {
      state.items.filter(it => it.kind === 'animal').forEach(it => {
        const per = +it.perUnit;
        if (per < 0) warn.push(`${it.name} has a negative pasture rate.`);
        else if (per > 0 && unit > 0) {
          const need = Math.ceil(1 / per) * unit;
          if (need > +state.acres) warn.push(`One ${it.name.toLowerCase()} needs ${need} acres of pasture, which is more than your ${state.acres} acres.`);
        }
      });
    }
    $('#money-summary').innerHTML =
      `Fixed costs: <b>${window.Deck.money(fixed)}</b> a year · Left to invest in year one: <b>${window.Deck.money(invest)}</b>` +
      warn.map(w => `<br><span class="warn">${esc(w)}</span>`).join('');
  }

  form.addEventListener('input', e => {
    const t = e.target;
    const num = t.type === 'number';
    const val = t.type === 'checkbox' ? t.checked : num ? (t.value === '' ? 0 : +t.value) : t.value;
    if (t.dataset.k) {
      state[t.dataset.k] = val;
      if (t.dataset.k === 'startYear') { save(); return; }
      updateSummary();
    } else if (t.dataset.item) {
      state.items[+t.dataset.item][t.dataset.field] = val;
      if (t.dataset.field === 'perUnit') updateSummary();
    } else if (t.dataset.ret) {
      state.rounds[+t.dataset.round].returns[t.dataset.ret] = val;
      const info = window.Deck.returnInfo(val);
      const td = t.closest('td');
      td.className = 'ret ret-' + info.cls;
      td.title = info.label;
      td.querySelector('small').textContent = info.label;
    } else if (t.dataset.news) {
      state.rounds[+t.dataset.round].items[+t.dataset.news] = val;
    } else if (t.dataset.round && t.dataset.field) {
      state.rounds[+t.dataset.round][t.dataset.field] = val;
    }
    save();
  });
  // Year labels and item names appear in several places, so redraw when those settle.
  form.addEventListener('change', e => {
    const t = e.target;
    if (['startYear', 'rentOn', 'closedRange', 'unit'].includes(t.dataset.k) || t.dataset.field === 'name') { save(); renderSettings(); }
  });

  form.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'sfx-test') {
      window.Sfx.unlock();
      [['whoosh', 0], ['thud', 260], ['rattle', 900], ['whooshBig', 1900], ['chime', 2150], ['sparkle', 2250]]
        .forEach(([n, ms]) => setTimeout(() => window.Sfx.play(n), ms));
    } else if (b.id === 'add-round') {
      const last = state.rounds[state.rounds.length - 1];
      state.rounds.push(window.cloneSettings(last));
      save(); renderSettings();
    } else if (b.dataset.remove) {
      const i = +b.dataset.remove;
      if (confirm(`Remove ${+state.startYear + i} from the game?`)) { state.rounds.splice(i, 1); save(); renderSettings(); }
    } else if (b.dataset.preview) {
      present(`y${b.dataset.preview}-plan`);
    }
  });

  // ---------- presets ----------
  const BUILT_IN = window.BUILT_IN_PRESETS || {};
  const isBuiltIn = n => Object.prototype.hasOwnProperty.call(BUILT_IN, n);
  function presets() { return store.get(PRESETS, {}); }
  function renderPresets() {
    const p = presets();
    // A user setup never shadows a preset, so a same-named saved setup is not listed.
    const names = Object.keys(p).filter(n => !isBuiltIn(n)).sort();
    const opt = n => `<option value="${esc(n)}">${esc(n)}</option>`;
    $('#preset-select').innerHTML = '<option value="">Saved setups…</option>' +
      (Object.keys(BUILT_IN).length ? `<optgroup label="Presets">${Object.keys(BUILT_IN).map(opt).join('')}</optgroup>` : '') +
      (names.length ? `<optgroup label="My setups">${names.map(opt).join('')}</optgroup>` : '');
  }
  function load(s, msg) { state = normalize(s); save(); renderSettings(); toast(msg); }

  $('#preset-select').addEventListener('change', e => {
    const n = e.target.value;
    if (!n) return;
    load(isBuiltIn(n) ? BUILT_IN[n] : presets()[n], `Loaded “${n}”`);
    e.target.value = n;
  });
  $('#preset-save').addEventListener('click', () => {
    const cur = $('#preset-select').value;
    const n = prompt('Name this setup:', cur && !isBuiltIn(cur) ? cur : 'My setup');
    if (!n) return;
    if (isBuiltIn(n.trim())) { toast(`“${n.trim()}” is a preset. Please choose a different name`); return; }
    const p = presets(); p[n] = state; store.set(PRESETS, p);
    renderPresets(); $('#preset-select').value = n; toast(`Saved “${n}”`);
  });
  $('#preset-delete').addEventListener('click', () => {
    const n = $('#preset-select').value;
    if (!n) { toast('Pick a saved setup first'); return; }
    if (isBuiltIn(n)) { toast('Presets can’t be deleted'); return; }
    if (!confirm(`Delete the saved setup “${n}”?`)) return;
    const p = presets(); delete p[n]; store.set(PRESETS, p); renderPresets(); toast(`Deleted “${n}”`);
  });
  $('#preset-reset').addEventListener('click', () => {
    if (confirm('Go back to the original game? Your saved setups are kept.')) {
      load(window.DEFAULT_SETTINGS, 'Back to the original game');
      if (isBuiltIn('Original')) $('#preset-select').value = 'Original';
    }
  });
  $('#preset-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (state.title || 'farming-game').replace(/[^\w-]+/g, '-').toLowerCase() + '-setup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#preset-import').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then(t => load(JSON.parse(t), `Imported ${f.name}`)).catch(() => toast('That file isn’t a Farming Game setup'));
    e.target.value = '';
  });

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  renderHome();
  show('home');
})();
