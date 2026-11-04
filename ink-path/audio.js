/*
 * audio.js: Ink Path's synthesized sound (WebAudio only, no samples, no music licensing).
 * The AudioContext is created lazily on the first user gesture (InkAudio.ensure()).
 * Sound plays only when YouTube audio is on AND the in-game toggle is on (InkAudio.setEnabled).
 */
(function (root) {
  'use strict';
  var AC = null, master = null, noise = null, enabled = false;
  var brush = null, roll = null;
  var lastTock = 0, lastHit = 0;
  // miyako-bushi flavoured scale (D Eb G A Bb), two octaves
  var SCALE = [293.66, 311.13, 392.0, 440.0, 466.16, 587.33, 622.25, 783.99, 880.0, 932.33];
  var pluckIdx = 0;

  function ensure() {
    if (AC) { apply(); return; }
    var Ctor = root.AudioContext || root.webkitAudioContext;
    if (!Ctor) return;
    try { AC = new Ctor(); } catch (e) { AC = null; return; }
    master = AC.createGain();
    master.gain.value = 0;
    master.connect(AC.destination);
    var len = Math.floor(AC.sampleRate * 1.5);
    noise = AC.createBuffer(1, len, AC.sampleRate);
    var d = noise.getChannelData(0), s = 12345;
    for (var i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; }
    apply();
  }
  function setEnabled(on) { enabled = !!on; apply(); }
  function apply() {
    if (!AC) return;
    try {
      if (enabled) {
        if (AC.state === 'suspended') AC.resume();
        master.gain.setTargetAtTime(0.9, AC.currentTime, 0.03);
      } else {
        master.gain.setTargetAtTime(0, AC.currentTime, 0.02);
        stopBrush(); stopRoll();
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
  function osc(type, f, t, dur, peak, f2, a) {
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur * 0.8);
    env(g, t, a || 0.004, peak, dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
    return g;
  }
  function noiseBurst(t, dur, peak, type, freq, q, freq2) {
    var src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    src.buffer = noise;
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 0.7;
    if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    env(g, t, 0.003, peak, dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  // koto-like pluck: bright attack through a closing low-pass
  function pluck(f, vol, delay) {
    if (!ok()) return;
    var t = AC.currentTime + (delay || 0);
    var o1 = AC.createOscillator(), o2 = AC.createOscillator(), lp = AC.createBiquadFilter(), g = AC.createGain();
    o1.type = 'sawtooth'; o2.type = 'triangle';
    o1.frequency.value = f; o2.frequency.value = f * 2.003;
    lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.35);
    env(g, t, 0.002, vol || 0.06, 0.9);
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
    o1.start(t); o2.start(t); o1.stop(t + 1); o2.stop(t + 1);
  }
  // singing bowl: inharmonic partials with slow decay and a little beating
  function bowl(base, vol, delay) {
    if (!ok()) return;
    var t = AC.currentTime + (delay || 0);
    var parts = [[1, 1, 3.2], [1.004, 0.6, 3.0], [2.71, 0.45, 2.2], [5.18, 0.22, 1.4], [8.4, 0.1, 0.9]];
    for (var i = 0; i < parts.length; i++) osc('sine', base * parts[i][0], t, parts[i][2], (vol || 0.12) * parts[i][1], 0, 0.006);
  }

  var api = {
    ensure: ensure, setEnabled: setEnabled,
    ui: function () { pluck(SCALE[(pluckIdx++ * 3) % 6 + 2], 0.05); },
    back: function () { pluck(SCALE[1], 0.045); },
    pluck: function (i, vol, delay) { pluck(SCALE[i % SCALE.length], vol, delay); },
    menuChord: function () { [0, 2, 3, 5].forEach(function (n, i) { pluck(SCALE[n], 0.05, i * 0.09); }); },
    // wooden block knock on impacts
    tock: function (strength) {
      if (!ok()) return;
      var now = AC.currentTime;
      if (now - lastTock < 0.05) return;
      lastTock = now;
      var v = Math.min(1, strength / 900);
      osc('sine', 820 + v * 300, now, 0.09, 0.03 + v * 0.1, 520);
      noiseBurst(now, 0.025, 0.02 + v * 0.05, 'bandpass', 2400, 1.2);
    },
    clack: function () { if (!ok()) return; var t = AC.currentTime; osc('sine', 2100, t, 0.06, 0.07, 1500); osc('sine', 3300, t, 0.04, 0.03); },
    boing: function () { if (!ok()) return; var t = AC.currentTime; osc('triangle', 170, t, 0.32, 0.12, 430); osc('sine', 900, t, 0.06, 0.05, 600); },
    tear: function () {
      if (!ok()) return;
      var t = AC.currentTime;
      noiseBurst(t, 0.22, 0.16, 'highpass', 1800, 0.6);
      noiseBurst(t + 0.05, 0.18, 0.1, 'bandpass', 3500, 2, 1200);
    },
    lantern: function () { if (!ok()) return; var t = AC.currentTime; osc('sine', 230, t, 0.18, 0.12, 160); noiseBurst(t, 0.08, 0.05, 'lowpass', 900); },
    cup: function () { if (!ok()) return; bowl(392, 0.11); osc('sine', 1250, AC.currentTime, 0.08, 0.06, 900); },
    win: function () {
      if (!ok()) return;
      bowl(261.63, 0.09, 0.15);
      [2, 3, 5, 7, 8].forEach(function (n, i) { pluck(SCALE[n], 0.05, 0.35 + i * 0.12); });
    },
    // low taiko-ish thud
    fail: function () {
      if (!ok()) return;
      var t = AC.currentTime;
      osc('sine', 120, t, 0.6, 0.35, 46, 0.003);
      osc('triangle', 80, t, 0.3, 0.1, 50, 0.003);
      noiseBurst(t, 0.1, 0.14, 'lowpass', 500);
    },
    stamp: function (i) {
      if (!ok()) return;
      var t = AC.currentTime;
      osc('sine', 150, t, 0.16, 0.22, 90, 0.002);
      noiseBurst(t, 0.06, 0.08, 'lowpass', 1400);
      pluck(SCALE[5 + (i || 0) * 2], 0.04, 0.05);
    },
    nope: function () { if (!ok()) return; var t = AC.currentTime; osc('triangle', 220, t, 0.12, 0.05, 180); },
    dry: function () { if (!ok()) return; noiseBurst(AC.currentTime, 0.3, 0.05, 'bandpass', 900, 0.8, 300); },
    // continuous brush scratch while drawing; speed 0..1
    startBrush: function () {
      if (!ok() || brush) return;
      var src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
      src.buffer = noise; src.loop = true;
      f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.9;
      g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
      brush = { src: src, f: f, g: g };
    },
    brush: function (speed) {
      if (!brush || !AC) return;
      var s = speed < 0 ? 0 : speed > 1 ? 1 : speed;
      brush.g.gain.setTargetAtTime(0.012 + s * 0.07, AC.currentTime, 0.03);
      brush.f.frequency.setTargetAtTime(1800 + s * 2600, AC.currentTime, 0.05);
    },
    stopBrush: stopBrush,
    // continuous soft rolling rumble while the marble runs; amount 0..1
    startRoll: function () {
      if (!ok() || roll) return;
      var src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
      src.buffer = noise; src.loop = true;
      f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 1.5;
      g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
      roll = { src: src, f: f, g: g };
    },
    roll: function (amount) {
      if (!roll || !AC) return;
      var a = amount < 0 ? 0 : amount > 1 ? 1 : amount;
      roll.g.gain.setTargetAtTime(a * 0.22, AC.currentTime, 0.05);
      roll.f.frequency.setTargetAtTime(220 + a * 500, AC.currentTime, 0.08);
    },
    stopRoll: stopRoll
  };
  function stopBrush() {
    if (!brush) return;
    var b = brush; brush = null;
    try { b.g.gain.setTargetAtTime(0, AC.currentTime, 0.03); b.src.stop(AC.currentTime + 0.2); } catch (e) { /* ignore */ }
  }
  function stopRoll() {
    if (!roll) return;
    var r = roll; roll = null;
    try { r.g.gain.setTargetAtTime(0, AC.currentTime, 0.05); r.src.stop(AC.currentTime + 0.3); } catch (e) { /* ignore */ }
  }
  root.InkAudio = api;
})(this);
