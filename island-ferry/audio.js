/* Island Ferry: synthesized sound (WebAudio only, no samples). */
(function () {
  'use strict';
  var IF = window.IF = window.IF || {};

  var ac = null, master = null, sfxBus = null, ambGain = null, ambSrc = null, ambLfo = null;
  var wanted = true;   // YouTube audio AND in-game toggle
  var halted = false;  // paused by the platform
  var ambOn = false;

  function create() {
    if (ac) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    } catch (e) { ac = null; return false; }
    applyState();
    return true;
  }
  function applyState() {
    if (!ac) return;
    try {
      if (wanted && !halted) { if (ac.state !== 'running') ac.resume(); }
      else if (ac.state === 'running') ac.suspend();
    } catch (e) { /* ignore */ }
    syncAmbience();
  }
  function live() { return ac && wanted && !halted; }

  function tone(freq, type, start, dur, vol, glide, dest) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, start);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(dest || sfxBus);
    o.start(start); o.stop(start + dur + 0.05);
  }

  var noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    var len = ac.sampleRate * 2;
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    var d = noiseBuf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04; d[i] = last * 3.2; }
    return noiseBuf;
  }

  function syncAmbience() {
    if (!ac) return;
    var should = ambOn && wanted && !halted;
    if (should && !ambSrc) {
      try {
        ambSrc = ac.createBufferSource(); ambSrc.buffer = noise(); ambSrc.loop = true;
        var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
        ambGain = ac.createGain(); ambGain.gain.value = 0.05;
        ambLfo = ac.createOscillator(); ambLfo.frequency.value = 0.13;
        var lfoAmt = ac.createGain(); lfoAmt.gain.value = 0.035;
        ambLfo.connect(lfoAmt); lfoAmt.connect(ambGain.gain);
        ambSrc.connect(lp); lp.connect(ambGain); ambGain.connect(master);
        ambSrc.start(); ambLfo.start();
      } catch (e) { ambSrc = null; }
    } else if (!should && ambSrc) {
      try { ambSrc.stop(); ambLfo.stop(); ambGain.disconnect(); } catch (e) { /* ignore */ }
      ambSrc = null; ambLfo = null; ambGain = null;
    }
  }

  IF.Audio = {
    unlock: function () { if (create()) applyState(); },
    setWanted: function (on) { wanted = !!on; applyState(); },
    halt: function () { halted = true; applyState(); },
    unhalt: function () { halted = false; applyState(); },
    ambience: function (on) { ambOn = !!on; syncAmbience(); },
    play: function (name) {
      if (!live()) return;
      var t = ac.currentTime + 0.01;
      try {
        if (name === 'bell') {
          tone(1046, 'sine', t, 0.9, 0.22); tone(2093, 'sine', t, 0.5, 0.06); tone(2880, 'sine', t, 0.3, 0.03);
          tone(1568, 'sine', t + 0.09, 0.8, 0.12);
        } else if (name === 'horn') {
          var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(sfxBus);
          [155.6, 196].forEach(function (f) {
            var o = ac.createOscillator(), g = ac.createGain();
            o.type = 'triangle'; o.frequency.setValueAtTime(f * 0.97, t); o.frequency.linearRampToValueAtTime(f, t + 0.08);
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.06);
            g.gain.setValueAtTime(0.18, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
            o.connect(g); g.connect(lp); o.start(t); o.stop(t + 0.8);
          });
        } else if (name === 'pop') {
          tone(620, 'sine', t, 0.12, 0.12, 980);
        } else if (name === 'tick') {
          tone(880, 'triangle', t, 0.06, 0.08);
        } else if (name === 'expire') {
          tone(330, 'sine', t, 0.45, 0.2, 140); tone(220, 'triangle', t + 0.05, 0.4, 0.08, 110);
        } else if (name === 'heart') {
          tone(784, 'sine', t, 0.18, 0.12); tone(1175, 'sine', t + 0.08, 0.3, 0.12);
        } else if (name === 'chime') {
          [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 'sine', t + i * 0.11, 0.7, 0.13); });
        } else if (name === 'card') {
          tone(660, 'triangle', t, 0.16, 0.1); tone(990, 'sine', t + 0.07, 0.35, 0.12);
        } else if (name === 'remove') {
          tone(440, 'triangle', t, 0.18, 0.1, 260);
        } else if (name === 'over') {
          [523, 440, 349].forEach(function (f, i) { tone(f, 'sine', t + i * 0.18, 0.6, 0.14); });
        } else if (name === 'deny') {
          tone(240, 'square', t, 0.12, 0.04); tone(200, 'square', t + 0.1, 0.14, 0.04);
        }
      } catch (e) { /* ignore audio errors */ }
    }
  };
})();
