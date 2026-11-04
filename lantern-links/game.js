/*
 * game.js: Lantern Links, a calm light-beam puzzle for YouTube Playables.
 * Vanilla JS + Canvas 2D. Board model and beam tracing live in engine.js, levels in levels.js.
 */
(function () {
  'use strict';

  var PlayablesSDK = window.PlayablesSDK;
  var E = window.LLEngine;
  var LV = window.LLLevels;
  var T = E.T;
  PlayablesSDK.init({ storageKey: 'lantern-links_save' });

  // ------------------------------------------------------------------ constants
  var FONT = 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
  var C = {
    bg: '#FFF7EE', ink: '#3D3B54', inkSoft: '#8A87A6', peach: '#FFB4A2', pink: '#F7A1C4',
    lavender: '#B9A7F5', mint: '#9EE0C5', sky: '#A7D3F5', butter: '#FFE39A', coral: '#FF8C7A'
  };
  // Beam colour index: 0 pink, 1 sky, 2 gold.
  var BEAM = [
    { core: '#FFF0F7', mid: '#FF9FCB', glow: 'rgba(247,161,196,' },
    { core: '#EEF8FF', mid: '#8FCBFF', glow: 'rgba(143,203,255,' },
    { core: '#FFFBEA', mid: '#FFD978', glow: 'rgba(255,217,120,' }
  ];
  // Lantern colour by bit mask: 1 pink, 2 sky, 3 lavender, 4 gold.
  var LCOL = { 1: '#F7A1C4', 2: '#A7D3F5', 3: '#B9A7F5', 4: '#FFD98A' };
  var LDARK = { 1: '#C97FA0', 2: '#7FA9CC', 3: '#8F80C8', 4: '#D9AE5E' };
  var CHAPTERS = [
    { sky: ['#A396E0', '#E7A3C8', '#FFC1A8', '#FFE5CC'], board: '#5D5985', edge: '#48456E', tile: '#6A6693', tile2: '#67638F',
      hill: '#8ED1B8', hill2: '#76BBA2', accent: C.peach },
    { sky: ['#3E3C66', '#57538A', '#857DBE', '#BDB2EA'], board: '#45436C', edge: '#35335A', tile: '#524F7C', tile2: '#4E4B77',
      hill: '#6BAA9A', hill2: '#5A9788', accent: C.lavender },
    { sky: ['#9CCBF2', '#C6D5F3', '#FFD4C0', '#FFF0C8'], board: '#64629A', edge: '#525088', tile: '#7270A7', tile2: '#6E6CA3',
      hill: '#9EE0C5', hill2: '#86CDB1', accent: C.butter }
  ];
  var PER = LV.perChapter, NCH = LV.chapters, NLV = LV.levels.length;
  var CH_STARS = [0, 15, 36];
  var MAX_HINTS = 5;
  var BEAM_SPEED = 16; // cells per second
  var PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];

  // ------------------------------------------------------------------ i18n
  var STR = {
    en: {
      play: 'Play', tagline: 'Guide the light. Wake the garden.', chapters: ['Dusk', 'Night', 'Dawn'],
      moves: 'Moves', best: 'Best', clear: 'All aglow!', next: 'Next', replay: 'Replay', menu: 'Levels',
      locked: 'Clear {c} or collect {n}', newBest: 'New best!', noHints: 'Clear a level to earn a hint',
      paused: 'Paused', finale: 'The whole garden is aglow. Thank you!', goal: 'Goal',
      tutRotate: 'Tap the mirror to turn it', tutDrag: 'Drag a mirror onto the grass',
      tutTurnPlaced: 'Tap your mirror to turn it', tipPass: 'Light passes through lanterns',
      tipColor: 'Each lantern wants its own colour', tipMix: 'Pink + sky light = lavender',
      tipSplit: 'A prism splits a beam in two', tipSplitTray: 'Drag the prism from the tray',
      tipToggle: 'Tap a stone: all stones flip'
    },
    es: {
      play: 'Jugar', tagline: 'Guía la luz. Despierta el jardín.', chapters: ['Atardecer', 'Noche', 'Amanecer'],
      moves: 'Movs', best: 'Récord', clear: '¡Todo brilla!', next: 'Siguiente', replay: 'Repetir', menu: 'Niveles',
      locked: 'Completa {c} o reúne {n}', newBest: '¡Nuevo récord!', noHints: 'Supera un nivel para ganar una pista',
      paused: 'Pausa', finale: 'Todo el jardín brilla. ¡Gracias!', goal: 'Meta',
      tutRotate: 'Toca el espejo para girarlo', tutDrag: 'Arrastra un espejo a la hierba',
      tutTurnPlaced: 'Toca tu espejo para girarlo', tipPass: 'La luz atraviesa los farolillos',
      tipColor: 'Cada farolillo quiere su color', tipMix: 'Rosa + celeste = lavanda',
      tipSplit: 'Un prisma divide el rayo en dos', tipSplitTray: 'Arrastra el prisma de la bandeja',
      tipToggle: 'Toca una piedra: todas cambian'
    },
    pt: {
      play: 'Jogar', tagline: 'Guie a luz. Desperte o jardim.', chapters: ['Crepúsculo', 'Noite', 'Aurora'],
      moves: 'Jogadas', best: 'Recorde', clear: 'Tudo aceso!', next: 'Próximo', replay: 'Repetir', menu: 'Níveis',
      locked: 'Conclua {c} ou junte {n}', newBest: 'Novo recorde!', noHints: 'Conclua um nível para ganhar uma dica',
      paused: 'Pausado', finale: 'O jardim inteiro brilha. Obrigado!', goal: 'Meta',
      tutRotate: 'Toque no espelho para girá-lo', tutDrag: 'Arraste um espelho para a grama',
      tutTurnPlaced: 'Toque no seu espelho para girá-lo', tipPass: 'A luz atravessa as lanternas',
      tipColor: 'Cada lanterna quer a sua cor', tipMix: 'Rosa + azul-céu = lavanda',
      tipSplit: 'Um prisma divide o feixe em dois', tipSplitTray: 'Arraste o prisma da bandeja',
      tipToggle: 'Toque numa pedra: todas mudam'
    },
    fr: {
      play: 'Jouer', tagline: 'Guidez la lumière. Éveillez le jardin.', chapters: ['Crépuscule', 'Nuit', 'Aube'],
      moves: 'Coups', best: 'Record', clear: 'Tout brille !', next: 'Suivant', replay: 'Rejouer', menu: 'Niveaux',
      locked: 'Finissez {c} ou réunissez {n}', newBest: 'Nouveau record !', noHints: 'Finissez un niveau pour gagner un indice',
      paused: 'Pause', finale: 'Tout le jardin brille. Merci !', goal: 'But',
      tutRotate: 'Touchez le miroir pour le tourner', tutDrag: 'Glissez un miroir sur l’herbe',
      tutTurnPlaced: 'Touchez votre miroir pour le tourner', tipPass: 'La lumière traverse les lanternes',
      tipColor: 'Chaque lanterne veut sa couleur', tipMix: 'Rose + ciel = lavande',
      tipSplit: 'Un prisme divise le rayon en deux', tipSplitTray: 'Glissez le prisme depuis le plateau',
      tipToggle: 'Touchez une pierre : toutes basculent'
    },
    de: {
      play: 'Spielen', tagline: 'Lenke das Licht. Wecke den Garten.', chapters: ['Dämmerung', 'Nacht', 'Morgen'],
      moves: 'Züge', best: 'Bestwert', clear: 'Alles leuchtet!', next: 'Weiter', replay: 'Nochmal', menu: 'Level',
      locked: 'Schaffe {c} oder sammle {n}', newBest: 'Neuer Bestwert!', noHints: 'Löse ein Level für einen Tipp',
      paused: 'Pause', finale: 'Der ganze Garten leuchtet. Danke!', goal: 'Ziel',
      tutRotate: 'Tippe den Spiegel an, um ihn zu drehen', tutDrag: 'Zieh einen Spiegel aufs Gras',
      tutTurnPlaced: 'Tippe deinen Spiegel an, um ihn zu drehen', tipPass: 'Licht scheint durch Laternen',
      tipColor: 'Jede Laterne will ihre Farbe', tipMix: 'Rosa + Himmelblau = Lavendel',
      tipSplit: 'Ein Prisma teilt den Strahl', tipSplitTray: 'Zieh das Prisma aus der Ablage',
      tipToggle: 'Tippe einen Stein: alle wechseln'
    }
  };
  var lang = pickLang(navigator.language || 'en');
  function pickLang(tag) {
    var k = String(tag || 'en').slice(0, 2).toLowerCase();
    return STR[k] ? k : 'en';
  }
  function t(key) { var v = STR[lang][key]; return v === undefined ? STR.en[key] : v; }

  // ------------------------------------------------------------------ canvas + state
  var cv = document.getElementById('game');
  var ctx = cv.getContext('2d');
  var W = 1, H = 1, DPR = 1, U = 1;
  var now = 0, lastT = 0, rafId = 0, paused = false, ready = false;
  var screen = 'title';
  var selChapter = 0;
  var G = null;               // current level state
  var LY = {};                // game layout
  var ui = [];                // buttons registered by the last rendered frame
  var pressed = null;         // id of the button under the pointer
  var focusId = null;         // keyboard focus in menus
  var particles = [];
  var floaters = [];
  var toast = null;
  var bgCache = {};
  var boardCache = null;
  var titleLanterns = [];
  var pointer = null;         // active pointer gesture

  function defaultSave() {
    var lv = [];
    for (var i = 0; i < NLV; i++) lv.push([0, 0]);
    return { v: 1, lv: lv, ch: 0, hints: 3, snd: 1, mus: 1, seenTutorial: false, last: 0 };
  }
  var save = defaultSave();

  function applySave(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o.lv)) {
      for (var i = 0; i < NLV; i++) {
        var r = o.lv[i];
        if (Array.isArray(r)) save.lv[i] = [clampInt(r[0], 0, 3), clampInt(r[1], 0, 9999)];
      }
    }
    save.ch = clampInt(o.ch, 0, NCH - 1);
    save.hints = o.hints === undefined ? 3 : clampInt(o.hints, 0, MAX_HINTS);
    save.snd = o.snd === 0 ? 0 : 1;
    save.mus = o.mus === 0 ? 0 : 1;
    save.seenTutorial = !!o.seenTutorial;
    save.last = clampInt(o.last, 0, NLV - 1);
  }
  function clampInt(v, a, b) { v = Math.floor(Number(v) || 0); return v < a ? a : v > b ? b : v; }
  function persist() { PlayablesSDK.save(save); }
  function totalStars() { var s = 0; for (var i = 0; i < NLV; i++) s += save.lv[i][0]; return s; }
  function chapterStars(k) { var s = 0; for (var i = k * PER; i < (k + 1) * PER; i++) s += save.lv[i][0]; return s; }
  function chapterOf(i) { return Math.floor(i / PER); }
  function cleared(i) { return i >= 0 && i < NLV && save.lv[i][0] > 0; }
  function chUnlocked(k) {
    return k === 0 || save.ch >= k || cleared(k * PER - 1) || totalStars() >= CH_STARS[k];
  }
  function lvUnlocked(i) {
    var k = chapterOf(i), j = i % PER;
    if (!chUnlocked(k)) return false;
    return j === 0 || cleared(i - 1) || (j >= 2 && cleared(i - 2));
  }
  function thresholds(par) { return [par + (par >= 6 ? 1 : 0), par + 2 + Math.floor(par / 2)]; }
  function starsFor(m, par) { var th = thresholds(par); return m <= th[0] ? 3 : m <= th[1] ? 2 : 1; }

  // ------------------------------------------------------------------ audio
  var AC = null, master = null, pad = null, sdkAudio = PlayablesSDK.isAudioEnabled(), chordIdx = 0, chordT = 0;
  var CHORDS = [[130.81, 196.0, 329.63, 493.88], [110.0, 164.81, 261.63, 392.0], [87.31, 174.61, 261.63, 329.63], [98.0, 146.83, 246.94, 392.0]];
  function ensureAudio() {
    if (AC) { syncAudio(); return; }
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    try { AC = new Ctor(); } catch (e) { AC = null; return; }
    master = AC.createGain();
    master.gain.value = 0;
    master.connect(AC.destination);
    syncAudio();
  }
  function soundOn() { return !!(sdkAudio && save.snd && !paused); }
  function syncAudio() {
    if (!AC) return;
    var on = soundOn();
    try {
      if (on) {
        if (AC.state === 'suspended') AC.resume();
        master.gain.setTargetAtTime(0.85, AC.currentTime, 0.04);
      } else {
        master.gain.setTargetAtTime(0, AC.currentTime, 0.02);
        if (AC.state === 'running') AC.suspend();
      }
    } catch (e) { /* ignore */ }
    syncPad();
  }
  function syncPad() {
    var want = !!(AC && soundOn() && save.mus);
    if (want && !pad) {
      var g = AC.createGain(), f = AC.createBiquadFilter(), oscs = [];
      f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.4;
      g.gain.value = 0;
      g.gain.setTargetAtTime(0.045, AC.currentTime, 1.5);
      f.connect(g); g.connect(master);
      var ch = CHORDS[chordIdx];
      for (var i = 0; i < 4; i++) {
        var o = AC.createOscillator(), og = AC.createGain();
        o.type = i < 2 ? 'triangle' : 'sine';
        o.frequency.value = ch[i];
        o.detune.value = (i % 2 ? 6 : -6);
        og.gain.value = i < 2 ? 0.5 : 0.28;
        o.connect(og); og.connect(f); o.start();
        oscs.push(o);
      }
      pad = { g: g, oscs: oscs };
    } else if (!want && pad) {
      var p = pad; pad = null;
      try {
        p.g.gain.setTargetAtTime(0, AC.currentTime, 0.1);
        p.oscs.forEach(function (o) { o.stop(AC.currentTime + 0.6); });
      } catch (e) { /* ignore */ }
    }
  }
  function updatePad(dt) {
    if (!pad) return;
    chordT += dt;
    if (chordT > 9) {
      chordT = 0;
      chordIdx = (chordIdx + 1) % CHORDS.length;
      var ch = CHORDS[chordIdx];
      for (var i = 0; i < pad.oscs.length; i++) pad.oscs[i].frequency.setTargetAtTime(ch[i], AC.currentTime, 1.2);
    }
  }
  function tone(f, dur, type, vol, delay, f2) {
    if (!AC || !soundOn()) return;
    try {
      var t0 = AC.currentTime + (delay || 0);
      var o = AC.createOscillator(), g = AC.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f, t0);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) { /* ignore */ }
  }
  function bell(f, vol, delay) {
    tone(f, 1.2, 'sine', vol, delay);
    tone(f * 2.01, 0.55, 'sine', vol * 0.22, delay);
    tone(f * 3.02, 0.25, 'triangle', vol * 0.06, delay);
  }
  var sfx = {
    ui: function () { tone(880, 0.06, 'sine', 0.05); },
    rotate: function () { tone(1500, 0.04, 'triangle', 0.035); tone(760, 0.1, 'sine', 0.07, 0.012); },
    place: function () { tone(240, 0.16, 'sine', 0.15, 0, 170); bell(784, 0.05, 0.02); },
    lift: function () { tone(500, 0.08, 'sine', 0.05, 0, 720); },
    remove: function () { tone(620, 0.15, 'sine', 0.07, 0, 360); },
    toggle: function () { tone(140, 0.25, 'sine', 0.2, 0, 100); tone(290, 0.12, 'triangle', 0.04); },
    nope: function () { tone(230, 0.14, 'triangle', 0.06, 0, 190); },
    lit: function (i) { bell(PENTA[Math.min(i, PENTA.length - 1)], 0.1); },
    hint: function () { [0, 2, 4].forEach(function (n, i) { bell(PENTA[n + 3], 0.05, i * 0.07); }); },
    clear: function () {
      [0, 2, 4, 5, 7, 9].forEach(function (n, i) { bell(PENTA[n] * 0.5, 0.08, i * 0.11); });
      bell(PENTA[4] * 0.5, 0.06, 0.75); bell(PENTA[0] * 0.5, 0.06, 0.75);
    },
    star: function (i) { bell(PENTA[5 + i], 0.08); }
  };

  // ------------------------------------------------------------------ helpers
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
  function easeBack(x) { x = clamp(x, 0, 1); var c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
  function rr(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function block(x, y, w, h, r, fill, shadow, depth) {
    if (shadow) { ctx.fillStyle = shadow; rr(x, y + depth, w, h, r); ctx.fill(); }
    ctx.fillStyle = fill; rr(x, y, w, h, r); ctx.fill();
  }
  function font(size, weight) { return (weight || 700) + ' ' + Math.round(size) + 'px ' + FONT; }
  function text(str, x, y, size, color, align, weight, maxW) {
    var s = size;
    ctx.font = font(s, weight);
    if (maxW) {
      while (s > 9 && ctx.measureText(str).width > maxW) { s -= 1; ctx.font = font(s, weight); }
    }
    ctx.fillStyle = color;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
    return s;
  }
  function starPath(x, y, r) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.48 : r;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
      else ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath();
  }
  function drawStar(x, y, r, on) {
    starPath(x, y + r * 0.12, r);
    ctx.fillStyle = on ? '#E9B85A' : 'rgba(61,59,84,0.18)';
    ctx.fill();
    starPath(x, y, r);
    ctx.fillStyle = on ? C.butter : 'rgba(255,255,255,0.55)';
    ctx.fill();
    if (on) {
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.16, 0, Math.PI * 2); ctx.fill();
    }
  }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  function arcArrow(cx, cy, r, a0, a1, ccw, h) {
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1, ccw); ctx.stroke();
    var tx = cx + Math.cos(a1) * r, ty = cy + Math.sin(a1) * r;
    var dx = ccw ? Math.sin(a1) : -Math.sin(a1), dy = ccw ? -Math.cos(a1) : Math.cos(a1);
    var al = h * 0.42, sp = 0.6;
    ctx.beginPath();
    ctx.moveTo(tx - al * (dx * Math.cos(sp) - dy * Math.sin(sp)), ty - al * (dy * Math.cos(sp) + dx * Math.sin(sp)));
    ctx.lineTo(tx, ty);
    ctx.lineTo(tx - al * (dx * Math.cos(-sp) - dy * Math.sin(-sp)), ty - al * (dy * Math.cos(-sp) + dx * Math.sin(-sp)));
    ctx.stroke();
  }
  // Icons drawn in code. s = icon box size.
  function icon(name, x, y, s, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, s * 0.12); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var h = s / 2;
    switch (name) {
      case 'grid':
        for (var i = 0; i < 4; i++) { rr(-h * 0.8 + (i % 2) * h * 0.9, -h * 0.8 + (i >> 1) * h * 0.9, h * 0.7, h * 0.7, h * 0.18); ctx.fill(); }
        break;
      case 'left': case 'right':
        ctx.beginPath(); var d = name === 'left' ? 1 : -1;
        ctx.moveTo(h * 0.3 * d, -h * 0.6); ctx.lineTo(-h * 0.3 * d, 0); ctx.lineTo(h * 0.3 * d, h * 0.6); ctx.stroke();
        break;
      case 'undo':
        arcArrow(h * 0.1, h * 0.15, h * 0.55, 0.15, -Math.PI - 0.1, true, h);
        break;
      case 'reset':
        arcArrow(0, 0, h * 0.6, -Math.PI * 0.4, Math.PI * 1.25, false, h);
        break;
      case 'hint':
        ctx.beginPath(); ctx.arc(0, -h * 0.2, h * 0.5, Math.PI * 0.8, Math.PI * 2.2); ctx.lineTo(h * 0.22, h * 0.45); ctx.lineTo(-h * 0.22, h * 0.45); ctx.closePath(); ctx.fill();
        rr(-h * 0.22, h * 0.55, h * 0.44, h * 0.22, h * 0.08); ctx.fill();
        break;
      case 'sound': case 'soundOff':
        ctx.beginPath(); ctx.moveTo(-h * 0.75, -h * 0.25); ctx.lineTo(-h * 0.4, -h * 0.25); ctx.lineTo(0, -h * 0.65); ctx.lineTo(0, h * 0.65); ctx.lineTo(-h * 0.4, h * 0.25); ctx.lineTo(-h * 0.75, h * 0.25); ctx.closePath(); ctx.fill();
        if (name === 'sound') {
          ctx.beginPath(); ctx.arc(h * 0.05, 0, h * 0.4, -0.8, 0.8); ctx.stroke();
          ctx.beginPath(); ctx.arc(h * 0.05, 0, h * 0.72, -0.8, 0.8); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.moveTo(h * 0.25, -h * 0.3); ctx.lineTo(h * 0.8, h * 0.3); ctx.moveTo(h * 0.8, -h * 0.3); ctx.lineTo(h * 0.25, h * 0.3); ctx.stroke();
        }
        break;
      case 'music': case 'musicOff':
        ctx.beginPath(); ctx.ellipse(-h * 0.35, h * 0.45, h * 0.3, h * 0.22, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(h * 0.45, h * 0.3, h * 0.3, h * 0.22, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-h * 0.08, h * 0.42); ctx.lineTo(-h * 0.08, -h * 0.6); ctx.lineTo(h * 0.72, -h * 0.78); ctx.lineTo(h * 0.72, h * 0.28); ctx.stroke();
        if (name === 'musicOff') { ctx.beginPath(); ctx.moveTo(-h * 0.85, -h * 0.85); ctx.lineTo(h * 0.85, h * 0.85); ctx.stroke(); }
        break;
      case 'play':
        ctx.beginPath(); ctx.moveTo(-h * 0.4, -h * 0.6); ctx.lineTo(h * 0.6, 0); ctx.lineTo(-h * 0.4, h * 0.6); ctx.closePath(); ctx.fill();
        break;
      case 'lock':
        rr(-h * 0.55, -h * 0.1, h * 1.1, h * 0.85, h * 0.18); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -h * 0.15, h * 0.35, Math.PI, 0); ctx.stroke();
        break;
      case 'star':
        drawStar(0, 0, h * 0.9, true);
        break;
      case 'pause':
        rr(-h * 0.5, -h * 0.6, h * 0.35, h * 1.2, h * 0.12); ctx.fill();
        rr(h * 0.15, -h * 0.6, h * 0.35, h * 1.2, h * 0.12); ctx.fill();
        break;
    }
    ctx.restore();
  }

  // Immediate-mode buttons: drawn every frame and registered for hit testing.
  function button(id, x, y, w, h, opt) {
    opt = opt || {};
    var down = pressed === id;
    var depth = Math.max(3, h * 0.08);
    var r = opt.r !== undefined ? opt.r : Math.min(h * 0.32, 22);
    var yy = down ? y + depth * 0.6 : y;
    var fill = opt.fill || '#FFFFFF', shade = opt.shadow || 'rgba(61,59,84,0.22)';
    if (opt.disabled) { fill = opt.fillOff || 'rgba(255,255,255,0.55)'; }
    block(x, yy, w, h, r, fill, down ? null : shade, depth);
    if (down) { ctx.fillStyle = shade; rr(x, y + h + depth * 0.6 - 2, w, 2, 1); }
    if (focusId === id && keyboardMode) {
      ctx.strokeStyle = C.coral; ctx.lineWidth = 3;
      rr(x - 4, yy - 4, w + 8, h + 8, r + 4); ctx.stroke();
    }
    var col = opt.disabled ? 'rgba(61,59,84,0.35)' : (opt.color || C.ink);
    if (opt.icon && opt.label) {
      var is = h * 0.42;
      ctx.font = font(opt.size || h * 0.36);
      var tw = Math.min(ctx.measureText(opt.label).width, w - is - h * 0.6);
      var x0 = x + w / 2 - (is + h * 0.18 + tw) / 2;
      icon(opt.icon, x0 + is / 2, yy + h / 2, is, col);
      text(opt.label, x0 + is + h * 0.18, yy + h / 2 + 1, opt.size || h * 0.36, col, 'left', 800, w - is - h * 0.6);
    } else if (opt.icon) {
      icon(opt.icon, x + w / 2, yy + h / 2, opt.iconSize || h * 0.46, col);
    } else if (opt.label) {
      text(opt.label, x + w / 2, yy + h / 2 + 1, opt.size || h * 0.38, col, 'center', 800, w - 12);
    }
    ui.push({ id: id, x: x, y: y, w: w, h: h + depth, act: opt.disabled && !opt.tapDisabled ? null : opt.act, disabled: !!opt.disabled, tapDisabled: opt.tapDisabled });
  }
  function hitUI(x, y) {
    for (var i = ui.length - 1; i >= 0; i--) {
      var b = ui[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }
  function uiById(id) { for (var i = 0; i < ui.length; i++) if (ui[i].id === id) return ui[i]; return null; }

  // ------------------------------------------------------------------ backgrounds
  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * DPR)); c.height = Math.max(1, Math.round(h * DPR));
    return c;
  }
  function getBg(k) {
    if (bgCache[k]) return bgCache[k];
    var c = makeCanvas(W, H), g = c.getContext('2d');
    g.scale(DPR, DPR);
    var P = CHAPTERS[k];
    var grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, P.sky[0]); grd.addColorStop(0.42, P.sky[1]); grd.addColorStop(0.72, P.sky[2]); grd.addColorStop(1, P.sky[3]);
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    var m = Math.min(W, H);
    // stars (more at night)
    var nStars = k === 1 ? 70 : k === 0 ? 22 : 6;
    for (var i = 0; i < nStars; i++) {
      var sx = hash(i * 3 + k) * W, sy = hash(i * 7 + 1 + k) * H * 0.55, sr = 0.6 + hash(i * 11) * 1.4;
      g.fillStyle = 'rgba(255,247,238,' + (0.35 + hash(i * 5) * 0.5) + ')';
      g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    }
    // sun / moon
    var bx = k === 2 ? W * 0.2 : W * 0.8, by = k === 1 ? H * 0.16 : H * 0.6, br = m * (k === 1 ? 0.07 : 0.14);
    var glow = g.createRadialGradient(bx, by, br * 0.5, bx, by, br * 3.2);
    glow.addColorStop(0, k === 1 ? 'rgba(255,247,238,0.35)' : 'rgba(255,227,154,0.55)');
    glow.addColorStop(1, 'rgba(255,227,154,0)');
    g.fillStyle = glow; g.fillRect(bx - br * 3.2, by - br * 3.2, br * 6.4, br * 6.4);
    g.fillStyle = k === 1 ? '#FFF4E2' : '#FFE7B0';
    g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
    if (k === 1) { g.fillStyle = P.sky[0]; g.beginPath(); g.arc(bx + br * 0.45, by - br * 0.25, br * 0.9, 0, Math.PI * 2); g.fill(); }
    // hills
    function hills(baseY, amp, col, seed) {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
      for (var x = 0; x <= W + 20; x += 20) {
        var y = baseY + Math.sin(x / (m * 0.35) + seed) * amp + Math.sin(x / (m * 0.13) + seed * 2) * amp * 0.25;
        g.lineTo(x, y);
      }
      g.lineTo(W, H); g.closePath(); g.fill();
    }
    hills(H * 0.8, m * 0.035, P.hill, 1.3);
    hills(H * 0.88, m * 0.03, P.hill2, 4.1);
    // little round shrubs on the far hill
    for (var j = 0; j < 9; j++) {
      var tx = hash(j * 13 + 5) * W, ty = H * 0.8 + Math.sin(tx / (m * 0.35) + 1.3) * m * 0.035;
      var trr = m * (0.018 + hash(j) * 0.02);
      g.fillStyle = P.hill2;
      g.beginPath(); g.arc(tx, ty, trr, 0, Math.PI * 2); g.arc(tx + trr * 0.9, ty + trr * 0.2, trr * 0.75, 0, Math.PI * 2); g.fill();
    }
    bgCache[k] = c;
    return c;
  }
  function drawBg(k) { ctx.drawImage(getBg(k), 0, 0, W, H); }

  // Fireflies drift on every screen.
  var flies = [];
  for (var fi = 0; fi < 14; fi++) flies.push({ x: Math.random(), y: 0.3 + Math.random() * 0.7, p: Math.random() * 6.28, s: 0.5 + Math.random() });
  function drawFlies() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < flies.length; i++) {
      var f = flies[i];
      var x = (f.x + Math.sin(now * 0.1 * f.s + f.p) * 0.05) * W;
      var y = (f.y + Math.cos(now * 0.13 * f.s + f.p) * 0.04) * H;
      var a = 0.25 + 0.25 * Math.sin(now * 1.7 * f.s + f.p);
      var r = U * 1.2;
      var gr = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      gr.addColorStop(0, 'rgba(255,240,180,' + a + ')'); gr.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ piece drawing
  var softGlow = false; // true on bright backgrounds, where additive glow would wash out to white
  function drawLantern(x, y, s, colBit, glowCol, amount, wrong, wobble) {
    var bw = s * 0.5, bh = s * 0.58;
    if (amount > 0.01) {
      var gc = LCOL[glowCol] || LCOL[colBit];
      var rgb = hexRgb(gc);
      var gr = ctx.createRadialGradient(x, y, s * 0.1, x, y, s * (wrong ? 0.7 : 1.15));
      gr.addColorStop(0, 'rgba(' + rgb + ',' + (wrong ? 0.35 : 0.7) * amount + ')');
      gr.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.save(); ctx.globalCompositeOperation = softGlow ? 'source-over' : 'lighter';
      if (softGlow) ctx.globalAlpha = 0.6;
      ctx.fillStyle = gr; ctx.fillRect(x - s * 1.2, y - s * 1.2, s * 2.4, s * 2.4);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(x, y);
    if (wobble) ctx.rotate(Math.sin(now * 2.2 + x) * 0.05 * wobble);
    // string
    ctx.strokeStyle = 'rgba(255,247,238,0.55)'; ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath(); ctx.moveTo(0, -bh * 0.5 - s * 0.12); ctx.lineTo(0, -bh * 0.5); ctx.stroke();
    // body shadow + body
    var lit = amount > 0.5 && !wrong;
    var body = LCOL[colBit];
    ctx.fillStyle = 'rgba(30,28,50,0.25)';
    ctx.beginPath(); ctx.ellipse(0, s * 0.05, bw * 0.5, bh * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.5, bh * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    if (!lit) {
      ctx.fillStyle = 'rgba(120,114,165,' + (0.5 * (1 - Math.min(1, amount * (wrong ? 0.5 : 1)))) + ')';
      ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.5, bh * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,247,238,0.55)'; ctx.lineWidth = Math.max(1, s * 0.025);
      ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.5, bh * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
    } else {
      var inner = ctx.createRadialGradient(0, bh * 0.08, 0, 0, 0, bw * 0.55);
      inner.addColorStop(0, 'rgba(255,252,235,' + (0.95 * amount) + ')');
      inner.addColorStop(1, 'rgba(255,252,235,0)');
      ctx.fillStyle = inner;
      ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.5, bh * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    // ribs
    ctx.strokeStyle = lit ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.28)';
    ctx.lineWidth = Math.max(1, s * 0.022);
    ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.22, bh * 0.48, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -bh * 0.48); ctx.lineTo(0, bh * 0.48); ctx.stroke();
    // caps
    ctx.fillStyle = LDARK[colBit];
    rr(-bw * 0.26, -bh * 0.56, bw * 0.52, bh * 0.14, bh * 0.05); ctx.fill();
    rr(-bw * 0.26, bh * 0.42, bw * 0.52, bh * 0.14, bh * 0.05); ctx.fill();
    // tassel
    ctx.strokeStyle = LDARK[colBit]; ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.beginPath(); ctx.moveTo(0, bh * 0.56); ctx.lineTo(0, bh * 0.7); ctx.stroke();
    if (wrong && amount > 0.2) {
      // a small wavering ring in the wrong colour tells the player "not this light"
      ctx.strokeStyle = 'rgba(' + hexRgb(LCOL[glowCol] || '#FFFFFF') + ',' + (0.6 + 0.3 * Math.sin(now * 6)) + ')';
      ctx.lineWidth = Math.max(1.5, s * 0.04);
      ctx.setLineDash([s * 0.06, s * 0.05]);
      ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
  var rgbCache = {};
  function hexRgb(h) {
    if (rgbCache[h]) return rgbCache[h];
    var n = parseInt(h.slice(1), 16);
    return (rgbCache[h] = ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255));
  }

  function drawMirrorPiece(x, y, s, ang, kind, lift) {
    ctx.save();
    ctx.translate(x, y - (lift || 0));
    // base
    if (kind === 'fix') {
      ctx.fillStyle = 'rgba(30,28,50,0.3)'; ctx.beginPath(); ctx.arc(0, s * 0.05, s * 0.34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4A4770'; ctx.beginPath(); ctx.arc(0, 0, s * 0.34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      for (var i = 0; i < 4; i++) { var a = i * Math.PI / 2 + Math.PI / 4 + ang; ctx.beginPath(); ctx.arc(Math.cos(a + Math.PI / 4) * s * 0.25, Math.sin(a + Math.PI / 4) * s * 0.25, s * 0.03, 0, Math.PI * 2); ctx.fill(); }
    } else if (kind === 'rot') {
      ctx.fillStyle = 'rgba(30,28,50,0.3)'; ctx.beginPath(); ctx.arc(0, s * 0.05, s * 0.36, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8E89C2'; ctx.beginPath(); ctx.arc(0, 0, s * 0.36, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(30,28,50,0.3)'; ctx.beginPath(); ctx.arc(0, s * 0.05 + (lift ? s * 0.08 : 0), s * 0.34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#F2D88A'; ctx.beginPath(); ctx.arc(0, 0, s * 0.34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.butter; ctx.beginPath(); ctx.arc(0, -s * 0.02, s * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    // mirror bar
    ctx.rotate(ang);
    var len = s * 0.9, th = Math.max(4, s * 0.15);
    ctx.fillStyle = 'rgba(30,28,50,0.25)'; rr(-len / 2, -th / 2 + s * 0.04, len, th, th / 2); ctx.fill();
    ctx.fillStyle = '#F6F3FF'; rr(-len / 2, -th / 2, len, th, th / 2); ctx.fill();
    ctx.strokeStyle = C.lavender; ctx.lineWidth = Math.max(1, s * 0.03); rr(-len / 2, -th / 2, len, th, th / 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.beginPath(); ctx.moveTo(-len * 0.36, -th * 0.12); ctx.lineTo(len * 0.1, -th * 0.12); ctx.stroke();
    ctx.restore();
    if (kind === 'rot') {
      // small rotate glyph in the cell corner
      var gx = x + s * 0.33, gy = y - s * 0.33, gr = s * 0.11;
      ctx.fillStyle = 'rgba(255,247,238,0.92)'; ctx.beginPath(); ctx.arc(gx, gy, gr * 1.55, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6E69A6'; ctx.lineWidth = Math.max(1.5, s * 0.035); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(gx, gy, gr * 0.85, -Math.PI * 0.2, Math.PI * 1.25); ctx.stroke();
      var ax = gx + Math.cos(-Math.PI * 0.2) * gr * 0.85, ay = gy + Math.sin(-Math.PI * 0.2) * gr * 0.85;
      ctx.beginPath(); ctx.moveTo(ax - gr * 0.55, ay - gr * 0.25); ctx.lineTo(ax, ay); ctx.lineTo(ax + gr * 0.2, ay - gr * 0.6); ctx.stroke();
    }
  }
  function drawSplitter(x, y, s, kind, lift) {
    ctx.save();
    ctx.translate(x, y - (lift || 0));
    var r = s * 0.32;
    ctx.fillStyle = 'rgba(30,28,50,0.3)';
    ctx.beginPath(); ctx.moveTo(0, -r + s * 0.05); ctx.lineTo(r, s * 0.05); ctx.lineTo(0, r + s * 0.05); ctx.lineTo(-r, s * 0.05); ctx.closePath(); ctx.fill();
    if (kind === 'placed') { ctx.fillStyle = C.butter; ctx.beginPath(); ctx.arc(0, 0, s * 0.36, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#E3FAF1';
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#BDEFDC';
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(-r, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6FC2A3'; ctx.lineWidth = Math.max(1.2, s * 0.03);
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.stroke();
    ctx.restore();
  }
  function drawEmitter(x, y, s, dir, colBit) {
    var ci = colBit === 4 ? 2 : colBit - 1;
    ctx.save(); ctx.translate(x, y);
    var b = s * 0.74;
    block(-b / 2, -b / 2, b, b, b * 0.28, '#FFF1E2', '#D9C5C9', s * 0.06);
    ctx.rotate(dir * Math.PI / 2);
    ctx.fillStyle = '#CDBBD0'; rr(b * 0.12, -b * 0.16, b * 0.42, b * 0.32, b * 0.1); ctx.fill();
    ctx.rotate(-dir * Math.PI / 2);
    var gr = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.5);
    gr.addColorStop(0, BEAM[ci].glow + '0.85)'); gr.addColorStop(1, BEAM[ci].glow + '0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = BEAM[ci].mid; ctx.beginPath(); ctx.arc(0, 0, s * 0.17 * (1 + 0.06 * Math.sin(now * 3)), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = BEAM[ci].core; ctx.beginPath(); ctx.arc(-s * 0.04, -s * 0.04, s * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawStone(x, y, s, raise) {
    // raise: 0 = sunk, 1 = raised
    var b = s * 0.7, depth = s * 0.14 * raise;
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(255,180,162,0.55)'; ctx.lineWidth = Math.max(1.5, s * 0.035);
    ctx.setLineDash([s * 0.08, s * 0.06]);
    rr(-b / 2, -b / 2, b, b, b * 0.3); ctx.stroke();
    ctx.setLineDash([]);
    if (raise > 0.02) {
      var sc = 0.75 + 0.25 * raise;
      var bb = b * sc;
      ctx.globalAlpha = Math.min(1, raise * 1.6);
      block(-bb / 2, -bb / 2 - depth, bb, bb, bb * 0.3, '#FFC4B4', '#E2917F', depth + s * 0.02);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; rr(-bb * 0.3, -bb * 0.36 - depth, bb * 0.6, bb * 0.14, bb * 0.07); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function drawHedge(g, x, y, s, seed) {
    var cols = ['#7FC8AC', '#93D8BD', '#A9E5CD'];
    g.fillStyle = 'rgba(30,28,50,0.28)';
    g.beginPath(); g.ellipse(x, y + s * 0.3, s * 0.42, s * 0.12, 0, 0, Math.PI * 2); g.fill();
    var pts = [[-0.2, 0.08, 0.26], [0.2, 0.1, 0.25], [0, -0.12, 0.28], [-0.05, 0.18, 0.22]];
    for (var k = 0; k < 3; k++) {
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i], off = k === 0 ? s * 0.05 : k === 2 ? -s * 0.04 : 0, rr2 = s * p[2] * (k === 2 ? 0.55 : 1);
        g.fillStyle = cols[k];
        g.beginPath(); g.arc(x + p[0] * s + (k === 2 ? -s * 0.05 : 0), y + p[1] * s + off, rr2, 0, Math.PI * 2); g.fill();
      }
    }
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath(); g.arc(x - s * 0.1 + hash(seed) * s * 0.1, y - s * 0.16, s * 0.04, 0, Math.PI * 2); g.fill();
  }

  // ------------------------------------------------------------------ level state
  function startLevel(idx) {
    var def = LV.levels[idx], sol = LV.solutions[idx];
    var L = E.parse(def);
    G = {
      idx: idx, def: def, L: L, S: E.newState(L), undo: [], moves: 0,
      par: sol.p, sol: E.decodeSolution(sol.s), target: null,
      segs: [], segMap: null, front: 0, lm: null, solved: false, won: false, winT: 0,
      vmask: new Uint8Array(L.n), lantOk: new Uint8Array(L.n), lantA: new Float32Array(L.n),
      rotAnim: {}, placeAnim: {}, togT: -9, togFrom: 0, cursor: { x: 0, y: 0 }, sel: L.trayM ? 'm' : 'x',
      hintFx: null, result: null, startT: now, tip: def.tip || null, nudgeT: -9, nudgeC: -1
    };
    // cursor starts on the first emitter
    if (L.emitters.length) { G.cursor.x = L.emitters[0] % L.w; G.cursor.y = (L.emitters[0] / L.w) | 0; }
    screen = 'game';
    save.last = idx;
    floaters.length = 0;
    focusId = null;
    layoutGame();
    retrace(true);
  }
  function showHand() {
    if (!G || G.won || !G.tip) return false;
    if (G.tip.indexOf('tut') !== 0 && G.tip !== 'tipSplitTray') return false;
    return !save.seenTutorial || !cleared(G.idx);
  }

  function layoutGame() {
    if (!G) return;
    var L = G.L;
    var m = 16, gap = Math.max(8, U * 1.6);
    var hudH = clamp(U * 13, 54, 74);
    var land = W > H * 1.1;
    LY.land = land; LY.m = m; LY.gap = gap;
    LY.hud = { x: m, y: m, w: W - 2 * m, h: hudH };
    var top = m + hudH + gap;
    var area;
    if (land) {
      var sw = clamp(W * 0.22, 150, 280);
      LY.tray = { x: W - m - sw, y: top, w: sw, h: H - m - top };
      area = { x: m, y: top, w: LY.tray.x - gap - m, h: H - m - top };
    } else {
      var th = clamp(H * 0.14, 96, 136);
      LY.tray = { x: m, y: H - m - th, w: W - 2 * m, h: th };
      area = { x: 8, y: top, w: W - 16, h: LY.tray.y - gap - top };
    }
    LY.tipH = G.tip ? clamp(U * 8, 34, 48) : 0;
    if (G.tip) {
      LY.tipBox = { x: area.x, y: area.y, w: area.w, h: LY.tipH };
      area = { x: area.x, y: area.y + LY.tipH + gap * 0.6, w: area.w, h: area.h - LY.tipH - gap * 0.6 };
    }
    var cell = Math.floor(Math.min(area.w / (L.w + 0.3), area.h / (L.h + 0.3)));
    cell = clamp(cell, 20, 110);
    LY.cell = cell;
    LY.pad = Math.round(cell * 0.15);
    LY.bw = cell * L.w; LY.bh = cell * L.h;
    LY.bx = Math.round(area.x + (area.w - LY.bw) / 2);
    LY.by = Math.round(area.y + (area.h - LY.bh) / 2);
    LY.area = area;
    // tray layout: piece stacks + undo/reset
    var tr = LY.tray, kinds = [];
    if (L.trayM) kinds.push('m');
    if (L.trayX) kinds.push('x');
    LY.kinds = kinds;
    LY.stacks = {};
    var pad = Math.max(10, U * 2);
    if (land) {
      var bs = Math.min((tr.w - pad * 3) / 2, 84);
      LY.undoBtn = { x: tr.x + pad, y: tr.y + tr.h - pad - bs, w: (tr.w - pad * 3) / 2, h: bs };
      LY.resetBtn = { x: tr.x + pad * 2 + (tr.w - pad * 3) / 2, y: LY.undoBtn.y, w: LY.undoBtn.w, h: bs };
      var ss = Math.min(tr.w - pad * 2, (LY.undoBtn.y - tr.y - pad * 2 - (kinds.length - 1) * pad) / Math.max(1, kinds.length), 140);
      for (var i = 0; i < kinds.length; i++) {
        LY.stacks[kinds[i]] = { x: tr.x + (tr.w - ss) / 2, y: tr.y + pad + i * (ss + pad), w: ss, h: ss };
      }
    } else {
      var bh = Math.min(tr.h - pad * 2, 64), bw = bh * 1.15;
      LY.resetBtn = { x: tr.x + tr.w - pad - bw, y: tr.y + (tr.h - bh) / 2, w: bw, h: bh };
      LY.undoBtn = { x: LY.resetBtn.x - pad - bw, y: LY.resetBtn.y, w: bw, h: bh };
      var sh = tr.h - pad * 2;
      var sw2 = Math.min(sh * 1.25, (LY.undoBtn.x - tr.x - pad * (kinds.length + 1)) / Math.max(1, kinds.length));
      for (var j = 0; j < kinds.length; j++) {
        LY.stacks[kinds[j]] = { x: tr.x + pad + j * (sw2 + pad), y: tr.y + pad, w: sw2, h: sh };
      }
    }
    boardCache = null;
  }

  function buildBoardCache() {
    var L = G.L, cell = LY.cell, pad = LY.pad;
    var w = LY.bw + pad * 2, h = LY.bh + pad * 2 + cell * 0.12;
    var c = makeCanvas(w, h), g = c.getContext('2d');
    g.scale(DPR, DPR);
    var P = CHAPTERS[chapterOf(G.idx)];
    // board slab with a soft offset shadow block
    g.fillStyle = 'rgba(40,36,70,0.28)';
    roundRectOn(g, 0, cell * 0.12, w, h - cell * 0.12, cell * 0.4); g.fill();
    g.fillStyle = P.edge; roundRectOn(g, 0, 0, w, h - cell * 0.12, cell * 0.4); g.fill();
    g.fillStyle = P.board; roundRectOn(g, cell * 0.04, cell * 0.04, w - cell * 0.08, h - cell * 0.12 - cell * 0.1, cell * 0.36); g.fill();
    for (var y = 0; y < L.h; y++) {
      for (var x = 0; x < L.w; x++) {
        var tx = pad + x * cell, ty = pad + y * cell, c2 = y * L.w + x;
        g.fillStyle = hash(c2 * 1.7 + G.idx) > 0.5 ? P.tile : P.tile2;
        roundRectOn(g, tx + cell * 0.05, ty + cell * 0.05, cell * 0.9, cell * 0.9, cell * 0.22); g.fill();
        // tiny grass tufts on empty tiles
        if (L.type[c2] === T.EMPTY && hash(c2 * 3.1 + G.idx) > 0.72) {
          g.strokeStyle = 'rgba(158,224,197,0.35)'; g.lineWidth = Math.max(1, cell * 0.025); g.lineCap = 'round';
          var gx = tx + cell * (0.25 + hash(c2) * 0.5), gy = ty + cell * (0.3 + hash(c2 + 9) * 0.45);
          g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx - cell * 0.04, gy - cell * 0.08);
          g.moveTo(gx, gy); g.lineTo(gx + cell * 0.01, gy - cell * 0.1);
          g.moveTo(gx, gy); g.lineTo(gx + cell * 0.05, gy - cell * 0.07); g.stroke();
        }
        if (L.type[c2] === T.WALL) drawHedge(g, tx + cell / 2, ty + cell / 2, cell, c2);
      }
    }
    boardCache = { c: c, w: w, h: h };
  }
  function roundRectOn(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function retrace(full) {
    var rec = { segs: [] };
    var lm = E.trace(G.L, G.S, rec);
    var prev = full ? null : G.segMap;
    var map = {};
    var front = Infinity;
    for (var i = 0; i < rec.segs.length; i++) {
      var s = rec.segs[i];
      var k = s.x1 + ',' + s.y1 + ',' + Math.sign(s.x2 - s.x1) + ',' + Math.sign(s.y2 - s.y1) + ',' + s.ci;
      map[k] = s;
      var o = prev && prev[k];
      if (o) {
        var shownLen = Math.max(o.vis, Math.min(o.d1, G.front)) - o.d0;
        s.vis = s.d0 + Math.min(shownLen, s.d1 - s.d0);
      } else s.vis = s.d0;
      if (s.vis < s.d1 && s.vis < front) front = s.vis;
    }
    G.segs = rec.segs; G.segMap = map; G.lm = lm;
    G.front = front === Infinity ? 1e6 : front;
    G.solved = E.solved(G.L, lm);
  }
  function visEnd(s) { return Math.max(s.vis, Math.min(s.d1, G.front)); }

  function targetState() {
    if (!G.target) {
      var S = E.newState(G.L);
      for (var i = 0; i < G.sol.length; i++) E.apply(G.L, S, G.sol[i]);
      G.target = S;
    }
    return G.target;
  }
  function kindOf(p) { return p === E.P_SPLIT ? 'x' : 'm'; }
  // The next step towards the stored optimal solution, from wherever the player is now.
  function nextStep() {
    var L = G.L, S = G.S, Tg = targetState(), i, c;
    for (i = 0; i < G.sol.length; i++) {
      var m = G.sol[i];
      if (m.a !== 'p' && m.a !== 'x') continue;
      var want = Tg.placed[m.c], have = S.placed[m.c];
      if (have === want) continue;
      if (have && have !== E.P_SPLIT && want !== E.P_SPLIT) return { a: 'r', c: m.c };
      if (have) return { a: 'u', c: m.c };
      var kind = kindOf(want), o = want === E.P_BACK ? 1 : 0;
      var avail = kind === 'x' ? L.trayX - S.usedX : L.trayM - S.usedM;
      if (avail > 0) return kind === 'x' ? { a: 'x', c: m.c } : { a: 'p', c: m.c, o: o };
      var from = -1;
      for (c = 0; c < L.n && from < 0; c++) if (S.placed[c] && !Tg.placed[c] && kindOf(S.placed[c]) === kind) from = c;
      for (c = 0; c < L.n && from < 0; c++) if (S.placed[c] && Tg.placed[c] !== S.placed[c] && kindOf(S.placed[c]) === kind) from = c;
      if (from >= 0) return { a: 'mv', c: from, to: m.c, o: o };
    }
    for (i = 0; i < L.rots.length; i++) { c = L.rots[i]; if (S.rot[c] !== Tg.rot[c]) return { a: 'r', c: c }; }
    if (S.tog !== Tg.tog) return { a: 't', c: L.toggles[0] };
    for (c = 0; c < L.n; c++) if (S.placed[c] && !Tg.placed[c]) return { a: 'u', c: c };
    return null;
  }

  // ------------------------------------------------------------------ moves
  function snapshot() { return { S: E.cloneState(G.S), moves: G.moves }; }
  function doMove(mv, cost) {
    if (!G || G.won) return false;
    var snap = snapshot();
    if (!E.apply(G.L, G.S, mv)) { sfx.nope(); return false; }
    G.undo.push(snap);
    G.moves += cost || 1;
    if (mv.a === 'r') { G.rotAnim[mv.c] = now; sfx.rotate(); puff(mv.c, 4, '#F6F3FF'); }
    else if (mv.a === 'p' || mv.a === 'x') { G.placeAnim[mv.c] = now; sfx.place(); puff(mv.c, 7, C.butter); }
    else if (mv.a === 'mv') { G.placeAnim[mv.to] = now; sfx.place(); puff(mv.to, 6, C.butter); }
    else if (mv.a === 'u') { sfx.remove(); puff(mv.c, 5, C.lavender); }
    else if (mv.a === 't') { G.togT = now; sfx.toggle(); for (var i = 0; i < G.L.toggles.length; i++) puff(G.L.toggles[i], 4, C.peach); }
    G.hintFx = G.hintFx && now - G.hintFx.t < 0.3 ? G.hintFx : null;
    retrace(false);
    return true;
  }
  function undo() {
    if (!G || G.won || !G.undo.length) return;
    var s = G.undo.pop();
    var togChanged = s.S.tog !== G.S.tog;
    G.S = s.S; G.moves = s.moves;
    if (togChanged) G.togT = now;
    sfx.remove();
    retrace(false);
  }
  function resetLevel() {
    if (!G || G.won) return;
    var fresh = E.newState(G.L);
    if (E.stateKey(G.L, fresh) === E.stateKey(G.L, G.S) && G.moves === 0) return;
    G.undo.push(snapshot());
    if (fresh.tog !== G.S.tog) G.togT = now;
    G.S = fresh; G.moves = 0;
    sfx.remove();
    retrace(false);
  }
  function useHint() {
    if (!G || G.won) return;
    if (save.hints <= 0) { showToast(t('noHints')); sfx.nope(); return; }
    var st = nextStep();
    if (!st) return;
    var snap = snapshot(), L = G.L, S = G.S, cost = 1, fx = st.c;
    if (st.a === 'p') { E.apply(L, S, { a: 'p', c: st.c, o: st.o }); cost = st.o ? 2 : 1; G.placeAnim[st.c] = now; }
    else if (st.a === 'x') { E.apply(L, S, st); G.placeAnim[st.c] = now; }
    else if (st.a === 'mv') {
      E.apply(L, S, { a: 'mv', c: st.c, to: st.to });
      var want = st.o ? E.P_BACK : E.P_SLASH;
      if (S.placed[st.to] !== E.P_SPLIT && S.placed[st.to] !== want) { S.placed[st.to] = want; cost = 2; }
      fx = st.to; G.placeAnim[st.to] = now;
    } else if (st.a === 'r') { E.apply(L, S, st); G.rotAnim[st.c] = now; }
    else if (st.a === 't') { E.apply(L, S, st); G.togT = now; }
    else if (st.a === 'u') { E.apply(L, S, st); }
    G.undo.push(snap);
    G.moves += cost;
    save.hints--;
    persist();
    G.hintFx = { c: fx, t: now };
    sfx.hint();
    puff(fx, 10, C.butter);
    retrace(false);
  }

  function win() {
    G.won = true; G.winT = 0; pointer = null;
    var stars = starsFor(G.moves, G.par);
    var rec = save.lv[G.idx];
    var before = totalStars();
    var prevBest = rec[1];
    if (stars > rec[0]) rec[0] = stars;
    if (!rec[1] || G.moves < rec[1]) rec[1] = G.moves;
    save.hints = Math.min(MAX_HINTS, save.hints + 1);
    if (G.idx >= 2) save.seenTutorial = true;
    for (var k = 1; k < NCH; k++) if (chUnlocked(k) && save.ch < k) save.ch = k;
    G.result = { stars: stars, newBest: !!prevBest && G.moves < prevBest, best: rec[1] };
    persist();
    var after = totalStars();
    if (after > before) PlayablesSDK.sendScore(after);
    sfx.clear();
    var L = G.L;
    for (var i = 0; i < L.lanterns.length; i++) {
      var c = L.lanterns[i];
      var p = cellCenter(c);
      floaters.push({ x: p.x, y: p.y, vy: -(U * 9 + Math.random() * U * 5), ph: Math.random() * 6, col: L.col[c], s: LY.cell * 0.9, t: 0, delay: i * 0.12 });
    }
    for (var j = 0; j < 10; j++) {
      floaters.push({ x: Math.random() * W, y: H + U * 10 + Math.random() * H * 0.3, vy: -(U * 10 + Math.random() * U * 8), ph: Math.random() * 6,
        col: [1, 2, 3, 4][j % 4], s: U * (6 + Math.random() * 5), t: 0, delay: 0.2 + Math.random() * 0.8 });
    }
  }
  function goNext() {
    if (G.idx + 1 < NLV && lvUnlocked(G.idx + 1)) startLevel(G.idx + 1);
    else { selChapter = chapterOf(Math.min(NLV - 1, G.idx + 1)); goSelect(); }
  }
  function goSelect() { screen = 'select'; focusId = null; G = null; persist(); }

  // ------------------------------------------------------------------ particles
  function cellCenter(c) {
    var x = c % G.L.w, y = (c / G.L.w) | 0;
    return { x: LY.bx + (x + 0.5) * LY.cell, y: LY.by + (y + 0.5) * LY.cell };
  }
  function puff(c, n, col) {
    if (!G) return;
    var p = cellCenter(c);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = LY.cell * (0.8 + Math.random() * 1.2);
      particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.3, t: 0, r: LY.cell * (0.04 + Math.random() * 0.05), col: col });
    }
  }
  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
      if (p.t >= p.life) particles.splice(i, 1);
    }
    for (var j = floaters.length - 1; j >= 0; j--) {
      var f = floaters[j];
      f.t += dt;
      if (f.t < f.delay) continue;
      f.y += f.vy * dt;
      f.vy *= 1 + dt * 0.4;
      if (f.y < -f.s * 2) floaters.splice(j, 1);
    }
  }
  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i], a = 1 - p.t / p.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + a * 0.4), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawFloaters() {
    for (var i = 0; i < floaters.length; i++) {
      var f = floaters[i];
      if (f.t < f.delay) continue;
      var x = f.x + Math.sin(now * 1.3 + f.ph) * f.s * 0.25;
      drawLantern(x, f.y, f.s, f.col, f.col, 1, false, 1);
    }
  }
  function showToast(s) { toast = { s: s, t: now }; }

  // ------------------------------------------------------------------ update
  function update(dt) {
    if (screen === 'game' && G) updateGame(dt);
    updateParticles(dt);
    updatePad(dt);
    if (screen === 'title') updateTitleLanterns(dt);
  }
  function updateGame(dt) {
    var L = G.L;
    G.front += dt * BEAM_SPEED;
    var vm = G.vmask, i, c;
    for (i = 0; i < L.lanterns.length; i++) vm[L.lanterns[i]] = 0;
    for (i = 0; i < G.segs.length; i++) {
      var s = G.segs[i], ve = visEnd(s);
      if (ve <= s.d0) continue;
      for (var j = 0; j < L.lanterns.length; j++) {
        c = L.lanterns[j];
        var lx = c % L.w + 0.5, ly = ((c / L.w) | 0) + 0.5;
        var onX = s.x1 === s.x2 && s.x1 === lx && ly >= Math.min(s.y1, s.y2) && ly <= Math.max(s.y1, s.y2);
        var onY = s.y1 === s.y2 && s.y1 === ly && lx >= Math.min(s.x1, s.x2) && lx <= Math.max(s.x1, s.x2);
        if (!onX && !onY) continue;
        var dd = s.d0 + Math.abs(lx - s.x1) + Math.abs(ly - s.y1);
        if (ve >= dd - 0.05) vm[c] |= 1 << s.ci;
      }
    }
    var allOk = true, okCount = 0;
    for (i = 0; i < L.lanterns.length; i++) {
      c = L.lanterns[i];
      var ok = vm[c] === L.col[c];
      if (ok) okCount++;
      if (ok && !G.lantOk[c]) { G.lantOk[c] = 1; sfx.lit(okCount - 1); puff(c, 8, LCOL[L.col[c]]); }
      else if (!ok) G.lantOk[c] = 0;
      if (!ok) allOk = false;
      var tgt = vm[c] ? 1 : 0;
      G.lantA[c] += (tgt - G.lantA[c]) * Math.min(1, dt * 6);
    }
    if (!G.won && G.solved && allOk) win();
    if (G.won) {
      var prevT = G.winT;
      G.winT += dt;
      for (var k = 0; k < 3; k++) {
        var at = 1.15 + k * 0.28;
        if (prevT < at && G.winT >= at && k < G.result.stars) sfx.star(k);
      }
    }
  }

  // ------------------------------------------------------------------ title screen
  function updateTitleLanterns(dt) {
    while (titleLanterns.length < 9) {
      titleLanterns.push({ x: Math.random(), y: 1.05 + Math.random() * 0.6, v: 0.025 + Math.random() * 0.03, s: 0.5 + Math.random() * 0.7, ph: Math.random() * 6, col: [4, 4, 1, 2, 3][Math.floor(Math.random() * 5)] });
    }
    for (var i = titleLanterns.length - 1; i >= 0; i--) {
      var l = titleLanterns[i];
      l.y -= l.v * dt;
      if (l.y < -0.1) titleLanterns.splice(i, 1);
    }
  }
  function drawTitle() {
    drawBg(0);
    softGlow = true;
    var m = Math.min(W, H);
    for (var i = 0; i < titleLanterns.length; i++) {
      var l = titleLanterns[i];
      drawLantern(l.x * W + Math.sin(now * 0.8 + l.ph) * m * 0.02, l.y * H, m * 0.07 * l.s, l.col, l.col, 0.9, false, 1);
    }
    drawFlies();
    var land = W > H * 1.1;
    var cx = W / 2;
    var titleY = land ? H * 0.24 : H * 0.25;
    var ts = clamp(m * (land ? 0.13 : 0.15), 34, 96);
    // decorative beam linking three lanterns under the title
    var chainY = titleY + ts * 1.25, span = Math.min(W * 0.7, ts * 6.2);
    var pts = [[cx - span / 2, chainY + ts * 0.2], [cx - span / 6, chainY - ts * 0.15], [cx + span / 6, chainY + ts * 0.25], [cx + span / 2, chainY - ts * 0.1]];
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var prog = (now * 0.35) % 1;
    ctx.strokeStyle = 'rgba(255,227,154,0.45)'; ctx.lineWidth = ts * 0.24;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var p = 1; p < 4; p++) ctx.lineTo(pts[p][0], pts[p][1]); ctx.stroke();
    ctx.strokeStyle = '#FFE7A8'; ctx.lineWidth = ts * 0.09;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (p = 1; p < 4; p++) ctx.lineTo(pts[p][0], pts[p][1]); ctx.stroke();
    ctx.strokeStyle = '#FFFDF4'; ctx.lineWidth = ts * 0.03;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (p = 1; p < 4; p++) ctx.lineTo(pts[p][0], pts[p][1]); ctx.stroke();
    // a travelling sparkle along the chain
    var segI = Math.floor(prog * 3), f = prog * 3 - segI;
    var sx = pts[segI][0] + (pts[segI + 1][0] - pts[segI][0]) * f, sy = pts[segI][1] + (pts[segI + 1][1] - pts[segI][1]) * f;
    var sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, ts * 0.4);
    sg.addColorStop(0, 'rgba(255,255,240,0.9)'); sg.addColorStop(1, 'rgba(255,255,240,0)');
    ctx.fillStyle = sg; ctx.fillRect(sx - ts * 0.4, sy - ts * 0.4, ts * 0.8, ts * 0.8);
    ctx.restore();
    var cols = [4, 1, 3, 2];
    for (p = 0; p < 4; p++) drawLantern(pts[p][0], pts[p][1], ts * 0.95, cols[p], cols[p], 1, false, 1);
    // title text with a soft offset block shadow
    ctx.font = font(ts, 900);
    var title = 'Lantern Links';
    var tw = ctx.measureText(title).width;
    var tsz = tw > W - 40 ? ts * (W - 40) / tw : ts;
    text(title, cx, titleY + tsz * 0.08, tsz, 'rgba(61,59,84,0.25)', 'center', 900);
    text(title, cx, titleY, tsz, '#FFF7EE', 'center', 900);
    ctx.save(); ctx.globalAlpha = 0.85;
    ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(2, tsz * 0.05); ctx.lineJoin = 'round';
    ctx.font = font(tsz, 900); ctx.strokeText(title, cx, titleY);
    ctx.restore();
    text(title, cx, titleY, tsz, '#FFF7EE', 'center', 900);
    softGlow = false;
    text(t('tagline'), cx, titleY - tsz * 0.95, clamp(m * 0.04, 14, 24), C.ink, 'center', 700, W - 40);
    // play button
    var bw = clamp(m * 0.5, 180, 300), bh = clamp(m * 0.13, 56, 78);
    var by = land ? H * 0.62 : H * 0.6;
    button('play', cx - bw / 2, by, bw, bh, { label: t('play'), icon: 'play', fill: C.butter, shadow: '#E3B85E', size: bh * 0.42, act: onPlay });
    // stars + settings row
    var sb = clamp(m * 0.11, 48, 60);
    var rowY = by + bh + sb * 0.55;
    button('snd', cx - sb - 8, rowY, sb, sb, { icon: save.snd ? 'sound' : 'soundOff', fill: '#FFFFFF', act: toggleSound });
    button('mus', cx + 8, rowY, sb, sb, { icon: save.mus ? 'music' : 'musicOff', fill: '#FFFFFF', act: toggleMusic });
    var tot = totalStars();
    if (tot > 0) {
      var sy2 = rowY + sb * 1.6;
      var lbl = tot + ' / ' + NLV * 3;
      ctx.font = font(clamp(m * 0.045, 15, 22));
      var lw = ctx.measureText(lbl).width + m * 0.08;
      block(cx - lw / 2 - 10, sy2 - m * 0.035, lw + 20, m * 0.07, m * 0.035, 'rgba(255,247,238,0.75)', null, 0);
      drawStar(cx - lw / 2 + m * 0.02, sy2, m * 0.022, true);
      text(lbl, cx + m * 0.02, sy2 + 1, clamp(m * 0.045, 15, 22), C.ink, 'center', 800);
    }
  }
  function onPlay() {
    if (!save.seenTutorial) {
      var i = 0;
      while (i < 2 && cleared(i)) i++;
      startLevel(i);
    } else {
      selChapter = chapterOf(save.last);
      goSelect();
    }
  }
  function toggleSound() { save.snd = save.snd ? 0 : 1; ensureAudio(); syncAudio(); persist(); sfx.ui(); }
  function toggleMusic() { save.mus = save.mus ? 0 : 1; ensureAudio(); syncAudio(); persist(); sfx.ui(); }

  // ------------------------------------------------------------------ level select
  function drawSelect() {
    var k = selChapter;
    drawBg(k);
    drawFlies();
    var m = 16, hb = clamp(U * 13, 52, 72);
    var light = k === 1, tc = light ? '#FFF7EE' : C.ink;
    button('back', m, m, hb, hb, { icon: 'left', act: function () { screen = 'title'; focusId = null; } });
    var ts = clamp(U * 7, 22, 40);
    text(t('chapters')[k], W / 2, m + hb * 0.38, ts, tc, 'center', 900, W - 2 * (m + hb + 12));
    var lbl = chapterStars(k) + ' / ' + PER * 3, ss = ts * 0.5;
    ctx.font = font(ss, 800);
    var lw = ctx.measureText(lbl).width;
    drawStar(W / 2 - (lw + ss * 1.3) / 2 + ss * 0.5, m + hb * 0.86, ss * 0.55, true);
    text(lbl, W / 2 - (lw + ss * 1.3) / 2 + ss * 1.3, m + hb * 0.87, ss, tc, 'left', 800);
    // chapter switcher at the bottom: [<]  o o o  [>]
    var aw = 48, ay = H - m - aw;
    button('chPrev', W / 2 - 50 - aw, ay, aw, aw, { icon: 'left', disabled: k === 0, act: function () { selChapter = Math.max(0, selChapter - 1); } });
    button('chNext', W / 2 + 50, ay, aw, aw, { icon: 'right', disabled: k === NCH - 1, act: function () { selChapter = Math.min(NCH - 1, selChapter + 1); } });
    for (var d = 0; d < NCH; d++) {
      ctx.fillStyle = d === k ? tc : light ? 'rgba(255,247,238,0.45)' : 'rgba(61,59,84,0.3)';
      ctx.beginPath(); ctx.arc(W / 2 + (d - 1) * 18, ay + aw / 2, d === k ? 6 : 4.5, 0, Math.PI * 2); ctx.fill();
    }
    var unlocked = chUnlocked(k);
    var land = W > H * 1.1;
    var cols = land ? 5 : (W < 340 ? 2 : 3);
    var rows = Math.ceil(PER / cols);
    var top = m + hb + 20, bottom = ay - 16;
    var availW = W - 2 * m, availH = bottom - top;
    var g = Math.max(10, U * 2.4);
    var bs = Math.min((availW - g * (cols - 1)) / cols, (availH - g * (rows - 1)) / rows, 128);
    var gw = cols * bs + (cols - 1) * g, gh = rows * bs + (rows - 1) * g;
    var x0 = (W - gw) / 2, y0 = top + (availH - gh) / 2;
    for (var j = 0; j < PER; j++) {
      var idx = k * PER + j;
      var r = Math.floor(j / cols), cc = j % cols;
      var inRow = Math.min(cols, PER - r * cols);
      var bx = x0 + cc * (bs + g) + (cols - inRow) * (bs + g) / 2, by = y0 + r * (bs + g);
      levelButton(idx, bx, by, bs, unlocked);
    }
    if (!unlocked) {
      var msg = t('locked').replace('{c}', t('chapters')[k - 1]).replace('{n}', CH_STARS[k] + ' ★');
      var fs = clamp(U * 4.4, 15, 22);
      ctx.font = font(fs);
      var mw = Math.min(W - 40, ctx.measureText(msg).width + fs * 3.2);
      var my = y0 + gh / 2 - fs * 1.6;
      block(W / 2 - mw / 2, my, mw, fs * 3.2, fs * 0.9, '#FFF7EE', 'rgba(61,59,84,0.25)', 5);
      icon('lock', W / 2 - mw / 2 + fs * 1.3, my + fs * 1.6, fs * 1.3, C.coral);
      text(msg, W / 2 + fs * 0.7, my + fs * 1.6, fs, C.ink, 'center', 800, mw - fs * 3);
    }
  }
  function levelButton(idx, x, y, s, chOpen) {
    var open = chOpen && lvUnlocked(idx);
    var rec = save.lv[idx];
    var isNext = open && !rec[0];
    button('lv' + idx, x, y, s, s * 0.92, {
      fill: open ? (isNext ? C.butter : '#FFF7EE') : 'rgba(255,247,238,0.45)',
      shadow: open ? (isNext ? '#E3B85E' : 'rgba(61,59,84,0.25)') : 'rgba(61,59,84,0.12)',
      r: s * 0.24, disabled: !open,
      act: function () { startLevel(idx); }
    });
    var yy = (pressed === 'lv' + idx ? Math.max(3, s * 0.92 * 0.08) * 0.6 : 0) + y;
    if (open) {
      text(String(idx % PER + 1), x + s / 2, yy + s * 0.36, s * 0.34, C.ink, 'center', 900);
      for (var i = 0; i < 3; i++) drawStar(x + s / 2 + (i - 1) * s * 0.22, yy + s * 0.68, s * 0.085, i < rec[0]);
    } else {
      icon('lock', x + s / 2, yy + s * 0.44, s * 0.3, 'rgba(61,59,84,0.4)');
    }
  }

  // ------------------------------------------------------------------ game drawing
  function drawGame() {
    var L = G.L, cell = LY.cell, k = chapterOf(G.idx);
    drawBg(k);
    drawFlies();
    if (!boardCache) buildBoardCache();
    ctx.drawImage(boardCache.c, LY.bx - LY.pad, LY.by - LY.pad, boardCache.w, boardCache.h);
    var i, c, x, y, cx, cy;
    // beam glow under the pieces
    drawBeams(0);
    // stones, mirrors, splitters
    var togE = ease((now - G.togT) / 0.35);
    var drag = pointer && pointer.mode === 'drag' ? pointer : null;
    for (c = 0; c < L.n; c++) {
      x = c % L.w; y = (c / L.w) | 0;
      cx = LY.bx + (x + 0.5) * cell; cy = LY.by + (y + 0.5) * cell;
      var tp = L.type[c];
      if (tp === T.TOG) {
        var up = L.phase[c] === G.S.tog ? 1 : 0;
        drawStone(cx, cy, cell, up ? togE : 1 - togE);
      } else if (tp === T.FIX) {
        drawMirrorPiece(cx, cy, cell, L.ori[c] ? Math.PI / 4 : Math.PI * 3 / 4, 'fix');
      } else if (tp === T.ROT) {
        drawMirrorPiece(cx, cy, cell, mirrorAngle(c, G.S.rot[c]), 'rot');
      } else if (tp === T.SPLIT) {
        drawSplitter(cx, cy, cell, 'fix');
      } else if (tp === T.EMPTY && G.S.placed[c] && !(drag && drag.fromCell === c)) {
        var pa = G.placeAnim[c] !== undefined ? easeBack((now - G.placeAnim[c]) / 0.3) : 1;
        ctx.save(); ctx.translate(cx, cy); ctx.scale(pa, pa); ctx.translate(-cx, -cy);
        if (G.S.placed[c] === E.P_SPLIT) drawSplitter(cx, cy, cell, 'placed');
        else drawMirrorPiece(cx, cy, cell, mirrorAngle(c, G.S.placed[c] === E.P_BACK ? 1 : 0), 'placed');
        ctx.restore();
      }
    }
    drawBeams(1);
    for (i = 0; i < L.emitters.length; i++) {
      c = L.emitters[i];
      var pc = cellCenter(c);
      drawEmitter(pc.x, pc.y, cell, L.dir[c], L.col[c]);
    }
    for (i = 0; i < L.lanterns.length; i++) {
      c = L.lanterns[i];
      var p2 = cellCenter(c);
      var vm = G.vmask[c], wrong = vm !== 0 && vm !== L.col[c];
      var bob = G.won ? -ease((G.winT - 0.2) / 1.2) * cell * 0.15 : 0;
      drawLantern(p2.x, p2.y + bob, cell, L.col[c], vm || L.col[c], G.lantA[c], wrong, vm ? 1 : 0.3);
    }
    // cursor (keyboard)
    if (keyboardMode && !G.won) {
      var pulse = 0.5 + 0.5 * Math.sin(now * 5);
      ctx.strokeStyle = 'rgba(255,227,154,' + (0.6 + 0.4 * pulse) + ')'; ctx.lineWidth = Math.max(2, cell * 0.06);
      rr(LY.bx + G.cursor.x * cell + cell * 0.06, LY.by + G.cursor.y * cell + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.22); ctx.stroke();
    }
    // hint highlight
    if (G.hintFx && now - G.hintFx.t < 1.6) {
      var hp = cellCenter(G.hintFx.c), ht = (now - G.hintFx.t) / 1.6;
      ctx.strokeStyle = 'rgba(255,227,154,' + (1 - ht) + ')'; ctx.lineWidth = Math.max(2, cell * 0.08);
      ctx.beginPath(); ctx.arc(hp.x, hp.y, cell * (0.45 + ht * 0.4), 0, Math.PI * 2); ctx.stroke();
    }
    // drop target + dragged piece
    if (drag) {
      var tc = dropCell(drag);
      if (tc >= 0) {
        var tx = tc % L.w, ty = (tc / L.w) | 0;
        ctx.fillStyle = 'rgba(255,227,154,0.3)';
        rr(LY.bx + tx * cell + cell * 0.06, LY.by + ty * cell + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.22); ctx.fill();
      }
      var gp = ghostPos(drag);
      if (drag.kind === 'x') drawSplitter(gp.x, gp.y, cell * 1.08, 'placed', cell * 0.05);
      else drawMirrorPiece(gp.x, gp.y, cell * 1.08, drag.o ? Math.PI / 4 : Math.PI * 3 / 4, 'placed', cell * 0.05);
    }
    drawParticles();
    drawHud();
    drawTray();
    if (G.tip && !G.won) drawTip();
    if (showHand()) drawHand();
    if (G.won) drawClear();
  }
  function mirrorAngle(c, o) {
    var target = o ? Math.PI / 4 : Math.PI * 3 / 4;
    var st = G.rotAnim[c];
    if (st === undefined) return target;
    return target - (1 - easeBack((now - st) / 0.28)) * Math.PI / 2;
  }
  function drawBeams(pass) {
    var segs = G.segs, cell = LY.cell, bx = LY.bx, by = LY.by;
    if (!segs.length) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var shimmer = 1 + 0.08 * Math.sin(now * 2.4);
    for (var ci = 0; ci < 3; ci++) {
      var any = false;
      ctx.beginPath();
      for (var i = 0; i < segs.length; i++) {
        var s = segs[i];
        if (s.ci !== ci) continue;
        var ve = visEnd(s);
        if (ve <= s.d0) continue;
        var f = (ve - s.d0) / (s.d1 - s.d0);
        ctx.moveTo(bx + s.x1 * cell, by + s.y1 * cell);
        ctx.lineTo(bx + (s.x1 + (s.x2 - s.x1) * f) * cell, by + (s.y1 + (s.y2 - s.y1) * f) * cell);
        any = true;
      }
      if (!any) continue;
      if (pass === 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = BEAM[ci].glow + '0.22)'; ctx.lineWidth = cell * 0.42 * shimmer; ctx.stroke();
        ctx.strokeStyle = BEAM[ci].glow + '0.35)'; ctx.lineWidth = cell * 0.2; ctx.stroke();
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = BEAM[ci].mid; ctx.lineWidth = Math.max(2, cell * 0.1); ctx.stroke();
        ctx.strokeStyle = BEAM[ci].core; ctx.lineWidth = Math.max(1, cell * 0.04); ctx.stroke();
      }
    }
    // sparkle at growing beam tips
    if (pass === 1) {
      ctx.globalCompositeOperation = 'lighter';
      for (var j = 0; j < segs.length; j++) {
        var s2 = segs[j];
        if (G.front <= s2.vis || G.front >= s2.d1) continue;
        var f2 = (G.front - s2.d0) / (s2.d1 - s2.d0);
        var px = bx + (s2.x1 + (s2.x2 - s2.x1) * f2) * cell, py = by + (s2.y1 + (s2.y2 - s2.y1) * f2) * cell;
        var gr = ctx.createRadialGradient(px, py, 0, px, py, cell * 0.35);
        gr.addColorStop(0, 'rgba(255,255,245,0.9)'); gr.addColorStop(1, 'rgba(255,255,245,0)');
        ctx.fillStyle = gr; ctx.fillRect(px - cell * 0.35, py - cell * 0.35, cell * 0.7, cell * 0.7);
      }
    }
    ctx.restore();
  }
  function drawHud() {
    var h = LY.hud, k = chapterOf(G.idx);
    var light = k === 1;
    button('menu', h.x, h.y, h.h, h.h, { icon: 'grid', act: goSelect });
    var hw = h.h * 1.45;
    button('hint', h.x + h.w - hw, h.y, hw, h.h, { icon: 'hint', fill: save.hints > 0 ? C.butter : '#FFFFFF', shadow: save.hints > 0 ? '#E3B85E' : null,
      disabled: G.won, act: useHint });
    var hb = uiById('hint');
    if (hb) {
      var bx = h.x + h.w - h.h * 0.32, by = h.y + h.h * 0.22;
      ctx.fillStyle = save.hints > 0 ? C.coral : C.inkSoft;
      ctx.beginPath(); ctx.arc(bx, by, h.h * 0.19, 0, Math.PI * 2); ctx.fill();
      text(String(save.hints), bx, by + 1, h.h * 0.24, '#FFFFFF', 'center', 900);
    }
    // centre: level name, moves, star goal
    var cx = W / 2, tc = light ? '#FFF7EE' : C.ink;
    var maxW = h.w - h.h - hw - 24;
    var name = t('chapters')[k] + ' · ' + (G.idx % PER + 1);
    text(name, cx, h.y + h.h * 0.3, clamp(h.h * 0.36, 16, 26), tc, 'center', 900, maxW);
    var th = thresholds(G.par);
    var ms = clamp(h.h * 0.27, 13, 19);
    var line = t('moves') + ' ' + G.moves;
    ctx.font = font(ms, 800);
    var lw = ctx.measureText(line).width;
    var goal = '≤' + th[0];
    var gw = ctx.measureText(goal).width + ms * 1.2;
    var total = lw + ms * 0.9 + gw;
    var x0 = cx - total / 2, ly = h.y + h.h * 0.74;
    block(x0 - ms * 0.6, ly - ms * 0.78, total + ms * 1.2, ms * 1.56, ms * 0.78, light ? 'rgba(255,247,238,0.16)' : 'rgba(255,247,238,0.55)', null, 0);
    text(line, x0, ly + 1, ms, tc, 'left', 800);
    var stars = starsFor(G.moves, G.par);
    drawStar(x0 + lw + ms * 0.9 + ms * 0.45, ly, ms * 0.5, stars >= 3);
    text(goal, x0 + lw + ms * 0.9 + ms * 1.05, ly + 1, ms, tc, 'left', 800);
  }
  function drawTray() {
    var tr = LY.tray, L = G.L;
    block(tr.x, tr.y, tr.w, tr.h, Math.min(24, tr.h * 0.22), 'rgba(255,247,238,0.82)', 'rgba(61,59,84,0.18)', 5);
    for (var i = 0; i < LY.kinds.length; i++) {
      var kd = LY.kinds[i], r = LY.stacks[kd];
      var left = kd === 'm' ? L.trayM - G.S.usedM : L.trayX - G.S.usedX;
      var sel = G.sel === kd && LY.kinds.length > 1;
      block(r.x, r.y, r.w, r.h, r.h * 0.22, left ? '#FFFFFF' : 'rgba(255,255,255,0.5)', 'rgba(61,59,84,0.16)', 4);
      if (sel) { ctx.strokeStyle = C.peach; ctx.lineWidth = 3; rr(r.x - 2, r.y - 2, r.w + 4, r.h + 4, r.h * 0.24); ctx.stroke(); }
      var ps = Math.min(r.w, r.h) * 0.7;
      var cx = r.x + r.w / 2, cy = r.y + r.h * 0.46;
      ctx.globalAlpha = left ? 1 : 0.35;
      if (left > 1) {
        if (kd === 'x') drawSplitter(cx + ps * 0.08, cy - ps * 0.06, ps, 'placed');
        else drawMirrorPiece(cx + ps * 0.08, cy - ps * 0.06, ps, Math.PI * 3 / 4, 'placed');
      }
      if (kd === 'x') drawSplitter(cx, cy, ps, 'placed');
      else drawMirrorPiece(cx, cy, ps, Math.PI * 3 / 4, 'placed');
      ctx.globalAlpha = 1;
      var bs = Math.max(20, Math.min(r.w, r.h) * 0.26);
      ctx.fillStyle = left ? C.ink : C.inkSoft;
      rr(r.x + r.w - bs * 1.5, r.y + r.h - bs * 1.15, bs * 1.3, bs * 0.95, bs * 0.45); ctx.fill();
      text('×' + left, r.x + r.w - bs * 0.85, r.y + r.h - bs * 0.66, bs * 0.62, '#FFF7EE', 'center', 900);
    }
    if (!LY.kinds.length) {
      var cxx = LY.land ? tr.x + tr.w / 2 : (tr.x + LY.undoBtn.x) / 2;
      var cyy = LY.land ? tr.y + (LY.undoBtn.y - tr.y) / 2 : tr.y + tr.h / 2;
      ctx.strokeStyle = 'rgba(138,135,166,0.4)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      var es = Math.min(tr.h, tr.w) * 0.42;
      rr(cxx - es / 2, cyy - es / 2, es, es, es * 0.25); ctx.stroke(); ctx.setLineDash([]);
    }
    var u = LY.undoBtn, rs = LY.resetBtn;
    button('undo', u.x, u.y, u.w, u.h, { icon: 'undo', disabled: !G.undo.length || G.won, act: undo });
    button('reset', rs.x, rs.y, rs.w, rs.h, { icon: 'reset', disabled: G.won || G.moves === 0 && !G.undo.length, act: resetLevel });
  }
  function drawTip() {
    var b = LY.tipBox;
    var fs = clamp(b.h * 0.42, 13, 20);
    var msg = t(G.tip);
    ctx.font = font(fs, 800);
    var w = Math.min(b.w, ctx.measureText(msg).width + fs * 2.2);
    var a = clamp((now - G.startT) * 3, 0, 1);
    ctx.globalAlpha = a;
    block(W / 2 - w / 2 + (b.x + b.w / 2 - W / 2), b.y, w, b.h, b.h / 2, '#FFF7EE', 'rgba(61,59,84,0.2)', 4);
    text(msg, b.x + b.w / 2, b.y + b.h / 2 + 1, fs, C.ink, 'center', 800, w - fs);
    ctx.globalAlpha = 1;
  }
  // Tutorial hand: acts out the next step of the stored solution.
  function drawHand() {
    var st = nextStep();
    if (!st || (pointer && pointer.mode === 'drag')) return;
    var cell = LY.cell, from, to, tap = false;
    if (st.a === 'r' || st.a === 't') { to = cellCenter(st.c); tap = true; }
    else if (st.a === 'p' || st.a === 'x') {
      var r = LY.stacks[st.a === 'x' ? 'x' : 'm'];
      if (!r) return;
      from = { x: r.x + r.w / 2, y: r.y + r.h / 2 }; to = cellCenter(st.c);
    } else if (st.a === 'mv') { from = cellCenter(st.c); to = cellCenter(st.to); }
    else if (st.a === 'u') { from = cellCenter(st.c); to = { x: LY.tray.x + LY.tray.w / 2, y: LY.tray.y + LY.tray.h / 2 }; }
    else return;
    var cyc = ((now - G.startT) % 2.2) / 2.2, hx, hy, press = 0, alpha = 1;
    if (tap) {
      hx = to.x; hy = to.y;
      press = cyc > 0.35 && cyc < 0.55 ? 1 : 0;
      alpha = cyc > 0.85 ? (1 - cyc) / 0.15 : Math.min(1, cyc / 0.1);
      if (press) {
        ctx.strokeStyle = 'rgba(255,247,238,0.8)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(to.x, to.y, cell * (0.3 + (cyc - 0.35) * 1.5), 0, Math.PI * 2); ctx.stroke();
      }
    } else {
      var m2 = ease((cyc - 0.15) / 0.55);
      hx = from.x + (to.x - from.x) * m2; hy = from.y + (to.y - from.y) * m2;
      press = cyc > 0.1 && cyc < 0.75 ? 1 : 0;
      alpha = cyc > 0.85 ? (1 - cyc) / 0.15 : Math.min(1, cyc / 0.1);
      if (press && st.a !== 'u') {
        ctx.globalAlpha = 0.75 * alpha;
        if (st.a === 'x') drawSplitter(hx, hy - cell * 0.1, cell, 'placed');
        else drawMirrorPiece(hx, hy - cell * 0.1, cell, Math.PI * 3 / 4, 'placed');
        ctx.globalAlpha = 1;
      }
    }
    drawPointerHand(hx + cell * 0.15, hy + cell * 0.2, cell * 0.9, press, alpha);
  }
  function drawPointerHand(x, y, s, press, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y + (press ? s * 0.05 : 0));
    ctx.rotate(-0.35);
    var sc = press ? 0.92 : 1;
    ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(30,28,50,0.25)';
    rr(-s * 0.1 + 3, -s * 0.05 + 4, s * 0.2, s * 0.5, s * 0.1); ctx.fill();
    rr(-s * 0.2 + 3, s * 0.22 + 4, s * 0.48, s * 0.42, s * 0.16); ctx.fill();
    ctx.fillStyle = '#FFF7EE'; ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(2, s * 0.045);
    rr(-s * 0.1, -s * 0.05, s * 0.2, s * 0.5, s * 0.1); ctx.fill(); ctx.stroke();
    rr(-s * 0.2, s * 0.22, s * 0.48, s * 0.42, s * 0.16); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFF7EE';
    rr(-s * 0.085, s * 0.2, s * 0.17, s * 0.1, s * 0.03); ctx.fill();
    ctx.restore();
  }
  function drawClear() {
    var a = ease(G.winT / 0.6);
    ctx.fillStyle = 'rgba(48,45,78,' + (0.38 * a) + ')';
    ctx.fillRect(0, 0, W, H);
    drawFloaters();
    if (G.winT < 0.75) return;
    var p = easeBack((G.winT - 0.75) / 0.45);
    var m = Math.min(W, H);
    var cw = Math.min(W - 32, clamp(m * 0.9, 300, 440)), ch = clamp(m * 0.72, 270, 360);
    var cx = W / 2, cy = H / 2;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(p, p); ctx.translate(-cx, -cy);
    var x = cx - cw / 2, y = cy - ch / 2;
    block(x, y, cw, ch, 28, '#FFF7EE', 'rgba(61,59,84,0.3)', 8);
    var last = G.idx === NLV - 1;
    var title = last ? t('finale') : t('clear');
    text(title, cx, y + ch * 0.14, clamp(ch * (last ? 0.07 : 0.11), 16, 36), C.ink, 'center', 900, cw - 40);
    for (var i = 0; i < 3; i++) {
      var st = (G.winT - 1.15 - i * 0.28) / 0.35;
      var on = i < G.result.stars && st > 0;
      var sc = on ? easeBack(st) : 1;
      var sx = cx + (i - 1) * ch * 0.22, sy = y + ch * 0.38 - (i === 1 ? ch * 0.03 : 0);
      ctx.save(); ctx.translate(sx, sy); ctx.scale(sc, sc);
      drawStar(0, 0, ch * (i === 1 ? 0.1 : 0.085), on);
      ctx.restore();
    }
    var info = t('moves') + ' ' + G.moves + '   ·   ' + t('best') + ' ' + G.result.best;
    text(info, cx, y + ch * 0.58, clamp(ch * 0.055, 14, 20), C.inkSoft, 'center', 800, cw - 30);
    if (G.result.newBest) text(t('newBest'), cx, y + ch * 0.67, clamp(ch * 0.05, 13, 18), C.coral, 'center', 900);
    ctx.restore();
    if (p < 0.98) return;
    var bh = clamp(ch * 0.19, 48, 64), gap = 12;
    var by = y + ch - bh - ch * 0.08;
    var small = bh * 1.1;
    var nextW = cw - 2 * small - 2 * gap - 40;
    var bx0 = x + 20;
    if (last) nextW += small + gap;
    else { button('cMenu', bx0, by, small, bh, { icon: 'grid', act: goSelect }); bx0 += small + gap; }
    button('cReplay', bx0, by, small, bh, { icon: 'reset', act: function () { startLevel(G.idx); } });
    button('cNext', bx0 + small + gap, by, nextW, bh, { label: last ? t('menu') : t('next'), icon: last ? 'grid' : 'play', fill: C.butter, shadow: '#E3B85E',
      act: last ? goSelect : goNext });
    if (focusId === null && keyboardMode) focusId = 'cNext';
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(48,45,78,0.45)';
    ctx.fillRect(0, 0, W, H);
    var s = clamp(U * 16, 60, 110);
    block(W / 2 - s / 2, H / 2 - s / 2 - s * 0.2, s, s, s * 0.3, '#FFF7EE', 'rgba(61,59,84,0.3)', 6);
    icon('pause', W / 2, H / 2 - s * 0.2, s * 0.5, C.ink);
    text(t('paused'), W / 2, H / 2 + s * 0.65, clamp(U * 5, 18, 28), '#FFF7EE', 'center', 900);
  }

  // ------------------------------------------------------------------ render
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ui.length = 0;
    if (screen === 'title') drawTitle();
    else if (screen === 'select') drawSelect();
    else if (screen === 'game' && G) drawGame();
    if (toast) {
      var age = now - toast.t;
      if (age > 2.4) toast = null;
      else {
        var fs = clamp(U * 4, 14, 20);
        ctx.font = font(fs, 800);
        var w = Math.min(W - 32, ctx.measureText(toast.s).width + fs * 2);
        ctx.globalAlpha = clamp((2.4 - age) * 3, 0, 1);
        block(W / 2 - w / 2, H * 0.5 - fs * 1.2, w, fs * 2.4, fs * 1.2, C.ink, null, 0);
        text(toast.s, W / 2, H * 0.5 + 1, fs, '#FFF7EE', 'center', 800, w - fs);
        ctx.globalAlpha = 1;
      }
    }
    if (paused) drawPaused();
  }

  function frame(ts) {
    rafId = 0;
    if (paused) return;
    var dt = lastT ? Math.min(0.05, (ts - lastT) / 1000) : 0;
    lastT = ts;
    now = ts / 1000;
    update(dt);
    render();
    rafId = requestAnimationFrame(frame);
  }
  function startLoop() {
    if (rafId || paused) return;
    lastT = 0;
    rafId = requestAnimationFrame(frame);
  }
  function stopLoop() { if (rafId) cancelAnimationFrame(rafId); rafId = 0; }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    U = Math.min(W, H) / 100;
    bgCache = {};
    boardCache = null;
    if (G) layoutGame();
    render();
  }

  // ------------------------------------------------------------------ input
  var keyboardMode = false;
  function toLocal(e) {
    var r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function cellAt(x, y) {
    if (!G) return -1;
    var cx = Math.floor((x - LY.bx) / LY.cell), cy = Math.floor((y - LY.by) / LY.cell);
    if (cx < 0 || cy < 0 || cx >= G.L.w || cy >= G.L.h) return -1;
    return cy * G.L.w + cx;
  }
  function inRect(p, r) { return r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }
  function ghostPos(d) { return { x: d.x, y: d.y - (d.touch ? LY.cell * 0.75 : 0) }; }
  function dropCell(d) {
    var gp = ghostPos(d);
    var c = cellAt(gp.x, gp.y);
    if (c < 0) return -1;
    if (c === d.fromCell) return c;
    return E.canPlace(G.L, G.S, c) ? c : -1;
  }
  function trayLeft(kind) { return kind === 'x' ? G.L.trayX - G.S.usedX : G.L.trayM - G.S.usedM; }

  function onDown(e) {
    ensureAudio();
    if (!ready || paused) return;
    if (e.pointerType !== 'mouse' || e.button === 0) keyboardMode = false;
    var p = toLocal(e);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    var b = hitUI(p.x, p.y);
    if (b) { pressed = b.id; pointer = { mode: 'button', id: b.id, x: p.x, y: p.y }; return; }
    if (screen !== 'game' || !G || G.won) return;
    var touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    for (var i = 0; i < LY.kinds.length; i++) {
      var kd = LY.kinds[i];
      if (inRect(p, LY.stacks[kd])) {
        G.sel = kd;
        if (trayLeft(kd) > 0) {
          pointer = { mode: 'drag', kind: kd, o: 0, fromCell: -1, x: p.x, y: p.y, sx: p.x, sy: p.y, touch: touch };
          sfx.lift();
        } else sfx.nope();
        return;
      }
    }
    var c = cellAt(p.x, p.y);
    if (c < 0) return;
    G.cursor.x = c % G.L.w; G.cursor.y = (c / G.L.w) | 0;
    pointer = { mode: 'cell', c: c, x: p.x, y: p.y, sx: p.x, sy: p.y, touch: touch };
  }
  function onMove(e) {
    if (!pointer) return;
    var p = toLocal(e);
    pointer.x = p.x; pointer.y = p.y;
    if (pointer.mode === 'button') {
      var b = hitUI(p.x, p.y);
      pressed = b && b.id === pointer.id ? pointer.id : null;
    } else if (pointer.mode === 'cell' && G && !G.won) {
      var c = pointer.c;
      var moved = Math.abs(p.x - pointer.sx) + Math.abs(p.y - pointer.sy) > LY.cell * 0.3;
      if (moved && G.S.placed[c]) {
        var pc = G.S.placed[c];
        pointer = { mode: 'drag', kind: pc === E.P_SPLIT ? 'x' : 'm', o: pc === E.P_BACK ? 1 : 0, fromCell: c, x: p.x, y: p.y, sx: pointer.sx, sy: pointer.sy, touch: pointer.touch };
        sfx.lift();
      }
    }
  }
  function onUp(e) {
    var pt = pointer;
    pointer = null;
    if (!pt) return;
    var p = toLocal(e);
    pt.x = p.x; pt.y = p.y;
    if (pt.mode === 'button') {
      var b = hitUI(p.x, p.y);
      pressed = null;
      if (b && b.id === pt.id && b.act) { sfx.ui(); b.act(); }
      return;
    }
    if (!G || G.won || screen !== 'game') return;
    if (pt.mode === 'drag') {
      var tc = dropCell(pt);
      var movedFar = Math.abs(p.x - pt.sx) + Math.abs(p.y - pt.sy) > LY.cell * 0.3;
      if (pt.fromCell < 0) {
        if (!movedFar) { return; } // a tap on the tray just selects that piece
        if (tc >= 0) doMove(pt.kind === 'x' ? { a: 'x', c: tc } : { a: 'p', c: tc, o: 0 });
        return;
      }
      if (tc === pt.fromCell) return;
      if (tc >= 0) { doMove({ a: 'mv', c: pt.fromCell, to: tc }); return; }
      var gp = ghostPos(pt);
      var overBoard = gp.x >= LY.bx && gp.x <= LY.bx + LY.bw && gp.y >= LY.by && gp.y <= LY.by + LY.bh;
      if (!overBoard) doMove({ a: 'u', c: pt.fromCell });
      else sfx.nope();
      return;
    }
    if (pt.mode === 'cell') tapCell(pt.c);
  }
  function tapCell(c) {
    var L = G.L, tp = L.type[c];
    if (tp === T.ROT) doMove({ a: 'r', c: c });
    else if (tp === T.TOG) doMove({ a: 't' });
    else if (tp === T.EMPTY && G.S.placed[c]) {
      if (G.S.placed[c] === E.P_SPLIT) { sfx.nope(); G.nudgeC = c; G.nudgeT = now; }
      else doMove({ a: 'r', c: c });
    } else if (tp === T.EMPTY) {
      var kd = trayLeft(G.sel) > 0 ? G.sel : (trayLeft('m') > 0 ? 'm' : trayLeft('x') > 0 ? 'x' : null);
      if (kd) doMove(kd === 'x' ? { a: 'x', c: c } : { a: 'p', c: c, o: 0 });
    }
  }
  function onCancel() { pointer = null; pressed = null; }

  function onKey(e) {
    if (!ready) return;
    var k = e.key;
    var handled = true;
    ensureAudio();
    if (paused) return;
    if (k === 'Tab') { e.preventDefault(); }
    if (screen === 'game' && G && !G.won) {
      keyboardMode = true;
      var cur = G.cursor, L = G.L;
      if (k === 'ArrowLeft') cur.x = Math.max(0, cur.x - 1);
      else if (k === 'ArrowRight') cur.x = Math.min(L.w - 1, cur.x + 1);
      else if (k === 'ArrowUp') cur.y = Math.max(0, cur.y - 1);
      else if (k === 'ArrowDown') cur.y = Math.min(L.h - 1, cur.y + 1);
      else if (k === 'Enter' || k === ' ') tapCell(cur.y * L.w + cur.x);
      else if (k === 'Backspace' || k === 'Delete') {
        var cc = cur.y * L.w + cur.x;
        if (G.S.placed[cc]) doMove({ a: 'u', c: cc });
      } else if (k === 'z' || k === 'Z' || k === 'u' || k === 'U') undo();
      else if (k === 'r' || k === 'R') resetLevel();
      else if (k === 'h' || k === 'H') useHint();
      else if (k === 'Tab' || k === 'x' || k === 'X') { if (LY.kinds.length > 1) G.sel = G.sel === 'm' ? 'x' : 'm'; }
      else if (k === 'Escape') goSelect();
      else handled = false;
    } else {
      handled = menuKey(k);
    }
    if (handled) e.preventDefault();
  }
  function menuKey(k) {
    if (k === 'Escape') {
      keyboardMode = true;
      if (screen === 'select') { screen = 'title'; focusId = null; return true; }
      if (screen === 'game' && G && G.won) { goSelect(); return true; }
      return false;
    }
    var dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    var usable = ui.filter(function (b) { return b.act; });
    if (!usable.length) return false;
    if (dirs[k]) {
      keyboardMode = true;
      var cur = uiById(focusId);
      if (!cur || !cur.act) { focusId = defaultFocus(usable); return true; }
      var d = dirs[k], best = null, bestScore = Infinity;
      var cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
      for (var i = 0; i < usable.length; i++) {
        var b = usable[i];
        if (b === cur) continue;
        var dx = b.x + b.w / 2 - cx, dy = b.y + b.h / 2 - cy;
        var along = dx * d[0] + dy * d[1];
        if (along <= 1) continue;
        var across = Math.abs(dx * d[1]) + Math.abs(dy * d[0]);
        var score = along + across * 2.5;
        if (score < bestScore) { bestScore = score; best = b; }
      }
      if (best) { focusId = best.id; sfx.ui(); }
      return true;
    }
    if (k === 'Enter' || k === ' ') {
      keyboardMode = true;
      var f = uiById(focusId);
      if (!f || !f.act) { focusId = defaultFocus(usable); f = uiById(focusId); }
      if (f && f.act) { sfx.ui(); f.act(); }
      return true;
    }
    return false;
  }
  function defaultFocus(usable) {
    var pref = ['play', 'cNext', 'lv' + firstOpenLevel(selChapter)];
    for (var i = 0; i < pref.length; i++) if (usable.some(function (b) { return b.id === pref[i]; })) return pref[i];
    return usable[0].id;
  }
  function firstOpenLevel(k) {
    for (var i = k * PER; i < (k + 1) * PER; i++) if (lvUnlocked(i) && !cleared(i)) return i;
    return k * PER;
  }

  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onCancel);
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', resize);

  // ------------------------------------------------------------------ lifecycle
  PlayablesSDK.onPause(function () {
    paused = true;
    stopLoop();
    pointer = null; pressed = null;
    syncAudio();
    render();
  });
  PlayablesSDK.onResume(function () {
    paused = false;
    syncAudio();
    startLoop();
  });
  PlayablesSDK.onAudioChange(function (enabled) {
    sdkAudio = !!enabled;
    syncAudio();
  });

  // Small, harmless hook for automated play-tests.
  window.__lanternDebug = {
    info: function () {
      return { screen: screen, ready: ready, level: G ? G.idx : -1, moves: G ? G.moves : 0, solved: G ? G.solved : false,
        won: G ? G.won : false, total: totalStars(), hints: save.hints, seenTutorial: save.seenTutorial, lang: lang, paused: paused };
    },
    cell: function (x, y) { return G ? { x: LY.bx + (x + 0.5) * LY.cell, y: LY.by + (y + 0.5) * LY.cell } : null; },
    tray: function (kind) { var r = G && LY.stacks[kind || 'm']; return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null; },
    button: function (id) { var b = uiById(id); return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : null; },
    solution: function (i) { return LV.solutions[i].s; },
    width: function () { return G ? G.L.w : 0; }
  };

  // 1) first frame synchronously, 2) load, 3) gameReady.
  resize();
  PlayablesSDK.firstFrameReady();
  startLoop();
  Promise.all([PlayablesSDK.load(), PlayablesSDK.getLanguage()]).then(function (res) {
    applySave(res[0]);
    lang = pickLang(res[1]);
    selChapter = chapterOf(save.last);
    ready = true;
    render();
    PlayablesSDK.gameReady();
  }, function () {
    ready = true;
    PlayablesSDK.gameReady();
  });
})();
