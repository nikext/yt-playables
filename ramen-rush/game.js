/* Ramen Rush: game state, layout, input, screens and the Playables lifecycle. */
(function () {
  'use strict';
  var RR = window.RR, C = RR.C, PlayablesSDK = window.PlayablesSDK, AU = RR.Audio, t = RR.t;
  var TAU = Math.PI * 2;

  PlayablesSDK.init({ storageKey: 'ramen-rush_save' });

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = 390, H = 844, DPR = 1, U = 390;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
  function easeBack(x) { x = clamp(x, 0, 1); var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }

  // ---------- state ----------
  var save = defaults();
  function defaults() { return { v: 1, day: 1, coins: 0, total: 0, best: 0, rep: 50, up: [0, 0, 0, 0, 0], sp: 0, st: '', snd: 1, tut: 0, sh: 0, played: 0 }; }
  var scene = 'title', ready = false, sysPaused = false, ytAudio = PlayablesSDK.isAudioEnabled();
  var menuOpen = false, needTap = false, time = 0, lastTs = 0, raf = 0;
  var G = null;      // the current shift session
  var RES = null;    // the last day's result (summary screen)
  var SHOP = null;   // shop session
  var titleSure = 0;
  var toast = { text: '', t: 0 };
  var ptr = null;    // active pointer: {id, x0, y0, x, y, src, drag}
  var focus = -1;    // keyboard focus index into L.targets
  var fx = [];       // particles and floating texts
  var fly = [];      // items flying from a station to a bowl
  var shake = {};    // shake timers per target key

  function rect() { return { x: 0, y: 0, w: 0, h: 0 }; }
  function setR(o, x, y, w, h) { o.x = x; o.y = y; o.w = w; o.h = h; return o; }
  function inR(o, x, y) { return o && o.w > 0 && x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h; }
  function cx(r) { return r.x + r.w / 2; }
  function cy(r) { return r.y + r.h / 2; }

  var L = {
    land: false, pause: rect(), dayPill: rect(), coinPill: rect(), counterY: 300, counterH: 100, custTop: 70, kTop: 400,
    seats: [], slots: [], trash: rect(), st: [], burn: [], targets: [],
    tPrimary: rect(), tSecondary: rect(), tSound: rect(),
    mPanel: rect(), mResume: rect(), mSound: rect(), mQuit: rect(),
    sPanel: rect(), sNext: rect(), cards: [], shopNext: rect(), shopHome: rect(), hint: rect()
  };
  for (var li = 0; li < 9; li++) L.cards.push(rect());

  // ---------- layout ----------
  function placeRow(list, x, y, w, h, maxW, maxH, gap) {
    var n = list.length; if (!n) return;
    var cw = Math.min(maxW, w / n), ch = Math.min(maxH, h);
    var x0 = x + (w - n * cw) / 2, y0 = y + (h - ch) / 2;
    for (var i = 0; i < n; i++) setR(list[i], x0 + i * cw + gap / 2, y0 + gap / 2, cw - gap, ch - gap);
  }
  function placeGrid(list, x, y, w, h, rows, maxW, maxH, gap) {
    var n = list.length; if (!n) return;
    rows = Math.min(rows, n);
    var cols = Math.ceil(n / rows), rh = h / rows;
    for (var r = 0; r < rows; r++) placeRow(list.slice(r * cols, Math.min(n, (r + 1) * cols)), x, y + r * rh, w, rh, maxW, maxH, gap);
  }
  function stationsFor(sh) {
    var st = [], k, i;
    for (k = 0; k < 4; k++) for (i = 0; i < sh.own[k].length; i++) st.push({ k: k, n: sh.own[k][i], r: rect() });
    return st;
  }
  function layout() {
    var p = 14;
    U = Math.min(W, H);
    L.land = W > H * 1.05;
    var hb = clamp(U * 0.12, 44, 52);
    setR(L.pause, p, p, hb, hb);
    var pillW = Math.min(L.land ? 260 : (W - 2 * p - hb - 20) * 0.4, 280);
    setR(L.dayPill, p + hb + 10, p, pillW, hb);
    var cw = Math.min(L.land ? 300 : W - 2 * p - hb - 10 - pillW - 10, 320);
    setR(L.coinPill, W - p - cw, p, cw, hb);
    if (L.land) { L.counterY = Math.round(H * 0.42); L.counterH = Math.round(clamp(H * 0.19, 66, 140)); }
    else { L.counterY = Math.round(H * 0.37); L.counterH = Math.round(clamp(H * 0.125, 80, 118)); }
    L.custTop = p + hb + 8;
    L.kTop = L.counterY + L.counterH + 10;
    L.aw = clamp(H * 0.05, 26, 44);
    setR(L.hint, p, L.custTop, W - 2 * p, Math.min(54, (L.counterY - L.custTop) * 0.3));
    if (G) layoutPlay();
    if (L.land && L.seats.length > 1) {
      var hs = L.seats[1], hh = Math.min(96, L.counterY - L.custTop - 16);
      setR(L.hint, hs.x + 8, L.custTop + (L.counterY - L.custTop - hh) / 2 - 4, hs.w - 16, hh);
    }
    layoutMenus();
    bgCache = null; kitCache = null;
  }
  function layoutPlay() {
    var sh = G.sh, p = 14, i;
    // customers
    var n = sh.seats.length, colW = Math.min((W - 2 * p) / n, L.land ? 300 : 999);
    var x0 = (W - n * colW) / 2;
    L.seats = [];
    for (i = 0; i < n; i++) L.seats.push(setR(rect(), x0 + i * colW, L.custTop, colW, L.counterY - L.custTop + 6));
    // bowls on the counter, then the bin
    var ns = sh.slots.length, tc = 0.75, cells = ns + tc;
    var cellW = Math.min(L.land ? 150 : 112, (W - 2 * p) / cells), gx = (W - cells * cellW) / 2;
    L.slots = [];
    for (i = 0; i < ns; i++) L.slots.push(setR(rect(), gx + i * cellW + 2, L.counterY + 2, cellW - 4, L.counterH - 4));
    setR(L.trash, gx + ns * cellW + 2, L.counterY + 2, cellW * tc - 4, L.counterH - 4);
    // kitchen stations
    L.st = stationsFor(sh);
    L.burn = [];
    for (i = 0; i < sh.boilers.length; i++) L.burn.push(rect());
    var pots = [], crates = [], trays = [];
    L.st.forEach(function (s) { (s.k === 0 ? pots : s.k === 1 ? crates : trays).push(s.r); });
    var top = L.kTop, bot = H - p, kh = bot - top, gap = 6;
    if (!L.land) {
      var tRows = trays.length > 5 ? 2 : 1, wsum = 1 + 1 + tRows * 0.9, y = top;
      var hP = kh * 1 / wsum, hN = kh * 1 / wsum, hT = kh * tRows * 0.9 / wsum;
      placeRow(pots, p, y, W - 2 * p, hP, 120, 130, gap); y += hP;
      placeRow(crates.concat(L.burn), p, y, W - 2 * p, hN, 112, 130, gap); y += hN;
      placeGrid(trays, p, y, W - 2 * p, hT, tRows, 100, 110, gap);
    } else {
      var cP = Math.ceil(pots.length / 2), cN = Math.max(crates.length, L.burn.length), cT = Math.ceil(trays.length / 2);
      var units = cP + cN + cT, gg = 18, avail = W - 2 * p - 2 * gg, uw = Math.min(avail / units, 170);
      var tot = units * uw + 2 * gg, x = (W - tot) / 2;
      placeGrid(pots, x, top, cP * uw, kh, 2, 150, 140, gap); x += cP * uw + gg;
      placeRow(crates, x, top, cN * uw, kh / 2, 150, 140, gap);
      placeRow(L.burn, x, top + kh / 2, cN * uw, kh / 2, 150, 140, gap); x += cN * uw + gg;
      placeGrid(trays, x, top, cT * uw, kh, 2, 150, 140, gap);
    }
    // keyboard focus order
    L.targets = [];
    for (i = 0; i < n; i++) L.targets.push({ kind: 'seat', i: i, r: L.seats[i] });
    for (i = 0; i < ns; i++) L.targets.push({ kind: 'slot', i: i, r: L.slots[i] });
    L.targets.push({ kind: 'trash', i: 0, r: L.trash });
    L.st.forEach(function (s, j) { if (s.k === 1) return; L.targets.push({ kind: 'st', i: j, r: s.r }); });
    L.st.forEach(function (s, j) { if (s.k === 1) L.targets.push({ kind: 'st', i: j, r: s.r }); });
    for (i = 0; i < L.burn.length; i++) L.targets.push({ kind: 'burn', i: i, r: L.burn[i] });
    if (focus >= L.targets.length) focus = -1;
    kitCache = null;
  }
  function layoutMenus() {
    var p = 14, bw = Math.min(W - 2 * p - 20, 360), bh = 58;
    setR(L.tSound, W - p - 50, p, 50, 50);
    var mw = Math.min(W - 40, 340), mh = 280;
    setR(L.mPanel, (W - mw) / 2, (H - mh) / 2, mw, mh);
    setR(L.mResume, L.mPanel.x + 24, L.mPanel.y + 76, mw - 48, 52);
    setR(L.mSound, L.mPanel.x + 24, L.mPanel.y + 140, mw - 48, 52);
    setR(L.mQuit, L.mPanel.x + 24, L.mPanel.y + 204, mw - 48, 52);
    var sw = Math.min(W - 28, 460), shh = Math.min(H - 28, 520);
    setR(L.sPanel, (W - sw) / 2, (H - shh) / 2, sw, shh);
    setR(L.sNext, L.sPanel.x + 24, L.sPanel.y + shh - 76, sw - 48, 56);
    // shop: 9 cards
    var hdr = 76, foot = 86, gx = 10, cols = L.land ? (W > 1000 ? 5 : 4) : (W >= 560 ? 3 : 2), rows = Math.ceil(9 / cols);
    var aw = Math.min(W - 2 * p, L.land ? 1180 : 720), ah = H - hdr - foot - p;
    var cwid = (aw - (cols - 1) * gx) / cols, chei = Math.min(L.land ? 150 : 170, (ah - (rows - 1) * gx) / rows);
    var ox = (W - aw) / 2, oy = hdr + Math.max(0, (ah - rows * chei - (rows - 1) * gx) / 2);
    for (var i = 0; i < 9; i++) {
      var r = Math.floor(i / cols), c = i % cols, inRow = r === rows - 1 ? 9 - r * cols : cols;
      var rx = ox + (aw - (inRow * cwid + (inRow - 1) * gx)) / 2;
      setR(L.cards[i], rx + c * (cwid + gx), oy + r * (chei + gx), cwid, chei);
    }
    // title: decorative kitchen around the buttons
    L.tDecor = [];
    var kt = L.kTop + 4;
    if (!L.land) {
      var dh = Math.min(118, H * 0.14), row = [[0, 0], [9, 0], [0, 1]];
      var dw = Math.min(118, (W - 2 * p) / 3);
      row.forEach(function (d, i) { L.tDecor.push({ k: d[0], n: d[1], r: setR(rect(), W / 2 + (i - 1.5) * dw + 4, kt, dw - 8, dh) }); });
      setR(L.tPrimary, (W - bw) / 2, kt + dh + 16, bw, bh);
      setR(L.tSecondary, (W - bw) / 2 + bw * 0.15, L.tPrimary.y + bh + 14, bw * 0.7, 46);
      var trY = Math.max(L.tSecondary.y + 60, H - p - 96), trW = Math.min(100, (W - 2 * p) / 4);
      if (H - p - trY >= 70) [[2, 0], [2, 3], [2, 1], [2, 2]].forEach(function (d, i) { L.tDecor.push({ k: d[0], n: d[1], r: setR(rect(), W / 2 + (i - 2) * trW + 4, trY, trW - 8, Math.min(96, H - p - trY)) }); });
    } else {
      var kh2 = H - p - kt, cw2 = Math.min(150, kh2 * 1.1, (W - bw) / 2 / 2.4);
      [[0, 0], [0, 1]].forEach(function (d, i) { L.tDecor.push({ k: d[0], n: d[1], r: setR(rect(), (W - bw) / 2 - 20 - (2 - i) * cw2, kt + (kh2 - cw2) / 2, cw2 - 8, cw2) }); });
      [[9, 0], [2, 3]].forEach(function (d, i) { L.tDecor.push({ k: d[0], n: d[1], r: setR(rect(), (W + bw) / 2 + 20 + i * cw2 + 8, kt + (kh2 - cw2) / 2, cw2 - 8, cw2) }); });
      setR(L.tPrimary, (W - bw) / 2, kt + Math.max(6, (kh2 - bh - 60) / 2), bw, bh);
      setR(L.tSecondary, (W - bw) / 2 + bw * 0.15, L.tPrimary.y + bh + 12, bw * 0.7, 44);
    }
    var nb = Math.min(W - 2 * p - 70, 380);
    setR(L.shopNext, (W - nb) / 2 + 30, H - foot + 14, nb, 56);
    setR(L.shopHome, L.shopNext.x - 66, H - foot + 20, 50, 50);
  }

  function resize() {
    W = Math.max(200, window.innerWidth || 390);
    H = Math.max(200, window.innerHeight || 844);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    layout();
    if (!raf || sysPaused) draw();
  }

  // ---------- persistence ----------
  function num(v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? clamp(v, lo, hi) : def; }
  function applySave(d) {
    if (!d || d.v !== 1) return;
    var s = defaults();
    s.day = num(d.day, 1, 99999, 1);
    s.coins = num(d.coins, 0, 1e9, 0);
    s.total = num(d.total, 0, 1e12, 0);
    s.best = num(d.best, 0, 99999, 0);
    s.rep = num(d.rep, 0, 100, 50);
    if (Array.isArray(d.up)) for (var i = 0; i < RR.UPS.length; i++) s.up[i] = num(d.up[i], 0, RR.UPS[i].prices.length, 0);
    s.sp = num(d.sp, 0, RR.ALL_SP, 0);
    s.st = typeof d.st === 'string' ? d.st.replace(/[^0-3]/g, '').slice(0, 200) : '';
    s.snd = d.snd === 0 ? 0 : 1;
    s.tut = d.tut ? 1 : 0;
    s.sh = d.sh ? 1 : 0;
    s.played = num(d.played, 0, 1e9, 0);
    save = s;
  }
  function persist() { PlayablesSDK.save(save); }

  // ---------- shift ----------
  function startShift() {
    var tut = !save.tut && save.day === 1;
    var sh = new RR.Shift({ day: save.day, up: save.up, sp: save.sp, rep: save.rep, seed: (save.day * 7919 + save.played * 104729 + 17) >>> 0, tutorial: tut });
    G = { sh: sh, intro: tut ? 0 : 2.4, introMax: 2.4, endT: -1, tutDone: !tut, tip: false, bubbleT: 0, closeT: 0, lastAdd: {}, news: RR.newOnDay(save.day), looks: {} };
    scene = 'play'; menuOpen = false; needTap = false; fx = []; fly = []; shake = {}; ptr = null; focus = -1;
    layout();
    AU.music(true, 0.5);
    AU.play('whoosh');
  }
  function lookFor(c) { return G.looks[c.id] || (G.looks[c.id] = RR.look(c.look)); }
  function seatPos(i) {
    var r = L.seats[i], zone = L.counterY - L.custTop, hr = Math.min(r.w * 0.24, zone * (zone < 190 ? 0.26 : 0.16), 50);
    return { x: cx(r), y: L.counterY - hr * 1.45, r: hr };
  }
  function slotPos(i) { var r = L.slots[i]; return { x: cx(r), y: r.y + r.h * 0.42, r: Math.min(r.w * 0.41, r.h * 0.37) }; }

  function stationTap(j, prefSlot) {
    var s = L.st[j], sh = G.sh, res;
    if (!s) return;
    if (s.k === 1) {
      res = sh.boil(s.n);
      if (res >= 0) flyItem(1, s.n, s.r, L.burn[res], null);
      else showToast(t('noBurner'));
      return;
    }
    res = sh.add(s.k, s.n, prefSlot);
    if (res >= 0) flyItem(s.k, s.n, s.r, L.slots[res], null);
    else shakeKey('st' + j);
  }
  function burnerTap(i, prefSlot) {
    var sh = G.sh, b = sh.boilers[i];
    if (b.st === 1) { showToast(t('notReady')); shakeKey('b' + i); AU.play('deny'); return; }
    if (b.st === 0) return;
    var n = b.n, res = sh.drain(i, prefSlot);
    if (res >= 0) flyItem(1, n, L.burn[i], L.slots[res], null);
    else if (b.st === 2) shakeKey('b' + i);
  }
  function slotTap(i) {
    var sh = G.sh;
    if (sh.sel === i && RR.bowlReady(sh.slots[i])) {
      // a second tap on a ready bowl serves whoever ordered exactly that
      var best = -1;
      for (var s = 0; s < sh.seats.length; s++) {
        var c = sh.waiting(s);
        if (c && RR.matches(sh.slots[i], c.o) && (best < 0 || c.pat < sh.seats[best].pat)) best = s;
      }
      if (best >= 0) { serve(i, best); return; }
    }
    sh.select(i);
    AU.play('click');
  }
  function serve(slot, seat) {
    var sh = G.sh, b = sh.slots[slot], snap = { broth: b.broth, noodle: b.noodle, tops: b.tops.slice(), drink: b.drink };
    var res = sh.serve(slot, seat);
    if (res) flyItem(-1, snap, L.slots[slot], null, seatPos(seat));
    return res;
  }
  function seatTap(i) {
    var sh = G.sh, c = sh.waiting(i);
    if (!c) return;
    var before = sh.slots.map(function (b) { return { broth: b.broth, noodle: b.noodle, tops: b.tops.slice(), drink: b.drink }; });
    var res = sh.serveTap(i);
    if (res) {
      for (var s = 0; s < sh.slots.length; s++) if (RR.bowlEmpty(sh.slots[s]) && !RR.bowlEmpty(before[s])) { flyItem(-1, before[s], L.slots[s], null, seatPos(i)); break; }
    }
  }
  function closeTip() { G.tip = false; G.sh.hold = false; AU.play('click'); }
  function trashTap(slot) { G.sh.trash(slot == null ? G.sh.sel : slot); }

  function flyItem(k, n, from, to, pos) {
    var x1 = to ? cx(to) : pos.x, y1 = to ? (to === L.slots[0] || L.slots.indexOf(to) >= 0 ? slotPos(L.slots.indexOf(to)).y : cy(to)) : pos.y + pos.r * 1.2;
    fly.push({ k: k, n: n, x0: cx(from), y0: from === L.trash ? cy(from) : (L.slots.indexOf(from) >= 0 ? slotPos(L.slots.indexOf(from)).y : cy(from)), x1: x1, y1: y1, t: 0, dur: k < 0 ? 0.28 : 0.22 });
  }
  function shakeKey(k) { shake[k] = 0.35; }

  // Events from the simulation become sound, particles and text.
  function handleEvents() {
    var ev = G.sh.ev, sh = G.sh;
    for (var i = 0; i < ev.length; i++) {
      var e = ev[i];
      if (e.type === 'arrive') AU.play('arrive');
      else if (e.type === 'add') {
        var sp = slotPos(e.slot);
        if (e.k === 0) { AU.play('pour'); splash(sp.x, sp.y, RR.F.broth[e.n]); }
        else if (e.k === 1) AU.play('drain');
        else AU.play('plop');
        G.lastAdd[e.slot] = time;
        if (!G.tutDone) { /* tutorial follows the state */ }
      } else if (e.type === 'boil') AU.play('sizzle');
      else if (e.type === 'ready') AU.play('ready');
      else if (e.type === 'over') { AU.play('over'); showToast(t('overcooked')); }
      else if (e.type === 'dump') { AU.play('trash'); puff(cx(L.burn[e.b]), cy(L.burn[e.b])); }
      else if (e.type === 'trash') { AU.play('trash'); puff(cx(L.trash), cy(L.trash)); }
      else if (e.type === 'served') {
        var p = seatPos(e.seat);
        AU.play('chime');
        setTimeout(function () { AU.play('coin'); }, 140);
        floatText('+' + (e.price + e.tip + e.bonus), p.x, p.y - p.r * 1.6, C.glow, 26);
        if (e.streak >= 2) floatText(t('streakN', e.streak), p.x, p.y - p.r * 0.6, C.cream, 16, 0.25);
        sparkle(p.x, p.y - p.r, e.vip ? C.gold : C.glow, e.vip ? 18 : 10);
        if (!G.tutDone) { G.tutDone = true; G.tip = true; sh.hold = true; save.tut = 1; persist(); }
      } else if (e.type === 'lost') {
        var q = seatPos(e.seat);
        AU.play('angry');
        floatText(e.why === 'wrong' ? t('wrong') : t('gaveUp'), q.x, q.y - q.r * 1.7, '#FF8A7A', 17);
      } else if (e.type === 'closing') { AU.play('closing'); G.closeT = 2.2; }
      else if (e.type === 'end') G.endT = 1.3;
      else if (e.type === 'deny') {
        AU.play('deny');
        if (e.full) showToast(t('noBurner'));
        else if (e.incomplete) { showToast(t('needBase')); shakeKey('s' + e.slot); }
        else if (e.slot != null) shakeKey('s' + e.slot);
        else shakeKey('s' + sh.sel);
      }
    }
    ev.length = 0;
  }

  function endShift() {
    var r = G.sh.result(), day = save.day;
    save.coins += r.coins; save.total += r.coins; save.rep = r.rep; save.played++;
    if (r.stars >= 1) {
      var prev = +(save.st[day - 1] || 0);
      while (save.st.length < day - 1) save.st += '0';
      if (day - 1 < 200) save.st = save.st.slice(0, day - 1) + Math.max(prev, r.stars) + save.st.slice(day);
      save.best = Math.max(save.best, day);
      save.day = day + 1;
    }
    save.sh = 1;
    persist();
    PlayablesSDK.sendScore(save.total);
    RES = { r: r, day: day, t: 0, shown: 0, master: r.stars >= 1 && day === RR.CAMPAIGN_DAYS };
    scene = 'summary'; G = null; menuOpen = false; needTap = false; fx = []; fly = [];
    AU.music(true, 1);
    AU.play(r.stars >= 1 ? 'chime' : 'fail');
    layout();
  }

  // ---------- shop ----------
  function shopItems() {
    var items = [], i;
    for (i = 0; i < RR.UPS.length; i++) items.push({ kind: 'up', i: i });
    for (i = 0; i < RR.SPECIALS.length; i++) items.push({ kind: 'sp', i: i });
    return items;
  }
  function itemState(it) {
    if (it.kind === 'up') {
      var u = RR.UPS[it.i], lvl = save.up[it.i];
      if (lvl >= u.prices.length) return { done: true, lvl: lvl, max: u.prices.length };
      return { price: u.prices[lvl], lvl: lvl, max: u.prices.length };
    }
    var s = RR.SPECIALS[it.i];
    if ((save.sp >> it.i) & 1) return { done: true };
    if (save.day < s.day) return { locked: s.day, price: s.price };
    return { price: s.price };
  }
  function openShop() {
    SHOP = { t: 0, items: shopItems(), pulse: -1, pt: 0 };
    scene = 'shop'; save.sh = 1;
    AU.music(true, 1);
    layout();
  }
  function buy(i) {
    var it = SHOP.items[i];
    if (!it) return;
    var s = itemState(it);
    if (s.done || s.locked) { AU.play('deny'); return; }
    if (save.coins < s.price) { AU.play('deny'); showToast(t('broke')); SHOP.shake = i; SHOP.st = 0.35; return; }
    save.coins -= s.price;
    if (it.kind === 'up') save.up[it.i]++; else save.sp |= 1 << it.i;
    SHOP.pulse = i; SHOP.pt = 0.6;
    AU.play('buy');
    sparkle(cx(L.cards[i]), cy(L.cards[i]), C.glow, 14);
    persist();
  }
  function nextDayFromShop() { save.sh = 0; persist(); startShift(); }
  function goTitle() { scene = 'title'; G = null; SHOP = null; RES = null; menuOpen = false; needTap = false; titleSure = 0; AU.music(true, 1); layout(); }
  function hasProgress() { return save.day > 1 || save.played > 0 || save.coins > 0; }
  function titlePrimary() {
    AU.play('click');
    if (save.sh) openShop(); else startShift();
  }
  function newGame() {
    var snd = save.snd;
    save = defaults(); save.snd = snd;
    persist();
    titleSure = 0;
    startShift();
  }
  function soundToggle() { save.snd = save.snd ? 0 : 1; applyAudio(); persist(); AU.play('click'); }
  function applyAudio() { AU.setWanted(ytAudio && !!save.snd); }
  function showToast(s, d) { toast.text = s; toast.t = d || 1.8; }

  // ---------- particles ----------
  function emit(k, x, y, vx, vy, life, s, col, txt) { if (fx.length < 220) fx.push({ k: k, x: x, y: y, vx: vx, vy: vy, life: life, max: life, s: s, col: col, txt: txt }); }
  function splash(x, y, col) { for (var i = 0; i < 8; i++) { var a = -Math.PI * (0.15 + 0.7 * Math.random()); emit(0, x, y, Math.cos(a) * 90, Math.sin(a) * 120, 0.45, 3 + Math.random() * 2.5, col); } }
  function sparkle(x, y, col, n) { for (var i = 0; i < n; i++) { var a = Math.random() * TAU, v = 60 + Math.random() * 110; emit(1, x, y, Math.cos(a) * v, Math.sin(a) * v - 40, 0.7, 3 + Math.random() * 3, col); } }
  function puff(x, y) { for (var i = 0; i < 7; i++) { var a = Math.random() * TAU; emit(2, x, y, Math.cos(a) * 40, Math.sin(a) * 30 - 30, 0.6, 8 + Math.random() * 6, 'rgba(255,243,224,0.5)'); } }
  function floatText(s, x, y, col, px, delay) { fx.push({ k: 3, x: x, y: y, vx: 0, vy: -38, life: 1.3 + (delay || 0), max: 1.3 + (delay || 0), s: px, col: col, txt: s, delay: delay || 0 }); }
  function updateFx(dt) {
    for (var i = fx.length - 1; i >= 0; i--) {
      var p = fx[i];
      p.life -= dt;
      if (p.life <= 0) { fx.splice(i, 1); continue; }
      if (p.delay && p.max - p.life < p.delay) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 0 || p.k === 1) p.vy += 320 * dt;
      if (p.k === 2) { p.s += 14 * dt; }
    }
    for (var j = fly.length - 1; j >= 0; j--) { fly[j].t += dt; if (fly[j].t >= fly[j].dur) fly.splice(j, 1); }
    for (var key in shake) { shake[key] -= dt; if (shake[key] <= 0) delete shake[key]; }
  }
  function drawFx() {
    for (var i = 0; i < fx.length; i++) {
      var p = fx[i], a = clamp(p.life / p.max * 1.6, 0, 1);
      if (p.delay && p.max - p.life < p.delay) continue;
      ctx.globalAlpha = a;
      if (p.k === 3) RR.text(ctx, p.txt, p.x, p.y, p.s, p.col, 'center', W * 0.4, '900', 'rgba(20,8,14,0.9)');
      else if (p.k === 1) RR.star(ctx, p.x, p.y, p.s, true);
      else { RR.circle(ctx, p.x, p.y, p.s); ctx.fillStyle = p.col; ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    for (var j = 0; j < fly.length; j++) {
      var f = fly[j], u = ease(f.t / f.dur), x = f.x0 + (f.x1 - f.x0) * u, y = f.y0 + (f.y1 - f.y0) * u - Math.sin(u * Math.PI) * 40;
      if (f.k < 0) RR.bowl(ctx, x, y, slotR() * (1 - u * 0.35), f.n, time, false);
      else RR.icon(ctx, f.k, f.n, x, y, 30);
    }
  }
  function slotR() { return L.slots.length ? slotPos(0).r : 30; }

  // ---------- input ----------
  function hitPlay(x, y) {
    var i;
    for (i = 0; i < L.slots.length; i++) if (inR(L.slots[i], x, y)) return { kind: 'slot', i: i };
    if (inR(L.trash, x, y)) return { kind: 'trash' };
    for (i = 0; i < L.burn.length; i++) if (inR(L.burn[i], x, y)) return { kind: 'burn', i: i };
    for (i = 0; i < L.st.length; i++) if (inR(L.st[i].r, x, y)) return { kind: 'st', i: i };
    for (i = 0; i < L.seats.length; i++) if (inR(L.seats[i], x, y) && y < L.counterY) return { kind: 'seat', i: i };
    return null;
  }
  function onDown(x, y, id) {
    AU.unlock();
    if (!ready) return;
    if (needTap) { needTap = false; AU.play('tick'); return; }
    if (scene === 'play' && !menuOpen) {
      if (inR(L.pause, x, y)) { menuOpen = true; AU.play('click'); return; }
      if (G.intro > 0) { if (G.intro < G.introMax - 0.3) G.intro = 0; return; }
      if (G.tip) { closeTip(); return; }
      var h = hitPlay(x, y);
      ptr = { id: id, x0: x, y0: y, x: x, y: y, src: h, drag: false };
      return;
    }
    ptr = { id: id, x0: x, y0: y, x: x, y: y, src: null, drag: false };
  }
  function canDrag(h) {
    if (!h || !G) return false;
    if (h.kind === 'slot') return !RR.bowlEmpty(G.sh.slots[h.i]);
    if (h.kind === 'st') return L.st[h.i].k !== 1;
    if (h.kind === 'burn') return G.sh.boilers[h.i].st === 2;
    return false;
  }
  function onMove(x, y, id) {
    if (!ptr || ptr.id !== id) return;
    ptr.x = x; ptr.y = y;
    if (!ptr.drag && scene === 'play' && canDrag(ptr.src) && Math.hypot(x - ptr.x0, y - ptr.y0) > 12) ptr.drag = true;
  }
  function onUp(x, y, id) {
    if (!ptr || ptr.id !== id) return;
    var p = ptr; ptr = null;
    if (scene === 'play' && !menuOpen && G) {
      if (p.drag) { drop(p.src, x, y); return; }
      if (Math.hypot(x - p.x0, y - p.y0) > 24) return;
      var h = p.src;
      if (!h) return;
      tapTarget(h);
      return;
    }
    if (Math.hypot(x - p.x0, y - p.y0) > 30) return;
    tapMenus(x, y);
  }
  function tapTarget(h) {
    if (h.kind === 'slot') slotTap(h.i);
    else if (h.kind === 'trash') trashTap();
    else if (h.kind === 'burn') burnerTap(h.i);
    else if (h.kind === 'st') stationTap(h.i);
    else if (h.kind === 'seat') seatTap(h.i);
  }
  function drop(src, x, y) {
    var h = hitPlay(x, y), sh = G.sh;
    if (src.kind === 'slot') {
      if (h && h.kind === 'seat') { if (sh.waiting(h.i)) serve(src.i, h.i); return; }
      if (h && h.kind === 'trash') { sh.trash(src.i); return; }
      // a drop near a customer's column above the counter still counts
      if (y < L.counterY) for (var i = 0; i < L.seats.length; i++) if (x >= L.seats[i].x && x <= L.seats[i].x + L.seats[i].w && sh.waiting(i)) { serve(src.i, i); return; }
      return;
    }
    if (!h || h.kind !== 'slot') return;
    if (src.kind === 'st') stationTap(src.i, h.i);
    else if (src.kind === 'burn') burnerTap(src.i, h.i);
  }
  function tapMenus(x, y) {
    if (scene === 'play' && menuOpen) {
      if (inR(L.mResume, x, y)) { menuOpen = false; AU.play('click'); }
      else if (inR(L.mSound, x, y)) soundToggle();
      else if (inR(L.mQuit, x, y)) { AU.play('click'); goTitle(); }
      else if (!inR(L.mPanel, x, y)) { menuOpen = false; AU.play('click'); }
      return;
    }
    if (scene === 'title') {
      if (inR(L.tSound, x, y)) { soundToggle(); return; }
      if (inR(L.tPrimary, x, y)) { titleSure = 0; titlePrimary(); return; }
      if (hasProgress() && inR(L.tSecondary, x, y)) {
        if (titleSure > 0) newGame(); else { titleSure = 3; AU.play('click'); }
      }
      return;
    }
    if (scene === 'summary') {
      if (inR(L.sNext, x, y) && RES.t > 0.6) { AU.play('click'); openShop(); }
      else if (RES.t > 0.3) RES.t = Math.max(RES.t, 2.2);
      return;
    }
    if (scene === 'shop') {
      for (var i = 0; i < SHOP.items.length; i++) if (inR(L.cards[i], x, y)) { buy(i); return; }
      if (inR(L.shopNext, x, y)) { AU.play('click'); nextDayFromShop(); return; }
      if (inR(L.shopHome, x, y)) { AU.play('click'); goTitle(); }
    }
  }
  function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    var p = pos(e); onDown(p.x, p.y, e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) { var p = pos(e); onMove(p.x, p.y, e.pointerId); });
  canvas.addEventListener('pointerup', function (e) { var p = pos(e); onUp(p.x, p.y, e.pointerId); });
  canvas.addEventListener('pointercancel', function () { ptr = null; });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function moveFocus(dx, dy) {
    var T = L.targets;
    if (!T.length) return;
    if (focus < 0) { focus = L.targets.length > L.seats.length ? L.seats.length : 0; return; }
    var a = T[focus].r, ax = cx(a), ay = cy(a), best = -1, bd = 1e9;
    for (var i = 0; i < T.length; i++) {
      if (i === focus) continue;
      var bx = cx(T[i].r) - ax, by = cy(T[i].r) - ay, along = bx * dx + by * dy;
      if (along <= 4) continue;
      var perp = Math.abs(bx * dy - by * dx), d = along + perp * 2.2;
      if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0) focus = best;
    AU.play('tick');
  }
  window.addEventListener('keydown', function (e) {
    if (!ready) return;
    AU.unlock();
    var k = e.key, low = k.length === 1 ? k.toLowerCase() : k;
    if (needTap) { needTap = false; e.preventDefault(); return; }
    if (low === 'm') { soundToggle(); return; }
    if (scene === 'play' && G) {
      if (k === 'Escape' || low === 'p') { menuOpen = !menuOpen; AU.play('click'); e.preventDefault(); return; }
      if (menuOpen) { if (k === 'Enter' || k === ' ') { menuOpen = false; e.preventDefault(); } else if (low === 'q') goTitle(); return; }
      if (G.intro > 0) { if (k === 'Enter' || k === ' ') G.intro = 0; e.preventDefault(); return; }
      if (G.tip) { if (k === 'Enter' || k === ' ') closeTip(); e.preventDefault(); return; }
      if (k >= '1' && k <= '4') { var si = +k - 1; if (si < L.slots.length) slotTap(si); e.preventDefault(); return; }
      if (low === 'x' || k === 'Delete' || k === 'Backspace') { trashTap(); e.preventDefault(); return; }
      if (k === 'ArrowLeft') { moveFocus(-1, 0); e.preventDefault(); return; }
      if (k === 'ArrowRight') { moveFocus(1, 0); e.preventDefault(); return; }
      if (k === 'ArrowUp') { moveFocus(0, -1); e.preventDefault(); return; }
      if (k === 'ArrowDown') { moveFocus(0, 1); e.preventDefault(); return; }
      if (k === 'Tab') { focus = (focus + (e.shiftKey ? -1 : 1) + L.targets.length) % L.targets.length; e.preventDefault(); return; }
      if ((k === 'Enter' || k === ' ') && focus >= 0) { tapTarget(L.targets[focus]); e.preventDefault(); return; }
      return;
    }
    if (scene === 'title') {
      if (k === 'Enter' || k === ' ') { titlePrimary(); e.preventDefault(); }
      else if (low === 'n' && hasProgress()) { if (titleSure > 0) newGame(); else titleSure = 3; }
      return;
    }
    if (scene === 'summary') { if ((k === 'Enter' || k === ' ') && RES.t > 0.6) { openShop(); e.preventDefault(); } return; }
    if (scene === 'shop') {
      if (k >= '1' && k <= '9') buy(+k - 1);
      else if (k === 'Enter' || k === ' ') { nextDayFromShop(); e.preventDefault(); }
      else if (k === 'Escape') goTitle();
    }
  });

  // ---------- drawing: shared ----------
  var bgCache = null, kitCache = null;
  function offscreen(w, h) { var cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w * DPR)); cv.height = Math.max(1, Math.round(h * DPR)); var g = cv.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0); return { cv: cv, g: g }; }
  function drawBg() {
    if (!bgCache) { var o = offscreen(W, H); RR.backdrop(o.g, W, H, L); bgCache = o.cv; }
    ctx.drawImage(bgCache, 0, 0, W, H);
  }
  function button(r, label, fill, col, icon) {
    var press = ptr && !ptr.drag && inR(r, ptr.x, ptr.y) ? 2 : 0;
    RR.panel(ctx, r.x, r.y + press, r.w, r.h, Math.min(18, r.h / 2), fill, 5 - press, 3);
    var ix = icon ? r.h * 0.42 : 0;
    if (icon) RR.uiIcon(ctx, icon, r.x + r.h * 0.55, r.y + r.h / 2 + press, r.h * 0.5, col);
    RR.text(ctx, label, r.x + r.w / 2 + ix / 2, r.y + r.h / 2 + 1 + press, Math.min(24, r.h * 0.42), col, 'center', r.w - 24 - ix, '900');
  }
  function iconBtn(r, icon, fill, col) { RR.panel(ctx, r.x, r.y, r.w, r.h, r.h / 2, fill || C.ink, 3, 3); RR.uiIcon(ctx, icon, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.55, col || C.cream); }
  function veil(a) { ctx.fillStyle = 'rgba(20,8,14,' + a + ')'; ctx.fillRect(0, 0, W, H); }

  // ---------- drawing: play ----------
  function drawCustomers() {
    var sh = G.sh;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, L.counterY); ctx.clip();
    for (var i = 0; i < sh.seats.length; i++) {
      var c = sh.seats[i];
      if (!c) continue;
      var p = seatPos(i), Lk = lookFor(c), off = 0, a = 1, mood = c.mood;
      if (c.st === 'in') { var u = ease(c.t / 0.7); off = (1 - u) * L.seats[i].w * 0.5; a = u; }
      else if (c.st === 'out') { var v = c.t / 0.8; off = (c.mood === 1 ? 1 : -1) * ease(v) * L.seats[i].w * 0.6; a = 1 - ease(v); }
      else if (c.pat / c.max < 0.3) mood = 3;
      var hop = c.st === 'out' && c.mood === 1 ? -Math.abs(Math.sin(c.t * 9)) * p.r * 0.25 : 0;
      var sk = c.st === 'out' && c.mood === 2 ? Math.sin(c.t * 40) * p.r * 0.06 * (1 - c.t) : 0;
      ctx.globalAlpha = a;
      RR.customer(ctx, Lk, p.x + off + sk, p.y + hop, p.r * Lk.h, mood, time + i, c.o.vip);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // hover highlight while dragging a bowl
    if (ptr && ptr.drag && ptr.src && ptr.src.kind === 'slot') {
      var h = hitPlay(ptr.x, ptr.y);
      var si = h && h.kind === 'seat' ? h.i : -1;
      if (si < 0 && ptr.y < L.counterY) for (var q = 0; q < L.seats.length; q++) if (ptr.x >= L.seats[q].x && ptr.x <= L.seats[q].x + L.seats[q].w) si = q;
      if (si >= 0 && sh.waiting(si)) { var sr = L.seats[si]; ctx.strokeStyle = C.glow; ctx.lineWidth = 3; RR.rr(ctx, sr.x + 4, sr.y + 4, sr.w - 8, L.counterY - sr.y - 8, 16); ctx.stroke(); }
    }
    for (var j = 0; j < sh.seats.length; j++) { var cc = sh.seats[j]; if (cc && (cc.st === 'wait' || (cc.st === 'in' && cc.t > 0.45))) drawBubble(j, cc); }
  }
  function drawBubble(i, c) {
    var p = seatPos(i), sr = L.seats[i], sh = G.sh;
    var o = c.o, row2 = o.tops.length, cols = Math.max(o.drink >= 0 ? 3 : 2, row2);
    var zoneH = L.counterY - L.custTop, avail = Math.min(sr.w - 10, 230);
    if (L.land && zoneH < 190) avail = Math.min(avail, sr.w * 0.5 - p.r * 1.3);
    var s = clamp(Math.min(avail / (3 * 1.08 + 0.4), L.land ? (zoneH - 26) / 2.5 : 99), 18, 44), pad = s * 0.22;
    var bw = cols * s * 1.08 + pad * 2, bh = 2 * s * 1.05 + pad * 2 + 10;
    var earTop = p.y - p.r * (lookFor(c).sp === 4 ? 1.9 : 1.3);
    var minTop = L.custTop + (G.tutDone || L.land ? 2 : L.hint.h + 6);
    var side = 0, by = Math.max(minTop, earTop - bh - 6), bx = clamp(p.x - bw / 2, sr.x + 4, sr.x + sr.w - bw - 4);
    if (L.land && earTop - bh - 6 < minTop) {
      // short screens: the bubble sits beside the customer instead of above
      side = p.x + p.r * 1.3 + bw <= sr.x + sr.w - 2 ? 1 : -1;
      bx = side > 0 ? p.x + p.r * 1.3 : p.x - p.r * 1.3 - bw;
      by = clamp(p.y - bh / 2 - p.r * 0.4, L.custTop + 2, L.counterY - bh - 6);
    } else if (by + bh > p.y - p.r * 0.2) by = p.y - p.r * 0.2 - bh;
    var frac = c.pat / c.max, low = frac < 0.3, sk = low ? Math.sin(time * 26) * 1.5 : 0;
    bx += sk;
    var matchSel = RR.bowlReady(sh.slots[sh.sel]) && RR.matches(sh.slots[sh.sel], o);
    RR.panel(ctx, bx, by, bw, bh, 14, o.vip ? '#FFF0C8' : C.cream, 4, matchSel ? 4 : 3);
    if (matchSel) { ctx.strokeStyle = C.good; ctx.lineWidth = 3; RR.rr(ctx, bx - 4, by - 4, bw + 8, bh + 8, 17); ctx.stroke(); }
    // tail
    var bub = o.vip ? '#FFF0C8' : C.cream;
    ctx.beginPath();
    if (side) {
      var ex = side > 0 ? bx + 1 : bx + bw - 1, ty = clamp(p.y - p.r * 0.2, by + 10, by + bh - 10);
      ctx.moveTo(ex, ty - 7); ctx.lineTo(ex - side * 10, ty); ctx.lineTo(ex, ty + 7); ctx.closePath();
      ctx.fillStyle = bub; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = bub; ctx.fillRect(side > 0 ? ex : ex - 4, ty - 5, 4, 10);
    } else {
      ctx.moveTo(p.x - 8 + sk, by + bh - 1); ctx.lineTo(p.x + sk, by + bh + 9); ctx.lineTo(p.x + 8 + sk, by + bh - 1); ctx.closePath();
      ctx.fillStyle = bub; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = bub; ctx.fillRect(p.x - 6 + sk, by + bh - 4, 12, 4);
    }
    var ix = bx + pad + s * 0.54, iy = by + pad + s * 0.5;
    RR.icon(ctx, 0, o.broth, ix, iy, s);
    RR.icon(ctx, 1, o.noodle, ix + s * 1.08, iy, s);
    if (o.drink >= 0) RR.icon(ctx, 3, o.drink, ix + s * 2.16, iy, s);
    var x2 = bx + (bw - row2 * s * 1.08) / 2 + s * 0.54;
    for (var k = 0; k < row2; k++) RR.icon(ctx, 2, o.tops[k], x2 + k * s * 1.08, iy + s * 1.05, s);
    // patience bar
    var px = bx + 10, pw = bw - 20, py = by + bh - pad - 6;
    RR.rr(ctx, px, py, pw, 8, 4); ctx.fillStyle = 'rgba(42,22,32,0.25)'; ctx.fill();
    RR.rr(ctx, px, py, Math.max(8, pw * frac), 8, 4); ctx.fillStyle = frac > 0.55 ? C.good : frac > 0.3 ? C.glow : C.lantern; ctx.fill();
    if (o.vip) { RR.panel(ctx, bx + bw - 30, by - 10, 36, 20, 8, C.gold, 2, 2); RR.text(ctx, t('vip'), bx + bw - 12, by, 12, C.ink, 'center', 32, '900'); }
  }
  function drawCounter() {
    var sh = G.sh;
    for (var i = 0; i < sh.slots.length; i++) {
      var r = L.slots[i], p = slotPos(i), sel = sh.sel === i;
      var dragging = ptr && ptr.drag && ptr.src && ptr.src.kind === 'slot' && ptr.src.i === i;
      var hov = ptr && ptr.drag && ptr.src && ptr.src.kind !== 'slot' && inR(r, ptr.x, ptr.y);
      RR.ellipse(ctx, p.x, p.y + p.r * 0.55, p.r * 1.25, p.r * 0.42);
      ctx.fillStyle = sel || hov ? 'rgba(255,196,107,0.5)' : 'rgba(42,22,32,0.35)'; ctx.fill();
      if (sel) { ctx.strokeStyle = C.glow; ctx.lineWidth = 3; ctx.stroke(); }
      var s = shake['s' + i] ? Math.sin(shake['s' + i] * 50) * 4 : 0;
      var pop = G.lastAdd[i] && time - G.lastAdd[i] < 0.2 ? 1 + 0.08 * Math.sin((time - G.lastAdd[i]) / 0.2 * Math.PI) : 1;
      if (!dragging) RR.bowl(ctx, p.x + s, p.y, p.r * pop, sh.slots[i], time + i, false);
      else RR.bowl(ctx, p.x, p.y, p.r, null, time, false);
      if (sel) { ctx.fillStyle = C.glow; ctx.beginPath(); ctx.moveTo(p.x - 7, r.y + 2); ctx.lineTo(p.x + 7, r.y + 2); ctx.lineTo(p.x, r.y + 10); ctx.closePath(); ctx.fill(); }
      RR.text(ctx, String(i + 1), r.x + 10, r.y + r.h - 10, 12, 'rgba(255,243,224,0.55)', 'center', 20, '800');
    }
    var hot = ptr && ptr.drag && ptr.src && ptr.src.kind === 'slot' && inR(L.trash, ptr.x, ptr.y);
    RR.trash(ctx, L.trash.x, L.trash.y, L.trash.w, L.trash.h, hot, time);
  }
  function kitchenStatic() {
    if (kitCache) return kitCache;
    var o = offscreen(W, H);
    L.st.forEach(function (s) {
      var r = s.r;
      if (s.k === 1) RR.crate(o.g, r.x, r.y, r.w, r.h, s.n);
      else if (s.k === 2) RR.tray(o.g, r.x, r.y, r.w, r.h, s.n);
      else if (s.k === 3) RR.cooler(o.g, r.x, r.y, r.w, r.h, s.n);
    });
    return (kitCache = o.cv);
  }
  function drawKitchen() {
    var sh = G.sh;
    ctx.drawImage(kitchenStatic(), 0, 0, W, H);
    for (var j = 0; j < L.st.length; j++) {
      var s = L.st[j], r = s.r;
      var press = ptr && !ptr.drag && ptr.src && ptr.src.kind === 'st' && ptr.src.i === j;
      if (s.k === 0) {
        var sx = shake['st' + j] ? Math.sin(shake['st' + j] * 50) * 3 : 0;
        RR.pot(ctx, r.x + sx, r.y, r.w, r.h, s.n, time + j * 0.3, false);
      }
      if (press || shake['st' + j]) { RR.rr(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 12); ctx.strokeStyle = shake['st' + j] ? C.lantern : C.glow; ctx.lineWidth = 3; ctx.stroke(); }
    }
    for (var i = 0; i < sh.boilers.length; i++) {
      var b = sh.boilers[i], br = L.burn[i], bs = shake['b' + i] ? Math.sin(shake['b' + i] * 50) * 3 : 0;
      var prog = b.st === 1 ? b.t / sh.boilTime : 0, left = b.st === 2 ? 1 - b.t / RR.READY_WINDOW : 0;
      var dragging = ptr && ptr.drag && ptr.src && ptr.src.kind === 'burn' && ptr.src.i === i;
      RR.burner(ctx, br.x + bs, br.y, br.w, br.h, dragging ? { st: 0, n: -1, t: 0 } : b, prog, time + i, left);
      if (b.st === 2 && !dragging) { var pulse = 0.5 + 0.5 * Math.sin(time * 5); RR.rr(ctx, br.x + 2, br.y + 2, br.w - 4, br.h - 4, 12); ctx.strokeStyle = 'rgba(92,201,138,' + (0.35 + 0.4 * pulse) + ')'; ctx.lineWidth = 3; ctx.stroke(); }
    }
  }
  function drawHud() {
    var sh = G.sh;
    iconBtn(L.pause, 'pause');
    // day + clock
    var d = L.dayPill;
    RR.panel(ctx, d.x, d.y, d.w, d.h, d.h / 2, C.ink, 3, 2.5);
    var lbl = t('day', sh.day);
    RR.text(ctx, lbl, d.x + 16, d.y + d.h * 0.36, Math.min(18, d.h * 0.36), C.cream, 'left', d.w - 30, '900');
    var frac = sh.open ? 1 - sh.t / sh.len : 0, bx = d.x + 16, bw = d.w - 32, byy = d.y + d.h * 0.66;
    RR.rr(ctx, bx, byy, bw, 9, 4.5); ctx.fillStyle = 'rgba(255,243,224,0.18)'; ctx.fill();
    RR.rr(ctx, bx, byy, Math.max(9, bw * frac), 9, 4.5); ctx.fillStyle = frac < 0.15 ? C.lantern : C.glow; ctx.fill();
    if (!sh.open) RR.text(ctx, t('closing'), d.x + d.w - 14, d.y + d.h * 0.36, 13, C.glow, 'right', d.w * 0.5, '800');
    // coins vs goal
    var c = L.coinPill, earned = sh.stats.coins, goal = sh.cfg.goal;
    RR.panel(ctx, c.x, c.y, c.w, c.h, c.h / 2, C.ink, 3, 2.5);
    RR.coin(ctx, c.x + c.h * 0.5, c.y + c.h * 0.5, c.h * 0.26);
    RR.text(ctx, String(earned), c.x + c.h * 0.9, c.y + c.h * 0.36, Math.min(19, c.h * 0.38), C.cream, 'left', c.w * 0.4, '900');
    RR.text(ctx, '/ ' + goal, c.x + c.w - 14, c.y + c.h * 0.36, Math.min(14, c.h * 0.3), C.inkSoft, 'right', c.w * 0.4, '800');
    var gx = c.x + c.h * 0.9, gw = c.w - c.h * 0.9 - 14, gy = c.y + c.h * 0.66, top3 = goal * RR.STAR3;
    RR.rr(ctx, gx, gy, gw, 9, 4.5); ctx.fillStyle = 'rgba(255,243,224,0.18)'; ctx.fill();
    RR.rr(ctx, gx, gy, Math.max(9, gw * Math.min(1, earned / top3)), 9, 4.5); ctx.fillStyle = earned >= goal ? C.good : C.glow; ctx.fill();
    [1, RR.STAR2, RR.STAR3].forEach(function (m, k) {
      var mx = gx + gw * m / RR.STAR3 - (k === 2 ? 4 : 0);
      RR.star(ctx, mx, gy + 4.5, 6, earned >= goal * m);
    });
  }
  function tutorialStep() {
    var sh = G.sh, c = sh.seats[0];
    if (G.tutDone || !c || c.st !== 'wait') return null;
    var o = c.o, b = sh.slots[0], i;
    for (i = 0; i < sh.slots.length; i++) if (!RR.compatible(sh.slots[i], o)) return { msg: 'tut7', tap: L.trash, dragFrom: L.slots[i] };
    var bo = sh.boilers[0];
    var crate = -1, pot = -1, tray = -1;
    L.st.forEach(function (s, j) { if (s.k === 1 && s.n === o.noodle) crate = j; if (s.k === 0 && s.n === o.broth) pot = j; if (s.k === 2 && s.n === o.tops[0]) tray = j; });
    if (b.noodle < 0 && bo.st === 0) return { msg: 'tut1', tap: L.st[crate].r };
    if (bo.st === 3) return { msg: 'overcooked', tap: L.burn[0] };
    if (b.broth < 0) return { msg: 'tut2', tap: L.st[pot].r };
    if (b.tops.length < o.tops.length) return { msg: 'tut3', tap: L.st[tray].r };
    if (b.noodle < 0 && bo.st === 1) return { msg: 'tut4', point: L.burn[0] };
    if (b.noodle < 0 && bo.st === 2) return { msg: 'tut5', tap: L.burn[0] };
    if (RR.bowlReady(b)) return { msg: 'tut6', dragFrom: L.slots[0], dragTo: { x: cx(L.seats[0]), y: seatPos(0).y } };
    return null;
  }
  function hintPanel(msg, alpha) {
    var r = L.hint;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    RR.panel(ctx, r.x, r.y, r.w, r.h, 14, C.cream, 4, 3);
    var px = Math.min(18, r.h * 0.36), lines = RR.wrap(ctx, msg, r.w - 28, px, '800');
    while (lines.length * px * 1.15 > r.h - 10 && px > 11) { px -= 1; lines = RR.wrap(ctx, msg, r.w - 28, px, '800'); }
    if (lines.length === 1 && r.h > 70) px = Math.min(20, px + 2);
    for (var i = 0; i < lines.length; i++) RR.text(ctx, lines[i], r.x + r.w / 2, r.y + r.h / 2 + (i - (lines.length - 1) / 2) * px * 1.15, px, C.ink, 'center', r.w - 20, '800');
    ctx.globalAlpha = 1;
  }
  function drawTip() {
    veil(0.5);
    var w = Math.min(W - 40, 420), x = (W - w) / 2;
    var lines = RR.wrap(ctx, t('tut7'), w - 48, 20, '800'), h = 150 + lines.length * 26, y = (H - h) / 2;
    RR.panel(ctx, x, y, w, h, 22, C.cream, 6, 3);
    // a sample patience bar draining
    var f = 1 - (time * 0.25) % 1, bx = x + 40, bw2 = w - 80;
    RR.clock(ctx, bx - 14, y + 38, 9, C.ink);
    RR.rr(ctx, bx + 4, y + 33, bw2 - 4, 10, 5); ctx.fillStyle = 'rgba(42,22,32,0.2)'; ctx.fill();
    RR.rr(ctx, bx + 4, y + 33, Math.max(10, (bw2 - 4) * f), 10, 5); ctx.fillStyle = f > 0.55 ? C.good : f > 0.3 ? C.glow : C.lantern; ctx.fill();
    for (var i = 0; i < lines.length; i++) RR.text(ctx, lines[i], W / 2, y + 76 + i * 26, 20, C.ink, 'center', w - 40, '800');
    RR.uiIcon(ctx, 'play', W / 2 - 80, y + h - 34, 20, C.lantern);
    RR.text(ctx, t('tapCont'), W / 2 + 10, y + h - 33, 17, C.lantern, 'center', w - 120, '900');
  }
  function drawTutorial() {
    if (G.tip) { drawTip(); return; }
    var st = tutorialStep();
    if (!st) return;
    hintPanel(t(st.msg));
    var hs = clamp(U * 0.13, 40, 64);
    if (st.dragFrom && st.dragTo) {
      var u = (time % 1.8) / 1.8, e = ease(clamp((u - 0.15) / 0.6, 0, 1));
      var a = { x: cx(st.dragFrom), y: cy(st.dragFrom) }, b = st.dragTo;
      RR.hand(ctx, a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e, hs, u > 0.1 && u < 0.8);
    } else if (st.dragFrom && st.tap) {
      var u2 = (time % 1.8) / 1.8, e2 = ease(clamp((u2 - 0.15) / 0.6, 0, 1));
      RR.hand(ctx, cx(st.dragFrom) + (cx(st.tap) - cx(st.dragFrom)) * e2, cy(st.dragFrom) + (cy(st.tap) - cy(st.dragFrom)) * e2, hs, u2 > 0.1 && u2 < 0.8);
    } else if (st.tap) {
      var ph = (time % 1.1) / 1.1, press = ph > 0.55 && ph < 0.8;
      RR.hand(ctx, cx(st.tap) + 6, cy(st.tap) + 6 + (press ? 0 : -10 * Math.sin(ph * Math.PI / 0.55)), hs, press);
    } else if (st.point) {
      RR.hand(ctx, cx(st.point) + 6, cy(st.point) + st.point.h * 0.3 + Math.sin(time * 3) * 4, hs, false);
    }
  }
  function drawFocus() {
    if (focus < 0 || !L.targets[focus]) return;
    var r = L.targets[focus].r;
    ctx.setLineDash([8, 6]); ctx.strokeStyle = C.cream; ctx.lineWidth = 3;
    RR.rr(ctx, r.x + 1, r.y + 1, r.w - 2, Math.min(r.h, (L.targets[focus].kind === 'seat' ? L.counterY - r.y : r.h)) - 2, 12); ctx.stroke();
    ctx.setLineDash([]);
  }
  function drawDrag() {
    if (!ptr || !ptr.drag || !G) return;
    var s = ptr.src, x = ptr.x, y = ptr.y;
    if (s.kind === 'slot') RR.bowl(ctx, x, y, slotR() * 0.9, G.sh.slots[s.i], time, true);
    else if (s.kind === 'st') RR.icon(ctx, L.st[s.i].k, L.st[s.i].n, x, y - 10, 40);
    else if (s.kind === 'burn') RR.icon(ctx, 1, G.sh.boilers[s.i].n, x, y - 10, 40);
  }
  function drawBanner() {
    if (G.intro > 0) {
      var k = G.intro / G.introMax, a = k > 0.85 ? (1 - k) / 0.15 : k < 0.15 ? k / 0.15 : 1;
      veil(0.45 * a);
      ctx.globalAlpha = a;
      var bw = Math.min(W - 40, 420), bh = 150 + (G.news.length ? 86 : 0), bx = (W - bw) / 2, by = (H - bh) / 2;
      RR.panel(ctx, bx, by, bw, bh, 22, C.dusk, 6, 3);
      RR.text(ctx, G.sh.day > RR.CAMPAIGN_DAYS ? t('endless', G.sh.day - RR.CAMPAIGN_DAYS) : t('day', G.sh.day), W / 2, by + 44, 36, C.glow, 'center', bw - 40, '900', C.lanternDeep);
      RR.coin(ctx, W / 2 - 54, by + 98, 14);
      RR.text(ctx, t('goal', G.sh.cfg.goal), W / 2 - 32, by + 99, 22, C.cream, 'left', bw - 120, '800');
      if (G.news.length) {
        RR.text(ctx, t('newMenu'), W / 2, by + 140, 17, C.glow, 'center', bw - 40, '800');
        var n = G.news.length, gx = W / 2 - (n - 1) * 30;
        gx = W / 2 - (n - 1) * 60;
        for (var i = 0; i < n; i++) { RR.icon(ctx, G.news[i][0], G.news[i][1], gx + i * 120, by + 178, 42); RR.text(ctx, t('i' + G.news[i][0] + '_' + G.news[i][1]), gx + i * 120, by + 210, 14, C.cream, 'center', 116, '800'); }
      }
      ctx.globalAlpha = 1;
    }
    if (G.closeT > 0) {
      var a2 = clamp(G.closeT, 0, 1);
      ctx.globalAlpha = a2;
      RR.text(ctx, t('closing'), W / 2, L.counterY - 30, 30, C.glow, 'center', W - 40, '900', C.lanternDeep);
      ctx.globalAlpha = 1;
    }
  }
  function drawLanterns() {
    var r = clamp(U * 0.035, 12, 20);
    RR.lantern(ctx, W * 0.035 + r, L.aw - 4, r, time, 0);
    RR.lantern(ctx, W - W * 0.035 - r, L.aw - 4, r, time, 1.3);
    if (L.land) { RR.lantern(ctx, W * 0.5 - 220, L.aw - 4, r * 0.85, time, 2.1); RR.lantern(ctx, W * 0.5 + 220, L.aw - 4, r * 0.85, time, 0.7); }
  }
  function drawPlay() {
    drawBg();
    drawLanterns();
    drawCustomers();
    drawCounter();
    drawKitchen();
    drawFocus();
    drawFx();
    drawDrag();
    drawHud();
    if (!G.tutDone || G.tip) drawTutorial();
    drawBanner();
  }

  // ---------- drawing: title ----------
  var HERO = { broth: 0, noodle: 0, tops: [0, 1, 4], drink: -1 };
  function drawTitle() {
    drawBg();
    for (var d = 0; d < L.tDecor.length; d++) {
      var dc = L.tDecor[d], q = dc.r;
      if (dc.k === 0) RR.pot(ctx, q.x, q.y, q.w, q.h, dc.n, time + d, false);
      else if (dc.k === 9) RR.burner(ctx, q.x, q.y, q.w, q.h, { st: 1, n: 1, t: 0 }, (time * 0.2) % 1, time, 0);
      else RR.tray(ctx, q.x, q.y, q.w, q.h, dc.n, false);
    }
    drawLanterns();
    // two regulars at the counter
    var r = clamp(U * 0.075, 26, 52);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, L.counterY); ctx.clip();
    RR.customer(ctx, RR.look(11), W * 0.2, L.counterY - r * 1.4, r, 1, time, false);
    RR.customer(ctx, RR.look(29), W * 0.8, L.counterY - r * 1.4, r, 0, time + 1, false);
    ctx.restore();
    // logo
    var ly = L.land ? H * 0.17 : H * 0.15, lpx = Math.min(W * (L.land ? 0.085 : 0.14), 92);
    RR.text(ctx, 'RAMEN', W / 2, ly, lpx, C.cream, 'center', W - 40, '900', C.lantern);
    RR.text(ctx, 'RUSH', W / 2, ly + lpx * 0.95, lpx * 1.05, C.glow, 'center', W - 40, '900', C.lanternDeep);
    RR.text(ctx, t('tag'), W / 2, ly + lpx * 1.75, Math.min(20, U * 0.045), C.cream, 'center', W - 40, '700');
    // hero bowl on the counter
    var br = clamp(U * 0.16, 50, 110);
    RR.bowl(ctx, W / 2, L.counterY + L.counterH * 0.35, br, HERO, time, false, true);
    // buttons
    button(L.tPrimary, save.sh || hasProgress() ? t('cont', save.day) : t('play'), C.lantern, C.cream, 'play');
    if (hasProgress()) {
      ctx.globalAlpha = 0.95;
      button(L.tSecondary, titleSure > 0 ? t('sure') : t('fresh'), titleSure > 0 ? C.glow : C.dusk, titleSure > 0 ? C.ink : C.cream);
      ctx.globalAlpha = 1;
    }
    iconBtn(L.tSound, save.snd ? 'sound' : 'mute');
    if (save.best > 0 || save.total > 0) {
      var sy = L.land ? L.counterY - 22 : L.tSecondary.y + (hasProgress() ? 72 : 10);
      RR.panel(ctx, W / 2 - 150, sy - 17, 300, 34, 17, 'rgba(36,20,30,0.85)', 0, 0);
      RR.star(ctx, W / 2 - 130, sy, 9, true);
      RR.text(ctx, t('bestDay', save.best) + '  ·  ' + t('earnedAll', save.total), W / 2 + 8, sy + 1, 15, C.cream, 'center', 250, '800');
    }
  }

  // ---------- drawing: summary ----------
  function drawSummary() {
    drawBg();
    drawLanterns();
    veil(0.55);
    var P = L.sPanel, r = RES.r;
    RR.panel(ctx, P.x, P.y, P.w, P.h, 24, C.dusk, 7, 3);
    var y = P.y + 40;
    RR.text(ctx, t('dayDone', RES.day), P.x + P.w / 2, y, 30, C.glow, 'center', P.w - 40, '900', C.lanternDeep);
    y += 58;
    var sr = Math.min(34, P.w * 0.08);
    for (var i = 0; i < 3; i++) {
      var appear = RES.t - 0.5 - i * 0.35, sc = appear > 0 ? easeBack(appear / 0.35) : 0;
      var on = i < r.stars;
      RR.star(ctx, P.x + P.w / 2 + (i - 1) * sr * 2.4, y, sr * (on ? Math.max(0.01, sc) : 1), on && sc > 0);
    }
    y += sr + 24;
    var lines = [[t('served'), String(r.served)], [t('lost'), String(r.lost)], [t('tips'), '+' + r.tips], [t('streak'), String(r.best)]];
    var rowH = 32;
    for (var j = 0; j < lines.length; j++) {
      RR.text(ctx, lines[j][0], P.x + 34, y + j * rowH, 18, C.inkSoft, 'left', P.w * 0.55, '800');
      RR.text(ctx, lines[j][1], P.x + P.w - 34, y + j * rowH, 20, C.cream, 'right', P.w * 0.3, '900');
    }
    y += rowH * 4 + 8;
    // earnings bar with the star marks
    var shown = Math.round(r.coins * ease(clamp((RES.t - 0.2) / 1.2, 0, 1)));
    RR.coin(ctx, P.x + 46, y + 4, 15);
    RR.text(ctx, String(shown), P.x + 70, y + 5, 30, C.cream, 'left', P.w * 0.4, '900');
    RR.text(ctx, t('goal', r.goal), P.x + P.w - 34, y + 5, 17, C.inkSoft, 'right', P.w * 0.4, '800');
    y += 32;
    var gx = P.x + 34, gw = P.w - 68, top3 = r.goal * RR.STAR3 * 1.1;
    RR.rr(ctx, gx, y, gw, 14, 7); ctx.fillStyle = 'rgba(255,243,224,0.16)'; ctx.fill();
    RR.rr(ctx, gx, y, Math.max(14, gw * Math.min(1, shown / top3)), 14, 7); ctx.fillStyle = shown >= r.goal ? C.good : C.glow; ctx.fill();
    [1, RR.STAR2, RR.STAR3].forEach(function (m) { RR.star(ctx, gx + gw * m * r.goal / top3, y + 7, 9, shown >= r.goal * m); });
    y += 40;
    var msg = RES.master ? t('master') : r.stars >= 1 ? t('goalMet') : t('goalMissed');
    var ml = RR.wrap(ctx, msg, P.w - 56, 17, '800');
    for (var q = 0; q < ml.length; q++) RR.text(ctx, ml[q], P.x + P.w / 2, y + q * 21, 17, r.stars >= 1 ? C.glow : '#FF9A8A', 'center', P.w - 40, '800');
    y += ml.length * 21 + 8;
    var rt = t('rep') + ' ' + r.rep + ' (' + (r.dRep >= 0 ? '+' : '') + r.dRep + ')';
    ctx.font = RR.font(15, '700');
    var rw = Math.min(P.w - 120, ctx.measureText(rt).width);
    RR.lanternIcon(ctx, P.x + P.w / 2 - rw / 2 - 8, y + 4, 9);
    RR.text(ctx, rt, P.x + P.w / 2 + 10, y + 5, 15, C.cream, 'center', P.w - 120, '700');
    if (RES.t > 0.6) button(L.sNext, t('shop'), C.lantern, C.cream);
  }

  // ---------- drawing: shop ----------
  function itemName(it) { if (it.kind === 'up') return t('u_' + RR.UPS[it.i].id); var s = RR.SPECIALS[it.i]; return t('i' + s.k + '_' + s.n); }
  function itemDesc(it) { return it.kind === 'up' ? t('d_' + RR.UPS[it.i].id) : t('d_special'); }
  function itemArt(it, x, y, s) {
    if (it.kind === 'sp') { var sp = RR.SPECIALS[it.i]; RR.icon(ctx, sp.k, sp.n, x, y, s); return; }
    var id = RR.UPS[it.i].id;
    if (id === 'slot') RR.bowl(ctx, x, y - s * 0.05, s * 0.45, null, time, false);
    else if (id === 'burn') RR.burner(ctx, x - s * 0.5, y - s * 0.5, s, s, { st: 0, n: -1, t: 0 }, 0, time, 0);
    else if (id === 'boil') RR.burner(ctx, x - s * 0.5, y - s * 0.5, s, s, { st: 1, n: 0, t: 0 }, 0.7, time, 0);
    else if (id === 'deco') RR.lanternIcon(ctx, x, y, s * 0.4);
    else if (id === 'tip') { RR.rr(ctx, x - s * 0.3, y - s * 0.32, s * 0.6, s * 0.7, s * 0.12); ctx.fillStyle = 'rgba(191,234,242,0.6)'; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.stroke(); RR.coin(ctx, x - s * 0.08, y + s * 0.15, s * 0.16); RR.coin(ctx, x + s * 0.1, y + s * 0.02, s * 0.16); }
  }
  function drawShop() {
    drawBg();
    veil(0.6);
    var p = 14;
    var wpw = 150;
    RR.text(ctx, t('shop'), L.land ? W / 2 : p + 4, 36, 28, C.glow, L.land ? 'center' : 'left', L.land ? W - 2 * wpw - 60 : W - wpw - 3 * p, '900', C.lanternDeep);
    RR.panel(ctx, W - p - wpw, 16, wpw, 40, 20, C.ink, 3, 2.5);
    RR.coin(ctx, W - p - wpw + 22, 36, 11);
    RR.text(ctx, String(save.coins), W - p - wpw / 2 + 12, 37, 20, C.cream, 'center', wpw - 50, '900');
    for (var i = 0; i < SHOP.items.length; i++) {
      var it = SHOP.items[i], r = L.cards[i], s = itemState(it);
      var afford = !s.done && !s.locked && save.coins >= s.price;
      var sk = SHOP.shake === i && SHOP.st > 0 ? Math.sin(SHOP.st * 50) * 4 : 0;
      var pulse = SHOP.pulse === i && SHOP.pt > 0 ? 1 : 0;
      RR.panel(ctx, r.x + sk, r.y, r.w, r.h, 16, s.done ? '#2E4A40' : s.locked ? '#2E1F28' : afford ? C.cream : '#E6D4BE', 5, pulse ? 4 : 3);
      var dark = s.done || s.locked, tc = dark ? C.cream : C.ink;
      var compact = r.w < 230;
      var art = compact ? Math.min(44, r.h * 0.34) : Math.min(r.h * 0.42, r.w * 0.3);
      var ax = r.x + art * 0.6 + 10, ay = r.y + (compact ? art * 0.6 + 8 : r.h * 0.42);
      ctx.globalAlpha = s.locked ? 0.45 : 1;
      itemArt(it, ax + sk, ay, art);
      ctx.globalAlpha = 1;
      var tx = r.x + art * 1.2 + 18, tw = r.w - (tx - r.x) - 10, nameY = compact ? ay : r.y + r.h * 0.26;
      var dpx = compact ? 12 : Math.min(13, r.h * 0.095);
      var nl = RR.wrap(ctx, itemName(it), tw, 16, '900');
      if (nl.length > 1 && compact) { RR.text(ctx, nl[0], tx + sk, nameY - 9, 15, tc, 'left', tw, '900'); RR.text(ctx, nl.slice(1).join(' '), tx + sk, nameY + 8, 15, tc, 'left', tw, '900'); }
      else RR.text(ctx, itemName(it), tx + sk, nameY, compact ? 16 : Math.min(17, r.h * 0.13), tc, 'left', tw, '900');
      var dx = compact ? r.x + 12 : tx, dw = compact ? r.w - 24 : tw, dy = compact ? r.y + art * 1.2 + 22 : nameY + 20;
      var dl = RR.wrap(ctx, itemDesc(it), dw, dpx, '700');
      for (var q = 0; q < Math.min(2, dl.length); q++) RR.text(ctx, dl[q], dx + sk, dy + q * (dpx + 3), dpx, dark ? C.inkSoft : '#6B4A55', 'left', dw, '700');
      // footer: level pips and price / state
      var fy = r.y + r.h - 18;
      if (it.kind === 'up') {
        for (var k = 0; k < s.max; k++) { RR.circle(ctx, r.x + 18 + k * 15 + sk, fy, 5); ctx.fillStyle = k < s.lvl ? C.glow : 'rgba(42,22,32,0.25)'; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
      if (s.done) RR.text(ctx, it.kind === 'up' ? t('max') : t('owned'), r.x + r.w - 14, fy, 15, C.good, 'right', r.w * 0.5, '900');
      else if (s.locked) { RR.uiIcon(ctx, 'lock', r.x + r.w - 70, fy, 18, C.inkSoft); RR.text(ctx, t('from', s.locked), r.x + r.w - 14, fy, 14, C.inkSoft, 'right', r.w * 0.4, '800'); }
      else { RR.coin(ctx, r.x + r.w - 58, fy, 9); RR.text(ctx, String(s.price), r.x + r.w - 14, fy, 16, afford ? C.ink : '#9A6A6A', 'right', 40, '900'); }
    }
    var failed = save.day === (RES ? RES.day : save.day) && RES && RES.r.stars < 1;
    button(L.shopNext, failed ? t('retryDay', save.day) : t('nextDay', save.day), C.lantern, C.cream, failed ? 'retry' : 'play');
    iconBtn(L.shopHome, 'home');
    drawFx();
  }

  // ---------- drawing: overlays ----------
  function drawMenu() {
    veil(0.6);
    var P = L.mPanel;
    RR.panel(ctx, P.x, P.y, P.w, P.h, 22, C.dusk, 6, 3);
    RR.text(ctx, t('paused'), P.x + P.w / 2, P.y + 40, 28, C.glow, 'center', P.w - 40, '900');
    button(L.mResume, t('resume'), C.lantern, C.cream, 'play');
    button(L.mSound, save.snd ? t('soundOn') : t('soundOff'), C.cream, C.ink, save.snd ? 'sound' : 'mute');
    button(L.mQuit, t('quit'), C.cream, C.ink, 'home');
  }
  function drawTapOverlay() {
    veil(0.55);
    var w = Math.min(W - 40, 360), h = 70, x = (W - w) / 2, y = (H - h) / 2;
    RR.panel(ctx, x, y, w, h, 22, C.cream, 6, 3);
    RR.uiIcon(ctx, 'play', x + 40, y + h / 2, 30, C.lantern);
    RR.text(ctx, t('tapCont'), x + 66 + (w - 82) / 2, y + h / 2 + 1, 22, C.ink, 'center', w - 90, '900');
  }
  function drawToast() {
    if (toast.t <= 0 || !toast.text) return;
    ctx.globalAlpha = clamp(toast.t * 3, 0, 1);
    ctx.font = RR.font(17, '800');
    var w = Math.min(W - 40, ctx.measureText(toast.text).width + 40), y = scene === 'play' ? L.kTop - 6 : H - 130;
    RR.panel(ctx, (W - w) / 2, y - 20, w, 40, 20, C.ink, 3, 2);
    RR.text(ctx, toast.text, W / 2, y + 1, 17, C.cream, 'center', w - 24, '800');
    ctx.globalAlpha = 1;
  }
  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (scene === 'play' && G) drawPlay();
    else if (scene === 'summary' && RES) drawSummary();
    else if (scene === 'shop' && SHOP) drawShop();
    else drawTitle();
    if (scene !== 'play') drawFx();
    drawToast();
    if (scene === 'play' && menuOpen) drawMenu();
    if (needTap) drawTapOverlay();
  }

  // ---------- update ----------
  var bubbleClock = 0;
  function step(dt) {
    AU.tick();
    if (toast.t > 0) toast.t -= dt;
    if (titleSure > 0) titleSure -= dt;
    if (needTap || (scene === 'play' && menuOpen)) return;
    updateFx(dt);
    if (scene === 'play' && G) {
      if (G.intro > 0) { G.intro -= dt; return; }
      G.sh.update(dt);
      handleEvents();
      if (G.closeT > 0) G.closeT -= dt;
      bubbleClock -= dt;
      if (bubbleClock <= 0) { bubbleClock = 0.22 + Math.random() * 0.2; if (G.sh.boilers.some(function (b) { return b.st === 1; })) AU.play('bubble'); }
      if (G.endT > 0) { G.endT -= dt; if (G.endT <= 0) endShift(); }
    } else if (scene === 'summary' && RES) {
      var prev = RES.t; RES.t += dt;
      for (var i = 0; i < RES.r.stars; i++) { var at = 0.5 + i * 0.35; if (prev < at && RES.t >= at) AU.play('star'); }
    } else if (scene === 'shop' && SHOP) {
      SHOP.t += dt; if (SHOP.pt > 0) SHOP.pt -= dt; if (SHOP.st > 0) SHOP.st -= dt;
    }
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
    if (scene === 'play' && G && !G.sh.done) needTap = true;
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
  window.__ramenDebug = {
    info: function () {
      var o = { scene: scene, menuOpen: menuOpen, needTap: needTap, ready: ready, save: JSON.parse(JSON.stringify(save)), W: W, H: H };
      o.layout = { pause: rr(L.pause), tPrimary: rr(L.tPrimary), tSecondary: rr(L.tSecondary), sNext: rr(L.sNext), shopNext: rr(L.shopNext), cards: L.cards.map(rr),
        mResume: rr(L.mResume), mQuit: rr(L.mQuit), seats: L.seats.map(rr), slots: L.slots.map(rr), trash: rr(L.trash), burn: L.burn.map(rr),
        st: L.st.map(function (s) { return { k: s.k, n: s.n, r: rr(s.r) }; }), counterY: L.counterY };
      if (G) {
        var sh = G.sh;
        o.shift = { day: sh.day, t: sh.t, len: sh.len, open: sh.open, done: sh.done, hold: sh.hold, sel: sh.sel, intro: G.intro, tutDone: G.tutDone, tip: G.tip,
          seats: sh.seats.map(function (c) { return c ? { id: c.id, st: c.st, o: c.o, pat: c.pat, max: c.max } : null; }),
          slots: JSON.parse(JSON.stringify(sh.slots)), boilers: JSON.parse(JSON.stringify(sh.boilers)), stats: JSON.parse(JSON.stringify(sh.stats)), goal: sh.cfg.goal };
      }
      if (RES) o.result = JSON.parse(JSON.stringify(RES.r));
      return o;
    }
  };

  // ---------- boot ----------
  resize();
  draw();
  PlayablesSDK.firstFrameReady();
  Promise.all([PlayablesSDK.load(), PlayablesSDK.getLanguage()]).then(function (res) {
    applySave(res[0]);
    RR.setLang(res[1]);
    finishBoot();
  }, function () { finishBoot(); });
  function finishBoot() {
    if (ready) return;
    ready = true;
    applyAudio();
    AU.music(true, 1);
    layout();
    draw();
    PlayablesSDK.gameReady();
    startLoop();
  }
})();
