// Sound effects for the card flips, made in the browser with Web Audio (no sound files).
(function () {
  let ctx = null, master = null, noiseBuf = null;

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    // A gentle limiter so overlapping sounds never clip.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 6;
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  // Browsers only allow sound after a click or key press, so this runs on those.
  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function noise(t, dur, filterType, f0, f1, q, peak, attack) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    env(g, t, peak, attack, dur - attack);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  function tone(t, type, f0, f1, dur, peak, attack) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    env(g, t, peak, attack || 0.005, dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function bell(t, freq, peak, dur) {
    // A struck bell: a few slightly inharmonic partials that fade at different rates.
    [[1, 1], [2.01, 0.45], [3.02, 0.25], [4.17, 0.12]].forEach(([m, a], i) => {
      tone(t, 'sine', freq * m, freq * m, dur / (1 + i * 0.6), peak * a, 0.004);
    });
  }

  const SOUNDS = {
    // The card lifting and turning over.
    whoosh(t) { noise(t, 0.32, 'bandpass', 500, 2600, 1.2, 0.5, 0.12); },
    whooshBig(t) { noise(t, 0.4, 'bandpass', 350, 3200, 1, 0.65, 0.14); },
    // The card landing on the table.
    thud(t) {
      tone(t, 'sine', 150, 48, 0.22, 0.9);
      noise(t, 0.08, 'lowpass', 1800, 300, 0.7, 0.35, 0.002);
    },
    // A heavier, duller landing for cards that lost money.
    thudLow(t) {
      tone(t, 'sine', 110, 36, 0.3, 0.95);
      noise(t, 0.09, 'lowpass', 900, 200, 0.7, 0.3, 0.002);
    },
    // The gold card shaking before it flips: wooden taps that speed up.
    rattle(t) {
      let at = 0;
      for (let i = 0; i < 11; i++) {
        const gap = 0.11 - i * 0.007;
        noise(t + at, 0.04, 'bandpass', 2200 + (i % 2) * 500, 1800, 4, 0.25 + i * 0.03, 0.002);
        at += gap;
      }
    },
    // The gold card landing: a thud and a rising chime.
    chime(t) {
      SOUNDS.thud(t);
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(t + 0.02 + i * 0.075, f, 0.32, 1.6));
    },
    // Glittering pings as the sparkles burst.
    sparkle(t) {
      for (let i = 0; i < 16; i++) {
        const at = t + Math.random() * 0.9;
        tone(at, 'sine', 2600 + Math.random() * 3200, 2600 + Math.random() * 3200, 0.18, 0.06 + Math.random() * 0.06, 0.003);
      }
    },
  };

  function play(name) {
    if (!SOUNDS[name] || !init()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    SOUNDS[name](ctx.currentTime + 0.01);
  }

  window.Sfx = { play, unlock, names: Object.keys(SOUNDS) };
})();
