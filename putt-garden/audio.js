/*
 * audio.js: Putt Garden's synthesized sound (WebAudio only, no samples, no music licensing).
 * The AudioContext is created lazily on the first user gesture (PuttAudio.ensure()).
 * Sound plays only when YouTube audio is on AND the in-game toggle is on (PuttAudio.setEnabled).
 */
(function (root) {
  'use strict';
  var AC = null, master = null, sfx = null, amb = null, noise = null, enabled = false;
  var wind = null, lastClack = 0, birdT = 2, ambOn = false;
  var PENT = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

  function ensure() {
    if (AC) { apply(); return; }
    var Ctor = root.AudioContext || root.webkitAudioContext;
    if (!Ctor) return;
    try { AC = new Ctor(); } catch (e) { AC = null; return; }
    master = AC.createGain(); master.gain.value = 0; master.connect(AC.destination);
    sfx = AC.createGain(); sfx.gain.value = 1; sfx.connect(master);
    amb = AC.createGain(); amb.gain.value = 0; amb.connect(master);
    var len = Math.floor(AC.sampleRate * 2);
    noise = AC.createBuffer(1, len, AC.sampleRate);
    var d = noise.getChannelData(0), s = 98765;
    for (var i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; }
    apply();
  }
  function setEnabled(on) { enabled = !!on; apply(); }
  function apply() {
    if (!AC) return;
    try {
      if (enabled) {
        if (AC.state === 'suspended') AC.resume();
        master.gain.setTargetAtTime(0.85, AC.currentTime, 0.04);
        if (ambOn) startWind();
      } else {
        master.gain.setTargetAtTime(0, AC.currentTime, 0.02);
        if (AC.state === 'running') AC.suspend();
      }
    } catch (e) { /* ignore */ }
  }
  function ok() { return AC && enabled && AC.state !== 'closed'; }

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function osc(type, f, t, dur, peak, f2, a, dest) {
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur * 0.8);
    env(g, t, a || 0.003, peak, dur);
    o.connect(g); g.connect(dest || sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function burst(t, dur, peak, type, freq, q, freq2, dest) {
    var src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    src.buffer = noise;
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 0.7;
    if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    env(g, t, 0.003, peak, dur);
    src.connect(f); f.connect(g); g.connect(dest || sfx);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  function bell(f, t, vol) {
    osc('sine', f, t, 0.9, vol, 0, 0.004);
    osc('sine', f * 2.76, t, 0.35, vol * 0.25, 0, 0.002);
    osc('triangle', f * 2, t, 0.2, vol * 0.12, 0, 0.002);
  }

  // ambient: soft wind (filtered noise with a slow swell) plus occasional bird chirps
  function startWind() {
    if (!AC || wind) return;
    var src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    var lfo = AC.createOscillator(), lg = AC.createGain();
    src.buffer = noise; src.loop = true;
    f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.5;
    g.gain.value = 0.05;
    lfo.frequency.value = 0.09; lg.gain.value = 0.035;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(amb);
    src.start(); lfo.start();
    wind = { src: src, lfo: lfo };
  }
  function chirp(t) {
    var base = 2300 + Math.random() * 1500, n = 2 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++) {
      var tt = t + i * (0.09 + Math.random() * 0.05);
      var o = AC.createOscillator(), g = AC.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(base, tt);
      o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), tt + 0.03);
      o.frequency.exponentialRampToValueAtTime(base * 0.85, tt + 0.07);
      env(g, tt, 0.006, 0.03, 0.07);
      o.connect(g); g.connect(amb);
      o.start(tt); o.stop(tt + 0.12);
    }
  }

  var api = {
    ensure: ensure, setEnabled: setEnabled,
    // call every frame with dt; on = whether ambience should play (menus and holes)
    ambience: function (dt, on) {
      ambOn = on;
      if (!ok()) return;
      amb.gain.setTargetAtTime(on ? 1 : 0, AC.currentTime, 0.4);
      if (!on) return;
      startWind();
      birdT -= dt;
      if (birdT <= 0) { birdT = 3 + Math.random() * 6; chirp(AC.currentTime + 0.02); }
    },
    ui: function () { if (!ok()) return; var t = AC.currentTime; osc('sine', 660, t, 0.08, 0.06, 880); osc('triangle', 1320, t, 0.05, 0.02); },
    back: function () { if (!ok()) return; var t = AC.currentTime; osc('sine', 600, t, 0.09, 0.06, 420); },
    nope: function () { if (!ok()) return; var t = AC.currentTime; osc('triangle', 220, t, 0.12, 0.06, 170); },
    // the putter: a wooden "tock"
    tock: function (power) {
      if (!ok()) return;
      var t = AC.currentTime, v = 0.25 + power * 0.75;
      osc('sine', 1050 - power * 250, t, 0.07, 0.16 * v, 600);
      osc('triangle', 210, t, 0.09, 0.08 * v, 120);
      burst(t, 0.03, 0.08 * v, 'bandpass', 3200, 1.4);
    },
    // ball against a wall or stone: a "clack" scaled by the impact speed
    clack: function (impact) {
      if (!ok()) return;
      var t = AC.currentTime;
      if (t - lastClack < 0.04) return;
      lastClack = t;
      var v = Math.min(1, impact / 700);
      osc('sine', 1500 + v * 500, t, 0.05, 0.03 + v * 0.12, 1100);
      burst(t, 0.025, 0.03 + v * 0.1, 'bandpass', 2600, 2);
    },
    bump: function () { if (!ok()) return; var t = AC.currentTime; osc('sine', 300, t, 0.25, 0.15, 720); osc('triangle', 900, t, 0.07, 0.04, 1300); },
    gate: function () { if (!ok()) return; var t = AC.currentTime; osc('square', 900, t, 0.03, 0.025, 700); burst(t, 0.03, 0.04, 'highpass', 3000); },
    blade: function () { if (!ok()) return; var t = AC.currentTime; osc('sine', 260, t, 0.12, 0.14, 150); burst(t, 0.05, 0.06, 'lowpass', 900); },
    sand: function () { if (!ok()) return; burst(AC.currentTime, 0.22, 0.09, 'bandpass', 1800, 0.6, 700); },
    splash: function () {
      if (!ok()) return;
      var t = AC.currentTime;
      burst(t, 0.45, 0.22, 'lowpass', 2400, 0.8, 300);
      burst(t + 0.02, 0.2, 0.1, 'bandpass', 900, 3, 2000);
      for (var i = 0; i < 4; i++) osc('sine', 500 + Math.random() * 400, t + 0.12 + i * 0.07, 0.06, 0.04, 1300);
    },
    pipe: function () {
      if (!ok()) return;
      var t = AC.currentTime;
      burst(t, 0.35, 0.12, 'bandpass', 400, 4, 1600);
      osc('sine', 180, t, 0.3, 0.06, 420);
    },
    rattle: function () {
      if (!ok()) return;
      var t = AC.currentTime;
      for (var i = 0; i < 3; i++) { osc('square', 1900 - i * 200, t + i * 0.035, 0.02, 0.025, 1500); }
    },
    sink: function () {
      if (!ok()) return;
      var t = AC.currentTime;
      osc('sine', 180, t, 0.18, 0.2, 90);
      burst(t, 0.06, 0.08, 'lowpass', 1200);
      for (var i = 0; i < 3; i++) osc('square', 1700 - i * 250, t + 0.05 + i * 0.04, 0.02, 0.02, 1200);
      bell(PENT[0] * 2, t + 0.2, 0.08); bell(PENT[2] * 2, t + 0.32, 0.07); bell(PENT[3] * 2, t + 0.44, 0.07);
    },
    star: function (i) { if (!ok()) return; bell(PENT[3 + (i || 0) * 2], AC.currentTime, 0.07); },
    fanfare: function () {
      if (!ok()) return;
      var t = AC.currentTime;
      [0, 2, 3, 5, 7].forEach(function (n, i) { bell(PENT[n], t + i * 0.11, 0.06); });
    },
    fail: function () { if (!ok()) return; var t = AC.currentTime; osc('triangle', 330, t, 0.25, 0.08, 220); osc('triangle', 247, t + 0.2, 0.35, 0.08, 165); }
  };
  root.PuttAudio = api;
})(this);
