/*
 * Prism Runner: an endless 3-lane color-matching runner for YouTube Playables.
 * Vanilla JS + Canvas 2D. All art is drawn in code, all sound is synthesized (audio.js).
 *
 * World units: distance along the track. The orb sits at L.playerY on screen and the
 * world scrolls down. VIS units are always visible ahead of the orb, whatever the screen
 * size, so reaction time is the same in portrait and landscape.
 */
(function () {
  'use strict';

  var AU = window.PRAudio;
  var I18N = window.PR_I18N;

  PlayablesSDK.init({ storageKey: 'prism-runner_save' });

  // ---------------------------------------------------------------- constants
  var C = {
    bg: '#FFF7EE', ink: '#3D3B54', inkSoft: '#8A87A6', peach: '#FFB4A2', pink: '#F7A1C4',
    lavender: '#B9A7F5', mint: '#9EE0C5', sky: '#A7D3F5', butter: '#FFE39A', coral: '#FF8C7A'
  };
  var DK = {
    pink: '#DD82A8', mint: '#6EC3A1', sky: '#78AEDC', butter: '#EAC562', lavender: '#9380DE',
    peach: '#EC9480', coral: '#E36A5A', track: '#F0DDCD', white: '#EADCCF'
  };
  var ORB = [C.pink, C.mint, C.sky];
  var ORB_D = [DK.pink, DK.mint, DK.sky];
  var RAINBOW = [C.pink, C.peach, C.butter, C.mint, C.sky, C.lavender];
  var FONT = 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
  var TRAIL_REQ = [0, 400, 1200, 2500, 5000];
  var VIS = 10;            // world units visible ahead of the orb
  var TRAIL_LEN = 3.2;     // world units of trail behind the orb
  var EMPTY = -2, BLOCK = -1;
  var COUNT_STEP = 0.7;    // seconds per countdown number

  // ---------------------------------------------------------------- utils
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutBack(t) { var c = 1.70158; t -= 1; return 1 + (c + 1) * t * t * t + c * t * t; }
  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- canvas
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = 1, H = 1, DPR = 1, ui = 1, minD = 1;
  var L = {};

  // ---------------------------------------------------------------- state
  var T = I18N.en;
  function tr(k) { return T[k] != null ? T[k] : I18N.en[k]; }

  var save = { v: 1, best: 0, trail: 0, sound: true, music: true, seenTutorial: false, runs: 0 };
  var ready = false, running = false, rafId = 0, lastT = 0, time = 0;
  var state = 'title';            // 'title' | 'play' | 'over'
  var pauseMode = null;           // null | 'menu' | 'count'
  var countT = 0;
  var lastInput = 'touch';
  var pressed = null;             // id of the button under a pointer
  var lockShake = [0, 0, 0, 0, 0];

  var titleT = 0, titleDist = 0;
  var runT = 0, clock = 0, dist = 0, speed = 0, bonus = 0, score = 0, combo = 0, bestCombo = 0;
  var gatesPassed = 0, timeScale = 1, slowT = 0, dying = 0, overT = 0, shake = 0, flash = 0;
  var comboPop = 0, newBestFlag = false, newTrail = -1, tutorialOn = false, beatBest = false;
  var goT = 0;

  var P = { lane: 1, x: 1, color: 0, squash: 0, dir: 0, shield: false, alive: true, shiftT: 0, inv: 0, shieldT: 0 };

  var rows = [], rowPool = [], picks = [], pickPool = [];
  var gen = { z: 0, mask: 0, rng: Math.random, queue: [], lastShieldZ: 0, lastSlowZ: 0, tutEndZ: -1 };

  // trail ring buffer
  var TN = 64;
  var trX = new Float32Array(TN), trD = new Float32Array(TN), trC = new Uint8Array(TN);
  var trHead = 0, trCount = 0, trTotal = 0;
  function trailReset() { trHead = 0; trCount = 0; }
  function trailPush(x, d, c) {
    trX[trHead] = x; trD[trHead] = d; trC[trHead] = c;
    trHead = (trHead + 1) % TN; if (trCount < TN) trCount++; trTotal++;
  }

  // particles (pooled)
  var PN = 420, parts = [], pCur = 0;
  for (var pi = 0; pi < PN; pi++) parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, col: '#fff', shape: 0, rot: 0, vr: 0, g: 0 });
  function spawn(x, y, vx, vy, life, size, col, shape, g) {
    var p = parts[pCur]; pCur = (pCur + 1) % PN;
    p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life;
    p.size = size; p.col = col; p.shape = shape; p.g = g || 0; p.rot = Math.random() * 6.28; p.vr = (Math.random() - 0.5) * 10;
  }
  function puff(x, y, col, n, spd) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, s = (0.4 + Math.random()) * (spd || 160) * ui;
      spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + Math.random() * 0.35, (3 + Math.random() * 5) * ui, i % 3 === 0 ? '#FFFFFF' : col, i % 4 === 0 ? 2 : 0, 0);
    }
  }
  function shards(x, y, col, col2, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, s = (0.5 + Math.random()) * 300 * ui;
      spawn(x, y, Math.cos(a) * s, Math.sin(a) * s - 80 * ui, 0.7 + Math.random() * 0.6, (6 + Math.random() * 9) * ui, i % 2 ? col : col2, 1, 520 * ui);
    }
  }
  function confetti(n) {
    for (var i = 0; i < n; i++) {
      spawn(Math.random() * W, -20 - Math.random() * H * 0.3, (Math.random() - 0.5) * 120, 80 + Math.random() * 160,
        2.2 + Math.random() * 1.4, (5 + Math.random() * 5) * ui, RAINBOW[i % 6], 3, 140);
    }
  }

  // floating score texts (pooled)
  var floats = [];
  for (var fi = 0; fi < 10; fi++) floats.push({ on: false, x: 0, y: 0, t: 0, str: '', col: '#fff' });
  var fCur = 0;
  function floatText(str, x, y, col) {
    var f = floats[fCur]; fCur = (fCur + 1) % floats.length;
    f.on = true; f.x = x; f.y = y; f.t = 0; f.str = str; f.col = col;
  }

  // drifting pastel decoration
  var DEC = [];
  function initDecor() {
    DEC.length = 0;
    var n = Math.round(clamp((W * H) / 26000, 18, 56));
    for (var i = 0; i < n; i++) {
      DEC.push({ x: Math.random() * W, y: Math.random() * H, s: 8 + Math.random() * Math.random() * 40, k: i % 5,
        col: RAINBOW[(i * 7) % 6], rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.8, par: 0.3 + Math.random() * 0.7 });
    }
  }

  // ---------------------------------------------------------------- layout
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    var nw = Math.max(1, window.innerWidth), nh = Math.max(1, window.innerHeight);
    var changed = nw !== W || nh !== H;
    W = nw; H = nh;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    minD = Math.min(W, H);
    ui = clamp(Math.min(W / 400, H / 720), 0.55, 1.5);
    layout();
    if (changed || !DEC.length) initDecor();
    if (!running) draw();
  }

  function rect(x, y, w, h) { return { x: x, y: y, w: w, h: h }; }

  function layout() {
    var m = 16;
    L.trackW = Math.min(W - 24, H * 0.62, 540);
    L.trackX = (W - L.trackW) / 2;
    L.laneW = L.trackW / 3;
    L.playerY = Math.round(H * 0.79);
    L.ppu = L.playerY / VIS;
    L.orbR = clamp(Math.min(L.laneW * 0.22, L.ppu * 0.42), 9, 38);
    L.gateH = clamp(L.ppu * 0.42, 12, 32);

    var bs = Math.max(48, Math.round(50 * ui));
    L.bs = bs;
    L.pause = rect(m, m, bs, bs);
    L.sound = rect(W - m - bs, m, bs, bs);
    L.music = rect(W - m - bs * 2 - 10, m, bs, bs);
    L.ringR = Math.max(22, 27 * ui);
    L.ringX = W - m - L.ringR - 4;
    L.ringY = m + L.ringR + 4;

    // title
    L.logoY = H * 0.155;
    L.titleOrbY = H * 0.405;
    var pw = Math.min(W - 48, 236 * ui), ph = Math.max(56, 72 * ui);
    L.play = rect((W - pw) / 2, H * 0.575 - ph / 2, pw, ph);
    L.bestY = L.play.y + ph + 28 * ui;
    var sw = Math.max(48, 58 * ui), gap = Math.max(8, 12 * ui);
    if (5 * sw + 4 * gap > W - 32) sw = Math.max(44, (W - 32 - 4 * gap) / 5);
    var tx = (W - (5 * sw + 4 * gap)) / 2;
    L.trailLabelY = H * 0.755;
    L.trailRowY = L.trailLabelY + 20 * ui;
    L.trailSw = sw;
    L.trails = [];
    for (var i = 0; i < 5; i++) L.trails.push(rect(tx + i * (sw + gap), L.trailRowY, sw, sw));
    L.trailNameY = L.trailRowY + sw + 20 * ui;

    // pause overlay
    var rr2 = Math.max(48, 60 * ui);
    L.resume = rect(W / 2 - rr2, H * 0.46 - rr2, rr2 * 2, rr2 * 2);
    var pb = Math.max(52, 58 * ui), pg = 18 * ui;
    var py = H * 0.68;
    L.home = rect(W / 2 - pb * 1.5 - pg, py, pb, pb);
    L.psound = rect(W / 2 - pb / 2, py, pb, pb);
    L.pmusic = rect(W / 2 + pb / 2 + pg, py, pb, pb);

    // game over card: content flows from the top, the buttons may be taller than designed
    var cu = Math.max(ui, 0.6);
    L.cardW = Math.min(W - 32, 340 * cu);
    var rh = Math.max(52, 62 * cu);
    var btnTop = 212 * cu;
    L.cardH = btnTop + rh + 22 * cu;
    L.cardTop = Math.max(40 * cu, H * 0.47 - L.cardH / 2);
    var rw = Math.min(L.cardW - 120 * cu, 180 * cu);
    var by = L.cardTop + btnTop;
    var mbs = Math.max(52, rh);
    var rowW = mbs + 14 * cu + rw;
    L.menu = rect(W / 2 - rowW / 2, by + (rh - mbs) / 2, mbs, mbs);
    L.retry = rect(W / 2 - rowW / 2 + mbs + 14 * cu, by, rw, rh);
    L.cu = cu;
  }

  function laneX(lf) { return L.trackX + L.laneW * (lf + 0.5); }
  function rowY(z) { return L.playerY - (z - dist) * L.ppu; }

  // ---------------------------------------------------------------- difficulty + generation
  function speedAt(c) { return c < 20 ? 5.2 + c * 0.04 : 6 + 7.4 * (1 - Math.exp(-(c - 20) / 110)); }
  function diffAt(c) { return clamp((c - 20) / 170, 0, 1); }
  function mult() { return Math.min(8, 1 + Math.floor(combo / 4)); }

  function allocRow() { return rowPool.length ? rowPool.pop() : { z: 0, segs: [0, 0, 0], hint: 0, res: false, passLane: -1, fx: 0, broken: -1 }; }
  function allocPick() { return pickPool.length ? pickPool.pop() : { z: 0, lane: 0, kind: 1, res: false, taken: false, t: 0 }; }

  // Fewest actions (lane steps + color taps, colors cycle forward) from any state in `mask`
  // to a passable segment of `segs`, worst case over the states. mask bit = lane*3+color.
  function worstActions(mask, segs) {
    var worst = 0;
    for (var s = 0; s < 9; s++) {
      if (!(mask & (1 << s))) continue;
      var l = (s / 3) | 0, c = s % 3, best = 99;
      for (var j = 0; j < 3; j++) {
        var g = segs[j];
        if (g === BLOCK) continue;
        var a = Math.abs(l - j) + (g === EMPTY ? 0 : (g - c + 3) % 3);
        if (a < best) best = a;
      }
      if (best > worst) worst = best;
    }
    return worst;
  }
  function nextMask(segs) {
    var m = 0;
    for (var j = 0; j < 3; j++) {
      var g = segs[j];
      if (g === BLOCK) continue;
      if (g === EMPTY) m |= 7 << (j * 3); else m |= 1 << (j * 3 + g);
    }
    return m;
  }

  function tutorialSpecs(full) {
    var E = EMPTY, B = BLOCK, q = [];
    if (full) {
      q.push({ segs: [E, B, E], hint: 1, tut: 1 });
      q.push({ segs: [B, B, E], hint: 1, tut: 1 });
      q.push({ segs: [E, B, B], hint: 1, tut: 1 });
      q.push({ segs: [1, 1, 1], hint: 2, tut: 1 });
      q.push({ segs: [2, 2, 2], hint: 2, tut: 1 });
      q.push({ segs: [0, 0, 0], hint: 2, tut: 1 });
      q.push({ segs: [1, 0, 2], hint: 3, tut: 1 });
      q.push({ segs: [B, 2, B], hint: 3, tut: 1 });
      q.push({ segs: [0, 1, 2], hint: 3, tut: 1, tutEnd: 1 });
    } else {
      q.push({ segs: [E, B, E], tut: 1 });
      q.push({ segs: [1, 1, 1], tut: 1 });
      q.push({ segs: [2, 0, 1], tut: 1 });
    }
    return q;
  }

  function fillQueue() {
    var r = gen.rng, d = diffAt(clock), q = gen.queue;
    var E = EMPTY, B = BLOCK;
    function rc() { return (r() * 3) | 0; }
    function rl() { return (r() * 3) | 0; }
    var w = [
      3,                         // 0 random gate
      2,                         // 1 uniform gate
      2,                         // 2 pair gate
      1.4,                       // 3 one block
      1.4,                       // 4 two blocks
      d > 0.12 ? 0.6 + 2 * d : 0,  // 5 gate with a block
      d > 0.35 ? 1.6 * d : 0,      // 6 gate with two blocks
      d > 0.22 ? 1.2 : 0,          // 7 stairs
      d > 0.28 ? 1.2 : 0,          // 8 color run
      d > 0.45 ? 1.4 : 0           // 9 slalom
    ];
    var tot = 0, i;
    for (i = 0; i < w.length; i++) tot += w[i];
    var pick = r() * tot, k = 0;
    for (k = 0; k < w.length; k++) { pick -= w[k]; if (pick < 0) break; }
    var c = rc(), l = rl(), segs, j;
    switch (k) {
      case 0:
        segs = [rc(), rc(), rc()];
        if (segs[0] === segs[1] && segs[1] === segs[2]) segs[l] = (segs[l] + 1) % 3;
        q.push({ segs: segs }); break;
      case 1: q.push({ segs: [c, c, c] }); break;
      case 2: segs = [c, c, c]; segs[l] = (c + 1 + ((r() * 2) | 0)) % 3; q.push({ segs: segs }); break;
      case 3: segs = [E, E, E]; segs[l] = B; q.push({ segs: segs }); break;
      case 4: segs = [B, B, B]; segs[l] = E; q.push({ segs: segs }); break;
      case 5: segs = [rc(), rc(), rc()]; segs[l] = B; q.push({ segs: segs }); break;
      case 6: segs = [B, B, B]; segs[l] = c; q.push({ segs: segs }); break;
      case 7: {
        var dir = l === 0 ? 1 : l === 2 ? -1 : (r() < 0.5 ? 1 : -1);
        var f = l;
        for (j = 0; j < 3; j++) {
          segs = [B, B, B]; segs[f] = E;
          q.push({ segs: segs, tight: 1 });
          f += dir; if (f < 0 || f > 2) { dir = -dir; f += 2 * dir; }
        }
        break;
      }
      case 8:
        for (j = 0; j < 3; j++) { var cc = (c + j) % 3; q.push({ segs: [cc, cc, cc], tight: 1 }); }
        break;
      case 9:
        segs = [B, B, B]; segs[l] = E; q.push({ segs: segs });
        q.push({ segs: [rc(), rc(), rc()], tight: 1 });
        segs = [E, E, E]; segs[(l + 1 + ((r() * 2) | 0)) % 3] = B; q.push({ segs: segs, tight: 1 });
        break;
    }
  }

  function genNext() {
    if (!gen.queue.length) fillQueue();
    var spec = gen.queue.shift();
    var d = diffAt(clock);
    var worst = worstActions(gen.mask, spec.segs);
    var sp = speedAt(clock + 1.5);
    var base = spec.tut ? 1.75 : lerp(1.05, 0.46, d) * (spec.tight ? 0.78 : 1);
    var per = spec.tut ? 0.42 : lerp(0.27, 0.18, d);
    var gap = Math.max(2.6, (base + per * worst) * sp);
    var z0 = gen.z, z = z0 + gap;
    placePickups(z0, z, spec, d);
    var row = allocRow();
    row.z = z; row.hint = spec.hint || 0; row.res = false; row.passLane = -1; row.fx = 0; row.broken = -1;
    row.segs[0] = spec.segs[0]; row.segs[1] = spec.segs[1]; row.segs[2] = spec.segs[2];
    rows.push(row);
    gen.mask = nextMask(spec.segs);
    gen.z = z;
    if (spec.tutEnd) gen.tutEndZ = z;
  }

  function addPick(z, lane, kind) {
    var p = allocPick();
    p.z = z; p.lane = lane; p.kind = kind; p.res = false; p.taken = false; p.t = 0;
    picks.push(p);
  }

  function placePickups(z0, z1, spec, d) {
    var r = gen.rng, gap = z1 - z0;
    var free = [];
    for (var j = 0; j < 3; j++) if (spec.segs[j] !== BLOCK) free.push(j);
    var lane = free[(r() * free.length) | 0];
    var roll = r();
    if (!spec.tut && gap > 3.2 && d > 0.03 && z1 - gen.lastShieldZ > 170 && !P.shield && roll < 0.3) {
      addPick(z0 + gap * 0.5, lane, 2); gen.lastShieldZ = z1;
    } else if (!spec.tut && gap > 3.2 && d > 0.18 && z1 - gen.lastSlowZ > 210 && roll < 0.55) {
      addPick(z0 + gap * 0.5, lane, 3); gen.lastSlowZ = z1;
    } else if (gap > 4.2 && roll < 0.85) {
      var n = clamp(Math.floor((gap - 2.4) / 1.1), 2, 4);
      var span = Math.min(gap - 2.4, (n - 1) * 1.1);
      var start = z0 + (gap - span) / 2;
      for (var k = 0; k < n; k++) addPick(start + (span * k) / (n - 1), lane, 1);
    }
  }

  // ---------------------------------------------------------------- run control
  function clearWorld() {
    var i;
    for (i = 0; i < rows.length; i++) rowPool.push(rows[i]);
    for (i = 0; i < picks.length; i++) pickPool.push(picks[i]);
    rows.length = 0; picks.length = 0;
    for (i = 0; i < PN; i++) parts[i].on = false;
    for (i = 0; i < floats.length; i++) floats[i].on = false;
    trailReset();
  }

  function startRun() {
    clearWorld();
    state = 'play'; pauseMode = null;
    runT = 0; dist = 0; bonus = 0; score = 0; combo = 0; bestCombo = 0; gatesPassed = 0;
    timeScale = 1; slowT = 0; dying = 0; shake = 0; flash = 0; comboPop = 0; beatBest = false;
    goT = 0.9;
    P.lane = 1; P.x = 1; P.color = 0; P.squash = 0; P.dir = 0; P.shield = false; P.alive = true; P.shiftT = 0; P.inv = 0;
    tutorialOn = !save.seenTutorial;
    clock = tutorialOn ? 0 : 8;
    speed = speedAt(clock);
    save.runs = (save.runs | 0) + 1;
    gen.rng = mulberry32(((Date.now() & 0x7fffffff) ^ Math.imul(save.runs, 2654435761)) >>> 0);
    gen.z = 3.5; gen.mask = 1 << 3; gen.queue = tutorialSpecs(tutorialOn);
    gen.lastShieldZ = 0; gen.lastSlowZ = 0; gen.tutEndZ = -1;
    AU.click();
  }

  function toTitle() {
    clearWorld();
    state = 'title'; pauseMode = null; titleT = 0;
    persist();
  }

  function openPause() { if (state === 'play' && P.alive && !pauseMode) { pauseMode = 'menu'; AU.click(); } }
  function beginCount() { pauseMode = 'count'; countT = COUNT_STEP * 3; AU.tick(false); }

  function moveLane(dir) {
    var nl = clamp(P.lane + dir, 0, 2);
    if (nl === P.lane) { P.squash = 0.5; P.dir = dir; return; }
    P.lane = nl; P.squash = 1; P.dir = dir;
    AU.move();
  }
  function shiftColor() {
    P.color = (P.color + 1) % 3; P.shiftT = 1;
    puff(laneX(P.x), L.playerY, ORB[P.color], 6, 90);
    AU.shift();
  }

  function resolveRow(r) {
    r.res = true;
    var lane = P.lane, g = r.segs[lane];
    var ok = g === EMPTY || g === P.color;
    var ox = laneX(lane), oy = L.playerY;
    if (ok) {
      if (g >= 0) {
        var before = mult();
        combo++; gatesPassed++;
        if (combo > bestCombo) bestCombo = combo;
        var m = mult(), pts = 10 * m;
        bonus += pts;
        r.passLane = lane; r.fx = 0;
        puff(ox, oy, ORB[g], 16, 180);
        floatText('+' + pts, ox, oy - L.orbR * 2, ORB_D[g]);
        if (m > before) comboPop = 1;
        AU.chime(combo);
      }
      return;
    }
    if (P.inv > 0) return;
    if (P.shield) {
      P.shield = false; P.inv = 0.5; combo = 0; r.broken = lane;
      shards(ox, oy - L.gateH, g >= 0 ? ORB[g] : '#8F8BB3', '#FFFFFF', 16);
      shake = Math.max(shake, 0.5);
      AU.shieldPop();
      return;
    }
    die(r, lane, g);
  }

  function die(r, lane, g) {
    P.alive = false; dying = 0.95; shake = 1; flash = 1;
    if (g >= 0) r.broken = lane;
    var ox = laneX(P.x), oy = L.playerY;
    shards(ox, oy, ORB[P.color], g >= 0 ? ORB[g] : '#8F8BB3', 26);
    puff(ox, oy, '#FFFFFF', 10, 240);
    AU.shatter();
  }

  function gameOver() {
    state = 'over'; overT = 0;
    var prev = save.best | 0;
    newBestFlag = score > prev;
    newTrail = -1;
    for (var i = 1; i < TRAIL_REQ.length; i++) if (prev < TRAIL_REQ[i] && score >= TRAIL_REQ[i]) newTrail = i;
    if (newBestFlag) {
      save.best = score;
      PlayablesSDK.sendScore(save.best);
      confetti(90);
      AU.fanfare();
    }
    if (newTrail >= 0) save.trail = newTrail;
    persist();
  }

  function collect(p) {
    var ox = laneX(p.lane), oy = L.playerY;
    p.taken = true;
    if (p.kind === 1) {
      var pts = 5 * mult();
      bonus += pts;
      puff(ox, oy - L.orbR, C.butter, 8, 120);
      floatText('+' + pts, ox + L.orbR * 1.4, oy - L.orbR * 2.6, DK.butter);
      AU.pickup();
    } else if (p.kind === 2) {
      P.shield = true; P.shieldT = 0;
      puff(ox, oy, C.sky, 14, 160);
      floatText(tr('shield'), ox, oy - L.orbR * 2.8, DK.sky);
      AU.shield();
    } else {
      slowT = 4.5;
      puff(ox, oy, C.lavender, 14, 160);
      floatText(tr('slow'), ox, oy - L.orbR * 2.8, DK.lavender);
      AU.slow();
    }
  }

  // ---------------------------------------------------------------- persistence
  function trailUnlocked(i) { return (save.best | 0) >= TRAIL_REQ[i]; }
  function applySave(o) {
    if (!o || typeof o !== 'object') return;
    save.best = Math.max(0, Math.floor(Number(o.best) || 0));
    save.trail = clamp(Math.floor(Number(o.trail) || 0), 0, 4);
    save.sound = o.sound !== false;
    save.music = o.music !== false;
    save.seenTutorial = !!o.seenTutorial;
    save.runs = Math.max(0, Math.floor(Number(o.runs) || 0));
    if (!trailUnlocked(save.trail)) save.trail = 0;
  }
  function persist() {
    PlayablesSDK.save({ v: 1, best: save.best, trail: save.trail, sound: save.sound, music: save.music, seenTutorial: save.seenTutorial, runs: save.runs });
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    time += dt;
    var frozen = state === 'play' && pauseMode;
    if (!frozen) { updateDecor(dt); updateParticles(dt); }
    for (var i = 0; i < 5; i++) if (lockShake[i] > 0) lockShake[i] = Math.max(0, lockShake[i] - dt * 2.5);

    if (state === 'title') {
      titleT += dt; titleDist += 3.4 * dt;
      var lf = 1 + Math.sin(titleT * 1.5) * 0.85;
      trailPush(lf, titleDist, Math.floor(titleT / 1.6) % 3);
    } else if (state === 'play') {
      if (pauseMode === 'count') {
        var prev = Math.ceil(countT / COUNT_STEP);
        countT -= dt;
        var now = Math.ceil(countT / COUNT_STEP);
        if (countT <= 0) { pauseMode = null; AU.tick(true); goT = 0.6; }
        else if (now !== prev) AU.tick(false);
      }
      if (!pauseMode) updateRun(dt);
    } else if (state === 'over') {
      overT += dt;
    }
    AU.beat(state === 'play' && !pauseMode && P.alive, 92 + (speed - 5) * 5.5 * timeScale, diffAt(clock));
  }

  function updateRun(dt) {
    if (goT > 0) goT -= dt;
    if (slowT > 0) slowT -= dt;
    var target = slowT > 0 ? 0.55 : 1;
    timeScale += (target - timeScale) * Math.min(1, dt * 5);
    var gdt = dt * timeScale;
    if (P.alive) {
      runT += gdt; clock += gdt; speed = speedAt(clock);
    } else {
      speed *= Math.exp(-dt * 5);
      dying -= dt;
    }
    dist += speed * gdt;
    while (gen.z < dist + VIS + 6) genNext();

    P.x += (P.lane - P.x) * (1 - Math.exp(-dt * 22));
    P.squash *= Math.exp(-dt * 9);
    P.shiftT = Math.max(0, P.shiftT - dt * 3.5);
    if (P.inv > 0) P.inv -= dt;
    P.shieldT += dt;
    if (comboPop > 0) comboPop = Math.max(0, comboPop - dt * 3);
    shake *= Math.exp(-dt * 7);
    flash = Math.max(0, flash - dt * 3);

    var bottom = dist - (H - L.playerY + 140) / L.ppu;
    var i, n = 0;
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r.res && r.z <= dist && P.alive) resolveRow(r);
      if (r.passLane >= 0) r.fx += dt;
      if (r.z < bottom) rowPool.push(r); else rows[n++] = r;
    }
    rows.length = n;
    n = 0;
    for (i = 0; i < picks.length; i++) {
      var p = picks[i];
      p.t += dt;
      if (!p.res && p.z <= dist) {
        p.res = true;
        if (P.alive && Math.abs(P.x - p.lane) < 0.5) collect(p);
      }
      if (p.z < bottom || p.taken) pickPool.push(p); else picks[n++] = p;
    }
    picks.length = n;

    if (P.alive) {
      score = Math.floor(dist) + bonus;
      if (!beatBest && save.best > 0 && score > save.best) { beatBest = true; floatText(tr('newBest'), W / 2, L.playerY - L.orbR * 4, DK.coral); }
      trailPush(P.x, dist, P.color);
    }
    if (tutorialOn && gen.tutEndZ > 0 && dist > gen.tutEndZ + 0.5) {
      tutorialOn = false;
      save.seenTutorial = true;
    }
    if (!P.alive && dying <= 0) gameOver();
  }

  function updateDecor(dt) {
    var v = state === 'play' ? speed * L.ppu * 0.22 * timeScale : 16;
    for (var i = 0; i < DEC.length; i++) {
      var d = DEC[i];
      d.y += v * d.par * dt; d.rot += d.vr * dt;
      if (d.y > H + 50) { d.y = -50; d.x = Math.random() * W; }
    }
  }

  function updateParticles(dt) {
    for (var i = 0; i < PN; i++) {
      var p = parts[i];
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) { p.on = false; continue; }
      p.vy += p.g * dt;
      p.vx *= 1 - Math.min(1, dt * 2.2); if (p.g === 0) p.vy *= 1 - Math.min(1, dt * 2.2);
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    for (i = 0; i < floats.length; i++) {
      var f = floats[i];
      if (!f.on) continue;
      f.t += dt; f.y -= 40 * ui * dt;
      if (f.t > 0.9) f.on = false;
    }
  }

  // ---------------------------------------------------------------- drawing helpers
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
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, 6.2832); ctx.fill(); }
  function setFont(sz, wt) { ctx.font = (wt || 800) + ' ' + Math.max(1, Math.round(sz)) + 'px ' + FONT; }
  function fitFont(str, sz, wt, maxW) {
    setFont(sz, wt);
    if (maxW) { var w = ctx.measureText(str).width; if (w > maxW) { sz = sz * maxW / w; setFont(sz, wt); } }
    return sz;
  }
  // Text with an outline in the background color so it stays readable over the track.
  function label(str, x, y, sz, col, opts) {
    opts = opts || {};
    fitFont(str, sz, opts.wt || 800, opts.maxW);
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = 'middle';
    if (opts.outline) {
      ctx.lineJoin = 'round'; ctx.lineWidth = opts.ow || Math.max(3, sz * 0.18); ctx.strokeStyle = opts.outline;
      ctx.strokeText(str, x, y);
    }
    if (opts.shadow) { ctx.fillStyle = opts.shadow; ctx.fillText(str, x, y + (opts.so || sz * 0.07)); }
    ctx.fillStyle = col;
    ctx.fillText(str, x, y);
  }
  function softPanel(x, y, w, h, r, fill, shadowCol, off) {
    ctx.fillStyle = shadowCol || DK.white; rr(x, y + (off == null ? 4 : off), w, h, r); ctx.fill();
    ctx.fillStyle = fill || '#FFFFFF'; rr(x, y, w, h, r); ctx.fill();
  }
  function symbol(c, x, y, s, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    if (c === 0) { ctx.arc(x, y, s, 0, 6.2832); }
    else if (c === 1) { ctx.moveTo(x, y - s * 1.1); ctx.lineTo(x + s * 1.05, y + s * 0.75); ctx.lineTo(x - s * 1.05, y + s * 0.75); ctx.closePath(); }
    else { ctx.moveTo(x, y - s * 1.15); ctx.lineTo(x + s * 1.0, y); ctx.lineTo(x, y + s * 1.15); ctx.lineTo(x - s * 1.0, y); ctx.closePath(); }
    ctx.fill();
  }
  function star(x, y, r, pts, inner, rot) {
    ctx.beginPath();
    for (var i = 0; i < pts * 2; i++) {
      var a = rot + (i * Math.PI) / pts, rad = i % 2 ? r * inner : r;
      if (i) ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); else ctx.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fill();
  }

  // icons (drawn centered at x,y in a box of size s)
  function iconPause(x, y, s, col) { ctx.fillStyle = col; rr(x - s * 0.28, y - s * 0.3, s * 0.2, s * 0.6, s * 0.08); ctx.fill(); rr(x + s * 0.08, y - s * 0.3, s * 0.2, s * 0.6, s * 0.08); ctx.fill(); }
  function iconPlay(x, y, s, col) {
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(x - s * 0.24, y - s * 0.34); ctx.lineTo(x + s * 0.36, y); ctx.lineTo(x - s * 0.24, y + s * 0.34); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.12; ctx.strokeStyle = col; ctx.stroke(); ctx.fill();
  }
  function iconHome(x, y, s, col) {
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.1;
    ctx.beginPath(); ctx.moveTo(x - s * 0.36, y - s * 0.02); ctx.lineTo(x, y - s * 0.36); ctx.lineTo(x + s * 0.36, y - s * 0.02); ctx.closePath(); ctx.stroke(); ctx.fill();
    rr(x - s * 0.25, y - s * 0.06, s * 0.5, s * 0.38, s * 0.06); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; rr(x - s * 0.07, y + s * 0.1, s * 0.14, s * 0.22, s * 0.05); ctx.fill();
  }
  function iconSound(x, y, s, col, on) {
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = s * 0.09;
    ctx.beginPath(); ctx.moveTo(x - s * 0.34, y - s * 0.11); ctx.lineTo(x - s * 0.18, y - s * 0.11); ctx.lineTo(x + s * 0.02, y - s * 0.3);
    ctx.lineTo(x + s * 0.02, y + s * 0.3); ctx.lineTo(x - s * 0.18, y + s * 0.11); ctx.lineTo(x - s * 0.34, y + s * 0.11); ctx.closePath(); ctx.fill();
    if (on) {
      ctx.beginPath(); ctx.arc(x + s * 0.06, y, s * 0.16, -0.9, 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + s * 0.06, y, s * 0.3, -0.9, 0.9); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(x + s * 0.14, y - s * 0.12); ctx.lineTo(x + s * 0.36, y + s * 0.12);
      ctx.moveTo(x + s * 0.36, y - s * 0.12); ctx.lineTo(x + s * 0.14, y + s * 0.12); ctx.stroke();
    }
  }
  function iconMusic(x, y, s, col, on) {
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = s * 0.08;
    ctx.beginPath(); ctx.ellipse(x - s * 0.17, y + s * 0.2, s * 0.12, s * 0.09, -0.4, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + s * 0.19, y + s * 0.12, s * 0.12, s * 0.09, -0.4, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - s * 0.07, y + s * 0.2); ctx.lineTo(x - s * 0.07, y - s * 0.27); ctx.lineTo(x + s * 0.29, y - s * 0.35); ctx.lineTo(x + s * 0.29, y + s * 0.12); ctx.stroke();
    if (!on) { ctx.strokeStyle = C.coral; ctx.lineWidth = s * 0.09; ctx.beginPath(); ctx.moveTo(x - s * 0.36, y - s * 0.36); ctx.lineTo(x + s * 0.38, y + s * 0.38); ctx.stroke(); }
  }
  function iconRetry(x, y, s, col) {
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, s * 0.27, -0.6, 4.3); ctx.stroke();
    var a = -0.6, ex = x + Math.cos(a) * s * 0.27, ey = y + Math.sin(a) * s * 0.27;
    ctx.beginPath(); ctx.moveTo(ex + s * 0.17, ey - s * 0.02); ctx.lineTo(ex - s * 0.04, ey - s * 0.2); ctx.lineTo(ex - s * 0.07, ey + s * 0.1); ctx.closePath(); ctx.fill();
  }
  function iconCrown(x, y, s, col) {
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(x - s * 0.4, y + s * 0.26); ctx.lineTo(x - s * 0.44, y - s * 0.2); ctx.lineTo(x - s * 0.18, y + s * 0.02);
    ctx.lineTo(x, y - s * 0.32); ctx.lineTo(x + s * 0.18, y + s * 0.02); ctx.lineTo(x + s * 0.44, y - s * 0.2); ctx.lineTo(x + s * 0.4, y + s * 0.26);
    ctx.closePath(); ctx.fill();
  }
  function iconLock(x, y, s, col) {
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = s * 0.1;
    ctx.beginPath(); ctx.arc(x, y - s * 0.08, s * 0.17, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s * 0.17, y - s * 0.08); ctx.lineTo(x - s * 0.17, y); ctx.moveTo(x + s * 0.17, y - s * 0.08); ctx.lineTo(x + s * 0.17, y); ctx.stroke();
    rr(x - s * 0.27, y - s * 0.02, s * 0.54, s * 0.38, s * 0.08); ctx.fill();
  }
  function iconShield(x, y, s, col) {
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(x, y - s * 0.38); ctx.quadraticCurveTo(x + s * 0.2, y - s * 0.26, x + s * 0.34, y - s * 0.26);
    ctx.quadraticCurveTo(x + s * 0.34, y + s * 0.2, x, y + s * 0.4);
    ctx.quadraticCurveTo(x - s * 0.34, y + s * 0.2, x - s * 0.34, y - s * 0.26);
    ctx.quadraticCurveTo(x - s * 0.2, y - s * 0.26, x, y - s * 0.38); ctx.fill();
  }

  // round soft button
  function roundBtn(b, id, fill, shadowCol) {
    var s = pressed === id ? 0.92 : 1;
    var cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = (b.w / 2) * s;
    ctx.fillStyle = shadowCol || DK.white; circle(cx, cy + 4 * ui, r);
    ctx.fillStyle = fill || '#FFFFFF'; circle(cx, cy, r);
    return s;
  }

  // ---------------------------------------------------------------- draw: world
  function drawBackground(scroll) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < DEC.length; i++) {
      var d = DEC[i], s = d.s * ui;
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = d.col;
      if (d.k === 0) circle(0, 0, s * 0.5);
      else if (d.k === 1) { ctx.beginPath(); ctx.moveTo(0, -s * 0.55); ctx.lineTo(s * 0.5, s * 0.35); ctx.lineTo(-s * 0.5, s * 0.35); ctx.closePath(); ctx.fill(); }
      else if (d.k === 2) { rr(-s * 0.4, -s * 0.4, s * 0.8, s * 0.8, s * 0.2); ctx.fill(); }
      else if (d.k === 3) { ctx.beginPath(); ctx.moveTo(0, -s * 0.55); ctx.lineTo(s * 0.4, 0); ctx.lineTo(0, s * 0.55); ctx.lineTo(-s * 0.4, 0); ctx.closePath(); ctx.fill(); }
      else { ctx.strokeStyle = d.col; ctx.lineWidth = s * 0.16; ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, 6.2832); ctx.stroke(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    drawTrack(scroll);
  }

  function drawTrack(scroll) {
    var x = L.trackX, w = L.trackW, ppu = L.ppu;
    ctx.fillStyle = DK.track; rr(x + 6, -40, w, H + 80, 30); ctx.fill();
    ctx.fillStyle = '#FFFCF8'; rr(x, -40, w, H + 80, 30); ctx.fill();
    // speed bands
    var band = ppu * 2, off = (scroll * ppu) % band, y;
    ctx.fillStyle = 'rgba(185,167,245,0.07)';
    for (y = off - band; y < H; y += band) ctx.fillRect(x, y, w, ppu);
    // lane dashes
    ctx.fillStyle = 'rgba(138,135,166,0.2)';
    var dl = ppu * 0.55, dg = ppu * 1.3, doff = (scroll * ppu) % dg;
    for (var i = 1; i < 3; i++) {
      var lx = x + L.laneW * i - 2;
      for (y = doff - dg; y < H; y += dg) { rr(lx, y, 4, dl, 2); ctx.fill(); }
    }
    // prism rails on both edges
    var seg = ppu * 0.9, roff = (scroll * ppu) % (seg * 6), k = 0;
    var rw = Math.max(5, 7 * ui);
    for (y = roff - seg * 6; y < H; y += seg) {
      ctx.fillStyle = RAINBOW[((k % 6) + 6) % 6];
      ctx.fillRect(x + 4, y, rw, seg - 2);
      ctx.fillRect(x + w - 4 - rw, y, rw, seg - 2);
      k++;
    }
  }

  function drawGate(r, y) {
    var segs = r.segs, lw = L.laneW, h = L.gateH, isGate = segs[0] >= 0 || segs[1] >= 0 || segs[2] >= 0;
    if (isGate) {
      ctx.fillStyle = 'rgba(61,59,84,0.13)';
      ctx.fillRect(L.trackX + 8, y - 2, L.trackW - 16, 4);
    }
    for (var i = 0; i < 3; i++) {
      var g = segs[i], x0 = L.trackX + i * lw;
      if (g >= 0) {
        if (r.broken === i) continue;
        var pad = lw * 0.08, w = lw - 2 * pad, a = 1, sc = 1;
        if (r.passLane === i) { var k = r.fx / 0.32; if (k >= 1) continue; sc = 1 + k * 0.4; a = 1 - k; }
        var cx = x0 + lw / 2;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(cx, y); ctx.scale(sc, sc);
        ctx.fillStyle = ORB_D[g]; rr(-w / 2, -h / 2 + h * 0.24, w, h, h / 2); ctx.fill();
        ctx.fillStyle = ORB[g]; rr(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; rr(-w / 2 + h * 0.45, -h / 2 + h * 0.16, w - h * 0.9, h * 0.2, h * 0.1); ctx.fill();
        symbol(g, 0, h * 0.04, h * 0.27, 'rgba(61,59,84,0.55)');
        ctx.restore();
      } else if (g === BLOCK) {
        if (r.broken === i) continue;
        var bw = lw * 0.7, bh = Math.min(lw * 0.6, L.ppu * 0.95), bx = x0 + (lw - bw) / 2, by = y - bh / 2, br = Math.min(bw, bh) * 0.22;
        ctx.fillStyle = '#4F4C6E'; rr(bx, by + bh * 0.14, bw, bh, br); ctx.fill();
        ctx.fillStyle = '#6F6B93'; rr(bx, by, bw, bh, br); ctx.fill();
        ctx.fillStyle = '#8D89B2'; rr(bx + bw * 0.08, by + bh * 0.08, bw * 0.84, bh * 0.3, br * 0.7); ctx.fill();
        // little "x" marks so blocks never read as gates
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(2, bh * 0.07); ctx.lineCap = 'round';
        var mx = bx + bw / 2, my = by + bh * 0.66, ms = bh * 0.14;
        ctx.beginPath(); ctx.moveTo(mx - ms, my - ms); ctx.lineTo(mx + ms, my + ms); ctx.moveTo(mx + ms, my - ms); ctx.lineTo(mx - ms, my + ms); ctx.stroke();
      }
    }
    if (isGate) {
      var pr = Math.max(5, h * 0.3);
      ctx.fillStyle = DK.lavender; circle(L.trackX + 9, y + 2, pr); circle(L.trackX + L.trackW - 9, y + 2, pr);
      ctx.fillStyle = C.lavender; circle(L.trackX + 9, y, pr); circle(L.trackX + L.trackW - 9, y, pr);
    }
  }

  function drawPick(p, y) {
    var x = laneX(p.lane), s = L.orbR;
    if (p.kind === 1) {
      var sx = Math.cos(time * 4 + p.z) * 0.9;
      ctx.save(); ctx.translate(x, y); ctx.scale(Math.abs(sx) * 0.7 + 0.3, 1);
      ctx.fillStyle = DK.butter; symbol(2, 0, s * 0.12, s * 0.5, DK.butter);
      symbol(2, 0, 0, s * 0.5, C.butter);
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(s * 0.22, -s * 0.05); ctx.lineTo(0, -s * 0.05); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (p.kind === 2) {
      var b = s * (0.8 + Math.sin(time * 5) * 0.05);
      ctx.globalAlpha = 0.35; ctx.fillStyle = C.sky; circle(x, y, b * 1.25); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(167,211,245,0.75)'; circle(x, y, b);
      ctx.strokeStyle = C.mint; ctx.lineWidth = Math.max(2, s * 0.12); ctx.beginPath(); ctx.arc(x, y, b, 0, 6.2832); ctx.stroke();
      iconShield(x, y + s * 0.02, b * 1.1, 'rgba(61,59,84,0.5)');
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(2, s * 0.1); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, y, b * 0.72, 3.6, 4.5); ctx.stroke();
    } else {
      var rs = s * (0.85 + Math.sin(time * 6) * 0.08);
      ctx.globalAlpha = 0.35; ctx.fillStyle = C.lavender; circle(x, y, rs * 1.3); ctx.globalAlpha = 1;
      ctx.fillStyle = DK.lavender; star(x, y + s * 0.1, rs, 5, 0.5, -Math.PI / 2 + time);
      ctx.fillStyle = C.lavender; star(x, y, rs, 5, 0.5, -Math.PI / 2 + time);
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(x, y, rs * 0.2);
    }
  }

  function drawTrail(oy, ppu, scroll, r, style, tf) {
    if (!trCount || tf <= 0) return;
    var prevX = 0, prevY = 0, has = false;
    for (var i = 0; i < trCount; i++) {
      var k = (trHead - 1 - i + TN) % TN;
      var back = scroll - trD[k];
      var age = back / TRAIL_LEN;
      if (age > 1) break;
      if (age < 0) continue;
      var x = laneX(trX[k]), y = oy + back * ppu, col = ORB[trC[k]], id = trTotal - 1 - i, inv = 1 - age;
      if (style === 0) {
        ctx.globalAlpha = tf * 0.4 * inv; ctx.fillStyle = col; circle(x, y, r * 0.9 * inv);
      } else if (style === 1) {
        if (id % 5 === 0) {
          var bx = x + Math.sin(id * 1.7 + time * 3) * r * 0.7 * age;
          var br = r * (0.22 + ((id * 37) % 10) / 30) * (0.6 + age * 0.6);
          ctx.globalAlpha = tf * 0.85 * inv; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, r * 0.1);
          ctx.beginPath(); ctx.arc(bx, y, br, 0, 6.2832); ctx.stroke();
          ctx.fillStyle = '#FFFFFF'; circle(bx - br * 0.35, y - br * 0.35, br * 0.22);
        }
        if (i < 8) { ctx.globalAlpha = tf * 0.25 * inv; ctx.fillStyle = col; circle(x, y, r * 0.7 * inv); }
      } else if (style === 2) {
        ctx.globalAlpha = tf * 0.18 * inv; ctx.fillStyle = col; circle(x, y, r * 0.6 * inv);
        if (id % 4 === 0) {
          var sx = x + (((id * 53) % 11) - 5) / 5 * r * 0.8;
          ctx.globalAlpha = tf * inv; ctx.fillStyle = id % 8 === 0 ? C.butter : (id % 12 === 0 ? '#FFFFFF' : col);
          star(sx, y, r * 0.42 * (0.4 + inv * 0.6), 4, 0.35, id + time * 2);
        }
      } else if (style === 3) {
        if (has) {
          ctx.globalAlpha = tf * 0.9 * inv; ctx.strokeStyle = RAINBOW[((id / 3) | 0) % 6];
          ctx.lineWidth = r * 1.15 * inv + 1; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(prevX, prevY); ctx.lineTo(x, y); ctx.stroke();
        }
      } else {
        ctx.globalAlpha = tf * 0.22 * inv; ctx.fillStyle = col; circle(x, y, r * 1.25 * Math.pow(inv, 0.6));
        ctx.globalAlpha = tf * 0.55 * inv; ctx.fillStyle = '#FFFFFF'; circle(x, y, r * 0.45 * inv);
        if (id % 6 === 0) {
          var cxp = x + (((id * 29) % 13) - 6) / 6 * r * 1.6 * age;
          ctx.globalAlpha = tf * inv; ctx.fillStyle = RAINBOW[(id / 6 | 0) % 6];
          ctx.save(); ctx.translate(cxp, y); ctx.rotate(id + time * 4); ctx.fillRect(-r * 0.16, -r * 0.1, r * 0.32, r * 0.2); ctx.restore();
        }
      }
      prevX = x; prevY = y; has = true;
    }
    ctx.globalAlpha = 1;
  }

  function drawOrb(x, y, r, ci, sx, sy, tilt, next) {
    ctx.globalAlpha = 0.18; ctx.fillStyle = ORB[ci]; circle(x, y, r * 1.95);
    ctx.globalAlpha = 0.3; circle(x, y, r * 1.42);
    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(sx, sy);
    ctx.fillStyle = ORB_D[ci]; circle(0, r * 0.15, r);
    ctx.fillStyle = ORB[ci]; circle(0, 0, r);
    // prism facets
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1.5, r * 0.08); ctx.lineJoin = 'round';
    var a0 = time * 1.2;
    ctx.beginPath();
    for (var i = 0; i < 3; i++) {
      var a = a0 + i * 2.094;
      if (i) ctx.lineTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55); else ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
    }
    ctx.closePath(); ctx.stroke();
    symbol(ci, 0, 0, r * 0.18, 'rgba(61,59,84,0.4)');
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(-r * 0.5, -r * 0.48, r * 0.2, r * 0.11, -0.75, 0, 6.2832); ctx.fill();
    ctx.restore();
    if (next >= 0) {
      var ang = -Math.PI / 4;
      var nx = x + Math.cos(ang) * r * 1.3, ny = y + Math.sin(ang) * r * 1.3, nr = Math.max(4, r * 0.27);
      ctx.fillStyle = '#FFFFFF'; circle(nx, ny, nr + 2);
      ctx.fillStyle = ORB[next]; circle(nx, ny, nr);
    }
  }

  function drawPlayer() {
    var x = laneX(P.x), y = L.playerY, r = L.orbR;
    if (P.alive) {
      var sq = P.squash, pop = P.shiftT;
      var sx = 1 + 0.32 * sq + 0.18 * pop, sy = 1 - 0.22 * sq + 0.18 * pop;
      drawOrb(x, y, r, P.color, sx, sy, P.dir * sq * 0.25, (P.color + 1) % 3);
      if (pop > 0) {
        ctx.globalAlpha = pop; ctx.strokeStyle = ORB[P.color]; ctx.lineWidth = 4 * ui;
        ctx.beginPath(); ctx.arc(x, y, r * (1.2 + (1 - pop) * 1.2), 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (P.shield || P.inv > 0) {
        var b = r * (1.55 + Math.sin(time * 6) * 0.05);
        ctx.globalAlpha = P.shield ? 1 : clamp(P.inv * 2, 0, 1) * (Math.sin(time * 40) > 0 ? 1 : 0.3);
        ctx.fillStyle = 'rgba(167,211,245,0.22)'; circle(x, y, b);
        ctx.strokeStyle = 'rgba(120,174,220,0.8)'; ctx.lineWidth = Math.max(2, r * 0.1);
        ctx.beginPath(); ctx.arc(x, y, b, 0, 6.2832); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x, y, b * 0.82, 3.5, 4.4); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawParticles() {
    for (var i = 0; i < PN; i++) {
      var p = parts[i];
      if (!p.on) continue;
      var a = p.life / p.max, s = p.size * (p.shape === 3 ? 1 : 0.4 + 0.6 * a);
      ctx.globalAlpha = Math.min(1, a * 1.4);
      ctx.fillStyle = p.col;
      if (p.shape === 0) circle(p.x, p.y, s);
      else if (p.shape === 2) star(p.x, p.y, s * 1.3, 4, 0.4, p.rot);
      else {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        if (p.shape === 1) { ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.9, s * 0.7); ctx.lineTo(-s * 0.7, s * 0.5); ctx.closePath(); ctx.fill(); }
        else ctx.fillRect(-s * 0.5, -s * 0.3, s, s * 0.6);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < floats.length; i++) {
      var f = floats[i];
      if (!f.on) continue;
      ctx.globalAlpha = clamp((0.9 - f.t) * 3, 0, 1);
      var sc = f.t < 0.15 ? easeOutBack(f.t / 0.15) : 1;
      label(f.str, f.x, f.y, 22 * ui * sc, f.col, { outline: '#FFFFFF', wt: 900 });
    }
    ctx.globalAlpha = 1;
  }

  function drawWorld() {
    var sx = 0, sy = 0;
    if (shake > 0.02) { sx = (Math.random() - 0.5) * shake * 14 * ui; sy = (Math.random() - 0.5) * shake * 14 * ui; }
    ctx.save(); ctx.translate(sx, sy);
    drawBackground(dist);
    var i, topZ = dist + (L.playerY + 80) / L.ppu, botZ = dist - (H - L.playerY + 100) / L.ppu;
    for (i = 0; i < picks.length; i++) {
      var p = picks[i];
      if (p.taken || p.z > topZ || p.z < botZ) continue;
      drawPick(p, rowY(p.z));
    }
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.z > topZ || r.z < botZ) continue;
      drawGate(r, rowY(r.z));
    }
    drawTrail(L.playerY, L.ppu, dist, L.orbR, save.trail, P.alive ? 1 : clamp(dying / 0.5, 0, 1));
    drawPlayer();
    if (state !== 'over') drawParticles();
    if (slowT > 0 || timeScale < 0.97) {
      ctx.globalAlpha = clamp((1 - timeScale) * 2.2, 0, 0.9) * 0.35;
      ctx.fillStyle = C.lavender;
      ctx.fillRect(0, 0, W, 10 * ui); ctx.fillRect(0, H - 10 * ui, W, 10 * ui);
      ctx.fillRect(0, 0, 10 * ui, H); ctx.fillRect(W - 10 * ui, 0, 10 * ui, H);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (flash > 0) { ctx.globalAlpha = flash * 0.28; ctx.fillStyle = C.coral; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }

  // ---------------------------------------------------------------- draw: HUD + overlays
  function drawColorRing(cx, cy, R) {
    var cur = P.color, nxt = (cur + 1) % 3;
    ctx.fillStyle = DK.white; circle(cx, cy + 4, R + 5);
    ctx.fillStyle = '#FFFFFF'; circle(cx, cy, R + 5);
    ctx.strokeStyle = ORB[nxt]; ctx.lineWidth = R * 0.3; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.8, 0, 6.2832); ctx.stroke();
    // direction chevrons on the ring: next color comes after a tap
    ctx.fillStyle = 'rgba(61,59,84,0.6)';
    for (var i = 0; i < 3; i++) {
      var a = time * 0.8 + i * 2.094, px = cx + Math.cos(a) * R * 0.8, py = cy + Math.sin(a) * R * 0.8;
      ctx.save(); ctx.translate(px, py); ctx.rotate(a + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(R * 0.1, 0); ctx.lineTo(-R * 0.06, -R * 0.09); ctx.lineTo(-R * 0.06, R * 0.09); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    var pop = 1 + P.shiftT * 0.25;
    ctx.fillStyle = ORB_D[cur]; circle(cx, cy + 2, R * 0.55 * pop);
    ctx.fillStyle = ORB[cur]; circle(cx, cy, R * 0.55 * pop);
    symbol(cur, cx, cy, R * 0.17, 'rgba(61,59,84,0.55)');
  }

  function drawHUD() {
    var m = 16;
    // pause button
    if (!pauseMode && P.alive) {
      var s = roundBtn(L.pause, 'pause');
      iconPause(L.pause.x + L.pause.w / 2, L.pause.y + L.pause.h / 2, L.pause.w * 0.62 * s, C.ink);
    }
    // score
    var cx = W / 2, sy = m + 26 * ui;
    label(String(score), cx, sy, 40 * ui, C.ink, { outline: C.bg, wt: 900, ow: 7 * ui });
    var bestShown = Math.max(save.best, score), beating = save.best > 0 && score > save.best;
    setFont(15 * ui, 800);
    var bstr = String(bestShown), bw = ctx.measureText(bstr).width;
    var by = sy + 30 * ui;
    iconCrown(cx - bw / 2 - 11 * ui, by, 18 * ui, beating ? DK.coral : DK.butter);
    label(bstr, cx + 6 * ui, by, 15 * ui, beating ? DK.coral : C.inkSoft, { outline: C.bg, ow: 5 * ui });

    // combo meter
    var mlt = mult(), cy2 = by + 30 * ui, pw = 112 * ui, ph = 26 * ui;
    var popS = 1 + comboPop * 0.25;
    ctx.save(); ctx.translate(cx, cy2); ctx.scale(popS, popS);
    softPanel(-pw / 2, -ph / 2, pw, ph, ph / 2, '#FFFFFF', DK.white, 3);
    label('x' + mlt, -pw / 2 + 20 * ui, 0, 16 * ui, mlt > 1 ? DK.coral : C.inkSoft, { wt: 900 });
    var bx = -pw / 2 + 40 * ui, bwid = pw - 52 * ui, bh2 = 8 * ui;
    ctx.fillStyle = '#F1E7F3'; rr(bx, -bh2 / 2, bwid, bh2, bh2 / 2); ctx.fill();
    var prog = mlt >= 8 ? 1 : (combo % 4) / 4;
    if (prog > 0) {
      ctx.fillStyle = mlt >= 8 ? RAINBOW[((time * 8) | 0) % 6] : C.butter;
      rr(bx, -bh2 / 2, Math.max(bh2, bwid * prog), bh2, bh2 / 2); ctx.fill();
    }
    for (var i = 1; i < 4; i++) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(bx + bwid * i / 4 - 1, -bh2 / 2, 2, bh2); }
    ctx.restore();

    // color ring (current color + next color)
    drawColorRing(L.ringX, L.ringY, L.ringR);
    // status chips under the ring
    var chipY = L.ringY + L.ringR + 24 * ui;
    if (P.shield) { ctx.fillStyle = '#FFFFFF'; circle(L.ringX, chipY, 15 * ui); iconShield(L.ringX, chipY, 22 * ui, DK.sky); chipY += 36 * ui; }
    if (slowT > 0) {
      ctx.fillStyle = '#FFFFFF'; circle(L.ringX, chipY, 15 * ui);
      ctx.strokeStyle = C.lavender; ctx.lineWidth = 4 * ui;
      ctx.beginPath(); ctx.arc(L.ringX, chipY, 15 * ui, -Math.PI / 2, -Math.PI / 2 + 6.2832 * clamp(slowT / 4.5, 0, 1)); ctx.stroke();
      ctx.fillStyle = DK.lavender; star(L.ringX, chipY, 8 * ui, 5, 0.5, -Math.PI / 2);
    }
  }

  // A simple pointing hand: outlines first, then white fills on top, so the parts merge.
  function drawFinger(x, y, s, pressedAmt) {
    var k = 1 - pressedAmt * 0.12, lw = Math.max(3, s * 0.09);
    ctx.save(); ctx.translate(x, y + s * 0.28); ctx.scale(k, k); ctx.rotate(-0.25);
    var parts = [
      [-s * 0.09, -s * 0.5, s * 0.18, s * 0.6, s * 0.09],   // index finger
      [-s * 0.22, -s * 0.06, s * 0.48, s * 0.42, s * 0.16], // palm
      [-s * 0.33, -s * 0.02, s * 0.16, s * 0.3, s * 0.08]   // thumb
    ];
    var i;
    ctx.fillStyle = C.ink;
    for (i = 0; i < parts.length; i++) { var q = parts[i]; rr(q[0] - lw / 2, q[1] - lw / 2, q[2] + lw, q[3] + lw, q[4] + lw / 2); ctx.fill(); }
    ctx.fillStyle = '#FFFFFF';
    for (i = 0; i < parts.length; i++) { var q2 = parts[i]; rr(q2[0], q2[1], q2[2], q2[3], q2[4]); ctx.fill(); }
    ctx.fillStyle = 'rgba(61,59,84,0.25)';
    rr(s * 0.0, s * 0.02, s * 0.03, s * 0.16, s * 0.015); ctx.fill();
    rr(s * 0.11, s * 0.02, s * 0.03, s * 0.16, s * 0.015); ctx.fill();
    ctx.restore();
  }

  function drawKeycap(x, y, w, h, str) {
    softPanel(x - w / 2, y - h / 2, w, h, 8 * ui, '#FFFFFF', '#D9CBDE', 4);
    label(str, x, y, h * 0.5, C.ink, { wt: 900 });
  }

  function drawHint() {
    if (!tutorialOn || !P.alive || pauseMode) return;
    var hint = 0, i;
    for (i = 0; i < rows.length; i++) { var r = rows[i]; if (!r.res) { if (r.z - dist < VIS + 3) hint = r.hint; break; } }
    if (!hint) return;
    var key = lastInput === 'key';
    var str = hint === 1 ? tr(key ? 'hintMoveKey' : 'hintMove') : hint === 2 ? tr(key ? 'hintColorKey' : 'hintColor') : tr('hintMatch');
    var y = H * 0.33, sz = 20 * ui;
    var tw = fitFont(str, sz, 800, L.trackW - 40);
    var w = Math.min(L.trackW - 20, ctx.measureText(str).width + 44 * ui), h = 44 * ui;
    var bob = Math.sin(time * 3) * 3 * ui;
    softPanel(W / 2 - w / 2, y - h / 2 + bob, w, h, h / 2, '#FFFFFF', DK.white, 4);
    label(str, W / 2, y + bob, tw, C.ink);
    var iy = y + h + 24 * ui, s = 54 * ui;
    if (hint === 1) {
      if (key) { drawKeycap(W / 2 - 34 * ui, iy, 50 * ui, 44 * ui, '←'); drawKeycap(W / 2 + 34 * ui, iy, 50 * ui, 44 * ui, '→'); }
      else {
        var ph = (time * 0.9) % 1, fx = W / 2 + Math.sin(ph * 6.2832) * L.laneW * 0.6;
        ctx.strokeStyle = 'rgba(61,59,84,0.35)'; ctx.lineWidth = 4 * ui; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(W / 2 - L.laneW * 0.75, iy); ctx.lineTo(W / 2 + L.laneW * 0.75, iy); ctx.stroke();
        ctx.fillStyle = 'rgba(61,59,84,0.35)';
        ctx.beginPath(); ctx.moveTo(W / 2 - L.laneW * 0.85, iy); ctx.lineTo(W / 2 - L.laneW * 0.7, iy - 9 * ui); ctx.lineTo(W / 2 - L.laneW * 0.7, iy + 9 * ui); ctx.fill();
        ctx.beginPath(); ctx.moveTo(W / 2 + L.laneW * 0.85, iy); ctx.lineTo(W / 2 + L.laneW * 0.7, iy - 9 * ui); ctx.lineTo(W / 2 + L.laneW * 0.7, iy + 9 * ui); ctx.fill();
        drawFinger(fx, iy - s * 0.05, s, 0);
      }
    } else if (hint === 2) {
      if (key) drawKeycap(W / 2, iy, 130 * ui, 44 * ui, 'Space');
      else {
        var tp = (time * 1.4) % 1, press = tp < 0.25 ? tp / 0.25 : 0;
        if (tp < 0.6) { ctx.globalAlpha = 1 - tp / 0.6; ctx.strokeStyle = ORB[(P.color + 1) % 3]; ctx.lineWidth = 5 * ui; ctx.beginPath(); ctx.arc(W / 2, iy, 10 * ui + tp * 50 * ui, 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1; }
        drawFinger(W / 2, iy - s * 0.05, s, press);
      }
    } else {
      // show "orb color = gate color"
      var c = P.color, gx = W / 2 - 40 * ui, gw = 50 * ui, gh = 20 * ui;
      ctx.fillStyle = ORB_D[c]; rr(gx - gw / 2, iy - gh / 2 + 4, gw, gh, gh / 2); ctx.fill();
      ctx.fillStyle = ORB[c]; rr(gx - gw / 2, iy - gh / 2, gw, gh, gh / 2); ctx.fill();
      symbol(c, gx, iy, gh * 0.27, 'rgba(61,59,84,0.55)');
      label('=', W / 2, iy, 24 * ui, C.ink, { wt: 900 });
      drawOrb(W / 2 + 40 * ui, iy, 15 * ui, c, 1, 1, 0, -1);
    }
  }

  function veil(a) { ctx.globalAlpha = a; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }

  function drawPauseMenu() {
    veil(0.8);
    label(tr('paused'), W / 2, H * 0.27, 46 * ui, C.ink, { wt: 900, shadow: C.lavender, so: 4 * ui, maxW: W - 40 });
    var b = L.resume, pulse = 1 + Math.sin(time * 4) * 0.03;
    var cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = b.w / 2 * (pressed === 'resume' ? 0.93 : pulse);
    ctx.fillStyle = DK.mint; circle(cx, cy + 6 * ui, r);
    ctx.fillStyle = C.mint; circle(cx, cy, r);
    iconPlay(cx + r * 0.08, cy, r * 1.0, C.ink);
    label(tr('tapContinue'), W / 2, b.y + b.h + 34 * ui, 20 * ui, C.inkSoft, { maxW: W - 40 });
    var s;
    s = roundBtn(L.home, 'home'); iconHome(L.home.x + L.home.w / 2, L.home.y + L.home.h / 2, L.home.w * 0.62 * s, C.ink);
    s = roundBtn(L.psound, 'psound'); iconSound(L.psound.x + L.psound.w / 2, L.psound.y + L.psound.h / 2, L.psound.w * 0.62 * s, C.ink, save.sound);
    s = roundBtn(L.pmusic, 'pmusic'); iconMusic(L.pmusic.x + L.pmusic.w / 2, L.pmusic.y + L.pmusic.h / 2, L.pmusic.w * 0.62 * s, C.ink, save.music);
  }

  function drawCountdown() {
    veil(0.35);
    var n = Math.ceil(countT / COUNT_STEP), frac = 1 - (countT - (n - 1) * COUNT_STEP) / COUNT_STEP;
    var R = 62 * ui, cx = W / 2, cy = H * 0.45;
    ctx.fillStyle = DK.white; circle(cx, cy + 5, R);
    ctx.fillStyle = '#FFFFFF'; circle(cx, cy, R);
    ctx.strokeStyle = ORB[(3 - n) % 3]; ctx.lineWidth = 9 * ui; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, R - 10 * ui, -Math.PI / 2, -Math.PI / 2 + 6.2832 * frac); ctx.stroke();
    var sc = easeOutBack(clamp(frac * 3, 0, 1));
    label(String(n), cx, cy + 3 * ui, 64 * ui * sc, C.ink, { wt: 900 });
  }

  function drawGameOver() {
    var k = clamp(overT / 0.35, 0, 1), cu = L.cu;
    veil(0.6 * k);
    var slide = (1 - easeOutBack(k)) * 60 * cu;
    ctx.save(); ctx.translate(0, slide); ctx.globalAlpha = k;
    var cw = L.cardW, x = W / 2 - cw / 2, top = L.cardTop;
    softPanel(x, top, cw, L.cardH, 28 * cu, '#FFFFFF', DK.white, 7 * cu);
    // header ribbon
    var hh = 52 * cu;
    if (newBestFlag) {
      var wob = Math.sin(time * 5) * 0.04;
      ctx.save(); ctx.translate(W / 2, top); ctx.rotate(wob);
      var rw = Math.min(cw * 0.9, 262 * cu);
      softPanel(-rw / 2, -hh / 2, rw, hh, hh / 2, C.butter, DK.butter, 5 * cu);
      iconCrown(-rw / 2 + 28 * cu, 0, 26 * cu, DK.coral);
      label(tr('newBest'), 14 * cu, 1, 22 * cu, C.ink, { wt: 900, maxW: rw - 90 * cu });
      ctx.restore();
    } else {
      var rw2 = Math.min(cw * 0.86, 220 * cu);
      softPanel(W / 2 - rw2 / 2, top - hh / 2, rw2, hh, hh / 2, C.lavender, DK.lavender, 5 * cu);
      label(tr('shattered'), W / 2, top + 1, 22 * cu, C.ink, { wt: 900, maxW: rw2 - 24 * cu });
    }
    // score
    var shown = Math.floor(score * clamp(overT / 0.6, 0, 1));
    label(String(shown), W / 2, top + 96 * cu, 64 * cu, C.ink, { wt: 900, shadow: newBestFlag ? C.butter : C.peach, so: 5 * cu });
    // best row
    setFont(18 * cu, 800);
    var bstr = tr('best') + '  ' + save.best, bw = ctx.measureText(bstr).width;
    iconCrown(W / 2 - bw / 2 - 14 * cu, top + 148 * cu, 20 * cu, DK.butter);
    label(bstr, W / 2 + 8 * cu, top + 148 * cu, 18 * cu, C.inkSoft);
    if (newTrail >= 0) {
      var ty = top + 186 * cu;
      label(tr('newTrail'), W / 2, ty, 16 * cu, DK.lavender, { wt: 900, maxW: cw - 40 * cu });
    } else {
      // little run stats as icons: gates passed + best combo
      var sy = top + 186 * cu;
      ctx.fillStyle = DK.sky; rr(W / 2 - 70 * cu, sy - 5 * cu, 24 * cu, 12 * cu, 6 * cu); ctx.fill();
      ctx.fillStyle = C.sky; rr(W / 2 - 70 * cu, sy - 7 * cu, 24 * cu, 12 * cu, 6 * cu); ctx.fill();
      label(String(gatesPassed), W / 2 - 40 * cu, sy, 16 * cu, C.inkSoft, { align: 'left' });
      label('x' + bestCombo, W / 2 + 43 * cu, sy, 16 * cu, C.inkSoft, { align: 'left' });
      ctx.fillStyle = C.butter; star(W / 2 + 28 * cu, sy, 9 * cu, 5, 0.5, -Math.PI / 2);
    }
    // buttons
    var s = roundBtn(L.menu, 'menu', '#F6EEF8', '#E2D6E6');
    iconHome(L.menu.x + L.menu.w / 2, L.menu.y + L.menu.h / 2, L.menu.w * 0.58 * s, C.ink);
    var b = L.retry, ps = pressed === 'retry' ? 0.95 : 1 + Math.sin(time * 4) * 0.02;
    ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.scale(ps, ps);
    softPanel(-b.w / 2, -b.h / 2, b.w, b.h, b.h / 2, C.mint, DK.mint, 6 * cu);
    var rsz = fitFont(tr('retry'), b.h * 0.36, 900, b.w - b.h * 1.3), ric = b.h * 0.62;
    var rtw = ctx.measureText(tr('retry')).width, rgx = -(rtw + ric + 6 * cu) / 2;
    iconRetry(rgx + ric / 2, 0, ric, C.ink);
    label(tr('retry'), rgx + ric + 6 * cu, 2 * cu, rsz, C.ink, { align: 'left', wt: 900 });
    ctx.restore();
    if (overT > 0.35) {
      ctx.globalAlpha = k * (0.6 + 0.4 * Math.sin(time * 4));
      label(tr('tapRetry'), W / 2, top + L.cardH + 34 * cu, 18 * cu, C.inkSoft, { maxW: W - 40 });
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- draw: title
  function drawLogo(cx, y) {
    var word = 'PRISM', sz = Math.min(78 * ui, W / 5.2), cols = [C.pink, C.peach, C.butter, C.mint, C.sky], dcols = [DK.pink, DK.peach, DK.butter, DK.mint, DK.sky];
    setFont(sz, 900);
    var sp = sz * 0.04, widths = [], total = 0, i;
    for (i = 0; i < word.length; i++) { widths.push(ctx.measureText(word[i]).width); total += widths[i] + (i ? sp : 0); }
    var x = cx - total / 2;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (i = 0; i < word.length; i++) {
      var by = y + Math.sin(time * 2.2 + i * 0.7) * 4 * ui;
      ctx.lineWidth = Math.max(4, sz * 0.12); ctx.strokeStyle = C.ink;
      ctx.fillStyle = C.ink; ctx.strokeText(word[i], x, by + sz * 0.09); ctx.fillText(word[i], x, by + sz * 0.09);
      ctx.strokeText(word[i], x, by);
      ctx.fillStyle = dcols[i]; ctx.fillText(word[i], x, by);
      ctx.save(); ctx.beginPath(); ctx.rect(x - 4, by - sz, widths[i] + 8, sz * 0.92); ctx.clip();
      ctx.fillStyle = cols[i]; ctx.fillText(word[i], x, by); ctx.restore();
      x += widths[i] + sp;
    }
    // RUNNER with letter spacing, between two little prisms
    var rs = sz * 0.36, word2 = 'RUNNER';
    setFont(rs, 900);
    var gap = rs * 0.42, w2 = 0, ws = [];
    for (i = 0; i < word2.length; i++) { ws.push(ctx.measureText(word2[i]).width); w2 += ws[i] + (i ? gap : 0); }
    var ry = y + sz * 0.86, rx = cx - w2 / 2;
    for (i = 0; i < word2.length; i++) {
      ctx.fillStyle = C.lavender; ctx.fillText(word2[i], rx, ry + rs * 0.08);
      ctx.fillStyle = C.ink; ctx.fillText(word2[i], rx, ry);
      rx += ws[i] + gap;
    }
    var dx = w2 / 2 + rs * 0.9;
    symbol(2, cx - dx, ry, rs * 0.3, C.pink);
    symbol(2, cx + dx, ry, rs * 0.3, C.sky);
  }

  function drawTrailIcon(style, cx, cy, s, unlocked) {
    if (!unlocked) {
      iconLock(cx, cy - s * 0.1, s * 0.5, '#B7B2C9');
      label(String(TRAIL_REQ[style]), cx, cy + s * 0.27, s * 0.2, C.inkSoft, { wt: 900, maxW: s * 0.9 });
      return;
    }
    var r = s * 0.11, oy = cy - s * 0.2, i;
    for (i = 4; i >= 0; i--) {
      var y = oy + i * s * 0.1, x = cx + Math.sin(i * 0.9 + time * 2) * s * 0.06, inv = 1 - i / 5;
      if (style === 0) { ctx.globalAlpha = 0.45 * inv; ctx.fillStyle = C.pink; circle(x, y, r * inv * 1.1); }
      else if (style === 1) { if (i % 2 === 0 && i) { ctx.globalAlpha = 0.9; ctx.strokeStyle = C.sky; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + (i === 2 ? -r : r), y, r * 0.6, 0, 6.2832); ctx.stroke(); } }
      else if (style === 2) { if (i) { ctx.globalAlpha = inv + 0.2; ctx.fillStyle = i % 2 ? C.butter : C.mint; star(x + (i % 2 ? r : -r), y, r * 0.75, 4, 0.35, time + i); } }
      else if (style === 3) { ctx.globalAlpha = 0.95; ctx.fillStyle = RAINBOW[i]; circle(x, y, r * (1.1 - i * 0.12)); }
      else { ctx.globalAlpha = 0.3 * inv + 0.1; ctx.fillStyle = C.lavender; circle(cx, y, r * 1.4 * inv + 2); if (i) { ctx.globalAlpha = 1; ctx.fillStyle = RAINBOW[i]; ctx.fillRect(cx + (i % 2 ? r : -r * 1.6), y, r * 0.6, r * 0.4); } }
    }
    ctx.globalAlpha = 1;
    var head = [C.pink, C.sky, C.mint, C.pink, C.lavender][style];
    ctx.fillStyle = DK.white; circle(cx, oy + 2, r * 1.2);
    ctx.fillStyle = head; circle(cx, oy, r * 1.2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(cx - r * 0.4, oy - r * 0.4, r * 0.35);
  }

  function drawTitle() {
    drawBackground(titleDist);
    ctx.globalAlpha = 0.35; ctx.fillStyle = C.bg; ctx.fillRect(L.trackX, 0, L.trackW, H); ctx.globalAlpha = 1;
    drawLogo(W / 2, L.logoY);
    // demo orb with the selected trail
    var tppu = 34 * ui, oy = L.titleOrbY, r = Math.min(L.orbR, 26 * ui);
    var savedW = L.laneW, savedX = L.trackX;
    L.laneW = Math.min(savedW, 90 * ui); L.trackX = W / 2 - L.laneW * 1.5;
    drawTrail(oy, tppu, titleDist, r, save.trail, 1);
    var lf = 1 + Math.sin(titleT * 1.5) * 0.85;
    drawOrb(laneX(lf), oy, r, Math.floor(titleT / 1.6) % 3, 1, 1, Math.cos(titleT * 1.5) * 0.15, -1);
    L.laneW = savedW; L.trackX = savedX;
    drawParticles();

    // play button
    var b = L.play, s = pressed === 'play' ? 0.95 : 1 + Math.sin(time * 3) * 0.015;
    ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.scale(s, s);
    softPanel(-b.w / 2, -b.h / 2, b.w, b.h, b.h / 2, C.butter, DK.butter, 7 * ui);
    var tsz = fitFont(tr('play'), b.h * 0.42, 900, b.w - b.h * 1.5);
    setFont(tsz, 900);
    var tw = ctx.measureText(tr('play')).width, ic = b.h * 0.5, gx = -(tw + ic + 10 * ui) / 2;
    iconPlay(gx + ic * 0.4, 0, ic, C.ink);
    label(tr('play'), gx + ic + 10 * ui, 2 * ui, tsz, C.ink, { align: 'left', wt: 900 });
    ctx.restore();
    // best
    if (save.best > 0) {
      setFont(19 * ui, 800);
      var bstr = tr('best') + '  ' + save.best, bw = ctx.measureText(bstr).width;
      iconCrown(W / 2 - bw / 2 - 14 * ui, L.bestY, 22 * ui, DK.butter);
      label(bstr, W / 2 + 10 * ui, L.bestY, 19 * ui, C.inkSoft);
    }
    // trails
    label(tr('trails'), W / 2, L.trailLabelY, 15 * ui, C.inkSoft, { wt: 900 });
    for (var i = 0; i < 5; i++) {
      var tb = L.trails[i], un = trailUnlocked(i), sel = save.trail === i;
      var shk = Math.sin(lockShake[i] * 30) * lockShake[i] * 6;
      var ps = pressed === 'trail' + i ? 0.93 : 1;
      ctx.save(); ctx.translate(tb.x + tb.w / 2 + shk, tb.y + tb.h / 2 - (sel ? 4 * ui : 0)); ctx.scale(ps, ps);
      if (sel) { ctx.fillStyle = C.lavender; rr(-tb.w / 2 - 4, -tb.h / 2 - 4, tb.w + 8, tb.h + 8, tb.w * 0.3); ctx.fill(); }
      softPanel(-tb.w / 2, -tb.h / 2, tb.w, tb.h, tb.w * 0.26, un ? '#FFFFFF' : '#F4EDF2', un ? DK.white : '#E4D9E2', 4);
      drawTrailIcon(i, 0, 0, tb.w, un);
      ctx.restore();
    }
    var nm = (tr('trailNames') || [])[save.trail] || '';
    label(nm, W / 2, L.trailNameY, 16 * ui, C.ink, { wt: 800 });
    // corner toggles
    var s2 = roundBtn(L.sound, 'sound'); iconSound(L.sound.x + L.sound.w / 2, L.sound.y + L.sound.h / 2, L.sound.w * 0.62 * s2, C.ink, save.sound);
    s2 = roundBtn(L.music, 'music'); iconMusic(L.music.x + L.music.w / 2, L.music.y + L.music.h / 2, L.music.w * 0.62 * s2, C.ink, save.music);
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (state === 'title') { drawTitle(); return; }
    drawWorld();
    if (state === 'play') {
      drawHUD();
      drawHint();
      if (goT > 0 && !pauseMode && P.alive && !tutorialOn) {
        ctx.globalAlpha = clamp(goT * 2, 0, 1);
        label('GO!', W / 2, H * 0.5, 56 * ui * (1 + (0.9 - goT) * 0.3), C.ink, { wt: 900, shadow: C.butter, so: 5 * ui });
        ctx.globalAlpha = 1;
      }
      if (pauseMode === 'menu') drawPauseMenu();
      else if (pauseMode === 'count') drawCountdown();
    } else if (state === 'over') {
      drawGameOver();
      drawParticles();
    }
  }

  // ---------------------------------------------------------------- loop
  function frame(now) {
    rafId = 0;
    if (!running) return;
    var dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    update(dt);
    draw();
    rafId = requestAnimationFrame(frame);
  }
  function startLoop() {
    if (running) return;
    running = true; lastT = performance.now();
    rafId = requestAnimationFrame(frame);
  }
  function stopLoop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // ---------------------------------------------------------------- input
  function inRect(b, x, y, pad) { pad = pad || 0; return x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad; }
  function hitButton(x, y) {
    if (state === 'title') {
      if (inRect(L.play, x, y, 4)) return 'play';
      if (inRect(L.sound, x, y, 4)) return 'sound';
      if (inRect(L.music, x, y, 4)) return 'music';
      for (var i = 0; i < 5; i++) if (inRect(L.trails[i], x, y, 4)) return 'trail' + i;
      return null;
    }
    if (state === 'play') {
      if (pauseMode === 'menu') {
        if (inRect(L.home, x, y, 4)) return 'home';
        if (inRect(L.psound, x, y, 4)) return 'psound';
        if (inRect(L.pmusic, x, y, 4)) return 'pmusic';
        return null;
      }
      if (!pauseMode && P.alive && inRect(L.pause, x, y, 6)) return 'pause';
      return null;
    }
    if (state === 'over') {
      if (inRect(L.menu, x, y, 4)) return 'menu';
      if (inRect(L.retry, x, y, 4)) return 'retry';
    }
    return null;
  }

  function toggleSound() { save.sound = !save.sound; AU.setSound(save.sound); AU.click(); persist(); }
  function toggleMusic() { save.music = !save.music; AU.setMusic(save.music); AU.click(); persist(); }
  function selectTrail(i) {
    if (!trailUnlocked(i)) { lockShake[i] = 1; return; }
    if (save.trail !== i) { save.trail = i; AU.click(); persist(); }
  }
  function cycleTrail(dir) {
    var i = save.trail;
    for (var k = 0; k < 5; k++) { i = (i + dir + 5) % 5; if (trailUnlocked(i)) break; }
    selectTrail(i);
  }

  function pressButton(id) {
    switch (id) {
      case 'play': startRun(); break;
      case 'sound': case 'psound': toggleSound(); break;
      case 'music': case 'pmusic': toggleMusic(); break;
      case 'pause': openPause(); break;
      case 'home': case 'menu': toTitle(); break;
      case 'retry': if (overT > 0.3) startRun(); break;
      default: if (id && id.indexOf('trail') === 0) selectTrail(+id.slice(5));
    }
  }

  // a = 'L' | 'R' | 'C' (color) | 'confirm' | 'pause' | 'back'
  function act(a) {
    if (!ready) return;
    if (state === 'title') {
      if (a === 'confirm' || a === 'C') startRun();
      else if (a === 'L') cycleTrail(-1);
      else if (a === 'R') cycleTrail(1);
      return;
    }
    if (state === 'play') {
      if (pauseMode === 'menu') { if (a === 'confirm' || a === 'C' || a === 'pause' || a === 'tap') beginCount(); else if (a === 'back') toTitle(); return; }
      if (pauseMode === 'count') { if (a === 'pause') pauseMode = 'menu'; return; }
      if (!P.alive) return;
      if (a === 'L') moveLane(-1);
      else if (a === 'R') moveLane(1);
      else if (a === 'C') shiftColor();
      else if (a === 'pause') openPause();
      return;
    }
    if (state === 'over') {
      if (overT < 0.35) return;
      if (a === 'confirm' || a === 'C' || a === 'tap') startRun();
      else if (a === 'back' || a === 'pause') toTitle();
    }
  }

  var ptrs = {};
  function swipeTh() { return clamp(minD * 0.055, 18, 44); }
  function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    AU.ensure();
    lastInput = e.pointerType === 'mouse' ? 'mouse' : 'touch';
    if (!ready) return;
    var p = pos(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    var btn = hitButton(p.x, p.y);
    ptrs[e.pointerId] = { x: p.x, y: p.y, t: performance.now(), done: false, btn: btn };
    if (btn) pressed = btn;
  });
  canvas.addEventListener('pointermove', function (e) {
    var s = ptrs[e.pointerId];
    if (!s || s.done || s.btn) return;
    if (state !== 'play' || pauseMode || !P.alive) return;
    var p = pos(e), dx = p.x - s.x, dy = p.y - s.y, th = swipeTh();
    if (Math.abs(dx) > th && Math.abs(dx) > Math.abs(dy)) { s.done = true; act(dx < 0 ? 'L' : 'R'); }
    else if (-dy > th && -dy > Math.abs(dx)) { s.done = true; act('C'); }
  });
  function endPtr(e, cancel) {
    var s = ptrs[e.pointerId];
    delete ptrs[e.pointerId];
    if (!s) return;
    if (s.btn) {
      pressed = null;
      var p0 = pos(e);
      if (!cancel && hitButton(p0.x, p0.y) === s.btn) pressButton(s.btn);
      return;
    }
    if (cancel || s.done) return;
    var p = pos(e);
    if (state === 'play' && !pauseMode) {
      var dx = p.x - s.x, dy = p.y - s.y, th = swipeTh();
      if (Math.abs(dx) > th && Math.abs(dx) > Math.abs(dy)) { act(dx < 0 ? 'L' : 'R'); return; }
      if (-dy > th && -dy > Math.abs(dx)) { act('C'); return; }
      if (s.x < W / 3) act('L'); else if (s.x > (W * 2) / 3) act('R'); else act('C');
      return;
    }
    act('tap');
  }
  canvas.addEventListener('pointerup', function (e) { endPtr(e, false); });
  canvas.addEventListener('pointercancel', function (e) { endPtr(e, true); });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  window.addEventListener('keydown', function (e) {
    var k = e.code || e.key, a = null;
    if (k === 'ArrowLeft' || k === 'KeyA' || k === 'a') a = 'L';
    else if (k === 'ArrowRight' || k === 'KeyD' || k === 'd') a = 'R';
    else if (k === 'Space' || k === ' ' || k === 'ArrowUp' || k === 'KeyW' || k === 'w') a = 'C';
    else if (k === 'Enter' || k === 'NumpadEnter') a = 'confirm';
    else if (k === 'Escape' || k === 'KeyP' || k === 'p') a = 'pause';
    else if (k === 'Backspace' || k === 'KeyM') a = 'back';
    if (!a) return;
    e.preventDefault();
    AU.ensure();
    lastInput = 'key';
    if (e.repeat) return;
    act(a);
  });

  window.addEventListener('resize', resize);

  // ---------------------------------------------------------------- SDK lifecycle
  PlayablesSDK.onPause(function () {
    if (state === 'play' && P.alive) pauseMode = 'menu';
    pressed = null; ptrs = {};
    stopLoop();
    AU.suspend();
    draw();
  });
  PlayablesSDK.onResume(function () {
    AU.resume();
    startLoop();
  });
  PlayablesSDK.onAudioChange(function (enabled) { AU.setSdk(enabled); });
  AU.setSdk(PlayablesSDK.isAudioEnabled());

  // read-only snapshot for automated play-testing (no effect on the game)
  window.__prism = function () {
    var up = [];
    for (var i = 0; i < rows.length; i++) if (!rows[i].res) up.push({ z: rows[i].z, segs: rows[i].segs.slice() });
    return { state: state, pauseMode: pauseMode, ready: ready, running: running, dist: dist, speed: speed, lane: P.lane, color: P.color,
      alive: P.alive, shield: P.shield, score: score, best: save.best, combo: combo, mult: mult(), trail: save.trail,
      seenTutorial: save.seenTutorial, sound: save.sound, music: save.music, runs: save.runs, rows: up, tutorial: tutorialOn,
      buttons: { play: L.play, pause: L.pause, sound: L.sound, music: L.music, trails: L.trails, menu: L.menu, retry: L.retry, home: L.home } };
  };

  // 1) draw the title synchronously, 2) firstFrameReady, 3) load save + language, 4) gameReady
  resize();
  draw();
  PlayablesSDK.firstFrameReady();
  startLoop();
  Promise.all([PlayablesSDK.load(), PlayablesSDK.getLanguage()]).then(function (res) {
    applySave(res[0]);
    var tag = String(res[1] || 'en').toLowerCase().split('-')[0];
    T = I18N[tag] || I18N.en;
    AU.setSound(save.sound); AU.setMusic(save.music);
  }).catch(function () { /* play with defaults */ }).then(function () {
    ready = true;
    if (!running) draw();
    PlayablesSDK.gameReady();
  });
})();
