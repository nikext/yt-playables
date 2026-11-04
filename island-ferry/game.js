/* Island Ferry: game state, simulation, input, screens and the Playables lifecycle. */
(function () {
  'use strict';
  var IF = window.IF, C = IF.C, PlayablesSDK = window.PlayablesSDK, AU = IF.Audio, t = IF.t;
  var TAU = Math.PI * 2;

  PlayablesSDK.init({ storageKey: 'island-ferry_save' });

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = 390, H = 844, DPR = 1, U = 390;

  // ---------- tuning ----------
  var WW = 1600, WH = 860, IR = 76, MARGIN = 140, MAX_ISL = 12, DAY_LEN = 80;
  var REP_PER_HEART = 12, MAX_STOPS = 4, MAX_HEARTS = 8, SPEED = 150;
  var ISL_BY_DAY = [3, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 12];
  var ROUTE_COLS = ['#FF7F6E', '#8C78E8', '#2FB08F', '#EC6FA8', '#EE9B3E', '#4F86E0', '#C99A12', '#A866D0'];
  var CARD_KEYS = ['ferry', 'speed', 'hold', 'calm', 'light', 'heart', 'docks', 'crew'];
  var CARD_COLS = { ferry: C.peach, speed: C.sky, hold: C.butter, calm: C.mint, light: C.lavender, heart: C.pink, docks: C.peach, crew: C.sky };

  function islandsForDay(d) { return ISL_BY_DAY[Math.min(d - 1, ISL_BY_DAY.length - 1)]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOutBack(x) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }

  // ---------- state ----------
  var save = { v: 1, best: 0, bestDay: 0, snd: 1, tut: 0, run: null };
  var scene = 'title', ready = false, sysPaused = false, ytAudio = PlayablesSDK.isAudioEnabled();
  var menuOpen = false, needTap = false;
  var time = 0, lastTs = 0, raf = 0, timeScale = 1;
  var G = null;      // the run being played
  var HB = null;     // harbor (between days)
  var OV = null;     // game over summary
  var titleSure = 0;
  var toast = { text: '', t: 0, dur: 1 };
  var P1 = { x: 0, y: 0 }, P2 = { x: 0, y: 0 }, P3 = { x: 0, y: 0 }, LP = { x: 0, y: 0, a: 0 };
  var tmpGoods = [];

  function rect() { return { x: 0, y: 0, w: 0, h: 0 }; }
  function setR(o, x, y, w, h) { o.x = x; o.y = y; o.w = w; o.h = h; return o; }
  function inR(o, x, y) { return o && o.w > 0 && x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h; }
  var L = {
    pause: rect(), dayPill: rect(), scorePill: rect(), coinPill: rect(), ferryPill: rect(), heartPill: rect(),
    map: rect(), panel: rect(), delBtn: rect(), closeBtn: rect(),
    tPrimary: rect(), tSecondary: rect(), tSound: rect(),
    mPanel: rect(), mResume: rect(), mSound: rect(), mQuit: rect(),
    oPanel: rect(), oAgain: rect(), oMenu: rect(),
    hHome: rect(), hReroll: rect(), hHeart: rect(), cards: [rect(), rect(), rect()],
    narrow: true, hudH: 0, vertCards: true
  };
  var view = { s: 1, ox: 0, oy: 0, rot: false };

  function ws(x, y, out) {
    if (view.rot) { out.x = view.ox + (WH - y) * view.s; out.y = view.oy + x * view.s; }
    else { out.x = view.ox + x * view.s; out.y = view.oy + y * view.s; }
    return out;
  }

  // ---------- layout ----------
  function layout() {
    var p = 16, narrow = !(W >= 720 && W > H);
    L.narrow = narrow;
    setR(L.pause, p, p, 44, 44);
    var hw = 14 + (G ? G.run.maxHearts : 5) * 19;
    if (narrow) {
      var dw = Math.min(140, W - 2 * p - 44 - 96 - 16);
      setR(L.dayPill, (W - dw) / 2, p, dw, 44);
      var sw = Math.min(96, W - p - (L.dayPill.x + dw) - 8);
      setR(L.scorePill, W - p - sw, p, sw, 44);
      var y2 = p + 44 + 8;
      setR(L.heartPill, p, y2, hw, 36);
      setR(L.ferryPill, W - p - 74, y2, 74, 36);
      setR(L.coinPill, p + hw + 8, y2, Math.min(86, L.ferryPill.x - 8 - (p + hw + 8)), 36);
      L.hudH = y2 + 36;
    } else {
      var big = W >= 1000;
      setR(L.heartPill, p + 44 + 10, p + 4, hw, 36);
      setR(L.dayPill, (W - 150) / 2, p, 150, 44);
      setR(L.scorePill, W - p - (big ? 104 : 86), p + 4, big ? 104 : 86, 36);
      setR(L.coinPill, L.scorePill.x - 8 - (big ? 96 : 82), p + 4, big ? 96 : 82, 36);
      setR(L.ferryPill, L.coinPill.x - 8 - (big ? 84 : 74), p + 4, big ? 84 : 74, 36);
      L.hudH = p + 44;
    }
    var my = L.hudH + 10;
    setR(L.map, p, my, W - 2 * p, H - my - p - (H < 520 ? 4 : 40));
    view.rot = L.map.h > L.map.w * 1.05;
    var dw2 = view.rot ? WH : WW, dh2 = view.rot ? WW : WH;
    view.s = Math.min(L.map.w / dw2, L.map.h / dh2);
    view.ox = L.map.x + (L.map.w - dw2 * view.s) / 2;
    view.oy = L.map.y + (L.map.h - dh2 * view.s) / 2;

    // route panel
    var pw = Math.min(W - 32, 420), ph = 60;
    setR(L.panel, (W - pw) / 2, H - p - ph, pw, ph);
    setR(L.closeBtn, L.panel.x + pw - 8 - 44, L.panel.y + 8, 44, 44);
    var dbw = Math.min(150, pw * 0.42);
    setR(L.delBtn, L.closeBtn.x - 8 - dbw, L.panel.y + 8, dbw, 44);

    // title
    var bw = Math.min(320, W - 64);
    var by = narrow ? H * 0.54 : H * 0.52;
    setR(L.tPrimary, (W - bw) / 2, by, bw, 62);
    setR(L.tSecondary, (W - bw * 0.8) / 2, by + 62 + 18, bw * 0.8, 50);
    setR(L.tSound, W - p - 44, p, 44, 44);

    // pause menu
    var mw = Math.min(320, W - 48), mh = 70 + 3 * 54 + 2 * 12 + 24;
    setR(L.mPanel, (W - mw) / 2, (H - mh) / 2, mw, mh);
    setR(L.mResume, L.mPanel.x + 24, L.mPanel.y + 70, mw - 48, 54);
    setR(L.mSound, L.mPanel.x + 24, L.mResume.y + 66, mw - 48, 54);
    setR(L.mQuit, L.mPanel.x + 24, L.mSound.y + 66, mw - 48, 54);

    // game over
    var ow = Math.min(360, W - 32), oh = Math.min(400, H - 40);
    setR(L.oPanel, (W - ow) / 2, (H - oh) / 2, ow, oh);
    setR(L.oMenu, L.oPanel.x + 28, L.oPanel.y + oh - 28 - 48, ow - 56, 48);
    setR(L.oAgain, L.oPanel.x + 28, L.oMenu.y - 14 - 58, ow - 56, 58);

    // harbor
    setR(L.hHome, p, p, 44, 44);
    var waterH = Math.max(90, H * 0.17);
    L.waterY = H - waterH;
    L.hTitleY = Math.max(44, H * 0.075);
    L.hSubY = L.hTitleY + 34;
    L.hStatsY = L.hSubY + 22;
    var cTop = L.hStatsY + 34 + 16;
    var cBot = H - waterH * 0.55 - 50 - 24;
    L.vertCards = W < 700 || W < H;
    var avail = cBot - cTop, i;
    if (L.vertCards) {
      var cw = Math.min(W - 32, 440), ch = clamp((avail - 24) / 3, 70, 140);
      var tot = ch * 3 + 24, y0 = cTop + Math.max(0, (avail - tot) / 2);
      for (i = 0; i < 3; i++) setR(L.cards[i], (W - cw) / 2, y0 + i * (ch + 12), cw, ch);
    } else {
      var cw2 = Math.min(250, (W - 32 - 32) / 3), ch2 = clamp(avail, 200, 320);
      var x0 = (W - (3 * cw2 + 32)) / 2, y1 = cTop + Math.max(0, (avail - ch2) / 2);
      for (i = 0; i < 3; i++) setR(L.cards[i], x0 + i * (cw2 + 16), y1, cw2, ch2);
    }
    var last = L.cards[2], tw2 = Math.min(W - 32, 412), rb = (tw2 - 12) / 2;
    setR(L.hReroll, (W - tw2) / 2, last.y + last.h + 16, rb, 50);
    setR(L.hHeart, L.hReroll.x + rb + 12, last.y + last.h + 16, rb, 50);
  }

  function resize() {
    W = Math.max(200, window.innerWidth || 390);
    H = Math.max(200, window.innerHeight || 844);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    U = Math.min(W, H);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    layout();
    titleIslands = null;
    if (!raf || sysPaused) draw();
  }

  // ---------- islands ----------
  function genIslands(seed) {
    var r = IF.rng(seed ^ 0x9E3779B9), list = [], goods = [0, 1, 2, 3, 4, 5], i, k;
    for (i = 5; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var tmp = goods[i]; goods[i] = goods[j]; goods[j] = tmp; }
    for (i = 0; i < MAX_ISL; i++) {
      var bx = 0, by = 0, bs = -1e12;
      for (k = 0; k < 70; k++) {
        var x, y;
        if (i < 3) { x = WW * (0.27 + 0.46 * r()); y = WH * (0.27 + 0.46 * r()); }
        else { x = MARGIN + (WW - 2 * MARGIN) * r(); y = MARGIN + (WH - 2 * MARGIN) * r(); }
        var d = 1e9;
        for (var m = 0; m < list.length; m++) d = Math.min(d, Math.hypot(list[m].x - x, list[m].y - y));
        var sc;
        if (i === 0) sc = -Math.hypot(x - WW * 0.42, y - WH * 0.5) + r() * 120;
        else if (i < 3) sc = d < 330 ? d - 1e6 : -Math.abs(d - 400);
        else sc = d;
        if (sc > bs) { bs = sc; bx = x; by = y; }
      }
      list.push({
        i: i, x: bx, y: by, R: IR * (0.92 + 0.16 * r()), good: i < 6 ? goods[i] : Math.floor(r() * 6),
        deco: Math.floor(r() * 1e9), reqs: [], stock: 3, appear: 1, shake: 0, spr: null, sprS: 0, sprD: 0
      });
    }
    return list;
  }
  function ensureSprite(isl) {
    if (!isl.spr || isl.sprS !== view.s || isl.sprD !== DPR) {
      isl.spr = IF.renderIsland(isl.deco, isl.R * view.s, DPR);
      isl.sprS = view.s; isl.sprD = DPR;
    }
  }

  // ---------- run ----------
  function newRunData(seed) {
    return {
      seed: seed >>> 0, day: 1, hearts: 5, maxHearts: 5, rep: 0, coins: 0, deliveries: 0, ferries: 3,
      up: { spd: 0, cap: 0, dock: 0, prod: 0, light: 0 }, calm: [], routes: [], rerolls: 0, buys: 0, hb: 0, dayDeliv: 0
    };
  }
  function packRun() {
    var r = G.run, rts = [];
    for (var i = 0; i < G.routes.length; i++) rts.push(G.routes[i].stops.slice());
    return {
      s: r.seed, d: r.day, h: r.hearts, mh: r.maxHearts, r: r.rep, c: r.coins, n: r.deliveries, f: r.ferries,
      u: [r.up.spd, r.up.cap, r.up.dock, r.up.prod, r.up.light], cl: r.calm.slice(), rt: rts, rr: r.rerolls, hp: r.buys, hb: r.hb ? 1 : 0, dd: r.dayDeliv
    };
  }
  function num(v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? clamp(v, lo, hi) : def; }
  function unpackRun(o) {
    if (!o || typeof o !== 'object') return null;
    var r = newRunData(num(o.s, 0, 4294967295, 1));
    r.day = num(o.d, 1, 999, 1);
    r.maxHearts = num(o.mh, 1, MAX_HEARTS, 5);
    r.hearts = num(o.h, 1, r.maxHearts, r.maxHearts);
    r.rep = num(o.r, 0, REP_PER_HEART - 1, 0);
    r.coins = num(o.c, 0, 1e9, 0);
    r.deliveries = num(o.n, 0, 1e9, 0);
    r.ferries = num(o.f, 1, 20, 3);
    var u = Array.isArray(o.u) ? o.u : [];
    r.up = { spd: num(u[0], 0, 9, 0), cap: num(u[1], 0, 9, 0), dock: num(u[2], 0, 9, 0), prod: num(u[3], 0, 9, 0), light: num(u[4], 0, 1, 0) };
    r.rerolls = num(o.rr, 0, 99, 0);
    r.buys = num(o.hp, 0, 99, 0);
    r.hb = o.hb ? 1 : 0;
    r.dayDeliv = num(o.dd, 0, 1e6, 0);
    var nIsl = islandsForDay(r.day);
    if (Array.isArray(o.cl)) for (var i = 0; i < o.cl.length; i++) { var ci = num(o.cl[i], 0, MAX_ISL - 1, 0); if (r.calm.indexOf(ci) < 0) r.calm.push(ci); }
    if (Array.isArray(o.rt)) {
      for (var k = 0; k < o.rt.length && r.routes.length < r.ferries; k++) {
        var st = o.rt[k], ok = Array.isArray(st) && st.length >= 2 && st.length <= MAX_STOPS;
        if (ok) for (var m = 0; m < st.length; m++) {
          if (!(st[m] >= 0 && st[m] < nIsl && Math.floor(st[m]) === st[m]) || st.indexOf(st[m]) !== m) ok = false;
        }
        if (ok) r.routes.push(st.slice());
      }
    }
    return r;
  }
  function persist() { PlayablesSDK.save(save); }
  function snapshot() { if (G) save.run = packRun(); persist(); }

  function startRun(run) {
    G = {
      run: run, isl: genIslands(run.seed), active: islandsForDay(run.day), routes: [], dayT: 0, spawnT: 4, tut: null, tutT: 0,
      sel: null, drag: null, heartShake: 0, heartGain: 0, banner: 0, bannerNew: false, dusk: 0, overT: 0, ferryFlash: 0, nextId: 1, multiTip: false
    };
    menuOpen = false; needTap = false; OV = null;
    layout();
    for (var i = 0; i < run.routes.length; i++) addRoute(run.routes[i], true);
    if (run.hb) enterHarbor(true); else startDay(false);
  }

  function startDay(isNew) {
    var run = G.run, prev = G.active, i;
    G.active = islandsForDay(run.day);
    for (i = 0; i < G.isl.length; i++) {
      var isl = G.isl[i];
      isl.reqs.length = 0; isl.stock = stockMax(); isl.shake = 0;
      isl.appear = (isNew && i >= prev && i < G.active) ? 0 : 1;
    }
    for (i = 0; i < G.routes.length; i++) resetFerry(G.routes[i].ferry);
    G.dayT = 0; G.spawnT = 4; G.dusk = 0; G.overT = 0; G.sel = null; G.drag = null;
    G.banner = 2.8; G.bannerNew = isNew && G.active > prev;
    G.tut = null;
    run.dayDeliv = 0;
    if (run.day > save.bestDay) save.bestDay = run.day;
    if (run.day === 1) {
      if (!save.tut) { G.tut = { step: 0 }; addReq(G.isl[1], G.isl[0].good, 90); }
      else addReq(G.isl[1], G.isl[0].good, 60);
    }
    if (run.day === 2 && G.active > 3) showToast(t('multi'), 6);
    scene = 'play';
    AU.ambience(true);
  }

  function stockMax() { return 3 + (G ? G.run.up.prod : 0); }
  function prodRate() { return (1 / 6) * (1 + 0.4 * G.run.up.prod); }
  function ferrySpeed() { return SPEED * (1 + 0.2 * G.run.up.spd); }
  function capacity() { return 2 + G.run.up.cap; }
  function dockMul() { return Math.pow(0.6, G.run.up.dock); }
  function patience(isl) {
    var d = G.run.day, p = Math.max(20, 44 - 2.4 * (d - 1));
    if (G.run.calm.indexOf(isl.i) >= 0) p *= 1.6;
    if (G.run.up.light) p *= 1.1;
    return p;
  }
  function spawnGap() { return Math.max(1.5, 7.8 - 0.62 * (G.run.day - 1)); }
  function maxReqs() { return G.run.day < 3 ? 2 : G.run.day < 8 ? 3 : 4; }

  // ---------- routes & ferries ----------
  function buildLegs(rt) {
    rt.legs.length = 0;
    for (var k = 0; k < rt.stops.length - 1; k++) {
      var A = G.isl[rt.stops[k]], B = G.isl[rt.stops[k + 1]];
      var dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
      var sgn = (rt.ci % 2 ? 1 : -1) * (A.i < B.i ? 1 : -1);
      var bend = 0.12 * len * sgn;
      var cx = (A.x + B.x) / 2 - dy / len * bend, cy = (A.y + B.y) / 2 + dx / len * bend;
      var N = 48, raw = [], j;
      for (j = 0; j <= N; j++) {
        var s = j / N, a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, c = s * s;
        raw.push(a * A.x + b * cx + c * B.x, a * A.y + b * cy + c * B.y);
      }
      var i0 = 0, i1 = N;
      while (i0 < N - 2 && Math.hypot(raw[i0 * 2] - A.x, raw[i0 * 2 + 1] - A.y) < A.R * 0.88) i0++;
      while (i1 > i0 + 2 && Math.hypot(raw[i1 * 2] - B.x, raw[i1 * 2 + 1] - B.y) < B.R * 0.88) i1--;
      var n = i1 - i0 + 1, pts = new Float32Array(n * 2), cum = new Float32Array(n), tot = 0;
      for (j = 0; j < n; j++) {
        pts[j * 2] = raw[(i0 + j) * 2]; pts[j * 2 + 1] = raw[(i0 + j) * 2 + 1];
        if (j) tot += Math.hypot(pts[j * 2] - pts[j * 2 - 2], pts[j * 2 + 1] - pts[j * 2 - 1]);
        cum[j] = tot;
      }
      rt.legs.push({ pts: pts, cum: cum, n: n, len: tot });
    }
  }
  function legPos(lg, d, out) {
    var n = lg.n, cum = lg.cum, pts = lg.pts, i = 1;
    d = clamp(d, 0, lg.len);
    while (i < n - 1 && cum[i] < d) i++;
    var seg = cum[i] - cum[i - 1], f = seg > 0 ? (d - cum[i - 1]) / seg : 0;
    var ax = pts[i * 2 - 2], ay = pts[i * 2 - 1], bx = pts[i * 2], by = pts[i * 2 + 1];
    out.x = ax + (bx - ax) * f; out.y = ay + (by - ay) * f; out.a = Math.atan2(by - ay, bx - ax);
    return out;
  }
  function makeFerry(rt) { return { rt: rt, at: 0, leg: 0, dir: 1, d: 0, sail: false, timer: 0.4, cargo: [], x: 0, y: 0, ang: 0, wake: 0, bob: Math.random() * 6 }; }
  function resetFerry(f) {
    f.at = 0; f.dir = 1; f.d = 0; f.sail = false; f.timer = 0.4; f.cargo.length = 0;
    legPos(f.rt.legs[0], 0, LP); f.x = LP.x; f.y = LP.y; f.ang = LP.a;
  }
  function freeFerries() { return G.run.ferries - G.routes.length; }
  function sameRoute(a, b) {
    if (a.length !== b.length) return false;
    var i, fw = true, bw = true;
    for (i = 0; i < a.length; i++) { if (a[i] !== b[i]) fw = false; if (a[i] !== b[b.length - 1 - i]) bw = false; }
    return fw || bw;
  }
  function addRoute(stops, silent) {
    var used = {}, i, ci = 0;
    for (i = 0; i < G.routes.length; i++) used[G.routes[i].ci] = 1;
    while (used[ci]) ci++;
    var rt = { id: G.nextId++, stops: stops.slice(), ci: ci, col: ROUTE_COLS[ci % ROUTE_COLS.length], legs: [], ferry: null };
    buildLegs(rt);
    rt.ferry = makeFerry(rt); resetFerry(rt.ferry);
    G.routes.push(rt);
    if (!silent) {
      AU.play('horn');
      if (G.tut && G.tut.step === 0 && rt.stops.indexOf(0) >= 0 && rt.stops.indexOf(1) >= 0) G.tut.step = 1;
      for (i = 0; i < stops.length; i++) { ws(G.isl[stops[i]].x, G.isl[stops[i]].y, P1); puffAt(G.isl[stops[i]].x, G.isl[stops[i]].y, 6, '#ffffff'); }
    }
    return rt;
  }
  function tryRoute(stops) {
    if (!G || scene !== 'play') return false;
    if (stops.length < 2) return false;
    for (var i = 0; i < G.routes.length; i++) if (sameRoute(G.routes[i].stops, stops)) { showToast(t('dupRoute'), 2); AU.play('deny'); return false; }
    if (freeFerries() <= 0) { showToast(t('noFerry'), 2.4); G.ferryFlash = 1; AU.play('deny'); return false; }
    addRoute(stops, false);
    return true;
  }
  function removeRoute(rt) {
    var f = rt.ferry, i;
    for (i = 0; i < f.cargo.length; i++) if (f.cargo[i].req) f.cargo[i].req.res = null;
    f.cargo.length = 0;
    i = G.routes.indexOf(rt);
    if (i >= 0) G.routes.splice(i, 1);
    if (G.sel === rt) G.sel = null;
    AU.play('remove');
  }

  function findReq(rt, good, exclude, prefer) {
    var best = null, bt = 1e9;
    for (var s = 0; s < rt.stops.length; s++) {
      var isl = G.isl[rt.stops[s]];
      if (isl === exclude) continue;
      for (var k = 0; k < isl.reqs.length; k++) {
        var r = isl.reqs[k];
        if (r.good !== good || r.res || r.dead) continue;
        var score = isl === prefer ? -1 : r.t;
        if (score < bt) { bt = score; best = r; }
      }
    }
    return best;
  }
  function arrive(f) {
    var rt = f.rt, isl = G.isl[rt.stops[f.at]], moved = 0, k, c;
    for (k = f.cargo.length - 1; k >= 0; k--) {
      c = f.cargo[k];
      if (c.req && c.req.dead) c.req = null;
      if (!c.req) { var nr = findReq(rt, c.good, null, isl); if (nr) { c.req = nr; nr.res = f; } }
      if (c.req && c.req.isl === isl) { deliver(c.req, f); f.cargo.splice(k, 1); moved++; }
      else if (!c.req) { f.cargo.splice(k, 1); puffAt(isl.x, isl.y, 4, IF.GOODS[c.good].col); }
    }
    var room = capacity() - f.cargo.length;
    while (room > 0 && isl.stock >= 1) {
      var r = findReq(rt, isl.good, isl, null);
      if (!r) break;
      r.res = f; f.cargo.push({ good: isl.good, req: r }); isl.stock -= 1; room--; moved++;
    }
    f.sail = false;
    f.timer = (moved ? 0.35 + 0.3 * moved : 0.15) * dockMul();
  }
  function updFerry(f, dt) {
    var rt = f.rt, n = rt.stops.length;
    if (!f.sail) {
      f.timer -= dt;
      if (f.timer > 0) return;
      if (f.at >= n - 1) f.dir = -1; else if (f.at <= 0) f.dir = 1;
      f.leg = f.dir > 0 ? f.at : f.at - 1; f.d = 0; f.sail = true;
    }
    var lg = rt.legs[f.leg];
    f.d += ferrySpeed() * dt;
    var arrived = f.d >= lg.len;
    if (arrived) f.d = lg.len;
    if (f.dir > 0) { legPos(lg, f.d, LP); f.ang = LP.a; }
    else { legPos(lg, lg.len - f.d, LP); f.ang = LP.a + Math.PI; }
    f.x = LP.x; f.y = LP.y;
    f.wake -= dt;
    if (f.wake <= 0) {
      f.wake = 0.08;
      var ca = Math.cos(f.ang), sa = Math.sin(f.ang), sx = f.x - ca * 17, sy = f.y - sa * 17;
      emit(1, sx, sy, -sa * 12 - ca * 5, ca * 12 - sa * 5, 1.1, 5, '#fff');
      emit(1, sx, sy, sa * 12 - ca * 5, -ca * 12 - sa * 5, 1.1, 5, '#fff');
    }
    if (arrived) { f.at += f.dir; arrive(f); }
  }

  // ---------- requests ----------
  function addReq(isl, good, pat) {
    var r = { good: good, t: pat, max: pat, res: null, isl: isl, pop: 0, dead: false };
    isl.reqs.push(r);
    return r;
  }
  function trySpawn() {
    var tot = 0, i, isl, mr = maxReqs();
    for (i = 0; i < G.active; i++) { isl = G.isl[i]; if (isl.appear >= 1 && isl.reqs.length < mr) tot += 1 / (1 + isl.reqs.length * 1.5); }
    if (tot <= 0) return false;
    var pick = Math.random() * tot, chosen = null;
    for (i = 0; i < G.active; i++) {
      isl = G.isl[i];
      if (isl.appear < 1 || isl.reqs.length >= mr) continue;
      pick -= 1 / (1 + isl.reqs.length * 1.5);
      if (pick <= 0) { chosen = isl; break; }
    }
    if (!chosen) return false;
    tmpGoods.length = 0;
    for (i = 0; i < G.active; i++) {
      var g = G.isl[i].good;
      if (g === chosen.good || tmpGoods.indexOf(g) >= 0) continue;
      var dup = false;
      for (var k = 0; k < chosen.reqs.length; k++) if (chosen.reqs[k].good === g) dup = true;
      if (!dup) tmpGoods.push(g);
    }
    if (!tmpGoods.length) return false;
    addReq(chosen, tmpGoods[Math.floor(Math.random() * tmpGoods.length)], patience(chosen));
    AU.play('pop');
    return true;
  }
  function removeReq(r) {
    r.dead = true;
    var i = r.isl.reqs.indexOf(r);
    if (i >= 0) r.isl.reqs.splice(i, 1);
  }
  function deliver(r, f) {
    var run = G.run, isl = r.isl;
    var coins = 5 + Math.round(5 * clamp(r.t / r.max, 0, 1));
    removeReq(r);
    run.coins += coins; run.deliveries++; run.dayDeliv++;
    run.rep++;
    if (run.rep >= REP_PER_HEART) {
      run.rep = 0;
      if (run.hearts < run.maxHearts) { run.hearts++; G.heartGain = 0.8; addPop(2, isl.x, isl.y - isl.R * 0.6, ''); AU.play('heart'); }
    }
    addPop(0, isl.x, isl.y - isl.R * 0.3, '+' + coins);
    puffAt(isl.x, isl.y, 10, IF.GOODS[r.good].col);
    AU.play('bell');
    if (G.tut && G.tut.step < 2) {
      G.tut.step = 2; G.tutT = 9;
      if (!save.tut) { save.tut = 1; persist(); }
    }
  }
  function expire(r) {
    var run = G.run, isl = r.isl;
    if (r.res) {
      var cg = r.res.cargo;
      for (var i = 0; i < cg.length; i++) if (cg[i].req === r) cg[i].req = null;
    }
    removeReq(r);
    run.hearts = Math.max(0, run.hearts - 1);
    G.heartShake = 0.8; isl.shake = 0.5;
    addPop(1, isl.x, isl.y - isl.R * 0.4, '');
    puffAt(isl.x, isl.y - isl.R * 0.4, 8, C.coral);
    AU.play('expire');
    if (run.hearts <= 0 && G.overT <= 0) G.overT = 1.4;
  }

  // ---------- particles ----------
  var PN = 240, parts = [], pi = 0;
  for (var q = 0; q < PN; q++) parts.push({ on: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, col: '#fff' });
  function emit(kind, x, y, vx, vy, life, size, col) {
    var p = parts[pi]; pi = (pi + 1) % PN;
    p.on = true; p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.size = size; p.col = col;
  }
  function puffAt(x, y, n, col) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, sp = 40 + Math.random() * 70;
      emit(0, x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.5 + Math.random() * 0.4, 7 + Math.random() * 6, col);
    }
  }
  var POPN = 20, pops = [], popi = 0;
  for (q = 0; q < POPN; q++) pops.push({ on: false, kind: 0, x: 0, y: 0, t: 0, txt: '' });
  function addPop(kind, x, y, txt) {
    var p = pops[popi]; popi = (popi + 1) % POPN;
    p.on = true; p.kind = kind; p.x = x; p.y = y; p.t = 0; p.txt = txt;
  }
  function updateFx(dt) {
    for (var i = 0; i < PN; i++) {
      var p = parts[i];
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) { p.on = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94;
    }
    for (i = 0; i < POPN; i++) { if (pops[i].on) { pops[i].t += dt; if (pops[i].t > 1.3) pops[i].on = false; } }
  }
  function clearFx() { for (var i = 0; i < PN; i++) parts[i].on = false; for (i = 0; i < POPN; i++) pops[i].on = false; }

  function showToast(text, dur) { toast.text = text; toast.t = dur || 2; toast.dur = toast.t; }

  // ---------- simulation ----------
  function update(dt) {
    if (!G || scene !== 'play') return;
    var run = G.run, i, k;
    if (G.dusk > 0) { G.dusk += dt; if (G.dusk > 4.5) enterHarbor(false); return; }
    updateFx(dt);
    if (G.overT > 0) { G.overT -= dt; if (G.overT <= 0) endRun(); return; }
    var frozen = G.tut && G.tut.step === 0;
    if (!frozen) G.dayT += dt;
    if (G.dayT >= DAY_LEN) { beginDusk(); return; }
    if (!G.tut || G.tut.step >= 2) {
      G.spawnT -= dt;
      if (G.spawnT <= 0) { G.spawnT = spawnGap() * (0.75 + Math.random() * 0.5); trySpawn(); }
    }
    var pr = prodRate() * dt, sm = stockMax();
    for (i = 0; i < G.active; i++) {
      var isl = G.isl[i];
      isl.appear = Math.min(1, isl.appear + dt * 1.4);
      isl.stock = Math.min(sm, isl.stock + pr);
      isl.shake = Math.max(0, isl.shake - dt);
      for (k = isl.reqs.length - 1; k >= 0; k--) {
        var r = isl.reqs[k];
        r.pop = Math.min(1, r.pop + dt * 3.5);
        if (!frozen) r.t -= dt;
        if (r.t <= 0) expire(r);
      }
    }
    for (i = 0; i < G.routes.length; i++) updFerry(G.routes[i].ferry, dt);
  }
  function beginDusk() {
    G.dusk = 0.0001; G.drag = null; G.sel = null;
    for (var i = 0; i < G.isl.length; i++) { var rq = G.isl[i].reqs; for (var k = 0; k < rq.length; k++) rq[k].dead = true; rq.length = 0; }
    for (i = 0; i < G.routes.length; i++) G.routes[i].ferry.cargo.length = 0;
    if (G.run.day > save.bestDay) save.bestDay = G.run.day;
    AU.play('chime');
  }

  // ---------- harbor (between days) ----------
  function calmCandidates() {
    var out = [];
    for (var i = 0; i < G.active; i++) if (G.run.calm.indexOf(i) < 0) out.push(i);
    return out;
  }
  function genCards() {
    var run = G.run;
    var r = IF.rng((run.seed ^ Math.imul(run.day + 1, 7919) ^ Math.imul(run.rerolls + 1, 104729)) >>> 0);
    var cc = calmCandidates();
    var w = {
      ferry: 2.2 + (G.routes.length >= run.ferries ? 1.6 : 0) + (run.ferries < 4 ? 1 : 0),
      speed: run.up.spd < 4 ? 1.4 : 0, hold: run.up.cap < 3 ? 1.3 : 0, calm: cc.length ? 1 : 0,
      light: run.up.light ? 0 : 0.9, heart: run.maxHearts < MAX_HEARTS ? 1.1 : 0,
      docks: run.up.prod < 3 ? 1 : 0, crew: run.up.dock < 2 ? 1 : 0
    };
    var out = [];
    for (var n = 0; n < 3; n++) {
      var tot = 0, k;
      for (k = 0; k < CARD_KEYS.length; k++) tot += w[CARD_KEYS[k]];
      if (tot <= 0) break;
      var pick = r() * tot, key = CARD_KEYS[0];
      for (k = 0; k < CARD_KEYS.length; k++) { pick -= w[CARD_KEYS[k]]; if (pick <= 0 && w[CARD_KEYS[k]] > 0) { key = CARD_KEYS[k]; break; } }
      w[key] = 0;
      out.push({ k: key, p: key === 'calm' ? cc[Math.floor(r() * cc.length)] : -1 });
    }
    while (out.length < 3) out.push({ k: 'ferry', p: -1 });
    return out;
  }
  function enterHarbor(fromSave) {
    var run = G.run;
    run.hb = 1;
    if (!fromSave) run.rerolls = 0;
    HB = { cards: genCards(), t: 0, pick: -1, pickT: 0 };
    scene = 'harbor'; G.dusk = 0; menuOpen = false; needTap = false; toast.t = 0;
    AU.ambience(false);
    clearFx();
    if (!fromSave) snapshot();
  }
  function rerollCost() { return 10 + 5 * G.run.rerolls; }
  function heartCost() { return 50 + 30 * G.run.buys; }
  function buyHeart() {
    if (!HB || HB.pick >= 0) return;
    var run = G.run, cost = heartCost();
    if (run.hearts >= run.maxHearts || run.coins < cost) { AU.play('deny'); return; }
    run.coins -= cost; run.buys++; run.hearts++;
    HB.heartPop = 0.6;
    AU.play('heart');
    snapshot();
  }
  function reroll() {
    if (!HB || HB.pick >= 0) return;
    var cost = rerollCost();
    if (G.run.coins < cost) { AU.play('deny'); showToast(t('coins') + ': ' + G.run.coins + ' / ' + cost, 1.6); return; }
    G.run.coins -= cost; G.run.rerolls++;
    HB.cards = genCards(); HB.t = 0;
    AU.play('tick');
    snapshot();
  }
  function pickCard(i) {
    if (!HB || HB.pick >= 0 || i < 0 || i > 2 || !HB.cards[i]) return;
    HB.pick = i; HB.pickT = 0;
    AU.play('card');
  }
  function applyCard(c) {
    var run = G.run;
    if (c.k === 'ferry') run.ferries++;
    else if (c.k === 'speed') run.up.spd++;
    else if (c.k === 'hold') run.up.cap++;
    else if (c.k === 'calm') { if (run.calm.indexOf(c.p) < 0) run.calm.push(c.p); }
    else if (c.k === 'light') run.up.light = 1;
    else if (c.k === 'heart') { run.maxHearts = Math.min(MAX_HEARTS, run.maxHearts + 1); run.hearts = Math.min(run.maxHearts, run.hearts + 1); }
    else if (c.k === 'docks') run.up.prod++;
    else if (c.k === 'crew') run.up.dock++;
  }
  function updateHarbor(dt) {
    if (!HB) return;
    HB.t += dt;
    HB.heartPop = Math.max(0, (HB.heartPop || 0) - dt);
    if (HB.pick >= 0) {
      HB.pickT += dt;
      if (HB.pickT > 0.55) {
        applyCard(HB.cards[HB.pick]);
        var run = G.run;
        run.day++; run.hb = 0; run.rerolls = 0;
        HB = null;
        layout();
        startDay(true);
        snapshot();
      }
    }
  }

  function endRun() {
    var run = G.run, isBest = run.deliveries > save.best;
    if (isBest) { save.best = run.deliveries; PlayablesSDK.sendScore(save.best); }
    if (run.day > save.bestDay) save.bestDay = run.day;
    save.run = null;
    persist();
    OV = { n: run.deliveries, day: run.day, coins: run.coins, best: isBest, t: 0 };
    scene = 'over'; menuOpen = false; needTap = false;
    AU.ambience(false); AU.play('over');
  }
  function goTitle() {
    scene = 'title'; G = null; HB = null; OV = null; menuOpen = false; needTap = false; titleSure = 0;
    AU.ambience(false); clearFx(); layout();
  }
  function abandonSaved() {
    if (save.run && num(save.run.n, 0, 1e9, 0) > save.best) { save.best = num(save.run.n, 0, 1e9, 0); PlayablesSDK.sendScore(save.best); }
    save.run = null;
  }
  function beginNewRun() {
    abandonSaved();
    var seed = (Math.floor(Math.random() * 4294967295) ^ Date.now()) >>> 0;
    startRun(newRunData(seed));
    snapshot();
  }
  function continueRun() {
    var run = unpackRun(save.run);
    if (!run) { save.run = null; beginNewRun(); return; }
    startRun(run);
  }
  function soundToggle() {
    save.snd = save.snd ? 0 : 1;
    applyAudio(); persist();
    AU.play('tick');
  }
  function applyAudio() { AU.setWanted(ytAudio && !!save.snd); }

  // ---------- hit tests ----------
  function islandAt(x, y, mult) {
    var best = -1, bd = 1e9;
    for (var i = 0; i < G.active; i++) {
      var isl = G.isl[i];
      if (isl.appear < 0.5) continue;
      ws(isl.x, isl.y, P1);
      var d = Math.hypot(P1.x - x, P1.y - y), rad = Math.max(isl.R * view.s * mult, 30);
      if (d < rad && d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function routeAt(x, y) {
    var best = null, bd = Math.max(18, U * 0.035);
    for (var r = 0; r < G.routes.length; r++) {
      var rt = G.routes[r];
      for (var l = 0; l < rt.legs.length; l++) {
        var lg = rt.legs[l];
        ws(lg.pts[0], lg.pts[1], P1);
        for (var j = 1; j < lg.n; j++) {
          ws(lg.pts[j * 2], lg.pts[j * 2 + 1], P2);
          var dx = P2.x - P1.x, dy = P2.y - P1.y, ll = dx * dx + dy * dy;
          var s = ll > 0 ? clamp(((x - P1.x) * dx + (y - P1.y) * dy) / ll, 0, 1) : 0;
          var d = Math.hypot(P1.x + dx * s - x, P1.y + dy * s - y);
          if (d < bd) { bd = d; best = rt; }
          P1.x = P2.x; P1.y = P2.y;
        }
      }
      ws(rt.ferry.x, rt.ferry.y, P1);
      var df = Math.hypot(P1.x - x, P1.y - y);
      if (df < bd) { bd = df; best = rt; }
    }
    return best;
  }

  // ---------- input ----------
  var dragId = null;
  function onDown(x, y, id) {
    if (!ready) return;
    if (scene === 'title') {
      if (inR(L.tSound, x, y)) { soundToggle(); return; }
      if (save.run) {
        if (inR(L.tPrimary, x, y)) { AU.play('tick'); continueRun(); return; }
        if (inR(L.tSecondary, x, y)) {
          if (titleSure > 0) { AU.play('tick'); beginNewRun(); } else { titleSure = 3; AU.play('tick'); }
          return;
        }
      } else if (inR(L.tPrimary, x, y)) { AU.play('tick'); beginNewRun(); return; }
      return;
    }
    if (scene === 'harbor') {
      if (inR(L.hHome, x, y)) { AU.play('tick'); goTitle(); return; }
      for (var i = 0; i < 3; i++) if (inR(L.cards[i], x, y)) { pickCard(i); return; }
      if (inR(L.hReroll, x, y)) reroll();
      if (inR(L.hHeart, x, y)) buyHeart();
      return;
    }
    if (scene === 'over') {
      if (OV && OV.t < 0.6) return;
      if (inR(L.oAgain, x, y)) { AU.play('tick'); beginNewRun(); return; }
      if (inR(L.oMenu, x, y)) { AU.play('tick'); goTitle(); return; }
      return;
    }
    if (scene !== 'play' || !G) return;
    if (needTap) { needTap = false; AU.play('tick'); return; }
    if (menuOpen) {
      if (inR(L.mResume, x, y)) { menuOpen = false; AU.play('tick'); }
      else if (inR(L.mSound, x, y)) soundToggle();
      else if (inR(L.mQuit, x, y)) { AU.play('tick'); goTitle(); }
      return;
    }
    if (G.dusk > 0) { if (G.dusk > 0.8) enterHarbor(false); return; }
    if (G.overT > 0) return;
    if (inR(L.pause, x, y)) { menuOpen = true; G.drag = null; AU.play('tick'); return; }
    if (G.sel) {
      if (inR(L.delBtn, x, y)) { removeRoute(G.sel); return; }
      if (inR(L.closeBtn, x, y)) { G.sel = null; AU.play('tick'); return; }
      if (inR(L.panel, x, y)) return;
    }
    var isl = islandAt(x, y, 1.45);
    if (isl >= 0) {
      if (freeFerries() <= 0) {
        var rt0 = routeAt(x, y);
        showToast(t('noFerry'), 2.4); G.ferryFlash = 1; AU.play('deny');
        if (rt0) G.sel = rt0;
        return;
      }
      G.sel = null;
      G.drag = { path: [isl], x: x, y: y, moved: false, sx: x, sy: y };
      dragId = id;
      AU.play('tick');
      return;
    }
    var rt = routeAt(x, y);
    if (rt) { G.sel = rt === G.sel ? null : rt; AU.play('tick'); return; }
    G.sel = null;
  }
  function onMove(x, y, id) {
    if (!G || !G.drag || id !== dragId) return;
    var d = G.drag;
    d.x = x; d.y = y;
    if (Math.hypot(x - d.sx, y - d.sy) > 8) d.moved = true;
    var isl = islandAt(x, y, 1.2);
    if (isl < 0) return;
    var path = d.path;
    if (path.length >= 2 && isl === path[path.length - 2]) { path.pop(); AU.play('tick'); return; }
    if (path.indexOf(isl) < 0 && path.length < MAX_STOPS) { path.push(isl); AU.play('tick'); }
  }
  function onUp(x, y, id) {
    if (!G || !G.drag || id !== dragId) return;
    var d = G.drag;
    G.drag = null; dragId = null;
    if (d.path.length >= 2) tryRoute(d.path);
    else if (!d.moved) {
      var rt = routeAt(x, y);
      if (rt) G.sel = rt;
    }
  }
  function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    AU.unlock();
    var p = pos(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    onDown(p.x, p.y, e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) { var p = pos(e); onMove(p.x, p.y, e.pointerId); });
  canvas.addEventListener('pointerup', function (e) { var p = pos(e); onUp(p.x, p.y, e.pointerId); });
  canvas.addEventListener('pointercancel', function () { if (G) G.drag = null; dragId = null; });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  window.addEventListener('keydown', function (e) {
    if (!ready) return;
    AU.unlock();
    var k = e.key;
    if (k === ' ' || k === 'Tab' || k === 'Backspace' || k.indexOf('Arrow') === 0) e.preventDefault();
    if (k === 'm' || k === 'M') { soundToggle(); return; }
    if (scene === 'title') {
      if (k === 'Enter' || k === ' ') { if (save.run) continueRun(); else beginNewRun(); }
      else if ((k === 'n' || k === 'N') && save.run) { if (titleSure > 0) beginNewRun(); else titleSure = 3; }
      return;
    }
    if (scene === 'harbor') {
      if (k === '1' || k === '2' || k === '3') pickCard(Number(k) - 1);
      else if (k === 'r' || k === 'R') reroll();
      else if (k === 'h' || k === 'H') buyHeart();
      else if (k === 'Escape') goTitle();
      return;
    }
    if (scene === 'over') {
      if (OV && OV.t < 0.6) return;
      if (k === 'Enter' || k === ' ') beginNewRun();
      else if (k === 'Escape') goTitle();
      return;
    }
    if (scene !== 'play' || !G) return;
    if (needTap) { needTap = false; return; }
    if (menuOpen) {
      if (k === 'Escape' || k === 'p' || k === 'P' || k === 'Enter' || k === ' ') menuOpen = false;
      else if (k === 'q' || k === 'Q') goTitle();
      return;
    }
    if (G.dusk > 0) { if ((k === 'Enter' || k === ' ') && G.dusk > 0.8) enterHarbor(false); return; }
    if (k === 'Escape' || k === 'p' || k === 'P') { menuOpen = true; G.drag = null; return; }
    if (k === 'Tab' && G.routes.length) {
      var idx = G.sel ? G.routes.indexOf(G.sel) : -1;
      G.sel = G.routes[(idx + 1) % G.routes.length];
    } else if ((k === 'Delete' || k === 'Backspace') && G.sel) removeRoute(G.sel);
  });

  // ---------- drawing helpers ----------
  function txt(s, x, y, px, col, align, weight) {
    ctx.font = IF.font(px, weight); ctx.fillStyle = col; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function fitTxt(s, x, y, maxW, px, col, align, weight) {
    IF.fitFont(ctx, s, maxW, px, weight);
    ctx.fillStyle = col; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function button(r, label, fill, shade, col, px, disabled) {
    var press = 0;
    ctx.globalAlpha = disabled ? 0.5 : 1;
    IF.panel(ctx, r.x, r.y + press, r.w, r.h, r.h / 2, fill, shade, Math.max(3, r.h * 0.09));
    fitTxt(label, r.x + r.w / 2, r.y + r.h / 2 + 1, r.w - 28, px || r.h * 0.4, col || C.ink, 'center', '800');
    ctx.globalAlpha = 1;
  }
  function pill(r) { IF.panel(ctx, r.x, r.y, r.w, r.h, r.h / 2, 'rgba(255,255,255,0.94)', C.shadow, 3); }
  function iconButton(r) { IF.panel(ctx, r.x, r.y, r.w, r.h, r.h / 2, 'rgba(255,255,255,0.94)', C.shadow, 3); }
  function veil(a) { ctx.fillStyle = 'rgba(61,59,84,' + a + ')'; ctx.fillRect(0, 0, W, H); }

  // ---------- play scene ----------
  function drawRoutes() {
    var lw = Math.max(3, U * 0.008);
    for (var r = 0; r < G.routes.length; r++) {
      var rt = G.routes[r], sel = rt === G.sel, w = sel ? lw * 1.6 : lw;
      ctx.beginPath();
      for (var l = 0; l < rt.legs.length; l++) {
        var lg = rt.legs[l];
        for (var j = 0; j < lg.n; j++) {
          ws(lg.pts[j * 2], lg.pts[j * 2 + 1], P1);
          if (j === 0) ctx.moveTo(P1.x, P1.y); else ctx.lineTo(P1.x, P1.y);
        }
      }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (sel) {
        ctx.globalAlpha = 0.3 + 0.15 * Math.sin(time * 5);
        ctx.strokeStyle = rt.col; ctx.lineWidth = w * 4.5; ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = w + 4; ctx.stroke();
      ctx.setLineDash([w * 2.4, w * 1.7]); ctx.lineDashOffset = -time * w * 4;
      ctx.strokeStyle = rt.col; ctx.lineWidth = w; ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  function drawGhosts() {
    if (!G.run.up.light) return;
    var nxt = islandsForDay(G.run.day + 1);
    for (var i = G.active; i < nxt; i++) {
      var isl = G.isl[i];
      ws(isl.x, isl.y, P1);
      var r = isl.R * view.s;
      ctx.globalAlpha = 0.55 + 0.15 * Math.sin(time * 2);
      IF.circle(ctx, P1.x, P1.y, r); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
      ctx.setLineDash([5, 5]); ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.setLineDash([]);
      IF.drawGood(ctx, isl.good, P1.x, P1.y, Math.max(9, r * 0.36));
      ctx.globalAlpha = 1;
      txt(t('tomorrow'), P1.x, P1.y + r + 12, 12, C.ink, 'center', '700');
    }
  }
  function drawIslands() {
    for (var i = 0; i < G.active; i++) {
      var isl = G.isl[i];
      ensureSprite(isl);
      ws(isl.x, isl.y, P1);
      var sc = isl.appear >= 1 ? 1 : Math.max(0, easeOutBack(isl.appear));
      if (sc <= 0.02) continue;
      var sh = isl.shake > 0 ? Math.sin(time * 60) * isl.shake * 6 : 0, hs = isl.spr.half;
      if (sc !== 1) {
        ctx.save(); ctx.translate(P1.x + sh, P1.y); ctx.scale(sc, sc);
        ctx.drawImage(isl.spr.cv, -hs, -hs, hs * 2, hs * 2); ctx.restore();
      } else ctx.drawImage(isl.spr.cv, P1.x - hs + sh, P1.y - hs, hs * 2, hs * 2);
    }
  }
  function drawBadges() {
    var sm = stockMax();
    for (var i = 0; i < G.active; i++) {
      var isl = G.isl[i];
      if (isl.appear < 0.3) continue;
      ws(isl.x, isl.y, P1);
      var rs = isl.R * view.s, rb = Math.max(10, rs * 0.38), sh = isl.shake > 0 ? Math.sin(time * 60) * isl.shake * 6 : 0;
      var bx = P1.x + sh, by = P1.y + rs * 0.04;
      IF.circle(ctx, bx, by + 2, rb); ctx.fillStyle = 'rgba(61,59,84,0.2)'; ctx.fill();
      IF.drawGood(ctx, isl.good, bx, by, rb);
      if (G.run.calm.indexOf(i) >= 0) {
        ctx.strokeStyle = C.mintDark; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(bx, by, rb + 3.5, 0, TAU); ctx.stroke();
      }
      var pr = Math.max(2.4, rb * 0.2), st = Math.floor(isl.stock + 1e-6);
      for (var k = 0; k < sm; k++) {
        var a = Math.PI / 2 + (k - (sm - 1) / 2) * 0.55;
        var px = bx + Math.cos(a) * (rb + pr * 2.1), py = by + Math.sin(a) * (rb + pr * 2.1);
        IF.circle(ctx, px, py, pr);
        ctx.fillStyle = k < st ? IF.GOODS[isl.good].dark : 'rgba(255,255,255,0.7)'; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(61,59,84,0.5)'; ctx.stroke();
      }
    }
  }
  function drawFerries() {
    var bl = clamp(IR * view.s * 0.8, 18, 40);
    for (var i = 0; i < G.routes.length; i++) {
      var f = G.routes[i].ferry;
      ws(f.x, f.y, P1);
      var a = f.ang + (view.rot ? Math.PI / 2 : 0);
      var bob = Math.sin(time * 3 + f.bob) * 0.06;
      IF.drawBoat(ctx, P1.x, P1.y, a + bob, bl, f.rt.col, f.cargo, f.cargo.length);
    }
  }
  function bubbleRadius() { return clamp(U * 0.038, 15, 24); }
  function drawBubbles() {
    var br = bubbleRadius(), top = L.hudH + 4;
    for (var i = 0; i < G.active; i++) {
      var isl = G.isl[i], n = isl.reqs.length;
      if (!n) continue;
      ws(isl.x, isl.y, P1);
      var rs = isl.R * view.s, below = false;
      var by = P1.y - rs * 0.92 - br * 1.25;
      if (by - br < top) { by = P1.y + rs * 0.92 + br * 1.25; below = true; }
      for (var k = 0; k < n; k++) {
        var r = isl.reqs[k];
        var bx = clamp(P1.x + (k - (n - 1) / 2) * (br * 2 + 6), br + 6, W - br - 6);
        drawBubble(r, bx, by, br, P1.x, below);
      }
    }
  }
  function drawBubble(r, x, y, br, ix, below) {
    var frac = clamp(r.t / r.max, 0, 1);
    var sc = r.pop < 1 ? Math.max(0.01, easeOutBack(r.pop)) : 1;
    if (frac < 0.3) sc *= 1 + 0.07 * Math.sin(time * 12);
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    // tail
    var tx = clamp((ix - x) * 0.4, -br * 0.5, br * 0.5), dir = below ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(-br * 0.35, dir * br * 0.6); ctx.lineTo(tx, dir * br * 1.35); ctx.lineTo(br * 0.35, dir * br * 0.6); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(61,59,84,0.55)'; ctx.stroke();
    IF.circle(ctx, 0, 2.5, br); ctx.fillStyle = 'rgba(61,59,84,0.18)'; ctx.fill();
    IF.circle(ctx, 0, 0, br); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(61,59,84,0.55)'; ctx.stroke();
    var rw = Math.max(3, br * 0.2);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, br - rw * 0.9, 0, TAU); ctx.strokeStyle = 'rgba(61,59,84,0.1)'; ctx.lineWidth = rw; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, br - rw * 0.9, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
    ctx.strokeStyle = frac > 0.5 ? '#4FC197' : frac > 0.25 ? '#F2B83F' : C.coral; ctx.stroke();
    IF.drawGood(ctx, r.good, 0, 0, br * 0.56);
    if (r.res) {
      var cx = br * 0.72, cy = br * 0.72, cr = Math.max(6, br * 0.36);
      IF.circle(ctx, cx, cy, cr); ctx.fillStyle = r.res.rt.col; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - cr * 0.45, cy); ctx.lineTo(cx - cr * 0.1, cy + cr * 0.35); ctx.lineTo(cx + cr * 0.45, cy - cr * 0.35);
      ctx.lineWidth = Math.max(1.5, cr * 0.28); ctx.strokeStyle = '#fff'; ctx.stroke();
    }
    ctx.restore();
  }
  function drawDrag() {
    var d = G.drag;
    if (!d) return;
    var used = {}, ci = 0, i;
    for (i = 0; i < G.routes.length; i++) used[G.routes[i].ci] = 1;
    while (used[ci]) ci++;
    var col = ROUTE_COLS[ci % ROUTE_COLS.length], lw = Math.max(4, U * 0.01);
    ctx.beginPath();
    for (i = 0; i < d.path.length; i++) {
      var isl = G.isl[d.path[i]];
      ws(isl.x, isl.y, P1);
      if (i === 0) ctx.moveTo(P1.x, P1.y); else ctx.lineTo(P1.x, P1.y);
    }
    ctx.lineTo(d.x, d.y);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = lw + 5; ctx.stroke();
    ctx.setLineDash([lw * 2, lw * 1.6]); ctx.lineDashOffset = -time * 30;
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); ctx.setLineDash([]);
    for (i = 0; i < d.path.length; i++) {
      var s = G.isl[d.path[i]];
      ws(s.x, s.y, P1);
      ctx.beginPath(); ctx.arc(P1.x, P1.y, s.R * view.s * 1.12, 0, TAU);
      ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke();
      IF.circle(ctx, P1.x + s.R * view.s * 0.8, P1.y - s.R * view.s * 0.8, 10); ctx.fillStyle = col; ctx.fill();
      txt(String(i + 1), P1.x + s.R * view.s * 0.8, P1.y - s.R * view.s * 0.8 + 0.5, 12, '#fff', 'center', '800');
    }
    IF.circle(ctx, d.x, d.y, lw * 1.4); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  }
  function drawParticles(kind) {
    for (var i = 0; i < PN; i++) {
      var p = parts[i];
      if (!p.on || p.kind !== kind) continue;
      ws(p.x, p.y, P1);
      var f = p.life / p.max;
      if (kind === 1) {
        ctx.globalAlpha = f * 0.65;
        IF.circle(ctx, P1.x, P1.y, Math.max(1, p.size * view.s * (1.5 - f * 0.7))); ctx.fillStyle = p.col; ctx.fill();
      } else {
        ctx.globalAlpha = Math.min(1, f * 1.6);
        IF.circle(ctx, P1.x, P1.y, Math.max(1, p.size * view.s * (0.4 + f * 0.6))); ctx.fillStyle = p.col; ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawPops() {
    var px = clamp(U * 0.042, 15, 24);
    for (var i = 0; i < POPN; i++) {
      var p = pops[i];
      if (!p.on) continue;
      ws(p.x, p.y, P1);
      var k = p.t / 1.3, y = P1.y - k * 40, a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.globalAlpha = Math.max(0, a);
      var sc = p.t < 0.2 ? easeOutBack(p.t / 0.2) : 1;
      if (p.kind === 0) {
        ctx.font = IF.font(px * sc, '800');
        var tw = ctx.measureText(p.txt).width, cw = px * 0.95;
        var x0 = P1.x - (tw + cw + 4) / 2;
        IF.drawCoin(ctx, x0 + cw / 2, y, cw / 2 * sc);
        ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        ctx.strokeText(p.txt, x0 + cw + 4, y); ctx.fillStyle = C.ink; ctx.fillText(p.txt, x0 + cw + 4, y);
      } else if (p.kind === 1) {
        IF.drawHeart(ctx, P1.x, y, px * 1.3 * sc, false);
        IF.drawX(ctx, P1.x, y, px * 0.9, C.coral);
      } else {
        IF.drawHeart(ctx, P1.x, y, px * 1.3 * sc, true);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    var run = G.run, i;
    // pause
    iconButton(L.pause); IF.drawPauseIcon(ctx, L.pause.x + 22, L.pause.y + 22, 22);
    // hearts
    var hp = L.heartPill;
    hp.w = 14 + run.maxHearts * 19;
    pill(hp);
    var hs = 17, shake = G.heartShake > 0 ? Math.sin(time * 50) * G.heartShake * 4 : 0;
    for (i = 0; i < run.maxHearts; i++) {
      var gx = hp.x + 16 + i * 19, gy = hp.y + hp.h / 2 - 2;
      var sc = (G.heartGain > 0 && i === run.hearts - 1) ? 1 + G.heartGain * 0.5 : 1;
      IF.drawHeart(ctx, gx + (i === run.hearts ? shake : 0), gy, hs * sc, i < run.hearts);
    }
    var bw = hp.w - 24;
    IF.rr(ctx, hp.x + 12, hp.y + hp.h - 7, bw, 3, 1.5); ctx.fillStyle = 'rgba(61,59,84,0.1)'; ctx.fill();
    IF.rr(ctx, hp.x + 12, hp.y + hp.h - 7, bw * run.rep / REP_PER_HEART, 3, 1.5); ctx.fillStyle = C.pink; ctx.fill();
    // day + sun arc
    var dp = L.dayPill, frac = clamp(G.dayT / DAY_LEN, 0, 1);
    pill(dp);
    var acx = dp.x + 30, acy = dp.y + dp.h * 0.72, ar = 17;
    ctx.beginPath(); ctx.arc(acx, acy, ar, Math.PI, TAU);
    ctx.setLineDash([3, 3]); ctx.lineWidth = 2; ctx.strokeStyle = C.inkSoft; ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(acx - ar - 4, acy); ctx.lineTo(acx + ar + 4, acy); ctx.lineWidth = 2; ctx.strokeStyle = C.inkSoft; ctx.stroke();
    var sa = Math.PI + frac * Math.PI;
    IF.drawSun(ctx, acx + Math.cos(sa) * ar, acy + Math.sin(sa) * ar, 5.5, time * 0.5, frac > 0.8 ? '#FFB07A' : '#FFD772');
    fitTxt(t('day', run.day), dp.x + 58 + (dp.w - 58 - 10) / 2, dp.y + dp.h / 2 + 1, dp.w - 58 - 10, 18, C.ink, 'center', '800');
    // score
    var sp = L.scorePill;
    pill(sp);
    IF.drawCrate(ctx, sp.x + 22, sp.y + sp.h / 2, 18, '#F2CF9B');
    fitTxt(String(run.deliveries), sp.x + 38 + (sp.w - 46) / 2, sp.y + sp.h / 2 + 1, sp.w - 46, 20, C.ink, 'center', '800');
    // coins
    var cp = L.coinPill;
    pill(cp);
    IF.drawCoin(ctx, cp.x + 20, cp.y + cp.h / 2, 9);
    fitTxt(String(run.coins), cp.x + 34 + (cp.w - 42) / 2, cp.y + cp.h / 2 + 1, cp.w - 42, 17, C.ink, 'center', '800');
    // ferries
    var fp = L.ferryPill, free = freeFerries();
    if (G.ferryFlash > 0) {
      IF.panel(ctx, fp.x, fp.y, fp.w, fp.h, fp.h / 2, Math.sin(time * 20) > 0 ? C.coral : '#fff', C.shadow, 3);
    } else pill(fp);
    IF.drawBoat(ctx, fp.x + 22, fp.y + fp.h / 2, -0.15, 24, free > 0 ? C.mintDark : C.inkSoft, null, 0);
    ctx.font = IF.font(17, '800'); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink; var ft = String(free);
    ctx.fillText(ft, fp.x + 40, fp.y + fp.h / 2 + 1);
    var fw = ctx.measureText(ft).width;
    txt('/' + run.ferries, fp.x + 41 + fw, fp.y + fp.h / 2 + 2, 12, C.inkSoft, 'left', '700');
  }
  function drawRoutePanel() {
    var rt = G.sel;
    if (!rt) return;
    var p = L.panel;
    IF.panel(ctx, p.x, p.y, p.w, p.h, 18, 'rgba(255,255,255,0.96)', C.shadow, 4);
    IF.circle(ctx, p.x + 26, p.y + p.h / 2, 11); ctx.fillStyle = rt.col; ctx.fill();
    var avail = L.delBtn.x - (p.x + 46) - 6, n = rt.stops.length;
    var gr = clamp(avail / (n * 2.6), 7, 13), gx = p.x + 46 + gr;
    for (var i = 0; i < n; i++) {
      if (i) {
        ctx.strokeStyle = rt.col; ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(gx - gr * 1.6 + gr, p.y + p.h / 2); ctx.lineTo(gx - gr, p.y + p.h / 2); ctx.stroke(); ctx.setLineDash([]);
      }
      IF.drawGood(ctx, G.isl[rt.stops[i]].good, gx, p.y + p.h / 2, gr);
      gx += gr * 2.6;
    }
    var db = L.delBtn;
    IF.panel(ctx, db.x, db.y, db.w, db.h, db.h / 2, C.coral, C.coralDark, 3);
    IF.drawTrash(ctx, db.x + 22, db.y + db.h / 2, 20, '#fff');
    fitTxt(t('remove'), db.x + 38 + (db.w - 46) / 2, db.y + db.h / 2 + 1, db.w - 46, 16, '#fff', 'center', '800');
    var cb = L.closeBtn;
    IF.panel(ctx, cb.x, cb.y, cb.w, cb.h, cb.h / 2, '#F1EDF7', 'rgba(61,59,84,0.12)', 3);
    IF.drawX(ctx, cb.x + 22, cb.y + 22, 20, C.ink);
  }
  function hintPill(str, good, yBottom, alpha) {
    var maxW = Math.min(W - 40, 600), px = clamp(U * 0.04, 14, 18);
    var lay = IF.richLayout(ctx, str, maxW - 28, px, '700');
    var h = lay.lines.length * lay.lh + 18, w = Math.max(lay.w + 30, 120);
    var x = (W - w) / 2, y = yBottom - h;
    ctx.globalAlpha = alpha;
    IF.panel(ctx, x, y, w, h, Math.min(22, h / 2), 'rgba(255,255,255,0.96)', C.shadow, 4);
    IF.richDraw(ctx, lay, W / 2, y + 9, good, C.ink);
    ctx.globalAlpha = 1;
    return y;
  }
  function drawTutorial() {
    var base = G.sel ? L.panel.y - 10 : H - 16;
    if (G.tut && G.tut.step === 0) {
      hintPill(t('tut1'), G.isl[0].good, base, 1);
      // animated hand: island 0 -> island 1
      var A = G.isl[0], B = G.isl[1];
      ws(A.x, A.y, P1); ws(B.x, B.y, P2);
      var cyc = (time % 2.6) / 2.6, k, press = cyc > 0.1 && cyc < 0.8;
      if (cyc < 0.15) k = 0; else if (cyc < 0.75) { k = (cyc - 0.15) / 0.6; k = k * k * (3 - 2 * k); } else k = 1;
      var hx = P1.x + (P2.x - P1.x) * k, hy = P1.y + (P2.y - P1.y) * k;
      if (press && !G.drag) {
        ctx.setLineDash([6, 6]); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(P1.x, P1.y); ctx.lineTo(hx, hy); ctx.stroke(); ctx.setLineDash([]);
        IF.circle(ctx, hx, hy, 12 + Math.sin(time * 10) * 2); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
      }
      ctx.globalAlpha = cyc > 0.9 ? 1 - (cyc - 0.9) / 0.1 : 1;
      if (!G.drag) IF.drawHand(ctx, hx, hy, clamp(U * 0.1, 34, 54), press);
      ctx.globalAlpha = 1;
    } else if (G.tut && G.tut.step === 1) {
      hintPill(t('tut2'), 0, base, 1);
    } else if (G.tutT > 0) {
      hintPill(t('tut3'), 0, base, Math.min(1, G.tutT));
    }
  }
  function drawBanner() {
    if (G.banner <= 0) return;
    var k = G.banner, a = k > 2.4 ? (2.8 - k) / 0.4 : k < 0.5 ? k / 0.5 : 1;
    var cy = L.map.y + L.map.h * 0.3, px = clamp(U * 0.11, 34, 64);
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.font = IF.font(px, '900'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    var s = t('day', G.run.day);
    ctx.lineWidth = px * 0.16; ctx.strokeStyle = C.ink; ctx.strokeText(s, W / 2, cy + px * 0.06);
    ctx.fillStyle = '#fff'; ctx.fillText(s, W / 2, cy);
    if (G.bannerNew) {
      var sp = clamp(U * 0.04, 14, 20);
      var lay = IF.richLayout(ctx, t('newIsland'), W - 60, sp, '800');
      var bw = lay.w + 30, bh = lay.lines.length * lay.lh + 12;
      IF.panel(ctx, (W - bw) / 2, cy + px * 0.7, bw, bh, bh / 2, C.butter, '#E9C66A', 3);
      IF.richDraw(ctx, lay, W / 2, cy + px * 0.7 + 6, 0, C.ink);
    }
    ctx.globalAlpha = 1;
  }
  function drawDusk() {
    var a = Math.min(1, G.dusk / 0.6);
    ctx.fillStyle = 'rgba(255,170,150,' + (0.28 * a) + ')'; ctx.fillRect(0, 0, W, H);
    var pw = Math.min(330, W - 40), ph = 210, x = (W - pw) / 2, y = (H - ph) / 2 - 10 + (1 - a) * 30;
    ctx.globalAlpha = a;
    IF.panel(ctx, x, y, pw, ph, 26, '#FFFDF9', C.shadow, 6);
    IF.drawSun(ctx, x + pw / 2, y + 2, 16, time * 0.4, '#FFB07A');
    fitTxt(t('dayDone', G.run.day), x + pw / 2, y + 48, pw - 40, 26, C.ink, 'center', '900');
    var cols = [x + pw * 0.2, x + pw * 0.5, x + pw * 0.8], ry = y + 106;
    IF.drawCrate(ctx, cols[0], ry - 14, 26, '#F2CF9B'); txt(String(G.run.dayDeliv), cols[0], ry + 22, 22, C.ink, 'center', '800');
    IF.drawCoin(ctx, cols[1], ry - 14, 13); txt(String(G.run.coins), cols[1], ry + 22, 22, C.ink, 'center', '800');
    IF.drawHeart(ctx, cols[2], ry - 14, 26, true); txt(G.run.hearts + '/' + G.run.maxHearts, cols[2], ry + 22, 22, C.ink, 'center', '800');
    if (G.dusk > 0.8) txt(t('tapSkip'), x + pw / 2, y + ph - 26, 14, C.inkSoft, 'center', '700');
    ctx.globalAlpha = 1;
  }
  function drawMenu() {
    veil(0.38);
    var p = L.mPanel;
    IF.panel(ctx, p.x, p.y, p.w, p.h, 26, '#FFFDF9', C.shadow, 6);
    fitTxt(t('paused'), p.x + p.w / 2, p.y + 38, p.w - 40, 28, C.ink, 'center', '900');
    button(L.mResume, t('resume'), C.mint, C.mintDark, C.ink, 20);
    button(L.mSound, save.snd ? t('soundOn') : t('soundOff'), '#fff', 'rgba(61,59,84,0.18)', C.ink, 18);
    IF.drawSpeaker(ctx, L.mSound.x + 30, L.mSound.y + L.mSound.h / 2, 20, !!save.snd);
    button(L.mQuit, t('quit'), C.peach, '#E99683', C.ink, 18);
  }
  function drawTapOverlay() {
    veil(0.35);
    var w = Math.min(320, W - 48), h = 74, x = (W - w) / 2, y = (H - h) / 2;
    var s = 1 + Math.sin(time * 3) * 0.02;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
    IF.panel(ctx, x, y, w, h, h / 2, '#fff', C.shadow, 5);
    IF.circle(ctx, x + 40, y + h / 2, 22); ctx.fillStyle = C.coral; ctx.fill();
    IF.drawPlayIcon(ctx, x + 42, y + h / 2, 20, '#fff');
    fitTxt(t('tapCont'), x + 70 + (w - 86) / 2, y + h / 2 + 1, w - 86, 21, C.ink, 'center', '800');
    ctx.restore();
  }
  function drawPlay(noUi) {
    IF.drawSea(ctx, 0, 0, W, H, time, U);
    drawGhosts();
    drawRoutes();
    drawParticles(1);
    drawIslands();
    drawFerries();
    drawBadges();
    drawBubbles();
    drawDrag();
    drawParticles(0);
    drawPops();
    var frac = G.dayT / DAY_LEN;
    if (frac > 0.8 && !G.dusk) { ctx.fillStyle = 'rgba(255,170,150,' + ((frac - 0.8) / 0.2 * 0.16) + ')'; ctx.fillRect(0, 0, W, H); }
    if (noUi) return;
    drawHUD();
    drawRoutePanel();
    drawTutorial();
    drawBanner();
    if (G.dusk > 0) drawDusk();
    if (G.overT > 0) { ctx.fillStyle = 'rgba(61,59,84,' + (0.3 * (1 - G.overT / 1.4)) + ')'; ctx.fillRect(0, 0, W, H); }
    if (menuOpen) drawMenu();
    if (needTap) drawTapOverlay();
  }

  // ---------- title ----------
  var titleIslands = null;
  function drawTitle() {
    var narrow = W < H * 1.1;
    var hz = narrow ? H * 0.4 : H * 0.42;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, hz + 2);
    // clouds
    for (var c = 0; c < 3; c++) {
      var cx = ((c * 0.37 + 0.1) * W + time * (6 + c * 3)) % (W + 160) - 80, cy = hz * (0.18 + c * 0.22), cs = U * (0.05 + c * 0.012);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.ellipse(cx, cy, cs * 1.6, cs * 0.55, 0, 0, TAU); ctx.fill();
      IF.circle(ctx, cx - cs * 0.4, cy - cs * 0.35, cs * 0.55); ctx.fill();
      IF.circle(ctx, cx + cs * 0.35, cy - cs * 0.4, cs * 0.7); ctx.fill();
    }
    // logo geometry
    var lines = narrow ? ['Island', 'Ferry'] : ['Island Ferry'];
    var fs = narrow ? Math.min(W * 0.22, H * 0.1) : Math.min(W * 0.09, H * 0.15);
    var ly = narrow ? hz * 0.38 : hz * 0.48;
    if (narrow) IF.drawSun(ctx, Math.min(W * 0.72, W - 110), ly - fs * 0.95, fs * 0.28, time * 0.2, '#FFD772');
    else IF.drawSun(ctx, W / 2 + Math.min(W * 0.3, fs * 2.7), ly - fs * 1.05, fs * 0.34, time * 0.2, '#FFD772');
    // sea
    IF.drawSea(ctx, 0, hz, W, H - hz, time, U);
    ctx.fillStyle = '#93C6EA'; ctx.fillRect(0, hz, W, 3);
    ctx.fillStyle = '#CDC3F3';
    ctx.beginPath(); ctx.ellipse(W * 0.12, hz, U * 0.12, U * 0.035, 0, Math.PI, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(W * 0.86, hz, U * 0.09, U * 0.028, 0, Math.PI, TAU); ctx.fill();
    // decorative islands + ferry
    var ir = U * (narrow ? 0.12 : 0.1);
    if (!titleIslands || titleIslands.r !== ir || titleIslands.d !== DPR) {
      titleIslands = { r: ir, d: DPR, a: IF.renderIsland(777, ir, DPR), b: IF.renderIsland(4242, ir * 0.85, DPR) };
    }
    var ax = narrow ? W * 0.2 : W * 0.13, ay = narrow ? H * 0.84 : H * 0.76;
    var bx = narrow ? W * 0.8 : W * 0.87, by = narrow ? H * 0.78 : H * 0.66;
    var qx = (ax + bx) / 2, qy = Math.max(ay, by) + U * 0.1;
    function qp(s, out) {
      var a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, cc = s * s;
      out.x = a * ax + b * qx + cc * bx; out.y = a * ay + b * qy + cc * by; return out;
    }
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(qx, qy, bx, by);
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 8; ctx.stroke();
    ctx.setLineDash([10, 8]); ctx.lineDashOffset = -time * 14; ctx.strokeStyle = ROUTE_COLS[0]; ctx.lineWidth = 4; ctx.stroke(); ctx.setLineDash([]);
    var ph = (time * 0.12) % 2, s = ph < 1 ? ph : 2 - ph;
    s = 0.18 + 0.64 * (s * s * (3 - 2 * s));
    qp(s, P1); qp(s + (ph < 1 ? 0.01 : -0.01), P2);
    ctx.drawImage(titleIslands.a.cv, ax - titleIslands.a.half, ay - titleIslands.a.half, titleIslands.a.half * 2, titleIslands.a.half * 2);
    ctx.drawImage(titleIslands.b.cv, bx - titleIslands.b.half, by - titleIslands.b.half, titleIslands.b.half * 2, titleIslands.b.half * 2);
    IF.drawGood(ctx, 0, ax, ay, ir * 0.36);
    IF.drawGood(ctx, 1, bx, by, ir * 0.32);
    IF.drawBoat(ctx, P1.x, P1.y, Math.atan2(P2.y - P1.y, P2.x - P1.x), clamp(ir * 0.75, 22, 50), ROUTE_COLS[0], null, 0);
    // logo
    drawLogo(lines, fs, ly);
    var tagY = ly + (lines.length - 1) * fs * 1.0 + fs * 0.78;
    fitTxt(t('tag'), W / 2, tagY, W - 48, clamp(fs * 0.24, 13, 22), C.inkSoft, 'center', '700');
    // buttons
    if (save.run) {
      button(L.tPrimary, t('contDay', num(save.run.d, 1, 999, 1) + (save.run.hb ? 1 : 0)), C.coral, C.coralDark, '#fff', 22);
      button(L.tSecondary, titleSure > 0 ? t('sure') : t('newRun'), '#fff', 'rgba(61,59,84,0.18)', C.ink, 17);
    } else {
      button(L.tPrimary, t('play'), C.coral, C.coralDark, '#fff', 26);
      IF.drawPlayIcon(ctx, L.tPrimary.x + 34, L.tPrimary.y + L.tPrimary.h / 2, 20, '#fff');
    }
    iconButton(L.tSound); IF.drawSpeaker(ctx, L.tSound.x + 22, L.tSound.y + 22, 22, !!save.snd);
    // bests
    if (save.best > 0 || save.bestDay > 1) {
      var y = H - 16 - 40, pw2 = 112, gap = 10, x = W / 2 - pw2 - gap / 2;
      if (L.tSecondary.y + L.tSecondary.h + 16 > y && !save.run) y = L.tPrimary.y + L.tPrimary.h + 24;
      var r1 = { x: x, y: y, w: pw2, h: 40 }, r2 = { x: W / 2 + gap / 2, y: y, w: pw2, h: 40 };
      pill(r1); pill(r2);
      IF.drawCrate(ctx, r1.x + 22, r1.y + 20, 18, '#F2CF9B');
      fitTxt(String(save.best), r1.x + 40 + (pw2 - 50) / 2, r1.y + 21, pw2 - 50, 18, C.ink, 'center', '800');
      IF.drawSun(ctx, r2.x + 22, r2.y + 20, 6, 0, '#FFD772');
      fitTxt(t('day', Math.max(1, save.bestDay)), r2.x + 40 + (pw2 - 50) / 2, r2.y + 21, pw2 - 50, 16, C.ink, 'center', '800');
    }
  }
  var LOGO_COLS = ['#FFB4A2', '#9EE0C5', '#A7D3F5', '#B9A7F5', '#FFE39A', '#F7A1C4'];
  function drawLogo(lines, fs, y0) {
    ctx.font = IF.font(fs, '900'); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
    var ci = 0;
    for (var l = 0; l < lines.length; l++) {
      var s = lines[l], tw = ctx.measureText(s).width, x = (W - tw) / 2, y = y0 + l * fs * 1.0;
      for (var i = 0; i < s.length; i++) {
        var ch = s[i], cw = ctx.measureText(ch).width;
        if (ch !== ' ') {
          var yy = y + Math.sin(time * 2 + ci * 0.6) * fs * 0.035;
          ctx.fillStyle = 'rgba(61,59,84,0.22)'; ctx.fillText(ch, x + fs * 0.03, yy + fs * 0.09);
          ctx.lineWidth = fs * 0.13; ctx.strokeStyle = C.ink; ctx.strokeText(ch, x, yy);
          ctx.fillStyle = LOGO_COLS[ci % LOGO_COLS.length]; ctx.fillText(ch, x, yy);
          ci++;
        }
        x += cw;
      }
    }
  }

  // ---------- harbor ----------
  function drawHarbor() {
    var run = G.run, wy = L.waterY;
    var g = ctx.createLinearGradient(0, 0, 0, wy);
    g.addColorStop(0, '#FFF4E8'); g.addColorStop(0.65, '#FFE0D2'); g.addColorStop(1, '#FBCFD6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, wy + 2);
    // setting sun
    IF.circle(ctx, W * 0.84, wy, U * 0.1); ctx.fillStyle = 'rgba(255,196,140,0.6)'; ctx.fill();
    IF.drawSea(ctx, 0, wy, W, H - wy, time, U, '#B5C9EE', '#D8E2F8');
    // pier
    var py = wy + 6;
    ctx.fillStyle = '#C99A6A'; for (var x = 30; x < W; x += 70) { IF.rr(ctx, x, py, 8, 34, 3); ctx.fill(); }
    IF.panel(ctx, -10, py - 10, W + 20, 14, 4, '#E2B783', '#B98A55', 4);
    // moored ferries
    var n = Math.min(run.ferries, 10), sp = Math.min(90, (W - 40) / Math.max(1, n));
    for (var i = 0; i < n; i++) {
      var bx = W / 2 + (i - (n - 1) / 2) * sp, by = py + 42 + Math.sin(time * 1.6 + i) * 3;
      if (by < H - 10) IF.drawBoat(ctx, bx, by, Math.sin(time + i) * 0.04, clamp(sp * 0.7, 26, 52), ROUTE_COLS[i % ROUTE_COLS.length], null, 0);
    }
    if (run.up.light) IF.drawUpIcon(ctx, 'light', W - 30, wy - 12, 18);
    // home
    iconButton(L.hHome);
    ctx.fillStyle = C.ink; ctx.beginPath();
    var hx = L.hHome.x + 22, hy = L.hHome.y + 23;
    ctx.moveTo(hx - 10, hy - 1); ctx.lineTo(hx, hy - 10); ctx.lineTo(hx + 10, hy - 1); ctx.lineTo(hx + 7, hy - 1); ctx.lineTo(hx + 7, hy + 9);
    ctx.lineTo(hx - 7, hy + 9); ctx.lineTo(hx - 7, hy - 1); ctx.closePath(); ctx.fill();
    // titles
    fitTxt(t('dayDone', run.day), W / 2, L.hTitleY, W - 140, clamp(U * 0.075, 24, 36), C.ink, 'center', '900');
    fitTxt(t('pick'), W / 2, L.hSubY, W - 48, clamp(U * 0.045, 15, 20), C.inkSoft, 'center', '700');
    // stats row
    var sy = L.hStatsY, sw = 86, sx = W / 2 - (sw * 3 + 16) / 2;
    var r1 = { x: sx, y: sy, w: sw, h: 32 }, r2 = { x: sx + sw + 8, y: sy, w: sw, h: 32 }, r3 = { x: sx + 2 * (sw + 8), y: sy, w: sw, h: 32 };
    pill(r1); pill(r2); pill(r3);
    IF.drawCrate(ctx, r1.x + 18, sy + 16, 15, '#F2CF9B'); fitTxt(String(run.deliveries), r1.x + 52, sy + 17, 46, 16, C.ink, 'center', '800');
    IF.drawCoin(ctx, r2.x + 18, sy + 16, 8); fitTxt(String(run.coins), r2.x + 52, sy + 17, 46, 16, C.ink, 'center', '800');
    IF.drawHeart(ctx, r3.x + 18, sy + 15, 15, true); fitTxt(run.hearts + '/' + run.maxHearts, r3.x + 52, sy + 17, 46, 16, C.ink, 'center', '800');
    // cards
    for (var k = 0; k < 3; k++) drawCard(k);
    // reroll
    var busy = HB && HB.pick >= 0;
    costButton(L.hReroll, t('reroll'), false, rerollCost(), run.coins < rerollCost() || busy);
    costButton(L.hHeart, '+1', true, heartCost(), run.coins < heartCost() || run.hearts >= run.maxHearts || busy);
  }
  function costButton(rr, lab, heart, cost, dis) {
    ctx.globalAlpha = dis ? 0.5 : 1;
    IF.panel(ctx, rr.x, rr.y, rr.w, rr.h, rr.h / 2, '#fff', 'rgba(61,59,84,0.18)', 4);
    var px = IF.fitFont(ctx, lab, rr.w - 80, 17, '800');
    var lw = ctx.measureText(lab).width, hw = heart ? 24 : 0, ct = String(cost);
    var cw = ctx.measureText(ct).width;
    var total = hw + lw + 12 + 18 + 4 + cw, x0 = rr.x + (rr.w - total) / 2, cy = rr.y + rr.h / 2;
    if (heart) IF.drawHeart(ctx, x0 + 9, cy, 19 * (1 + (HB.heartPop || 0) * 0.6), true);
    txt(lab, x0 + hw, cy + 1, px, C.ink, 'left', '800');
    IF.drawCoin(ctx, x0 + hw + lw + 12 + 9, cy, 9);
    txt(ct, x0 + hw + lw + 12 + 22, cy + 1, px, C.ink, 'left', '800');
    ctx.globalAlpha = 1;
  }
  function drawCard(k) {
    var c = HB.cards[k], r = L.cards[k];
    if (!c) return;
    var appear = clamp((HB.t - k * 0.08) / 0.35, 0, 1), e = easeOutBack(appear);
    var picked = HB.pick === k, other = HB.pick >= 0 && !picked;
    var sc = (0.85 + 0.15 * e) * (picked ? 1 + Math.sin(Math.min(1, HB.pickT / 0.3) * Math.PI) * 0.06 : 1);
    var a = appear * (other ? Math.max(0, 1 - HB.pickT * 3) : 1);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2 + (1 - e) * 20); ctx.scale(sc, sc); ctx.translate(-r.w / 2, -r.h / 2);
    var col = CARD_COLS[c.k];
    IF.panel(ctx, 0, 0, r.w, r.h, 22, '#FFFDF9', picked ? C.coral : C.shadow, 6);
    ctx.lineWidth = picked ? 3 : 0;
    if (picked) { IF.rr(ctx, 0, 0, r.w, r.h, 22); ctx.strokeStyle = C.coral; ctx.stroke(); }
    var good = c.k === 'calm' ? G.isl[c.p].good : 0;
    var desc = t('d_' + c.k);
    if (L.vertCards) {
      var band = r.h * 0.86;
      ctx.save(); IF.rr(ctx, 0, 0, r.w, r.h, 22); ctx.clip();
      ctx.fillStyle = col; ctx.fillRect(0, 0, band, r.h); ctx.restore();
      var ir = Math.min(r.h * 0.28, band * 0.3);
      IF.circle(ctx, band / 2, r.h / 2, ir * 1.35); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
      IF.drawUpIcon(ctx, c.k, band / 2, r.h / 2, ir, c.p >= 0 ? good : null);
      var tx = band + 16, tw = r.w - tx - 14;
      var tp = IF.fitFont(ctx, t('c_' + c.k), tw, clamp(r.h * 0.18, 16, 22), '900');
      var lay = IF.richLayout(ctx, desc, tw, clamp(r.h * 0.13, 12, 16), '600');
      while (lay.lines.length > 3 && lay.px > 10) lay = IF.richLayout(ctx, desc, tw, lay.px - 1, '600');
      var th = tp * 1.25 + lay.lines.length * lay.lh, ty = (r.h - th) / 2;
      txt(t('c_' + c.k), tx, ty + tp * 0.6, tp, C.ink, 'left', '900');
      IF.richDraw(ctx, lay, tx, ty + tp * 1.25, good, C.inkSoft, true);
    } else {
      var bh = r.h * 0.44;
      ctx.save(); IF.rr(ctx, 0, 0, r.w, r.h, 22); ctx.clip();
      ctx.fillStyle = col; ctx.fillRect(0, 0, r.w, bh); ctx.restore();
      var ir2 = bh * 0.3;
      IF.circle(ctx, r.w / 2, bh / 2, ir2 * 1.4); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
      IF.drawUpIcon(ctx, c.k, r.w / 2, bh / 2, ir2, c.p >= 0 ? good : null);
      fitTxt(t('c_' + c.k), r.w / 2, bh + 30, r.w - 28, 22, C.ink, 'center', '900');
      var lay2 = IF.richLayout(ctx, desc, r.w - 32, 16, '600');
      IF.richDraw(ctx, lay2, r.w / 2, bh + 52, good, C.inkSoft);
      IF.circle(ctx, r.w / 2, r.h - 26, 14); ctx.fillStyle = 'rgba(61,59,84,0.08)'; ctx.fill();
      txt(String(k + 1), r.w / 2, r.h - 25, 14, C.inkSoft, 'center', '800');
    }
    ctx.restore();
  }

  // ---------- game over ----------
  function drawOver() {
    var a = Math.min(1, OV.t / 0.4);
    veil(0.32 * a);
    var p = L.oPanel, y = p.y + (1 - a) * 30;
    ctx.globalAlpha = a;
    IF.panel(ctx, p.x, y, p.w, p.h, 28, '#FFFDF9', C.shadow, 6);
    fitTxt(t('gameOver'), p.x + p.w / 2, y + 44, p.w - 40, 28, C.ink, 'center', '900');
    var top = y + 70, bottom = L.oAgain.y - 12 + (y - p.y), mid = (top + bottom) / 2;
    IF.drawCrate(ctx, p.x + p.w / 2, mid - 58, 34, '#F2CF9B');
    txt(String(OV.n), p.x + p.w / 2, mid - 10, 46, C.ink, 'center', '900');
    txt(t('deliveries'), p.x + p.w / 2, mid + 22, 15, C.inkSoft, 'center', '700');
    txt(t('dayReached', OV.day), p.x + p.w / 2, mid + 46, 15, C.ink, 'center', '700');
    if (OV.best) {
      var bw = 150, bx = p.x + (p.w - bw) / 2, by = y - 16;
      IF.panel(ctx, bx, by, bw, 34, 17, C.butter, '#E9C66A', 3);
      fitTxt(t('newBest'), p.x + p.w / 2, by + 18, bw - 20, 17, C.ink, 'center', '900');
    } else {
      txt(t('best') + ': ' + save.best, p.x + p.w / 2, mid + 68, 14, C.inkSoft, 'center', '700');
    }
    var off = y - p.y;
    ctx.save(); ctx.translate(0, off);
    button(L.oAgain, t('again'), C.coral, C.coralDark, '#fff', 22);
    button(L.oMenu, t('menu'), '#fff', 'rgba(61,59,84,0.18)', C.ink, 18);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawToast() {
    var a = Math.min(1, toast.t / 0.3, (toast.dur - toast.t) / 0.2 + 0.0001);
    var base = scene === 'play' && G ? (G.sel ? L.panel.y - 10 : H - 16) : H - 16;
    if (scene === 'play' && G && ((G.tut && G.tut.step < 2) || G.tutT > 0)) base -= 64;
    hintPill(toast.text, 0, base, clamp(a, 0, 1));
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (scene === 'title') drawTitle();
    else if (scene === 'play' && G) drawPlay(false);
    else if (scene === 'harbor' && G && HB) drawHarbor();
    else if (scene === 'over' && G && OV) { drawPlay(true); drawOver(); }
    else { ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); }
    if (toast.t > 0) drawToast();
  }

  // ---------- loop ----------
  function step(dt) {
    toast.t = Math.max(0, toast.t - dt);
    titleSure = Math.max(0, titleSure - dt);
    if (scene === 'play' && G) {
      G.ferryFlash = Math.max(0, G.ferryFlash - dt);
      G.heartGain = Math.max(0, G.heartGain - dt);
      if (!menuOpen && !needTap) {
        G.heartShake = Math.max(0, G.heartShake - dt);
        G.banner = Math.max(0, G.banner - dt);
        G.tutT = Math.max(0, G.tutT - dt);
        for (var i = 0; i < timeScale && scene === 'play'; i++) update(dt);
      }
    } else if (scene === 'harbor') updateHarbor(dt);
    else if (scene === 'over' && OV) OV.t += dt;
  }
  function frame(ts) {
    raf = 0;
    if (sysPaused) return;
    var dt = lastTs ? Math.min(0.05, Math.max(0, (ts - lastTs) / 1000)) : 1 / 60;
    lastTs = ts;
    time += dt;
    try { step(dt); draw(); } catch (e) { PlayablesSDK.logError(); throw e; }
    raf = requestAnimationFrame(frame);
  }
  function startLoop() { if (!raf && !sysPaused) { lastTs = 0; raf = requestAnimationFrame(frame); } }

  // ---------- platform lifecycle ----------
  PlayablesSDK.onPause(function () {
    sysPaused = true;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (G) G.drag = null;
    AU.halt();
    draw();
  });
  PlayablesSDK.onResume(function () {
    if (!sysPaused) return;
    sysPaused = false;
    if (scene === 'play' && G && !G.dusk && G.overT <= 0 && !menuOpen) needTap = true;
    AU.unhalt();
    startLoop();
  });
  PlayablesSDK.onAudioChange(function (on) { ytAudio = !!on; applyAudio(); });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  // Debug/test hook (harmless: it only exposes state and the same actions a player can take).
  window.__ferryDebug = {
    setTimeScale: function (n) { timeScale = clamp(Math.floor(n) || 1, 1, 64); },
    info: function () {
      var o = { scene: scene, menuOpen: menuOpen, needTap: needTap, ready: ready, save: JSON.parse(JSON.stringify(save)) };
      if (G) {
        o.day = G.run.day; o.hearts = G.run.hearts; o.deliveries = G.run.deliveries; o.coins = G.run.coins;
        o.ferries = G.run.ferries; o.dayT = G.dayT; o.dusk = G.dusk; o.tutStep = G.tut ? G.tut.step : -1;
        o.routes = G.routes.map(function (r) { return r.stops.slice(); });
        o.sel = G.sel ? G.routes.indexOf(G.sel) : -1;
        o.routeMids = G.routes.map(function (r) { legPos(r.legs[0], r.legs[0].len * 0.5, LP); ws(LP.x, LP.y, P3); return { x: P3.x, y: P3.y }; });
        o.islands = G.isl.slice(0, G.active).map(function (isl) {
          ws(isl.x, isl.y, P3);
          return { i: isl.i, x: P3.x, y: P3.y, r: isl.R * view.s, good: isl.good, stock: isl.stock, reqs: isl.reqs.map(function (r) { return { good: r.good, t: r.t, res: !!r.res }; }) };
        });
      }
      if (HB) o.cards = HB.cards.slice();
      o.layout = { cards: L.cards, reroll: L.hReroll, heart: L.hHeart, pause: L.pause, tPrimary: L.tPrimary, tSecondary: L.tSecondary, mResume: L.mResume, mQuit: L.mQuit, oAgain: L.oAgain, oMenu: L.oMenu, delBtn: L.delBtn };
      return o;
    },
    addRoute: function (stops) { return tryRoute(stops); },
    removeRoute: function (i) { if (G && G.routes[i]) { removeRoute(G.routes[i]); return true; } return false; },
    endDay: function () { if (G && scene === 'play' && !G.dusk) G.dayT = DAY_LEN; },
    setHearts: function (n) { if (G) G.run.hearts = clamp(Math.floor(n) || 1, 1, G.run.maxHearts); },
    pickCard: function (i) { pickCard(i); }
  };

  // ---------- boot ----------
  resize();
  draw();
  PlayablesSDK.firstFrameReady();
  Promise.all([PlayablesSDK.load(), PlayablesSDK.getLanguage()]).then(function (res) {
    var data = res[0];
    if (data && data.v === 1) {
      save.best = num(data.best, 0, Number.MAX_SAFE_INTEGER, 0);
      save.bestDay = num(data.bestDay, 0, 9999, 0);
      save.snd = data.snd === 0 ? 0 : 1;
      save.tut = data.tut ? 1 : 0;
      save.run = data.run && typeof data.run === 'object' && unpackRun(data.run) ? data.run : null;
    }
    IF.setLang(res[1]);
    finishBoot();
  }, function () { finishBoot(); });
  function finishBoot() {
    if (ready) return;
    ready = true;
    applyAudio();
    layout();
    draw();
    PlayablesSDK.gameReady();
    startLoop();
  }
})();
