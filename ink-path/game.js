/*
 * game.js: Ink Path, a draw-a-path marble puzzle for YouTube Playables.
 * Vanilla JS + Canvas 2D. Physics and stroke rules: physics.js. Levels: levels.js.
 * Art: art.js. Sound: audio.js. Strings: i18n.js.
 */
(function () {
  'use strict';

  var PlayablesSDK = window.PlayablesSDK, P = window.InkPhysics, LV = window.InkLevels, A = window.InkArt, AU = window.InkAudio, I18N = window.InkI18n;
  PlayablesSDK.init({ storageKey: 'ink-path_save' });

  var PAL = A.PAL;
  var FONT = 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
  var LEVELS = LV.levels, NLV = LEVELS.length, PER = LV.perChapter, NCH = LV.chapters;
  var CW = P.C.W, CHH = P.C.H, MR = P.C.R;
  var BTN_RED = '#B83A22';

  // ------------------------------------------------------------------ i18n
  var lang = I18N.pick(navigator.language || 'en');
  function t(k) { var v = I18N.STR[lang][k]; return v === undefined ? I18N.STR.en[k] : v; }

  // ------------------------------------------------------------------ save
  function defaultSave() {
    var s = [], k = [];
    for (var i = 0; i < NLV; i++) { s.push(0); k.push(0); }
    return { v: 1, stars: s, ink: k, snd: 1, tut: 0, last: 0 };
  }
  var save = defaultSave();
  function clampInt(v, a, b) { v = Math.floor(Number(v) || 0); return v < a ? a : v > b ? b : v; }
  function applySave(o) {
    if (!o || typeof o !== 'object') return;
    for (var i = 0; i < NLV; i++) {
      if (Array.isArray(o.stars)) save.stars[i] = clampInt(o.stars[i], 0, 3);
      if (Array.isArray(o.ink)) save.ink[i] = clampInt(o.ink[i], 0, 100);
    }
    save.snd = o.snd === 0 ? 0 : 1;
    save.tut = clampInt(o.tut, 0, 255);
    save.last = clampInt(o.last, 0, NLV - 1);
  }
  function persist() { PlayablesSDK.save(save); }
  function totalStars() { var s = 0; for (var i = 0; i < NLV; i++) s += save.stars[i]; return s; }
  function cleared(i) { return i >= 0 && i < NLV && save.stars[i] > 0; }
  function unlocked(i) { return i === 0 || cleared(i - 1) || cleared(i - 2); }

  // ------------------------------------------------------------------ canvas + state
  var cv = document.getElementById('game');
  var ctx = cv.getContext('2d');
  var W = 1, H = 1, DPR = 1, U = 1;
  var now = 0, lastT = 0, rafId = 0, paused = false, ready = false;
  var screen = 'title', overlay = null, overlayT = 0;
  var selChapter = 0;
  var ui = [], pressed = null, focusId = null, keyboardMode = false;
  var toast = null;
  var G = null;
  var F = { x: 0, y: 0, s: 1, w: 1, h: 1 };       // field rect (CSS px) and scale (px per world unit)
  var LY = {};                                    // HUD layout
  var bgCanvas = null, titleCanvas = null, levelCanvas = null, sprites = [], glowSpr = null;
  var sdkAudio = PlayablesSDK.isAudioEnabled();
  var drawing = null;                             // active brush gesture
  var SP = new Float32Array(4096), SW = new Float32Array(2048);

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
    if (maxW) while (s > 10 && ctx.measureText(str).width > maxW) { s -= 1; ctx.font = font(s, weight); }
    ctx.fillStyle = color; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
    return s;
  }
  function rr(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function wx(x) { return F.x + x * F.s; }
  function wy(y) { return F.y + y * F.s; }

  // paper card with an ink border
  function card(x, y, w, h) {
    ctx.fillStyle = 'rgba(43,38,34,0.12)'; rr(x + 3, y + 5, w, h, 14); ctx.fill();
    ctx.fillStyle = PAL.paperLight; rr(x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(43,38,34,0.75)'; ctx.lineWidth = 2; rr(x, y, w, h, 14); ctx.stroke();
    ctx.strokeStyle = 'rgba(201,162,74,0.7)'; ctx.lineWidth = 1; rr(x + 5, y + 5, w - 10, h - 10, 10); ctx.stroke();
  }

  // Immediate-mode buttons, registered for hit testing each frame.
  // opt: icon, label, primary, round, disabled, act, size
  function button(id, x, y, w, h, opt) {
    opt = opt || {};
    var down = pressed === id, r = opt.round ? h / 2 : Math.min(h * 0.32, 18);
    var yy = down ? y + 2 : y;
    if (!opt.disabled) { ctx.fillStyle = 'rgba(43,38,34,0.16)'; rr(x + 1, y + 4, w, h, r); ctx.fill(); }
    ctx.fillStyle = opt.primary ? (down ? '#9C301B' : BTN_RED) : (down ? PAL.paperDark : PAL.paperLight);
    if (opt.disabled) ctx.globalAlpha = 0.45;
    rr(x, yy, w, h, r); ctx.fill();
    ctx.strokeStyle = opt.primary ? 'rgba(60,15,8,0.85)' : 'rgba(43,38,34,0.85)';
    ctx.lineWidth = 2; rr(x, yy, w, h, r); ctx.stroke();
    if (!opt.primary) { ctx.strokeStyle = 'rgba(43,38,34,0.18)'; ctx.lineWidth = 1; rr(x + 3.5, yy + 3.5, w - 7, h - 7, Math.max(0, r - 3)); ctx.stroke(); }
    var col = opt.primary ? PAL.paperLight : PAL.ink;
    if (opt.icon && opt.label) {
      var is = h * 0.42, size = opt.size || Math.min(h * 0.4, 22);
      ctx.font = font(size, 800);
      var tw = Math.min(ctx.measureText(opt.label).width, w - is - h * 0.7);
      var x0 = x + w / 2 - (is + h * 0.16 + tw) / 2;
      A.icon(ctx, opt.icon, x0 + is / 2, yy + h / 2, is, col);
      text(opt.label, x0 + is + h * 0.16, yy + h / 2 + 1, size, col, 'left', 800, w - is - h * 0.6);
    } else if (opt.icon) {
      A.icon(ctx, opt.icon, x + w / 2, yy + h / 2, opt.iconSize || h * 0.5, col);
    } else if (opt.label) {
      text(opt.label, x + w / 2, yy + h / 2 + 1, opt.size || Math.min(h * 0.4, 22), col, 'center', 800, w - 14);
    }
    ctx.globalAlpha = 1;
    if (focusId === id && keyboardMode) {
      ctx.strokeStyle = PAL.gold; ctx.lineWidth = 3;
      rr(x - 5, yy - 5, w + 10, h + 10, r + 5); ctx.stroke();
    }
    ui.push({ id: id, x: x, y: y, w: w, h: h + 4, act: opt.disabled ? null : opt.act });
  }
  function hitUI(x, y) {
    for (var i = ui.length - 1; i >= 0; i--) { var b = ui[i]; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b; }
    return null;
  }
  function uiById(id) { for (var i = 0; i < ui.length; i++) if (ui[i].id === id) return ui[i]; return null; }

  // ------------------------------------------------------------------ particles (world units, fixed pool)
  var NP = 260;
  var pX = new Float32Array(NP), pY = new Float32Array(NP), pVX = new Float32Array(NP), pVY = new Float32Array(NP),
    pL = new Float32Array(NP), pM = new Float32Array(NP), pS = new Float32Array(NP), pR = new Float32Array(NP), pVR = new Float32Array(NP),
    pK = new Uint8Array(NP);
  var pNext = 0;
  function spawn(kind, x, y, vx, vy, life, size) {
    var i = pNext; pNext = (pNext + 1) % NP;
    pX[i] = x; pY[i] = y; pVX[i] = vx; pVY[i] = vy; pL[i] = life; pM[i] = life; pS[i] = size; pK[i] = kind;
    pR[i] = Math.random() * 6.28; pVR[i] = (Math.random() - 0.5) * 8;
  }
  function burst(kind, x, y, n, spd, life, size) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, s = spd * (0.3 + Math.random() * 0.7);
      spawn(kind, x, y, Math.cos(a) * s, Math.sin(a) * s - spd * 0.3, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8));
    }
  }
  function updateParticles(dt) {
    for (var i = 0; i < NP; i++) {
      if (pL[i] <= 0) continue;
      pL[i] -= dt;
      var k = pK[i];
      if (k === 0) { pVY[i] += 120 * dt; pVX[i] *= 1 - 1.6 * dt; pVY[i] *= 1 - 1.2 * dt; pVX[i] += Math.sin(now * 3 + i) * 30 * dt; }
      else if (k === 1) { pVY[i] += 900 * dt; }
      else if (k === 2) { pVY[i] += 500 * dt; pVX[i] *= 1 - 2 * dt; }
      else { pVX[i] *= 1 - 3 * dt; pVY[i] *= 1 - 3 * dt; }
      pX[i] += pVX[i] * dt; pY[i] += pVY[i] * dt; pR[i] += pVR[i] * dt;
    }
  }
  function drawParticles() {
    for (var i = 0; i < NP; i++) {
      if (pL[i] <= 0) continue;
      var a = clamp(pL[i] / pM[i], 0, 1), x = wx(pX[i]), y = wy(pY[i]), s = pS[i] * F.s, k = pK[i];
      if (k === 0) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(pR[i]);
        ctx.globalAlpha = a; ctx.fillStyle = (i & 1) ? PAL.gold : PAL.goldLight;
        ctx.fillRect(-s, -s * 0.6 * Math.abs(Math.cos(pR[i] * 1.7)) - 0.5, s * 2, s * 1.2 * Math.abs(Math.cos(pR[i] * 1.7)) + 1);
        ctx.restore();
      } else if (k === 1) {
        ctx.globalAlpha = a * 0.85; ctx.fillStyle = PAL.ink;
        ctx.beginPath(); ctx.arc(x, y, Math.max(0.8, s), 0, 6.283); ctx.fill();
      } else if (k === 2) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(pR[i]); ctx.globalAlpha = a;
        ctx.fillStyle = PAL.shoji; ctx.fillRect(-s, -s * 0.7, s * 2, s * 1.4);
        ctx.strokeStyle = 'rgba(107,78,49,0.6)'; ctx.lineWidth = 0.8; ctx.strokeRect(-s, -s * 0.7, s * 2, s * 1.4);
        ctx.restore();
      } else {
        ctx.globalAlpha = a * 0.35; ctx.fillStyle = PAL.indigo;
        ctx.beginPath(); ctx.arc(x, y, Math.max(1, s), 0, 6.283); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  function clearParticles() { for (var i = 0; i < NP; i++) pL[i] = 0; }

  // ------------------------------------------------------------------ layout
  function layout() {
    U = Math.min(W, H) / 100;
    var safe = 14, btn = clamp(Math.round(Math.min(W, H) * 0.12), 46, 62), go = Math.round(btn * 1.3);
    LY.btn = btn; LY.go = go; LY.safe = safe;
    // portrait-style: HUD above and below
    var topH = btn + 8, botH = btn * 0.62 + go + 18;
    var pw = W - safe * 2, ph = H - safe * 2 - topH - botH - 20;
    var sP = Math.min(pw / CW, ph / CHH);
    // landscape-style: HUD in side panels
    var side = Math.max(go * 2.6, Math.min(280, W * 0.22));
    var lw = W - side * 2 - safe * 2, lh = H - safe * 2 - 20;
    var sL = Math.min(lw / CW, lh / CHH);
    LY.land = sL > sP * 1.04;
    var s = LY.land ? sL : sP;
    F.s = s; F.w = CW * s; F.h = CHH * s;
    if (LY.land) {
      F.x = Math.round((W - F.w) / 2); F.y = Math.round((H - F.h) / 2);
      var lx = Math.max(safe, F.x - 24 - side), rx = F.x + F.w + 24;
      LY.left = { x: lx, w: F.x - 24 - lx, y: safe };
      LY.right = { x: rx, w: Math.min(side, W - safe - rx), y: safe };
    } else {
      var avail = H - safe * 2 - topH - botH;
      F.x = Math.round((W - F.w) / 2);
      F.y = Math.round(safe + topH + Math.max(10, (avail - F.h) / 2));
      LY.topY = safe; LY.botY = F.y + F.h + 14;
    }
  }

  // ------------------------------------------------------------------ caches
  function buildBg() {
    bgCanvas = A.paper(W, H, DPR, 31, PAL.paper);
    var g = bgCanvas.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    A.mountains(g, W, H, 9, 0.8);
  }
  function buildTitle() {
    var size = W > H * 1.1 ? Math.min(H * 0.72, W * 0.42, 520) : Math.min(W * 0.82, H * 0.44, 460);
    var c = A.makeCanvas(size, size, DPR), g = c.getContext('2d');
    g.scale(DPR, DPR);
    var cx = size / 2, cy = size / 2;
    // vermilion sun
    g.fillStyle = 'rgba(217,69,43,0.85)';
    g.beginPath(); g.arc(cx + size * 0.34, cy - size * 0.35, size * 0.095, 0, 6.283); g.fill();
    A.enso(g, cx, cy, size * 0.4, size * 0.07, 5, 0.85);
    var h = size * 0.25;
    var w1 = A.wordWidth('INK') * h, w2 = A.wordWidth('PATH') * h;
    A.calligraphy(g, 'INK', cx - w1 / 2 - h * 0.05, cy - h * 1.12, h, 21);
    A.calligraphy(g, 'PATH', cx - w2 / 2 + h * 0.05, cy + h * 0.12, h, 37);
    A.seal(g, cx + size * 0.36, cy + size * 0.3, size * 0.11, true, 0.06);
    titleCanvas = { c: c, s: size };
  }
  function buildSprites() {
    var r = MR * F.s;
    sprites = [A.marbleSprites(r, DPR, 0), A.marbleSprites(r, DPR, 1)];
    glowSpr = A.lanternGlow(44 * F.s, DPR);
  }
  // static level art: paper, mist, stones, lantern tracks, cup interiors
  function buildLevel() {
    if (!G) { levelCanvas = null; return; }
    var L = G.L, k = F.s;
    var c = A.paper(F.w, F.h, DPR, 100 + G.idx, PAL.paperLight, { vignette: true });
    var g = c.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    var i, a;
    // fade towards the bottom edge: the void
    var vg = g.createLinearGradient(0, F.h * 0.9, 0, F.h);
    vg.addColorStop(0, 'rgba(43,38,34,0)'); vg.addColorStop(1, 'rgba(43,38,34,0.1)');
    g.fillStyle = vg; g.fillRect(0, F.h * 0.9, F.w, F.h * 0.1);
    var mist = L.mist || [];
    for (i = 0; i < mist.length; i++) { a = mist[i]; A.mist(g, a[0] * k, a[1] * k, a[2] * k, a[3] * k, 50 + i * 13 + G.idx, k); }
    for (i = 0; i < mist.length; i++) {
      a = mist[i];
      if (a[2] * k > 40 && a[3] * k > 40) A.noInk(g, (a[0] + a[2] / 2) * k, (a[1] + a[3] / 2) * k, Math.min(34, Math.min(a[2], a[3]) * k * 0.3), 0.4);
    }
    var lan = L.lan || [];
    g.setLineDash([3, 6]); g.strokeStyle = 'rgba(217,69,43,0.35)'; g.lineWidth = 1.5;
    for (i = 0; i < lan.length; i++) { a = lan[i]; g.beginPath(); g.moveTo(a[0] * k, a[1] * k); g.lineTo(a[2] * k, a[3] * k); g.stroke(); }
    g.setLineDash([]);
    var ledges = L.L || [];
    for (i = 0; i < ledges.length; i++) { a = ledges[i]; A.stone(g, a[0] * k, a[1] * k, a[2] * k, a[3] * k, (a[4] || P.C.LEDGE_R) * k, 70 + i * 7 + G.idx); }
    var cups = L.c || [];
    for (i = 0; i < cups.length; i++) A.cupBack(g, cups[i][0] * k, cups[i][1] * k, k);
    // a delicate frame line
    g.strokeStyle = 'rgba(43,38,34,0.25)'; g.lineWidth = 1; g.strokeRect(3.5, 3.5, F.w - 7, F.h - 7);
    levelCanvas = c;
  }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    layout();
    buildBg(); buildTitle(); buildSprites(); buildLevel();
    render();
  }

  // ------------------------------------------------------------------ level flow
  function startLevel(idx) {
    var L = LEVELS[idx];
    var hint = P.buildFrom(L, L.sol);
    G = {
      idx: idx, L: L, world: P.createWorld(L), strokes: [], used: 0,
      phase: 'draw', phaseT: now, acc: 0, fails: 0, hint: false, hintPolys: hint.polys,
      msg: '', capRT: [], splat: null, startT: now, stars: 0, pct: 0, prevStars: save.stars[idx],
      stamped: 0, firstStroke: false, wind: makeWind(L), went: false
    };
    for (var i = 0; i < G.world.marbles.length; i++) G.capRT.push(-1);
    screen = 'game'; overlay = null; focusId = null; drawing = null;
    save.last = idx;
    clearParticles();
    buildLevel();
  }
  function makeWind(L) {
    var zones = L.wind || [], out = [];
    for (var i = 0; i < zones.length; i++) {
      var z = zones[i], n = clamp(Math.round(z[2] * z[3] / 4500), 8, 36), arr = new Float32Array(n * 4);
      var r = A.rng(300 + i);
      for (var j = 0; j < n; j++) { arr[j * 4] = r(); arr[j * 4 + 1] = r(); arr[j * 4 + 2] = 0.6 + r() * 0.8; arr[j * 4 + 3] = 0.6 + r() * 0.8; }
      out.push(arr);
    }
    return out;
  }
  function inkLeft() { return G ? Math.max(0, G.L.ink - G.used) : 0; }
  function projStars(used) { return P.starsFor(G.L, used); }

  function allPolys() {
    var out = [];
    for (var i = 0; i < G.strokes.length; i++) for (var j = 0; j < G.strokes[i].polys.length; j++) out.push(G.strokes[i].polys[j]);
    return out;
  }
  function go() {
    if (!G || overlay) return;
    if (G.phase === 'run' || G.phase === 'fail') { backToDraw(); return; }
    if (G.phase !== 'draw') return;
    endStroke();
    P.setStrokes(G.world, allPolys());
    P.reset(G.world);
    for (var i = 0; i < G.capRT.length; i++) G.capRT[i] = -1;
    G.phase = 'dry'; G.phaseT = now; G.acc = 0; G.went = true;
    if (G.idx === 1 && !(save.tut & 2)) { save.tut |= 2; }
    AU.dry();
  }
  function backToDraw() {
    if (!G) return;
    P.reset(G.world);
    G.phase = 'draw'; G.phaseT = now; G.splat = null;
    for (var i = 0; i < G.capRT.length; i++) G.capRT[i] = -1;
    AU.stopRoll();
  }
  function undo() {
    if (!G || overlay || G.phase === 'won' || G.phase === 'dry') return;
    if (G.phase !== 'draw') backToDraw();
    endStroke();
    if (!G.strokes.length) { AU.nope(); return; }
    var s = G.strokes.pop();
    G.used = Math.max(0, G.used - s.ink);
    AU.back();
  }
  function clearAll() {
    if (!G || overlay || G.phase === 'won' || G.phase === 'dry') return;
    if (G.phase !== 'draw') backToDraw();
    endStroke();
    if (!G.strokes.length) return;
    G.strokes.length = 0; G.used = 0;
    AU.back();
  }
  function retry() {
    if (!G || overlay) return;
    if (G.phase === 'run' || G.phase === 'fail' || G.phase === 'dry') backToDraw();
    else if (G.phase === 'draw') clearAll();
  }
  function hintAvailable() { return G && (G.fails >= 2 || cleared(G.idx)); }
  function toggleHint() { if (!hintAvailable()) return; G.hint = !G.hint; AU.ui(); }
  function toggleSound() { save.snd = save.snd ? 0 : 1; AU.ensure(); syncAudio(); persist(); AU.ui(); }

  function win() {
    var used = G.used, stars = projStars(used), pct = Math.round(used / G.L.ink * 100);
    G.phase = 'won'; G.phaseT = now; G.stars = stars; G.pct = pct;
    var before = totalStars();
    if (stars > save.stars[G.idx]) save.stars[G.idx] = stars;
    if (!save.ink[G.idx] || pct < save.ink[G.idx]) save.ink[G.idx] = Math.max(1, pct);
    if (G.idx === 0) save.tut |= 1;
    if (G.idx === 1) save.tut |= 2;
    save.last = Math.min(NLV - 1, G.idx + 1);
    persist();
    var after = totalStars();
    if (after > before) PlayablesSDK.sendScore(after);
    AU.stopRoll(); AU.win();
    var cups = G.world.cups;
    for (var i = 0; i < cups.length; i++) burst(0, cups[i].x, cups[i].y - 40, 26, 380, 2.2, 4);
  }
  function fail(res) {
    G.phase = 'fail'; G.phaseT = now; G.fails++;
    G.msg = res === P.RES_LOST ? t('lost') : res === P.RES_STUCK ? t('stuck') : t('time');
    AU.stopRoll(); AU.fail();
  }

  // ------------------------------------------------------------------ drawing input
  function toWorld(px, py, out) { out.x = (px - F.x) / F.s; out.y = (py - F.y) / F.s; return out; }
  var tmpW = { x: 0, y: 0 };
  function beginStroke(px, py, id) {
    if (G.phase !== 'draw') backToDraw();
    if (inkLeft() < 2) { showToast(t('noInk')); AU.nope(); return; }
    toWorld(px, py, tmpW);
    var b = new P.Builder(G.L, inkLeft());
    drawing = { b: b, id: id, lx: tmpW.x, ly: tmpW.y, lt: performance.now() / 1000, w: 12, blocked: 0 };
    b.add(tmpW.x, tmpW.y, 12);
    if (b.blocked) mistPuff(tmpW.x, tmpW.y);
    drawing.blocked = b.blocked;
    G.firstStroke = true;
    AU.startBrush();
  }
  function moveStroke(px, py) {
    var d = drawing;
    toWorld(px, py, tmpW);
    var tn = performance.now() / 1000, dx = tmpW.x - d.lx, dy = tmpW.y - d.ly, dist = Math.sqrt(dx * dx + dy * dy), dt = Math.max(0.004, tn - d.lt);
    if (dist < 1.5) return;
    var speed = dist / dt;
    var target = clamp(15.5 - speed / 260, 7.5, 15.5);
    d.w = d.w * 0.6 + target * 0.4;
    d.b.add(tmpW.x, tmpW.y, d.w);
    d.lx = tmpW.x; d.ly = tmpW.y; d.lt = tn;
    AU.brush(speed / 2500);
    if (d.b.blocked > d.blocked) { d.blocked = d.b.blocked; mistPuff(tmpW.x, tmpW.y); AU.nope(); }
    if (d.b.out) { endStroke(); showToast(t('noInk')); AU.nope(); }
  }
  function mistPuff(x, y) { burst(3, x, y, 6, 60, 0.6, 7); }
  function endStroke() {
    if (!drawing) return;
    var r = drawing.b.finish();
    drawing = null;
    AU.stopBrush();
    if (!r.polys.length) return;
    G.strokes.push({ polys: r.polys, ws: r.ws, ink: r.ink, wet: 1 });
    G.used += r.ink;
  }

  // ------------------------------------------------------------------ update
  function update(dt) {
    updateParticles(dt);
    if (toast && now - toast.t > 2.2) toast = null;
    if (screen !== 'game' || !G || overlay) return;
    var i;
    if (G.phase === 'dry') {
      for (i = 0; i < G.strokes.length; i++) G.strokes[i].wet = Math.max(0, G.strokes[i].wet - dt / 0.4);
      if (now - G.phaseT > 0.42) { G.phase = 'run'; G.phaseT = now; G.acc = 0; AU.startRoll(); }
      return;
    }
    if (G.phase === 'run') runPhysics(dt);
    else if (G.phase === 'fail' && now - G.phaseT > 1.4) backToDraw();
    else if (G.phase === 'won' && now - G.phaseT > 1.1 && !overlay) { overlay = 'done'; overlayT = now; G.stamped = 0; focusId = null; }
  }
  function runPhysics(dt) {
    var w = G.world, ev = w.ev, n = 0;
    G.acc += Math.min(dt, 0.05);
    while (G.acc >= P.C.DT && n < 14) {
      P.step(w); n++; G.acc -= P.C.DT;
      for (var e = 0; e < ev.n; e++) handleEvent(ev.type[e], ev.x[e], ev.y[e], ev.s[e]);
      ev.n = 0;
      if (w.result !== P.RES_RUN) break;
    }
    var roll = 0;
    for (var i = 0; i < w.marbles.length; i++) {
      var m = w.marbles[i];
      if (m.state === 0 && m.contact) roll = Math.max(roll, Math.sqrt(m.vx * m.vx + m.vy * m.vy) / 900);
    }
    AU.roll(roll);
    if (w.result === P.RES_WIN) win();
    else if (w.result !== P.RES_RUN) fail(w.result);
  }
  function handleEvent(type, x, y, s) {
    if (type === P.EV_HIT) { AU.tock(s); if (s > 380) burst(1, x, y, 3, 120, 0.4, 1.6); }
    else if (type === P.EV_PAD) { AU.boing(); burst(3, x, y, 5, 90, 0.5, 6); }
    else if (type === P.EV_TEAR) { AU.tear(); burst(2, x, y, 14, 320, 1.1, 5); }
    else if (type === P.EV_CUP) {
      AU.cup(); burst(0, x, y - 40, 10, 200, 1.4, 3.5);
      var ws = G.world.marbles;
      for (var i = 0; i < ws.length; i++) if (ws[i].state === 1 && G.capRT[i] < 0) G.capRT[i] = now;
    }
    else if (type === P.EV_LANTERN) AU.lantern();
    else if (type === P.EV_CLACK) AU.clack();
    else if (type === P.EV_LOST) {
      var r = A.rng((x * 7 + y * 13) | 0), rad = new Float32Array(12);
      for (var k = 0; k < 12; k++) rad[k] = 0.6 + r() * 0.6;
      G.splat = { x: clamp(x, 12, CW - 12), y: clamp(y, 12, CHH - 12), t: now, rad: rad };
      burst(1, clamp(x, 0, CW), clamp(y, 0, CHH), 12, 300, 0.7, 2.4);
    }
  }

  // ------------------------------------------------------------------ render: game
  function drawField() {
    // scroll mounting
    var m = Math.max(6, F.s * 14);
    ctx.fillStyle = 'rgba(43,38,34,0.16)'; ctx.fillRect(F.x - m + 3, F.y - m + 6, F.w + m * 2, F.h + m * 2);
    ctx.fillStyle = PAL.mount; ctx.fillRect(F.x - m, F.y - m, F.w + m * 2, F.h + m * 2);
    ctx.strokeStyle = 'rgba(43,38,34,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(F.x - m + 0.5, F.y - m + 0.5, F.w + m * 2 - 1, F.h + m * 2 - 1);
    ctx.strokeStyle = 'rgba(201,162,74,0.8)'; ctx.lineWidth = 1.2; ctx.strokeRect(F.x - 2.5, F.y - 2.5, F.w + 5, F.h + 5);
    // rods
    var rh = Math.max(5, m * 0.7);
    ctx.fillStyle = PAL.wood;
    rr(F.x - m - rh, F.y - m - rh * 0.6, F.w + m * 2 + rh * 2, rh, rh / 2); ctx.fill();
    rr(F.x - m - rh, F.y + F.h + m - rh * 0.4, F.w + m * 2 + rh * 2, rh, rh / 2); ctx.fill();
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(F.x - m - rh * 1.2, F.y - m - rh * 0.7, rh * 0.5, rh * 1.2); ctx.fillRect(F.x + F.w + m + rh * 0.7, F.y - m - rh * 0.7, rh * 0.5, rh * 1.2);
    ctx.fillRect(F.x - m - rh * 1.2, F.y + F.h + m - rh * 0.5, rh * 0.5, rh * 1.2); ctx.fillRect(F.x + F.w + m + rh * 0.7, F.y + F.h + m - rh * 0.5, rh * 0.5, rh * 1.2);
    if (levelCanvas) ctx.drawImage(levelCanvas, F.x, F.y, F.w, F.h);
  }

  function drawPoly(p, ws, opt, constW) {
    var n = Math.min(p.length / 2, 2048);
    for (var i = 0; i < n; i++) { SP[i * 2] = wx(p[i * 2]); SP[i * 2 + 1] = wy(p[i * 2 + 1]); SW[i] = (ws ? ws[i] : constW) * F.s; }
    opt.tin = 5 * F.s; opt.tout = 16 * F.s; opt.bleed = 3 * F.s;
    A.brush(ctx, SP, SW, n, opt);
  }
  var strokeOpt = { color: '43,38,34', alpha: 1, wet: 0, dry: true, tin: 0, tout: 0, bleed: 0, progress: 1, wobble: 0.22, seed: 0 };
  function drawStrokes() {
    var i, j;
    for (i = 0; i < G.strokes.length; i++) {
      var s = G.strokes[i];
      strokeOpt.wet = s.wet; strokeOpt.alpha = 0.92 + 0.06 * (1 - s.wet); strokeOpt.progress = 1; strokeOpt.color = s.wet > 0.01 ? '48,44,52' : '43,38,34';
      strokeOpt.seed = i * 1.7 + 0.5;
      for (j = 0; j < s.polys.length; j++) drawPoly(s.polys[j], s.ws[j], strokeOpt);
    }
    strokeOpt.seed = G.strokes.length * 1.7 + 0.5;
    if (drawing) {
      var b = drawing.b;
      strokeOpt.wet = 1; strokeOpt.alpha = 0.92; strokeOpt.color = '48,44,52';
      for (j = 0; j < b.polys.length; j++) drawPoly(b.polys[j], b.ws[j], strokeOpt);
      if (b.cur && b.cur.length >= 4) drawPoly(b.cur, b.curW, strokeOpt);
      else if (b.cur) { ctx.fillStyle = 'rgba(48,44,52,0.7)'; ctx.beginPath(); ctx.arc(wx(b.cur[0]), wy(b.cur[1]), 5 * F.s, 0, 6.283); ctx.fill(); }
    }
  }
  var ghostOpt = { color: '43,38,34', alpha: 0.16, wet: 0, dry: false, tin: 0, tout: 0, bleed: 0, progress: 1 };
  function drawGhost(progress, alpha) {
    ghostOpt.alpha = alpha; ghostOpt.progress = progress;
    for (var i = 0; i < G.hintPolys.length; i++) drawPoly(G.hintPolys[i], null, ghostOpt, 11);
  }

  function drawWind() {
    var zones = G.L.wind || [];
    ctx.lineCap = 'round';
    for (var i = 0; i < zones.length; i++) {
      var z = zones[i], arr = G.wind[i], n = arr.length / 4;
      var fl = Math.sqrt(z[4] * z[4] + z[5] * z[5]) || 1, dx = z[4] / fl, dy = z[5] / fl;
      var horiz = Math.abs(dx) >= Math.abs(dy), along = horiz ? z[2] : z[3], across = horiz ? z[3] : z[2];
      var cx = z[0] + z[2] / 2, cy = z[1] + z[3] / 2;
      ctx.save();
      ctx.beginPath(); ctx.rect(wx(z[0]), wy(z[1]), z[2] * F.s, z[3] * F.s); ctx.clip();
      ctx.fillStyle = 'rgba(91,107,133,0.09)'; ctx.fillRect(wx(z[0]), wy(z[1]), z[2] * F.s, z[3] * F.s);
      ctx.strokeStyle = 'rgb(70,84,108)';
      for (var j = 0; j < n; j++) {
        var u = arr[j * 4] + now * 0.32 * arr[j * 4 + 2] * fl / 1200;
        u -= Math.floor(u);
        var v = arr[j * 4 + 1], len = 46 * arr[j * 4 + 3];
        var px = cx + dx * (u - 0.5) * (along + 80) + (-dy) * (v - 0.5) * across;
        var py = cy + dy * (u - 0.5) * (along + 80) + dx * (v - 0.5) * across;
        var wob = Math.sin(now * 2 + j) * 6;
        ctx.globalAlpha = Math.sin(u * Math.PI) * 0.75;
        ctx.lineWidth = Math.max(1.3, 3 * F.s);
        ctx.beginPath();
        ctx.moveTo(wx(px - dx * len), wy(py - dy * len));
        ctx.quadraticCurveTo(wx(px - dx * len * 0.5 - dy * wob), wy(py - dy * len * 0.5 + dx * wob), wx(px), wy(py));
        if (j % 3 === 0) {
          var hl = 9;
          ctx.moveTo(wx(px - dx * hl - dy * hl * 0.6), wy(py - dy * hl + dx * hl * 0.6));
          ctx.lineTo(wx(px), wy(py));
          ctx.lineTo(wx(px - dx * hl + dy * hl * 0.6), wy(py - dy * hl - dx * hl * 0.6));
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      ctx.setLineDash([5, 6]); ctx.strokeStyle = 'rgba(91,107,133,0.35)'; ctx.lineWidth = 1;
      ctx.strokeRect(wx(z[0]), wy(z[1]), z[2] * F.s, z[3] * F.s); ctx.setLineDash([]);
    }
  }

  function drawElements() {
    var w = G.world, k = F.s, i, a;
    var pads = G.L.pad || [];
    for (i = 0; i < pads.length; i++) {
      a = pads[i];
      var comp = G.phase === 'run' ? Math.max(0, 1 - (w.t - w.padHit[i]) / 0.22) : 0;
      if (comp > 0) comp = Math.sin(comp * Math.PI) * 1;
      A.pad(ctx, wx(a[0]), wy(a[1]), wx(a[2]), wy(a[3]), k, comp);
    }
    var scr = G.L.scr || [];
    for (i = 0; i < scr.length; i++) { a = scr[i]; A.screen(ctx, wx(a[0]), wy(a[1]), wx(a[2]), wy(a[3]), k, !!w.scrBroken[i], 900 + i); }
  }

  function drawMarblesAndCups() {
    var w = G.world, k = F.s, i;
    var holding = G.phase === 'draw' || G.phase === 'dry';
    for (i = 0; i < w.marbles.length; i++) {
      var m = w.marbles[i], x = m.x, y = m.y;
      if (m.state === 2) continue;
      if (m.state === 1 && G.capRT[i] >= 0) {
        var f = ease((now - G.capRT[i]) / 0.3);
        x = m.capX + (m.x - m.capX) * f; y = m.capY + (m.y - m.capY) * f;
      }
      if (holding) {
        // silk thread holding the marble until Go
        var top = G.phase === 'dry' ? m.sy - MR - (m.sy - MR) * ease((now - G.phaseT) / 0.35) : 0;
        ctx.strokeStyle = 'rgba(43,38,34,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(wx(m.sx), wy(G.phase === 'dry' ? 0 : 0)); ctx.lineTo(wx(m.sx), wy(G.phase === 'dry' ? top : m.sy - MR)); ctx.stroke();
        if (G.phase === 'draw') { ctx.fillStyle = PAL.vermilion; ctx.beginPath(); ctx.arc(wx(m.sx), wy(m.sy - MR - 3), Math.max(1.5, 3 * k), 0, 6.283); ctx.fill(); }
      }
      A.drawMarble(ctx, sprites[i % 2], wx(x), wy(y), m.rot, 1);
    }
    for (i = 0; i < w.cups.length; i++) {
      var c = w.cups[i], glow = 0;
      if (c.filled >= 0 && G.capRT[c.filled] >= 0) glow = clamp((now - G.capRT[c.filled]) / 0.4, 0, 1) * (0.7 + 0.3 * Math.sin(now * 3));
      A.cupFront(ctx, wx(c.x), wy(c.y), k, glow);
    }
    // start rings: where the marbles wait (no ink there)
    if (G.phase === 'draw' && drawing) {
      ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(217,69,43,0.45)'; ctx.lineWidth = 1.2;
      for (i = 0; i < w.marbles.length; i++) { ctx.beginPath(); ctx.arc(wx(w.marbles[i].sx), wy(w.marbles[i].sy), P.C.NODRAW_M * k, 0, 6.283); ctx.stroke(); }
      ctx.setLineDash([]);
    }
  }

  function drawLanterns() {
    var w = G.world, k = F.s;
    for (var i = 0; i < w.lan.length; i++) {
      var l = w.lan[i], sway = G.phase === 'run' ? clamp(l.vx * 0.0006, -0.25, 0.25) : 0;
      A.lantern(ctx, wx(l.x), wy(l.y), l.r * k, F.y, glowSpr, sway);
    }
  }

  function drawSplat() {
    var s = G.splat;
    if (!s) return;
    var a = clamp(1 - (now - s.t) / 1.4, 0, 1), x = wx(s.x), y = wy(s.y), r = 26 * F.s * (0.6 + 0.4 * ease((now - s.t) / 0.2));
    ctx.fillStyle = 'rgba(43,38,34,' + (0.75 * a).toFixed(3) + ')';
    ctx.beginPath();
    for (var i = 0; i < 12; i++) {
      var ang = i / 12 * 6.283, rad = r * s.rad[i];
      if (i === 0) ctx.moveTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
      else ctx.quadraticCurveTo(x + Math.cos(ang - 0.26) * rad * 1.25, y + Math.sin(ang - 0.26) * rad * 1.25, x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
    }
    ctx.closePath(); ctx.fill();
  }

  function drawGame() {
    drawField();
    ctx.save();
    ctx.beginPath(); ctx.rect(F.x, F.y, F.w, F.h); ctx.clip();
    drawWind();
    if (G.hint) drawGhost(1, 0.3 + 0.08 * Math.sin(now * 3));
    tutorialGhost();
    drawStrokes();
    drawElements();
    drawMarblesAndCups();
    drawLanterns();
    drawSplat();
    drawParticles();
    ctx.restore();
    drawHud();
    drawTips();
    if (overlay === 'done') drawDone();
    else if (overlay === 'pause') drawPauseMenu();
  }

  // ------------------------------------------------------------------ HUD
  function levelLabel() { var c = Math.floor(G.idx / PER); return t('chapters')[c] + ' ' + (G.idx % PER + 1); }
  function inkMeter(x, y, w, h) {
    var L = G.L, used = G.used + (drawing ? drawing.b.ink : 0), left = clamp(1 - used / L.ink, 0, 1);
    LY.meter = { x: x, y: y, w: w, h: h };
    // pot
    var pr = h * 0.42, px = x + pr, py = y + h / 2;
    ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.ellipse(px, py + pr * 0.15, pr, pr * 0.85, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#4A433D'; ctx.beginPath(); ctx.ellipse(px, py - pr * 0.25, pr * 0.72, pr * 0.3, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.ellipse(px, py - pr * 0.25, pr * (0.2 + 0.5 * left), pr * 0.18 * (0.3 + left), 0, 0, 6.283); ctx.fill();
    // bar
    var bx = x + pr * 2 + 10, sealS = h * 0.5, bw = w - (bx - x) - sealS * 3 - 26, by = py, bh = Math.max(6, h * 0.32);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(43,38,34,0.13)'; ctx.lineWidth = bh; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.stroke();
    if (left > 0.002) {
      SP[0] = bx; SP[1] = by; SP[2] = bx + bw * left; SP[3] = by;
      SW[0] = bh * 0.95; SW[1] = bh * 0.8;
      strokeOpt.wet = 0; strokeOpt.alpha = 0.92; strokeOpt.progress = 1; strokeOpt.color = '43,38,34'; strokeOpt.tin = 2; strokeOpt.tout = Math.min(14, bw * left); strokeOpt.bleed = 0; strokeOpt.wobble = 0;
      A.brush(ctx, SP, SW, 2, strokeOpt);
      strokeOpt.wobble = 0.22;
    }
    // seal thresholds on the bar
    for (var q = 0; q < 2; q++) {
      var tx = bx + bw * (1 - L.st[q] / 100);
      ctx.strokeStyle = PAL.vermilion; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tx, by - bh * 0.95); ctx.lineTo(tx, by + bh * 0.95); ctx.stroke();
    }
    var st = projStars(used);
    for (var i = 0; i < 3; i++) A.seal(ctx, bx + bw + 14 + sealS * 0.5 + i * (sealS + 3), by, sealS, i < st, (i - 1) * 0.06, i < st ? 1 : 0.9);
  }

  function hudButtons(list) { for (var i = 0; i < list.length; i++) { var b = list[i]; button(b[0], b[1], b[2], b[3], b[4], b[5]); } }
  function drawHud() {
    var b = LY.btn, g = LY.go, running = G.phase === 'run' || G.phase === 'fail' || G.phase === 'dry';
    var canEdit = G.phase !== 'won';
    var goOpt = { icon: running ? 'retry' : 'go', primary: true, round: true, iconSize: g * 0.42, act: go, disabled: G.phase === 'won' };
    var hintOn = hintAvailable();
    if (LY.land) {
      var lx = LY.left.x, lw = LY.left.w, rx = LY.right.x, rw = LY.right.w, y0 = LY.left.y;
      button('pause', lx, y0, b, b, { icon: 'pause', round: true, act: openPause });
      text(levelLabel(), lx, y0 + b + 30, Math.min(26, lw * 0.16), PAL.ink, 'left', 800, lw);
      var bestS = save.stars[G.idx];
      for (var i = 0; i < 3; i++) A.seal(ctx, lx + 14 + i * 32, y0 + b + 66, 26, i < bestS, (i - 1) * 0.06, i < bestS ? 1 : 0.8);
      inkMeter(lx, y0 + b + 100, Math.min(lw, 280), 40);
      var cxr = rx + Math.min(rw, g * 2.4) / 2, gy = F.y + F.h * 0.5 - g;
      button('go', cxr - g / 2, gy, g, g, goOpt);
      var row = gy + g + 22;
      button('undo', cxr - b - 6, row, b, b, { icon: 'undo', round: true, act: undo, disabled: !canEdit || !G.strokes.length });
      button('clear', cxr + 6, row, b, b, { icon: 'clear', round: true, act: clearAll, disabled: !canEdit || !G.strokes.length });
      if (hintOn) button('hint', cxr - b / 2, row + b + 16, b, b, { icon: 'hint', round: true, act: toggleHint });
      LY.goRect = uiById('go');
    } else {
      var y = LY.topY;
      button('pause', LY.safe, y, b, b, { icon: 'pause', round: true, act: openPause });
      text(levelLabel(), W / 2, y + b / 2, Math.min(24, W * 0.06), PAL.ink, 'center', 800, W - b * 3);
      if (hintOn) button('hint', W - LY.safe - b, y, b, b, { icon: 'hint', round: true, act: toggleHint });
      var by0 = LY.botY, mw = Math.min(W - LY.safe * 2, 420), mx = (W - mw) / 2;
      inkMeter(mx, by0, mw, Math.round(b * 0.62));
      var ry = by0 + b * 0.62 + 12;
      button('undo', mx, ry + (g - b) / 2, b, b, { icon: 'undo', round: true, act: undo, disabled: !canEdit || !G.strokes.length });
      button('clear', mx + b + 12, ry + (g - b) / 2, b, b, { icon: 'clear', round: true, act: clearAll, disabled: !canEdit || !G.strokes.length });
      button('go', mx + mw - g, ry, g, g, goOpt);
    }
  }

  function showToast(s) { toast = { s: s, t: now }; }
  function banner(str, y, alpha, color) {
    ctx.font = font(Math.max(14, Math.min(20, F.s * 34)), 700);
    var tw = Math.min(ctx.measureText(str).width, F.w - 30), bw = tw + 30, bh = Math.max(32, F.s * 56);
    var x = F.x + F.w / 2 - bw / 2;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(248,242,231,0.94)'; rr(x, y, bw, bh, bh / 2); ctx.fill();
    ctx.strokeStyle = color || 'rgba(43,38,34,0.6)'; ctx.lineWidth = 1.5; rr(x, y, bw, bh, bh / 2); ctx.stroke();
    text(str, F.x + F.w / 2, y + bh / 2 + 1, Math.max(14, Math.min(20, F.s * 34)), PAL.ink, 'center', 700, F.w - 40);
    ctx.globalAlpha = 1;
    return bh;
  }
  function tutorialStep() {
    if (!G || overlay) return 0;
    if (G.idx === 0 && !(save.tut & 1) && !G.went) return G.strokes.length || drawing ? 2 : 1;
    if (G.idx === 1 && !(save.tut & 2) && G.phase === 'draw') return 3;
    return 0;
  }
  // animated hand drawing the first stroke (level 1)
  var handPt = { x: 0, y: 0 };
  function tutorialGhost() {
    if (tutorialStep() !== 1 || drawing) return;
    var cyc = (now - G.startT) % 3.2, prog = clamp((cyc - 0.4) / 1.6, 0, 1), alpha = cyc > 2.6 ? clamp(1 - (cyc - 2.6) / 0.5, 0, 1) : 1;
    drawGhost(prog, 0.28 * alpha);
    var p = G.hintPolys[0];
    if (!p) return;
    var n = p.length / 2, total = 0, i;
    for (i = 1; i < n; i++) total += Math.sqrt(Math.pow(p[i * 2] - p[i * 2 - 2], 2) + Math.pow(p[i * 2 + 1] - p[i * 2 - 1], 2));
    var target = total * prog, acc = 0;
    handPt.x = p[0]; handPt.y = p[1];
    for (i = 1; i < n; i++) {
      var sl = Math.sqrt(Math.pow(p[i * 2] - p[i * 2 - 2], 2) + Math.pow(p[i * 2 + 1] - p[i * 2 - 1], 2));
      if (acc + sl >= target) { var f = (target - acc) / (sl || 1); handPt.x = p[i * 2 - 2] + (p[i * 2] - p[i * 2 - 2]) * f; handPt.y = p[i * 2 - 1] + (p[i * 2 + 1] - p[i * 2 - 1]) * f; break; }
      acc += sl; handPt.x = p[i * 2]; handPt.y = p[i * 2 + 1];
    }
    ctx.globalAlpha = alpha;
    A.hand(ctx, wx(handPt.x), wy(handPt.y), Math.max(46, 80 * F.s), cyc > 0.3 && cyc < 2.1);
    ctx.globalAlpha = 1;
  }
  function drawTips() {
    var step = tutorialStep(), top = F.y + 12, pulse = 0.5 + 0.5 * Math.sin(now * 4);
    if (step === 1) banner(t('tutDraw'), top, 1);
    else if (step === 2 && !drawing) {
      banner(t('tutGo'), top, 1, PAL.vermilion);
      var gb = uiById('go');
      if (gb) {
        ctx.strokeStyle = 'rgba(217,69,43,' + (0.5 + 0.5 * pulse).toFixed(3) + ')'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(gb.x + gb.w / 2, gb.y + gb.w / 2, gb.w * 0.62 + pulse * 6, 0, 6.283); ctx.stroke();
      }
    } else if (step === 3) {
      banner(t('tutInk'), top, 1, PAL.vermilion);
      var m = LY.meter;
      if (m) {
        ctx.strokeStyle = 'rgba(217,69,43,' + (0.45 + 0.5 * pulse).toFixed(3) + ')'; ctx.lineWidth = 2.5;
        rr(m.x - 8, m.y - 6, m.w + 16, m.h + 12, 12); ctx.stroke();
      }
    } else if (G && G.L.tip && G.L.tip !== 'draw' && G.L.tip !== 'ink' && G.phase === 'draw' && !G.strokes.length && !drawing && now - G.startT < 7 && !overlay) {
      banner(t('tip_' + G.L.tip), top, clamp((7 - (now - G.startT)) / 0.6, 0, 1));
    }
    if (G && G.phase === 'fail' && !overlay) {
      banner(G.msg, F.y + F.h * 0.4, clamp(1.4 - (now - G.phaseT), 0, 1) * clamp((now - G.phaseT) / 0.15, 0, 1), PAL.vermilion);
    }
    if (toast && screen === 'game' && !overlay) banner(toast.s, F.y + F.h * 0.4 + 50, clamp((2.2 - (now - toast.t)) / 0.4, 0, 1));
  }

  // ------------------------------------------------------------------ overlays
  function dim() { ctx.fillStyle = 'rgba(243,235,221,0.72)'; ctx.fillRect(0, 0, W, H); }
  function drawDone() {
    dim();
    var cw = Math.min(W - 32, 400), chh = Math.min(H - 32, 330), x = (W - cw) / 2, y = (H - chh) / 2;
    var e = ease((now - overlayT) / 0.35);
    y += (1 - e) * 30; ctx.globalAlpha = e;
    card(x, y, cw, chh);
    text(t('cleared'), W / 2, y + chh * 0.15, Math.min(32, cw * 0.09), PAL.ink, 'center', 800, cw - 40);
    var ss = Math.min(64, cw * 0.17), gap = ss * 0.35, sx = W / 2 - ss - gap, sy = y + chh * 0.4;
    for (var i = 0; i < 3; i++) {
      var tt = now - overlayT - 0.45 - i * 0.3, on = i < G.stars;
      A.seal(ctx, sx + i * (ss + gap), sy, ss * 0.9, false, 0, 1);
      if (on && tt > 0) {
        if (G.stamped <= i) { G.stamped = i + 1; AU.stamp(i); burst(0, (sx + i * (ss + gap) - F.x) / F.s, (sy - F.y) / F.s, 6, 160, 0.9, 3); }
        var sc = 1 + 0.8 * (1 - ease(tt / 0.18));
        ctx.save(); ctx.translate(sx + i * (ss + gap), sy); ctx.scale(sc, sc);
        A.seal(ctx, 0, 0, ss, true, (i - 1) * 0.08, clamp(tt / 0.1, 0, 1));
        ctx.restore();
      }
    }
    text(t('ink') + ' ' + G.pct + '%', W / 2, y + chh * 0.6, Math.min(20, cw * 0.055), PAL.inkSoft, 'center', 700);
    var bh = Math.min(56, chh * 0.18), by = y + chh - bh - 22, small = bh, last = G.idx >= NLV - 1;
    var bw = cw - 44 - small * 2 - 20;
    button('dLevels', x + 22, by, small, bh, { icon: 'grid', round: true, act: goSelect });
    button('dReplay', x + 22 + small + 10, by, small, bh, { icon: 'retry', round: true, act: function () { startLevel(G.idx); } });
    button('dNext', x + 22 + (small + 10) * 2, by, bw, bh, { label: last ? t('levels') : t('next'), icon: last ? 'grid' : 'play', primary: true, act: nextLevel });
    ctx.globalAlpha = 1;
    drawParticlesScreen();
  }
  function drawParticlesScreen() { drawParticles(); }
  function nextLevel() {
    if (G.idx >= NLV - 1) { goSelect(); showToast(t('allDone')); return; }
    startLevel(G.idx + 1);
    AU.menuChord();
  }
  function openPause() { if (!G) return; endStroke(); overlay = 'pause'; overlayT = now; focusId = null; AU.ui(); }
  function closePause() { overlay = null; focusId = null; }
  function drawPauseMenu() {
    dim();
    var cw = Math.min(W - 32, 340), bh = 52, gap = 12, chh = 80 + (bh + gap) * 4, x = (W - cw) / 2, y = (H - chh) / 2;
    card(x, y, cw, chh);
    text(t('paused'), W / 2, y + 40, 26, PAL.ink, 'center', 800, cw - 40);
    var bx = x + 24, bw = cw - 48, yy = y + 74;
    button('pResume', bx, yy, bw, bh, { label: t('resume'), icon: 'play', primary: true, act: closePause }); yy += bh + gap;
    button('pRetry', bx, yy, bw, bh, { label: t('retry'), icon: 'retry', act: function () { closePause(); startLevel(G.idx); } }); yy += bh + gap;
    button('pLevels', bx, yy, bw, bh, { label: t('levels'), icon: 'grid', act: goSelect }); yy += bh + gap;
    button('pSound', bx, yy, bw, bh, { label: t('sound'), icon: save.snd ? 'sound' : 'soundOff', act: toggleSound });
  }
  function goSelect() {
    endStroke();
    if (G) selChapter = Math.floor(G.idx / PER);
    AU.stopRoll();
    G = null; overlay = null; screen = 'select'; focusId = null; levelCanvas = null;
    persist();
  }

  // ------------------------------------------------------------------ title
  var titleMarble = { a: 0 };
  function drawTitle() {
    ctx.drawImage(bgCanvas, 0, 0, W, H);
    var ts = titleCanvas.s, land = W > H * 1.1;
    var tx = land ? W * 0.36 - ts / 2 : W / 2 - ts / 2, ty = land ? H / 2 - ts / 2 - 10 : H * 0.36 - ts / 2;
    ctx.drawImage(titleCanvas.c, tx, ty, ts, ts);
    // a marble rolling inside the ensō
    var cx = tx + ts / 2, cy = ty + ts / 2, rad = ts * 0.33;
    var ang = Math.PI / 2 + Math.sin(now * 1.1) * 0.55;
    var mr = ts * 0.04, sp = titleSprite(mr);
    A.drawMarble(ctx, sp, cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, -Math.sin(now * 1.1) * 0.55 * rad / mr, 1);
    var bx, by, bw = Math.min(land ? 300 : 260, W * 0.62), bh = land ? 64 : 58;
    if (land) { bx = Math.min(W * 0.72, tx + ts + 40 + bw / 2) - bw / 2; by = H / 2 - 30; }
    else { bx = W / 2 - bw / 2; by = ty + ts + Math.min(70, H * 0.08); }
    text(t('tagline'), bx + bw / 2, by - 36, Math.min(land ? 24 : 20, W * 0.05), PAL.inkSoft, 'center', 600, land ? bw + 80 : W - 40);
    button('play', bx, by, bw, bh, { label: t('play'), icon: 'play', primary: true, act: onPlay, size: 22 });
    var sy = by + bh + 20, s = 52;
    button('tSound', bx + bw / 2 - s - 8, sy, s, s, { icon: save.snd ? 'sound' : 'soundOff', round: true, act: toggleSound });
    button('tLevels', bx + bw / 2 + 8, sy, s, s, { icon: 'grid', round: true, act: function () { screen = 'select'; focusId = null; AU.ui(); } });
    var tot = totalStars();
    if (tot > 0) {
      A.seal(ctx, bx + bw / 2 - 30, sy + s + 34, 24, true, -0.05);
      text(tot + ' / ' + NLV * 3, bx + bw / 2 - 12, sy + s + 35, 18, PAL.ink, 'left', 700);
    }
  }
  var titleSpr = null;
  function titleSprite(r) {
    if (!titleSpr || Math.abs(titleSpr.r - r) > 0.5) titleSpr = A.marbleSprites(r, DPR, 0);
    return titleSpr;
  }
  function onPlay() {
    AU.menuChord();
    var target = save.last;
    if (!unlocked(target)) target = 0;
    if (totalStars() === 0) { startLevel(0); return; }
    selChapter = Math.floor(target / PER);
    screen = 'select'; focusId = 'lv' + target;
  }

  // ------------------------------------------------------------------ level select
  function drawSelect() {
    ctx.drawImage(bgCanvas, 0, 0, W, H);
    var safe = 14, hb = 50;
    button('back', safe, safe, hb, hb, { icon: 'left', round: true, act: function () { screen = 'title'; focusId = null; AU.back(); } });
    var tot = totalStars();
    A.seal(ctx, W - safe - 96, safe + hb / 2, 26, true, -0.05);
    text(tot + '/' + NLV * 3, W - safe - 78, safe + hb / 2 + 1, 18, PAL.ink, 'left', 800);
    // chapter header
    var k = selChapter, hy = safe + hb + 34;
    var aw = 48;
    button('chPrev', W / 2 - 130 - aw / 2, hy - aw / 2, aw, aw, { icon: 'left', round: true, disabled: k === 0, act: function () { selChapter = Math.max(0, selChapter - 1); AU.ui(); } });
    button('chNext', W / 2 + 130 - aw / 2, hy - aw / 2, aw, aw, { icon: 'right', round: true, disabled: k === NCH - 1, act: function () { selChapter = Math.min(NCH - 1, selChapter + 1); AU.ui(); } });
    text(t('chapters')[k], W / 2, hy - 6, 28, PAL.ink, 'center', 800, 190);
    var cs = 0; for (var q = k * PER; q < (k + 1) * PER; q++) cs += save.stars[q];
    text(cs + ' / ' + PER * 3, W / 2, hy + 20, 14, PAL.inkSoft, 'center', 700);
    // grid of level tiles
    var land = W > H;
    var cols = land ? 6 : 3, rows = land ? 2 : 4;
    var top = hy + 50, availH = H - top - safe - 10, availW = Math.min(W - safe * 2, land ? 900 : 480);
    var gap = 14, tile = Math.floor(Math.min((availW - gap * (cols - 1)) / cols, (availH - gap * (rows - 1)) / rows));
    var gx = (W - (tile * cols + gap * (cols - 1))) / 2, gy = top + Math.max(0, (availH - (tile * rows + gap * (rows - 1))) / 2);
    for (var i = 0; i < PER; i++) {
      var idx = k * PER + i, c = i % cols, r = Math.floor(i / cols);
      levelTile(idx, gx + c * (tile + gap), gy + r * (tile + gap), tile);
    }
    if (toast) {
      ctx.font = font(18, 700);
      var tw = ctx.measureText(toast.s).width + 40;
      ctx.globalAlpha = clamp((2.2 - (now - toast.t)) / 0.4, 0, 1);
      ctx.fillStyle = PAL.paperLight; rr(W / 2 - tw / 2, H - 70, tw, 44, 22); ctx.fill();
      ctx.strokeStyle = PAL.vermilion; ctx.lineWidth = 1.5; rr(W / 2 - tw / 2, H - 70, tw, 44, 22); ctx.stroke();
      text(toast.s, W / 2, H - 48, 18, PAL.ink, 'center', 700, W - 40);
      ctx.globalAlpha = 1;
    }
  }
  function levelTile(idx, x, y, s) {
    var open = unlocked(idx), st = save.stars[idx], id = 'lv' + idx, down = pressed === id;
    var yy = down ? y + 2 : y;
    ctx.fillStyle = 'rgba(43,38,34,0.14)'; rr(x + 2, y + 5, s, s, 12); ctx.fill();
    ctx.fillStyle = open ? (down ? PAL.paperDark : PAL.paperLight) : 'rgba(228,215,193,0.8)';
    rr(x, yy, s, s, 12); ctx.fill();
    ctx.strokeStyle = open ? 'rgba(43,38,34,0.8)' : 'rgba(43,38,34,0.3)'; ctx.lineWidth = 2; rr(x, yy, s, s, 12); ctx.stroke();
    if (open) {
      text(String(idx % PER + 1), x + s / 2, yy + s * 0.4, s * 0.34, PAL.ink, 'center', 800);
      var ss = s * 0.2;
      for (var i = 0; i < 3; i++) A.seal(ctx, x + s / 2 + (i - 1) * (ss + 3), yy + s * 0.76, ss, i < st, (i - 1) * 0.06, i < st ? 1 : 0.7);
      if (!st && (idx === 0 || cleared(idx - 1))) { ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(x + s - 12, yy + 12, 4.5, 0, 6.283); ctx.fill(); }
    } else {
      A.icon(ctx, 'lock', x + s / 2, yy + s / 2, s * 0.3, 'rgba(43,38,34,0.4)');
    }
    if (focusId === id && keyboardMode) { ctx.strokeStyle = PAL.gold; ctx.lineWidth = 3; rr(x - 5, yy - 5, s + 10, s + 10, 16); ctx.stroke(); }
    ui.push({ id: id, x: x, y: y, w: s, h: s + 4, act: open ? function () { startLevel(idx); AU.menuChord(); } : function () { showToast(t('locked')); AU.nope(); } });
  }

  // ------------------------------------------------------------------ render + loop
  function drawSdkPaused() {
    ctx.fillStyle = 'rgba(243,235,221,0.6)'; ctx.fillRect(0, 0, W, H);
    A.icon(ctx, 'pause', W / 2, H / 2, 60, PAL.ink);
  }
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ui.length = 0;
    if (screen === 'title') drawTitle();
    else if (screen === 'select') drawSelect();
    else if (screen === 'game' && G) { ctx.drawImage(bgCanvas, 0, 0, W, H); drawGame(); }
    if (paused) drawSdkPaused();
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
  function inField(p) { return p.x >= F.x - 10 && p.x <= F.x + F.w + 10 && p.y >= F.y - 10 && p.y <= F.y + F.h + 10; }
  function onDown(e) {
    AU.ensure(); syncAudio();
    if (!ready || paused) return;
    if (e.pointerType !== 'mouse' || e.button === 0) keyboardMode = false;
    if (e.button && e.button !== 0) return;
    var p = toLocal(e);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    var b = hitUI(p.x, p.y);
    if (b) { pressed = b.id; return; }
    if (screen === 'game' && G && !overlay && !drawing && G.phase !== 'won' && G.phase !== 'dry' && inField(p)) beginStroke(p.x, p.y, e.pointerId);
  }
  function onMove(e) {
    if (!drawing || drawing.id !== e.pointerId) return;
    var p = toLocal(e);
    moveStroke(p.x, p.y);
  }
  function onUp(e) {
    if (drawing && drawing.id === e.pointerId) { var p = toLocal(e); moveStroke(p.x, p.y); endStroke(); return; }
    var q = toLocal(e), b = hitUI(q.x, q.y);
    if (pressed && b && b.id === pressed && b.act) { if (b.id.indexOf('lv') !== 0 && b.id !== 'play') AU.ui(); b.act(); }
    pressed = null;
  }
  function onCancel() { pressed = null; if (drawing) endStroke(); }

  function onKey(e) {
    if (!ready) return;
    AU.ensure(); syncAudio();
    var k = e.key, handled = true;
    if (paused) return;
    if (k === 'm' || k === 'M') toggleSound();
    else if (screen === 'game' && G && !overlay) {
      if (k === 'Enter' || k === ' ') go();
      else if (k === 'z' || k === 'Z' || k === 'Backspace') undo();
      else if (k === 'r' || k === 'R') retry();
      else if (k === 'c' || k === 'C') clearAll();
      else if (k === 'h' || k === 'H') toggleHint();
      else if (k === 'Escape' || k === 'p' || k === 'P') openPause();
      else handled = false;
    } else if (screen === 'game' && overlay === 'pause' && (k === 'Escape' || k === 'p' || k === 'P')) closePause();
    else if (screen === 'game' && overlay === 'done' && (k === 'r' || k === 'R')) startLevel(G.idx);
    else handled = menuKey(k);
    if (handled) e.preventDefault();
  }
  function menuKey(k) {
    if (k === 'Escape') {
      keyboardMode = true;
      if (screen === 'select') { screen = 'title'; focusId = null; return true; }
      if (screen === 'game' && overlay === 'done') { goSelect(); return true; }
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
      else if (screen === 'select' && d[1] === 0) {
        var nk = clamp(selChapter + d[0], 0, NCH - 1);
        if (nk !== selChapter) { selChapter = nk; focusId = null; AU.ui(); }
      }
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
    var first = selChapter * PER;
    for (var i = selChapter * PER; i < (selChapter + 1) * PER; i++) if (unlocked(i) && !cleared(i)) { first = i; break; }
    var pref = ['play', 'dNext', 'pResume', 'lv' + first];
    for (var j = 0; j < pref.length; j++) if (usable.some(function (b) { return b.id === pref[j]; })) return pref[j];
    return usable[0].id;
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
    if (drawing) endStroke();
    pressed = null;
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
  window.__inkDebug = {
    info: function () {
      return { screen: screen, overlay: overlay, ready: ready, level: G ? G.idx : -1, phase: G ? G.phase : '', strokes: G ? G.strokes.length : 0,
        used: G ? Math.round(G.used) : 0, fails: G ? G.fails : 0, stars: G ? G.stars : 0, total: totalStars(), lang: lang, paused: paused, tut: save.tut, land: !!LY.land };
    },
    toScreen: function (x, y) { return { x: wx(x), y: wy(y) }; },
    button: function (id) { var b = uiById(id); return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : null; },
    solution: function (i) { return LEVELS[i].sol; },
    field: function () { return { x: F.x, y: F.y, s: F.s, w: F.w, h: F.h }; },
    start: function (i) { startLevel(i); },
    showHint: function () { if (G) G.hint = true; }
  };

  // 1) draw the title synchronously, 2) firstFrameReady, 3) load save + language, 4) gameReady.
  resize();
  PlayablesSDK.firstFrameReady();
  startLoop();
  Promise.all([PlayablesSDK.load(), PlayablesSDK.getLanguage()]).then(function (res) {
    applySave(res[0]);
    lang = I18N.pick(res[1]);
    selChapter = Math.floor(save.last / PER);
    ready = true;
    render();
    PlayablesSDK.gameReady();
  }, function () {
    ready = true;
    PlayablesSDK.gameReady();
  });
})();
