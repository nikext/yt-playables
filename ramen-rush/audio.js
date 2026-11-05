/* Ramen Rush: synthesized kitchen sounds and a small lo-fi loop. WebAudio only, no samples.
   The AudioContext is created on the first gesture. */
(function () {
  'use strict';
  var RR = window.RR = window.RR || {};

  var ac = null, master = null, sfx = null, musBus = null;
  var wanted = true, halted = false, musicOn = false, musicLevel = 1;
  var nextT = 0, step = 0, bar = 0, noiseBuf = null;

  function create() {
    if (ac) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination);
      sfx = ac.createGain(); sfx.gain.value = 1; sfx.connect(master);
      var tape = ac.createBiquadFilter(); tape.type = 'lowpass'; tape.frequency.value = 2200; tape.Q.value = 0.5;
      musBus = ac.createGain(); musBus.gain.value = 0.32; musBus.connect(tape); tape.connect(master);
    } catch (e) { ac = null; return false; }
    apply();
    return true;
  }
  function apply() {
    if (!ac) return;
    try {
      if (wanted && !halted) { if (ac.state !== 'running') ac.resume(); }
      else if (ac.state === 'running') ac.suspend();
    } catch (e) { /* ignore */ }
  }
  function live() { return ac && wanted && !halted && ac.state !== 'closed'; }
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
  function tone(f, type, t, dur, vol, glide, dest) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
    env(g, t, Math.min(0.012, dur * 0.2), vol, dur);
    o.connect(g); g.connect(dest || sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(t, dur, vol, type, f0, f1, q, dest, attack) {
    var s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise(); s.loop = true;
    fl.type = type; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur); fl.Q.value = q || 0.8;
    env(g, t, attack || Math.min(0.02, dur * 0.25), vol, dur);
    s.connect(fl); fl.connect(g); g.connect(dest || sfx);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function blip(t, f, vol) { tone(f, 'sine', t, 0.07, vol, f * 1.9); }

  // ---------- lo-fi loop: 76 bpm, swung, four soft 9th chords, a pentatonic pluck ----------
  var BPM = 76, S16 = 60 / BPM / 4;
  var CHORDS = [[50, 57, 60, 64], [55, 59, 62, 65], [48, 55, 59, 62], [45, 52, 55, 60]];
  var BASS = [38, 43, 36, 33];
  var MEL = [74, 72, 69, 67, 69, 72, 76, 74, 72, 69, 67, 64];
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function keys(t, notes, dur) {
    for (var i = 0; i < notes.length; i++) {
      var f = mtof(notes[i]);
      tone(f, 'sine', t + i * 0.015, dur, 0.045 * musicLevel, 0, musBus);
      tone(f * 1.004, 'triangle', t + i * 0.015, dur * 0.6, 0.014 * musicLevel, 0, musBus);
    }
  }
  function pluck(t, m) { tone(mtof(m), 'triangle', t, 0.45, 0.05 * musicLevel, 0, musBus); tone(mtof(m) * 2, 'sine', t, 0.15, 0.015 * musicLevel, 0, musBus); }
  function schedule(t) {
    var s = step % 16, ci = bar % 4, v = musicLevel;
    if (s === 0) { keys(t, CHORDS[ci], S16 * 15); tone(mtof(BASS[ci]), 'sine', t, S16 * 7, 0.15 * v, 0, musBus); }
    if (s === 8) tone(mtof(BASS[ci] + 7), 'sine', t, S16 * 5, 0.1 * v, 0, musBus);
    if (s === 0 || s === 10) tone(110, 'sine', t, 0.28, 0.35 * v, 45, musBus);
    if (s === 4 || s === 12) { hiss(t, 0.14, 0.09 * v, 'bandpass', 1700, 1100, 0.7, musBus); }
    if (s % 2 === 0) hiss(t, 0.04, (s % 4 === 0 ? 0.04 : 0.025) * v, 'highpass', 7000, 0, 0.5, musBus);
    if ((s === 6 || s === 14 || (s === 3 && bar % 2)) && Math.random() < 0.8) pluck(t, MEL[(bar * 3 + s) % MEL.length]);
    if (Math.random() < 0.1) hiss(t, 0.02, 0.02, 'highpass', 3000, 0, 0.5, musBus);
  }

  RR.Audio = {
    unlock: function () { if (create()) apply(); },
    setWanted: function (on) { wanted = !!on; apply(); if (wanted) nextT = 0; },
    halt: function () { halted = true; apply(); },
    unhalt: function () { halted = false; apply(); nextT = 0; },
    // level: 1 in menus, quieter during service so the kitchen sounds stay readable.
    music: function (on, level) { if (on && !musicOn) { nextT = 0; step = 0; bar = 0; } musicOn = !!on; musicLevel = level == null ? 1 : level; },
    tick: function () {
      if (!musicOn || !live() || ac.state !== 'running') return;
      var now = ac.currentTime;
      if (!nextT || nextT < now - 0.25) nextT = now + 0.06;
      try {
        while (nextT < now + 0.18) {
          var swing = step % 2 ? S16 * 0.2 : 0;
          schedule(nextT + swing);
          nextT += S16; step++;
          if (step % 16 === 0) bar++;
        }
      } catch (e) { /* ignore */ }
    },
    play: function (name) {
      if (!live()) return;
      var t = ac.currentTime + 0.01;
      try {
        if (name === 'pour') { hiss(t, 0.42, 0.2, 'lowpass', 900, 400, 1.2, sfx, 0.05); blip(t + 0.15, 300, 0.06); blip(t + 0.26, 360, 0.05); }
        else if (name === 'plop') { tone(520, 'sine', t, 0.12, 0.28, 180); hiss(t, 0.04, 0.05, 'bandpass', 2000, 0, 1); }
        else if (name === 'sizzle') { hiss(t, 0.5, 0.14, 'highpass', 4500, 7000, 0.6, sfx, 0.01); hiss(t, 0.25, 0.1, 'bandpass', 1200, 600, 1); }
        else if (name === 'bubble') { blip(t, 220 + Math.random() * 180, 0.035); }
        else if (name === 'ready') { tone(1047, 'sine', t, 0.5, 0.12); tone(1568, 'sine', t + 0.07, 0.6, 0.08); }
        else if (name === 'drain') { hiss(t, 0.35, 0.18, 'bandpass', 700, 2200, 0.9); tone(200, 'sine', t + 0.1, 0.12, 0.12, 110); }
        else if (name === 'chime') {
          hiss(t, 0.04, 0.1, 'bandpass', 3000, 0, 1);
          tone(1319, 'sine', t + 0.03, 0.7, 0.16); tone(2637, 'sine', t + 0.03, 0.3, 0.04); tone(1976, 'sine', t + 0.13, 0.8, 0.12);
        } else if (name === 'coin') { tone(1568, 'square', t, 0.06, 0.03); tone(2093, 'sine', t + 0.05, 0.2, 0.08); }
        else if (name === 'angry') { tone(180, 'sawtooth', t, 0.22, 0.05, 120); tone(150, 'square', t + 0.12, 0.25, 0.04, 100); }
        else if (name === 'deny') { tone(260, 'triangle', t, 0.08, 0.1); tone(200, 'triangle', t + 0.07, 0.1, 0.1); }
        else if (name === 'trash') { hiss(t, 0.18, 0.2, 'lowpass', 1200, 300, 0.8); tone(110, 'sine', t + 0.08, 0.18, 0.25, 60); }
        else if (name === 'over') { hiss(t, 0.6, 0.08, 'bandpass', 500, 300, 1.5); tone(330, 'triangle', t, 0.2, 0.06, 220); }
        else if (name === 'click') tone(760, 'triangle', t, 0.05, 0.09);
        else if (name === 'arrive') { tone(1760, 'sine', t, 0.3, 0.05); tone(2349, 'sine', t + 0.08, 0.35, 0.04); }
        else if (name === 'closing') [784, 659, 523].forEach(function (f, i) { tone(f, 'triangle', t + i * 0.16, 0.5, 0.09); });
        else if (name === 'star') { tone(880, 'triangle', t, 0.3, 0.1); tone(1320, 'sine', t + 0.05, 0.4, 0.08); }
        else if (name === 'fail') [392, 349, 294].forEach(function (f, i) { tone(f, 'triangle', t + i * 0.18, 0.4, 0.08); });
        else if (name === 'buy') { tone(988, 'sine', t, 0.25, 0.14); tone(1319, 'sine', t + 0.08, 0.5, 0.14); hiss(t, 0.05, 0.1, 'bandpass', 3000, 0, 1); }
        else if (name === 'whoosh') hiss(t, 0.3, 0.07, 'bandpass', 600, 2400, 1.2);
        else if (name === 'tick') tone(1200, 'sine', t, 0.04, 0.05);
      } catch (e) { /* ignore audio errors */ }
    }
  };
})();
