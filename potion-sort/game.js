/*
 * game.js: Potion Sort, a candlelit liquid-sorting puzzle for YouTube Playables.
 * Vanilla JS + Canvas 2D. Rules, levels and the solver live in levels.js, drawing helpers in
 * art.js, sound in audio.js and strings in i18n.js.
 */
(function () {
  'use strict';

  var PlayablesSDK = window.PlayablesSDK;
  var PS = window.PS, A = PS.Art, C = A.C, AU = PS.Audio, LIQ = A.LIQ, GEO = A.G;
  PlayablesSDK.init({ storageKey: 'potion-sort_save' });

  var NLV = PS.NLV, PER = PS.PER, CAP = PS.CAP, SHELVES = PS.SHELVES;
  var MAX_ADD = 3, START_ADD = 2, ADD_EVERY = 3;
  var T_MOVE = 0.24, T_BACK = 0.24;
  var TIPS = { 1: 'tipRule', 24: 'tipSpare', 36: 'tipHidden', 48: 'tipCork', 60: 'tipMix' };

  // ------------------------------------------------------------------ i18n
  var lang = 'en';
  function pickLang(tag) { var k = String(tag || 'en').slice(0, 2).toLowerCase(); return PS.STR[k] ? k : 'en'; }
  function t(key, n) {
    var v = PS.STR[lang][key];
    if (v === undefined) v = PS.STR.en[key];
    return n === undefined ? v : String(v).replace('{n}', n);
  }
  lang = pickLang(navigator.language);

  // ------------------------------------------------------------------ canvas + state
  var cv = document.getElementById('game');
  var ctx = cv.getContext('2d');
  var W = 1, H = 1, DPR = 1, U = 1;
  var now = 0, lastT = 0, rafId = 0, paused = false, ready = false;
  var screen = 'title';
  var selShelf = 0;
  var G = null;             // current level
  var LY = null;            // game layout
  var ui = [];              // buttons registered by the last frame
  var pressed = null, focusId = null, keyboardMode = false;
  var particles = [];
  var toast = null;
  var bgCanvas = null;
  var sdkAudio = PlayablesSDK.isAudioEnabled();
  var dust = [];
  for (var di = 0; di < 26; di++) dust.push({ x: Math.random(), y: Math.random(), p: Math.random() * 6.28, s: 0.4 + Math.random() * 0.8, r: 0.5 + Math.random() });

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(x) { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function easeOut(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
  function easeBack(x) { x = clamp(x, 0, 1); var c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }

  // ------------------------------------------------------------------ save
  function defaultSave() {
    var lv = [];
    for (var i = 0; i < NLV; i++) lv.push([0, 0]);
    return { v: 1, lv: lv, add: START_ADD, ap: 0, snd: 1, mus: 1, tut: 0, last: 0 };
  }
  var save = defaultSave();
  function clampInt(v, a, b) { v = Math.floor(Number(v) || 0); return v < a ? a : v > b ? b : v; }
  function applySave(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o.lv)) {
      for (var i = 0; i < NLV; i++) {
        var r = o.lv[i];
        if (Array.isArray(r)) save.lv[i] = [clampInt(r[0], 0, 3), clampInt(r[1], 0, 9999)];
      }
    }
    save.add = o.add === undefined ? START_ADD : clampInt(o.add, 0, MAX_ADD);
    save.ap = clampInt(o.ap, 0, ADD_EVERY - 1);
    save.snd = o.snd === 0 ? 0 : 1;
    save.mus = o.mus === 0 ? 0 : 1;
    save.tut = o.tut ? 1 : 0;
    save.last = clampInt(o.last, 0, NLV - 1);
  }
  function persist() { PlayablesSDK.save(save); }
  function totalStars() { var s = 0; for (var i = 0; i < NLV; i++) s += save.lv[i][0]; return s; }
  function shelfStars(k) { var s = 0; for (var i = k * PER; i < (k + 1) * PER; i++) s += save.lv[i][0]; return s; }
  function cleared(i) { return i >= 0 && i < NLV && save.lv[i][0] > 0; }
  function unlocked(i) { return i === 0 || cleared(i - 1) || (i >= 2 && cleared(i - 2)); }
  function nextLevel() {
    for (var i = 0; i < NLV; i++) if (!cleared(i) && unlocked(i)) return i;
    return clamp(save.last, 0, NLV - 1);
  }

  // ------------------------------------------------------------------ audio
  function syncAudio() {
    AU.setEnabled(sdkAudio && save.snd && !paused);
    AU.setMusic(!!save.mus);
  }
  function toggleSound() { save.snd = save.snd ? 0 : 1; AU.unlock(); syncAudio(); persist(); AU.ui(); }
  function toggleMusic() { save.mus = save.mus ? 0 : 1; AU.unlock(); syncAudio(); persist(); AU.ui(); }

  // ------------------------------------------------------------------ level state
  function startLevel(i) {
    var L = PS.level(i);
    var fl = [], uid = [], hid = [], u = 0;
    for (var f = 0; f < L.flasks.length; f++) {
      fl.push(L.flasks[f].slice());
      var us = [];
      for (var k = 0; k < L.flasks[f].length; k++) { us.push(u); hid[u] = !!L.hidden[f][k]; u++; }
      uid.push(us);
    }
    G = {
      idx: i, L: L, par: L.par, fl: fl, uid: uid, hid: hid, rev: [], cork: L.cork ? { f: L.cork.f, n: L.cork.n } : null,
      moves: 0, hist: [], sel: -1, extra: false, won: false, winT: 0, clear: null, anims: [], doneT: [], lift: [], shakeT: [],
      sealPopT: -1, stuck: 0, check: false, focus: 0, menu: false, guide: null, guideKey: '', tip: TIPS[i] || null, startT: now,
      starShown: 0
    };
    for (f = 0; f < fl.length; f++) { G.lift.push(0); G.shakeT.push(-9); G.doneT.push(0); }
    revealTops();
    save.last = i;
    toast = null;
    selShelf = Math.floor(i / PER);
    screen = 'game';
    focusId = null;
    layoutGame();
  }
  function isHid(u) { return G.hid[u] && !G.rev[u]; }
  function sealed(f) { return !!(G.cork && f === G.cork.f && G.moves < G.cork.n); }
  function canPick(f) { var a = G.fl[f]; return a.length > 0 && !PS.isDone(a) && !sealed(f); }
  function amountTo(s, d) { if (s === d || sealed(d) || sealed(s)) return 0; return PS.pourAmount(G.fl[s], G.fl[d]); }
  function busy(f) { for (var i = 0; i < G.anims.length; i++) if (G.anims[i].s === f || G.anims[i].d === f) return G.anims[i]; return null; }
  function snapshot() {
    return { fl: G.fl.map(function (a) { return a.slice(); }), uid: G.uid.map(function (a) { return a.slice(); }), moves: G.moves };
  }
  function anyMove() {
    for (var s = 0; s < G.fl.length; s++) {
      if (!canPick(s)) continue;
      for (var d = 0; d < G.fl.length; d++) if (amountTo(s, d)) return true;
    }
    return false;
  }

  function tapFlask(f) {
    if (!G || G.won || G.menu) return;
    var b = busy(f);
    if (b) finishAnim(b);
    if (G.sel < 0) {
      if (canPick(f)) { G.sel = f; AU.select(); }
      else { nope(f); }
      return;
    }
    if (G.sel === f) { G.sel = -1; AU.deselect(); return; }
    var s = G.sel;
    var bs = busy(s);
    if (bs) finishAnim(bs);
    if (amountTo(s, f)) { pour(s, f); return; }
    nope(f);
    G.sel = canPick(f) ? f : -1;
    if (G.sel >= 0) AU.select();
  }
  function nope(f) { G.shakeT[f] = now; AU.nope(); }

  function pour(s, d) {
    var amt = amountTo(s, d);
    if (!amt) return;
    G.hist.push(snapshot());
    var a = G.fl[s], au = G.uid[s], b = G.fl[d], bu = G.uid[d];
    var anim = { s: s, d: d, c: a[a.length - 1], n: amt, preS: a.slice(), preSU: au.slice(), preD: b.slice(), preDU: bu.slice(), t0: now, snd: false };
    anim.dur = 0.2 + 0.11 * amt;
    for (var k = 0; k < amt; k++) { var u = au[au.length - amt + k]; G.rev[u] = true; }
    G.fl[d] = b.concat(a.slice(a.length - amt));
    G.uid[d] = bu.concat(au.slice(au.length - amt));
    G.fl[s] = a.slice(0, a.length - amt);
    G.uid[s] = au.slice(0, au.length - amt);
    G.moves++;
    G.sel = -1;
    G.stuck = 0;
    planPour(anim);
    G.anims.push(anim);
    if (G.cork && G.moves === G.cork.n) { G.sealPopT = now; AU.unseal(); var p = LY.pos[G.cork.f]; burst(p.x, p.y - GEO.FH * LY.w, 10, C.seal); }
    if (PS.solved(G.fl)) { G.won = true; for (var hu = 0; hu < G.hid.length; hu++) G.rev[hu] = true; }
    else G.check = true;
  }

  // Works out where the source flask goes and how far it tilts.
  function planPour(an) {
    var w = LY.w, ps = LY.pos[an.s], pd = LY.pos[an.d];
    var fill = an.preS.length;
    var ang = (52 + (CAP - fill) * 9) * Math.PI / 180;
    var side = ps.x <= pd.x ? 1 : -1;
    for (var tries = 0; tries < 2; tries++) {
      var a = ang * side, ca = Math.cos(a), sa = Math.sin(a);
      var px = side * w * 0.5, py = -GEO.FH * w;
      var mx = pd.x - side * w * 0.12, my = pd.y - GEO.FH * w - w * 0.75;
      var x = mx - (px * ca - py * sa), y = my - (px * sa + py * ca);
      an.ang = a; an.px = x; an.py = y; an.mx = mx; an.my = my; an.side = side;
      if (x > w * 0.6 && x < W - w * 0.6) break;
      side = -side;
    }
  }
  function finishAnim(an) {
    var i = G.anims.indexOf(an);
    if (i < 0) return;
    G.anims.splice(i, 1);
    settle(an);
  }
  function settle(an) {
    // uncover the new top run of the source
    if (revealTops()) {
      AU.reveal();
      var p = LY.pos[an.s];
      burst(p.x, p.y - (GEO.BASE + G.fl[an.s].length * GEO.LH) * LY.w + LY.w * 0.3, 6, '#B8B2D8');
    }
    AU.land();
    markDone();
  }
  // Hidden layers in the same-color run at the top of a flask move with it, so they are shown.
  function revealTops() {
    var any = false;
    for (var f = 0; f < G.fl.length; f++) {
      var a = G.fl[f], u = G.uid[f];
      if (busy(f)) continue;
      for (var k = a.length - 1; k >= 0 && a[k] === a[a.length - 1]; k--) {
        if (isHid(u[k])) { G.rev[u[k]] = true; any = true; }
      }
    }
    return any;
  }
  function markDone() {
    for (var f = 0; f < G.fl.length; f++) {
      var done = PS.isDone(G.fl[f]);
      if (done && !G.doneT[f] && !busy(f)) {
        G.doneT[f] = now;
        AU.cork(0.12);
        AU.sparkle(0.2);
        var p = LY.pos[f];
        burst(p.x, p.y - GEO.FH * LY.w, 14, LIQ[G.fl[f][0]].hi);
      } else if (!done && G.doneT[f]) G.doneT[f] = 0;
    }
  }

  function undo() {
    if (!G || G.won || !G.hist.length) { if (G && !G.won) AU.nope(); return; }
    while (G.anims.length) finishAnim(G.anims[0]);
    var sn = G.hist.pop();
    G.fl = sn.fl; G.uid = sn.uid; G.moves = sn.moves;
    G.sel = -1; G.stuck = 0; G.check = true;
    if (G.cork && G.moves < G.cork.n) G.sealPopT = -1;
    revealTops();
    markDone();
    AU.undo();
  }
  function restart() {
    if (!G) return;
    while (G.anims.length) finishAnim(G.anims[0]);
    if (G.hist.length) {
      var sn = G.hist[0];
      G.fl = sn.fl; G.uid = sn.uid; G.moves = 0;
      G.hist = [];
    }
    G.won = false; G.clear = null; G.winT = 0; G.sel = -1; G.stuck = 0; G.check = false; G.menu = false;
    G.sealPopT = -1; G.starShown = 0;
    for (var f = 0; f < G.fl.length; f++) G.doneT[f] = 0;
    markDone();
    AU.undo();
  }
  function addFlask() {
    if (!G || G.won) return;
    if (G.extra) { showToast(t('addUsed')); AU.nope(); return; }
    if (save.add <= 0) { showToast(t('addNone')); AU.nope(); return; }
    save.add--;
    G.extra = true;
    G.fl.push([]); G.uid.push([]);
    for (var i = 0; i < G.hist.length; i++) { G.hist[i].fl.push([]); G.hist[i].uid.push([]); }
    G.lift.push(0); G.shakeT.push(-9); G.doneT.push(0);
    G.stuck = 0;
    layoutGame();
    var p = LY.pos[G.fl.length - 1];
    burst(p.x, p.y - LY.w * 1.5, 12, C.brassHi);
    showToast(t('addCap'));
    AU.add();
    persist();
  }

  function finishLevel() {
    var i = G.idx, stars = PS.starsFor(G.moves, G.par);
    if (G.extra) stars = Math.min(stars, 2);
    var rec = save.lv[i], first = rec[0] === 0, before = totalStars();
    var newBest = rec[1] > 0 && G.moves < rec[1];
    rec[0] = Math.max(rec[0], stars);
    rec[1] = rec[1] ? Math.min(rec[1], G.moves) : G.moves;
    var refill = false;
    if (first) {
      save.ap++;
      if (save.ap >= ADD_EVERY) { save.ap = 0; if (save.add < MAX_ADD) { save.add++; refill = true; } }
    }
    if (i === 0) save.tut = 1;
    if (i + 1 < NLV) save.last = i + 1;
    var after = totalStars();
    if (after > before) PlayablesSDK.sendScore(after);
    persist();
    AU.win();
    G.clear = { stars: stars, t: now, newBest: newBest, refill: refill, last: i === NLV - 1 };
    G.starShown = 0;
    focusId = null;
    for (var f = 0; f < G.fl.length; f++) {
      var p = LY.pos[f];
      if (G.fl[f].length) burst(p.x, p.y - GEO.FH * LY.w * 0.6, 8, LIQ[G.fl[f][0]].hi);
    }
  }
  function goNext() {
    if (!G) return;
    if (G.idx + 1 < NLV) startLevel(G.idx + 1);
    else goSelect();
  }
  function goSelect() {
    if (G) selShelf = Math.floor(G.idx / PER);
    screen = 'select'; G = null; focusId = null;
    persist();
  }

  // Next optimal pour from the current position (used by the tutorial hand).
  function guideMove() {
    var key = G.sel + ':' + G.fl.map(function (a) { return a.join(''); }).join('|');
    if (key === G.guideKey) return G.guide;
    G.guideKey = key;
    var opt = { limit: 5000, cork: G.cork ? G.cork.f : -1, corkLeft: G.cork ? Math.max(0, G.cork.n - G.moves) : 0 };
    var r = PS.solve(G.fl, opt);
    G.guide = r.path && r.path.length ? r.path[0] : null;
    // prefer an equally good pour from the flask the player already holds
    if (G.guide && G.sel >= 0 && G.guide[0] !== G.sel) {
      for (var d = 0; d < G.fl.length; d++) {
        var amt = amountTo(G.sel, d);
        if (!amt) continue;
        var fl = G.fl.map(function (a) { return a.slice(); });
        fl[d] = fl[d].concat(fl[G.sel].splice(fl[G.sel].length - amt, amt));
        var r2 = PS.solve(fl, opt);
        if (r2.par >= 0 && r2.par + 1 === r.par) { G.guide = [G.sel, d]; break; }
      }
    }
    return G.guide;
  }
  function deadEndCheck() {
    G.check = false;
    if (G.won) return;
    if (!anyMove()) { G.stuck = 1; return; }
    var r = PS.solve(G.fl, { limit: 25000, cork: G.cork ? G.cork.f : -1, corkLeft: G.cork ? Math.max(0, G.cork.n - G.moves) : 0 });
    G.stuck = r.par < 0 && !r.gaveUp ? 2 : 0;
  }

  // ------------------------------------------------------------------ layout
  function layoutGame() {
    if (!G) return;
    var n = G.fl.length;
    var m = Math.max(16, U * 2.5);
    var hudH = clamp(U * 15, 66, 96);
    var msgH = clamp(U * 7, 28, 42);
    var toolH = clamp(U * 15, 64, 92);
    var ax = m, ay = m + hudH + msgH, aw = W - 2 * m, ah = H - ay - toolH - m;
    var best = null;
    for (var r = 1; r <= 4; r++) {
      var per = Math.ceil(n / r);
      if (r > 1 && Math.ceil(n / (r - 1)) === per) continue;
      var w = Math.min(aw / (per * 1.5), ah / (r * 4.75), clamp(U * 16, 40, 110));
      if (!best || w > best.w * 1.03) best = { r: r, per: per, w: w };
    }
    var R = best.r, wv = best.w;
    var rowH = wv * 4.75, gap = Math.min(wv * 0.6, (ah - R * rowH) / Math.max(1, R));
    var total = R * rowH + (R - 1) * gap;
    var y0 = ay + (ah - total) / 2;
    var counts = [], base = Math.floor(n / R), extra = n % R, idx = 0;
    for (r = 0; r < R; r++) counts.push(base + (r < extra ? 1 : 0));
    var pos = [], planks = [];
    var cell = Math.min(aw / best.per, wv * 2.1);
    for (r = 0; r < R; r++) {
      var cnt = counts[r], rw = cnt * cell, x0 = W / 2 - rw / 2;
      var by = y0 + r * (rowH + gap) + wv * (GEO.FH + 0.25 + 0.55);
      planks.push({ x0: Math.max(m * 0.5, x0 - wv * 0.35), x1: Math.min(W - m * 0.5, x0 + rw + wv * 0.35), y: by, th: wv * 0.24 });
      for (var k = 0; k < cnt; k++) {
        var x = x0 + cell * (k + 0.5);
        pos.push({ x: x, y: by, row: r, hx: x - cell / 2, hy: by - wv * (GEO.FH + 0.9), hw: cell, hh: wv * (GEO.FH + 1.25) });
        idx++;
      }
    }
    LY = { w: wv, pos: pos, planks: planks, m: m, hudH: hudH, msgY: m + hudH + msgH / 2, msgH: msgH, toolH: toolH, ax: ax, ay: ay, aw: aw, ah: ah, rows: R };
  }

  // ------------------------------------------------------------------ particles
  function burst(x, y, n, col) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = (0.4 + Math.random()) * U * 9;
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - U * 6, life: 0, max: 0.6 + Math.random() * 0.5, r: U * (0.8 + Math.random() * 1.1), col: col, k: 'tw' });
    }
  }
  function drip(x, y, col) {
    particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * U * 8, vy: -U * (4 + Math.random() * 6), life: 0, max: 0.35, r: U * (0.35 + Math.random() * 0.4), col: col, k: 'drop' });
  }
  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life += dt;
      if (p.life >= p.max) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += U * (p.k === 'drop' ? 60 : 14) * dt;
      p.vx *= 0.97;
    }
  }
  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i], a = 1 - p.life / p.max;
      if (p.k === 'drop') {
        ctx.globalAlpha = a; ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else A.twinkle(ctx, p.x, p.y, p.r * (0.6 + a * 0.8), a, p.col);
    }
  }
  function drawDust() {
    for (var i = 0; i < dust.length; i++) {
      var d = dust[i];
      var x = ((d.x + Math.sin(now * 0.05 * d.s + d.p) * 0.04) % 1) * W;
      var y = (1 - ((d.y + now * 0.008 * d.s) % 1)) * H;
      ctx.fillStyle = 'rgba(255,214,150,' + (0.12 + 0.1 * Math.sin(now * 0.8 * d.s + d.p)) + ')';
      ctx.beginPath(); ctx.arc(x, y, d.r * Math.max(1, U * 0.3), 0, Math.PI * 2); ctx.fill();
    }
  }
  function showToast(s) { toast = { s: s, t: now }; }

  // ------------------------------------------------------------------ update
  function update(dt) {
    updateParticles(dt);
    AU.update(dt);
    if (screen !== 'game' || !G) return;
    var i, an;
    for (i = 0; i < G.fl.length; i++) {
      var target = i === G.sel ? LY.w * 0.42 : 0;
      G.lift[i] += (target - G.lift[i]) * Math.min(1, dt * 16);
    }
    for (i = G.anims.length - 1; i >= 0; i--) {
      an = G.anims[i];
      var e = now - an.t0;
      if (!an.snd && e >= T_MOVE) {
        an.snd = true;
        AU.pour(an.n, an.dur, an.preD.length / CAP, (an.preD.length + an.n) / CAP);
      }
      if (e >= T_MOVE && e < T_MOVE + an.dur && Math.random() < dt * 14) {
        var pd = LY.pos[an.d], fillNow = an.preD.length + an.n * clamp((e - T_MOVE) / an.dur, 0, 1);
        drip(pd.x, pd.y - (GEO.BASE + fillNow * GEO.LH) * LY.w, LIQ[an.c].hi);
      }
      if (e >= T_MOVE + an.dur + T_BACK) { G.anims.splice(i, 1); settle(an); }
    }
    if (G.check && !G.anims.length) deadEndCheck();
    if (G.won && !G.clear && !G.anims.length) {
      if (!G.winT) G.winT = now;
      if (now - G.winT > 0.75) finishLevel();
    }
    if (G.clear && G.starShown < G.clear.stars) {
      var due = 0.55 + G.starShown * 0.32;
      if (now - G.clear.t >= due) { AU.star(G.starShown); G.starShown++; }
    }
  }

  // ------------------------------------------------------------------ buttons
  function button(id, x, y, w, h, opt) {
    opt = opt || {};
    var down = pressed === id;
    var depth = Math.max(3, h * 0.08);
    var r = opt.r !== undefined ? opt.r : Math.min(h * 0.3, 18);
    var yy = down ? y + depth * 0.6 : y;
    var style = opt.style || 'dark';
    var fill, shade, col;
    if (style === 'brass') { fill = C.brass; shade = C.brassDeep; col = C.ink; }
    else if (style === 'parch') { fill = C.parchment; shade = C.parchDeep; col = C.ink; }
    else { fill = '#1F4238'; shade = '#0B1C17'; col = C.parchment; }
    if (opt.disabled) { col = style === 'dark' ? 'rgba(242,230,201,0.35)' : 'rgba(43,33,22,0.4)'; }
    if (!down) { ctx.fillStyle = shade; A.rr(ctx, x, y + depth, w, h, r); ctx.fill(); }
    ctx.fillStyle = fill; A.rr(ctx, x, yy, w, h, r); ctx.fill();
    if (style === 'brass') {
      ctx.fillStyle = 'rgba(255,240,200,0.35)'; A.rr(ctx, x + 3, yy + 2, w - 6, h * 0.38, r * 0.8); ctx.fill();
    }
    ctx.strokeStyle = style === 'dark' ? 'rgba(212,168,75,0.75)' : 'rgba(43,33,22,0.25)';
    ctx.lineWidth = style === 'dark' ? 2 : 1.5;
    A.rr(ctx, x + 1, yy + 1, w - 2, h - 2, r); ctx.stroke();
    if (focusId === id && keyboardMode) {
      ctx.strokeStyle = C.brassHi; ctx.lineWidth = 3;
      A.rr(ctx, x - 4, yy - 4, w + 8, h + 8, r + 4); ctx.stroke();
    }
    if (opt.icon && opt.label) {
      var is = h * 0.42;
      ctx.font = A.font(opt.size || h * 0.36, 800);
      var tw = Math.min(ctx.measureText(opt.label).width, w - is - h * 0.7);
      var x0 = x + w / 2 - (is + h * 0.2 + tw) / 2;
      A.icon(ctx, opt.icon, x0 + is / 2, yy + h / 2, is, col);
      A.text(ctx, opt.label, x0 + is + h * 0.2, yy + h / 2 + 1, opt.size || h * 0.36, col, 'left', 800, w - is - h * 0.7);
    } else if (opt.icon) {
      A.icon(ctx, opt.icon, x + w / 2, yy + h / 2, opt.iconSize || h * 0.48, col);
    } else if (opt.label) {
      A.text(ctx, opt.label, x + w / 2, yy + h / 2 + 1, opt.size || h * 0.38, col, 'center', 800, w - 14);
    }
    if (opt.badge !== undefined) {
      var br = Math.max(10, h * 0.2), bx = x + w - br * 0.6, by = yy + br * 0.5;
      ctx.fillStyle = opt.badge > 0 ? C.brass : '#6B5A43';
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C.shelfDeep; ctx.lineWidth = 2; ctx.stroke();
      A.text(ctx, String(opt.badge), bx, by + 1, br * 1.2, C.ink, 'center', 900);
    }
    if (opt.pulse) {
      ctx.strokeStyle = 'rgba(244,217,143,' + (0.35 + 0.3 * Math.sin(now * 5)) + ')'; ctx.lineWidth = 3;
      A.rr(ctx, x - 5, yy - 5, w + 10, h + 10, r + 5); ctx.stroke();
    }
    ui.push({ id: id, x: x, y: y, w: w, h: h + depth, act: opt.disabled && !opt.tapDisabled ? null : opt.act });
  }
  function hitUI(x, y) {
    for (var i = ui.length - 1; i >= 0; i--) {
      var b = ui[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }
  function uiById(id) { for (var i = 0; i < ui.length; i++) if (ui[i].id === id) return ui[i]; return null; }

  // ------------------------------------------------------------------ background
  function drawBg() {
    if (!bgCanvas) {
      bgCanvas = document.createElement('canvas');
      bgCanvas.width = Math.max(1, Math.round(W * DPR)); bgCanvas.height = Math.max(1, Math.round(H * DPR));
      var g = bgCanvas.getContext('2d');
      g.scale(DPR, DPR);
      A.background(g, W, H);
    }
    ctx.drawImage(bgCanvas, 0, 0, W, H);
    drawDust();
  }

  // ------------------------------------------------------------------ flask rendering
  var segPool = [];
  for (var sp0 = 0; sp0 < 16; sp0++) segPool.push({ c: 0, a: 0, hid: false });
  var fo = { x: 0, y: 0, w: 0, ang: 0, segs: segPool, n: 0, glow: 0, cork: -1, seal: 0, sealPop: 0, t: 0, focus: false, lift: 0, bub: 0, glowCol: null };
  function setSeg(i, c, a, hid) { var s = segPool[i]; s.c = c; s.a = a; s.hid = hid; }
  function fillSegs(cols, uids, cut, rest, addC, addA) {
    // cols/uids: layers; the top `cut` layers are replaced by one segment of `rest` amount; addA adds a segment on top
    var n = 0, k;
    var keep = cols.length - cut;
    for (k = 0; k < keep; k++) setSeg(n++, cols[k], 1, isHid(uids[k]));
    if (cut && rest > 0.001) setSeg(n++, cols[cols.length - 1], rest, false);
    if (addA > 0.001) setSeg(n++, addC, addA, false);
    return n;
  }
  function drawFlaskAt(f, x, y, ang, segN, extra) {
    var w = LY.w;
    fo.x = x; fo.y = y; fo.w = w; fo.ang = ang; fo.n = segN; fo.t = now; fo.bub = f + 1;
    fo.lift = extra.lift || 0;
    fo.glow = extra.glow || 0; fo.glowCol = extra.glowCol || null;
    fo.focus = !!extra.focus;
    fo.cork = G.doneT[f] ? clamp((now - G.doneT[f]) / 0.45, 0, 1) : -1;
    fo.seal = 0; fo.sealPop = 0;
    if (G.cork && G.cork.f === f) {
      if (G.moves < G.cork.n) fo.seal = G.cork.n - G.moves;
      else if (G.sealPopT >= 0 && now - G.sealPopT < 0.7) fo.sealPop = Math.max(0.001, (now - G.sealPopT) / 0.7);
    }
    A.flask(ctx, fo);
  }
  function animPose(an) {
    var e = now - an.t0, p = LY.pos[an.s], k;
    if (e < T_MOVE) k = ease(e / T_MOVE);
    else if (e < T_MOVE + an.dur) k = 1;
    else k = 1 - ease((e - T_MOVE - an.dur) / T_BACK);
    var lift0 = e < T_MOVE ? LY.w * 0.42 : 0;
    return { x: p.x + (an.px - p.x) * k, y: p.y - lift0 * (1 - k) + (an.py - p.y) * k, ang: an.ang * k, pour: clamp((e - T_MOVE) / an.dur, 0, 1), e: e };
  }
  function drawStream(an, pose) {
    if (pose.e < T_MOVE - 0.02 || pose.e > T_MOVE + an.dur + 0.06) return;
    var w = LY.w, pd = LY.pos[an.d];
    var ca = Math.cos(pose.ang), sa = Math.sin(pose.ang);
    var px = an.side * w * 0.5, py = -GEO.FH * w;
    var mx = pose.x + px * ca - py * sa, my = pose.y + px * sa + py * ca;
    var fillNow = an.preD.length + an.n * pose.pour;
    var sy = pd.y - (GEO.BASE + fillNow * GEO.LH) * w;
    var head = clamp((pose.e - T_MOVE + 0.02) / 0.1, 0, 1);
    var tail = clamp((pose.e - T_MOVE - an.dur + 0.02) / 0.08, 0, 1);
    var y0 = my + (sy - my) * tail, y1 = my + (sy - my) * head;
    var tx = pd.x + an.side * w * 0.04;
    var th = w * (0.13 + 0.025 * Math.sin(now * 30));
    function xAt(y) { var q = clamp((y - my) / Math.max(1, sy - my), 0, 1); return mx + (tx - mx) * (1 - Math.pow(1 - q, 3)); }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = LIQ[an.c].c; ctx.lineWidth = th;
    ctx.beginPath();
    var steps = 8;
    for (var i = 0; i <= steps; i++) { var y = y0 + (y1 - y0) * i / steps; if (i) ctx.lineTo(xAt(y), y); else ctx.moveTo(xAt(y), y); }
    ctx.stroke();
    ctx.strokeStyle = LIQ[an.c].hi; ctx.lineWidth = th * 0.35; ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ screens: game
  function drawGame() {
    drawBg();
    var w = LY.w, i, f;
    // candles at the ends of the first shelf when there is room
    var pl0 = LY.planks[0];
    if (pl0 && pl0.x0 > w * 1.6 + LY.m) {
      var cw = clamp(w * 0.32, 12, 26);
      A.candle(ctx, pl0.x0 - cw * 2.2, pl0.y, cw, cw * 3.2, now, 1);
      A.candle(ctx, pl0.x1 + cw * 2.2, pl0.y, cw, cw * 2.4, now, 4);
    }
    for (i = 0; i < LY.planks.length; i++) { var pk = LY.planks[i]; A.plank(ctx, pk.x0, pk.x1, pk.y, pk.th); }
    // static flasks
    var guide = null;
    if (G.idx === 0 && !save.tut && !G.won) guide = guideMove();
    for (f = 0; f < G.fl.length; f++) {
      var an = busy(f);
      if (an && an.s === f) continue;
      var p = LY.pos[f], n;
      if (an) n = fillSegs(an.preD, an.preDU, 0, 0, an.c, an.n * animPose(an).pour);
      else n = fillSegs(G.fl[f], G.uid[f], 0, 0, 0, 0);
      var sx = 0, se = now - G.shakeT[f];
      if (se < 0.35) sx = Math.sin(se * 42) * w * 0.09 * (1 - se / 0.35);
      var glow = f === G.sel ? 0.9 : 0;
      drawFlaskAt(f, p.x + sx, p.y, 0, n, { lift: G.lift[f], glow: glow, focus: keyboardMode && G.focus === f && !G.clear });
    }
    // streams, then the pouring flasks on top
    for (i = 0; i < G.anims.length; i++) drawStream(G.anims[i], animPose(G.anims[i]));
    for (i = 0; i < G.anims.length; i++) {
      var a2 = G.anims[i], pose = animPose(a2);
      var n2 = fillSegs(a2.preS, a2.preSU, a2.n, a2.n * (1 - pose.pour), 0, 0);
      drawFlaskAt(a2.s, pose.x, pose.y, pose.ang, n2, {});
    }
    drawParticles();
    drawHud();
    drawTools();
    drawMessage();
    if (guide && !G.anims.length) {
      var gf = G.sel === guide[0] ? guide[1] : guide[0];
      var gp = LY.pos[gf];
      drawHand(gp.x + w * 0.15, gp.y - GEO.FH * w * 0.45 - G.lift[gf], w);
    }
    if (G.clear) drawClear();
    if (G.menu) drawMenu();
  }

  function drawHud() {
    var m = LY.m, hb = clamp(U * 11, 44, 58), top = m;
    button('menu', m, top, hb, hb, { icon: 'pause', act: function () { G.menu = true; toast = null; focusId = null; } });
    button('levels', W - m - hb, top, hb, hb, { icon: 'grid', act: goSelect });
    var cx = W / 2, fs = clamp(U * 4.2, 15, 24);
    var shelf = Math.floor(G.idx / PER);
    A.text(ctx, t('level', G.idx + 1) + ' · ' + t('shelves')[shelf], cx, top + hb * 0.22, fs * 0.8, C.brass, 'center', 800, W - 2 * (m + hb) - 16);
    // moves and live star preview
    var th = PS.thresholds(G.par), ns = G.moves <= th[0] ? 3 : G.moves <= th[1] ? 2 : 1;
    if (G.extra) ns = Math.min(ns, 2);
    var line = t('moves') + ' ' + G.moves + '   ' + t('par') + ' ' + G.par;
    var sz = A.text(ctx, line, cx, top + hb * 0.66, fs, C.parchment, 'center', 900, W - 2 * (m + hb) - 16);
    var sr = clamp(U * 2, 7, 11), sy = top + hb * 0.66 + sz * 0.95 + sr * 0.4;
    for (var i = 0; i < 3; i++) A.star(ctx, cx + (i - 1) * sr * 2.4, sy, sr, i < ns);
  }
  function drawTools() {
    var bh = clamp(U * 12, 50, 68), bw = clamp(U * 18, 64, 110), gap = clamp(U * 3, 10, 24);
    var y = H - LY.m - bh - Math.max(3, bh * 0.08);
    var x0 = W / 2 - (bw * 3 + gap * 2) / 2;
    var stuck = G.stuck > 0 && !G.won;
    button('undo', x0, y, bw, bh, { icon: 'undo', disabled: !G.hist.length || G.won, act: undo, pulse: stuck && G.hist.length > 0 });
    button('restart', x0 + bw + gap, y, bw, bh, { icon: 'reset', disabled: G.won, act: restart, pulse: stuck && !G.hist.length });
    button('add', x0 + 2 * (bw + gap), y, bw, bh, { icon: 'addFlask', disabled: G.won || G.extra || save.add <= 0, tapDisabled: true, act: addFlask, badge: save.add, pulse: stuck && !G.extra && save.add > 0 });
  }
  function drawMessage() {
    var msg = null, warn = false;
    if (G.won) return;
    if (G.stuck === 1) { msg = t('noMoves'); warn = true; }
    else if (G.stuck === 2) { msg = t('deadEnd'); warn = true; }
    else if (G.idx === 0 && !save.tut) msg = G.sel < 0 ? t('tutPick') : t('tutPour');
    else if (G.tip && G.moves < 3) msg = G.tip === 'tipCork' ? t('tipCork', G.cork ? G.cork.n : 0) : t(G.tip);
    if (!msg) return;
    var fs = clamp(U * 3.6, 13, 20);
    ctx.font = A.font(fs, 800);
    var tw = Math.min(W - 2 * LY.m, ctx.measureText(msg).width + fs * 2.2);
    var h = LY.msgH * 0.9, x = W / 2 - tw / 2, y = LY.msgY - h / 2;
    ctx.fillStyle = warn ? 'rgba(110,23,36,0.92)' : 'rgba(12,29,24,0.82)';
    A.rr(ctx, x, y, tw, h, h / 2); ctx.fill();
    ctx.strokeStyle = warn ? 'rgba(255,190,190,0.5)' : 'rgba(212,168,75,0.6)'; ctx.lineWidth = 1.5;
    A.rr(ctx, x, y, tw, h, h / 2); ctx.stroke();
    A.text(ctx, msg, W / 2, LY.msgY + 1, fs, C.parchment, 'center', 800, tw - fs);
  }
  function drawHand(x, y, w) {
    var ph = (now * 1.1) % 1, press = ph > 0.45 && ph < 0.65;
    var s = clamp(w * 0.75, 30, 56);
    var bob = press ? s * 0.08 : -Math.sin(ph * Math.PI) * s * 0.18;
    if (press) {
      var rp = (ph - 0.45) / 0.2;
      ctx.strokeStyle = 'rgba(244,217,143,' + (0.8 * (1 - rp)) + ')'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x - s * 0.08, y - s * 0.42, s * (0.2 + rp * 0.45), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(-0.35);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    A.rr(ctx, -s * 0.12, -s * 0.36, s * 0.24, s * 0.62, s * 0.12); ctx.fill();
    // finger
    ctx.fillStyle = C.parchment; ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(2, s * 0.06);
    A.rr(ctx, -s * 0.12, -s * 0.42, s * 0.24, s * 0.62, s * 0.12); ctx.fill(); ctx.stroke();
    // palm
    A.rr(ctx, -s * 0.24, s * 0.06, s * 0.6, s * 0.5, s * 0.18); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.12, s * 0.08); ctx.lineTo(s * 0.12, s * 0.24); ctx.moveTo(s * 0.24, s * 0.1); ctx.lineTo(s * 0.24, s * 0.26); ctx.stroke();
    ctx.fillStyle = C.brass; A.rr(ctx, -s * 0.24, s * 0.48, s * 0.6, s * 0.14, s * 0.05); ctx.fill();
    ctx.restore();
  }

  function drawClear() {
    var c = G.clear, age = now - c.t, k = easeOut(age / 0.4);
    ctx.fillStyle = 'rgba(6,16,13,' + (0.42 * k) + ')';
    ctx.fillRect(0, 0, W, H);
    var cw = Math.min(W - 32, clamp(U * 88, 280, 440)), ch = clamp(U * 62, 250, 340);
    if (c.last) ch += clamp(U * 6, 20, 34);
    var x = W / 2 - cw / 2, y = H / 2 - ch / 2 + (1 - easeBack(age / 0.45)) * H * 0.3;
    A.panel(ctx, x, y, cw, ch, 18);
    var fs = clamp(U * 8, 28, 44);
    A.text(ctx, t('clear'), W / 2, y + ch * 0.15, fs, C.ink, 'center', 900, cw - 40);
    var sr = clamp(U * 7, 24, 38);
    for (var i = 0; i < 3; i++) {
      var on = i < G.starShown, sc = on ? easeBack(clamp((age - 0.55 - i * 0.32) / 0.3, 0, 1)) : 1;
      var sx = W / 2 + (i - 1) * sr * 2.5, sy = y + ch * 0.38 - (i === 1 ? sr * 0.25 : 0);
      if (!on) A.star(ctx, sx, sy, sr, false, 'rgba(94,76,53,0.25)');
      else A.star(ctx, sx, sy, sr * Math.max(0.01, sc), true);
    }
    var fs2 = clamp(U * 4.2, 15, 22);
    A.text(ctx, t('moves') + ' ' + G.moves + '  ·  ' + t('par') + ' ' + G.par, W / 2, y + ch * 0.58, fs2, C.inkSoft, 'center', 800, cw - 30);
    var note = c.newBest ? t('newBest') : c.refill ? t('refill') : '';
    if (note) A.text(ctx, note, W / 2, y + ch * 0.68, fs2 * 0.9, C.sealDeep, 'center', 900, cw - 30);
    if (c.last) A.text(ctx, t('finale'), W / 2, y + ch * 0.74, fs2 * 0.85, C.ink, 'center', 800, cw - 30);
    var bh = clamp(U * 12, 48, 62), gap = 12, small = bh * 1.1;
    var by = y + ch - bh - 26;
    var bx = x + 22, nextW = cw - 44 - 2 * small - 2 * gap;
    button('cMenu', bx, by, small, bh, { icon: 'grid', act: goSelect });
    button('cReplay', bx + small + gap, by, small, bh, { icon: 'reset', act: function () { startLevel(G.idx); } });
    button('cNext', bx + 2 * (small + gap), by, nextW, bh, { style: 'brass', label: c.last ? t('menu') : t('next'), icon: c.last ? 'grid' : 'play', act: c.last ? goSelect : goNext });
    if (focusId === null && keyboardMode) focusId = 'cNext';
  }

  function drawMenu() {
    ctx.fillStyle = 'rgba(6,16,13,0.6)'; ctx.fillRect(0, 0, W, H);
    var cw = Math.min(W - 32, clamp(U * 80, 260, 380)), bh = clamp(U * 12, 48, 60), gap = 12;
    var ch = bh * 4 + gap * 3 + 100;
    var x = W / 2 - cw / 2, y = H / 2 - ch / 2;
    A.panel(ctx, x, y, cw, ch, 18);
    A.text(ctx, t('paused'), W / 2, y + 40, clamp(U * 6, 22, 32), C.ink, 'center', 900);
    var bx = x + 24, bw = cw - 48, yy = y + 74;
    button('mResume', bx, yy, bw, bh, { style: 'brass', icon: 'play', label: t('resume'), act: function () { G.menu = false; focusId = null; } });
    yy += bh + gap;
    button('mRestart', bx, yy, bw, bh, { style: 'parch', icon: 'reset', label: t('restart'), act: function () { restart(); } });
    yy += bh + gap;
    button('mLevels', bx, yy, bw, bh, { style: 'parch', icon: 'grid', label: t('levels'), act: goSelect });
    yy += bh + gap;
    var hw = (bw - gap) / 2;
    button('mSound', bx, yy, hw, bh, { style: 'parch', icon: save.snd ? 'sound' : 'soundOff', act: toggleSound });
    button('mMusic', bx + hw + gap, yy, hw, bh, { style: 'parch', icon: save.mus ? 'music' : 'musicOff', act: toggleMusic });
    if (focusId === null && keyboardMode) focusId = 'mResume';
  }

  // ------------------------------------------------------------------ screens: title
  var titleFlasks = [[0, 0, 0, 0], [3, 3, 3, 3], [1, 2, 1, 4], [4, 4, 4, 4], [6, 5, 7, 5], [2, 2, 2, 2]];
  function drawTitle() {
    drawBg();
    var portrait = H > W * 1.1;
    var m = Math.max(16, U * 2.5);
    var fs = clamp(Math.min(W * 0.14, H * 0.13), 40, 104);
    var ty = portrait ? H * 0.17 : H * 0.175;
    // title
    ctx.save();
    ctx.font = A.font(fs, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var title = 'Potion Sort';
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(title, W / 2, ty + fs * 0.07);
    ctx.lineWidth = Math.max(3, fs * 0.09); ctx.strokeStyle = C.brassDeep; ctx.lineJoin = 'round'; ctx.strokeText(title, W / 2, ty);
    var tg = ctx.createLinearGradient(0, ty - fs / 2, 0, ty + fs / 2);
    tg.addColorStop(0, '#FFF6DC'); tg.addColorStop(0.55, C.brassHi); tg.addColorStop(1, C.brass);
    ctx.fillStyle = tg; ctx.fillText(title, W / 2, ty);
    ctx.restore();
    A.text(ctx, t('tagline'), W / 2, ty + fs * 0.78, clamp(fs * 0.26, 14, 24), C.parchment, 'center', 700, W - 2 * m);
    // shelf with flasks
    var n = portrait ? 5 : 6;
    var fw = clamp(Math.min(W / (n * 1.9), H * 0.07), 26, 62);
    var shelfY = portrait ? H * 0.53 : H * 0.6;
    var rowW = n * fw * 1.8;
    A.plank(ctx, W / 2 - rowW / 2 - fw * 0.6, W / 2 + rowW / 2 + fw * 0.6, shelfY, fw * 0.24);
    var cw = clamp(fw * 0.42, 11, 28);
    if (W / 2 - rowW / 2 - fw * 1.6 > cw * 2) {
      A.candle(ctx, W / 2 - rowW / 2 - fw * 1.6, shelfY, cw, cw * 3.3, now, 2);
      A.candle(ctx, W / 2 + rowW / 2 + fw * 1.6, shelfY, cw, cw * 2.5, now, 5);
    } else {
      // narrow screens: a low shelf with candles at the bottom
      var ly2 = H - Math.max(16, U * 4) - cw * 0.6;
      A.plank(ctx, -cw, W + cw, ly2, fw * 0.24);
      A.candle(ctx, W * 0.16, ly2, cw * 1.1, cw * 3.6, now, 2);
      A.candle(ctx, W * 0.27, ly2, cw * 0.9, cw * 2.2, now, 7);
      A.candle(ctx, W * 0.84, ly2, cw * 1.1, cw * 2.9, now, 5);
    }
    var saveG = G; G = null;
    for (var i = 0; i < n; i++) {
      var cols = titleFlasks[i], segN = 0;
      for (var k = 0; k < cols.length; k++) setSeg(segN++, cols[k], 1, false);
      fo.x = W / 2 - rowW / 2 + fw * 1.8 * (i + 0.5); fo.y = shelfY; fo.w = fw; fo.ang = 0; fo.n = segN; fo.t = now; fo.bub = i + 3;
      fo.lift = Math.max(0, Math.sin(now * 1.3 + i * 1.1)) * fw * 0.06; fo.glow = 0; fo.focus = false;
      fo.cork = cols[0] === cols[1] && cols[1] === cols[3] ? 1 : -1; fo.seal = 0; fo.sealPop = 0;
      A.flask(ctx, fo);
    }
    G = saveG;
    drawParticles();
    // buttons
    var bw = clamp(U * 52, 200, 300), bh = clamp(U * 14, 56, 72);
    var by = portrait ? H * 0.66 : H * 0.7;
    var nl = nextLevel();
    button('play', W / 2 - bw / 2, by, bw, bh, { style: 'brass', icon: 'play', label: t('play'), size: bh * 0.42, act: onPlay });
    A.text(ctx, t('level', nl + 1), W / 2, by + bh + clamp(U * 4, 16, 26), clamp(U * 3.6, 13, 18), C.parchDeep, 'center', 700);
    var lb = clamp(U * 40, 160, 230), lh = clamp(U * 11, 46, 58);
    var ly = by + bh + clamp(U * 9, 36, 56);
    button('levelsT', W / 2 - lb / 2, ly, lb, lh, { style: 'parch', icon: 'grid', label: t('levels'), act: function () { selShelf = Math.floor(nl / PER); screen = 'select'; focusId = null; } });
    // stars + toggles
    var ss = clamp(U * 4, 16, 24);
    var tot = totalStars() + ' / ' + NLV * 3;
    A.star(ctx, m + ss * 0.9, m + ss * 1.2, ss * 0.8, true);
    A.text(ctx, tot, m + ss * 2, m + ss * 1.25, ss, C.parchment, 'left', 800);
    var hb = clamp(U * 11, 44, 56);
    button('snd', W - m - hb, m, hb, hb, { icon: save.snd ? 'sound' : 'soundOff', act: toggleSound });
    button('mus', W - m - hb * 2 - 10, m, hb, hb, { icon: save.mus ? 'music' : 'musicOff', act: toggleMusic });
    if (Math.random() < 0.04) burst(W / 2 + (Math.random() - 0.5) * fs * 5, ty + (Math.random() - 0.5) * fs, 1, C.brassHi);
  }
  function onPlay() { startLevel(nextLevel()); }

  // ------------------------------------------------------------------ screens: level select
  function drawSelect() {
    drawBg();
    var m = Math.max(16, U * 2.5), hb = clamp(U * 11, 44, 56);
    button('back', m, m, hb, hb, { icon: 'home', act: function () { screen = 'title'; focusId = null; } });
    var ss = clamp(U * 4, 16, 22);
    var tot = String(totalStars());
    ctx.font = A.font(ss, 800);
    var tw = ctx.measureText(tot).width;
    A.star(ctx, W - m - tw - ss * 1.2, m + hb / 2, ss * 0.8, true);
    A.text(ctx, tot, W - m, m + hb / 2 + 1, ss, C.parchment, 'right', 800);
    // shelf header with arrows
    var k = selShelf;
    var hy = m + hb + clamp(U * 8, 30, 50);
    var aw = clamp(U * 11, 44, 56);
    var nameW = Math.min(W - 2 * m - 2 * aw - 20, 420);
    button('shPrev', W / 2 - nameW / 2 - aw - 10, hy - aw / 2, aw, aw, { icon: 'left', disabled: k === 0, act: function () { selShelf = Math.max(0, selShelf - 1); } });
    button('shNext', W / 2 + nameW / 2 + 10, hy - aw / 2, aw, aw, { icon: 'right', disabled: k === SHELVES - 1, act: function () { selShelf = Math.min(SHELVES - 1, selShelf + 1); } });
    A.text(ctx, t('shelves')[k], W / 2, hy - aw * 0.12, clamp(U * 5.5, 20, 30), C.brassHi, 'center', 900, nameW);
    A.text(ctx, (k + 1) + ' / ' + SHELVES + '   ★ ' + shelfStars(k) + ' / ' + PER * 3, W / 2, hy + aw * 0.4, clamp(U * 3.4, 12, 17), C.parchDeep, 'center', 700, nameW);
    // shelf dots
    for (var d = 0; d < SHELVES; d++) {
      ctx.fillStyle = d === k ? C.brassHi : 'rgba(242,230,201,0.25)';
      ctx.beginPath(); ctx.arc(W / 2 + (d - (SHELVES - 1) / 2) * 14, hy + aw * 0.85, d === k ? 4 : 3, 0, Math.PI * 2); ctx.fill();
    }
    // grid
    var gy = hy + aw + 10, gh = H - gy - m, gw = W - 2 * m;
    var best = null, opts = [[3, 4], [4, 3], [6, 2], [2, 6]];
    for (var o = 0; o < opts.length; o++) {
      var cols = opts[o][0], rows = opts[o][1];
      var s = Math.min(gw / cols, gh / rows);
      if (!best || s > best.s) best = { cols: cols, rows: rows, s: s };
    }
    var cell = Math.min(best.s, 150), tile = cell * 0.84;
    var x0 = W / 2 - cell * best.cols / 2, y0 = gy + (gh - cell * best.rows) / 2;
    var nl = nextLevel();
    for (var j = 0; j < PER; j++) {
      var idx = k * PER + j;
      var cx = x0 + (j % best.cols) * cell + (cell - tile) / 2, cy = y0 + Math.floor(j / best.cols) * cell + (cell - tile) / 2;
      levelTile(idx, cx, cy, tile, idx === nl);
    }
  }
  function levelTile(idx, x, y, s, current) {
    var open = unlocked(idx), st = save.lv[idx][0];
    var id = 'lv' + idx;
    var down = pressed === id;
    var yy = down ? y + 3 : y;
    if (!down) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; A.rr(ctx, x, y + 5, s, s, s * 0.2); ctx.fill(); }
    if (open) {
      ctx.fillStyle = C.brassDeep; A.rr(ctx, x - 2, yy - 2, s + 4, s + 4, s * 0.22); ctx.fill();
      var pg = ctx.createLinearGradient(0, yy, 0, yy + s);
      pg.addColorStop(0, '#F7EDD5'); pg.addColorStop(1, '#E2D0A6');
      ctx.fillStyle = pg; A.rr(ctx, x, yy, s, s, s * 0.2); ctx.fill();
      if (current) {
        ctx.strokeStyle = 'rgba(244,217,143,' + (0.6 + 0.3 * Math.sin(now * 4)) + ')'; ctx.lineWidth = 4;
        A.rr(ctx, x - 6, yy - 6, s + 12, s + 12, s * 0.24); ctx.stroke();
      }
      A.text(ctx, String(idx + 1), x + s / 2, yy + s * 0.4, s * 0.36, C.ink, 'center', 900);
      for (var i = 0; i < 3; i++) A.star(ctx, x + s / 2 + (i - 1) * s * 0.24, yy + s * 0.76, s * 0.1, i < st, 'rgba(94,76,53,0.22)');
    } else {
      ctx.fillStyle = '#1C3A32'; A.rr(ctx, x, yy, s, s, s * 0.2); ctx.fill();
      ctx.strokeStyle = 'rgba(212,168,75,0.35)'; ctx.lineWidth = 2; A.rr(ctx, x + 1, yy + 1, s - 2, s - 2, s * 0.2); ctx.stroke();
      A.icon(ctx, 'lock', x + s / 2, yy + s * 0.42, s * 0.3, 'rgba(242,230,201,0.4)');
      A.text(ctx, String(idx + 1), x + s / 2, yy + s * 0.78, s * 0.16, 'rgba(242,230,201,0.45)', 'center', 800);
    }
    if (focusId === id && keyboardMode) {
      ctx.strokeStyle = C.brassHi; ctx.lineWidth = 3; A.rr(ctx, x - 5, yy - 5, s + 10, s + 10, s * 0.24); ctx.stroke();
    }
    ui.push({ id: id, x: x, y: y, w: s, h: s + 5, act: open ? function () { startLevel(idx); } : function () { showToast(t('locked', Math.max(1, idx))); AU.nope(); } });
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(6,16,13,0.6)';
    ctx.fillRect(0, 0, W, H);
    var s = clamp(U * 16, 64, 110);
    ctx.fillStyle = C.brassDeep; A.rr(ctx, W / 2 - s / 2, H / 2 - s * 0.7 + 5, s, s, s * 0.28); ctx.fill();
    ctx.fillStyle = C.brass; A.rr(ctx, W / 2 - s / 2, H / 2 - s * 0.7, s, s, s * 0.28); ctx.fill();
    A.icon(ctx, 'pause', W / 2, H / 2 - s * 0.2, s * 0.5, C.ink);
    A.text(ctx, t('paused'), W / 2, H / 2 + s * 0.65, clamp(U * 5, 18, 28), C.parchment, 'center', 900);
  }

  // ------------------------------------------------------------------ render loop
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ui.length = 0;
    if (screen === 'title') drawTitle();
    else if (screen === 'select') drawSelect();
    else if (screen === 'game' && G) drawGame();
    if (toast) {
      var age = now - toast.t;
      if (age > 2.6) toast = null;
      else {
        var fs = clamp(U * 3.8, 14, 20);
        ctx.font = A.font(fs, 800);
        var w = Math.min(W - 32, ctx.measureText(toast.s).width + fs * 2);
        ctx.globalAlpha = clamp((2.6 - age) * 3, 0, 1);
        var ty = screen === 'game' && LY ? H - LY.toolH - LY.m - fs * 1.6 : H * 0.5;
        ctx.fillStyle = 'rgba(12,29,24,0.94)'; A.rr(ctx, W / 2 - w / 2, ty - fs * 1.2, w, fs * 2.4, fs * 1.2); ctx.fill();
        ctx.strokeStyle = 'rgba(212,168,75,0.7)'; ctx.lineWidth = 1.5; A.rr(ctx, W / 2 - w / 2, ty - fs * 1.2, w, fs * 2.4, fs * 1.2); ctx.stroke();
        A.text(ctx, toast.s, W / 2, ty + 1, fs, C.parchment, 'center', 800, w - fs);
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
  function startLoop() { if (rafId || paused) return; lastT = 0; rafId = requestAnimationFrame(frame); }
  function stopLoop() { if (rafId) cancelAnimationFrame(rafId); rafId = 0; }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    U = Math.min(W, H) / 100;
    bgCanvas = null;
    A.clearCache();
    if (G) {
      while (G.anims.length) finishAnim(G.anims[0]);
      layoutGame();
    }
    render();
  }

  // ------------------------------------------------------------------ input
  function toLocal(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function flaskAt(x, y) {
    if (!G || !LY) return -1;
    for (var f = 0; f < LY.pos.length; f++) {
      var p = LY.pos[f];
      if (x >= p.hx && x <= p.hx + p.hw && y >= p.hy && y <= p.hy + p.hh) return f;
    }
    return -1;
  }
  var pointerBtn = null;
  function onDown(e) {
    AU.unlock(); syncAudio();
    if (!ready || paused) return;
    if (e.pointerType !== 'mouse' || e.button === 0) keyboardMode = false;
    var p = toLocal(e);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    var b = hitUI(p.x, p.y);
    if (b) { pressed = b.id; pointerBtn = b.id; return; }
    if (screen === 'game' && G && !G.won && !G.menu) {
      var f = flaskAt(p.x, p.y);
      if (f >= 0) { G.focus = f; tapFlask(f); }
      else if (G.sel >= 0) { G.sel = -1; AU.deselect(); }
    }
  }
  function onMove(e) {
    if (!pointerBtn) return;
    var p = toLocal(e), b = hitUI(p.x, p.y);
    pressed = b && b.id === pointerBtn ? pointerBtn : null;
  }
  function onUp(e) {
    var id = pointerBtn;
    pointerBtn = null;
    if (!id) return;
    var p = toLocal(e), b = hitUI(p.x, p.y);
    pressed = null;
    if (b && b.id === id && b.act) { AU.ui(); b.act(); }
  }
  function onCancel() { pointerBtn = null; pressed = null; }

  function onKey(e) {
    if (!ready) return;
    var k = e.key;
    AU.unlock(); syncAudio();
    if (paused) return;
    var handled = true;
    if (screen === 'game' && G && !G.won && !G.menu) {
      keyboardMode = true;
      var n = G.fl.length;
      if (k === 'ArrowLeft') G.focus = (G.focus + n - 1) % n;
      else if (k === 'ArrowRight') G.focus = (G.focus + 1) % n;
      else if (k === 'ArrowUp' || k === 'ArrowDown') G.focus = rowJump(G.focus, k === 'ArrowUp' ? -1 : 1);
      else if (k === 'Enter' || k === ' ') tapFlask(G.focus);
      else if (/^[0-9]$/.test(k)) { var f = (Number(k) + 9) % 10; if (f < n) { G.focus = f; tapFlask(f); } }
      else if (k === 'z' || k === 'Z' || k === 'u' || k === 'U' || k === 'Backspace') undo();
      else if (k === 'r' || k === 'R') restart();
      else if (k === 'f' || k === 'F' || k === '+' || k === 'a' || k === 'A') addFlask();
      else if (k === 'Escape' || k === 'p' || k === 'P') { G.menu = true; focusId = null; }
      else if (k === 'm' || k === 'M') toggleSound();
      else handled = false;
    } else if (screen === 'game' && G && G.menu && (k === 'Escape' || k === 'p' || k === 'P')) {
      G.menu = false; focusId = null;
    } else handled = menuKey(k);
    if (handled) e.preventDefault();
  }
  function rowJump(f, dir) {
    var p = LY.pos[f], best = f, bd = Infinity;
    for (var i = 0; i < LY.pos.length; i++) {
      var q = LY.pos[i];
      if (q.row !== p.row + dir) continue;
      var d = Math.abs(q.x - p.x);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function menuKey(k) {
    if (k === 'Escape') {
      keyboardMode = true;
      if (screen === 'select') { screen = 'title'; focusId = null; return true; }
      if (screen === 'game' && G && G.clear) { goSelect(); return true; }
      return false;
    }
    if (k === 'm' || k === 'M') { toggleSound(); return true; }
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
      if (best) { focusId = best.id; AU.ui(); }
      return true;
    }
    if (k === 'Enter' || k === ' ') {
      keyboardMode = true;
      var f = uiById(focusId);
      if (!f || !f.act) { focusId = defaultFocus(usable); f = uiById(focusId); }
      if (f && f.act) { AU.ui(); f.act(); }
      return true;
    }
    return false;
  }
  function defaultFocus(usable) {
    var pref = ['play', 'cNext', 'mResume', 'lv' + nextLevel()];
    for (var i = 0; i < pref.length; i++) if (usable.some(function (b) { return b.id === pref[i]; })) return pref[i];
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
    stopLoop();
    pointerBtn = null; pressed = null;
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

  // Small, harmless hook for automated play-tests. Sends nothing anywhere.
  window.__potionDebug = {
    info: function () {
      return {
        screen: screen, ready: ready, level: G ? G.idx : -1, moves: G ? G.moves : 0, par: G ? G.par : 0, won: G ? G.won : false,
        clear: !!(G && G.clear), stars: G && G.clear ? G.clear.stars : 0, total: totalStars(), add: save.add, sel: G ? G.sel : -1,
        flasks: G ? G.fl.length : 0, fl: G ? G.fl.map(function (a) { return a.slice(); }) : null, anims: G ? G.anims.length : 0, stuck: G ? G.stuck : 0, lang: lang, paused: paused, tut: save.tut
      };
    },
    flask: function (f) { var p = LY && LY.pos[f]; return p ? { x: p.x, y: p.y - GEO.FH * LY.w * 0.5 } : null; },
    button: function (id) { var b = uiById(id); return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : null; },
    start: function (i) { if (ready) startLevel(clamp(i | 0, 0, NLV - 1)); },
    solution: function () {
      if (!G) return null;
      var r = PS.solve(G.fl, { limit: 200000, cork: G.cork ? G.cork.f : -1, corkLeft: G.cork ? Math.max(0, G.cork.n - G.moves) : 0 });
      return r.path;
    }
  };

  // 1) first frame synchronously, 2) load, 3) gameReady.
  resize();
  PlayablesSDK.firstFrameReady();
  startLoop();
  Promise.all([PlayablesSDK.load(), PlayablesSDK.getLanguage()]).then(function (res) {
    applySave(res[0]);
    lang = pickLang(res[1]);
    selShelf = Math.floor(nextLevel() / PER);
    syncAudio();
    ready = true;
    render();
    PlayablesSDK.gameReady();
  }, function () {
    ready = true;
    PlayablesSDK.gameReady();
  });
})();
