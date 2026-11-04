/*
 * Night Drift: the endless procedural road.
 *
 * The road is a chain of segments: straights (k = 0) and circular arcs (k = +-1/R).
 * Features (sweepers, corners, S-bends, chicanes, hairpins) are drawn from a seeded RNG,
 * so a seed always gives the same road. Corners get tighter, chicanes and hairpins appear
 * and the road narrows as the distance grows. The overall heading is kept within +-100
 * degrees of "north", so the road never loops back over itself.
 *
 * Conventions: world y points down (canvas), heading h is the travel angle, and the
 * lateral normal is n = (-sin h, cos h). A positive offset is on the n side, which is the
 * inside of a k > 0 arc (k > 0 turns clockwise on screen, i.e. to the right).
 *
 * Segments are generated ahead of the car and culled behind it. Each segment keeps an
 * absolute id, and nearest-point queries only look at the segments around a hint id,
 * so collision checks are O(1) amortized.
 */
(function () {
  'use strict';
  var PI = Math.PI, TAU = PI * 2, DEG = PI / 180;
  var START_H = -PI / 2;
  var LIM = 100 * DEG;

  function wrap(a) { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var KIND_STRAIGHT = 0, KIND_SWEEP = 1, KIND_CORNER = 2, KIND_S = 3, KIND_CHICANE = 4, KIND_HAIRPIN = 5, KIND_TUT = 6;
  var DEC_PALM = 0, DEC_PYLON = 1, DEC_CHEV = 2, DEC_LAMP = 3;

  var segs = [], segPool = [], base = 0;
  var tokens = [], tokPool = [];
  var decor = [], decPool = [];
  var rng = Math.random;
  var ex = 0, ey = 0, eh = START_H, es = 0;
  var needConn = false, nextDecS = 0, tutorial = false, tutSeg = -1;
  var Q = { t: 0, d: 0, dist: 0 };
  var TMP = { x: 0, y: 0, h: 0, k: 0, hw: 0, id: 0, s: 0, d: 0, t: 0 };

  function diff(s) { return 1 - Math.exp(-s / 3200); }
  function halfW(s) {
    var w = lerp(5.1, 3.65, 1 - Math.exp(-s / 4500));
    if (tutorial && s < 900) w += 0.7 * (1 - s / 900);
    return w;
  }

  // ------------------------------------------------------------------ segments
  function newSeg() {
    return segPool.pop() || { id: 0, x0: 0, y0: 0, h0: 0, len: 0, k: 0, s0: 0, w: 0, cx: 0, cy: 0, R: 0, a0: 0, x1: 0, y1: 0, h1: 0, kind: 0, dir: 0 };
  }

  function addSeg(len, k, kind) {
    var g = newSeg();
    g.id = base + segs.length; g.x0 = ex; g.y0 = ey; g.h0 = eh; g.len = len; g.k = k; g.s0 = es;
    g.kind = kind | 0; g.dir = k > 0 ? 1 : k < 0 ? -1 : 0;
    g.w = halfW(es + len * 0.5);
    if (k !== 0) {
      g.R = 1 / Math.abs(k);
      g.cx = ex - Math.sin(eh) / k; g.cy = ey + Math.cos(eh) / k;
      g.a0 = Math.atan2(ey - g.cy, ex - g.cx);
      g.h1 = eh + k * len;
      g.x1 = g.cx + Math.sin(g.h1) / k; g.y1 = g.cy - Math.cos(g.h1) / k;
    } else {
      g.R = 0; g.cx = 0; g.cy = 0; g.a0 = 0; g.h1 = eh;
      g.x1 = ex + Math.cos(eh) * len; g.y1 = ey + Math.sin(eh) * len;
    }
    ex = g.x1; ey = g.y1; eh = g.h1; es += len;
    segs.push(g);
    hideDecorOn(g);
    placeDecor(g);
    return g;
  }

  function segById(id) { var i = id - base; return i >= 0 && i < segs.length ? segs[i] : null; }

  /** Point at local distance t along segment g, offset o along the normal. */
  function pointOn(g, t, o, out) {
    if (g.k === 0) {
      var c = Math.cos(g.h0), s = Math.sin(g.h0);
      out.x = g.x0 + c * t - s * o; out.y = g.y0 + s * t + c * o; out.h = g.h0;
    } else {
      var h = g.h0 + g.k * t, sn = Math.sin(h), cs = Math.cos(h);
      out.x = g.cx + sn / g.k - sn * o; out.y = g.cy - cs / g.k + cs * o; out.h = h;
    }
    out.k = g.k; out.hw = g.w;
    return out;
  }

  function projSeg(g, x, y, out) {
    var t, d, over = 0;
    if (g.k === 0) {
      var c = Math.cos(g.h0), s = Math.sin(g.h0), dx = x - g.x0, dy = y - g.y0;
      t = dx * c + dy * s; d = -dx * s + dy * c;
    } else {
      var rx = x - g.cx, ry = y - g.cy, r = Math.sqrt(rx * rx + ry * ry);
      t = wrap(Math.atan2(ry, rx) - g.a0) / g.k;
      d = (g.k > 0 ? 1 : -1) * (g.R - r);
    }
    if (t < 0) { over = -t; t = 0; } else if (t > g.len) { over = t - g.len; t = g.len; }
    out.t = t; out.d = d; out.dist = over > 0 ? Math.sqrt(over * over + d * d) : Math.abs(d);
    return out;
  }

  /**
   * Nearest point on the centerline, searching only the segments around hint id.
   * out: id, s, t, d (signed lateral offset), x, y, h (tangent), k, hw.
   */
  function project(x, y, id, out) {
    var bestD = 1e9, bi = -1, bt = 0, bd = 0, j, g;
    for (j = id - 1; j <= id + 2; j++) {
      g = segById(j); if (!g) continue;
      projSeg(g, x, y, Q);
      if (Q.dist < bestD - 1e-6) { bestD = Q.dist; bi = j; bt = Q.t; bd = Q.d; }
    }
    if (bi < 0) { // hint fell out of the window (should not happen): full scan
      for (j = 0; j < segs.length; j++) {
        projSeg(segs[j], x, y, Q);
        if (Q.dist < bestD) { bestD = Q.dist; bi = segs[j].id; bt = Q.t; bd = Q.d; }
      }
    }
    g = segById(bi);
    pointOn(g, bt, 0, out);
    out.id = bi; out.s = g.s0 + bt; out.t = bt; out.d = bd;
    return out;
  }

  /** Centerline point at arc length s (offset o), walking from hint id. */
  function sample(id, s, o, out) {
    var g = segById(id) || segs[0];
    while (s > g.s0 + g.len) { var n = segById(g.id + 1); if (!n) break; g = n; }
    while (s < g.s0) { var p = segById(g.id - 1); if (!p) break; g = p; }
    pointOn(g, clamp(s - g.s0, 0, g.len), o || 0, out);
    out.id = g.id; out.s = s;
    return out;
  }

  // ------------------------------------------------------------------ tokens & decor
  function addToken(g, t, o) {
    var k = tokPool.pop() || { s: 0, x: 0, y: 0, taken: false, tt: 0 };
    pointOn(g, t, o, TMP);
    k.s = g.s0 + t; k.x = TMP.x; k.y = TMP.y; k.taken = false; k.tt = 0;
    tokens.push(k);
  }
  function arcTokens(g) {
    var n = clamp(Math.round(g.len / 5), 3, 6);
    for (var i = 0; i < n; i++) {
      var f = 0.12 + 0.76 * i / (n - 1);
      addToken(g, g.len * f, g.dir * g.w * 0.45 * Math.sin(PI * f));
    }
  }
  function lineTokens(g, n, o) {
    var gap = 3.6, t0 = g.len * 0.5 - gap * (n - 1) / 2;
    if (t0 < 1) return;
    for (var i = 0; i < n; i++) addToken(g, t0 + gap * i, o);
  }

  function roadClear(x, y, fromId, toId, margin) {
    for (var j = Math.max(base, fromId); j <= toId; j++) {
      var g = segById(j); if (!g) continue;
      projSeg(g, x, y, Q);
      if (Q.dist < g.w + margin) return false;
    }
    return true;
  }

  function addDecor(g, t, o, kind) {
    pointOn(g, t, o, TMP);
    if (!roadClear(TMP.x, TMP.y, g.id - 16, g.id, kind === DEC_CHEV ? 0.6 : 1.6)) return;
    var d = decPool.pop() || { s: 0, x: 0, y: 0, kind: 0, dir: 0, h: 0, ph: 0, col: 0, hidden: false };
    d.s = g.s0 + t; d.x = TMP.x; d.y = TMP.y; d.kind = kind; d.dir = g.dir; d.hidden = false;
    d.h = kind === DEC_PALM ? 4.2 + rng() * 2.2 : kind === DEC_PYLON ? 2.6 + rng() * 2.6 : kind === DEC_LAMP ? 3.6 : 1;
    d.ph = rng() * TAU; d.col = rng() < 0.5 ? 0 : 1;
    decor.push(d);
  }

  function placeDecor(g) {
    // chevron boards on the outside of real corners
    if (g.k !== 0 && g.R < 30 && Math.abs(g.k * g.len) > 0.4) {
      var stepC = Math.max(4.5, g.len / 4);
      for (var tc = g.len * 0.12; tc < g.len * 0.9; tc += stepC) addDecor(g, tc, -g.dir * (g.w + 1.3), DEC_CHEV);
    }
    // scenery: palms, crystal pylons and lamps on both sides
    while (nextDecS < g.s0 + g.len) {
      var t = nextDecS - g.s0;
      if (t >= 0) {
        var side = rng() < 0.5 ? -1 : 1, off = g.w + 2.3 + rng() * 7;
        if (g.k !== 0 && side === g.dir) off = Math.min(off, g.R - 2.5);
        if (off > g.w + 2) {
          var r = rng();
          addDecor(g, t, side * off, r < 0.42 ? DEC_PALM : r < 0.86 ? DEC_PYLON : DEC_LAMP);
        }
      }
      nextDecS += 5 + rng() * 8;
    }
  }

  function hideDecorOn(g) {
    for (var i = decor.length - 1; i >= 0; i--) {
      var d = decor[i];
      if (d.s < g.s0 - 260) break;
      if (d.hidden) continue;
      projSeg(g, d.x, d.y, Q);
      if (Q.dist < g.w + 1.6) d.hidden = true;
    }
  }

  // ------------------------------------------------------------------ generator
  function relH() { return wrap(eh - START_H); }
  /** Returns a signed turn angle of magnitude <= th that keeps the heading within limits. */
  function turn(th, prefer) {
    var rel = relH(), dir = prefer || (rng() < 0.5 ? -1 : 1);
    if (!prefer && Math.abs(rel) > 0.5 && rng() < 0.7) dir = rel > 0 ? -1 : 1;
    var room = dir > 0 ? LIM - rel : LIM + rel;
    if (room < 0.4 && !prefer) { dir = -dir; room = dir > 0 ? LIM - rel : LIM + rel; }
    return dir * Math.max(0.2, Math.min(th, room));
  }
  function arc(theta, R, kind) { return addSeg(Math.abs(theta) * R, (theta > 0 ? 1 : -1) / R, kind); }

  function connector() {
    var d = diff(es);
    if (rng() < lerp(0, 0.3, d)) return;
    var g = addSeg(lerp(30, 9, d) * (0.55 + rng()), 0, KIND_STRAIGHT);
    if (g.len > 16 && rng() < 0.35) lineTokens(g, 4, (rng() - 0.5) * g.w * 0.8);
  }

  function feature() {
    var d = diff(es), rel = relH();
    var wSweep = lerp(0.26, 0.08, d), wCorner = 0.34, wS = lerp(0.18, 0.24, d);
    var wChic = d > 0.12 && Math.abs(rel) < 0.9 ? lerp(0.04, 0.2, d) : 0;
    var wHair = d > 0.3 && Math.abs(rel) > 0.55 ? lerp(0.05, 0.22, d) : 0;
    var r = rng() * (wSweep + wCorner + wS + wChic + wHair), g, R, th;
    var tok = rng() < 0.6;

    if ((r -= wSweep) < 0) {
      R = 32 + rng() * 22;
      g = arc(turn((30 + rng() * 40) * DEG), R, KIND_SWEEP);
      if (tok) arcTokens(g);
    } else if ((r -= wCorner) < 0) {
      R = lerp(21, 12.5, d) * (0.9 + 0.3 * rng());
      g = arc(turn((55 + rng() * 55) * DEG), R, KIND_CORNER);
      if (tok) arcTokens(g);
    } else if ((r -= wS) < 0) {
      R = lerp(20, 13, d) * (0.9 + 0.3 * rng());
      g = arc(turn((45 + rng() * 40) * DEG), R, KIND_S);
      if (tok) arcTokens(g);
      var mid = lerp(6, 0, d) * rng();
      if (mid > 0.8) addSeg(mid, 0, KIND_S);
      var R2 = lerp(20, 13, d) * (0.9 + 0.3 * rng());
      var g2 = arc(turn((45 + rng() * 45) * DEG, -g.dir), R2, KIND_S);
      if (tok) arcTokens(g2);
    } else if ((r -= wChic) < 0) {
      R = lerp(15, 10.5, d);
      th = turn((28 + rng() * 14) * DEG);
      var a = arc(th, R, KIND_CHICANE);
      addSeg(1.5, 0, KIND_CHICANE);
      var b = arc(-2 * th, R, KIND_CHICANE);
      addSeg(1.5, 0, KIND_CHICANE);
      arc(th, R, KIND_CHICANE);
      if (tok) { addToken(a, a.len * 0.6, a.dir * a.w * 0.3); addToken(b, b.len * 0.5, b.dir * b.w * 0.35); }
    } else {
      R = lerp(15, 11.5, d) * (0.95 + 0.15 * rng());
      th = turn((120 + rng() * 35) * DEG, rel > 0 ? -1 : 1);
      g = arc(th, R, Math.abs(th) > 1.6 ? KIND_HAIRPIN : KIND_CORNER);
      if (tok) arcTokens(g);
    }
  }

  function genStep() {
    if (needConn) { connector(); needConn = false; } else { feature(); needConn = true; }
  }

  // ------------------------------------------------------------------ public API
  function clearArr(arr, pool) { while (arr.length) pool.push(arr.pop()); }

  function reset(seed, tut) {
    clearArr(segs, segPool); clearArr(tokens, tokPool); clearArr(decor, decPool);
    base = 0; ex = 0; ey = 0; eh = START_H; es = 0; needConn = false; nextDecS = 6;
    rng = mulberry32(seed >>> 0);
    tutorial = !!tut; tutSeg = -1;
    addSeg(tut ? 70 : 55, 0, KIND_STRAIGHT);
    if (tut) {
      var g = arc(88 * DEG, 21, KIND_TUT);
      tutSeg = g.id;
      arcTokens(g);
      addSeg(34, 0, KIND_STRAIGHT);
      arcTokens(arc(-82 * DEG, 20, KIND_TUT));
      addSeg(32, 0, KIND_STRAIGHT);
    } else {
      lineTokens(segs[0], 4, 0);
    }
    needConn = false;
  }

  function ensure(sAhead) { var n = 0; while (es < sAhead && n++ < 64) genStep(); }

  function cull(sBehind) {
    while (segs.length > 3 && segs[0].s0 + segs[0].len < sBehind) { segPool.push(segs.shift()); base++; }
    while (tokens.length && tokens[0].s < sBehind + 30) tokPool.push(tokens.shift());
    while (decor.length && decor[0].s < sBehind) decPool.push(decor.shift());
  }

  window.NDTrack = {
    KIND_TUT: KIND_TUT, KIND_HAIRPIN: KIND_HAIRPIN, KIND_CHICANE: KIND_CHICANE,
    DEC_PALM: DEC_PALM, DEC_PYLON: DEC_PYLON, DEC_CHEV: DEC_CHEV, DEC_LAMP: DEC_LAMP,
    START_H: START_H,
    segs: segs, tokens: tokens, decor: decor,
    reset: reset, ensure: ensure, cull: cull, project: project, sample: sample,
    segById: segById, pointOn: pointOn, diff: diff, wrap: wrap,
    endS: function () { return es; },
    firstId: function () { return base; },
    tutSeg: function () { return tutSeg; }
  };
})();
