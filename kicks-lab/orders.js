/* Kicks Lab: content tables, design model, order generation, rating, the solver and a
   satisfiability self-check. Pure logic: no DOM, so it also runs in Node for tests. */
(function (root) {
  'use strict';
  var KL = root.KL = root.KL || {};

  // ---------- content ----------
  // Riso inks. 0..11 are owned from the start; 12..21 come in packs from the shop.
  KL.INKS = [
    '#FFF8EC', '#26213A', '#FF4F9A', '#2F5BEA', '#FFD23F', '#FF5148', '#4FD6A8', '#FF8B2C',
    '#8A5CF0', '#13A3A6', '#A6A3B8', '#2FAE5B',
    '#C7AEFF', '#FF9CCB', '#FFB08A', '#6EC9FF', '#9C5A3A', '#D9971A', '#1E2D6E', '#B0245C',
    '#C4E33A', '#6F7D33'
  ];
  KL.NEUTRAL = [0, 1, 10, 18];
  KL.INK_PACKS = [[12, 13], [14, 15], [16, 17], [18, 19], [20, 21]];
  // Zones, in draw order. Weights are each zone's share of the visible shoe (sum = 1).
  KL.ZONES = ['upper', 'panel', 'toe', 'heel', 'collar', 'laces', 'mid', 'sole'];
  KL.ZW = [0.30, 0.13, 0.11, 0.09, 0.08, 0.05, 0.14, 0.10];
  KL.NZ = 8;
  KL.PATS = ['solid', 'fade', 'speckle', 'stripes', 'checker', 'camo'];
  KL.STKS = ['star', 'bolt', 'wave', 'flame', 'eye', 'smile'];
  KL.LACES = ['classic', 'cross', 'ladder', 'chunky'];
  KL.SILS = ['runner', 'court', 'trail', 'skate'];
  KL.VIBES = [
    { k: 'retro', pal: [7, 4, 9, 16, 0, 5, 17, 19] },
    { k: 'night', pal: [1, 18, 8, 3, 2, 10] },
    { k: 'beach', pal: [15, 4, 0, 14, 9, 6, 5] },
    { k: 'forest', pal: [11, 21, 16, 0, 9, 17, 20] },
    { k: 'candy', pal: [2, 13, 12, 6, 4, 15, 0] },
    { k: 'mono', pal: [1, 10, 0, 18] }
  ];
  KL.START = { ink: 0xFFF, pat: 1 | 2 | 4, stk: 1 | 2 | 4, lace: 1 | 2, sil: 1 };
  KL.MAX_STK = 3;
  KL.VIBE_MIN = 0.6;
  KL.MOOD_TOL = 40;
  // Reputation needed for each tier of client.
  KL.TIER_REP = [0, 12, 40, 90, 160];
  KL.tierFor = function (rep) { var t = 0; while (t + 1 < KL.TIER_REP.length && rep >= KL.TIER_REP[t + 1]) t++; return t; };

  // ---------- small utils ----------
  KL.rng = function (a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function shuffle(r, a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function has(a, v) { return a.indexOf(v) >= 0; }
  function bits(mask, n) { var o = []; for (var i = 0; i < n; i++) if (mask & (1 << i)) o.push(i); return o; }
  KL.bits = bits;
  // Owned content as index lists, from save bitmasks.
  KL.unlocks = function (m) {
    return { ink: bits(m.ink, KL.INKS.length), pat: bits(m.pat, 6), stk: bits(m.stk, 6), lace: bits(m.lace, 4), sil: bits(m.sil, 4) };
  };
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  KL.hexRgb = hexRgb;
  function rgbHex(c) { return '#' + ((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1).toUpperCase(); }
  KL.rgbHex = rgbHex;
  // Weighted RGB distance (green matters most to the eye).
  function cdist(a, b) {
    var dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9);
  }
  KL.cdist = cdist;
  var INK_RGB = KL.INKS.map(hexRgb);
  function hsl(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0;
    if (mx !== mn) {
      var d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  var INK_HSL = INK_RGB.map(hsl);

  // ---------- design model ----------
  // d = { s: silhouette, z: [[base, pattern, accent] x 8], l: lace style, k: [[kind, color, u, v]] }
  // base/accent -1 = unpainted / none. Sticker u,v are 0..1 inside the side panel's box.
  KL.blank = function (s) {
    var z = [];
    for (var i = 0; i < KL.NZ; i++) z.push([-1, 0, -1]);
    return { s: s || 0, z: z, l: 0, k: [] };
  };
  KL.clone = function (d) {
    return { s: d.s, z: d.z.map(function (q) { return q.slice(); }), l: d.l, k: d.k.map(function (q) { return q.slice(); }) };
  };
  var B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
  function ch(n) { return B36.charAt(Math.max(0, Math.min(35, n | 0))); }
  function un(c) { var n = B36.indexOf(c); return n < 0 ? 0 : n; }
  // Compact encoding: about 26 + 4 per sticker characters.
  KL.encode = function (d) {
    var s = ch(d.s);
    for (var i = 0; i < KL.NZ; i++) s += ch(d.z[i][0] + 1) + ch(d.z[i][1]) + ch(d.z[i][2] + 1);
    s += ch(d.l);
    for (i = 0; i < d.k.length; i++) s += ch(d.k[i][0]) + ch(d.k[i][1] + 1) + ch(Math.round(d.k[i][2] * 35)) + ch(Math.round(d.k[i][3] * 35));
    return s;
  };
  KL.decode = function (str) {
    if (typeof str !== 'string' || str.length < 26 || str.length > 26 + 4 * KL.MAX_STK || !/^[0-9a-z]+$/.test(str)) return null;
    var nI = KL.INKS.length, d = KL.blank(Math.min(3, un(str[0]))), p = 1;
    for (var i = 0; i < KL.NZ; i++) {
      var c = un(str[p++]) - 1, pt = un(str[p++]), a = un(str[p++]) - 1;
      d.z[i] = [c < nI ? c : -1, pt < 6 ? pt : 0, a < nI ? a : -1];
    }
    d.l = Math.min(3, un(str[p++]));
    while (p + 4 <= str.length) {
      var k = un(str[p]), kc = un(str[p + 1]) - 1;
      if (k < 6 && kc >= 0 && kc < nI) d.k.push([k, kc, un(str[p + 2]) / 35, un(str[p + 3]) / 35]);
      p += 4;
    }
    return d;
  };

  // Colors that appear anywhere on the shoe (zones, pattern accents, stickers).
  function usedColors(d, out) {
    out = out || [];
    out.length = 0;
    for (var i = 0; i < KL.NZ; i++) {
      var q = d.z[i];
      if (q[0] >= 0 && !has(out, q[0])) out.push(q[0]);
      if (q[1] > 0 && q[2] >= 0 && !has(out, q[2])) out.push(q[2]);
    }
    for (i = 0; i < d.k.length; i++) if (!has(out, d.k[i][1])) out.push(d.k[i][1]);
    return out;
  }
  KL.usedColors = usedColors;
  // Share of the shoe printed in the vibe's inks (patterns: 60% base, 40% accent).
  KL.vibeShare = function (d, v) {
    var pal = KL.VIBES[v].pal, s = 0;
    for (var i = 0; i < KL.NZ; i++) {
      var q = d.z[i], w = KL.ZW[i];
      if (q[1] > 0 && q[2] >= 0) {
        if (q[0] >= 0 && has(pal, q[0])) s += w * 0.6;
        if (has(pal, q[2])) s += w * 0.4;
      } else if (q[0] >= 0 && has(pal, q[0])) s += w;
    }
    return s;
  };
  function moodHits(d, m) {
    var used = usedColors(d, []), hits = [];
    for (var j = 0; j < m.length; j++) {
      var mc = hexRgb(m[j]), ok = false;
      for (var i = 0; i < used.length && !ok; i++) if (cdist(mc, INK_RGB[used[i]]) <= KL.MOOD_TOL) ok = true;
      hits.push(ok);
    }
    return hits;
  }
  // Zones a "keep" (remix) order lets you repaint: those named by zone requirements.
  function zoneTargets(o) { var t = []; for (var i = 0; i < o.reqs.length; i++) if (o.reqs[i].t === 'zone') t.push(o.reqs[i].z); return t; }

  // Evaluates one requirement. Returns {ok, v} (v = extra detail for the UI).
  KL.check = function (q, d, o) {
    var used, i;
    switch (q.t) {
      case 'color': used = usedColors(d, []); return { ok: has(used, q.c) };
      case 'ban': used = usedColors(d, []); return { ok: !has(used, q.c) };
      case 'zone': return { ok: d.z[q.z][0] === q.c };
      case 'vibe': var vs = KL.vibeShare(d, q.v); return { ok: vs >= KL.VIBE_MIN - 1e-9, v: vs };
      case 'pat': for (i = 0; i < KL.NZ; i++) if (d.z[i][1] === q.p && d.z[i][2] >= 0) return { ok: true }; return { ok: false };
      case 'stk': for (i = 0; i < d.k.length; i++) if (d.k[i][0] === q.k) return { ok: true }; return { ok: false };
      case 'mood': var h = moodHits(d, q.m); return { ok: h[0] && h[1] && h[2], v: h };
      case 'lace': return { ok: d.l === q.l };
      case 'sil': return { ok: d.s === q.s };
      case 'keep':
        var tg = zoneTargets(o), bad = 0;
        for (i = 0; i < KL.NZ; i++) if (!has(tg, i) && d.z[i][0] !== o.start.z[i][0]) bad++;
        return { ok: bad === 0, v: bad };
    }
    return { ok: false };
  };

  // Harmony: 0..10. A few colors, related hues and a neutral base read as "designed".
  KL.harmony = function (d) {
    var cols = [], i, q, painted = 0;
    for (i = 0; i < KL.NZ; i++) {
      q = d.z[i];
      if (q[0] >= 0) { painted++; if (!has(cols, q[0])) cols.push(q[0]); }
      if (q[1] > 0 && q[2] >= 0 && !has(cols, q[2])) cols.push(q[2]);
    }
    if (!painted) return 0;
    var n = cols.length, s = 0;
    s += n >= 2 && n <= 4 ? 4 : n === 5 ? 2 : n === 1 ? 1 : 0;
    var hues = [];
    for (i = 0; i < n; i++) { var c = INK_HSL[cols[i]]; if (c[1] > 0.3 && c[2] > 0.18 && c[2] < 0.88) hues.push(c[0]); }
    if (hues.length <= 1) s += 3;
    else {
      var maxD = 0, comp = false;
      for (i = 0; i < hues.length; i++) for (var j = i + 1; j < hues.length; j++) {
        var dh = Math.abs(hues[i] - hues[j]); if (dh > 180) dh = 360 - dh;
        if (dh > maxD) maxD = dh;
        if (dh >= 140) comp = true;
      }
      if (maxD <= 75) s += 4;
      else if (comp && hues.length <= 3) s += 4;
      else if (hues.length <= 3) s += 1;
    }
    if (has(KL.NEUTRAL, d.z[7][0]) || has(KL.NEUTRAL, d.z[6][0])) s += 2;
    s -= (KL.NZ - painted);
    return Math.max(0, Math.min(10, s));
  };

  // Rating: requirements share 80 points, harmony and speed up to 10 each, the spray booth
  // adds 5 per level. 88+ = 5 stamps.
  KL.STAR_AT = [0, 30, 50, 70, 88];
  KL.rate = function (o, d, elapsed, booth) {
    var rows = [], n = o.reqs.length, got = 0, all = true;
    for (var i = 0; i < n; i++) {
      var r = KL.check(o.reqs[i], d, o), pts = r.ok ? 80 / n : 0;
      rows.push({ q: o.reqs[i], ok: r.ok, v: r.v, pts: Math.round(pts) });
      got += pts;
      if (!r.ok) all = false;
    }
    var harm = KL.harmony(d);
    var soft = o.soft || 60, sp = elapsed <= soft ? 10 : Math.max(0, Math.round(10 * (1 - (elapsed - soft) / soft)));
    var bo = 5 * (booth || 0);
    var total = Math.min(100, Math.round(got + harm + sp + bo));
    var stars = 1;
    for (i = 1; i < KL.STAR_AT.length; i++) if (total >= KL.STAR_AT[i]) stars = i + 1;
    return { rows: rows, harm: harm, speed: sp, booth: bo, total: total, stars: stars, all: all };
  };

  // ---------- order generation ----------
  // A requirement: {t:'color',c} {t:'zone',z,c} {t:'vibe',v} {t:'pat',p} {t:'stk',k} {t:'ban',c}
  // {t:'mood',m:[hex,hex,hex]} {t:'lace',l} {t:'sil',s} {t:'keep'} (remix only).
  var POOLS = [
    ['color', 'color', 'stk', 'zone'],
    ['color', 'zone', 'pat', 'stk', 'ban', 'vibe', 'color'],
    ['color', 'zone', 'pat', 'stk', 'ban', 'vibe', 'mood', 'lace', 'sil'],
    ['color', 'zone', 'pat', 'stk', 'ban', 'vibe', 'mood', 'lace', 'sil'],
    ['zone', 'pat', 'stk', 'ban', 'vibe', 'mood', 'lace', 'sil', 'color']
  ];
  function reqCount(r, tier) {
    if (tier === 0) return 2;
    if (tier === 1) return r() < 0.5 ? 2 : 3;
    if (tier === 2) return 3;
    if (tier === 3) return r() < 0.7 ? 3 : 4;
    return r() < 0.6 ? 4 : 3;
  }
  function perturb(r, hex) {
    var c = hexRgb(hex);
    for (var i = 0; i < 3; i++) c[i] = Math.max(0, Math.min(255, c[i] + Math.round((r() * 2 - 1) * 12)));
    return rgbHex(c);
  }
  function randomDesign(r, U, nCols) {
    var d = KL.blank(pick(r, U.sil)), cols = shuffle(r, U.ink.slice()).slice(0, nCols);
    for (var i = 0; i < KL.NZ; i++) d.z[i][0] = pick(r, cols);
    d.z[7][0] = cols[0]; d.z[0][0] = cols[1 % cols.length];
    d.l = pick(r, U.lace);
    return d;
  }
  function draftOrder(r, tier, U, extra) {
    var n = Math.min(4, reqCount(r, tier) + (extra ? 1 : 0));
    var remix = tier >= 3 && r() < 0.35;
    var o = { reqs: [], start: null, tier: tier, pick: !!extra };
    var need = [], banned = [], zonesUsed = [], kinds = {};
    var pats = U.pat.filter(function (p) { return p > 0; });
    function free(c) { return !has(banned, c); }
    function add(q) { o.reqs.push(q); kinds[q.t] = (kinds[q.t] || 0) + 1; }
    var vibeOf = -1;
    if (remix) {
      o.start = randomDesign(r, U, 3 + Math.floor(r() * 2));
      var ch2 = shuffle(r, ['zone', 'zone', 'pat', 'stk']), made = 0;
      for (var a = 0; a < ch2.length && made < 2; a++) {
        var t = ch2[a];
        if (t === 'zone') {
          var z = pick(r, [0, 1, 2, 3, 4, 6, 7].filter(function (q) { return !has(zonesUsed, q); }));
          var cs = U.ink.filter(function (c) { return c !== o.start.z[z][0]; });
          zonesUsed.push(z); add({ t: 'zone', z: z, c: pick(r, cs) }); made++;
        } else if (t === 'pat' && pats.length && !kinds.pat) { add({ t: 'pat', p: pick(r, pats) }); made++; }
        else if (t === 'stk' && !kinds.stk) { add({ t: 'stk', k: pick(r, U.stk) }); made++; }
      }
      add({ t: 'keep' });
      if (o.reqs.length < n) {
        if (r() < 0.5 && U.lace.length > 1) add({ t: 'lace', l: pick(r, U.lace.filter(function (l) { return l !== o.start.l; })) });
        else {
          var sc = KL.usedColors(o.start, []), cc = U.ink.filter(function (c) { return !has(sc, c); });
          if (cc.length) add({ t: 'color', c: pick(r, cc) });
        }
      }
      return o;
    }
    var pool = POOLS[Math.min(tier, POOLS.length - 1)], guard = 0;
    while (o.reqs.length < n && guard++ < 60) {
      var k = pick(r, pool), q = null, c, opts;
      if (k === 'color') {
        opts = U.ink.filter(function (x) { return free(x) && !has(need, x); });
        if (vibeOf >= 0 && r() < 0.6) { var vo = opts.filter(function (x) { return has(KL.VIBES[vibeOf].pal, x); }); if (vo.length) opts = vo; }
        if (opts.length && (kinds.color || 0) < 2) { c = pick(r, opts); need.push(c); q = { t: 'color', c: c }; }
      } else if (k === 'zone' && (kinds.zone || 0) < 2) {
        var zs = [0, 1, 2, 3, 4, 5, 6, 7].filter(function (x) { return !has(zonesUsed, x); });
        opts = U.ink.filter(free);
        if (vibeOf >= 0) { var vz = opts.filter(function (x) { return has(KL.VIBES[vibeOf].pal, x); }); if (vz.length) opts = vz; }
        var zz = pick(r, zs); c = pick(r, opts); zonesUsed.push(zz); need.push(c); q = { t: 'zone', z: zz, c: c };
      } else if (k === 'pat' && !kinds.pat && pats.length) q = { t: 'pat', p: pick(r, pats) };
      else if (k === 'stk' && !kinds.stk) q = { t: 'stk', k: pick(r, U.stk) };
      else if (k === 'ban' && !kinds.ban) {
        opts = U.ink.filter(function (x) { return !has(need, x); });
        if (vibeOf >= 0) opts = opts.filter(function (x) { return KL.VIBES[vibeOf].pal.filter(function (y) { return y !== x && has(U.ink, y); }).length >= 2; });
        if (opts.length && U.ink.length - 1 >= 5) { c = pick(r, opts); banned.push(c); q = { t: 'ban', c: c }; }
      } else if (k === 'vibe' && !kinds.vibe) {
        var vs = [];
        for (var v = 0; v < KL.VIBES.length; v++) {
          var ownV = KL.VIBES[v].pal.filter(function (x) { return has(U.ink, x) && free(x); });
          if (ownV.length >= 3) vs.push(v);
        }
        if (vs.length) { vibeOf = pick(r, vs); q = { t: 'vibe', v: vibeOf }; }
      } else if (k === 'mood' && !kinds.mood) {
        opts = U.ink.filter(free);
        if (vibeOf >= 0) { var vm = opts.filter(function (x) { return has(KL.VIBES[vibeOf].pal, x); }); if (vm.length >= 3) opts = vm; }
        if (opts.length >= 3) {
          var src = shuffle(r, opts.slice()).slice(0, 3);
          src.forEach(function (x) { if (!has(need, x)) need.push(x); });
          q = { t: 'mood', m: src.map(function (x) { return perturb(r, KL.INKS[x]); }) };
        }
      } else if (k === 'lace' && !kinds.lace && U.lace.length > 1) q = { t: 'lace', l: pick(r, U.lace.filter(function (x) { return x > 0; })) };
      else if (k === 'sil' && !kinds.sil && U.sil.length > 1) q = { t: 'sil', s: pick(r, U.sil.filter(function (x) { return x > 0; })) };
      if (q) add(q);
    }
    // A ban drawn early must not hit a color required later.
    for (var i = 0; i < o.reqs.length; i++) if (o.reqs[i].t === 'ban' && has(need, o.reqs[i].c)) return null;
    return o.reqs.length >= 2 ? o : null;
  }
  // Soft timer and pay: more requirements = more time and more cash.
  function finishOrder(o) {
    var n = o.reqs.length;
    o.soft = 30 + 12 * n + (o.start ? 6 : 0);
    o.pay = 10 + 7 * n + (o.tier || 0) * 3;
    return o;
  }
  KL.tutorialOrder = function () {
    return finishOrder({ reqs: [{ t: 'color', c: 2 }, { t: 'color', c: 3 }, { t: 'stk', k: 0 }], start: null, tier: 0, tut: true });
  };
  KL.fallbackOrder = function (U, r) {
    var cs = shuffle(r || Math.random, U.ink.slice());
    return finishOrder({ reqs: [{ t: 'color', c: cs[0] }, { t: 'color', c: cs[1] }], start: null, tier: 0 });
  };
  // Only returns orders the solver can satisfy with the player's current unlocks.
  KL.genOrder = function (r, tier, U, extra) {
    for (var tries = 0; tries < 40; tries++) {
      var o = draftOrder(r, tier, U, extra);
      if (o && KL.solve(o, U)) return finishOrder(o);
    }
    return KL.fallbackOrder(U, r);
  };

  // ---------- solver ----------
  // Builds a design that meets every requirement using only owned content, or returns null.
  var SPOTS = [[0.28, 0.5], [0.62, 0.42], [0.82, 0.62]];
  KL.SPOTS = SPOTS;
  KL.solve = function (o, U) {
    var d = o.start ? KL.clone(o.start) : KL.blank(U.sil[0]);
    var banned = [], fixed = {}, needs = [], vibe = -1, patReq = -1, stkReq = [], keep = false, moods = null, i, q;
    for (i = 0; i < o.reqs.length; i++) {
      q = o.reqs[i];
      if (q.t === 'sil') { if (!has(U.sil, q.s)) return null; d.s = q.s; }
      else if (q.t === 'lace') { if (!has(U.lace, q.l)) return null; d.l = q.l; }
      else if (q.t === 'ban') banned.push(q.c);
      else if (q.t === 'zone') { if (fixed[q.z] !== undefined && fixed[q.z] !== q.c) return null; fixed[q.z] = q.c; }
      else if (q.t === 'vibe') vibe = q.v;
      else if (q.t === 'pat') { if (!has(U.pat, q.p)) return null; patReq = q.p; }
      else if (q.t === 'stk') { if (!has(U.stk, q.k)) return null; stkReq.push(q.k); }
      else if (q.t === 'keep') keep = true;
      else if (q.t === 'color') needs.push(q.c);
      else if (q.t === 'mood') moods = q.m;
    }
    var allowed = U.ink.filter(function (c) { return !has(banned, c); });
    if (!allowed.length) return null;
    var vset = vibe >= 0 ? KL.VIBES[vibe].pal.filter(function (c) { return has(allowed, c); }) : null;
    if (vset && !vset.length) return null;
    for (i = 0; i < needs.length; i++) if (!has(allowed, needs[i])) return null;
    for (var z in fixed) { if (!has(U.ink, fixed[z]) || has(banned, fixed[z])) return null; d.z[z][0] = fixed[z]; }
    if (moods) {
      for (i = 0; i < 3; i++) {
        var mc = hexRgb(moods[i]), best = -1, bd = 1e9;
        for (var j = 0; j < allowed.length; j++) {
          var dd = cdist(mc, INK_RGB[allowed[j]]) - (vset && has(vset, allowed[j]) ? 6 : 0);
          if (dd < bd && cdist(mc, INK_RGB[allowed[j]]) <= KL.MOOD_TOL) { bd = dd; best = allowed[j]; }
        }
        if (best < 0) return null;
        if (!has(needs, best)) needs.push(best);
      }
    }
    var targets = zoneTargets(o);
    var freeZ = [];
    for (i = 0; i < KL.NZ; i++) if (fixed[i] === undefined && !(keep && !has(targets, i))) freeZ.push(i);
    freeZ.sort(function (a, b) { return KL.ZW[b] - KL.ZW[a]; });
    var present = KL.usedColors(d, []);
    var missing = needs.filter(function (c) { return !has(present, c); });
    var spill = [];
    var fill;
    if (vset) {
      fill = vset[0];
      for (i = 0; i < vset.length; i++) if (has(needs, vset[i])) { fill = vset[i]; break; }
      var inV = missing.filter(function (c) { return has(vset, c); });
      spill = missing.filter(function (c) { return !has(vset, c); });
      for (i = 0; i < freeZ.length; i++) d.z[freeZ[i]][0] = i < inV.length ? inV[i] : fill;
      // More vibe colors than zones: the rest go on stickers too.
      for (i = freeZ.length; i < inV.length; i++) spill.push(inV[i]);
    } else {
      var zi = 0;
      for (i = 0; i < missing.length; i++) {
        if (zi < freeZ.length) d.z[freeZ[zi++]][0] = missing[i];
        else spill.push(missing[i]);
      }
      var neutral = [1, 0, 10, 18].filter(function (c) { return has(allowed, c); });
      fill = missing.length ? missing[0] : (d.z[0][0] >= 0 ? d.z[0][0] : allowed[0]);
      for (; zi < freeZ.length; zi++) {
        var fz = freeZ[zi];
        d.z[fz][0] = (fz === 7 || fz === 6) && neutral.length ? neutral[0] : fill;
      }
    }
    // Stickers carry required colors that did not fit into zones.
    for (i = 0; i < stkReq.length; i++) {
      var sc = spill.length ? spill.shift() : (fill !== undefined && fill >= 0 ? fill : allowed[0]);
      if (d.k.length >= KL.MAX_STK) return null;
      d.k.push([stkReq[i], sc, SPOTS[d.k.length][0], SPOTS[d.k.length][1]]);
    }
    if (patReq > 0) {
      var pz = freeZ.length ? freeZ[0] : 0, base = d.z[pz][0];
      if (spill.length && vset) pz = freeZ.length ? freeZ[freeZ.length - 1] : 5;
      base = d.z[pz][0];
      var acc = -1;
      if (spill.length && spill[0] !== base) acc = spill.shift();
      if (acc < 0) {
        var cand = (vset || allowed).filter(function (c) { return c !== base; });
        if (!cand.length) cand = allowed.filter(function (c) { return c !== base; });
        if (!cand.length) return null;
        acc = cand[0];
        for (i = 0; i < cand.length; i++) if (has(needs, cand[i])) { acc = cand[i]; break; }
      }
      d.z[pz][1] = patReq; d.z[pz][2] = acc;
    }
    while (spill.length) {
      if (d.k.length >= KL.MAX_STK) return null;
      d.k.push([U.stk[0], spill.shift(), SPOTS[d.k.length][0], SPOTS[d.k.length][1]]);
    }
    if (KL.rate(o, d, 0, 0).all) return d;
    return searchFix(o, U, d, freeZ, allowed, vset);
  };
  // Fallback: random restarts over the free zones and sticker colors.
  function searchFix(o, U, d0, freeZ, allowed, vset) {
    var r = KL.rng(1234567), d, i;
    for (var it = 0; it < 400; it++) {
      d = KL.clone(d0);
      for (i = 0; i < freeZ.length; i++) d.z[freeZ[i]][0] = pick(r, vset && r() < 0.8 ? vset : allowed);
      for (i = 0; i < d.k.length; i++) d.k[i][1] = pick(r, allowed);
      if (KL.rate(o, d, 0, 0).all) return d;
    }
    return null;
  }

  // ---------- self-check ----------
  // Generates orders across every tier with random (but valid) unlock sets and checks that the
  // solver's design scores 5 stamps. Returns {ok, n, fails:[...]}.
  KL.selfCheck = function (perTier, seed) {
    var r = KL.rng(seed || 99), fails = [], n = 0;
    perTier = perTier || 100;
    function randMask(base, total) { var m = base; for (var i = 0; i < total; i++) if (r() < 0.5) m |= (1 << i); return m; }
    for (var tier = 0; tier < KL.TIER_REP.length; tier++) {
      for (var i = 0; i < perTier; i++) {
        var minimal = i % 4 === 0;
        var mask = minimal ? KL.START : {
          ink: randMask(KL.START.ink, KL.INKS.length), pat: randMask(KL.START.pat, 6), stk: randMask(KL.START.stk, 6),
          lace: randMask(KL.START.lace, 4), sil: randMask(KL.START.sil, 4)
        };
        var U = KL.unlocks(mask), extra = r() < 0.4;
        var o = KL.genOrder(r, tier, U, extra);
        var d = KL.solve(o, U);
        n++;
        var res = d && KL.rate(o, d, 0, 0);
        if (!d || res.stars !== 5 || !owns(d, U)) fails.push({ tier: tier, order: o, design: d && KL.encode(d) });
      }
    }
    var tut = KL.tutorialOrder(), U0 = KL.unlocks(KL.START), td = KL.solve(tut, U0);
    n++;
    if (!td || KL.rate(tut, td, 0, 0).stars !== 5) fails.push({ tier: 'tutorial' });
    return { ok: fails.length === 0, n: n, fails: fails };
  };
  // The design only uses content the player owns (or the remix start already had).
  function owns(d, U) {
    if (!has(U.sil, d.s) || !has(U.lace, d.l)) return false;
    for (var i = 0; i < KL.NZ; i++) {
      var q = d.z[i];
      if (q[0] >= 0 && !has(U.ink, q[0])) return false;
      if (q[1] > 0 && (!has(U.pat, q[1]) || !has(U.ink, q[2]))) return false;
    }
    for (i = 0; i < d.k.length; i++) if (!has(U.stk, d.k[i][0]) || !has(U.ink, d.k[i][1])) return false;
    return true;
  }
  KL.owns = owns;
})(typeof window !== 'undefined' ? window : globalThis);
