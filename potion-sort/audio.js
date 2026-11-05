/* Potion Sort: synthesized sound. WebAudio only, no samples.
   The AudioContext is created on the first user gesture (PS.Audio.unlock). */
(function () {
  'use strict';
  var PS = window.PS = window.PS || {};

  var ac = null, master = null, sfxBus = null, padBus = null, noiseBuf = null;
  var enabled = false, musicWanted = true, pad = null, crackleT = 0;
  // pentatonic-ish scale for sparkles and stars (D major pentatonic)
  var PENTA = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66, 1318.51, 1479.98, 1760.0, 1975.53];

  function create() {
    if (ac) return true;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    try {
      ac = new Ctor();
      master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
      padBus = ac.createGain(); padBus.gain.value = 0.5; padBus.connect(master);
    } catch (e) { ac = null; return false; }
    return true;
  }
  function live() { return !!(ac && enabled && ac.state !== 'closed'); }
  function noise() {
    if (noiseBuf) return noiseBuf;
    var len = ac.sampleRate;
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(f, type, delay, dur, vol, glide, dest) {
    var t = ac.currentTime + (delay || 0);
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
    env(g, t, Math.min(0.012, dur * 0.2), vol, dur);
    o.connect(g); g.connect(dest || sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(delay, dur, vol, type, f0, f1, q, attack) {
    var t = ac.currentTime + (delay || 0);
    var s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise(); s.loop = true;
    fl.type = type; fl.frequency.setValueAtTime(f0, t);
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    fl.Q.value = q || 0.8;
    env(g, t, attack || Math.min(0.02, dur * 0.25), vol, dur);
    s.connect(fl); fl.connect(g); g.connect(sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function bell(f, vol, delay) {
    tone(f, 'sine', delay, 0.9, vol);
    tone(f * 2.76, 'sine', delay, 0.3, vol * 0.25);
    tone(f * 5.4, 'sine', delay, 0.12, vol * 0.08);
  }
  // glass clink: inharmonic partials with a fast decay
  function clink(f, vol, delay) {
    tone(f, 'sine', delay, 0.35, vol);
    tone(f * 1.53, 'sine', delay, 0.22, vol * 0.5);
    tone(f * 2.41, 'sine', delay, 0.12, vol * 0.3);
  }
  function guard(fn) { return function () { if (!live()) return; try { fn.apply(null, arguments); } catch (e) { /* ignore */ } }; }

  var A = PS.Audio = {
    unlock: function () { create(); A.sync(); },
    // on = SDK audio AND in-game toggle AND not paused
    setEnabled: function (on) { enabled = !!on; A.sync(); },
    setMusic: function (on) { musicWanted = !!on; syncPad(); },
    sync: function () {
      if (!ac) return;
      try {
        if (enabled) {
          if (ac.state === 'suspended') ac.resume();
          master.gain.setTargetAtTime(0.8, ac.currentTime, 0.04);
        } else {
          master.gain.setTargetAtTime(0, ac.currentTime, 0.02);
          if (ac.state === 'running') ac.suspend();
        }
      } catch (e) { /* ignore */ }
      syncPad();
    },
    select: guard(function () { clink(2350, 0.06); }),
    deselect: guard(function () { clink(1760, 0.045); }),
    nope: guard(function () { tone(180, 'triangle', 0, 0.14, 0.12, 120); tone(1400, 'sine', 0.01, 0.05, 0.02); }),
    ui: guard(function () { tone(1320, 'sine', 0, 0.05, 0.04); }),
    // glugs: bubbly blips that rise as the target fills. fill0/fill1 = target fill (0..1) before/after
    pour: guard(function (n, dur, fill0, fill1) {
      hiss(0.02, dur, 0.035, 'bandpass', 900 + fill0 * 600, 1300 + fill1 * 900, 1.2, 0.05);
      var count = Math.max(2, Math.round(dur / 0.085));
      for (var i = 0; i < count; i++) {
        var p = i / count, fill = fill0 + (fill1 - fill0) * p;
        var f = 170 + fill * 260 + (Math.random() * 40 - 20);
        tone(f, 'sine', 0.03 + i * (dur / count) + Math.random() * 0.02, 0.07, 0.11, f * 2.1);
      }
    }),
    land: guard(function () { clink(2900, 0.03, 0); tone(240, 'sine', 0, 0.06, 0.03, 180); }),
    cork: guard(function (delay) {
      delay = delay || 0;
      hiss(delay, 0.06, 0.3, 'bandpass', 1600, 700, 1.5, 0.002);
      tone(820, 'sine', delay, 0.09, 0.22, 210);
      tone(300, 'triangle', delay + 0.01, 0.12, 0.08, 120);
    }),
    unseal: guard(function () {
      hiss(0, 0.12, 0.16, 'highpass', 2500, 1200, 0.7, 0.003);
      tone(560, 'sine', 0.02, 0.12, 0.2, 1100);
      clink(1980, 0.04, 0.1);
    }),
    sparkle: guard(function (delay) {
      delay = delay || 0;
      for (var i = 0; i < 4; i++) bell(PENTA[4 + i] * 1.0, 0.035, delay + i * 0.055);
    }),
    reveal: guard(function () { tone(660, 'sine', 0, 0.25, 0.05, 990); }),
    add: guard(function () { clink(1500, 0.06); tone(300, 'sine', 0.05, 0.12, 0.06, 200); }),
    undo: guard(function () { tone(700, 'sine', 0, 0.09, 0.05, 420); }),
    win: guard(function () {
      [0, 2, 4, 5, 7, 9].forEach(function (n, i) { bell(PENTA[n] * 0.5, 0.07, 0.15 + i * 0.1); });
      bell(PENTA[0] * 0.5, 0.05, 0.85); bell(PENTA[4] * 0.5, 0.05, 0.85);
    }),
    star: guard(function (i) { bell(PENTA[5 + i], 0.07); clink(PENTA[5 + i] * 2, 0.02); }),
    update: function (dt) {
      if (!pad || !live()) return;
      // soft candle crackle now and then
      crackleT -= dt;
      if (crackleT <= 0) {
        crackleT = 0.4 + Math.random() * 2.2;
        try { hiss(0, 0.02 + Math.random() * 0.03, 0.012 + Math.random() * 0.012, 'highpass', 3000 + Math.random() * 3000, 0, 0.6, 0.002); } catch (e) { /* ignore */ }
      }
    }
  };

  // Ambient pad: a warm, slowly breathing D minor-ish drone.
  function syncPad() {
    var want = !!(ac && enabled && musicWanted);
    if (want && !pad) {
      try {
        var g = ac.createGain(), f = ac.createBiquadFilter(), lfo = ac.createOscillator(), lg = ac.createGain();
        f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 0.5;
        lfo.frequency.value = 0.07; lg.gain.value = 260; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
        g.gain.value = 0; g.gain.setTargetAtTime(0.05, ac.currentTime, 2);
        f.connect(g); g.connect(padBus);
        var notes = [73.42, 110.0, 146.83, 174.61, 220.0], oscs = [lfo];
        for (var i = 0; i < notes.length; i++) {
          var o = ac.createOscillator(), og = ac.createGain();
          o.type = i < 2 ? 'triangle' : 'sine';
          o.frequency.value = notes[i];
          o.detune.value = (i % 2 ? 5 : -5);
          og.gain.value = i < 2 ? 0.5 : 0.22;
          o.connect(og); og.connect(f); o.start();
          oscs.push(o);
        }
        pad = { g: g, oscs: oscs };
      } catch (e) { pad = null; }
    } else if (!want && pad) {
      var p = pad; pad = null;
      try {
        p.g.gain.setTargetAtTime(0, ac.currentTime, 0.1);
        p.oscs.forEach(function (o) { o.stop(ac.currentTime + 0.6); });
      } catch (e) { /* ignore */ }
    }
  }
})();
