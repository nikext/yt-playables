/* Kicks Lab: synthesized sound effects and a procedural lo-fi beat for the shop.
   WebAudio only, no samples. The AudioContext is created on the first gesture. */
(function () {
  'use strict';
  var KL = window.KL = window.KL || {};

  var ac = null, master = null, sfx = null, musBus = null;
  var wanted = true, halted = false, musicOn = false;
  var nextT = 0, step = 0, bar = 0, noiseBuf = null;

  function create() {
    if (ac) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.75; master.connect(ac.destination);
      sfx = ac.createGain(); sfx.gain.value = 1; sfx.connect(master);
      var tape = ac.createBiquadFilter(); tape.type = 'lowpass'; tape.frequency.value = 2600; tape.Q.value = 0.4;
      musBus = ac.createGain(); musBus.gain.value = 0.42; musBus.connect(tape); tape.connect(master);
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
    env(g, t, Math.min(0.015, dur * 0.2), vol, dur);
    o.connect(g); g.connect(dest || sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(t, dur, vol, type, f0, f1, q, dest) {
    var s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise(); s.loop = true;
    fl.type = type; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur); fl.Q.value = q || 0.8;
    env(g, t, Math.min(0.02, dur * 0.25), vol, dur);
    s.connect(fl); fl.connect(g); g.connect(dest || sfx);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  // ---------- lo-fi beat ----------
  // 80 bpm, swung 16ths. Four 7th chords, soft kick/snare/hat and a warm bass.
  var BPM = 80, S16 = 60 / BPM / 4;
  var CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
  var BASS = [41, 40, 38, 36];
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function keys(t, notes, dur) {
    for (var i = 0; i < notes.length; i++) {
      var f = mtof(notes[i]);
      tone(f, 'sine', t + i * 0.012, dur, 0.05, 0, musBus);
      tone(f * 1.003, 'triangle', t + i * 0.012, dur * 0.7, 0.018, 0, musBus);
    }
  }
  function kick(t) { tone(120, 'sine', t, 0.32, 0.5, 42, musBus); }
  function snare(t) { hiss(t, 0.18, 0.16, 'bandpass', 1800, 1200, 0.7, musBus); tone(190, 'triangle', t, 0.08, 0.08, 140, musBus); }
  function hat(t, v) { hiss(t, 0.05, 0.05 * v, 'highpass', 7000, 0, 0.5, musBus); }
  function schedule(t) {
    var s = step % 16, ci = bar % 4;
    if (s === 0) { keys(t, CHORDS[ci], S16 * 14); tone(mtof(BASS[ci]), 'sine', t, S16 * 6, 0.16, 0, musBus); }
    if (s === 10) tone(mtof(BASS[ci] + (bar % 2 ? 7 : 12)), 'sine', t, S16 * 4, 0.12, 0, musBus);
    if (s === 0 || s === 7 || s === 10) kick(t);
    if (s === 4 || s === 12) snare(t);
    if (s % 2 === 0) hat(t, s % 4 === 0 ? 1 : 0.6);
    if (s === 14 && bar % 2) keys(t, [CHORDS[ci][3] + 12], S16 * 2);
    if (Math.random() < 0.12) hiss(t, 0.02, 0.025, 'highpass', 3000, 0, 0.5, musBus); // vinyl crackle
  }

  KL.Audio = {
    unlock: function () { if (create()) apply(); },
    setWanted: function (on) { wanted = !!on; apply(); if (wanted) nextT = 0; },
    halt: function () { halted = true; apply(); },
    unhalt: function () { halted = false; apply(); nextT = 0; },
    music: function (on) { if (on && !musicOn) { nextT = 0; step = 0; bar = 0; } musicOn = !!on; },
    // Called every frame: schedules beat notes a little ahead of time.
    tick: function () {
      if (!musicOn || !live() || ac.state !== 'running') return;
      var now = ac.currentTime;
      if (!nextT || nextT < now - 0.25) nextT = now + 0.06;
      try {
        while (nextT < now + 0.18) {
          var swing = step % 2 ? S16 * 0.18 : 0;
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
        if (name === 'spray') { hiss(t, 0.32, 0.22, 'bandpass', 5200, 3800, 0.9); hiss(t, 0.12, 0.08, 'highpass', 8000, 0, 0.5); }
        else if (name === 'plop') { tone(440, 'sine', t, 0.14, 0.32, 150); tone(900, 'sine', t + 0.02, 0.05, 0.06, 600); }
        else if (name === 'peel') hiss(t, 0.16, 0.12, 'bandpass', 1400, 6000, 1.6);
        else if (name === 'slap') { hiss(t, 0.07, 0.3, 'lowpass', 1600, 0, 0.6); tone(150, 'sine', t, 0.1, 0.3, 70); }
        else if (name === 'ding') {
          hiss(t, 0.05, 0.12, 'bandpass', 3000, 0, 1);
          tone(1319, 'sine', t + 0.04, 0.7, 0.18); tone(2637, 'sine', t + 0.04, 0.35, 0.05); tone(1760, 'sine', t + 0.12, 0.8, 0.14);
        } else if (name === 'stamp') { tone(120, 'sine', t, 0.32, 0.55, 46); hiss(t, 0.12, 0.3, 'lowpass', 700, 0, 0.7); }
        else if (name === 'click') tone(700, 'triangle', t, 0.05, 0.1);
        else if (name === 'undo') tone(560, 'triangle', t, 0.12, 0.12, 360);
        else if (name === 'deny') { tone(220, 'square', t, 0.1, 0.05); tone(185, 'square', t + 0.09, 0.12, 0.05); }
        else if (name === 'whoosh') hiss(t, 0.35, 0.08, 'bandpass', 600, 2400, 1.2);
        else if (name === 'tier') [523, 659, 784, 1046, 1319].forEach(function (f, i) { tone(f, 'triangle', t + i * 0.08, 0.5, 0.1); });
        else if (name === 'buy') { tone(988, 'sine', t, 0.25, 0.14); tone(1319, 'sine', t + 0.08, 0.5, 0.14); hiss(t, 0.05, 0.1, 'bandpass', 3000, 0, 1); }
        else if (name === 'pin') { tone(880, 'triangle', t, 0.08, 0.12); tone(1175, 'triangle', t + 0.06, 0.2, 0.1); }
        else if (name === 'tick') tone(1200, 'sine', t, 0.04, 0.05);
      } catch (e) { /* ignore audio errors */ }
    }
  };
})();
