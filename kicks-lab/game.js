/* Kicks Lab: game state, layout, input, screens and the Playables lifecycle. */
(function () {
  'use strict';
  var KL = window.KL, C = KL.C, PlayablesSDK = window.PlayablesSDK, AU = KL.Audio, t = KL.t;
  var TAU = Math.PI * 2;

  PlayablesSDK.init({ storageKey: 'kicks-lab_save' });

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = 390, H = 844, DPR = 1, U = 390;

  // ---------- tuning ----------
  var CLIENTS_PER_DAY = 5, MAX_UNDO = 40, WALL_MAX = 6;
  var PAY_MULT = [0.25, 0.45, 0.7, 1, 1.3];
  var PRICES = { ink: [30, 35, 40, 45, 50], pat: 45, stk: 35, lace: 25, sil: [0, 90, 110, 130], booth: [120, 220], window: 160 };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
  function easeBack(x) { x = clamp(x, 0, 1); var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
  function has(a, v) { return a.indexOf(v) >= 0; }

  // ---------- state ----------
  var save = defaults();
  function defaults() {
    return { v: 1, cash: 0, rep: 0, day: 1, cl: 0, dc: 0, dr: 0, ds: 0, sh: 0, ink: KL.START.ink, pat: KL.START.pat, stk: KL.START.stk,
      lace: KL.START.lace, sil: KL.START.sil, booth: 0, win: 0, wall: [], snd: 1, tut: 0, pairs: 0, five: 0 };
  }
  var scene = 'title', ready = false, sysPaused = false, ytAudio = PlayablesSDK.isAudioEnabled();
  var menuOpen = false, time = 0, lastTs = 0, raf = 0;
  var S = null;     // studio session (current client)
  var SH = null;    // shop
  var titleSure = 0, tierFlash = 0;
  var toast = { text: '', t: 0 };
  var tip = { i: -1, t: 0 };
  var sel = { tool: 0, color: 2, pat: 1, stk: 0, focus: -1, ctx: 0 };
  var ptr = null;

  function U_() { return KL.unlocks(save); }

  function rect() { return { x: 0, y: 0, w: 0, h: 0 }; }
  function setR(o, x, y, w, h) { o.x = x; o.y = y; o.w = w; o.h = h; return o; }
  function inR(o, x, y) { return o && o.w > 0 && x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h; }
  var L = {
    land: false, pause: rect(), dayPill: rect(), cashPill: rect(), repPill: rect(),
    client: rect(), order: rect(), shoe: rect(), shoeArt: rect(), tray: rect(), undo: rect(), done: rect(),
    tools: [rect(), rect(), rect(), rect(), rect()], chips: [], sw: [], chipRow: rect(),
    reqs: [], res: rect(), resPin: rect(), resNext: rect(),
    tPrimary: rect(), tSecondary: rect(), tSound: rect(), tWall: rect(),
    mPanel: rect(), mResume: rect(), mSound: rect(), mQuit: rect(),
    offers: [rect(), rect(), rect(), rect()], shopNext: rect(), shopWall: rect(), shopSound: rect(),
    wallBack: rect(), frames: [], unpins: []
  };
  for (var li = 0; li < 6; li++) { L.chips.push(rect()); L.frames.push(rect()); L.unpins.push(rect()); }
  for (li = 0; li < 4; li++) L.reqs.push(rect());
  for (li = 0; li < KL.INKS.length; li++) L.sw.push(rect());

  // ---------- layout ----------
  function layout() {
    var p = 16, i;
    L.land = W > H * 1.12 && W >= 560;
    var inks = U_().ink.length;
    setR(L.pause, p, p, 44, 44);
    var pw = L.land ? 118 : clamp((W - 2 * p - 44 - 24) / 3.3, 70, 104);
    setR(L.repPill, W - p - pw, p + 2, pw, 40);
    setR(L.cashPill, L.repPill.x - 8 - pw, p + 2, pw, 40);
    setR(L.dayPill, p + 44 + 8, p + 2, Math.max(60, L.cashPill.x - 8 - (p + 44 + 8)), 40);
    if (L.land) setR(L.dayPill, p + 44 + 10, p + 2, 170, 40);
    var top = p + 44 + 12;

    // tray: tool row, option row, swatches; pick the biggest cell that fits
    function trayFit(tw, maxH) {
      var best = null;
      for (var cell = 58; cell >= 38; cell -= 2) {
        var cols = Math.max(1, Math.min(inks, Math.floor(tw / cell)));
        var cw = Math.min(cell + 6, tw / cols), rows = Math.ceil(inks / cols);
        var rowH = clamp(cell + 4, 46, 58);
        var h = 10 + rowH + 8 + rowH + 10 + rows * cw + 10;
        best = { cols: cols, cw: cw, rows: rows, rowH: rowH, h: h };
        if (h <= maxH) break;
      }
      return best;
    }
    var tf;
    if (!L.land) {
      var cw0 = clamp(U * 0.26, 88, 150), oh = clamp(H * 0.15, 104, 150);
      setR(L.client, p, top, cw0, oh);
      setR(L.order, p + cw0 + 8, top, W - 2 * p - cw0 - 8, oh);
      tf = trayFit(W - 2 * p - 16, H * 0.4);
      setR(L.tray, p, H - p - tf.h, W - 2 * p, tf.h);
      var sy = top + oh + 10;
      setR(L.shoe, p, sy, W - 2 * p, L.tray.y - 10 - sy);
    } else {
      var lw = clamp(W * 0.24, 196, 320), rw = clamp(W * 0.3, 280, 420);
      var ch = clamp((H - top - p) * 0.34, 84, 210);
      setR(L.client, p, top, lw, ch);
      var nReq = S && S.order ? S.order.reqs.length : 3, ordH = 30 + 8 + nReq * (76 + 8) + 10;
      setR(L.order, p, top + ch + 10, lw, Math.min(ordH, H - p - (top + ch + 10)));
      tf = trayFit(rw - 16, H - top - p);
      setR(L.tray, W - p - rw, top, rw, Math.min(H - top - p, tf.h));
      setR(L.shoe, p + lw + 12, top, W - 2 * p - lw - rw - 24, H - top - p);
    }
    // inside the tray
    var tx = L.tray.x + 8, tw = L.tray.w - 16, y = L.tray.y + 10, tb = (tw - 4 * 6) / 5;
    for (i = 0; i < 5; i++) setR(L.tools[i], tx + i * (tb + 6), y, tb, tf.rowH);
    y += tf.rowH + 8;
    setR(L.chipRow, tx, y, tw, tf.rowH);
    var cb = Math.min(tf.rowH + 6, (tw - 5 * 6) / 6);
    for (i = 0; i < 6; i++) setR(L.chips[i], tx + i * (cb + 6), y, cb, tf.rowH);
    L.chipW = cb;
    y += tf.rowH + 10;
    var gw = tf.cols * tf.cw, gx = tx + (tw - gw) / 2;
    for (i = 0; i < KL.INKS.length; i++) setR(L.sw[i], 0, 0, 0, 0);
    var own = U_().ink;
    for (i = 0; i < own.length; i++) setR(L.sw[own[i]], gx + (i % tf.cols) * tf.cw, y + Math.floor(i / tf.cols) * tf.cw, tf.cw, tf.cw);
    // shoe area: action row at the bottom (undo, done)
    var ab = 54;
    setR(L.undo, L.shoe.x + 4, L.shoe.y + L.shoe.h - ab, 54, 50);
    var dw = clamp(L.shoe.w * 0.34, 120, 190);
    setR(L.done, L.shoe.x + L.shoe.w - dw - 4, L.shoe.y + L.shoe.h - ab, dw, 50);
    setR(L.shoeArt, L.shoe.x, L.shoe.y + 4, L.shoe.w, L.shoe.h - ab - 10);
    // order chips
    layoutReqs();

    layoutResult();

    // title
    var bw = Math.min(330, L.land ? W * 0.4 : W - 64), tby = L.land ? H * 0.6 : H * 0.64, tcx = L.land ? W * 0.31 : W / 2;
    if (L.land && H < 480) tby = H * 0.56;
    setR(L.tPrimary, tcx - bw / 2, tby, bw, 64);
    setR(L.tSecondary, tcx - bw * 0.39, tby + 64 + 14, bw * 0.78, 52);
    L.tcx = tcx;
    setR(L.tSound, W - p - 48, p, 48, 48);
    setR(L.tWall, p, p, 48, 48);

    // pause menu
    var mw = Math.min(330, W - 48), mh = 76 + 3 * 56 + 2 * 12 + 24;
    setR(L.mPanel, (W - mw) / 2, (H - mh) / 2, mw, mh);
    setR(L.mResume, L.mPanel.x + 24, L.mPanel.y + 76, mw - 48, 56);
    setR(L.mSound, L.mPanel.x + 24, L.mResume.y + 68, mw - 48, 56);
    setR(L.mQuit, L.mPanel.x + 24, L.mSound.y + 68, mw - 48, 56);

    // shop
    var hy = H < 500 ? 150 : 186, foot = 76;
    var avail = H - hy - foot - p, cols = L.land ? 4 : 2, rows = L.land ? 1 : 2;
    var gap = 14, cwid = Math.min(L.land ? 230 : 200, (W - 2 * p - (cols - 1) * gap) / cols);
    var chh = Math.min(L.land ? 290 : 250, (avail - (rows - 1) * gap) / rows);
    var gx2 = (W - (cols * cwid + (cols - 1) * gap)) / 2, gy2 = hy + Math.max(0, (avail - (rows * chh + (rows - 1) * gap)) / 2);
    for (i = 0; i < 4; i++) setR(L.offers[i], gx2 + (i % cols) * (cwid + gap), gy2 + Math.floor(i / cols) * (chh + gap), cwid, chh);
    L.shopGrid = { x: gx2, w: cols * cwid + (cols - 1) * gap, y: gy2 };
    if (H < 500) { // short landscape: summary and wallet share one row
      L.shopSumY = 70; L.shopRowY = 70;
    } else { L.shopSumY = 76; L.shopRowY = 132; }
    var nbw = Math.min(300, W - 2 * p - 64 - 12);
    setR(L.shopNext, (W - nbw) / 2 + 32, H - p - 60, nbw, 60);
    setR(L.shopWall, L.shopNext.x - 12 - 60, H - p - 60, 60, 60);
    setR(L.shopSound, W - p - 48, p, 48, 48);

    // wall
    setR(L.wallBack, p, p, 48, 48);
    var wc = L.land ? 3 : 2, wr = L.land ? 2 : 3, wgap = 14;
    var fwid = Math.min(300, (W - 2 * p - 28 - (wc - 1) * wgap) / wc), fh = Math.min(fwid * 0.78, (H - 100 - p - 40 - (wr - 1) * wgap) / wr);
    var fx0 = (W - (wc * fwid + (wc - 1) * wgap)) / 2, fy0 = 100 + Math.max(0, (H - 100 - p - 30 - (wr * fh + (wr - 1) * wgap)) / 2);
    for (i = 0; i < 6; i++) {
      setR(L.frames[i], fx0 + (i % wc) * (fwid + wgap), fy0 + Math.floor(i / wc) * (fh + wgap), fwid, fh);
      setR(L.unpins[i], L.frames[i].x + fwid - 46, L.frames[i].y + 2, 44, 44);
    }
    shoeCache.key = '';
  }
  // Result panel: one column on portrait, two columns on landscape.
  function layoutResult() {
    var R = L.R = {}, n = S && S.order ? S.order.reqs.length : 3, pad = 20, bh = 54;
    R.two = W > H;
    if (R.two) {
      var rw = Math.min(880, W - 24), rh = Math.min(480, H - 24);
      setR(L.res, (W - rw) / 2, (H - rh) / 2, rw, rh);
      var lw = Math.round(rw * 0.44), lx = L.res.x + pad, ly = L.res.y + pad, lh = rh - 2 * pad;
      var ch = Math.min(lh * 0.48, (lw - pad) * 0.5 * 1.15), cw = ch / 1.15;
      R.client = { x: lx, y: ly, w: cw, h: ch };
      R.stR = Math.min(ch * 0.44, (lw - cw) * 0.36); R.stX = lx + cw + (lw - pad - cw) / 2; R.stY = ly + ch / 2;
      R.thumb = { x: lx, y: ly + ch + 8, w: lw - pad, h: lh - ch - 8 };
      var rx = L.res.x + lw, rwid = rw - lw - pad;
      R.col = { x: rx, w: rwid };
      R.cs = Math.min(64, (rwid - (n - 1) * 10) / n);
      var content = R.cs + 20 + 24 + 30 + 40 + 14 + 46 + (S && S.tut ? 44 : 0);
      R.chipY = ly + 4 + Math.max(0, (rh - pad - bh - 16 - ly + L.res.y - content) / 2);
      R.meterY = R.chipY + R.cs + 20;
      R.bonusY = R.meterY + 24 + 30;
      R.earnY = R.bonusY + 40 + 14;
      R.tutY = R.earnY + 46 + 26;
      setR(L.resPin, rx, L.res.y + rh - pad - bh, Math.min(150, rwid * 0.34), bh);
    } else {
      var rw1 = Math.min(520, W - 24), x = (W - rw1) / 2, iw = rw1 - 2 * pad;
      var ch1 = clamp(H * 0.15, 96, 150), cw1 = ch1 / 1.15, th = clamp(H * 0.13, 70, 130);
      var cs = Math.min(64, (iw - (n - 1) * 10) / n);
      var hgt = pad + ch1 + 8 + th + 14 + cs + 20 + 24 + 30 + 40 + 14 + 46 + 40 + bh + pad;
      var y = Math.max(12, (H - hgt) / 2);
      setR(L.res, x, y, rw1, Math.min(H - 24, hgt));
      R.client = { x: x + pad, y: y + pad, w: cw1, h: ch1 };
      R.stR = Math.min(ch1 * 0.46, (iw - cw1) * 0.32); R.stX = x + pad + cw1 + (iw - cw1) / 2; R.stY = y + pad + ch1 / 2;
      R.thumb = { x: x + pad, y: y + pad + ch1 + 8, w: iw, h: th };
      R.col = { x: x + pad, w: iw };
      R.cs = cs;
      R.chipY = R.thumb.y + th + 14;
      R.meterY = R.chipY + cs + 20;
      R.bonusY = R.meterY + 24 + 30;
      R.earnY = R.bonusY + 40 + 14;
      R.tutY = R.earnY + 46 + 20;
      setR(L.resPin, x + pad, L.res.y + L.res.h - pad - bh, Math.min(150, iw * 0.34), bh);
    }
    setR(L.resNext, L.resPin.x + L.resPin.w + 12, L.resPin.y, R.col.x + R.col.w - (L.resPin.x + L.resPin.w + 12), bh);
  }
  function layoutReqs() {
    var n = S && S.order ? S.order.reqs.length : 0, i, o = L.order;
    for (i = 0; i < 4; i++) setR(L.reqs[i], 0, 0, 0, 0);
    if (!n) return;
    var head = 30;
    if (!L.land) {
      var s = Math.min(o.h - head - 12, (o.w - 20 - (n - 1) * 8) / n, 70);
      var x0 = o.x + (o.w - (n * s + (n - 1) * 8)) / 2;
      for (i = 0; i < n; i++) setR(L.reqs[i], x0 + i * (s + 8), o.y + head + (o.h - head - s) / 2 - 2, s, s);
    } else {
      var rh = Math.min(76, (o.h - head - 16 - (n - 1) * 8) / n);
      for (i = 0; i < n; i++) setR(L.reqs[i], o.x + 12, o.y + head + 8 + i * (rh + 8), o.w - 24, rh);
    }
  }

  function resize() {
    W = Math.max(200, window.innerWidth || 390);
    H = Math.max(200, window.innerHeight || 844);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    U = Math.min(W, H);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    layout();
    bgCache = null; wallCache = {}; heroCache = null;
    if (!raf || sysPaused) draw();
  }

  // ---------- persistence ----------
  function num(v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? clamp(v, lo, hi) : def; }
  function applySave(d) {
    if (!d || d.v !== 1) return;
    var s = defaults(), all = (1 << KL.INKS.length) - 1;
    s.cash = num(d.cash, 0, 1e9, 0);
    s.rep = num(d.rep, 0, 1e9, 0);
    s.day = num(d.day, 1, 99999, 1);
    s.cl = num(d.cl, 0, CLIENTS_PER_DAY, 0);
    s.dc = num(d.dc, 0, 1e7, 0); s.dr = num(d.dr, 0, 1e6, 0); s.ds = num(d.ds, 0, 1e6, 0);
    s.sh = d.sh ? 1 : 0;
    s.ink = (num(d.ink, 0, all, 0) | KL.START.ink) & all;
    s.pat = (num(d.pat, 0, 63, 0) | KL.START.pat) & 63;
    s.stk = (num(d.stk, 0, 63, 0) | KL.START.stk) & 63;
    s.lace = (num(d.lace, 0, 15, 0) | KL.START.lace) & 15;
    s.sil = (num(d.sil, 0, 15, 0) | KL.START.sil) & 15;
    s.booth = num(d.booth, 0, 2, 0);
    s.win = d.win ? 1 : 0;
    s.snd = d.snd === 0 ? 0 : 1;
    s.tut = d.tut ? 1 : 0;
    s.pairs = num(d.pairs, 0, 1e9, 0);
    s.five = num(d.five, 0, 1e9, 0);
    if (Array.isArray(d.wall)) {
      for (var i = 0; i < d.wall.length && s.wall.length < WALL_MAX; i++) {
        var w = d.wall[i];
        if (Array.isArray(w) && KL.decode(w[0])) s.wall.push([String(w[0]), num(w[1], 1, 5, 3)]);
      }
    }
    if (s.cl >= CLIENTS_PER_DAY) s.sh = 1;
    save = s;
  }
  function persist() { PlayablesSDK.save(save); }

  // ---------- studio ----------
  function newClient() {
    var U0 = U_(), tut = !save.tut && save.day === 1 && save.cl === 0;
    var seed = (save.day * 7919 + save.cl * 104729 + save.pairs * 31 + 17) >>> 0, r = KL.rng(seed);
    var tier = KL.tierFor(save.rep), o;
    if (tut) o = KL.tutorialOrder();
    else o = KL.genOrder(r, tier, U0, save.win && r() < 0.5);
    var spec = tut ? { skin: '#C98E62', hair: '#26213A', hairStyle: 4, hat: 2, glasses: 2, hood: '#2F5BEA', hat2: '#FFD23F', earring: true, chain: false, hoodUp: false, bg: 0 } : KL.makeClient(seed ^ 0x5bd1e995);
    var d = o.start ? KL.clone(o.start) : KL.blank(U0.sil[0]);
    S = { order: o, spec: spec, design: d, undo: [], t: 0, phase: 'enter', pt: 0, res: null, pinned: false, mood: 0, tut: tut,
      clientCv: null, live: [], liveKey: '', drag: null, stampT: -1 };
    if (!has(U0.ink, sel.color)) sel.color = U0.ink[0];
    sel.focus = -1;
    if (tut) { sel.tool = 0; sel.color = 0; }
    layout();
    refreshLive();
    AU.play('whoosh');
  }
  function refreshLive() {
    var key = KL.encode(S.design);
    if (key === S.liveKey) return;
    S.liveKey = key;
    S.live = S.order.reqs.map(function (q) { return KL.check(q, S.design, S.order).ok; });
    shoeCache.key = '';
  }
  function pushUndo() {
    S.undo.push(KL.encode(S.design));
    if (S.undo.length > MAX_UNDO) S.undo.shift();
  }
  function edited() { refreshLive(); }
  function doUndo() {
    if (!S || !S.undo.length) { AU.play('deny'); return; }
    var d = KL.decode(S.undo.pop());
    if (d) { S.design = d; edited(); AU.play('undo'); }
  }
  function applyTool(z, sx, sy) {
    var d = S.design, q = d.z[z];
    if (sel.tool === 1) {
      if (q[1] === sel.pat && q[2] === sel.color) return;
      pushUndo();
      if (sel.pat === 0) { q[1] = 0; q[2] = -1; } else { q[1] = sel.pat; q[2] = sel.color; }
      sprayFx(sx, sy, KL.INKS[sel.color]);
      AU.play('spray');
    } else {
      if (q[0] === sel.color) { pokeFx(sx, sy, KL.INKS[sel.color]); return; }
      pushUndo();
      q[0] = sel.color;
      plopFx(sx, sy, KL.INKS[sel.color]);
      AU.play('plop');
    }
    edited();
  }
  function placeSticker(k, u, v, sx, sy) {
    if (!has(U_().stk, k)) { lockedToast(); return false; }
    if (S.design.k.length >= KL.MAX_STK) { showToast(t('max3')); AU.play('deny'); return false; }
    pushUndo();
    S.design.k.push([k, sel.color, u, v]);
    edited();
    AU.play('slap');
    burst(sx, sy, KL.INKS[sel.color], 12);
    return true;
  }
  function nextSpot() { var i = S.design.k.length; return KL.SPOTS[Math.min(i, 2)]; }
  function setLace(l) {
    if (!has(U_().lace, l)) { lockedToast(); return; }
    if (S.design.l === l) return;
    pushUndo(); S.design.l = l; edited(); AU.play('click');
  }
  function setSil(s) {
    if (!has(U_().sil, s)) { lockedToast(); return; }
    if (S.design.s === s) return;
    pushUndo(); S.design.s = s; edited(); AU.play('whoosh');
  }
  function lockedToast() { showToast(t('locked')); AU.play('deny'); }
  function finishClient() {
    if (!S || S.phase !== 'design') return;
    var res = KL.rate(S.order, S.design, S.t, save.booth);
    var st = res.stars, o = S.order;
    var pay = Math.round(o.pay * PAY_MULT[st - 1] * (o.pick ? 1.4 : 1)) + (st === 5 ? 5 : 0);
    var rep = Math.max(0, st - 1) + (st === 5 ? 1 : 0) + (o.pick && st >= 4 ? 1 : 0);
    var oldTier = KL.tierFor(save.rep);
    save.cash += pay; save.rep += rep; save.cl += 1; save.pairs += 1; if (st === 5) save.five += 1;
    save.dc += pay; save.dr += rep; save.ds += st;
    if (S.tut) save.tut = 1;
    S.res = { r: res, pay: pay, rep: rep, tierUp: KL.tierFor(save.rep) > oldTier };
    S.phase = 'result'; S.pt = 0; S.stampT = -1; S.shown = 0;
    S.mood = st >= 5 ? 3 : st >= 4 ? 1 : st >= 3 ? 0 : 2;
    S.clientCv = null;
    sel.focus = -1;
    persist();
  }
  function resultDone() { return S && S.phase === 'result' && S.pt >= resultLen(); }
  function resultLen() { return 0.5 + S.order.reqs.length * 0.28 + 1.1; }
  function nextFromResult() {
    if (!S || S.phase !== 'result') return;
    if (!resultDone()) { S.pt = resultLen(); return; }
    if (S.res.tierUp) { tierFlash = 3; showToast(t('tier', KL.tierFor(save.rep)), 3); AU.play('tier'); }
    if (save.cl >= CLIENTS_PER_DAY) endDay();
    else { S.phase = 'leave'; S.pt = 0; }
  }
  function pinDesign() {
    if (!S || !S.res || S.pinned) return;
    var enc = KL.encode(S.design);
    if (save.wall.length >= WALL_MAX) { save.wall.shift(); showToast(t('wallFull')); }
    save.wall.push([enc, S.res.r.stars]);
    S.pinned = true;
    AU.play('pin');
    persist();
  }

  // ---------- day / shop ----------
  function startStudio() {
    scene = 'studio'; menuOpen = false;
    AU.music(false);
    if (save.sh) { openShop(); return; }
    newClient();
  }
  function endDay() {
    save.sh = 1;
    persist();
    PlayablesSDK.sendScore(save.rep);
    openShop();
  }
  function shopPool() {
    var pool = [], u = U_(), i;
    for (i = 0; i < KL.INK_PACKS.length; i++) if (!has(u.ink, KL.INK_PACKS[i][0])) pool.push({ k: 'ink', i: i, price: PRICES.ink[i] });
    for (i = 1; i < 6; i++) if (!has(u.pat, i)) pool.push({ k: 'pat', i: i, price: PRICES.pat });
    for (i = 0; i < 6; i++) if (!has(u.stk, i)) pool.push({ k: 'stk', i: i, price: PRICES.stk });
    for (i = 0; i < 4; i++) if (!has(u.lace, i)) pool.push({ k: 'lace', i: i, price: PRICES.lace });
    for (i = 1; i < 4; i++) if (!has(u.sil, i)) pool.push({ k: 'sil', i: i, price: PRICES.sil[i] });
    if (save.booth < 2) pool.push({ k: 'booth', i: save.booth, price: PRICES.booth[save.booth] });
    if (!save.win) pool.push({ k: 'window', i: 0, price: PRICES.window });
    return pool;
  }
  function openShop() {
    scene = 'shop'; menuOpen = false; S = null;
    for (var q = 0; q < PN; q++) parts[q].on = false;
    var r = KL.rng(save.day * 2654435761 >>> 0), pool = shopPool(), offers = [], count = {};
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
    // cheap first on early days, at most two of a kind
    pool.sort(function (a, b) { return (save.day <= 2 ? a.price - b.price : 0); });
    for (i = 0; i < pool.length && offers.length < 4; i++) {
      var k = pool[i].k;
      if ((count[k] || 0) >= (k === 'ink' ? 2 : 1)) continue;
      count[k] = (count[k] || 0) + 1; offers.push(pool[i]);
    }
    for (i = 0; i < pool.length && offers.length < 4; i++) if (offers.indexOf(pool[i]) < 0) offers.push(pool[i]);
    SH = { offers: offers, bought: [], t: 0, pulse: -1, pt: 0 };
    AU.music(true);
  }
  function buy(i) {
    var o = SH.offers[i];
    if (!o || SH.bought[i]) return;
    if (save.cash < o.price) { showToast(t('broke')); AU.play('deny'); SH.pulse = i; SH.pt = 0.4; return; }
    save.cash -= o.price;
    if (o.k === 'ink') { save.ink |= (1 << KL.INK_PACKS[o.i][0]) | (1 << KL.INK_PACKS[o.i][1]); }
    else if (o.k === 'pat') save.pat |= 1 << o.i;
    else if (o.k === 'stk') save.stk |= 1 << o.i;
    else if (o.k === 'lace') save.lace |= 1 << o.i;
    else if (o.k === 'sil') save.sil |= 1 << o.i;
    else if (o.k === 'booth') save.booth = Math.min(2, save.booth + 1);
    else if (o.k === 'window') save.win = 1;
    SH.bought[i] = true;
    AU.play('buy');
    var r = L.offers[i];
    burst(r.x + r.w / 2, r.y + r.h / 2, C.sun, 18);
    persist();
    layout();
  }
  function nextDay() {
    save.day += 1; save.cl = 0; save.dc = 0; save.dr = 0; save.ds = 0; save.sh = 0;
    persist();
    AU.music(false);
    scene = 'studio';
    newClient();
  }
  function goTitle() {
    if (S && S.phase === 'result' && save.cl >= CLIENTS_PER_DAY) save.sh = 1;
    scene = 'title'; menuOpen = false; S = null; SH = null; ptr = null;
    AU.music(false);
  }
  function newGame() {
    var keepSnd = save.snd;
    save = defaults(); save.snd = keepSnd; save.tut = 0;
    persist();
    layout();
    sel = { tool: 0, color: 2, pat: 1, stk: 0, focus: -1, ctx: 0 };
    startStudio();
  }
  function hasProgress() { return save.pairs > 0 || save.day > 1; }
  function soundToggle() { save.snd = save.snd ? 0 : 1; applyAudio(); persist(); AU.play('click'); }
  function applyAudio() { AU.setWanted(ytAudio && !!save.snd); }
  function showToast(s, d) { toast.text = s; toast.t = d || 2.2; }

  // ---------- fx ----------
  var PN = 220, parts = [];
  for (var pi = 0; pi < PN; pi++) parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, s: 3, col: '#000', k: 0, a: 0, va: 0 });
  var rings = [];
  for (pi = 0; pi < 6; pi++) rings.push({ on: false, x: 0, y: 0, t: 0, col: '#000' });
  function emit(k, x, y, vx, vy, life, s, col) {
    for (var i = 0; i < PN; i++) {
      var p = parts[i];
      if (!p.on) { p.on = true; p.k = k; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.s = s; p.col = col; p.a = Math.random() * TAU; p.va = (Math.random() - 0.5) * 8; return; }
    }
  }
  function sprayFx(x, y, col) {
    for (var i = 0; i < 26; i++) { var a = Math.random() * TAU, v = 40 + Math.random() * 150; emit(0, x, y, Math.cos(a) * v, Math.sin(a) * v, 0.35 + Math.random() * 0.3, 1.5 + Math.random() * 2.5, col); }
  }
  function plopFx(x, y, col) {
    for (var i = 0; i < rings.length; i++) if (!rings[i].on) { rings[i].on = true; rings[i].x = x; rings[i].y = y; rings[i].t = 0; rings[i].col = col; break; }
    for (i = 0; i < 8; i++) { var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 90 + Math.random() * 90; emit(0, x, y, Math.cos(a) * v, Math.sin(a) * v, 0.5, 3 + Math.random() * 2.5, col); }
  }
  function pokeFx(x, y, col) { for (var i = 0; i < 5; i++) { var a = Math.random() * TAU; emit(0, x, y, Math.cos(a) * 60, Math.sin(a) * 60, 0.3, 2.5, col); } }
  function burst(x, y, col, n) {
    for (var i = 0; i < n; i++) { var a = i / n * TAU, v = 120 + Math.random() * 80; emit(0, x, y, Math.cos(a) * v, Math.sin(a) * v, 0.45, 3 + Math.random() * 2, i % 2 ? col : C.ink); }
  }
  function confetti() {
    var cols = [C.pink, C.blue, C.sun, C.mint, C.orange, C.violet];
    for (var i = 0; i < 90; i++) emit(1, Math.random() * W, -20 - Math.random() * H * 0.3, (Math.random() - 0.5) * 60, H * 0.35 + Math.random() * H * 0.25, 2.6 + Math.random() * 1, 5 + Math.random() * 5, cols[i % cols.length]);
  }
  function updateFx(dt) {
    for (var i = 0; i < PN; i++) {
      var p = parts[i];
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0 || p.y > H + 30) { p.on = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
      if (p.k === 0) { p.vx *= 0.9; p.vy = p.vy * 0.9 + 260 * dt; }
      else { p.vx += Math.sin(time * 2 + i) * 20 * dt; }
    }
    for (i = 0; i < rings.length; i++) if (rings[i].on) { rings[i].t += dt; if (rings[i].t > 0.45) rings[i].on = false; }
  }
  function drawFx() {
    for (var i = 0; i < PN; i++) {
      var p = parts[i];
      if (!p.on) continue;
      var a = Math.min(1, p.life / Math.min(0.3, p.max));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.col;
      if (p.k === 0) { KL.circle(ctx, p.x, p.y, p.s); ctx.fill(); }
      else {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(1, Math.cos(p.a * 1.7));
        ctx.fillRect(-p.s, -p.s * 0.6, p.s * 2, p.s * 1.2); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < rings.length; i++) {
      var r = rings[i];
      if (!r.on) continue;
      var k = r.t / 0.45;
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.col; ctx.lineWidth = 6 * (1 - k) + 1;
      KL.circle(ctx, r.x, r.y, 8 + k * 46); ctx.stroke();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; KL.circle(ctx, r.x + 2, r.y + 2, 8 + k * 46); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- shoe view ----------
  var shoeCache = { cv: null, key: '' };
  var view = { s: 1, x: 0, y: 0 };
  function shoeView(sil) {
    var r = L.shoeArt, f = KL.fitShoe(sil, r.w, r.h, 8);
    view.s = f.s; view.x = r.x + f.ox; view.y = r.y + f.oy;
    return view;
  }
  function toShoe(x, y) { return [(x - view.x) / view.s, (y - view.y) / view.s]; }
  function toScreen(x, y) { return [view.x + x * view.s, view.y + y * view.s]; }
  function drawShoeCached(d, r) {
    var key = KL.encode(d) + '|' + Math.round(r.w) + 'x' + Math.round(r.h) + '|' + DPR + (ptr && ptr.kind === 'stkMove' ? '|m' + ptr.idx : '');
    if (shoeCache.key !== key) {
      var cw = Math.max(1, Math.round(r.w * DPR)), ch = Math.max(1, Math.round(r.h * DPR));
      if (!shoeCache.cv) shoeCache.cv = KL.canvas(cw, ch);
      var cv = shoeCache.cv;
      if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
      var g = cv.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cw, ch);
      g.setTransform(DPR * view.s, 0, 0, DPR * view.s, DPR * (view.x - r.x), DPR * (view.y - r.y));
      var dd = d;
      if (ptr && ptr.kind === 'stkMove') { dd = KL.clone(d); dd.k.splice(ptr.idx, 1); }
      KL.drawShoe(g, dd, { reg: 6 });
      shoeCache.key = key;
    }
    ctx.drawImage(shoeCache.cv, r.x, r.y, r.w, r.h);
  }

  // ---------- input ----------
  function onDown(x, y, id) {
    if (!ready) return;
    if (menuOpen) {
      if (inR(L.mResume, x, y)) { menuOpen = false; AU.play('click'); }
      else if (inR(L.mSound, x, y)) soundToggle();
      else if (inR(L.mQuit, x, y)) { AU.play('click'); goTitle(); }
      else if (!inR(L.mPanel, x, y)) menuOpen = false;
      return;
    }
    if (scene === 'title') {
      if (inR(L.tSound, x, y)) { soundToggle(); return; }
      if (save.wall.length && inR(L.tWall, x, y)) { openWall('title'); return; }
      if (inR(L.tPrimary, x, y)) { AU.play('click'); if (hasProgress()) startStudio(); else newGame(); return; }
      if (hasProgress() && inR(L.tSecondary, x, y)) { if (titleSure > 0) newGame(); else { titleSure = 3; AU.play('click'); } }
      return;
    }
    if (scene === 'shop') {
      if (inR(L.shopSound, x, y)) { soundToggle(); return; }
      for (var i = 0; i < SH.offers.length; i++) if (inR(L.offers[i], x, y)) { buy(i); return; }
      if (inR(L.shopNext, x, y)) { AU.play('click'); nextDay(); return; }
      if (inR(L.shopWall, x, y)) { openWall('shop'); return; }
      if (inR(L.pause, x, y)) { AU.play('click'); goTitle(); }
      return;
    }
    if (scene === 'wall') {
      if (inR(L.wallBack, x, y)) { closeWall(); return; }
      for (i = 0; i < save.wall.length; i++) if (inR(L.unpins[i], x, y)) { save.wall.splice(i, 1); wallCache = {}; persist(); AU.play('peel'); return; }
      return;
    }
    if (scene !== 'studio' || !S) return;
    if (inR(L.pause, x, y)) { menuOpen = true; ptr = null; AU.play('click'); return; }
    if (S.phase === 'result') {
      if (!resultDone()) { S.pt = resultLen(); return; }
      if (inR(L.resPin, x, y)) { pinDesign(); return; }
      if (inR(L.resNext, x, y)) { AU.play('click'); nextFromResult(); }
      return;
    }
    if (S.phase !== 'design') return;
    for (i = 0; i < S.order.reqs.length; i++) if (inR(L.reqs[i], x, y)) { tip.i = i; tip.t = 3; AU.play('tick'); return; }
    for (i = 0; i < 5; i++) if (inR(L.tools[i], x, y)) { if (sel.tool !== i) { sel.tool = i; AU.play('click'); } return; }
    for (i = 0; i < 6; i++) if (inR(L.chips[i], x, y)) { chipDown(i, x, y, id); return; }
    var own = U_().ink;
    for (i = 0; i < own.length; i++) if (inR(L.sw[own[i]], x, y)) { sel.color = own[i]; AU.play('tick'); return; }
    if (inR(L.undo, x, y)) { doUndo(); return; }
    if (inR(L.done, x, y)) { AU.play('stamp'); finishClient(); return; }
    if (inR(L.shoe, x, y)) {
      shoeView(S.design.s);
      var sp = toShoe(x, y);
      if (sel.tool === 2) {
        var si = stickerAt(x, y);
        if (si >= 0) { ptr = { id: id, kind: 'stkMove', idx: si, x: x, y: y, sx: x, sy: y, moved: false }; AU.play('peel'); shoeCache.key = ''; return; }
        if (KL.zoneAt(S.design.s, sp[0], sp[1], 30) >= 0) {
          var uv = KL.stickerUV(S.design.s, sp[0], sp[1]);
          placeSticker(sel.stk, uv[0], uv[1], x, y);
        }
        return;
      }
      var z = KL.zoneAt(S.design.s, sp[0], sp[1], 24);
      if (z >= 0) { sel.focus = -1; applyTool(z, x, y); }
    }
  }
  function chipDown(i, x, y, id) {
    var u = U_();
    if (sel.tool === 1) { if (has(u.pat, i)) { sel.pat = i; AU.play('tick'); } else lockedToast(); }
    else if (sel.tool === 2) {
      if (!has(u.stk, i)) { lockedToast(); return; }
      sel.stk = i;
      ptr = { id: id, kind: 'stkNew', k: i, x: x, y: y, sx: x, sy: y, moved: false };
      AU.play('peel');
    } else if (sel.tool === 3) { if (i < 4) setLace(i); }
    else if (sel.tool === 4) { if (i < 4) setSil(i); }
  }
  function stickerAt(x, y) {
    var d = S.design;
    for (var i = d.k.length - 1; i >= 0; i--) {
      var p = KL.stickerXY(d.s, d.k[i][2], d.k[i][3]), sc = toScreen(p[0], p[1]);
      if (Math.hypot(x - sc[0], y - sc[1]) <= Math.max(26, KL.STK_R * view.s * 1.25)) return i;
    }
    return -1;
  }
  function onMove(x, y, id) {
    if (!ptr || ptr.id !== id) return;
    ptr.x = x; ptr.y = y;
    if (Math.hypot(x - ptr.sx, y - ptr.sy) > 8) ptr.moved = true;
  }
  function onUp(x, y, id) {
    if (!ptr || ptr.id !== id) return;
    var p = ptr; ptr = null;
    if (!S || S.phase !== 'design') return;
    shoeView(S.design.s);
    var sp = toShoe(x, y), over = inR(L.shoe, x, y) && KL.zoneAt(S.design.s, sp[0], sp[1], 60) >= 0;
    if (p.kind === 'stkNew') {
      if (p.moved && over) { var uv = KL.stickerUV(S.design.s, sp[0], sp[1]); placeSticker(p.k, uv[0], uv[1], x, y); }
    } else if (p.kind === 'stkMove') {
      shoeCache.key = '';
      if (!p.moved) return;
      pushUndo();
      if (over) { var uv2 = KL.stickerUV(S.design.s, sp[0], sp[1]); S.design.k[p.idx][2] = uv2[0]; S.design.k[p.idx][3] = uv2[1]; AU.play('slap'); }
      else { S.design.k.splice(p.idx, 1); AU.play('peel'); pokeFx(x, y, C.ink); }
      edited();
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
  canvas.addEventListener('pointercancel', function () { ptr = null; shoeCache.key = ''; });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  window.addEventListener('keydown', function (e) {
    if (!ready) return;
    AU.unlock();
    var k = e.key;
    if (k === ' ' || k === 'Tab' || k.indexOf('Arrow') === 0) e.preventDefault();
    if (k === 'm' || k === 'M') { soundToggle(); return; }
    if (menuOpen) {
      if (k === 'Escape' || k === 'p' || k === 'P' || k === 'Enter') menuOpen = false;
      else if (k === 'q' || k === 'Q') goTitle();
      return;
    }
    if (scene === 'title') {
      if (k === 'Enter' || k === ' ') { if (hasProgress()) startStudio(); else newGame(); }
      else if ((k === 'n' || k === 'N') && hasProgress()) { if (titleSure > 0) newGame(); else titleSure = 3; }
      else if ((k === 'w' || k === 'W') && save.wall.length) openWall('title');
      return;
    }
    if (scene === 'shop') {
      if (k >= '1' && k <= '4') buy(Number(k) - 1);
      else if (k === 'Enter') nextDay();
      else if (k === 'w' || k === 'W') openWall('shop');
      else if (k === 'Escape') goTitle();
      return;
    }
    if (scene === 'wall') { if (k === 'Escape' || k === 'Enter' || k === 'Backspace') closeWall(); return; }
    if (scene !== 'studio' || !S) return;
    if (k === 'Escape' || k === 'p' || k === 'P') { menuOpen = true; ptr = null; return; }
    if (S.phase === 'result') {
      if (k === 'Enter' || k === ' ') nextFromResult();
      else if (k === 'f' || k === 'F') pinDesign();
      return;
    }
    if (S.phase !== 'design') return;
    var own = U_().ink;
    if (k >= '0' && k <= '9') { var n = k === '0' ? 9 : Number(k) - 1; if (own[n] !== undefined) { sel.color = own[n]; AU.play('tick'); } return; }
    if (k === 'Tab' || k === 'ArrowRight' || k === 'ArrowLeft') {
      var dir = (k === 'ArrowLeft' || (k === 'Tab' && e.shiftKey)) ? -1 : 1;
      sel.focus = sel.focus < 0 ? (dir > 0 ? 0 : 7) : (sel.focus + dir + 8) % 8;
      AU.play('tick');
      return;
    }
    if (k === 'ArrowUp' || k === 'ArrowDown') { cycleOption(k === 'ArrowDown' ? 1 : -1); return; }
    if (k === 'b' || k === 'B') sel.tool = 0;
    else if (k === 's' || k === 'S') sel.tool = 1;
    else if (k === 'k' || k === 'K') sel.tool = 2;
    else if (k === 'l' || k === 'L') sel.tool = 3;
    else if (k === 'h' || k === 'H') sel.tool = 4;
    else if (k === 'z' || k === 'Z') doUndo();
    else if (k === 'd' || k === 'D' || (k === 'Enter' && e.shiftKey)) { AU.play('stamp'); finishClient(); }
    else if (k === 'Enter' || k === ' ') {
      shoeView(S.design.s);
      if (sel.tool === 2) {
        var sp = nextSpot(), p2 = KL.stickerXY(S.design.s, sp[0], sp[1]), sc = toScreen(p2[0], p2[1]);
        placeSticker(sel.stk, sp[0], sp[1], sc[0], sc[1]);
      } else if (sel.focus >= 0) {
        var a = KL.anchor(S.design.s, sel.focus), sc2 = toScreen(a[0], a[1]);
        applyTool(sel.focus, sc2[0], sc2[1]);
      } else { sel.focus = 0; }
    }
  });
  function cycleOption(dir) {
    var u = U_(), list, cur;
    if (sel.tool === 1) { list = u.pat; cur = sel.pat; }
    else if (sel.tool === 2) { list = u.stk; cur = sel.stk; }
    else if (sel.tool === 3) { list = u.lace; cur = S.design.l; }
    else if (sel.tool === 4) { list = u.sil; cur = S.design.s; }
    else { list = u.ink; cur = sel.color; }
    var i = list.indexOf(cur), nx = list[(i + dir + list.length) % list.length];
    if (sel.tool === 1) sel.pat = nx; else if (sel.tool === 2) sel.stk = nx; else if (sel.tool === 3) setLace(nx); else if (sel.tool === 4) setSil(nx); else sel.color = nx;
    AU.play('tick');
  }

  // ---------- wall ----------
  var wallFrom = 'title', wallCache = {};
  function openWall(from) { wallFrom = from; scene = 'wall'; AU.play('click'); }
  function closeWall() { scene = wallFrom === 'shop' && SH ? 'shop' : 'title'; AU.play('click'); }

  // ---------- drawing helpers ----------
  var bgCache = null, heroCache = null;
  function drawBg() {
    if (!bgCache || bgCache.width !== Math.round(W * DPR)) {
      bgCache = KL.canvas(Math.round(W * DPR), Math.round(H * DPR));
      var g = bgCache.getContext('2d');
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
      // big riso shapes, printed as halftone
      g.fillStyle = KL.halftone(g, C.sun, 10, 3.6, 0.9);
      KL.circle(g, W * 0.92, H * 0.06, U * 0.42); g.fill();
      g.fillStyle = KL.halftone(g, C.pink, 12, 3.2, 0.5);
      KL.circle(g, -U * 0.05, H * 0.98, U * 0.5); g.fill();
      g.save(); g.translate(W * 0.5, H * 0.5); g.rotate(-0.42);
      g.fillStyle = KL.halftone(g, C.blue, 9, 2, 0.32);
      g.fillRect(-W * 1.5, U * 0.08, W * 3, U * 0.16);
      g.restore();
      g.fillStyle = KL.grain(g); g.fillRect(0, 0, W, H);
    }
    ctx.drawImage(bgCache, 0, 0, W, H);
  }
  function chipBox(r, fill, on, off) {
    KL.panel(ctx, r.x, r.y + (on ? -2 : 0), r.w, r.h, Math.min(16, r.h * 0.3), fill, on ? C.pink : C.ink, on ? 5 : (off == null ? 3 : off), 3);
  }
  function button(r, label, fill, col, icon, shadow) {
    KL.panel(ctx, r.x, r.y, r.w, r.h, r.h / 2, fill, shadow || C.ink, 4, 3);
    var px = Math.min(26, r.h * 0.42);
    if (icon && label) {
      ctx.font = KL.font(px, '900');
      var tw = Math.min(r.w - 28 - px * 1.4, ctx.measureText(label).width), tot = px * 1.3 + 8 + tw;
      KL.icon(ctx, icon, r.x + (r.w - tot) / 2 + px * 0.65, r.y + r.h / 2, px * 1.3, col);
      KL.text(ctx, label, r.x + (r.w - tot) / 2 + px * 1.3 + 8, r.y + r.h / 2 + 1, px, col, null, 'left', r.w - 28 - px * 1.4, '900');
    } else if (icon) KL.icon(ctx, icon, r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.6, col);
    else KL.text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 1, px, col, null, 'center', r.w - 24, '900');
  }
  function iconBtn(r, icon, fill) { KL.panel(ctx, r.x, r.y, r.w, r.h, r.h / 2, fill || C.white, C.ink, 3, 3); KL.icon(ctx, icon, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.62, C.ink); }
  function pill(r, icon, txt, fill) {
    KL.panel(ctx, r.x, r.y, r.w, r.h, r.h / 2, fill || C.white, C.ink, 3, 3);
    KL.icon(ctx, icon, r.x + r.h * 0.55, r.y + r.h / 2, r.h * 0.62, C.ink);
    KL.text(ctx, txt, r.x + r.h * 1.0 + (r.w - r.h * 1.0) / 2 - 4, r.y + r.h / 2 + 1, r.h * 0.46, C.ink, null, 'center', r.w - r.h - 10, '900');
  }
  function veil(a) { ctx.fillStyle = 'rgba(38,33,58,' + a + ')'; ctx.fillRect(0, 0, W, H); }
  function grain() { ctx.fillStyle = KL.grain(ctx); ctx.fillRect(0, 0, W, H); }
  function swatchDot(x, y, r, col, on) {
    if (on) { ctx.fillStyle = C.ink; KL.circle(ctx, x + 3, y + 3, r + 5); ctx.fill(); ctx.fillStyle = C.sun; KL.circle(ctx, x, y, r + 5); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke(); }
    ctx.fillStyle = col; KL.circle(ctx, x + 2, y + 1.5, r); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = C.ink; KL.circle(ctx, x, y, r); ctx.stroke();
  }
  function patTile(x, y, w, h, p, acc, rad) {
    ctx.save(); KL.rr(ctx, x, y, w, h, rad || 8); ctx.clip();
    ctx.fillStyle = C.white; ctx.fillRect(x, y, w, h);
    var k = w / 90; ctx.translate(x, y); ctx.scale(k, k);
    if (p > 0) KL.drawPattern(ctx, p, C.white, acc, [0, 0, w / k, h / k], 31 + p);
    ctx.restore();
    ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; KL.rr(ctx, x, y, w, h, rad || 8); ctx.stroke();
  }
  function laceIcon(l, x, y, s, col) {
    ctx.save(); ctx.translate(x, y); var k = s / 40; ctx.scale(k, k);
    ctx.lineCap = 'round';
    var lw = l === 3 ? 7 : 4.5;
    function seg(a, b, c, d) { ctx.lineWidth = lw + 3; ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); }
    var ys = [-12, 0, 12];
    for (var i = 0; i < 3; i++) {
      if (l === 1) { if (i < 2) { seg(-12, ys[i], 12, ys[i + 1]); seg(12, ys[i], -12, ys[i + 1]); } }
      else seg(-12, ys[i], 12, ys[i]);
    }
    if (l === 2) { seg(-12, -12, -12, 12); }
    ctx.fillStyle = C.white; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    for (i = 0; i < 3; i++) { KL.circle(ctx, -14, ys[i], 3); ctx.fill(); ctx.stroke(); KL.circle(ctx, 14, ys[i], 3); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  // Icon for one order requirement, centered at x,y inside a square of size s.
  function reqIcon(q, x, y, s, sil) {
    var r = s * 0.36, c;
    switch (q.t) {
      case 'color': swatchDot(x, y, r, KL.INKS[q.c], false); break;
      case 'ban':
        swatchDot(x, y, r, KL.INKS[q.c], false);
        ctx.strokeStyle = C.bad; ctx.lineWidth = Math.max(3, s * 0.08); KL.circle(ctx, x, y, r + 3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - r * 0.75, y + r * 0.75); ctx.lineTo(x + r * 0.75, y - r * 0.75); ctx.stroke();
        break;
      case 'zone':
        KL.drawSilIcon(ctx, sil, x, y - s * 0.05, s * 0.86, s * 0.55, C.white, q.z, KL.INKS[q.c]);
        swatchDot(x + s * 0.3, y + s * 0.28, s * 0.12, KL.INKS[q.c], false);
        break;
      case 'vibe':
        KL.vibeIcon(ctx, q.v, x, y - s * 0.1, s * 0.62);
        var pal = KL.VIBES[q.v].pal.filter(function (i) { return has(U_().ink, i); }).slice(0, 4);
        for (c = 0; c < pal.length; c++) { ctx.fillStyle = KL.INKS[pal[c]]; var px = x + (c - (pal.length - 1) / 2) * s * 0.17; KL.circle(ctx, px, y + s * 0.33, s * 0.075); ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = C.ink; ctx.stroke(); }
        break;
      case 'pat': patTile(x - s * 0.34, y - s * 0.34, s * 0.68, s * 0.68, q.p, C.pink, 8); break;
      case 'stk': KL.drawSticker(ctx, q.k, C.sun, x, y, s * 0.3, -0.12, 0); break;
      case 'mood':
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.06);
        ctx.fillStyle = C.ink; ctx.fillRect(-s * 0.38 + 2, -s * 0.32 + 2, s * 0.76, s * 0.64);
        ctx.fillStyle = C.white; ctx.fillRect(-s * 0.38, -s * 0.32, s * 0.76, s * 0.64);
        for (c = 0; c < 3; c++) { ctx.fillStyle = q.m[c]; ctx.fillRect(-s * 0.3 + c * s * 0.2, -s * 0.2 + (c % 2) * s * 0.12, s * 0.2, s * 0.26); }
        ctx.fillStyle = 'rgba(255,210,63,0.85)'; ctx.fillRect(-s * 0.12, -s * 0.38, s * 0.24, s * 0.1);
        ctx.restore();
        break;
      case 'lace': laceIcon(q.l, x, y, s * 0.72, C.pink); break;
      case 'sil': KL.drawSilIcon(ctx, q.s, x, y, s * 0.86, s * 0.6, C.blue); break;
      case 'keep':
        KL.drawSilIcon(ctx, sil, x - s * 0.06, y + s * 0.04, s * 0.74, s * 0.5, C.white);
        KL.icon(ctx, 'keep', x + s * 0.24, y - s * 0.18, s * 0.42, C.ink);
        break;
    }
  }
  function reqText(q) {
    switch (q.t) {
      case 'zone': return t('r_zone', undefined, undefined, t('z' + q.z));
      case 'vibe': return t('r_vibe', undefined, undefined, t('v' + q.v));
      case 'pat': return t('r_pat') + ': ' + t('p' + q.p);
      case 'stk': return t('r_stk') + ': ' + t('s' + q.k);
      case 'lace': return t('r_lace') + ': ' + t('l' + q.l);
      case 'sil': return t('r_sil') + ': ' + t('k' + q.s);
      default: return t('r_' + q.t);
    }
  }
  function badge(x, y, r, ok) {
    ctx.fillStyle = C.ink; KL.circle(ctx, x + 2, y + 2, r); ctx.fill();
    ctx.fillStyle = ok ? C.good : C.bad; KL.circle(ctx, x, y, r); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
    KL.icon(ctx, ok ? 'check' : 'cross', x, y, r * 1.25, C.white);
  }
  // Word-wrapped text (max 2 lines), left aligned.
  function wrap(s, x, y, maxW, px, col, lines, align) {
    ctx.font = KL.font(px, '800'); ctx.fillStyle = col; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    if (align === 'center') x += maxW / 2;
    var words = s.split(' '), cur = '', out = [];
    for (var i = 0; i < words.length; i++) {
      var tt = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(tt).width > maxW && cur) { out.push(cur); cur = words[i]; } else cur = tt;
    }
    if (cur) out.push(cur);
    lines = lines || 2;
    if (out.length > lines) { out = out.slice(0, lines); }
    for (i = 0; i < out.length; i++) {
      var ln = out[i];
      while (ctx.measureText(ln).width > maxW && ln.length > 3) ln = ln.slice(0, -2);
      ctx.fillText(ln, x, y + (i - (out.length - 1) / 2) * px * 1.15);
    }
  }

  // ---------- studio drawing ----------
  function clientCanvas(spec, mood, w, h) {
    var cv = KL.canvas(Math.round(w * DPR), Math.round(h * DPR)), g = cv.getContext('2d');
    var k = Math.min(w / 200, h / 224);
    g.setTransform(DPR * k, 0, 0, DPR * k, DPR * (w - 200 * k) / 2, DPR * (h - 224 * k));
    KL.drawClient(g, spec, mood);
    return cv;
  }
  function drawClientBox(r, slide) {
    var off = slide * (L.land ? -r.w - 40 : -r.w - 40);
    ctx.save(); ctx.translate(off, 0);
    var cols = [C.sun, C.mint, C.pink, '#6EC9FF'];
    KL.panel(ctx, r.x, r.y, r.w, r.h, 18, cols[S.spec.bg % 4], C.ink, 4, 3);
    ctx.save(); KL.rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.clip();
    ctx.fillStyle = KL.halftone(ctx, C.white, 8, 2.2, 0.55); ctx.fillRect(r.x, r.y, r.w, r.h);
    var key = S.mood + '|' + Math.round(r.w) + 'x' + Math.round(r.h);
    if (!S.clientCv || S.clientKey !== key) { S.clientCv = clientCanvas(S.spec, S.mood, r.w, r.h - 4); S.clientKey = key; }
    var bob = Math.sin(time * 2.2) * 1.5;
    ctx.drawImage(S.clientCv, r.x, r.y + 6 + bob, r.w, r.h - 4);
    ctx.restore();
    ctx.lineWidth = 3; ctx.strokeStyle = C.ink; KL.rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.stroke();
    // tags
    var ty = r.y + 8;
    if (S.order.start) { tag(r.x + 8, ty, t('remix'), C.blue); ty += 26; }
    if (S.order.pick) tag(r.x + 8, ty, t('picky'), C.pink);
    ctx.restore();
  }
  function tag(x, y, s, col) {
    ctx.font = KL.font(12, '900');
    var w = Math.min(ctx.measureText(s).width + 16, L.client.w - 16);
    KL.panel(ctx, x, y, w, 22, 11, col, C.ink, 2, 2);
    KL.text(ctx, s, x + w / 2, y + 12, 12, C.white, null, 'center', w - 10, '900');
  }
  function drawOrder(r, slide) {
    var o = S.order, n = o.reqs.length, i;
    ctx.save(); ctx.translate(0, -slide * (r.y + r.h + 20));
    KL.panel(ctx, r.x, r.y, r.w, r.h, 18, C.white, C.ink, 4, 3);
    // header: ticket strip with timer
    ctx.save(); KL.rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.clip();
    ctx.fillStyle = C.pink; ctx.fillRect(r.x, r.y, r.w, 28);
    ctx.fillStyle = KL.halftone(ctx, C.ink, 6, 1.3, 0.25); ctx.fillRect(r.x, r.y, r.w, 28);
    ctx.restore();
    ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.moveTo(r.x, r.y + 28); ctx.lineTo(r.x + r.w, r.y + 28); ctx.stroke();
    var tl = S.tut ? 1 : clamp(1 - S.t / o.soft, 0, 1);
    KL.icon(ctx, 'clock', r.x + 18, r.y + 14, 20, C.ink);
    var bx = r.x + 32, bw = r.w - 44;
    ctx.fillStyle = 'rgba(38,33,58,0.35)'; KL.rr(ctx, bx, r.y + 9, bw, 10, 5); ctx.fill();
    ctx.fillStyle = tl > 0.25 ? C.sun : C.white; KL.rr(ctx, bx, r.y + 9, Math.max(10, bw * tl), 10, 5); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = C.ink; KL.rr(ctx, bx, r.y + 9, bw, 10, 5); ctx.stroke();
    for (i = 0; i < n; i++) {
      var q = o.reqs[i], rr = L.reqs[i], ok = S.live[i], s;
      if (!L.land) {
        chipBox(rr, tip.i === i && tip.t > 0 ? C.paper : C.paperDeep, false, 2);
        reqIcon(q, rr.x + rr.w / 2, rr.y + rr.h / 2, rr.w, S.design.s);
        if (ok) badge(rr.x + rr.w - 4, rr.y + 4, Math.max(9, rr.w * 0.15), true);
      } else {
        s = rr.h;
        chipBox(rr, tip.i === i && tip.t > 0 ? C.paper : C.paperDeep, false, 2);
        reqIcon(q, rr.x + s / 2 + 2, rr.y + s / 2, s - 6, S.design.s);
        wrap(reqText(q), rr.x + s + 6, rr.y + rr.h / 2, rr.w - s - 40, clamp(s * 0.24, 12, 16), C.ink, 2);
        if (ok) badge(rr.x + rr.w - 18, rr.y + rr.h / 2, 11, true);
        else { ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(38,33,58,0.35)'; KL.circle(ctx, rr.x + rr.w - 18, rr.y + rr.h / 2, 10); ctx.stroke(); }
      }
    }
    ctx.restore();
  }
  function drawTooltip() {
    if (tip.t <= 0 || tip.i < 0 || !S || tip.i >= S.order.reqs.length) return;
    var rr = L.reqs[tip.i], s = reqText(S.order.reqs[tip.i]);
    ctx.font = KL.font(15, '800');
    var w = Math.min(W - 32, ctx.measureText(s).width + 28), h = 40;
    var x = clamp(rr.x + rr.w / 2 - w / 2, 16, W - 16 - w), y = rr.y + rr.h + 12;
    if (L.land) { x = rr.x + rr.w + 12; y = rr.y + rr.h / 2 - h / 2; w = Math.min(w, W - x - 16); }
    ctx.globalAlpha = Math.min(1, tip.t * 3);
    KL.panel(ctx, x, y, w, h, 12, C.ink, C.pink, 3, 0);
    KL.text(ctx, s, x + w / 2, y + h / 2 + 1, 15, C.white, null, 'center', w - 20, '800');
    ctx.globalAlpha = 1;
  }
  function drawTray() {
    var r = L.tray, u = U_(), i;
    KL.panel(ctx, r.x, r.y, r.w, r.h, 22, C.white, C.blue, 5, 3);
    var tools = ['bucket', 'spray', 'sticker', 'laces', 'shoe'];
    for (i = 0; i < 5; i++) {
      var tr = L.tools[i], on = sel.tool === i;
      chipBox(tr, on ? C.sun : C.paper, on);
      var big = tr.h >= 54 && tr.w >= 56;
      KL.icon(ctx, tools[i], tr.x + tr.w / 2, tr.y + (on ? -2 : 0) + tr.h / 2 - (big ? 7 : 0), Math.min(tr.w, tr.h) * (big ? 0.5 : 0.62), C.ink);
      if (big) KL.text(ctx, t('t' + i), tr.x + tr.w / 2, tr.y + (on ? -2 : 0) + tr.h - 11, 11, C.ink, null, 'center', tr.w - 6, '900');
    }
    // option row
    var col = KL.INKS[sel.color], acc = sel.color === 0 ? C.pink : col;
    if (sel.tool === 0) {
      var cr = L.chipRow;
      KL.text(ctx, t('h0'), cr.x + cr.w / 2, cr.y + cr.h / 2, clamp(cr.h * 0.3, 13, 17), C.inkSoft, null, 'center', cr.w - 10, '800');
    } else {
      var count = sel.tool === 1 || sel.tool === 2 ? 6 : 4;
      for (i = 0; i < 6; i++) {
        var cr2 = L.chips[i];
        if (i >= count) continue;
        var owned = sel.tool === 1 ? has(u.pat, i) : sel.tool === 2 ? has(u.stk, i) : sel.tool === 3 ? has(u.lace, i) : has(u.sil, i);
        var act = sel.tool === 1 ? sel.pat === i : sel.tool === 2 ? sel.stk === i : sel.tool === 3 ? S.design.l === i : S.design.s === i;
        chipBox(cr2, act ? C.sun : C.paper, act && owned);
        var cx = cr2.x + cr2.w / 2, cy = cr2.y + cr2.h / 2 - (act && owned ? 2 : 0), m = Math.min(cr2.w, cr2.h);
        ctx.globalAlpha = owned ? 1 : 0.35;
        if (sel.tool === 1) {
          if (i === 0) { ctx.fillStyle = C.white; KL.rr(ctx, cx - m * 0.3, cy - m * 0.3, m * 0.6, m * 0.6, 7); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke(); KL.icon(ctx, 'cross', cx, cy, m * 0.36, C.inkSoft); }
          else patTile(cx - m * 0.3, cy - m * 0.3, m * 0.6, m * 0.6, i, acc, 7);
        } else if (sel.tool === 2) {
          if (!(ptr && ptr.kind === 'stkNew' && ptr.k === i && ptr.moved)) KL.drawSticker(ctx, i, owned ? col : C.white, cx, cy, m * 0.3, 0, 0);
        } else if (sel.tool === 3) laceIcon(i, cx, cy, m * 0.66, S.design.z[5][0] >= 0 ? KL.INKS[S.design.z[5][0]] : C.white);
        else KL.drawSilIcon(ctx, i, cx, cy, m * 0.84, m * 0.6, owned ? C.blue : C.white);
        ctx.globalAlpha = 1;
        if (!owned) KL.icon(ctx, 'lock', cr2.x + cr2.w - 12, cr2.y + 12, 16, C.ink);
      }
    }
    // swatches
    var own = u.ink;
    for (i = 0; i < own.length; i++) {
      var s = L.sw[own[i]], on2 = sel.color === own[i];
      swatchDot(s.x + s.w / 2, s.y + s.h / 2, Math.min(s.w, s.h) * 0.34, KL.INKS[own[i]], on2);
      if (i < 10 && L.land && s.w >= 46) KL.text(ctx, String((i + 1) % 10), s.x + 7, s.y + 8, 10, C.inkSoft, null, 'center', 0, '900');
    }
  }
  function drawShoeArea() {
    var r = L.shoe, d = S.design;
    // plinth card
    KL.panel(ctx, r.x, r.y, r.w, r.h, 24, 'rgba(255,253,248,0.72)', 'rgba(38,33,58,0.12)', 5, 0);
    ctx.save(); KL.rr(ctx, r.x, r.y, r.w, r.h, 24); ctx.clip();
    ctx.fillStyle = KL.halftone(ctx, C.sun, 12, 4.4, 0.55);
    KL.circle(ctx, r.x + r.w * 0.5, r.y + r.h * 0.46, Math.min(r.w, r.h) * 0.42); ctx.fill();
    ctx.restore();
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(38,33,58,0.25)'; ctx.setLineDash([8, 8]); KL.rr(ctx, r.x, r.y, r.w, r.h, 24); ctx.stroke(); ctx.setLineDash([]);
    shoeView(d.s);
    var lift = S.phase === 'enter' ? (1 - ease(S.pt / 0.6)) * 30 : 0;
    ctx.save(); ctx.translate(0, lift);
    drawShoeCached(d, L.shoeArt);
    // keyboard focus ring
    if (sel.focus >= 0 && S.phase === 'design') {
      ctx.save(); ctx.translate(view.x, view.y); ctx.scale(view.s, view.s);
      var z = KL.SIL[d.s].zones[sel.focus];
      ctx.setLineDash([16, 10]); ctx.lineDashOffset = -time * 40; ctx.strokeStyle = C.blue; ctx.lineWidth = 9;
      for (var i = 0; i < z.parts.length; i++) { ctx.save(); if (z.parts[i].clip) ctx.clip(KL.SIL[d.s].body); ctx.stroke(z.parts[i].p); ctx.restore(); }
      ctx.restore();
    }
    ctx.restore();
    // dragged sticker
    if (ptr && (ptr.kind === 'stkNew' && ptr.moved || ptr.kind === 'stkMove')) {
      var k = ptr.kind === 'stkNew' ? ptr.k : d.k[ptr.idx][0], col = ptr.kind === 'stkNew' ? KL.INKS[sel.color] : KL.INKS[d.k[ptr.idx][1]];
      KL.drawSticker(ctx, k, col, ptr.x, ptr.y - 10, Math.max(22, KL.STK_R * view.s * 1.12), -0.1, 6);
    }
    iconBtn(L.undo, 'undo', S.undo.length ? C.white : C.paperDeep);
    button(L.done, t('done'), C.pink, C.white, 'check');
  }
  function drawHud() {
    iconBtn(L.pause, scene === 'shop' ? 'back' : 'pause');
    if (scene === 'studio') {
      KL.panel(ctx, L.dayPill.x, L.dayPill.y, L.dayPill.w, L.dayPill.h, 20, C.white, C.ink, 3, 3);
      var dots = CLIENTS_PER_DAY, dw = Math.min(14, (L.dayPill.w - 70) / dots);
      var label = t('day', save.day);
      if (dw < 10) { KL.text(ctx, label + ' · ' + Math.min(dots, save.cl + 1) + '/' + dots, L.dayPill.x + L.dayPill.w / 2, L.dayPill.y + 21, 15, C.ink, null, 'center', L.dayPill.w - 16, '900'); dots = 0; }
      if (dots) KL.text(ctx, label, L.dayPill.x + 12, L.dayPill.y + 21, 16, C.ink, null, 'left', L.dayPill.w - 24 - dots * dw, '900');
      for (var i = 0; i < dots; i++) {
        var dx = L.dayPill.x + L.dayPill.w - 12 - (dots - i) * dw + dw / 2;
        ctx.fillStyle = i < save.cl ? C.pink : i === save.cl ? C.sun : C.paperDeep;
        KL.circle(ctx, dx, L.dayPill.y + 20, dw * 0.36); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke();
      }
    }
    pill(L.cashPill, 'cash', String(save.cash));
    pill(L.repPill, 'flame', String(save.rep), tierFlash > 0 ? C.sun : C.white);
  }
  function drawTutorial() {
    if (!S || !S.tut || S.phase !== 'design' || menuOpen) return;
    var d = S.design, used = KL.usedColors(d, []), step, target = null, drag = null;
    shoeView(d.s);
    if (!has(used, 2)) {
      if (sel.color !== 2) { step = 'tut1'; target = L.sw[2]; }
      else { step = 'tut2'; var a = KL.anchor(d.s, 0); target = toScreen(a[0], a[1]); }
    } else if (!has(used, 3)) {
      if (sel.color !== 3) { step = 'tut3'; target = L.sw[3]; }
      else { step = 'tut3'; var b = KL.anchor(d.s, 6); target = toScreen(b[0], b[1]); }
    } else if (!d.k.some(function (q) { return q[0] === 0; })) {
      if (sel.tool !== 2) { step = 'tut4'; target = L.tools[2]; }
      else { step = 'tut5'; var p = KL.stickerXY(d.s, 0.5, 0.5); drag = [L.chips[0], toScreen(p[0], p[1])]; }
    } else { step = 'tut6'; target = L.done; }
    // hint pill above the tray
    var s = t(step), hy = L.land ? L.shoe.y + 26 : L.shoe.y + 22;
    ctx.font = KL.font(16, '900');
    var w = Math.min(L.shoe.w - 20, ctx.measureText(s).width + 32);
    KL.panel(ctx, L.shoe.x + (L.shoe.w - w) / 2, hy - 18, w, 36, 18, C.ink, C.pink, 3, 0);
    KL.text(ctx, s, L.shoe.x + L.shoe.w / 2, hy + 1, 16, C.white, null, 'center', w - 20, '900');
    var hs = clamp(U * 0.11, 40, 58), cyc = (time % 1.6) / 1.6;
    if (drag) {
      if (ptr) return;
      var k = cyc < 0.15 ? 0 : cyc < 0.75 ? ease((cyc - 0.15) / 0.6) : 1;
      var x0 = drag[0].x + drag[0].w / 2, y0 = drag[0].y + drag[0].h / 2, x1 = drag[1][0], y1 = drag[1][1];
      var hx = x0 + (x1 - x0) * k, hy2 = y0 + (y1 - y0) * k;
      ctx.globalAlpha = cyc > 0.88 ? 1 - (cyc - 0.88) / 0.12 : 1;
      if (cyc > 0.1 && cyc < 0.8) KL.drawSticker(ctx, 0, KL.INKS[sel.color], hx, hy2 - 10, 20, 0, 0);
      KL.drawHand(ctx, hx, hy2, hs, cyc > 0.1 && cyc < 0.8);
      ctx.globalAlpha = 1;
    } else if (target) {
      var tx = target.x !== undefined ? target.x + target.w / 2 : target[0], ty = target.x !== undefined ? target.y + target.h / 2 : target[1];
      var press = cyc > 0.45 && cyc < 0.7;
      if (press) { ctx.strokeStyle = C.pink; ctx.lineWidth = 4; KL.circle(ctx, tx, ty, 16 + (cyc - 0.45) * 60); ctx.stroke(); }
      KL.drawHand(ctx, tx + 4, ty + 6 + (press ? 0 : 8), hs, press);
    }
  }
  function drawStudio() {
    drawBg();
    var slide = 0;
    if (S.phase === 'enter') slide = 1 - easeBack(S.pt / 0.6);
    else if (S.phase === 'leave') slide = ease(S.pt / 0.5);
    drawShoeArea();
    drawTray();
    drawClientBox(L.client, slide);
    drawOrder(L.order, slide);
    drawHud();
    drawFxLayerUnder();
    drawTutorial();
    drawTooltip();
    if (S.phase === 'result') drawResult();
  }
  function drawFxLayerUnder() { if (!S || S.phase !== 'result') drawFx(); }

  // ---------- result ----------
  function drawResult() {
    var R = S.res, res = R.r, o = S.order, pt = S.pt, n = o.reqs.length, i, LR = L.R;
    veil(0.42 * ease(pt / 0.4));
    var r = L.res, rise = (1 - easeBack(pt / 0.5)) * 60;
    ctx.save(); ctx.translate(0, rise); ctx.globalAlpha = Math.min(1, pt / 0.25);
    KL.panel(ctx, r.x, r.y, r.w, r.h, 26, C.paper, C.ink, 6, 3);
    ctx.save(); KL.rr(ctx, r.x, r.y, r.w, r.h, 26); ctx.clip();
    ctx.fillStyle = KL.halftone(ctx, C.pink, 10, 3, 0.3); KL.circle(ctx, r.x + r.w, r.y, Math.min(r.w, r.h) * 0.5); ctx.fill();
    ctx.restore();
    // client with their reaction
    var c = LR.client, key = 'res' + S.mood + Math.round(c.w);
    if (S.resKey !== key) { S.resCv = clientCanvas(S.spec, S.mood, c.w, c.h - 4); S.resKey = key; }
    ctx.save(); KL.rr(ctx, c.x, c.y, c.w, c.h, 18); ctx.fillStyle = C.mint; ctx.fill(); ctx.clip();
    ctx.fillStyle = KL.halftone(ctx, C.white, 8, 2.2, 0.5); ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.drawImage(S.resCv, c.x, c.y + 4, c.w, c.h - 4);
    ctx.restore();
    ctx.lineWidth = 3; ctx.strokeStyle = C.ink; KL.rr(ctx, c.x, c.y, c.w, c.h, 18); ctx.stroke();
    // the finished pair on a little plinth
    var th = LR.thumb;
    KL.panel(ctx, th.x, th.y, th.w, th.h, 18, C.white, 'rgba(38,33,58,0.15)', 4, 0);
    ctx.save(); KL.rr(ctx, th.x, th.y, th.w, th.h, 18); ctx.clip();
    ctx.fillStyle = KL.halftone(ctx, C.sun, 11, 3.6, 0.6); KL.circle(ctx, th.x + th.w / 2, th.y + th.h / 2, th.h * 0.48); ctx.fill();
    ctx.restore();
    var tk = Math.round(th.w) + 'x' + Math.round(th.h);
    if (!S.thumb || S.thumbKey !== tk) { S.thumb = thumbCanvas(S.design, th.w - 16, th.h - 12); S.thumbKey = tk; }
    ctx.drawImage(S.thumb, th.x + 8, th.y + 6, th.w - 16, th.h - 12);
    // requirement checks
    var cs = LR.cs, rx0 = LR.col.x + (LR.col.w - (n * cs + (n - 1) * 10)) / 2;
    for (i = 0; i < n; i++) {
      var rr = { x: rx0 + i * (cs + 10), y: LR.chipY, w: cs, h: cs };
      chipBox(rr, C.white, false, 2);
      reqIcon(o.reqs[i], rr.x + cs / 2, rr.y + cs / 2, cs, S.design.s);
      if (pt > 0.5 + i * 0.28) badge(rr.x + cs - 6, rr.y + cs - 6, 13 * easeBack(clamp((pt - 0.5 - i * 0.28) / 0.2, 0, 1)), res.rows[i].ok);
    }
    // hype meter: requirements (pink) + harmony (blue) + speed (sun) + booth (mint)
    var mx = LR.col.x + 4, mw = LR.col.w - 8, my = LR.meterY, mh = 24;
    var fillT = clamp((pt - 0.5 - n * 0.28) / 0.7, 0, 1), total = res.total * fillT, acc = 0;
    var segs = [[res.rows.reduce(function (s2, q) { return s2 + (q.ok ? 80 / n : 0); }, 0), C.pink], [res.harm, C.blue], [res.speed, C.sun], [res.booth, C.mint]];
    ctx.fillStyle = C.white; KL.rr(ctx, mx, my, mw, mh, 12); ctx.fill();
    ctx.save(); KL.rr(ctx, mx, my, mw, mh, 12); ctx.clip();
    for (i = 0; i < segs.length; i++) {
      var sv = Math.min(segs[i][0], Math.max(0, total - acc));
      if (sv > 0) { ctx.fillStyle = segs[i][1]; ctx.fillRect(mx + mw * acc / 100, my, mw * sv / 100 + 1, mh); }
      acc += segs[i][0];
    }
    ctx.restore();
    ctx.lineWidth = 3; ctx.strokeStyle = C.ink; KL.rr(ctx, mx, my, mw, mh, 12); ctx.stroke();
    for (i = 1; i < KL.STAR_AT.length; i++) {
      var tx = mx + mw * KL.STAR_AT[i] / 100;
      ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.moveTo(tx, my + 3); ctx.lineTo(tx, my + mh - 3); ctx.stroke();
      ctx.save(); ctx.translate(tx, my + mh + 13); KL.glyph(ctx, 3, 7); ctx.fillStyle = total >= KL.STAR_AT[i] ? C.orange : C.white; ctx.fill(); ctx.lineWidth = 1.8; ctx.stroke(); ctx.restore();
      KL.text(ctx, String(i + 1), tx + 11, my + mh + 14, 11, C.inkSoft, null, 'left', 0, '900');
    }
    // bonus pills
    var by = LR.bonusY, bw = (LR.col.w - 2 * 8) / 3, bh = 40, a0 = Math.min(1, pt / 0.25);
    var bon = [['harmony', t('harmony'), res.harm, C.blue], ['clock', t('speed'), res.speed, C.sun], ['booth', t('booth'), res.booth, C.mint]];
    for (i = 0; i < 3; i++) {
      var bx = LR.col.x + i * (bw + 8), dim = i === 2 && !save.booth;
      ctx.globalAlpha = a0 * (dim ? 0.4 : 1);
      KL.panel(ctx, bx, by, bw, bh, 14, C.white, bon[i][3], 3, 2.5);
      KL.icon(ctx, bon[i][0], bx + 20, by + bh / 2, 24, C.ink);
      KL.text(ctx, '+' + bon[i][2], bx + bw - 10, by + bh / 2 + 1, 17, C.ink, null, 'right', bw - 44, '900');
      if (bw > 128) KL.text(ctx, bon[i][1], bx + 36, by + bh / 2 + 1, 12, C.inkSoft, null, 'left', bw - 90, '800');
    }
    ctx.globalAlpha = a0;
    // earnings
    var ey = LR.earnY, eh = 46, ew = (LR.col.w - 10) / 2, ex = LR.col.x;
    var cashShown = Math.round(R.pay * clamp((pt - resultLen() + 0.5) / 0.4, 0, 1));
    KL.panel(ctx, ex, ey, ew, eh, 16, C.white, C.ink, 3, 3);
    KL.icon(ctx, 'cash', ex + 28, ey + eh / 2, 30, C.ink);
    KL.text(ctx, '+' + cashShown, ex + ew / 2 + 14, ey + eh / 2 + 1, 22, C.ink, C.mint, 'center', ew - 64, '900');
    KL.panel(ctx, ex + ew + 10, ey, ew, eh, 16, C.white, C.ink, 3, 3);
    KL.icon(ctx, 'flame', ex + ew + 10 + 26, ey + eh / 2, 30, C.ink);
    KL.text(ctx, '+' + R.rep + ' ' + t('rep'), ex + ew + 10 + ew / 2 + 14, ey + eh / 2 + 1, 20, C.ink, C.sun, 'center', ew - 64, '900');
    if (S.tut && LR.tutY + 14 < L.resPin.y) wrap(t('tutR'), LR.col.x, LR.tutY, LR.col.w, 13, C.inkSoft, 2, 'center');
    // buttons
    ctx.globalAlpha = resultDone() ? 1 : 0.45;
    button(L.resPin, S.pinned ? t('pinned') : t('pin'), S.pinned ? C.paperDeep : C.white, C.ink, 'pin');
    var last = save.cl >= CLIENTS_PER_DAY;
    button(L.resNext, last ? t('shop') : t('next'), C.blue, C.white, last ? 'shop' : 'arrow');
    ctx.globalAlpha = 1;
    // stamp slam
    var st = resultLen() - 0.55;
    if (pt >= st) {
      if (S.stampT < 0) { S.stampT = time; AU.play('stamp'); if (res.stars === 5) confetti(); }
      var k2 = clamp((pt - st) / 0.28, 0, 1), sc = 2.4 - 1.4 * easeBack(k2);
      var col = res.stars >= 4 ? C.pink : res.stars === 3 ? C.blue : C.inkSoft;
      ctx.save(); ctx.translate(LR.stX, LR.stY); ctx.rotate(-0.2); ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, k2 * 2);
      KL.drawStamp(ctx, 0, 0, LR.stR, res.stars, t('hype'), col);
      ctx.restore();
      if (pt >= resultLen() - 0.2 && !S.dinged) { S.dinged = true; AU.play('ding'); }
    }
    ctx.restore();
    drawFx();
  }
  function thumbCanvas(d, w, h) {
    var cv = KL.canvas(Math.max(1, Math.round(w * DPR)), Math.max(1, Math.round(h * DPR))), g = cv.getContext('2d');
    var f = KL.fitShoe(d.s, w, h, 4);
    g.setTransform(DPR * f.s, 0, 0, DPR * f.s, DPR * f.ox, DPR * f.oy);
    KL.drawShoe(g, d, { reg: 6 });
    return cv;
  }

  // ---------- title ----------
  var HERO = (function () {
    var d = KL.blank(0);
    d.z = [[2, 0, -1], [3, 2, 4], [0, 0, -1], [4, 0, -1], [1, 0, -1], [0, 0, -1], [0, 1, 2], [1, 0, -1]];
    d.k = [[1, 4, 0.3, 0.45], [0, 2, 0.75, 0.6]];
    d.l = 1;
    return d;
  })();
  function drawTitle() {
    drawBg();
    var cx = L.tcx, land = L.land;
    var logo = land ? clamp(Math.min(W * 0.095, H * 0.17), 48, 120) : clamp(U * 0.2, 54, 120);
    var ly = land ? Math.max(logo * 0.7, L.tPrimary.y - logo * 2.6) : H * 0.17;
    // logo: two misregistered ink layers + a sticker plate
    ctx.save(); ctx.translate(cx, ly); ctx.rotate(-0.05);
    ctx.font = KL.font(logo, '900'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.blue; ctx.fillText('KICKS', logo * 0.06, logo * 0.06);
    ctx.fillStyle = C.pink; ctx.fillText('KICKS', 0, 0);
    ctx.restore();
    ctx.save(); ctx.translate(cx + logo * 0.5, ly + logo * 0.82); ctx.rotate(-0.05);
    var lw = logo * 1.6, lh = logo * 0.62;
    KL.panel(ctx, -lw / 2, -lh / 2, lw, lh, lh * 0.3, C.sun, C.ink, 5, 3.5);
    ctx.font = KL.font(logo * 0.5, '900'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink; ctx.fillText('LAB', 0, 2);
    ctx.restore();
    KL.text(ctx, t('tag'), cx, ly + logo * 1.42, clamp(U * 0.045, 15, 22), C.ink, C.sun, 'center', (land ? W * 0.45 : W - 40), '900');
    // hero shoe
    var hx, hy, hw, hh;
    if (land) {
      var bx = Math.max(L.tPrimary.x + L.tPrimary.w, cx + logo * 1.6), avail = W - 16 - bx - 16;
      hw = Math.min(W * 0.52, H * 1.5, avail); hh = hw * 0.62; hx = bx + 16 + avail / 2; hy = H * 0.52;
    }
    else { hy = ly + logo * 1.62; hh = L.tPrimary.y - 24 - hy; hw = Math.min(W - 40, hh * 1.9); hh = Math.min(hh, hw * 0.62); hx = cx; hy += (L.tPrimary.y - 24 - hy) / 2; }
    if (hh > 60) {
      // printed backdrop disc
      ctx.fillStyle = KL.halftone(ctx, C.blue, 10, 3, 0.35); KL.circle(ctx, hx, hy, hh * 0.62); ctx.fill();
      if (!heroCache || heroCache.width !== Math.round(hw * DPR)) heroCache = thumbCanvas(HERO, hw, hh);
      var bob = Math.sin(time * 1.6) * 5;
      ctx.save(); ctx.translate(hx, hy + bob); ctx.rotate(-0.07 + Math.sin(time * 0.8) * 0.02);
      ctx.drawImage(heroCache, -hw / 2, -hh / 2, hw, hh);
      ctx.restore();
    }
    // buttons
    var prog = hasProgress();
    button(L.tPrimary, prog ? t('cont', save.day) : t('play'), C.pink, C.white, 'play');
    if (prog) button(L.tSecondary, titleSure > 0 ? t('sure') : t('fresh'), titleSure > 0 ? C.sun : C.white, C.ink);
    if (prog) {
      var sy = L.tSecondary.y + L.tSecondary.h + 28;
      if (sy < H - 16) {
        var items = [['flame', String(save.rep)], ['shoe', String(save.pairs)], ['tier', String(save.five)]], pw = 92;
        for (var i = 0; i < 3; i++) pill({ x: cx - (3 * pw + 16) / 2 + i * (pw + 8), y: sy - 18, w: pw, h: 36 }, items[i][0], items[i][1]);
      }
    }
    iconBtn(L.tSound, save.snd && ytAudio ? 'sound' : 'mute');
    if (save.wall.length) iconBtn(L.tWall, 'wall');
  }

  // ---------- shop ----------
  function offerName(o) {
    if (o.k === 'ink') return t('i_ink');
    if (o.k === 'pat') return t('p' + o.i);
    if (o.k === 'stk') return t('s' + o.i);
    if (o.k === 'lace') return t('l' + o.i);
    if (o.k === 'sil') return t('k' + o.i);
    if (o.k === 'booth') return o.i ? t('i_booth2') : t('i_booth');
    return t('i_window');
  }
  function offerDesc(o) {
    if (o.k === 'ink') return t('d_ink');
    if (o.k === 'booth') return t('d_booth');
    if (o.k === 'window') return t('d_window');
    return t('d_' + o.k);
  }
  function offerArt(o, x, y, s) {
    if (o.k === 'ink') {
      var p = KL.INK_PACKS[o.i];
      swatchDot(x - s * 0.18, y, s * 0.24, KL.INKS[p[0]], false);
      swatchDot(x + s * 0.18, y + 4, s * 0.24, KL.INKS[p[1]], false);
    } else if (o.k === 'pat') patTile(x - s * 0.34, y - s * 0.34, s * 0.68, s * 0.68, o.i, C.blue, 10);
    else if (o.k === 'stk') KL.drawSticker(ctx, o.i, C.pink, x, y, s * 0.32, -0.15, 0);
    else if (o.k === 'lace') laceIcon(o.i, x, y, s * 0.8, C.sun);
    else if (o.k === 'sil') KL.drawSilIcon(ctx, o.i, x, y, s * 1.1, s * 0.7, C.sun);
    else KL.icon(ctx, o.k === 'booth' ? 'booth' : 'window', x, y, s * 0.72, C.ink);
  }
  function drawShop() {
    drawBg();
    var cx = W / 2, i, G = L.shopGrid, short = H < 500;
    KL.text(ctx, t('dayDone', save.day), cx, 40, clamp(U * 0.07, 24, 36), C.ink, C.pink, 'center', W - 150, '900');
    // today's summary
    var avg = save.cl ? (save.ds / Math.max(1, save.cl)).toFixed(1) : '0';
    var sw = Math.min(112, (W - 32 - 16) / 3), sx0 = short ? G.x : cx - (3 * sw + 16) / 2;
    var items = [['cash', '+' + save.dc], ['flame', '+' + save.dr], ['tier', avg]];
    for (i = 0; i < 3; i++) pill({ x: sx0 + i * (sw + 8), y: L.shopSumY, w: sw, h: 40 }, items[i][0], items[i][1]);
    // shop tag + wallet
    var ry = L.shopRowY;
    if (!short) {
      ctx.save(); ctx.translate(G.x + 4, ry); ctx.rotate(-0.04);
      ctx.font = KL.font(20, '900'); var tw = ctx.measureText(t('shop')).width + 30;
      KL.panel(ctx, 0, 0, tw, 40, 12, C.pink, C.ink, 3, 3);
      KL.text(ctx, t('shop'), tw / 2, 21, 20, C.white, null, 'center', 0, '900');
      ctx.restore();
    }
    pill({ x: G.x + G.w - 130, y: ry, w: 130, h: 40 }, 'cash', String(save.cash), C.sun);
    if (!SH.offers.length) KL.text(ctx, t('soldOut'), cx, H * 0.5, 20, C.ink, C.sun, 'center', W - 40, '900');
    for (i = 0; i < SH.offers.length; i++) {
      var o = SH.offers[i], r = L.offers[i], bought = SH.bought[i], afford = save.cash >= o.price;
      var shake = SH.pulse === i && SH.pt > 0 ? Math.sin(SH.pt * 60) * 4 * SH.pt : 0;
      ctx.save(); ctx.translate(shake, 0);
      KL.panel(ctx, r.x, r.y, r.w, r.h, 20, bought ? C.paperDeep : C.white, [C.pink, C.blue, C.sun, C.mint][i], 6, 3);
      var art = Math.min(r.w * 0.6, (r.h - 120) * 0.95);
      ctx.save(); KL.rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.clip();
      ctx.fillStyle = KL.halftone(ctx, [C.pink, C.blue, C.sun, C.mint][i], 9, 2.6, 0.35); KL.circle(ctx, r.x + r.w / 2, r.y + 12 + art / 2, art * 0.55); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = bought ? 0.5 : 1;
      offerArt(o, r.x + r.w / 2, r.y + 12 + art / 2, art);
      ctx.globalAlpha = 1;
      var ny = r.y + 12 + art + 16;
      KL.text(ctx, offerName(o), r.x + r.w / 2, ny, clamp(r.w * 0.1, 14, 19), C.ink, null, 'center', r.w - 20, '900');
      wrap(offerDesc(o), r.x + 10, ny + 28, r.w - 20, 12.5, C.inkSoft, 2, 'center');
      var pb = { x: r.x + 12, y: r.y + r.h - 54, w: r.w - 24, h: 42 };
      if (bought) { KL.panel(ctx, pb.x, pb.y, pb.w, pb.h, 21, C.good, C.ink, 3, 3); KL.icon(ctx, 'check', pb.x + pb.w / 2, pb.y + pb.h / 2, 24, C.white); }
      else {
        KL.panel(ctx, pb.x, pb.y, pb.w, pb.h, 21, afford ? C.sun : C.paperDeep, C.ink, 3, 3);
        KL.icon(ctx, 'cash', pb.x + 26, pb.y + pb.h / 2, 26, C.ink);
        KL.text(ctx, String(o.price), pb.x + pb.w / 2 + 12, pb.y + pb.h / 2 + 1, 19, afford ? C.ink : C.inkSoft, null, 'center', pb.w - 60, '900');
      }
      ctx.restore();
    }
    iconBtn(L.pause, 'back');
    iconBtn(L.shopSound, save.snd && ytAudio ? 'sound' : 'mute');
    KL.panel(ctx, L.shopWall.x, L.shopWall.y, L.shopWall.w, L.shopWall.h, 22, C.white, C.ink, 4, 3);
    KL.icon(ctx, 'wall', L.shopWall.x + 30, L.shopWall.y + 30, 34, C.ink);
    button(L.shopNext, t('nextDay', save.day + 1), C.blue, C.white, 'arrow');
    drawFx();
  }

  // ---------- wall ----------
  function drawWall() {
    drawBg();
    KL.text(ctx, t('wall'), W / 2, 42, clamp(U * 0.07, 24, 34), C.ink, C.sun, 'center', W - 140, '900');
    iconBtn(L.wallBack, 'back');
    var f0 = L.frames[0], f5 = L.frames[5];
    KL.panel(ctx, f0.x - 14, f0.y - 18, f5.x + f5.w - f0.x + 28, f5.y + f5.h - f0.y + 36, 22, 'rgba(255,210,63,0.35)', 'rgba(38,33,58,0.12)', 5, 0);
    ctx.save(); KL.rr(ctx, f0.x - 14, f0.y - 18, f5.x + f5.w - f0.x + 28, f5.y + f5.h - f0.y + 36, 22); ctx.clip();
    ctx.fillStyle = KL.halftone(ctx, C.ink, 18, 2.2, 0.16); ctx.fillRect(0, 0, W, H); ctx.restore();
    for (var e = save.wall.length; e < 6; e++) {
      var er = L.frames[e];
      ctx.setLineDash([10, 8]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(38,33,58,0.3)'; KL.rr(ctx, er.x + 6, er.y + 6, er.w - 12, er.h - 12, 10); ctx.stroke(); ctx.setLineDash([]);
      KL.icon(ctx, 'pin', er.x + er.w / 2, er.y + er.h / 2, 30, 'rgba(38,33,58,0.3)', 'rgba(255,79,154,0.3)');
    }
    if (!save.wall.length) wrap(t('wallEmpty'), f0.x, f5.y + f5.h + 44, f5.x + f5.w - f0.x, 15, C.ink, 2, 'center');
    for (var i = 0; i < save.wall.length; i++) {
      var r = L.frames[i], w = save.wall[i];
      var tilt = ((i * 37) % 7 - 3) * 0.012;
      ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.rotate(tilt); ctx.translate(-r.x - r.w / 2, -r.y - r.h / 2);
      KL.panel(ctx, r.x, r.y, r.w, r.h, 10, C.white, C.ink, 5, 3);
      ctx.fillStyle = [C.pink, C.blue, C.sun, C.mint][i % 4]; ctx.globalAlpha = 0.25; ctx.fillRect(r.x + 10, r.y + 10, r.w - 20, r.h - 44); ctx.globalAlpha = 1;
      var key = w[0] + Math.round(r.w);
      if (!wallCache[key]) { var d = KL.decode(w[0]); wallCache[key] = d ? thumbCanvas(d, r.w - 24, r.h - 52) : null; }
      if (wallCache[key]) ctx.drawImage(wallCache[key], r.x + 12, r.y + 10, r.w - 24, r.h - 52);
      for (var s = 0; s < 5; s++) { ctx.save(); ctx.translate(r.x + r.w / 2 + (s - 2) * 22, r.y + r.h - 20); KL.glyph(ctx, 3, 8); ctx.fillStyle = s < w[1] ? C.orange : C.white; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.restore(); }
      // tape
      ctx.fillStyle = 'rgba(255,210,63,0.8)'; ctx.save(); ctx.translate(r.x + r.w / 2, r.y); ctx.rotate(-0.08); ctx.fillRect(-28, -9, 56, 18); ctx.restore();
      ctx.restore();
      KL.panel(ctx, L.unpins[i].x + 8, L.unpins[i].y + 8, 28, 28, 14, C.white, C.ink, 2, 2.5);
      KL.icon(ctx, 'cross', L.unpins[i].x + 22, L.unpins[i].y + 22, 14, C.ink);
    }
  }

  // ---------- overlays ----------
  function drawMenu() {
    veil(0.5);
    var r = L.mPanel;
    KL.panel(ctx, r.x, r.y, r.w, r.h, 26, C.paper, C.pink, 6, 3);
    KL.text(ctx, t('paused'), r.x + r.w / 2, r.y + 40, 28, C.ink, C.sun, 'center', r.w - 40, '900');
    button(L.mResume, t('resume'), C.blue, C.white, 'play');
    button(L.mSound, save.snd ? t('soundOn') : t('soundOff'), C.white, C.ink, save.snd ? 'sound' : 'mute');
    button(L.mQuit, t('quit'), C.white, C.ink, 'back');
  }
  function drawToast() {
    var a = Math.min(1, toast.t * 3);
    ctx.font = KL.font(16, '900');
    var w = Math.min(W - 32, ctx.measureText(toast.text).width + 36), h = 42;
    var y = scene === 'studio' ? L.shoe.y + L.shoe.h - 120 : H * 0.5 - 21;
    if (scene === 'studio' && L.land) y = L.shoe.y + 60;
    ctx.globalAlpha = a;
    KL.panel(ctx, (W - w) / 2, y, w, h, 21, C.sun, C.ink, 3, 3);
    KL.text(ctx, toast.text, W / 2, y + h / 2 + 1, 16, C.ink, null, 'center', w - 24, '900');
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (scene === 'title') drawTitle();
    else if (scene === 'studio' && S) drawStudio();
    else if (scene === 'shop' && SH) { drawShop(); drawHudShop(); }
    else if (scene === 'wall') drawWall();
    else { ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H); }
    if (menuOpen) drawMenu();
    if (toast.t > 0) drawToast();
  }
  function drawHudShop() { /* shop draws its own header */ }

  // ---------- loop ----------
  function step(dt) {
    toast.t = Math.max(0, toast.t - dt);
    tip.t = Math.max(0, tip.t - dt);
    titleSure = Math.max(0, titleSure - dt);
    tierFlash = Math.max(0, tierFlash - dt);
    updateFx(dt);
    AU.tick();
    if (scene === 'studio' && S && !menuOpen) {
      S.pt += dt;
      if (S.phase === 'enter' && S.pt >= 0.6) { S.phase = 'design'; S.pt = 0; }
      else if (S.phase === 'design') S.t += dt;
      else if (S.phase === 'leave' && S.pt >= 0.5) newClient();
      else if (S.phase === 'result') {
        var n = S.order.reqs.length, k = Math.floor((S.pt - 0.5) / 0.28);
        if (k >= 0 && k < n && k >= (S.shown || 0)) { S.shown = k + 1; AU.play(S.res.r.rows[k].ok ? 'tick' : 'deny'); }
      }
    }
    if (scene === 'shop' && SH) { SH.t += dt; SH.pt = Math.max(0, SH.pt - dt); }
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
    ptr = null;
    AU.halt();
    draw();
  });
  PlayablesSDK.onResume(function () {
    if (!sysPaused) return;
    sysPaused = false;
    AU.unhalt();
    startLoop();
  });
  PlayablesSDK.onAudioChange(function (on) { ytAudio = !!on; applyAudio(); });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  // Test hook: read-only state plus layout rects (it exposes nothing a player cannot see or do).
  function rr(r) { return { x: r.x, y: r.y, w: r.w, h: r.h }; }
  window.__kicksDebug = {
    info: function () {
      var o = { scene: scene, menuOpen: menuOpen, ready: ready, save: JSON.parse(JSON.stringify(save)), sel: JSON.parse(JSON.stringify(sel)) };
      o.layout = { land: L.land, pause: rr(L.pause), done: rr(L.done), undo: rr(L.undo), tools: L.tools.map(rr), chips: L.chips.map(rr), sw: L.sw.map(rr),
        reqs: L.reqs.map(rr), resPin: rr(L.resPin), resNext: rr(L.resNext), tPrimary: rr(L.tPrimary), tSecondary: rr(L.tSecondary),
        offers: L.offers.map(rr), shopNext: rr(L.shopNext), shopWall: rr(L.shopWall), wallBack: rr(L.wallBack), mResume: rr(L.mResume), mQuit: rr(L.mQuit), shoe: rr(L.shoe) };
      if (S) {
        o.phase = S.phase; o.pt = S.pt; o.t = S.t; o.tut = S.tut; o.order = JSON.parse(JSON.stringify(S.order)); o.design = KL.encode(S.design); o.d = JSON.parse(JSON.stringify(S.design));
        o.live = S.live.slice(); o.result = S.res ? { stars: S.res.r.stars, total: S.res.r.total, pay: S.res.pay, rep: S.res.rep, rows: S.res.r.rows.map(function (q) { return q.ok; }) } : null;
        o.resultDone = resultDone();
        shoeView(S.design.s);
        o.anchors = []; for (var z = 0; z < 8; z++) { var a = KL.anchor(S.design.s, z); o.anchors.push(toScreen(a[0], a[1])); }
        var spot = nextSpot(), p = KL.stickerXY(S.design.s, spot[0], spot[1]); o.panelSpot = toScreen(p[0], p[1]);
        o.spots = KL.SPOTS.map(function (sp) { var q = KL.stickerXY(S.design.s, sp[0], sp[1]); return toScreen(q[0], q[1]); });
      }
      if (SH) o.shop = { offers: SH.offers.map(function (q) { return { k: q.k, i: q.i, price: q.price }; }), bought: SH.bought.slice() };
      return o;
    },
    // The design the solver would make for the current order (used by tests to choose real taps).
    solution: function () { if (!S) return null; var d = KL.solve(S.order, U_()); return d ? JSON.parse(JSON.stringify(d)) : null; },
    selfCheck: function (n) { return KL.selfCheck(n || 60, 3); }
  };

  // ---------- boot ----------
  resize();
  draw();
  PlayablesSDK.firstFrameReady();
  Promise.all([PlayablesSDK.load(), PlayablesSDK.getLanguage()]).then(function (res) {
    applySave(res[0]);
    KL.setLang(res[1]);
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
