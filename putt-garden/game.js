/*
 * game.js: Putt Garden, a papercut top-down mini golf game for YouTube Playables.
 * Vanilla JS + Canvas 2D. Physics: physics.js. Holes: holes.js. Art: art.js.
 * Sound: audio.js. Strings: i18n.js.
 */
(function () {
  'use strict';

  var PlayablesSDK = window.PlayablesSDK, P = window.PuttPhysics, HD = window.PuttHoles, A = window.PuttArt, AU = window.PuttAudio, I18N = window.PuttI18n;
  PlayablesSDK.init({ storageKey: 'putt-garden_save' });

  var PAL = A.PAL;
  var FONT = 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
  var HOLES = HD.holes, NH = HOLES.length, PER = HD.perCourse, NC = HD.courses;
  var DT = P.C.DT, TAU = Math.PI * 2;
  var BTN = '#C9363F', BTN_DOWN = '#A92C34';

  // ------------------------------------------------------------------ i18n
  var lang = I18N.pick(navigator.language || 'en');
  function t(k) { var v = I18N.STR[lang][k]; return v === undefined ? I18N.STR.en[k] : v; }
  function courseName(c) { return t('courseNames')[c]; }

  // ------------------------------------------------------------------ save
  function defaultSave() {
    var b = [], s = [];
    for (var i = 0; i < NH; i++) { b.push(0); s.push(0); }
    return { v: 1, best: b, stars: s, snd: 1, tut: 0, last: 0 };
  }
  var save = defaultSave();
  function clampInt(v, a, b) { v = Math.floor(Number(v) || 0); return v < a ? a : v > b ? b : v; }
  function applySave(o) {
    if (!o || typeof o !== 'object') return;
    for (var i = 0; i < NH; i++) {
      if (Array.isArray(o.best)) save.best[i] = clampInt(o.best[i], 0, 20);
      if (Array.isArray(o.stars)) save.stars[i] = clampInt(o.stars[i], 0, 3);
    }
    save.snd = o.snd === 0 ? 0 : 1;
    save.tut = clampInt(o.tut, 0, 255);
    save.last = clampInt(o.last, 0, NH - 1);
  }
  function persist() { PlayablesSDK.save(save); }
  function totalStars() { var s = 0; for (var i = 0; i < NH; i++) s += save.stars[i]; return s; }
  function courseStars(c) { var s = 0; for (var i = c * PER; i < (c + 1) * PER; i++) s += save.stars[i]; return s; }
  function played(i) { return i >= 0 && i < NH && save.best[i] > 0; }
  function courseDone(c) { for (var i = c * PER; i < (c + 1) * PER; i++) if (!played(i)) return false; return true; }
  function courseOpen(c) { return c === 0 || courseDone(c - 1); }
  function holeOpen(i) { return i % PER === 0 ? courseOpen(Math.floor(i / PER)) : played(i - 1); }
  function coursePar(c) { var s = 0; for (var i = c * PER; i < (c + 1) * PER; i++) s += HOLES[i].par; return s; }
  function cap(i) { return HOLES[i].par + 4; }

  // ------------------------------------------------------------------ canvas + state
  var cv = document.getElementById('game');
  var ctx = cv.getContext('2d');
  var W = 1, H = 1, DPR = 1;
  var now = 0, lastT = 0, rafId = 0, paused = false, ready = false;
  var screen = 'title', overlay = null, overlayT = 0, screenT = 0;
  var selCourse = 0, cardFrom = 'holes';
  var ui = [], pressed = null, focusId = null, keyboardMode = false, finePointer = false;
  var toast = null;
  var G = null;
  var round = { c: -1, s: [] };                // this round's results per hole of the course
  var V = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, s: 1, dpr: 1, rot: false, inv: null };
  var LY = {};
  var bgCanvas = null, holeCanvas = null, titleCanvas = null;
  var sdkAudio = PlayablesSDK.isAudioEnabled();
  var keys = {};

  function soundOn() { return !!(sdkAudio && save.snd && !paused); }
  function syncAudio() { AU.setEnabled(soundOn()); }

  // ------------------------------------------------------------------ helpers
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
  function easeBack(x) { x = clamp(x, 0, 1); var c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
  function font(size, weight) { return (weight || 700) + ' ' + Math.round(size) + 'px ' + FONT; }
  function text(str, x, y, size, color, align, weight, maxW) {
    var s = size;
    ctx.font = font(s, weight);
    if (maxW) while (s > 9 && ctx.measureText(str).width > maxW) { s -= 1; ctx.font = font(s, weight); }
    ctx.fillStyle = color; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
    return s;
  }
  function rr(x, y, w, h, r) { A.rr(ctx, x, y, w, h, r); }
  function toScreen(x, y) { return { x: V.a * x + V.c * y + V.e, y: V.b * x + V.d * y + V.f }; }
  function dirToScreen(ang) { var c = Math.cos(ang), s = Math.sin(ang); return { x: (V.a * c + V.c * s) / V.s, y: (V.b * c + V.d * s) / V.s }; }
  function screenDirToWorld(dx, dy) { return { x: V.inv.a * dx + V.inv.c * dy, y: V.inv.b * dx + V.inv.d * dy }; }

  // paper card with an offset shadow
  function card(x, y, w, h, r, fill) {
    ctx.fillStyle = PAL.shadow; rr(x + 3, y + 6, w, h, r || 18); ctx.fill();
    ctx.fillStyle = fill || PAL.paper; rr(x, y, w, h, r || 18); ctx.fill();
    ctx.strokeStyle = 'rgba(36,64,46,0.14)'; ctx.lineWidth = 1.5; rr(x + 0.75, y + 0.75, w - 1.5, h - 1.5, r || 18); ctx.stroke();
  }
  // Immediate-mode buttons, registered for hit testing each frame.
  // opt: icon, label, primary, round, disabled, act, size
  function button(id, x, y, w, h, opt) {
    opt = opt || {};
    var down = pressed === id, r = opt.round ? h / 2 : Math.min(h * 0.36, 20);
    var yy = down ? y + 3 : y;
    if (opt.disabled) ctx.globalAlpha = 0.5;
    ctx.fillStyle = opt.primary ? 'rgba(120,20,30,0.35)' : PAL.shadow; rr(x + 2, y + 5, w, h, r); ctx.fill();
    ctx.fillStyle = opt.primary ? (down ? BTN_DOWN : BTN) : (down ? PAL.paperDark : PAL.paper);
    rr(x, yy, w, h, r); ctx.fill();
    if (!opt.primary) { ctx.strokeStyle = 'rgba(36,64,46,0.16)'; ctx.lineWidth = 1.5; rr(x + 0.75, yy + 0.75, w - 1.5, h - 1.5, r); ctx.stroke(); }
    else { ctx.fillStyle = 'rgba(255,255,255,0.16)'; rr(x + 4, yy + 3, w - 8, h * 0.38, r * 0.7); ctx.fill(); }
    var col = opt.primary ? '#FFFFFF' : PAL.ink;
    if (opt.icon && opt.label) {
      var is = h * 0.44, size = opt.size || Math.min(h * 0.4, 22);
      ctx.font = font(size, 800);
      var tw = Math.min(ctx.measureText(opt.label).width, w - is - h * 0.8);
      var x0 = x + w / 2 - (is + h * 0.18 + tw) / 2;
      A.icon(ctx, opt.icon, x0 + is / 2, yy + h / 2, is, col);
      text(opt.label, x0 + is + h * 0.18, yy + h / 2 + 1, size, col, 'left', 800, w - is - h * 0.7);
    } else if (opt.icon) {
      A.icon(ctx, opt.icon, x + w / 2, yy + h / 2, opt.iconSize || h * 0.5, col);
    } else if (opt.label) {
      text(opt.label, x + w / 2, yy + h / 2 + 1, opt.size || Math.min(h * 0.4, 22), col, 'center', 800, w - 18);
    }
    ctx.globalAlpha = 1;
    if (focusId === id && keyboardMode) {
      ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
      rr(x - 5, yy - 5, w + 10, h + 10, r + 5); ctx.stroke(); ctx.setLineDash([]);
    }
    ui.push({ id: id, x: x, y: y, w: w, h: h + 5, act: opt.disabled ? null : opt.act });
  }
  function hitUI(x, y) {
    for (var i = ui.length - 1; i >= 0; i--) { var b = ui[i]; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b; }
    return null;
  }
  function uiById(id) { for (var i = 0; i < ui.length; i++) if (ui[i].id === id) return ui[i]; return null; }
  function starsRow(cx, cy, r, n, total, anim) {
    for (var i = 0; i < total; i++) {
      var x = cx + (i - (total - 1) / 2) * r * 2.3, k = anim ? anim(i) : 1;
      A.star(ctx, x + 1.5, cy + 2.5, r, 'rgba(36,64,46,0.18)');
      A.star(ctx, x, cy, r, '#E9E4D6');
      if (i < n && k > 0) {
        ctx.save(); ctx.translate(x, cy); ctx.scale(k, k);
        A.star(ctx, 0, 0, r, PAL.gold, '#B9811C', Math.max(1, r * 0.12));
        ctx.restore();
      }
    }
  }

  // ------------------------------------------------------------------ particles (screen space, fixed pool)
  var NP = 320;
  var pX = new Float32Array(NP), pY = new Float32Array(NP), pVX = new Float32Array(NP), pVY = new Float32Array(NP),
    pL = new Float32Array(NP), pM = new Float32Array(NP), pS = new Float32Array(NP), pR = new Float32Array(NP), pVR = new Float32Array(NP),
    pK = new Uint8Array(NP), pC = new Uint8Array(NP);
  var pNext = 0;
  var CONF = [PAL.flag, PAL.gold, '#7C6CF2', PAL.water, '#FFFFFF', PAL.petal, PAL.fairway];
  // kinds: 1 confetti, 2 water drop, 3 sand puff, 4 grass bit, 5 sparkle, 6 dust ring
  function spawn(kind, x, y, vx, vy, life, size, col) {
    var i = pNext; pNext = (pNext + 1) % NP;
    pK[i] = kind; pX[i] = x; pY[i] = y; pVX[i] = vx; pVY[i] = vy; pL[i] = life; pM[i] = life; pS[i] = size;
    pR[i] = Math.random() * TAU; pVR[i] = (Math.random() - 0.5) * 12; pC[i] = col || 0;
  }
  function burst(kind, x, y, n, spd, life, size, up) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, v = spd * (0.35 + Math.random() * 0.65);
      spawn(kind, x, y, Math.cos(a) * v, Math.sin(a) * v - (up || 0) * (0.5 + Math.random()), life * (0.6 + Math.random() * 0.5), size * (0.6 + Math.random() * 0.6), Math.floor(Math.random() * CONF.length));
    }
  }
  function updateParticles(dt) {
    for (var i = 0; i < NP; i++) {
      if (pL[i] <= 0) continue;
      pL[i] -= dt;
      var k = pK[i];
      if (k === 1) { pVY[i] += 260 * dt; pVX[i] *= 1 - 1.6 * dt; pVY[i] *= 1 - 1.2 * dt; pVX[i] += Math.sin(pR[i] * 2) * 30 * dt; }
      else if (k === 2) { pVY[i] += 520 * dt; }
      else { pVX[i] *= 1 - 3 * dt; pVY[i] *= 1 - 3 * dt; }
      pX[i] += pVX[i] * dt; pY[i] += pVY[i] * dt; pR[i] += pVR[i] * dt;
    }
  }
  function drawParticles() {
    for (var i = 0; i < NP; i++) {
      if (pL[i] <= 0) continue;
      var a = clamp(pL[i] / pM[i], 0, 1), k = pK[i], s = pS[i];
      if (k === 1) {
        ctx.globalAlpha = Math.min(1, a * 2.5);
        ctx.save(); ctx.translate(pX[i], pY[i]); ctx.rotate(pR[i]);
        ctx.scale(1, Math.abs(Math.cos(pR[i] * 1.7)) * 0.8 + 0.2);
        ctx.fillStyle = CONF[pC[i]]; ctx.fillRect(-s, -s * 0.6, s * 2, s * 1.2);
        ctx.restore();
      } else if (k === 2) {
        ctx.globalAlpha = a; ctx.fillStyle = pC[i] % 2 ? PAL.waterLight : '#FFFFFF';
        A.circle(ctx, pX[i], pY[i], s * (0.5 + a * 0.5)); ctx.fill();
      } else if (k === 3) {
        ctx.globalAlpha = a * 0.7; ctx.fillStyle = PAL.sandLight;
        A.circle(ctx, pX[i], pY[i], s * (1.4 - a * 0.6)); ctx.fill();
      } else if (k === 4) {
        ctx.globalAlpha = a; ctx.fillStyle = pC[i] % 2 ? PAL.fairwayLight : PAL.paper;
        ctx.save(); ctx.translate(pX[i], pY[i]); ctx.rotate(pR[i]); ctx.fillRect(-s, -s * 0.35, s * 2, s * 0.7); ctx.restore();
      } else if (k === 5) {
        ctx.globalAlpha = a; A.star(ctx, pX[i], pY[i], s * (0.6 + a * 0.4), PAL.gold);
      } else if (k === 6) {
        ctx.globalAlpha = a * 0.8; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2;
        A.circle(ctx, pX[i], pY[i], s * (2 - a)); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  function clearParticles() { for (var i = 0; i < NP; i++) pL[i] = 0; }

  // ------------------------------------------------------------------ layout
  function layout() {
    var m = Math.min(W, H);
    LY.safe = 16;
    LY.btn = clamp(Math.round(m * 0.12), 46, 58);
    LY.hud = LY.safe + LY.btn + 8;
    LY.board = { x: 8, y: LY.hud, w: W - 16, h: H - 8 - LY.hud };
    LY.maxDrag = clamp(m * 0.3, 110, 240);
  }
  function fitHole() {
    if (!G) return;
    var bb = P.polyBox(G.H.out), pad = 10;
    var bw = bb[2] - bb[0] + pad * 2, bh = bb[3] - bb[1] + pad * 2, cxw = (bb[0] + bb[2]) / 2, cyw = (bb[1] + bb[3]) / 2;
    var B = LY.board, inset = 10;
    var aw = B.w - inset * 2, ah = B.h - inset * 2, cxs = B.x + B.w / 2, cys = B.y + B.h / 2;
    var sN = Math.min(aw / bw, ah / bh), sR = Math.min(aw / bh, ah / bw);
    var rot = sR > sN * 1.05, s = rot ? sR : sN;
    V.s = s; V.dpr = DPR; V.rot = rot;
    if (!rot) {
      V.a = s; V.b = 0; V.c = 0; V.d = s; V.e = cxs - s * cxw; V.f = cys - s * cyw;
      V.inv = { a: 1 / s, b: 0, c: 0, d: 1 / s, e: -V.e / s, f: -V.f / s };
    } else {
      // world "up" points to screen right, world "right" points down
      V.a = 0; V.b = s; V.c = -s; V.d = 0; V.e = cxs + s * cyw; V.f = cys - s * cxw;
      V.inv = { a: 0, b: -1 / s, c: 1 / s, d: 0, e: -V.f / s, f: V.e / s };
    }
  }

  // ------------------------------------------------------------------ caches
  function buildBg() {
    bgCanvas = A.makeCanvas(W, H, DPR);
    var g = bgCanvas.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    A.paperFill(g, PAL.mint, 0, 0, W, H);
    // soft paper hills along the bottom
    var r = A.rng(3);
    var layers = [['#CBEBD3', 0.80], ['#B9E3C3', 0.88]];
    for (var l = 0; l < layers.length; l++) {
      var y0 = H * layers[l][1];
      g.fillStyle = 'rgba(36,64,46,0.07)';
      g.beginPath(); g.moveTo(0, H);
      for (var x = 0; x <= W + 40; x += 40) g.lineTo(x, y0 + 6 + Math.sin(x * 0.012 + l * 2 + r()) * 14);
      g.lineTo(W, H); g.closePath(); g.fill();
      g.fillStyle = layers[l][0];
      g.beginPath(); g.moveTo(0, H);
      for (x = 0; x <= W + 40; x += 40) g.lineTo(x, y0 + Math.sin(x * 0.012 + l * 2) * 14);
      g.lineTo(W, H); g.closePath(); g.fill();
    }
  }
  function buildHole() {
    if (!G) { holeCanvas = null; return; }
    fitHole();
    holeCanvas = A.makeCanvas(W, H, DPR);
    var g = holeCanvas.getContext('2d');
    A.hole(g, G.H, V, W, H, Math.floor(G.idx / PER), G.idx + 1, LY.board);
  }
  // title diorama: a little hole on a paper board, in local units 400 x 260
  function buildTitle() {
    var big = W > H;
    var size = big ? Math.min(W * 0.46, H * 0.62 * 400 / 260, 560) : Math.min(W * 0.9, H * 0.38 * 400 / 260, 520);
    var hh = size * 260 / 400;
    var c = A.makeCanvas(size, hh + 20, DPR), g = c.getContext('2d');
    var k = size / 400;
    g.setTransform(DPR * k, 0, 0, DPR * k, 0, 0);
    g.fillStyle = PAL.shadow; A.rr(g, 8, 14, 388, 240, 26); g.fill();
    g.fillStyle = PAL.grass; A.rr(g, 4, 6, 388, 240, 26); g.fill();
    g.fillStyle = A.fibrePattern(g); A.rr(g, 4, 6, 388, 240, 26); g.fill();
    // kidney fairway
    function kidney(ox, oy) {
      g.beginPath();
      g.moveTo(60 + ox, 150 + oy);
      g.bezierCurveTo(40 + ox, 70 + oy, 150 + ox, 40 + oy, 210 + ox, 70 + oy);
      g.bezierCurveTo(260 + ox, 95 + oy, 300 + ox, 40 + oy, 345 + ox, 80 + oy);
      g.bezierCurveTo(390 + ox, 120 + oy, 350 + ox, 215 + oy, 260 + ox, 205 + oy);
      g.bezierCurveTo(200 + ox, 200 + oy, 170 + ox, 225 + oy, 110 + ox, 215 + oy);
      g.bezierCurveTo(75 + ox, 208 + oy, 66 + ox, 185 + oy, 60 + ox, 150 + oy);
      g.closePath();
    }
    g.fillStyle = PAL.shadow; kidney(4, 7); g.fill();
    g.strokeStyle = PAL.stoneDark; g.lineWidth = 11; kidney(0, 0); g.stroke();
    g.strokeStyle = PAL.stone; g.lineWidth = 8; kidney(-0.5, -1); g.stroke();
    g.fillStyle = PAL.fairway; kidney(0, 0); g.fill();
    g.save(); kidney(0, 0); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (var y = 40; y < 230; y += 36) g.fillRect(0, y, 400, 18);
    // bunker and pond
    g.fillStyle = PAL.sandDark; g.beginPath(); g.ellipse(250, 160, 38, 22, -0.3, 0, TAU); g.fill();
    g.fillStyle = PAL.sand; g.beginPath(); g.ellipse(252, 163, 36, 20, -0.3, 0, TAU); g.fill();
    g.fillStyle = PAL.waterDark; g.beginPath(); g.ellipse(150, 100, 34, 20, 0.2, 0, TAU); g.fill();
    g.fillStyle = PAL.water; g.beginPath(); g.ellipse(152, 103, 32, 18, 0.2, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(138, 100); g.quadraticCurveTo(146, 95, 154, 100); g.stroke();
    g.restore();
    // cup
    g.fillStyle = PAL.fairwayLight; A.circle(g, 318, 110, 13); g.fill();
    g.fillStyle = '#16281C'; A.circle(g, 318, 110, 8); g.fill();
    // decor
    A.bush(g, 40, 40, 16, PAL.grassDark, '#7FCB6F', 2);
    A.bush(g, 370, 225, 14, PAL.grassDeep, PAL.grassDark, 2);
    A.bush(g, 30, 225, 12, PAL.grassDark, '#7FCB6F', 2);
    A.flower(g, 360, 30, 6, PAL.paper, PAL.pollen); A.flower(g, 375, 45, 5, PAL.petal, PAL.pollen);
    A.flower(g, 200, 232, 5, PAL.pollen, '#F29F3D'); A.flower(g, 95, 30, 5, PAL.petal, PAL.pollen);
    // aim dots + ball
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (var i = 0; i < 6; i++) { A.circle(g, 112 + i * 17, 170 - i * 7, 3.2 - i * 0.3); g.fill(); }
    A.ball(g, 98, 176, 8, 1);
    titleCanvas = { c: c, w: size, h: hh + 20, cupX: 318, cupY: 110, k: k };
  }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    layout();
    buildBg(); buildTitle(); buildHole();
    render();
  }

  // ------------------------------------------------------------------ hole flow
  function startHole(idx) {
    var H0 = HOLES[idx], c = Math.floor(idx / PER);
    var w = P.createWorld(H0);
    G = {
      idx: idx, H: H0, w: w, acc: 0, phase: 'play', startT: now, sinkT: 0, doneT: 0,
      drag: null, aim: { ang: 0, pow: 0.5, on: false }, ballFadeT: -9, bump: [], gateFlash: [],
      result: null, arrows: [], shake: 0, tipT: now, lastShotT: -9, sunkFrom: null, pipeT: -9, pipeFrom: null
    };
    for (var i = 0; i < w.circ.length; i++) G.bump.push(-9);
    // default keyboard aim: towards the cup
    G.aim.ang = Math.atan2(H0.cup[1] - H0.tee[1], H0.cup[0] - H0.tee[0]);
    // slope arrows
    (H0.slopes || []).forEach(function (sl, k) {
      var b = P.polyBox(sl[0]), m = Math.sqrt(sl[1] * sl[1] + sl[2] * sl[2]) || 1;
      for (var y = b[1] + 40; y < b[3] - 20; y += 64) for (var x = b[0] + 40; x < b[2] - 20; x += 64) {
        if (P.inPoly(sl[0], x, y)) G.arrows.push({ x: x, y: y, ux: sl[1] / m, uy: sl[2] / m, ph: ((x * 7 + y * 3 + k * 50) % 100) / 100 });
      }
    });
    if (round.c !== c || idx % PER === 0) { round.c = c; round.s = []; for (i = 0; i < PER; i++) round.s.push(null); }
    screen = 'game'; overlay = null; focusId = null; screenT = now;
    save.last = idx;
    clearParticles();
    buildHole();
  }
  function restartHole() { if (G) { startHole(G.idx); AU.back(); } }

  function shoot(ang, pow) {
    if (!G || G.phase !== 'play' || !P.canShoot(G.w)) return;
    pow = clamp(pow, 0, 1);
    P.shoot(G.w, ang, pow);
    G.lastShotT = now;
    AU.tock(pow);
    var b = toScreen(G.w.ball.x, G.w.ball.y);
    burst(4, b.x, b.y, 5 + Math.round(pow * 6), 70 + pow * 90, 0.5, 3);
    if (!(save.tut & 1)) { save.tut |= 1; persist(); }
  }

  function handleEvent(type, x, y, s) {
    var p = toScreen(x, y);
    switch (type) {
      case P.EV_WALL: AU.clack(s); if (s > 250) burst(4, p.x, p.y, 3, 60, 0.4, 2.5); break;
      case P.EV_BUMP:
        AU.bump();
        for (var i = 0; i < G.w.circ.length; i++) if (G.w.circ[i][0] === x && G.w.circ[i][1] === y) G.bump[i] = now;
        burst(5, p.x, p.y, 5, 120, 0.5, 5);
        break;
      case P.EV_SPLASH:
        AU.splash();
        burst(2, p.x, p.y, 16, 150, 0.7, 4, 90); spawn(6, p.x, p.y, 0, 0, 0.6, 10);
        G.ballFadeT = now; showToast(t('penalty'));
        break;
      case P.EV_RATTLE: AU.rattle(); break;
      case P.EV_SINK:
        AU.sink(); G.phase = 'sunk'; G.sinkT = now;
        burst(1, p.x, p.y - 10, 46, 260, 1.8, 5, 140); burst(5, p.x, p.y, 8, 140, 0.8, 6);
        break;
      case P.EV_PIPE: AU.pipe(); spawn(6, p.x, p.y, 0, 0, 0.5, 9); G.pipeT = now; break;
      case P.EV_PIPEOUT: spawn(6, p.x, p.y, 0, 0, 0.5, 9); burst(4, p.x, p.y, 4, 60, 0.4, 2.5); break;
      case P.EV_GATE: AU.gate(); break;
      case P.EV_BLADE: AU.blade(); burst(4, p.x, p.y, 4, 80, 0.4, 2.5); break;
      case P.EV_SAND: AU.sand(); burst(3, p.x, p.y, 8, 50, 0.6, 5); break;
    }
  }

  function updateGame(dt) {
    if (!G || overlay === 'pause') return;
    var w = G.w;
    G.acc += dt;
    var n = 0;
    while (G.acc >= DT && n < 30) {
      P.step(w); G.acc -= DT; n++;
      for (var e = 0; e < w.ev.n; e++) handleEvent(w.ev.type[e], w.ev.x[e], w.ev.y[e], w.ev.s[e]);
    }
    if (n >= 30) G.acc = 0;
    // keyboard aiming
    if (G.aim.on && G.phase === 'play') {
      var fine = keys.Shift ? 0.25 : 1;
      if (keys.ArrowLeft) G.aim.ang -= 1.5 * fine * dt;
      if (keys.ArrowRight) G.aim.ang += 1.5 * fine * dt;
      if (keys.ArrowUp) G.aim.pow = clamp(G.aim.pow + 0.55 * fine * dt, 0.03, 1);
      if (keys.ArrowDown) G.aim.pow = clamp(G.aim.pow - 0.55 * fine * dt, 0.03, 1);
    }
    if (G.phase === 'play' && w.strokes > 0 && P.canShoot(w) && P.score(w) >= cap(G.idx)) finishHole(false);
    if (G.phase === 'sunk' && now - G.sinkT > 1.1) finishHole(true);
  }

  function termFor(score, par) {
    var T = t('terms');
    if (score === 1) return T.ace;
    var d = score - par;
    if (d <= -3) return T['-3'];
    if (T[String(d)]) return T[String(d)];
    return '+' + d;
  }
  function finishHole(sunk) {
    var idx = G.idx, par = G.H.par, score = sunk ? P.score(G.w) : cap(idx) + 1;
    var stars = sunk ? (score < par ? 3 : score === par ? 2 : 1) : 0;
    var before = totalStars();
    var wasPlayed = played(idx), newBest = !wasPlayed || score < save.best[idx];
    if (newBest) save.best[idx] = score;
    if (stars > save.stars[idx]) save.stars[idx] = stars;
    round.s[idx % PER] = { score: score, stars: stars };
    if (idx % PER < PER - 1) save.last = idx + 1;
    persist();
    var after = totalStars();
    PlayablesSDK.sendScore(after);
    G.phase = 'done'; G.doneT = now;
    G.result = { sunk: sunk, score: score, stars: stars, newBest: newBest && wasPlayed, term: sunk ? termFor(score, par) : t('outOfStrokes') };
    overlay = 'done'; overlayT = now; focusId = null;
    if (sunk) { if (stars === 3) AU.fanfare(); } else AU.fail();
  }
  function nextHole() {
    if (!G) return;
    var idx = G.idx;
    if (idx % PER === PER - 1) { openCard(Math.floor(idx / PER), 'round'); AU.fanfare(); }
    else { startHole(idx + 1); AU.ui(); }
  }
  function openCard(c, from) { selCourse = c; cardFrom = from; screen = 'card'; screenT = now; overlay = null; focusId = null; G = null; holeCanvas = null; }
  function openPause() { if (!G || overlay) return; overlay = 'pause'; overlayT = now; focusId = null; G.drag = null; AU.ui(); }
  function closePause() { overlay = null; focusId = null; }
  function toggleSound() { save.snd = save.snd ? 0 : 1; AU.ensure(); syncAudio(); persist(); AU.ui(); }
  function goCourses() { screen = 'courses'; screenT = now; overlay = null; focusId = null; G = null; holeCanvas = null; }
  function goHoles(c) { selCourse = c; screen = 'holes'; screenT = now; overlay = null; focusId = null; G = null; holeCanvas = null; }
  function showToast(s) { toast = { s: s, t: now }; }

  // ------------------------------------------------------------------ game drawing
  function drawGame() {
    ctx.drawImage(holeCanvas, 0, 0, W, H);
    var w = G.w, H0 = G.H, i;
    // dynamic pieces in world space
    if (w.water.length) A.waterWaves(ctx, V, w.water, now);
    if (G.arrows.length) A.slopeArrows(ctx, V, G.arrows, now);
    for (i = 0; i < w.sliders.length; i++) A.slider(ctx, V, w.sliders[i]);
    for (i = 0; i < w.gates.length; i++) A.gate(ctx, V, w.gates[i], w.t - w.gates[i].flash < 0.2 ? 1 : 0);
    for (i = 0; i < w.circ.length; i++) {
      var c = w.circ[i];
      if (c[4] === 1) { var k = now - G.bump[i]; A.bumper(ctx, V, c, k < 0.3 ? Math.sin(k / 0.3 * Math.PI) : 0); }
    }
    for (i = 0; i < w.blades.length; i++) A.blade(ctx, V, w.blades[i], w.blades[i].arms, w.blades[i].len);
    A.setS(ctx, V);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // ball (or the ball dropping into the cup)
    var bp = toScreen(w.ball.x, w.ball.y), br = Math.max(4.5, P.C.R * V.s);
    var cp = toScreen(H0.cup[0], H0.cup[1]);
    if (G.phase === 'play') {
      drawAim(bp, br);
      var fade = clamp((now - G.ballFadeT) / 0.5, 0, 1);
      var spr = fade < 1 ? 0.4 + 0.6 * easeBack(fade) : 1;
      A.ball(ctx, bp.x, bp.y, br * spr, fade);
    } else if (G.phase === 'sunk') {
      var k2 = clamp((now - G.sinkT) / 0.3, 0, 1);
      if (k2 < 1) A.ball(ctx, cp.x + (bp.x - cp.x) * (1 - k2), cp.y + (bp.y - cp.y) * (1 - k2), br * (1 - 0.55 * k2), 1 - k2 * 0.6);
    }
    // flag: lifts out of the cup when the ball comes close, so the cup is visible
    var fh = clamp(V.s * 46, 26, 54);
    var dcx = w.ball.x - H0.cup[0], dcy = w.ball.y - H0.cup[1], dc = Math.sqrt(dcx * dcx + dcy * dcy);
    var lift = G.phase !== 'play' ? fh * 0.5 : clamp((120 - dc) / 80, 0, 1) * fh * 0.35;
    G.lift = (G.lift || 0) + (lift - (G.lift || 0)) * 0.15;
    ctx.globalAlpha = G.phase === 'play' && dc < 60 ? 0.55 : 1;
    A.flagPole(ctx, cp.x, cp.y, fh, now, G.lift);
    ctx.globalAlpha = 1;
    drawParticles();
    drawHud();
    drawTutorial(bp);
    if (overlay === 'done') drawDone();
    else if (overlay === 'pause') drawPause();
  }

  function aimVector() {
    var d = G.drag;
    if (d) {
      var dx = d.x0 - d.x, dy = d.y0 - d.y, len = Math.sqrt(dx * dx + dy * dy);
      var pw = clamp(len / LY.maxDrag, 0, 1);
      var wd = screenDirToWorld(dx, dy);
      return { ang: Math.atan2(wd.y, wd.x), pow: pw, sx: len ? dx / len : 0, sy: len ? dy / len : 0, len: len };
    }
    if (G.aim.on) { var sd = dirToScreen(G.aim.ang); return { ang: G.aim.ang, pow: G.aim.pow, sx: sd.x, sy: sd.y, len: G.aim.pow * LY.maxDrag }; }
    return null;
  }
  function drawAim(bp, br) {
    if (!P.canShoot(G.w)) return;
    var a = aimVector();
    if (!a || a.pow < 0.03) {
      // idle: a gentle pulse ring shows the ball is ready
      var k = (now * 0.9) % 1;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 * (1 - k)).toFixed(3) + ')'; ctx.lineWidth = 2;
      A.circle(ctx, bp.x, bp.y, br + 4 + k * 14); ctx.stroke();
      return;
    }
    // slingshot band back towards the finger
    var bl = Math.min(a.len, LY.maxDrag) * 0.45;
    ctx.strokeStyle = 'rgba(36,64,46,0.35)'; ctx.lineWidth = Math.max(3, br * 0.7); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bp.x, bp.y); ctx.lineTo(bp.x - a.sx * bl, bp.y - a.sy * bl); ctx.stroke();
    ctx.fillStyle = PAL.paper; A.circle(ctx, bp.x - a.sx * bl, bp.y - a.sy * bl, Math.max(4, br * 0.7)); ctx.fill();
    ctx.strokeStyle = 'rgba(36,64,46,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    // dotted aim guide of limited length
    var L = (36 + 170 * a.pow) * V.s, gap = Math.max(9, 13 * V.s), n = Math.floor(L / gap);
    var col = a.pow > 0.85 ? PAL.flag : '#FFFFFF';
    for (var i = 1; i <= n; i++) {
      var f = i / n, x = bp.x + a.sx * (i * gap + br * 0.6), y = bp.y + a.sy * (i * gap + br * 0.6);
      var r = Math.max(1.6, br * (0.42 - 0.22 * f));
      ctx.globalAlpha = 0.95 - 0.6 * f;
      ctx.fillStyle = 'rgba(36,64,46,0.3)'; A.circle(ctx, x + 1, y + 1.5, r); ctx.fill();
      ctx.fillStyle = col; A.circle(ctx, x, y, r); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // power ring
    var rr2 = br + 9;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    A.circle(ctx, bp.x, bp.y, rr2); ctx.stroke();
    ctx.strokeStyle = a.pow > 0.85 ? PAL.flag : a.pow > 0.5 ? PAL.gold : '#FFFFFF';
    ctx.beginPath(); ctx.arc(bp.x, bp.y, rr2, -Math.PI / 2, -Math.PI / 2 + a.pow * TAU); ctx.stroke();
  }

  function holeLabel(idx) { return courseName(Math.floor(idx / PER)) + ' · ' + (idx % PER + 1); }
  function chip(x, y, w, h, label, value, col) {
    ctx.fillStyle = PAL.shadowSoft; rr(x + 1.5, y + 3, w, h, h / 2); ctx.fill();
    ctx.fillStyle = PAL.paper; rr(x, y, w, h, h / 2); ctx.fill();
    text(label, x + 12, y + h / 2 + 1, h * 0.5, PAL.inkSoft, 'left', 800, w * 0.62);
    text(String(value), x + w - 12, y + h / 2 + 1, h * 0.62, col || PAL.ink, 'right', 900);
  }
  function drawHud() {
    var s = LY.safe, b = LY.btn;
    button('pause', s, s, b, b, { icon: 'pause', round: true, act: openPause });
    button('restart', W - s - b, s, b, b, { icon: 'restart', round: true, act: restartHole });
    var cx = W / 2, avail = W - 2 * (s + b + 10);
    var lw = Math.min(avail, 360);
    text(holeLabel(G.idx), cx, s + b * 0.2, clamp(b * 0.36, 15, 20), PAL.ink, 'center', 900, lw);
    var ch = clamp(b * 0.5, 24, 28), cw = Math.min((lw - 8) / 2, 140);
    var sc = P.score(G.w), last = sc >= cap(G.idx) - 1;
    chip(cx - cw - 4, s + b * 0.44, cw, ch, t('par'), G.H.par);
    chip(cx + 4, s + b * 0.44, cw, ch, t('strokes'), sc, last && G.phase === 'play' ? BTN : PAL.ink);
    // toast
    if (toast && now - toast.t < 1.6) {
      var a = clamp(Math.min((now - toast.t) / 0.15, (1.6 - (now - toast.t)) / 0.3), 0, 1);
      ctx.globalAlpha = a;
      var ty = LY.hud + 30 - (1 - a) * 10;
      ctx.font = font(18, 800); var tw = ctx.measureText(toast.s).width + 36;
      ctx.fillStyle = PAL.shadow; rr(cx - tw / 2 + 2, ty - 18 + 4, tw, 36, 18); ctx.fill();
      ctx.fillStyle = PAL.water; rr(cx - tw / 2, ty - 18, tw, 36, 18); ctx.fill();
      text(toast.s, cx, ty + 1, 18, '#FFFFFF', 'center', 800);
      ctx.globalAlpha = 1;
    }
  }
  function bubble(str, x, y, size, maxW) {
    ctx.font = font(size, 800);
    var tw = Math.min(ctx.measureText(str).width, maxW) + 32, h = size * 2.1;
    x = clamp(x, LY.safe + tw / 2, W - LY.safe - tw / 2);
    ctx.fillStyle = PAL.shadow; rr(x - tw / 2 + 2, y - h / 2 + 4, tw, h, h / 2); ctx.fill();
    ctx.fillStyle = PAL.paper; rr(x - tw / 2, y - h / 2, tw, h, h / 2); ctx.fill();
    text(str, x, y + 1, size, PAL.ink, 'center', 800, maxW);
  }
  function drawTutorial(bp) {
    if (!G || overlay || G.phase !== 'play') return;
    var w = G.w;
    var cupS = toScreen(G.H.cup[0], G.H.cup[1]);
    var topY = LY.board.y + 34, botY = LY.board.y + LY.board.h - 34;
    var dTop = Math.min(Math.abs(topY - bp.y), Math.abs(topY - cupS.y)), dBot = Math.min(Math.abs(botY - bp.y), Math.abs(botY - cupS.y));
    var bottomY = dBot >= dTop ? botY : topY;
    if (G.idx === 0 && !(save.tut & 1) && w.strokes === 0 && !G.drag && !G.aim.on) {
      // animated hand: press on the ball, pull back, let go
      var cyc = ((now - G.startT) % 2.6) / 2.6;
      var cup = toScreen(G.H.cup[0], G.H.cup[1]);
      var dx = cup.x - bp.x, dy = cup.y - bp.y, dl = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / dl, uy = dy / dl, pull = LY.maxDrag * 0.55;
      var k = cyc < 0.15 ? 0 : cyc < 0.6 ? ease((cyc - 0.15) / 0.45) : 1;
      var hx = bp.x - ux * pull * k, hy = bp.y - uy * pull * k;
      if (cyc > 0.15 && cyc < 0.78) {
        var fake = { ang: 0, pow: 0.55 * k };
        var L = (36 + 170 * fake.pow) * V.s, gap = Math.max(9, 13 * V.s);
        ctx.globalAlpha = 0.65;
        for (var i = 1; i * gap < L; i++) { ctx.fillStyle = '#FFFFFF'; A.circle(ctx, bp.x + ux * i * gap, bp.y + uy * i * gap, 3); ctx.fill(); }
        ctx.strokeStyle = 'rgba(36,64,46,0.35)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(bp.x, bp.y); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      var alpha = cyc > 0.85 ? 1 - (cyc - 0.85) / 0.15 : cyc < 0.08 ? cyc / 0.08 : 1;
      ctx.globalAlpha = alpha;
      A.hand(ctx, hx + 4, hy + 4, clamp(LY.btn * 0.9, 40, 54), cyc > 0.12 && cyc < 0.66);
      ctx.globalAlpha = 1;
      bubble(cyc < 0.66 ? t('tutDrag') : t('tutRelease'), W / 2, bottomY, clamp(LY.btn * 0.34, 15, 19), W - 60);
      if (finePointer) bubble(t('keys'), W / 2, bottomY + (bottomY === botY ? -40 : 40), 13, W - 60);
      return;
    }
    var tip = G.H.tip;
    if (tip && tip !== 'drag' && w.strokes === 0 && now - G.tipT < 6) {
      var a2 = clamp(Math.min((now - G.tipT) / 0.3, (6 - (now - G.tipT)) / 0.4), 0, 1);
      ctx.globalAlpha = a2;
      bubble(t('tips')[tip], W / 2, bottomY, clamp(LY.btn * 0.32, 14, 18), W - 60);
      ctx.globalAlpha = 1;
    }
  }

  function dim(a) { ctx.fillStyle = 'rgba(223,243,228,' + (a === undefined ? 0.78 : a) + ')'; ctx.fillRect(0, 0, W, H); }
  function drawDone() {
    var r = G.result, k = ease((now - overlayT) / 0.35);
    dim(0.55 * k);
    var cw = Math.min(W - 32, 420), chh = Math.min(H - 40, 330);
    var x = (W - cw) / 2, y = (H - chh) / 2 + (1 - easeBack((now - overlayT) / 0.45)) * 40;
    card(x, y, cw, chh, 24);
    var col = r.sunk ? (r.stars === 3 ? BTN : PAL.ink) : PAL.inkSoft;
    text(r.term, W / 2, y + chh * 0.17, clamp(cw * 0.1, 26, 40), col, 'center', 900, cw - 40);
    var sub = r.sunk ? (r.score + ' ' + t('strokes').toLowerCase() + ' · ' + t('par') + ' ' + G.H.par) : (t('par') + ' ' + G.H.par);
    text(sub, W / 2, y + chh * 0.33, 17, PAL.inkSoft, 'center', 700, cw - 40);
    var sr = clamp(cw * 0.065, 18, 26);
    starsRow(W / 2, y + chh * 0.52, sr, r.stars, 3, function (i) {
      var tt = now - overlayT - 0.35 - i * 0.22;
      if (tt > 0 && tt < 0.05 && !G['st' + i]) { G['st' + i] = 1; if (i < r.stars) AU.star(i); }
      return tt <= 0 ? 0 : easeBack(tt / 0.3);
    });
    if (r.newBest && r.sunk && now - overlayT > 1.1) {
      ctx.font = font(14, 800); var nw = ctx.measureText(t('newBest')).width + 22;
      ctx.fillStyle = PAL.gold; rr(W / 2 - nw / 2, y + chh * 0.65, nw, 26, 13); ctx.fill();
      text(t('newBest'), W / 2, y + chh * 0.65 + 14, 14, PAL.ink, 'center', 800);
    }
    var bh = clamp(LY.btn, 48, 56), last = G.idx % PER === PER - 1;
    var by = y + chh - bh - 22;
    button('dRetry', x + 22, by, bh, bh, { icon: 'restart', round: true, act: restartHole });
    button('dNext', x + 22 + bh + 12, by, cw - 44 - bh - 12, bh, { primary: true, icon: last ? 'card' : 'next', label: last ? t('scorecard') : t('next'), act: nextHole });
  }
  function drawPause() {
    dim();
    var cw = Math.min(W - 40, 340), bh = clamp(LY.btn, 48, 56), gap = 14;
    var total = bh * 4 + gap * 3 + 70, y = (H - total) / 2, x = (W - cw) / 2;
    text(t('paused'), W / 2, y + 20, 30, PAL.ink, 'center', 900);
    var yy = y + 60;
    button('pResume', x, yy, cw, bh, { primary: true, icon: 'play', label: t('resume'), act: closePause }); yy += bh + gap;
    button('pRestart', x, yy, cw, bh, { icon: 'restart', label: t('restart'), act: function () { closePause(); restartHole(); } }); yy += bh + gap;
    button('pSound', x, yy, cw, bh, { icon: save.snd ? 'sound' : 'mute', label: t('sound'), act: toggleSound }); yy += bh + gap;
    button('pCourses', x, yy, cw, bh, { icon: 'grid', label: t('courses'), act: function () { goHoles(Math.floor(G.idx / PER)); AU.back(); } });
  }

  // ------------------------------------------------------------------ title
  function paperTitle(str, x, y, size, fill) {
    ctx.font = font(size, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.fillStyle = PAL.shadow; ctx.strokeStyle = PAL.shadow; ctx.lineWidth = size * 0.2;
    ctx.strokeText(str, x + 3, y + 6); ctx.fillText(str, x + 3, y + 6);
    ctx.strokeStyle = PAL.paper; ctx.lineWidth = size * 0.2; ctx.strokeText(str, x, y);
    ctx.fillStyle = fill; ctx.fillText(str, x, y);
    ctx.save(); ctx.beginPath(); ctx.rect(x - W, y - size, W * 2, size * 0.42); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillText(str, x, y); ctx.restore();
  }
  function drawTitle() {
    ctx.drawImage(bgCanvas, 0, 0, W, H);
    var land = W > H * 1.15;
    var tc = titleCanvas, bh = clamp(LY.btn * 1.15, 54, 66);
    var ts = land ? clamp(H * 0.12, 40, 84) : clamp(W * 0.15, 38, 72);
    var cx, ty, dx, dy, by;
    if (land) {
      cx = W * 0.72; dx = W * 0.27 - tc.w / 2; dy = H / 2 - tc.h / 2;
      ty = H * 0.26; by = H * 0.62;
    } else {
      cx = W / 2; ty = H * 0.15; dx = W / 2 - tc.w / 2; dy = H * 0.47 - tc.h / 2; by = H * 0.76;
    }
    var bob = Math.sin(now * 1.2) * 3;
    ctx.drawImage(tc.c, dx, dy + bob, tc.w, tc.h);
    A.flagPole(ctx, dx + tc.cupX * tc.k, dy + bob + tc.cupY * tc.k, clamp(tc.w * 0.11, 26, 60), now, 0);
    paperTitle('Putt', cx, ty, ts, PAL.flag);
    paperTitle('Garden', cx, ty + ts * 1.02, ts, PAL.grassDeep);
    text(t('tagline'), cx, ty + ts * 1.85, clamp(ts * 0.3, 14, 20), PAL.inkSoft, 'center', 700, Math.min(W - 40, 420));
    var bw = Math.min(land ? W * 0.36 : W - 64, 340);
    button('play', cx - bw / 2, by, bw, bh, { primary: true, icon: 'play', label: t('play'), size: 24, act: onPlay });
    var s = bh * 0.9, sy = by + bh + 18;
    button('tCourses', cx - s - 8, sy, s, s, { icon: 'grid', round: true, act: function () { goCourses(); } });
    button('tSound', cx + 8, sy, s, s, { icon: save.snd ? 'sound' : 'mute', round: true, act: toggleSound });
    var ts2 = totalStars();
    if (ts2 > 0) {
      A.star(ctx, cx - 30, sy + s + 28, 10, PAL.gold, '#B9811C', 1.2);
      text(ts2 + ' / ' + NH * 3, cx - 14, sy + s + 29, 16, PAL.ink, 'left', 800);
    }
  }
  function onPlay() {
    AU.ui();
    var idx = save.last;
    if (!holeOpen(idx)) idx = 0;
    var allDone = true;
    for (var i = 0; i < NH; i++) if (!played(i)) { allDone = false; break; }
    if (allDone && save.last === 0) { goCourses(); return; }
    startHole(idx);
  }

  // ------------------------------------------------------------------ course select
  function emblem(c, x, y, r) {
    ctx.fillStyle = PAL.shadow; A.circle(ctx, x + 2, y + 4, r); ctx.fill();
    ctx.fillStyle = c === 0 ? PAL.fairway : c === 1 ? PAL.sand : PAL.water; A.circle(ctx, x, y, r); ctx.fill();
    ctx.save(); A.circle(ctx, x, y, r); ctx.clip();
    if (c === 0) {
      A.bush(ctx, x - r * 0.3, y + r * 0.35, r * 0.55, PAL.grassDark, '#7FCB6F', 2);
      A.flower(ctx, x + r * 0.4, y + r * 0.2, r * 0.22, PAL.petal, PAL.pollen);
      A.flower(ctx, x + r * 0.15, y - r * 0.4, r * 0.18, PAL.paper, PAL.pollen);
    } else if (c === 1) {
      ctx.fillStyle = PAL.sandDark; ctx.beginPath(); ctx.ellipse(x, y + r * 0.75, r, r * 0.35, 0, 0, TAU); ctx.fill();
      A.cactus(ctx, x, y + r * 0.55, r * 0.6, 2);
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2.5;
      for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - r * 0.7, y - r * 0.3 + i * r * 0.4); ctx.quadraticCurveTo(x - r * 0.3, y - r * 0.5 + i * r * 0.4, x, y - r * 0.3 + i * r * 0.4); ctx.stroke(); }
      A.lily(ctx, x + r * 0.35, y + r * 0.3, r * 0.35);
    }
    ctx.restore();
    ctx.strokeStyle = PAL.paper; ctx.lineWidth = 3; A.circle(ctx, x, y, r); ctx.stroke();
  }
  function header(title) {
    var s = LY.safe, b = LY.btn;
    button('back', s, s, b, b, { icon: 'left', round: true, act: function () {
      if (screen === 'courses') { screen = 'title'; } else if (screen === 'holes') goCourses();
      else if (screen === 'card') { if (cardFrom === 'round') goCourses(); else goHoles(selCourse); }
      focusId = null; AU.back();
    } });
    text(title, W / 2, s + b / 2, clamp(b * 0.5, 20, 28), PAL.ink, 'center', 900, W - 2 * (s + b + 12));
  }
  function drawCourses() {
    ctx.drawImage(bgCanvas, 0, 0, W, H);
    header(t('courses'));
    var land = W > H * 1.1, top = LY.hud + 12, gap = 16;
    var avW = W - 32, avH = H - top - 24;
    var cw, chh;
    if (land) { cw = Math.min((avW - gap * 2) / 3, 340); chh = Math.min(avH, 380); }
    else { cw = Math.min(avW, 460); chh = Math.min((avH - gap * 2) / 3, 190); }
    for (var c = 0; c < NC; c++) {
      var x, y;
      if (land) { x = W / 2 + (c - 1) * (cw + gap) - cw / 2; y = top + (avH - chh) / 2; }
      else { x = (W - cw) / 2; y = top + (avH - (chh * 3 + gap * 2)) / 2 + c * (chh + gap); }
      courseCard(c, x, y, cw, chh, land);
    }
  }
  function courseCard(c, x, y, w, h, vertical) {
    var open = courseOpen(c), id = 'c' + c, down = pressed === id;
    var yy = down ? y + 3 : y;
    ctx.globalAlpha = open ? 1 : 0.6;
    ctx.fillStyle = PAL.shadow; rr(x + 3, y + 6, w, h, 20); ctx.fill();
    ctx.fillStyle = down ? PAL.paperDark : PAL.paper; rr(x, yy, w, h, 20); ctx.fill();
    var er = vertical ? Math.min(w * 0.26, h * 0.2) : Math.min(h * 0.32, 52);
    var ex = vertical ? x + w / 2 : x + 18 + er, ey = vertical ? yy + 24 + er : yy + h / 2;
    emblem(c, ex, ey, er);
    var tx = vertical ? x + w / 2 : ex + er + 18, al = vertical ? 'center' : 'left', tw = vertical ? w - 24 : x + w - tx - 14;
    var ty = vertical ? ey + er + 30 : yy + h * 0.32;
    text(courseName(c), tx, ty, clamp(h * 0.14, 18, 26), PAL.ink, al, 900, tw);
    var ns = courseStars(c);
    var sy = ty + clamp(h * 0.14, 20, 34);
    if (open) {
      var sx = vertical ? tx - 40 : tx;
      A.star(ctx, sx + 10, sy, 10, PAL.gold, '#B9811C', 1.2);
      text(ns + ' / ' + PER * 3, sx + 26, sy + 1, 17, PAL.ink, 'left', 800);
      var line = t('par') + ' ' + coursePar(c);
      if (courseDone(c)) {
        var tot = 0; for (var i = c * PER; i < (c + 1) * PER; i++) tot += save.best[i];
        line += ' · ' + t('best') + ' ' + tot;
      }
      text(line, tx, sy + 28, 15, PAL.inkSoft, al, 700, tw);
      // progress dots
      var dy2 = sy + 52;
      if (dy2 < yy + h - 10) for (i = 0; i < PER; i++) {
        var dx2 = vertical ? tx + (i - 4) * 14 : tx + 6 + i * 14;
        ctx.fillStyle = played(c * PER + i) ? PAL.grass : '#E4DED0'; A.circle(ctx, dx2, dy2, 4.5); ctx.fill();
      }
    } else {
      A.icon(ctx, 'lock', vertical ? tx : tx + 12, sy + 4, 22, PAL.inkSoft);
    }
    ctx.globalAlpha = 1;
    if (focusId === id && keyboardMode) { ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); rr(x - 5, yy - 5, w + 10, h + 10, 24); ctx.stroke(); ctx.setLineDash([]); }
    ui.push({ id: id, x: x, y: y, w: w, h: h + 6, act: open ? function () { goHoles(c); AU.ui(); } : function () { showToast(t('lockedCourse')); AU.nope(); } });
  }

  // ------------------------------------------------------------------ hole select
  function drawHoles() {
    ctx.drawImage(bgCanvas, 0, 0, W, H);
    var c = selCourse;
    header(courseName(c));
    var bh = clamp(LY.btn, 48, 56), top = LY.hud + 10, bottom = H - LY.safe - bh - 14;
    var gap = 12, land = W > H * 1.1;
    var cols = land ? 5 : 3, rows = Math.ceil(PER / cols);
    var s = Math.min((W - 32 - gap * (cols - 1)) / cols, (bottom - top - gap * (rows - 1)) / rows, 150);
    var gw = cols * s + (cols - 1) * gap, gh = rows * s + (rows - 1) * gap;
    var x0 = (W - gw) / 2, y0 = top + (bottom - top - gh) / 2;
    for (var i = 0; i < PER; i++) {
      var col = i % cols, row = Math.floor(i / cols);
      var rowN = Math.min(cols, PER - row * cols), rx = x0 + (gw - (rowN * s + (rowN - 1) * gap)) / 2;
      holeTile(c * PER + i, rx + col * (s + gap), y0 + row * (s + gap), s);
    }
    var bw = Math.min(W - 64, 300);
    button('hCard', W / 2 - bw / 2, H - LY.safe - bh, bw, bh, { icon: 'card', label: t('scorecard'), act: function () { openCard(c, 'holes'); AU.ui(); } });
  }
  function holeTile(idx, x, y, s) {
    var open = holeOpen(idx), id = 'h' + idx, down = pressed === id, yy = down ? y + 3 : y;
    var cur = open && !played(idx);
    ctx.globalAlpha = open ? 1 : 0.55;
    ctx.fillStyle = PAL.shadow; rr(x + 2, y + 5, s, s, 18); ctx.fill();
    ctx.fillStyle = down ? PAL.paperDark : cur ? '#FFF6E0' : PAL.paper; rr(x, yy, s, s, 18); ctx.fill();
    if (cur) { ctx.strokeStyle = PAL.gold; ctx.lineWidth = 3; rr(x + 1.5, yy + 1.5, s - 3, s - 3, 17); ctx.stroke(); }
    text(String(idx % PER + 1), x + s / 2, yy + s * 0.3, s * 0.3, PAL.ink, 'center', 900);
    if (open) {
      text(t('par') + ' ' + HOLES[idx].par + (played(idx) ? ' · ' + save.best[idx] : ''), x + s / 2, yy + s * 0.56, clamp(s * 0.13, 11, 16), PAL.inkSoft, 'center', 700, s - 10);
      starsRow(x + s / 2, yy + s * 0.78, clamp(s * 0.085, 6, 12), save.stars[idx], 3);
    } else A.icon(ctx, 'lock', x + s / 2, yy + s * 0.68, s * 0.22, PAL.inkSoft);
    ctx.globalAlpha = 1;
    if (focusId === id && keyboardMode) { ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); rr(x - 5, yy - 5, s + 10, s + 10, 22); ctx.stroke(); ctx.setLineDash([]); }
    ui.push({ id: id, x: x, y: y, w: s, h: s + 5, act: open ? function () { startHole(idx); AU.ui(); } : function () { showToast(t('locked')); AU.nope(); } });
  }

  // ------------------------------------------------------------------ scorecard
  function drawCard() {
    ctx.drawImage(bgCanvas, 0, 0, W, H);
    var c = selCourse, fromRound = cardFrom === 'round' && round.c === c;
    header(fromRound ? t('courseDone') : t('scorecard'));
    var bh = clamp(LY.btn, 48, 56), top = LY.hud + 6;
    var land = W > H * 1.1;
    var foot = bh + 24;
    var cw = Math.min(W - 32, land ? 560 : 440);
    var rows = PER + 2, rh = clamp((H - top - foot - 30) / rows, 22, 40);
    var chh = rh * rows + 20, x = (W - cw) / 2, y = top + Math.max(0, (H - top - foot - chh) / 2);
    card(x, y, cw, chh, 20);
    var cols = [0.16, 0.38, 0.62, 0.86];
    var fs = clamp(rh * 0.46, 12, 17);
    var yy = y + 10 + rh / 2;
    text(courseName(c), x + 16, yy, fs, PAL.inkSoft, 'left', 800, cw * 0.22);
    text(t('par'), x + cw * cols[1], yy, fs, PAL.inkSoft, 'center', 800, cw * 0.2);
    text(t('strokes'), x + cw * cols[2], yy, fs, PAL.inkSoft, 'center', 800, cw * 0.22);
    A.star(ctx, x + cw * cols[3], yy, fs * 0.55, PAL.gold, '#B9811C', 1);
    var totPar = 0, totS = 0, totStars = 0, complete = true;
    for (var i = 0; i < PER; i++) {
      var idx = c * PER + i, ry = y + 10 + rh * (i + 1.5);
      if (i % 2 === 0) { ctx.fillStyle = 'rgba(143,216,115,0.16)'; ctx.fillRect(x + 6, ry - rh / 2, cw - 12, rh); }
      var rs = fromRound ? round.s[i] : null;
      var sc = rs ? rs.score : save.best[idx], st = rs ? rs.stars : save.stars[idx];
      totPar += HOLES[idx].par;
      text(t('hole') + ' ' + (i + 1), x + 16, ry, fs, PAL.ink, 'left', 700, cw * 0.24);
      text(String(HOLES[idx].par), x + cw * cols[1], ry, fs, PAL.ink, 'center', 800);
      if (sc > 0) {
        var d = sc - HOLES[idx].par;
        var colr = d < 0 ? '#2E7D3A' : d > 0 ? '#B3343C' : PAL.ink;
        if (d < 0) { ctx.strokeStyle = colr; ctx.lineWidth = 1.6; A.circle(ctx, x + cw * cols[2], ry, fs * 0.85); ctx.stroke(); }
        if (d > 0) { ctx.strokeStyle = colr; ctx.lineWidth = 1.6; ctx.strokeRect(x + cw * cols[2] - fs * 0.8, ry - fs * 0.8, fs * 1.6, fs * 1.6); }
        text(String(sc), x + cw * cols[2], ry + 1, fs, colr, 'center', 800);
        totS += sc;
      } else { text('–', x + cw * cols[2], ry, fs, PAL.inkSoft, 'center', 800); complete = false; }
      for (var k = 0; k < 3; k++) A.star(ctx, x + cw * cols[3] + (k - 1) * fs * 1.05, ry, fs * 0.42, k < st ? PAL.gold : '#E4DED0');
      totStars += st;
    }
    var ty = y + 10 + rh * (PER + 1.5);
    ctx.strokeStyle = 'rgba(36,64,46,0.3)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + 12, ty - rh / 2); ctx.lineTo(x + cw - 12, ty - rh / 2); ctx.stroke();
    text(t('total'), x + 16, ty, fs, PAL.ink, 'left', 900, cw * 0.24);
    text(String(totPar), x + cw * cols[1], ty, fs, PAL.ink, 'center', 900);
    var dd = totS - totPar;
    text(complete ? totS + ' (' + (dd > 0 ? '+' + dd : dd === 0 ? '±0' : dd) + ')' : (totS || '–') + '', x + cw * cols[2], ty, fs, PAL.ink, 'center', 900, cw * 0.24);
    text(String(totStars), x + cw * cols[3], ty, fs, PAL.ink, 'center', 900);
    // footer
    var fy = H - LY.safe - bh, bw = Math.min((W - 48) / 2, 240);
    var hasNext = c < NC - 1 && courseOpen(c + 1);
    if (hasNext) {
      button('kCourses', W / 2 - bw - 8, fy, bw, bh, { icon: 'grid', label: t('courses'), act: function () { goCourses(); AU.back(); } });
      button('kNext', W / 2 + 8, fy, bw, bh, { primary: true, icon: 'next', label: t('nextCourse'), act: function () { startHole((c + 1) * PER); AU.ui(); } });
    } else {
      button('kCourses', W / 2 - bw - 8, fy, bw, bh, { icon: 'grid', label: t('courses'), act: function () { goCourses(); AU.back(); } });
      button('kReplay', W / 2 + 8, fy, bw, bh, { primary: true, icon: 'restart', label: t('replayCourse'), act: function () { startHole(c * PER); AU.ui(); } });
    }
    if (fromRound && now - screenT < 2.5 && Math.random() < 0.25) spawn(1, Math.random() * W, -10, (Math.random() - 0.5) * 60, 60 + Math.random() * 80, 3.5, 5, 0);
    drawParticles();
  }

  function drawToastMenu() {
    if (!toast || screen === 'game' || now - toast.t > 1.6) return;
    var a = clamp(Math.min((now - toast.t) / 0.15, (1.6 - (now - toast.t)) / 0.3), 0, 1);
    ctx.globalAlpha = a;
    bubble(toast.s, W / 2, H - LY.safe - 100, 16, W - 60);
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ render + loop
  function drawSdkPaused() {
    ctx.fillStyle = 'rgba(223,243,228,0.7)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PAL.paper; A.circle(ctx, W / 2, H / 2, 46); ctx.fill();
    A.icon(ctx, 'pause', W / 2, H / 2, 44, PAL.ink);
  }
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ui.length = 0;
    if (screen === 'title') drawTitle();
    else if (screen === 'courses') drawCourses();
    else if (screen === 'holes') drawHoles();
    else if (screen === 'card') drawCard();
    else if (screen === 'game' && G && holeCanvas) drawGame();
    drawToastMenu();
    if (paused) drawSdkPaused();
  }
  function update(dt) {
    updateParticles(dt);
    if (screen === 'game') updateGame(dt);
    AU.ambience(dt, true);
  }
  function frame(ts) {
    rafId = 0;
    if (paused) return;
    var dt = lastT ? Math.min(0.05, (ts - lastT) / 1000) : 0;
    lastT = ts;
    now += dt;
    update(dt);
    render();
    rafId = requestAnimationFrame(frame);
  }
  function startLoop() { if (rafId || paused) return; lastT = 0; rafId = requestAnimationFrame(frame); }
  function stopLoop() { if (rafId) cancelAnimationFrame(rafId); rafId = 0; }

  // ------------------------------------------------------------------ input
  function toLocal(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function onDown(e) {
    AU.ensure(); syncAudio();
    if (e.pointerType === 'mouse') finePointer = true; else if (e.pointerType === 'touch') finePointer = false;
    if (!ready || paused) return;
    if (e.button && e.button !== 0) return;
    keyboardMode = false;
    var p = toLocal(e);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    var b = hitUI(p.x, p.y);
    if (b) { pressed = b.id; return; }
    if (screen === 'game' && G && !overlay && G.phase === 'play' && P.canShoot(G.w) && !G.drag) {
      G.drag = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y };
      G.aim.on = false;
    }
  }
  function onMove(e) {
    if (!G || !G.drag || G.drag.id !== e.pointerId) return;
    var p = toLocal(e);
    G.drag.x = p.x; G.drag.y = p.y;
  }
  function onUp(e) {
    if (G && G.drag && G.drag.id === e.pointerId) {
      var p = toLocal(e);
      G.drag.x = p.x; G.drag.y = p.y;
      var a = aimVector();
      G.drag = null;
      if (a && a.pow >= 0.04 && !overlay) { G.aim.ang = a.ang; G.aim.pow = a.pow; shoot(a.ang, a.pow); }
      return;
    }
    var q = toLocal(e), b = hitUI(q.x, q.y);
    if (pressed && b && b.id === pressed && b.act) b.act();
    pressed = null;
  }
  function onCancel() { pressed = null; if (G) G.drag = null; }

  function onKey(e) {
    if (!ready) return;
    AU.ensure(); syncAudio();
    var k = e.key, handled = true;
    if (paused) return;
    if (k === 'Shift') { keys.Shift = true; return; }
    if (k === 'm' || k === 'M') toggleSound();
    else if (screen === 'game' && G && !overlay) {
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
        if (!G.aim.on) { G.aim.on = true; }
        keys[k] = true;
      } else if (k === ' ' || k === 'Enter') {
        if (G.aim.on && G.phase === 'play' && P.canShoot(G.w)) shoot(G.aim.ang, G.aim.pow);
        else if (!G.aim.on) G.aim.on = true;
      } else if (k === 'r' || k === 'R') restartHole();
      else if (k === 'Escape' || k === 'p' || k === 'P') openPause();
      else handled = false;
    } else if (screen === 'game' && overlay === 'pause' && (k === 'Escape' || k === 'p' || k === 'P')) closePause();
    else if (screen === 'game' && overlay === 'done' && (k === 'r' || k === 'R')) restartHole();
    else handled = menuKey(k);
    if (handled) e.preventDefault();
  }
  function onKeyUp(e) { keys[e.key] = false; if (e.key === 'Shift') keys.Shift = false; }
  function menuKey(k) {
    if (k === 'Escape') {
      keyboardMode = true;
      var back = uiById('back');
      if (back && back.act) { back.act(); return true; }
      if (screen === 'game' && overlay === 'done') { goHoles(Math.floor(G.idx / PER)); return true; }
      return false;
    }
    var dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    var usable = ui.filter(function (b) { return b.act; });
    if (!usable.length) return false;
    if (dirs[k]) {
      keyboardMode = true;
      var cur = uiById(focusId);
      if (!cur || !cur.act) { focusId = defaultFocus(usable); return true; }
      var d = dirs[k], best = null, bestScore = Infinity, cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
      for (var i = 0; i < usable.length; i++) {
        var b = usable[i];
        if (b === cur) continue;
        var dx = b.x + b.w / 2 - cx, dy = b.y + b.h / 2 - cy, along = dx * d[0] + dy * d[1];
        if (along <= 1) continue;
        var score = along + (Math.abs(dx * d[1]) + Math.abs(dy * d[0])) * 2.5;
        if (score < bestScore) { bestScore = score; best = b; }
      }
      if (best) { focusId = best.id; AU.ui(); }
      return true;
    }
    if (k === 'Enter' || k === ' ') {
      keyboardMode = true;
      var f = uiById(focusId);
      if (!f || !f.act) { focusId = defaultFocus(usable); f = uiById(focusId); }
      if (f && f.act) f.act();
      return true;
    }
    return false;
  }
  function defaultFocus(usable) {
    var first = selCourse * PER;
    for (var i = selCourse * PER; i < (selCourse + 1) * PER; i++) if (holeOpen(i) && !played(i)) { first = i; break; }
    var pref = ['play', 'dNext', 'pResume', 'kNext', 'kReplay', 'h' + first, 'c' + selCourse];
    for (var j = 0; j < pref.length; j++) if (usable.some(function (b) { return b.id === pref[j]; })) return pref[j];
    return usable[0].id;
  }

  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onCancel);
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', function () { keys = {}; });
  window.addEventListener('resize', resize);

  // ------------------------------------------------------------------ lifecycle
  PlayablesSDK.onPause(function () {
    paused = true;
    pressed = null; keys = {};
    if (G) G.drag = null;
    stopLoop();
    syncAudio();
    render();
  });
  PlayablesSDK.onResume(function () {
    paused = false;
    syncAudio();
    startLoop();
  });
  PlayablesSDK.onAudioChange(function (enabled) { sdkAudio = !!enabled; syncAudio(); });

  // Small, harmless hook for automated play-tests.
  window.__puttDebug = {
    info: function () {
      return { screen: screen, overlay: overlay, ready: ready, hole: G ? G.idx : -1, phase: G ? G.phase : '', strokes: G ? P.score(G.w) : 0,
        canShoot: G ? P.canShoot(G.w) : false, total: totalStars(), lang: lang, paused: paused, rot: V.rot, result: G ? G.result : null, tut: save.tut };
    },
    start: function (i) { startHole(i); },
    ball: function () { return G ? toScreen(G.w.ball.x, G.w.ball.y) : null; },
    toScreen: function (x, y) { return toScreen(x, y); },
    // pointer drag (from ball, in CSS px) that gives the putt (angleDeg, power)
    dragFor: function (deg, pow) {
      var b = toScreen(G.w.ball.x, G.w.ball.y), d = dirToScreen(deg * Math.PI / 180), L = pow * LY.maxDrag;
      return { x0: b.x, y0: b.y, x1: b.x - d.x * L, y1: b.y - d.y * L };
    },
    shots: function (i) { return HOLES[i].shots; },
    button: function (id) { var b = uiById(id); return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : null; }
  };

  // 1) draw the title synchronously, 2) firstFrameReady, 3) load save + language, 4) gameReady.
  resize();
  PlayablesSDK.firstFrameReady();
  startLoop();
  Promise.all([PlayablesSDK.load(), PlayablesSDK.getLanguage()]).then(function (res) {
    applySave(res[0]);
    lang = I18N.pick(res[1]);
    selCourse = Math.floor(save.last / PER);
    ready = true;
    render();
    PlayablesSDK.gameReady();
  }, function () {
    ready = true;
    PlayablesSDK.gameReady();
  });
})();
