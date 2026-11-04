/*
 * physics.js: Ink Path's deterministic marble physics and stroke builder.
 *
 * Shared by the game (browser, window.InkPhysics) and the offline level checker
 * (Node, tools/ink-path-verify.cjs). It only uses + - * / Math.sqrt and Math.floor
 * on doubles, with a fixed time step, so the same strokes always give the same run.
 *
 * World units: the level area is C.W x C.H (640 x 1000), y points down.
 * Marbles are circles; strokes, stone ledges, cup walls, paper screens and bamboo
 * springs are capsules (segments with a radius). Lanterns are moving circles.
 */
(function (root) {
  'use strict';

  var C = {
    W: 640, H: 1000,
    R: 18,                 // marble radius
    G: 1250,               // gravity, units / s^2
    DT: 1 / 240,           // fixed physics step (four steps per 60 Hz frame)
    MAXV: 1700,            // speed cap: 7 units per step, far below the 46-unit contact band, so no tunnelling
    STROKE_R: 5, LEDGE_R: 11, CUP_R: 6, SCREEN_R: 5, PAD_R: 7,
    ROLL: 0.15,            // rolling resistance while touching something (fraction of speed per second)
    MIN_STEP: 8,           // stroke sampling distance
    WALK: 4,               // how finely a pointer move is walked to find mist / no-ink edges
    RDP_EPS: 1.6,          // stroke simplification tolerance
    NODRAW_M: 40,          // no ink this close to a marble's start
    MAX_T: 20, STILL_V: 6, STILL_T: 1.25,
    CUP_IN: 38, CUP_TOP: 46
  };
  // Cup (bowl) wall polyline relative to the cup's base point (x, y = bottom).
  var CUP = [-46, -52, -41, -17, -28, -4, 28, -4, 41, -17, 46, -52];

  var T_STROKE = 1, T_LEDGE = 2, T_CUP = 3, T_SCREEN = 4, T_PAD = 5;
  // restitution and friction per segment type (index = type)
  var MAT_E = [0, 0.12, 0.25, 0.1, 0.2, 0.2];
  var MAT_MU = [0, 0.04, 0.06, 0.2, 0.05, 0.05];
  var LANTERN_E = 0.55, MARBLE_E = 0.5;

  var EV_HIT = 1, EV_PAD = 2, EV_TEAR = 3, EV_CUP = 4, EV_LANTERN = 5, EV_CLACK = 6, EV_LOST = 7;
  var RES_RUN = 0, RES_WIN = 1, RES_LOST = -1, RES_STUCK = -2, RES_TIME = -3;

  var ST = 14; // segment stride: ax ay bx by r type idx dx dy len2 minx miny maxx maxy

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ------------------------------------------------------------------ world
  function createWorld(L) {
    var w = {
      L: L, stat: [], strokes: [], segs: null, nSeg: 0,
      marbles: [], cups: [], lan: [], winds: [], pads: [], scr: [],
      scrBroken: null, padHit: null,
      step: 0, t: 0, result: RES_RUN, still: 0, firstLost: -1,
      ev: { n: 0, type: new Int8Array(64), x: new Float32Array(64), y: new Float32Array(64), s: new Float32Array(64) }
    };
    var i, a;
    var ledges = L.L || [];
    for (i = 0; i < ledges.length; i++) {
      a = ledges[i];
      w.stat.push([a[0], a[1], a[2], a[3], a[4] || C.LEDGE_R, T_LEDGE, i]);
    }
    var cups = L.c || [];
    for (i = 0; i < cups.length; i++) {
      var cx = cups[i][0], cy = cups[i][1];
      w.cups.push({ x: cx, y: cy, filled: -1 });
      for (var k = 0; k + 3 < CUP.length; k += 2) {
        w.stat.push([cx + CUP[k], cy + CUP[k + 1], cx + CUP[k + 2], cy + CUP[k + 3], C.CUP_R, T_CUP, i]);
      }
    }
    var scr = L.scr || [];
    for (i = 0; i < scr.length; i++) {
      a = scr[i];
      w.scr.push({ ax: a[0], ay: a[1], bx: a[2], by: a[3], k: a[4] || 320 });
      w.stat.push([a[0], a[1], a[2], a[3], C.SCREEN_R, T_SCREEN, i]);
    }
    var pads = L.pad || [];
    for (i = 0; i < pads.length; i++) {
      // [x1, y1, x2, y2, launch speed]; the spring pushes towards the left of a->b
      // (a->b drawn left to right means it launches upwards)
      a = pads[i];
      var pdx = a[2] - a[0], pdy = a[3] - a[1], plen = Math.sqrt(pdx * pdx + pdy * pdy);
      var p = { x: (a[0] + a[2]) / 2, y: (a[1] + a[3]) / 2, tx: pdx / plen, ty: pdy / plen,
        nx: pdy / plen, ny: -pdx / plen, hw: plen / 2, v: a[4] };
      w.pads.push(p);
      w.stat.push([a[0], a[1], a[2], a[3], C.PAD_R, T_PAD, i]);
    }
    var winds = L.wind || [];
    for (i = 0; i < winds.length; i++) {
      a = winds[i];
      w.winds.push({ x: a[0], y: a[1], w: a[2], h: a[3], fx: a[4], fy: a[5] });
    }
    var lan = L.lan || [];
    for (i = 0; i < lan.length; i++) {
      a = lan[i];
      w.lan.push({ ax: a[0], ay: a[1], bx: a[2], by: a[3], r: a[4], T: a[5], ph: a[6] || 0, x: a[0], y: a[1], vx: 0, vy: 0, hit: -9 });
    }
    var ms = L.m || [];
    for (i = 0; i < ms.length; i++) {
      w.marbles.push({ sx: ms[i][0], sy: ms[i][1], x: 0, y: 0, vx: 0, vy: 0, rot: 0, state: 0, cup: -1,
        capT: 0, capX: 0, capY: 0, contact: 0, cs: 0 });
    }
    w.scrBroken = new Uint8Array(w.scr.length);
    w.padHit = new Float64Array(w.pads.length);
    rebuild(w);
    reset(w);
    return w;
  }

  // strokes: array of flat polylines [x0,y0,x1,y1,...]
  function setStrokes(w, strokes) {
    w.strokes = strokes;
    rebuild(w);
  }

  function rebuild(w) {
    var n = w.stat.length, i, j, s;
    for (i = 0; i < w.strokes.length; i++) n += Math.max(0, w.strokes[i].length / 2 - 1);
    var S = new Float64Array(Math.max(1, n) * ST);
    var o = 0;
    for (i = 0; i < w.stat.length; i++) {
      s = w.stat[i];
      putSeg(S, o, s[0], s[1], s[2], s[3], s[4], s[5], s[6]); o += ST;
    }
    for (i = 0; i < w.strokes.length; i++) {
      var p = w.strokes[i];
      for (j = 0; j + 3 < p.length; j += 2) {
        putSeg(S, o, p[j], p[j + 1], p[j + 2], p[j + 3], C.STROKE_R, T_STROKE, i); o += ST;
      }
    }
    w.segs = S;
    w.nSeg = o / ST;
  }

  function putSeg(S, o, ax, ay, bx, by, r, type, idx) {
    var dx = bx - ax, dy = by - ay;
    S[o] = ax; S[o + 1] = ay; S[o + 2] = bx; S[o + 3] = by; S[o + 4] = r; S[o + 5] = type; S[o + 6] = idx;
    S[o + 7] = dx; S[o + 8] = dy; S[o + 9] = dx * dx + dy * dy;
    S[o + 10] = (ax < bx ? ax : bx) - r - C.R; S[o + 11] = (ay < by ? ay : by) - r - C.R;
    S[o + 12] = (ax > bx ? ax : bx) + r + C.R; S[o + 13] = (ay > by ? ay : by) + r + C.R;
  }

  function reset(w) {
    var i;
    for (i = 0; i < w.marbles.length; i++) {
      var m = w.marbles[i];
      m.x = m.sx; m.y = m.sy; m.vx = 0; m.vy = 0; m.rot = 0; m.state = 0; m.cup = -1; m.contact = 0; m.cs = 0;
    }
    for (i = 0; i < w.cups.length; i++) w.cups[i].filled = -1;
    for (i = 0; i < w.scrBroken.length; i++) w.scrBroken[i] = 0;
    for (i = 0; i < w.padHit.length; i++) w.padHit[i] = -9;
    for (i = 0; i < w.lan.length; i++) { lanPos(w.lan[i], 0); w.lan[i].vx = 0; w.lan[i].vy = 0; w.lan[i].hit = -9; }
    w.step = 0; w.t = 0; w.result = RES_RUN; w.still = 0; w.firstLost = -1; w.ev.n = 0;
  }

  // Lantern position at time t: ping-pong between a and b with smoothstep easing.
  function lanPos(l, t) {
    var u = t / l.T + l.ph;
    u -= Math.floor(u);
    var tri = u < 0.5 ? u * 2 : 2 - u * 2;
    var s = tri * tri * (3 - 2 * tri);
    l.x = l.ax + (l.bx - l.ax) * s;
    l.y = l.ay + (l.by - l.ay) * s;
  }

  function pushEv(w, type, x, y, s) {
    var e = w.ev;
    if (e.n >= 64) return;
    e.type[e.n] = type; e.x[e.n] = x; e.y[e.n] = y; e.s[e.n] = s; e.n++;
  }

  function collideSegs(w, m) {
    var S = w.segs, n = w.nSeg, R = C.R;
    for (var s = 0, o = 0; s < n; s++, o += ST) {
      var x = m.x, y = m.y;
      if (x < S[o + 10] || x > S[o + 12] || y < S[o + 11] || y > S[o + 13]) continue;
      var type = S[o + 5];
      if (type === T_SCREEN && w.scrBroken[S[o + 6]]) continue;
      var ax = S[o], ay = S[o + 1], dx = S[o + 7], dy = S[o + 8], l2 = S[o + 9];
      var tt = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
      if (tt < 0) tt = 0; else if (tt > 1) tt = 1;
      var ex = x - (ax + dx * tt), ey = y - (ay + dy * tt);
      var d2 = ex * ex + ey * ey, rr = R + S[o + 4];
      if (d2 >= rr * rr) continue;
      var d = Math.sqrt(d2), nx, ny;
      if (d > 1e-7) { nx = ex / d; ny = ey / d; }
      else {
        var len = Math.sqrt(l2) || 1;
        nx = dy / len; ny = -dx / len;
        if (ny > 0) { nx = -nx; ny = -ny; }
      }
      var vn = m.vx * nx + m.vy * ny;
      if (type === T_SCREEN && -vn > w.scr[S[o + 6]].k) {
        // fast enough: the paper screen tears and the marble goes through, a little slower
        w.scrBroken[S[o + 6]] = 1;
        m.vx *= 0.8; m.vy *= 0.8;
        pushEv(w, EV_TEAR, x - nx * R, y - ny * R, -vn);
        continue;
      }
      var pen = rr - d;
      m.x += nx * pen; m.y += ny * pen;
      m.contact = 1;
      if (vn >= 0) continue;
      if (type === T_PAD) {
        var pd = w.pads[S[o + 6]];
        if (nx * pd.nx + ny * pd.ny > 0.3) {
          var tvx = m.vx - vn * nx, tvy = m.vy - vn * ny;
          m.vx = tvx * 0.6 + pd.nx * pd.v; m.vy = tvy * 0.6 + pd.ny * pd.v;
          w.padHit[S[o + 6]] = w.t;
          pushEv(w, EV_PAD, pd.x, pd.y, pd.v);
          continue;
        }
      }
      var e = MAT_E[type];
      if (-vn < 50) e = 0;
      var jn = -(1 + e) * vn;
      m.vx += nx * jn; m.vy += ny * jn;
      var vn2 = m.vx * nx + m.vy * ny;
      var tx = m.vx - vn2 * nx, ty = m.vy - vn2 * ny;
      var vt = Math.sqrt(tx * tx + ty * ty);
      if (vt > 1e-9) {
        var f = MAT_MU[type] * jn;
        if (f > vt) f = vt;
        f /= vt;
        m.vx -= tx * f; m.vy -= ty * f;
      }
      if (-vn > 140) pushEv(w, EV_HIT, x - nx * R, y - ny * R, -vn);
    }
  }

  function step(w) {
    if (w.result !== RES_RUN) return w.result;
    var dt = C.DT, R = C.R, i, j, m;
    var t1 = (w.step + 1) * dt;
    for (i = 0; i < w.lan.length; i++) {
      var l = w.lan[i], px = l.x, py = l.y;
      lanPos(l, t1);
      l.vx = (l.x - px) / dt; l.vy = (l.y - py) / dt;
    }
    for (i = 0; i < w.marbles.length; i++) {
      m = w.marbles[i];
      if (m.state !== 0) continue;
      var ax = 0, ay = C.G;
      for (j = 0; j < w.winds.length; j++) {
        var z = w.winds[j];
        if (m.x >= z.x && m.x <= z.x + z.w && m.y >= z.y && m.y <= z.y + z.h) { ax += z.fx; ay += z.fy; }
      }
      m.vx += ax * dt; m.vy += ay * dt;
      var sp2 = m.vx * m.vx + m.vy * m.vy;
      if (sp2 > C.MAXV * C.MAXV) { var k = C.MAXV / Math.sqrt(sp2); m.vx *= k; m.vy *= k; }
      m.x += m.vx * dt; m.y += m.vy * dt;
      m.contact = 0;
      collideSegs(w, m);
      collideSegs(w, m);
      for (j = 0; j < w.lan.length; j++) {
        var ln = w.lan[j];
        var ex = m.x - ln.x, ey = m.y - ln.y, rr = R + ln.r, d2 = ex * ex + ey * ey;
        if (d2 >= rr * rr || d2 < 1e-12) continue;
        var d = Math.sqrt(d2), nx = ex / d, ny = ey / d;
        m.x += nx * (rr - d); m.y += ny * (rr - d);
        var vr = (m.vx - ln.vx) * nx + (m.vy - ln.vy) * ny;
        if (vr < 0) {
          m.vx -= (1 + LANTERN_E) * vr * nx; m.vy -= (1 + LANTERN_E) * vr * ny;
          if (w.t - ln.hit > 0.15) pushEv(w, EV_LANTERN, ln.x, ln.y, -vr);
          ln.hit = w.t;
        }
      }
    }
    // marble vs marble (a captured marble is fixed in its cup)
    for (i = 0; i < w.marbles.length; i++) {
      var a = w.marbles[i];
      if (a.state === 2) continue;
      for (j = i + 1; j < w.marbles.length; j++) {
        var b = w.marbles[j];
        if (b.state === 2 || (a.state === 1 && b.state === 1)) continue;
        var dx = b.x - a.x, dy = b.y - a.y, dd = dx * dx + dy * dy, r2 = 2 * R;
        if (dd >= r2 * r2 || dd < 1e-12) continue;
        var dist = Math.sqrt(dd), mx = dx / dist, my = dy / dist, pen = r2 - dist, rel;
        if (a.state === 1) {
          b.x += mx * pen; b.y += my * pen;
          rel = b.vx * mx + b.vy * my;
          if (rel < 0) { b.vx -= (1 + MARBLE_E) * rel * mx; b.vy -= (1 + MARBLE_E) * rel * my; }
        } else if (b.state === 1) {
          a.x -= mx * pen; a.y -= my * pen;
          rel = -(a.vx * mx + a.vy * my);
          if (rel < 0) { a.vx += (1 + MARBLE_E) * rel * mx; a.vy += (1 + MARBLE_E) * rel * my; }
        } else {
          a.x -= mx * pen * 0.5; a.y -= my * pen * 0.5; b.x += mx * pen * 0.5; b.y += my * pen * 0.5;
          rel = (b.vx - a.vx) * mx + (b.vy - a.vy) * my;
          if (rel < 0) {
            var jj = -(1 + MARBLE_E) * rel * 0.5;
            a.vx -= jj * mx; a.vy -= jj * my; b.vx += jj * mx; b.vy += jj * my;
            if (-rel > 80) pushEv(w, EV_CLACK, (a.x + b.x) * 0.5, (a.y + b.y) * 0.5, -rel);
          }
        }
      }
    }
    var active = 0, captured = 0, maxV = 0;
    for (i = 0; i < w.marbles.length; i++) {
      m = w.marbles[i];
      if (m.state === 1) { captured++; continue; }
      if (m.state !== 0) continue;
      if (m.contact) {
        var damp = 1 - C.ROLL * dt;
        m.vx *= damp; m.vy *= damp;
      }
      m.rot += m.vx * dt / R;
      var spd2 = m.vx * m.vx + m.vy * m.vy;
      if (spd2 > maxV) maxV = spd2;
      for (j = 0; j < w.cups.length; j++) {
        var c = w.cups[j];
        if (c.filled >= 0) continue;
        var cdx = m.x - c.x, cdy = m.y - c.y;
        if (cdx > -C.CUP_IN && cdx < C.CUP_IN && cdy > -C.CUP_TOP && cdy < 0) {
          m.state = 1; m.cup = j; c.filled = i;
          m.capT = w.t; m.capX = m.x; m.capY = m.y;
          m.x = c.x; m.y = c.y - 4 - C.CUP_R - R; m.vx = 0; m.vy = 0;
          pushEv(w, EV_CUP, c.x, c.y, Math.sqrt(spd2));
          captured++;
          break;
        }
      }
      if (m.state === 1) continue;
      active++;
      if (m.y > C.H + 40 || m.x < -40 || m.x > C.W + 40 || m.y < -700) {
        m.state = 2;
        if (w.firstLost < 0) w.firstLost = i;
        pushEv(w, EV_LOST, clamp(m.x, 0, C.W), clamp(m.y, 0, C.H), 0);
        w.result = RES_LOST;
      }
    }
    w.step++;
    w.t = w.step * dt;
    if (w.result !== RES_RUN) return w.result;
    if (captured === w.marbles.length) { w.result = RES_WIN; return w.result; }
    if (active > 0 && maxV < C.STILL_V * C.STILL_V) w.still += dt; else w.still = 0;
    if (w.still > C.STILL_T) w.result = RES_STUCK;
    else if (w.t > C.MAX_T) w.result = RES_TIME;
    return w.result;
  }

  // Runs until the level is won or failed. trace(w) is called every step when given.
  function run(w, trace) {
    var maxSteps = Math.ceil(C.MAX_T / C.DT) + 10;
    while (w.result === RES_RUN && w.step < maxSteps) {
      step(w);
      w.ev.n = 0;
      if (trace) trace(w);
    }
    return w.result;
  }

  // ------------------------------------------------------------------ drawing rules
  // May ink go at (x, y)? Not in mist, not on top of a marble's start, not inside a cup.
  function allowed(L, x, y) {
    if (x < 3 || x > C.W - 3 || y < 3 || y > C.H - 3) return false;
    var i, a;
    var mist = L.mist || [];
    for (i = 0; i < mist.length; i++) {
      a = mist[i];
      if (x >= a[0] && x <= a[0] + a[2] && y >= a[1] && y <= a[1] + a[3]) return false;
    }
    var ms = L.m || [];
    for (i = 0; i < ms.length; i++) {
      var dx = x - ms[i][0], dy = y - ms[i][1];
      if (dx * dx + dy * dy < C.NODRAW_M * C.NODRAW_M) return false;
    }
    var cups = L.c || [];
    for (i = 0; i < cups.length; i++) {
      var cx = x - cups[i][0], cy = y - cups[i][1];
      if (cx > -54 && cx < 54 && cy > -60 && cy < 8) return false;
    }
    return true;
  }

  // Builds strokes from pointer samples, exactly like the game does.
  // budget = ink left. Each accepted point may carry a width (render only).
  function Builder(L, budget) {
    this.L = L; this.budget = budget;
    this.polys = []; this.ws = [];
    this.cur = null; this.curW = null;
    this.ink = 0; this.lx = 0; this.ly = 0; this.started = false; this.out = false; this.blocked = 0;
  }
  Builder.prototype.close = function () {
    if (this.cur && this.cur.length >= 4) { this.polys.push(this.cur); this.ws.push(this.curW); }
    this.cur = null; this.curW = null;
  };
  Builder.prototype.add = function (x, y, wd) {
    if (this.out) return;
    wd = wd || 1;
    if (!this.started) {
      this.started = true; this.lx = x; this.ly = y;
      if (allowed(this.L, x, y)) { this.cur = [x, y]; this.curW = [wd]; } else this.blocked++;
      return;
    }
    var dx = x - this.lx, dy = y - this.ly, dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-9) return;
    var n = Math.ceil(dist / C.WALK);
    for (var i = 1; i <= n; i++) {
      var px = this.lx + dx * i / n, py = this.ly + dy * i / n;
      if (!allowed(this.L, px, py)) {
        if (this.cur) this.blocked++;
        this.close();
        continue;
      }
      if (!this.cur) { this.cur = [px, py]; this.curW = [wd]; continue; }
      var k = this.cur.length;
      var sx = px - this.cur[k - 2], sy = py - this.cur[k - 1], sd = Math.sqrt(sx * sx + sy * sy);
      if (sd < C.MIN_STEP && i < n) continue;
      if (sd < C.MIN_STEP) continue;
      if (this.ink + sd >= this.budget) {
        var f = (this.budget - this.ink) / sd;
        this.cur.push(this.cur[k - 2] + sx * f, this.cur[k - 1] + sy * f); this.curW.push(wd);
        this.ink = this.budget; this.out = true;
        this.close();
        return;
      }
      this.cur.push(px, py); this.curW.push(wd);
      this.ink += sd;
    }
    this.lx = x; this.ly = y;
  };
  // Finishes the gesture: adds the exact end point, simplifies. Returns { polys, ws, ink }.
  Builder.prototype.finish = function () {
    if (this.cur && !this.out && allowed(this.L, this.lx, this.ly)) {
      var k = this.cur.length;
      var sx = this.lx - this.cur[k - 2], sy = this.ly - this.cur[k - 1], sd = Math.sqrt(sx * sx + sy * sy);
      if (sd > 2 && this.ink + sd <= this.budget) { this.cur.push(this.lx, this.ly); this.curW.push(this.curW[this.curW.length - 1]); this.ink += sd; }
    }
    this.close();
    var polys = [], ws = [], ink = 0;
    for (var i = 0; i < this.polys.length; i++) {
      var keep = rdp(this.polys[i], C.RDP_EPS);
      var p = [], wv = [];
      for (var j = 0; j < keep.length; j++) if (keep[j]) { p.push(this.polys[i][j * 2], this.polys[i][j * 2 + 1]); wv.push(this.ws[i][j]); }
      if (p.length >= 4) { polys.push(p); ws.push(wv); ink += polyLen(this.polys[i]); }
    }
    return { polys: polys, ws: ws, ink: ink };
  };

  function polyLen(p) {
    var s = 0;
    for (var j = 0; j + 3 < p.length; j += 2) { var dx = p[j + 2] - p[j], dy = p[j + 3] - p[j + 1]; s += Math.sqrt(dx * dx + dy * dy); }
    return s;
  }

  // Ramer-Douglas-Peucker on a flat polyline; returns keep flags per point.
  function rdp(p, eps) {
    var n = p.length / 2, keep = new Array(n), stack = [0, n - 1];
    for (var i = 0; i < n; i++) keep[i] = false;
    keep[0] = true; keep[n - 1] = true;
    while (stack.length) {
      var b = stack.pop(), a = stack.pop();
      var ax = p[a * 2], ay = p[a * 2 + 1], dx = p[b * 2] - ax, dy = p[b * 2 + 1] - ay;
      var l2 = dx * dx + dy * dy, best = -1, bestD = eps * eps;
      for (var k = a + 1; k < b; k++) {
        var px = p[k * 2] - ax, py = p[k * 2 + 1] - ay, d2;
        if (l2 > 0) { var c = px * dy - py * dx; d2 = c * c / l2; } else d2 = px * px + py * py;
        if (d2 > bestD) { bestD = d2; best = k; }
      }
      if (best >= 0) { keep[best] = true; stack.push(a, best, best, b); }
    }
    return keep;
  }

  // Feeds stored polylines through the builder (used by the checker and the hint ghost).
  function buildFrom(L, polys) {
    var out = [], ink = 0;
    for (var i = 0; i < polys.length; i++) {
      var b = new Builder(L, L.ink - ink);
      for (var j = 0; j + 1 < polys[i].length; j += 2) b.add(polys[i][j], polys[i][j + 1]);
      var r = b.finish();
      for (var k = 0; k < r.polys.length; k++) out.push(r.polys[k]);
      ink += r.ink;
    }
    return { polys: out, ink: ink };
  }

  // Stars from ink used: L.st = [percent for 2 stars, percent for 3 stars].
  function starsFor(L, ink) {
    var pct = ink / L.ink * 100;
    return pct <= L.st[1] + 1e-9 ? 3 : pct <= L.st[0] + 1e-9 ? 2 : 1;
  }

  var api = {
    C: C, CUP: CUP,
    T_STROKE: T_STROKE, T_LEDGE: T_LEDGE, T_CUP: T_CUP, T_SCREEN: T_SCREEN, T_PAD: T_PAD,
    EV_HIT: EV_HIT, EV_PAD: EV_PAD, EV_TEAR: EV_TEAR, EV_CUP: EV_CUP, EV_LANTERN: EV_LANTERN, EV_CLACK: EV_CLACK, EV_LOST: EV_LOST,
    RES_RUN: RES_RUN, RES_WIN: RES_WIN, RES_LOST: RES_LOST, RES_STUCK: RES_STUCK, RES_TIME: RES_TIME,
    createWorld: createWorld, setStrokes: setStrokes, reset: reset, step: step, run: run, lanPos: lanPos,
    allowed: allowed, Builder: Builder, buildFrom: buildFrom, polyLen: polyLen, starsFor: starsFor
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.InkPhysics = api;
})(this);
