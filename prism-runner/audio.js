/*
 * Prism Runner: synthesized sound effects and a gentle background beat (WebAudio only,
 * no audio files). The AudioContext is created lazily on the first user gesture.
 * Effective sound = YouTube audio enabled AND the in-game sound toggle.
 */
(function () {
  'use strict';
  var ctx = null, master = null, sfx = null, mus = null, noise = null;
  var sdkOn = true, soundOn = true, musicOn = true, suspended = false;
  var beatOn = false, nextStep = 0, step = 0;
  var SCALE = [0, 2, 4, 7, 9];
  var ROOTS = [0, -3, -7, -5]; // C, A, F, G (bass, relative to C3)

  function noop() {}
  function enabled() { return !!ctx && sdkOn && soundOn && !suspended; }

  function apply() {
    if (!ctx) return;
    var t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(sdkOn && soundOn ? 0.9 : 0, t, 0.03);
    mus.gain.cancelScheduledValues(t);
    mus.gain.setTargetAtTime(musicOn ? 0.3 : 0, t, 0.05);
  }

  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function tone(freq, t, dur, type, vol, slide, dest) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    env(g, t, 0.006, dur, vol);
    o.connect(g); g.connect(dest || sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function hiss(t, dur, vol, ftype, f0, f1, q, dest) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise;
    f.type = ftype;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q || 0.8;
    env(g, t, 0.01, dur, vol);
    s.connect(f); f.connect(g); g.connect(dest || sfx);
    s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.05);
  }

  var A = {
    /** Call from a user gesture (pointerdown / keydown). */
    ensure: function () {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { ctx = new AC(); } catch (e) { ctx = null; return; }
        master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
        sfx = ctx.createGain(); sfx.gain.value = 0.6; sfx.connect(master);
        mus = ctx.createGain(); mus.gain.value = 0; mus.connect(master);
        noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        var d = noise.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        apply();
      }
      if (ctx.state === 'suspended' && !suspended) { var p = ctx.resume(); if (p && p.catch) p.catch(noop); }
    },
    setSdk: function (v) { sdkOn = !!v; apply(); },
    setSound: function (v) { soundOn = !!v; apply(); },
    setMusic: function (v) { musicOn = !!v; apply(); },
    suspend: function () {
      suspended = true; beatOn = false;
      if (ctx && ctx.state === 'running') { var p = ctx.suspend(); if (p && p.catch) p.catch(noop); }
    },
    resume: function () {
      suspended = false;
      if (ctx && ctx.state === 'suspended') { var p = ctx.resume(); if (p && p.catch) p.catch(noop); }
    },

    chime: function (combo) {
      if (!enabled()) return;
      var t = ctx.currentTime, idx = Math.min(Math.max(combo - 1, 0), 14);
      var semis = SCALE[idx % 5] + 12 * Math.floor(idx / 5);
      var f = 523.25 * Math.pow(2, semis / 12);
      tone(f, t, 0.38, 'sine', 0.22);
      tone(f * 2, t, 0.16, 'triangle', 0.05);
      tone(f * 1.5, t + 0.05, 0.3, 'sine', 0.06);
    },
    move: function () {
      if (!enabled()) return;
      hiss(ctx.currentTime, 0.13, 0.16, 'bandpass', 500, 2600, 1.4);
    },
    shift: function () {
      if (!enabled()) return;
      var t = ctx.currentTime;
      tone(620, t, 0.09, 'triangle', 0.1, 930);
      tone(930, t + 0.045, 0.12, 'sine', 0.08);
    },
    pickup: function () {
      if (!enabled()) return;
      var t = ctx.currentTime;
      tone(1046, t, 0.1, 'sine', 0.12);
      tone(1568, t + 0.06, 0.16, 'sine', 0.11);
    },
    shield: function () {
      if (!enabled()) return;
      var t = ctx.currentTime;
      tone(392, t, 0.35, 'sine', 0.14, 784);
      tone(587, t + 0.08, 0.35, 'triangle', 0.06, 1174);
    },
    shieldPop: function () {
      if (!enabled()) return;
      var t = ctx.currentTime;
      hiss(t, 0.25, 0.25, 'highpass', 2500, 900, 0.7);
      tone(1200, t, 0.3, 'sine', 0.12, 300);
    },
    slow: function () {
      if (!enabled()) return;
      var t = ctx.currentTime;
      tone(880, t, 0.7, 'sine', 0.12, 220);
      tone(660, t + 0.05, 0.7, 'triangle', 0.05, 165);
    },
    shatter: function () {
      if (!enabled()) return;
      var t = ctx.currentTime;
      hiss(t, 0.55, 0.35, 'lowpass', 5000, 250, 0.7);
      tone(523, t, 0.5, 'triangle', 0.14, 130);
      tone(392, t + 0.07, 0.55, 'sine', 0.1, 98);
      tone(1568, t, 0.12, 'square', 0.03, 784);
    },
    fanfare: function () {
      if (!enabled()) return;
      var t = ctx.currentTime, n = [523.25, 659.25, 783.99, 1046.5];
      for (var i = 0; i < n.length; i++) tone(n[i], t + i * 0.09, 0.32, 'sine', 0.13);
      tone(1567.98, t + 0.36, 0.5, 'triangle', 0.06);
    },
    click: function () {
      if (!enabled()) return;
      tone(740, ctx.currentTime, 0.06, 'sine', 0.09, 880);
    },
    tick: function (go) {
      if (!enabled()) return;
      tone(go ? 1318.5 : 880, ctx.currentTime, go ? 0.25 : 0.1, 'sine', 0.12);
    },

    /** Call every frame. Schedules a soft 8th-note beat whose tempo follows the run speed. */
    beat: function (active, bpm, intensity) {
      if (!active || !enabled() || !musicOn || ctx.state !== 'running') { beatOn = false; return; }
      var now = ctx.currentTime;
      if (!beatOn || nextStep < now - 0.1) { beatOn = true; nextStep = now + 0.06; step = 0; }
      var spb = 30 / bpm;
      while (nextStep < now + 0.15) {
        schedule(step, nextStep, intensity);
        nextStep += spb;
        step = (step + 1) % 32;
      }
    }
  };

  function schedule(s, t, intensity) {
    var p = s % 8, bar = (s / 8) | 0;
    var root = 130.81 * Math.pow(2, ROOTS[bar] / 12);
    if (p === 0 || p === 4) tone(110, t, 0.2, 'sine', 0.38, 42, mus);
    if (p === 2 || p === 6) hiss(t, 0.045, 0.07, 'highpass', 7000, 0, 0.7, mus);
    if (intensity > 0.45 && (p === 3 || p === 7)) hiss(t, 0.03, 0.035, 'highpass', 9000, 0, 0.7, mus);
    if (p === 0 || p === 3 || p === 6) tone(p === 3 ? root * 1.4983 : root, t, 0.24, 'triangle', 0.16, 0, mus);
    if (p === 5 || (p === 1 && intensity > 0.3)) {
      var k = SCALE[(s * 7 + bar * 3) % 5];
      tone(root * 4 * Math.pow(2, k / 12), t, 0.3, 'sine', 0.05, 0, mus);
    }
  }

  window.PRAudio = A;
})();
