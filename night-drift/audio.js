/*
 * Night Drift: synthesized sound (WebAudio only, no audio files).
 * - a continuous engine hum (two detuned saws + a sub sine through a low-pass filter) whose
 *   pitch follows the speed,
 * - a tire squeal (looping filtered noise) whose level follows the drift slip,
 * - one-shot effects (token chime, drift bank, scrape, crash, boost whoosh, game over sting),
 * - an optional, quiet procedural synth bass pulse during a run (original pattern).
 * The AudioContext is created lazily on the first user gesture.
 * Effective sound = YouTube audio enabled AND the in-game sound toggle.
 */
(function () {
  'use strict';
  var ctx = null, master = null, sfx = null, mus = null, noise = null;
  var eng = null; // continuous nodes
  var sdkOn = true, soundOn = true, suspended = false;
  var musOn = false, nextStep = 0, step = 0;
  var ROOTS = [110, 87.31, 130.81, 98]; // A2, F2, C3, G2 (i - VI - III - VII in A minor)
  var CHORD = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];

  function noop() {}
  function live() { return !!ctx && sdkOn && soundOn && !suspended; }

  function apply() {
    if (!ctx) return;
    var t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(sdkOn && soundOn ? 0.85 : 0, t, 0.03);
  }

  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function tone(freq, t, dur, type, vol, slide, dest, cutoff) {
    var o = ctx.createOscillator(), g = ctx.createGain(), last = o;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    if (cutoff) {
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t); f.Q.value = 2;
      f.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.25), t + dur);
      o.connect(f); last = f;
    }
    env(g, t, 0.006, dur, vol);
    last.connect(g); g.connect(dest || sfx);
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
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  function buildEngine() {
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), sub = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sawtooth'; sub.type = 'sine';
    o1.frequency.value = 60; o2.frequency.value = 60.6; sub.frequency.value = 30;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 4;
    var g = ctx.createGain(); g.gain.value = 0;
    var subG = ctx.createGain(); subG.gain.value = 0.7;
    o1.connect(lp); o2.connect(lp); sub.connect(subG); subG.connect(lp); lp.connect(g); g.connect(sfx);

    var sq = ctx.createBufferSource(); sq.buffer = noise; sq.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2300; bp.Q.value = 7;
    var bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 3400; bp2.Q.value = 9;
    var sg = ctx.createGain(); sg.gain.value = 0;
    sq.connect(bp); sq.connect(bp2); bp.connect(sg); bp2.connect(sg); sg.connect(sfx);

    var wn = ctx.createBufferSource(); wn.buffer = noise; wn.loop = true;
    var hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 900; hp.Q.value = 0.6;
    var wg = ctx.createGain(); wg.gain.value = 0;
    wn.connect(hp); hp.connect(wg); wg.connect(sfx);

    o1.start(); o2.start(); sub.start(); sq.start(); wn.start();
    eng = { o1: o1, o2: o2, sub: sub, lp: lp, g: g, sg: sg, bp: bp, wg: wg, hp: hp, tick: 0 };
  }

  var A = {
    /** Call from a user gesture (pointerdown / keydown). */
    ensure: function () {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { ctx = new AC(); } catch (e) { ctx = null; return; }
        master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
        sfx = ctx.createGain(); sfx.gain.value = 0.7; sfx.connect(master);
        mus = ctx.createGain(); mus.gain.value = 0.22; mus.connect(master);
        noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        var d = noise.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        buildEngine();
        apply();
      }
      if (ctx.state === 'suspended' && !suspended) { var p = ctx.resume(); if (p && p.catch) p.catch(noop); }
    },
    setSdk: function (v) { sdkOn = !!v; apply(); },
    setSound: function (v) { soundOn = !!v; apply(); },
    suspend: function () {
      suspended = true; musOn = false;
      if (ctx && ctx.state === 'running') { var p = ctx.suspend(); if (p && p.catch) p.catch(noop); }
    },
    resume: function () {
      suspended = false;
      if (ctx && ctx.state === 'suspended') { var p = ctx.resume(); if (p && p.catch) p.catch(noop); }
    },

    /** Continuous layers. on: engine audible; v01: speed 0..1; drift: 0..1 squeal; boost: 0..1. */
    engine: function (on, v01, drift, boost) {
      if (!eng) return;
      if ((eng.tick = (eng.tick + 1) % 2) !== 0) return; // every other frame is plenty
      var t = ctx.currentTime;
      var f = 42 + 58 * v01 + 18 * boost;
      eng.o1.frequency.setTargetAtTime(f, t, 0.08);
      eng.o2.frequency.setTargetAtTime(f * 1.012, t, 0.08);
      eng.sub.frequency.setTargetAtTime(f * 0.5, t, 0.08);
      eng.lp.frequency.setTargetAtTime(260 + 1100 * v01 + 900 * boost + 300 * drift, t, 0.1);
      eng.g.gain.setTargetAtTime(on ? 0.085 + 0.03 * v01 : 0, t, on ? 0.12 : 0.05);
      eng.sg.gain.setTargetAtTime(on ? drift * 0.075 : 0, t, 0.05);
      eng.bp.frequency.setTargetAtTime(2100 + 500 * drift + 400 * v01, t, 0.08);
      eng.wg.gain.setTargetAtTime(on ? 0.02 + 0.05 * v01 + 0.12 * boost : 0, t, 0.15);
      eng.hp.frequency.setTargetAtTime(700 + 900 * v01 + 1200 * boost, t, 0.15);
    },

    token: function (n) {
      if (!live()) return;
      var t = ctx.currentTime, semis = [0, 3, 7, 10, 12, 15, 19, 22][Math.min(7, n | 0)];
      var f = 880 * Math.pow(2, semis / 12);
      tone(f, t, 0.22, 'sine', 0.12);
      tone(f * 2, t + 0.03, 0.18, 'triangle', 0.035);
    },
    bank: function (combo) {
      if (!live()) return;
      var t = ctx.currentTime, b = 440 * Math.pow(2, Math.min(combo - 1, 9) / 12);
      tone(b, t, 0.16, 'square', 0.04, 0, null, 2400);
      tone(b * 1.5, t + 0.07, 0.22, 'square', 0.04, 0, null, 2400);
      tone(b * 2, t + 0.14, 0.3, 'triangle', 0.07);
    },
    scrape: function (sev) {
      if (!live()) return;
      var t = ctx.currentTime;
      hiss(t, 0.18 + sev * 0.2, 0.22 + sev * 0.2, 'bandpass', 1400, 500, 1.2);
      tone(90, t, 0.14, 'square', 0.06, 50, null, 900);
    },
    crash: function () {
      if (!live()) return;
      var t = ctx.currentTime;
      hiss(t, 0.5, 0.42, 'lowpass', 4000, 200, 0.7);
      tone(120, t, 0.4, 'sine', 0.35, 38);
      tone(240, t, 0.18, 'square', 0.06, 70, null, 1500);
    },
    boost: function () {
      if (!live()) return;
      var t = ctx.currentTime;
      hiss(t, 0.7, 0.3, 'bandpass', 400, 4000, 0.9);
      tone(110, t, 0.6, 'sawtooth', 0.07, 330, null, 3000);
      tone(220, t + 0.05, 0.5, 'sawtooth', 0.04, 660, null, 3000);
    },
    over: function () {
      if (!live()) return;
      var t = ctx.currentTime, n = [440, 349.23, 261.63, 220];
      for (var i = 0; i < n.length; i++) tone(n[i], t + i * 0.13, 0.5, 'sawtooth', 0.06, 0, null, 1800);
      tone(55, t + 0.4, 0.9, 'sine', 0.25, 40);
    },
    best: function () {
      if (!live()) return;
      var t = ctx.currentTime, n = [523.25, 659.25, 783.99, 1046.5];
      for (var i = 0; i < n.length; i++) tone(n[i], t + i * 0.09, 0.35, 'square', 0.035, 0, null, 3000);
      tone(1567.98, t + 0.36, 0.5, 'triangle', 0.06);
    },
    unlock: function () {
      if (!live()) return;
      var t = ctx.currentTime;
      tone(659.25, t, 0.2, 'triangle', 0.1);
      tone(987.77, t + 0.08, 0.3, 'triangle', 0.1);
      tone(1318.5, t + 0.16, 0.4, 'sine', 0.08);
    },
    click: function () {
      if (!live()) return;
      tone(660, ctx.currentTime, 0.06, 'triangle', 0.08, 990);
    },
    deny: function () {
      if (!live()) return;
      tone(180, ctx.currentTime, 0.14, 'square', 0.05, 140, null, 800);
    },
    tick: function (go) {
      if (!live()) return;
      tone(go ? 1318.5 : 880, ctx.currentTime, go ? 0.25 : 0.1, 'triangle', 0.1);
    },

    /** Call every frame. A quiet, original synth bass pulse; intensity 0..1 adds an arpeggio. */
    music: function (active, intensity) {
      if (!active || !live() || ctx.state !== 'running') { musOn = false; return; }
      var now = ctx.currentTime;
      if (!musOn || nextStep < now - 0.1) { musOn = true; nextStep = now + 0.08; step = 0; }
      var spb = 60 / 104 / 2; // 8th notes at 104 bpm
      while (nextStep < now + 0.15) {
        schedule(step, nextStep, intensity);
        nextStep += spb;
        step = (step + 1) % 64;
      }
    }
  };

  function schedule(s, t, intensity) {
    var p = s % 16, bar = (s / 16) | 0, root = ROOTS[bar], ch = CHORD[bar];
    // bass: root on every 8th, octave on the off-beats
    tone(p % 2 ? root * 2 : root, t, 0.2, 'sawtooth', p % 4 === 0 ? 0.16 : 0.1, 0, mus, 700 + 500 * intensity);
    if (p % 4 === 0) tone(95, t, 0.18, 'sine', 0.3, 42, mus);
    if (p % 4 === 2) hiss(t, 0.04, 0.05, 'highpass', 7000, 0, 0.7, mus);
    if (intensity > 0.35 && p % 2 === 1) {
      var k = ch[(s >> 1) % 3] + (((s >> 3) & 1) ? 12 : 0);
      tone(root * 4 * Math.pow(2, k / 12), t, 0.16, 'triangle', 0.035 * intensity, 0, mus);
    }
  }

  window.NDAudio = A;
})();
