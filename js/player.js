// Presents the slides: scaling, transitions, step-by-step builds, videos and live animations.
(function () {
  const W = 1920, H = 1080;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  const BUILD_FRAMES = {
    fade: [{ opacity: 0 }, { opacity: 1 }],
    rise: [{ opacity: 0, translate: '0 60px' }, { opacity: 1, translate: '0 0' }],
    drop: [{ opacity: 0, translate: '0 -60px' }, { opacity: 1, translate: '0 0' }],
    left: [{ opacity: 0, translate: '-80px 0' }, { opacity: 1, translate: '0 0' }],
    right: [{ opacity: 0, translate: '80px 0' }, { opacity: 1, translate: '0 0' }],
    scale: [{ opacity: 0, scale: '0.85' }, { opacity: 1, scale: '1' }],
    pop: [{ opacity: 0, scale: '0.5' }, { opacity: 1, scale: '1.08', offset: 0.7 }, { opacity: 1, scale: '1' }],
  };

  class Player {
    constructor(root, opts) {
      this.root = root;
      this.opts = opts || {};
      this.viewport = root.querySelector('.viewport');
      this.stage = root.querySelector('.stage');
      this.counter = root.querySelector('[data-counter]');
      this.notesEl = root.querySelector('.notes-panel');
      this.jump = root.querySelector('[data-jump]');
      this.slides = [];
      this.index = -1;
      this.current = null;
      this.token = 0;
      this.busy = false;

      this.fit = this.fit.bind(this);
      this.onKey = this.onKey.bind(this);
      window.addEventListener('resize', this.fit);

      // Card-flip animations ask for their sounds by message; only the slide on screen is heard.
      window.addEventListener('message', e => {
        const s = this.current;
        const name = e.data && e.data.farmSfx;
        if (!name || !s || !s.data.vals.sfx || !window.Sfx) return;
        const fromCurrent = [...s.section.querySelectorAll('iframe')].some(f => f.contentWindow === e.source);
        if (fromCurrent) window.Sfx.play(name);
      });
      root.addEventListener('pointerdown', () => window.Sfx && window.Sfx.unlock());

      this.viewport.addEventListener('click', e => {
        if (e.button === 0) this.next();
      });
      root.querySelector('[data-prev]').addEventListener('click', () => this.prev());
      root.querySelector('[data-next]').addEventListener('click', () => this.next());
      root.querySelector('[data-notes]').addEventListener('click', () => this.toggleNotes());
      root.querySelector('[data-full]').addEventListener('click', () => this.toggleFullscreen());
      root.querySelector('[data-exit]').addEventListener('click', () => this.opts.onExit && this.opts.onExit());
      this.jump.addEventListener('change', () => this.go(+this.jump.value, { instant: true }));

      let hideTimer;
      root.addEventListener('mousemove', () => {
        root.classList.add('show-hud');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => root.classList.remove('show-hud'), 2200);
      });
    }

    open(slides, startIndex) {
      this.slides = slides;
      this.jump.innerHTML = '';
      let lastSection = null, group = null;
      slides.forEach((s, i) => {
        if (s.section !== lastSection) {
          group = document.createElement('optgroup');
          group.label = s.section;
          this.jump.appendChild(group);
          lastSection = s.section;
        }
        const o = document.createElement('option');
        o.value = i;
        o.textContent = `${i + 1}. ${s.id}`;
        group.appendChild(o);
      });
      document.addEventListener('keydown', this.onKey);
      this.fit();
      this.index = -1;
      this.current = null;
      this.stage.innerHTML = '';
      this.go(startIndex || 0, { instant: true });
    }

    close() {
      document.removeEventListener('keydown', this.onKey);
      this.token++;
      if (this.current) this.teardown(this.current);
      this.stage.innerHTML = '';
      this.current = null;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }

    fit() {
      const vw = this.viewport.clientWidth, vh = this.viewport.clientHeight;
      const s = Math.min(vw / W, vh / H);
      this.stage.style.transform = `translate(${(vw - W * s) / 2}px, ${(vh - H * s) / 2}px) scale(${s})`;
    }

    onKey(e) {
      if (e.target.closest && e.target.closest('select, input, textarea')) return;
      if (window.Sfx) window.Sfx.unlock();
      const k = e.key;
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); this.next(); }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); this.prev(); }
      else if (k === 'Home') this.go(0, { instant: true });
      else if (k === 'End') this.go(this.slides.length - 1, { instant: true });
      else if (k === 'f' || k === 'F') this.toggleFullscreen();
      else if (k === 'n' || k === 'N') this.toggleNotes();
      else if (k === 'Escape' && !document.fullscreenElement) this.opts.onExit && this.opts.onExit();
    }

    toggleNotes() { this.root.classList.toggle('notes-open'); setTimeout(this.fit, 0); }
    toggleFullscreen() {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else this.root.requestFullscreen().catch(() => {});
      setTimeout(this.fit, 200);
    }

    // ----- building one slide -----
    makeSlide(data) {
      const el = document.createElement('div');
      el.className = 'slide';
      el.innerHTML = data.html;
      const section = el.querySelector('section');

      const aside = section.querySelector('aside');
      const notes = aside ? aside.textContent.trim() : '';
      if (aside) aside.remove();

      section.querySelectorAll('img[data-video]').forEach(img => {
        const v = document.createElement('video');
        v.setAttribute('style', img.getAttribute('style') || '');
        if (!/object-fit/.test(v.getAttribute('style'))) v.style.objectFit = 'cover';
        v.poster = img.getAttribute('src');
        v.src = img.getAttribute('data-video');
        v.playsInline = true;
        v.preload = 'auto';
        v.loop = img.getAttribute('data-video-loop') !== 'off';
        v.dataset.sound = img.getAttribute('data-video-sound') === 'on' ? 'on' : 'off';
        v.muted = true;
        v.setAttribute('aria-label', img.getAttribute('alt') || '');
        img.replaceWith(v);
      });

      section.querySelectorAll('x-embed').forEach(x => {
        const f = document.createElement('iframe');
        f.setAttribute('style', (x.getAttribute('style') || '') + ';border:0;background:transparent;pointer-events:none');
        f.setAttribute('sandbox', 'allow-scripts');
        f.setAttribute('scrolling', 'no');
        f.dataset.embed = x.getAttribute('data-embed');
        x.replaceWith(f);
      });

      const steps = [...section.querySelectorAll('[data-build-in]')].map((node, dom) => {
        const parts = node.getAttribute('data-build-in').trim().split(/\s+/);
        return {
          node, dom,
          type: BUILD_FRAMES[parts[0]] ? parts[0] : 'fade',
          order: parseInt(parts[1], 10) || 0,
          auto: parts.includes('auto'),
        };
      }).sort((a, b) => a.order - b.order || a.dom - b.dom);

      return { el, section, data, notes, steps, step: 0 };
    }

    // Live embeds and videos start only once the slide is on screen.
    // Embeds are started separately, after the slide transition settles: an iframe created while its
    // slide is mid-fade can come up with its animations unpainted (sound still plays).
    startEmbeds(s) {
      if (s.embedsStarted) return;
      s.embedsStarted = true;
      s.section.querySelectorAll('iframe[data-embed]').forEach(f => {
        const tpl = window.EMBEDS[f.dataset.embed] || '';
        f.srcdoc = '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
          window.Deck.render(tpl, s.data.vals) + '</body></html>';
      });
    }

    activate(s) {
      s.section.querySelectorAll('video').forEach(v => {
        v.muted = v.dataset.sound !== 'on';
        const p = v.play();
        if (p && p.catch) p.catch(() => { v.muted = true; v.play().catch(() => {}); });
      });
    }

    teardown(s) {
      s.section.querySelectorAll('video').forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); });
      s.section.querySelectorAll('iframe').forEach(f => { f.srcdoc = ''; });
      s.el.remove();
    }

    // ----- builds -----
    hideBuilds(s) { s.steps.forEach(st => st.node.classList.add('bi-hidden')); }
    showAllBuilds(s) { s.steps.forEach(st => st.node.classList.remove('bi-hidden')); s.step = s.steps.length; }
    reveal(st) {
      st.node.classList.remove('bi-hidden');
      return st.node.animate(BUILD_FRAMES[st.type], { duration: 600, easing: 'cubic-bezier(.2,.7,.3,1)' }).finished.catch(() => {});
    }
    async runAuto(s, firstDelay) {
      const my = this.token;
      let first = true;
      while (s.step < s.steps.length && s.steps[s.step].auto) {
        await wait(first ? firstDelay : 380);
        if (my !== this.token) return;
        first = false;
        this.reveal(s.steps[s.step++]);
      }
    }

    // ----- navigation -----
    next() {
      const s = this.current;
      if (!s) return;
      if (s.step < s.steps.length) {
        // Finish any auto chain in progress, then show the next click step.
        const st = s.steps[s.step];
        if (st.auto) { this.token++; while (s.step < s.steps.length && s.steps[s.step].auto) s.steps[s.step++].node.classList.remove('bi-hidden'); return; }
        s.step++;
        this.reveal(st);
        this.runAuto(s, 650);
        return;
      }
      if (this.index < this.slides.length - 1) this.go(this.index + 1);
    }

    prev() {
      if (this.index > 0) this.go(this.index - 1, { back: true });
    }

    async go(i, o) {
      o = o || {};
      if (i < 0 || i >= this.slides.length || i === this.index) return;
      const my = ++this.token;
      const old = this.current;
      const forward = i > this.index;
      const s = this.makeSlide(this.slides[i]);
      if (o.back) this.showAllBuilds(s); else this.hideBuilds(s);

      this.index = i;
      this.current = s;
      this.counter.textContent = `${i + 1} / ${this.slides.length}`;
      this.jump.value = i;
      this.notesEl.textContent = s.notes || 'No notes for this slide.';
      this.stage.appendChild(s.el);
      this.activate(s);
      const settle = () => { if (this.current === s) requestAnimationFrame(() => this.startEmbeds(s)); };
      if (!old || o.instant) this.startEmbeds(s);

      if (old) {
        // A slide's data-transition says how it leaves; going back uses the incoming slide's.
        const leaving = (forward ? old.section : s.section).getAttribute('data-transition') || 'fade';
        if (o.instant) {
          this.teardown(old);
        } else if (leaving === 'push') {
          const dir = forward ? 1 : -1;
          old.el.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-dir * W}px)` }], { duration: 650, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards' });
          s.el.animate([{ transform: `translateX(${dir * W}px)` }, { transform: 'translateX(0)' }], { duration: 650, easing: 'cubic-bezier(.6,0,.2,1)' })
            .finished.then(() => { this.teardown(old); settle(); }, () => { this.teardown(old); settle(); });
        } else {
          s.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease' })
            .finished.then(() => { this.teardown(old); settle(); }, () => { this.teardown(old); settle(); });
        }
      }
      if (!o.back && my === this.token) this.runAuto(s, old && !o.instant ? 650 : 350);
    }
  }

  window.Player = Player;
})();
