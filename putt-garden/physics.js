/*
 * physics.js: Putt Garden's deterministic top-down ball physics.
 *
 * Shared by the game (browser, window.PuttPhysics) and the offline hole checker
 * (Node, tools/putt-garden-verify.cjs). No DOM access. A fixed 240 Hz step and only
 * plain arithmetic, Math.sqrt and (for moving obstacles and the shot angle) Math.sin /
 * Math.cos, so the same shots always give the same result.
 *
 * World units, y points down. A hole (see holes.js) is compiled into a world:
 *   out     closed polygon: the outer wall, the fairway is inside it
 *   blocks  closed polygons: solid stone islands
 *   rails   open polylines: thin walls
 *   posts   [x, y, r] round stones;  bumpers [x, y, r] springy flowers
 *   gates   [ax, ay, bx, by] one-way gates; the ball may pass in the direction of
 *           n = (ay - by, bx - ax) / len and is blocked coming back
 *   sand, rough, water   polygons;  slopes [polygon, ax, ay] (acceleration, units/s^2)
 *   blades  [cx, cy, len, arms, omega rad/s, phase rad] windmill-style rotating arms
 *   sliders [x, y, w, h, dx, dy, period s, phase 0..1] blocks sliding by (dx, dy) and back
 *   pipes   [inX, inY, outX, outY, outDeg] teleport pipes (in -> out, leaving at outDeg)
 *   tee [x, y], cup [x, y]
 */
(function (root) {
  'use strict';

  var C = {
    R: 9,               // ball radius
    CUP_R: 13,          // cup radius
    DT: 1 / 240,
    VMAX: 1100,         // full-power putt speed (4.6 units per step, far below the ball radius)
    VCAP: 1300,         // absolute speed cap (after bumpers)
    WALL_T: 4,          // half thickness of walls and block edges
    WALL_E: 0.66, POST_E: 0.66, BLADE_E: 0.6, SLIDER_E: 0.6, GATE_E: 0.6,
    BUMP_KICK: 230,
    CAP: 270,           // the ball drops if it crosses the cup slower than this
    LIP_PULL: 2600,
    PIPE_R: 13, PIPE_MIN: 220,
    STILL_STEPS: 30,    // slow for 0.125 s -> at rest, ready for the next putt
    STOP_V: 5,
    MAX_SHOT_T: 25,
    BLADE_T: 5, HUB_R: 11, GATE_T: 2
  };
  // [constant deceleration, linear drag] per surface
  var FRIC = [[150, 0.6], [430, 1.3], [950, 3.2]];
  var S_FAIR = 0, S_ROUGH = 1, S_SAND = 2;

  var EV_WALL = 1, EV_BUMP = 2, EV_SPLASH = 3, EV_RATTLE = 4, EV_SINK = 5, EV_PIPE = 6, EV_GATE = 7, EV_BLADE = 8, EV_SAND = 9, EV_PIPEOUT = 10, EV_REST = 11;
  var M_AIM = 0, M_ROLL = 1, M_SUNK = 2;

  function polyBox(p) {
    var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (var i = 0; i < p.length; i += 2) {
      if (p[i] < minx) minx = p[i]; if (p[i] > maxx) maxx = p[i];
      if (p[i + 1] < miny) miny = p[i + 1]; if (p[i + 1] > maxy) maxy = p[i + 1];
    }
    return [minx, miny, maxx, maxy];
  }
  function inPoly(p, x, y) {
    var inside = false, n = p.length;
    for (var i = 0, j = n - 2; i < n; j = i, i += 2) {
      var yi = p[i + 1], yj = p[j + 1];
      if ((yi > y) !== (yj > y)) {
        var xi = p[i], xj = p[j];
        if (x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
    }
    return inside;
  }
  function zone(p) { var b = polyBox(p); return { p: p, x0: b[0], y0: b[1], x1: b[2], y1: b[3] }; }
  function inZone(z, x, y) { return x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1 && inPoly(z.p, x, y); }

  // ------------------------------------------------------------------ world
  function createWorld(hole) {
    var w = {
      hole: hole,
      seg: [], nSeg: 0, segA: null,      // static segments (flat: ax ay bx by r e minx miny maxx maxy)
      circ: [],                          // static circles [x, y, r, e, kind]
      gates: [], blades: [], sliders: [], pipes: [],
      sand: [], rough: [], water: [], slopes: [],
      cup: { x: hole.cup[0], y: hole.cup[1] },
      ball: { x: hole.tee[0], y: hole.tee[1], vx: 0, vy: 0 },
      lastX: hole.tee[0], lastY: hole.tee[1],
      t: 0, step: 0, mode: M_AIM, still: C.STILL_STEPS, shotT: 0, pin: true,
      strokes: 0, penalty: 0, contact: -99, inCup: false, surf: S_FAIR, inPipe: -1,
      ev: { n: 0, type: new Int8Array(64), x: new Float32Array(64), y: new Float32Array(64), s: new Float32Array(64) }
    };
    var i, a, segs = [];
    function addPoly(p, closed) {
      var n = p.length / 2;
      for (var k = 0; k < n - 1 + (closed ? 1 : 0); k++) {
        var j = (k + 1) % n;
        segs.push([p[k * 2], p[k * 2 + 1], p[j * 2], p[j * 2 + 1], C.WALL_T, C.WALL_E]);
      }
    }
    if (hole.out) addPoly(hole.out, true);
    (hole.blocks || []).forEach(function (p) { addPoly(p, true); });
    (hole.rails || []).forEach(function (p) { addPoly(p, false); });
    var f = new Float64Array(segs.length * 10);
    for (i = 0; i < segs.length; i++) {
      a = segs[i];
      var m = a[4] + C.R + 1;
      f.set([a[0], a[1], a[2], a[3], a[4], a[5],
        Math.min(a[0], a[2]) - m, Math.min(a[1], a[3]) - m, Math.max(a[0], a[2]) + m, Math.max(a[1], a[3]) + m], i * 10);
    }
    w.segA = f; w.nSeg = segs.length;
    (hole.posts || []).forEach(function (p) { w.circ.push([p[0], p[1], p[2], C.POST_E, 0]); });
    (hole.bumpers || []).forEach(function (p) { w.circ.push([p[0], p[1], p[2], 1, 1]); });
    (hole.gates || []).forEach(function (g) {
      var dx = g[2] - g[0], dy = g[3] - g[1], l = Math.sqrt(dx * dx + dy * dy);
      w.gates.push({ ax: g[0], ay: g[1], bx: g[2], by: g[3], nx: -dy / l, ny: dx / l, flash: -9 });
    });
    (hole.blades || []).forEach(function (b) {
      w.blades.push({ cx: b[0], cy: b[1], len: b[2], arms: b[3], om: b[4], ph: b[5], ang: b[5] });
      w.circ.push([b[0], b[1], C.HUB_R, C.POST_E, 2]);
    });
    (hole.sliders || []).forEach(function (s) {
      w.sliders.push({ x0: s[0], y0: s[1], w: s[2], h: s[3], dx: s[4], dy: s[5], per: s[6], ph: s[7], x: s[0], y: s[1], ux: 0, uy: 0 });
    });
    (hole.pipes || []).forEach(function (p) {
      var ang = p[4] * Math.PI / 180;
      w.pipes.push({ ix: p[0], iy: p[1], ox: p[2], oy: p[3], dx: Math.cos(ang), dy: Math.sin(ang) });
    });
    (hole.sand || []).forEach(function (p) { w.sand.push(zone(p)); });
    (hole.rough || []).forEach(function (p) { w.rough.push(zone(p)); });
    (hole.water || []).forEach(function (p) { w.water.push(zone(p)); });
    (hole.slopes || []).forEach(function (s) { var z = zone(s[0]); z.ax = s[1]; z.ay = s[2]; w.slopes.push(z); });
    moveKinematics(w);
    return w;
  }

  function emit(w, type, x, y, s) {
    var e = w.ev;
    if (e.n >= 64) return;
    e.type[e.n] = type; e.x[e.n] = x; e.y[e.n] = y; e.s[e.n] = s; e.n++;
  }

  function moveKinematics(w) {
    var t = w.t, i;
    for (i = 0; i < w.blades.length; i++) { var b = w.blades[i]; b.ang = b.ph + b.om * t; }
    for (i = 0; i < w.sliders.length; i++) {
      var s = w.sliders[i], ph = 2 * Math.PI * (t / s.per + s.ph);
      var k = 0.5 - 0.5 * Math.cos(ph), dk = 0.5 * Math.sin(ph) * 2 * Math.PI / s.per;
      s.x = s.x0 + s.dx * k; s.y = s.y0 + s.dy * k;
      s.ux = s.dx * dk; s.uy = s.dy * dk;
    }
  }

  // circle (ball) vs capsule segment, with the segment moving at (ux, uy) + omega x (p - pivot)
  // returns the impact speed (0 when there was no contact)
  function collideSeg(w, ax, ay, bx, by, r, e, ux, uy, om, pcx, pcy) {
    var B = w.ball, dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    var t = l2 > 0 ? ((B.x - ax) * dx + (B.y - ay) * dy) / l2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var px = ax + dx * t, py = ay + dy * t;
    var nx = B.x - px, ny = B.y - py, d2 = nx * nx + ny * ny, rr = r + C.R;
    if (d2 >= rr * rr) return 0;
    var d = Math.sqrt(d2);
    w.contact = w.step;
    if (d < 1e-9) { var l = Math.sqrt(l2) || 1; nx = -dy / l; ny = dx / l; d = 0; } else { nx /= d; ny /= d; }
    B.x = px + nx * rr; B.y = py + ny * rr;
    var vx = ux, vy = uy;
    if (om) { vx += -om * (py - pcy); vy += om * (px - pcx); }
    var rvx = B.vx - vx, rvy = B.vy - vy, vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      rvx -= (1 + e) * vn * nx; rvy -= (1 + e) * vn * ny;
      B.vx = rvx + vx; B.vy = rvy + vy;
      return -vn;
    }
    return 0.001;
  }

  function collide(w) {
    var B = w.ball, f = w.segA, i, o, hit, maxHit = 0, hx = 0, hy = 0;
    for (i = 0; i < w.nSeg; i++) {
      o = i * 10;
      if (B.x < f[o + 6] || B.x > f[o + 8] || B.y < f[o + 7] || B.y > f[o + 9]) continue;
      hit = collideSeg(w, f[o], f[o + 1], f[o + 2], f[o + 3], f[o + 4], f[o + 5], 0, 0, 0, 0, 0);
      if (hit > maxHit) { maxHit = hit; hx = B.x; hy = B.y; }
    }
    if (maxHit > 25) emit(w, EV_WALL, hx, hy, maxHit);
    for (i = 0; i < w.circ.length; i++) {
      var c = w.circ[i], nx = B.x - c[0], ny = B.y - c[1], rr = c[2] + C.R, d2 = nx * nx + ny * ny;
      if (d2 >= rr * rr) continue;
      var d = Math.sqrt(d2);
      w.contact = w.step;
      if (d < 1e-9) { nx = 0; ny = -1; } else { nx /= d; ny /= d; }
      B.x = c[0] + nx * rr; B.y = c[1] + ny * rr;
      var vn = B.vx * nx + B.vy * ny;
      if (vn < 0) {
        if (c[4] === 1) {
          var out = -vn * 0.85 + C.BUMP_KICK;
          B.vx -= vn * nx; B.vy -= vn * ny;
          B.vx += out * nx; B.vy += out * ny;
          emit(w, EV_BUMP, c[0], c[1], out);
        } else {
          B.vx -= (1 + c[3]) * vn * nx; B.vy -= (1 + c[3]) * vn * ny;
          if (-vn > 25) emit(w, EV_WALL, B.x, B.y, -vn);
        }
      }
    }
    for (i = 0; i < w.gates.length; i++) {
      var g = w.gates[i];
      var side = (B.x - g.ax) * g.nx + (B.y - g.ay) * g.ny;
      if (side <= 0 || B.vx * g.nx + B.vy * g.ny >= 0) continue;
      hit = collideSeg(w, g.ax, g.ay, g.bx, g.by, C.GATE_T, C.GATE_E, 0, 0, 0, 0, 0);
      if (hit > 1) { g.flash = w.t; if (hit > 25) emit(w, EV_GATE, B.x, B.y, hit); }
    }
    for (i = 0; i < w.blades.length; i++) {
      var bl = w.blades[i];
      var dxm = B.x - bl.cx, dym = B.y - bl.cy, lim = bl.len + C.BLADE_T + C.R + 1;
      if (dxm * dxm + dym * dym > lim * lim) continue;
      for (var k = 0; k < bl.arms; k++) {
        var a = bl.ang + k * 2 * Math.PI / bl.arms;
        var tx = bl.cx + Math.cos(a) * bl.len, ty = bl.cy + Math.sin(a) * bl.len;
        hit = collideSeg(w, bl.cx, bl.cy, tx, ty, C.BLADE_T, C.BLADE_E, 0, 0, bl.om, bl.cx, bl.cy);
        if (hit > 25) emit(w, EV_BLADE, B.x, B.y, hit);
      }
    }
    for (i = 0; i < w.sliders.length; i++) {
      var s = w.sliders[i], x0 = s.x, y0 = s.y, x1 = s.x + s.w, y1 = s.y + s.h, m = C.R + 4;
      if (B.x < x0 - m || B.x > x1 + m || B.y < y0 - m || B.y > y1 + m) continue;
      var mh = 0;
      hit = collideSeg(w, x0, y0, x1, y0, 2, C.SLIDER_E, s.ux, s.uy, 0, 0, 0); if (hit > mh) mh = hit;
      hit = collideSeg(w, x1, y0, x1, y1, 2, C.SLIDER_E, s.ux, s.uy, 0, 0, 0); if (hit > mh) mh = hit;
      hit = collideSeg(w, x1, y1, x0, y1, 2, C.SLIDER_E, s.ux, s.uy, 0, 0, 0); if (hit > mh) mh = hit;
      hit = collideSeg(w, x0, y1, x0, y0, 2, C.SLIDER_E, s.ux, s.uy, 0, 0, 0); if (hit > mh) mh = hit;
      if (mh > 25) emit(w, EV_WALL, B.x, B.y, mh);
    }
  }

  function surfaceAt(w, x, y) {
    var i;
    for (i = 0; i < w.sand.length; i++) if (inZone(w.sand[i], x, y)) return S_SAND;
    for (i = 0; i < w.rough.length; i++) if (inZone(w.rough[i], x, y)) return S_ROUGH;
    return S_FAIR;
  }
  function inWater(w, x, y) {
    for (var i = 0; i < w.water.length; i++) if (inZone(w.water[i], x, y)) return true;
    return false;
  }
  var SLOPE = { x: 0, y: 0 };
  function slopeAt(w, x, y) {
    SLOPE.x = 0; SLOPE.y = 0;
    for (var i = 0; i < w.slopes.length; i++) {
      var z = w.slopes[i];
      if (inZone(z, x, y)) { SLOPE.x += z.ax; SLOPE.y += z.ay; }
    }
    return SLOPE;
  }

  // ------------------------------------------------------------------ step
  function step(w) {
    w.ev.n = 0;
    w.step++;
    w.t = w.step * C.DT;
    moveKinematics(w);
    var B = w.ball;
    if (w.mode === M_SUNK) return;

    var surf = surfaceAt(w, B.x, B.y);
    if (surf === S_SAND && w.surf !== S_SAND && (B.vx || B.vy)) emit(w, EV_SAND, B.x, B.y, Math.sqrt(B.vx * B.vx + B.vy * B.vy));
    w.surf = surf;
    var fr = FRIC[surf], fc = fr[0], fl = fr[1];
    var sl = w.pin ? null : slopeAt(w, B.x, B.y);
    var ax = sl ? sl.x : 0, ay = sl ? sl.y : 0;
    var sp2 = B.vx * B.vx + B.vy * B.vy;
    var DT = C.DT;
    if (sp2 === 0) {
      var a2 = ax * ax + ay * ay;
      if (a2 > fc * fc) {
        var am = Math.sqrt(a2), k0 = (am - fc) / am;
        B.vx = ax * k0 * DT; B.vy = ay * k0 * DT;
      }
    } else {
      B.vx += ax * DT; B.vy += ay * DT;
      var sp = Math.sqrt(B.vx * B.vx + B.vy * B.vy);
      var ns = sp - (fc + fl * sp) * DT;
      if (w.inCup) ns -= 1.5 * fl * sp * DT;
      if (ns <= 0) { B.vx = 0; B.vy = 0; }
      else {
        if (ns > C.VCAP) ns = C.VCAP;
        B.vx *= ns / sp; B.vy *= ns / sp;
      }
    }
    // cup lip pull
    var cdx = w.cup.x - B.x, cdy = w.cup.y - B.y, cd2 = cdx * cdx + cdy * cdy;
    if (cd2 < C.CUP_R * C.CUP_R && (B.vx || B.vy)) {
      var cd = Math.sqrt(cd2) || 1;
      B.vx += cdx / cd * C.LIP_PULL * DT; B.vy += cdy / cd * C.LIP_PULL * DT;
    }
    B.x += B.vx * DT; B.y += B.vy * DT;
    collide(w);
    collide(w);

    // pipes
    var i;
    for (i = 0; i < w.pipes.length; i++) {
      var p = w.pipes[i], pdx = B.x - p.ix, pdy = B.y - p.iy;
      if (pdx * pdx + pdy * pdy < C.PIPE_R * C.PIPE_R) {
        var spd = Math.sqrt(B.vx * B.vx + B.vy * B.vy) * 0.9;
        if (spd < C.PIPE_MIN) spd = C.PIPE_MIN;
        emit(w, EV_PIPE, p.ix, p.iy, spd);
        B.x = p.ox; B.y = p.oy; B.vx = p.dx * spd; B.vy = p.dy * spd;
        emit(w, EV_PIPEOUT, p.ox, p.oy, spd);
        w.inPipe = i;
        break;
      }
    }
    // water: penalty stroke, back to where the last putt was taken
    if (inWater(w, B.x, B.y)) {
      emit(w, EV_SPLASH, B.x, B.y, Math.sqrt(B.vx * B.vx + B.vy * B.vy));
      w.penalty++;
      B.x = w.lastX; B.y = w.lastY; B.vx = 0; B.vy = 0;
      w.mode = M_AIM; w.still = 0; w.inCup = false; w.pin = true;
      return;
    }
    // cup
    cdx = w.cup.x - B.x; cdy = w.cup.y - B.y; cd2 = cdx * cdx + cdy * cdy;
    var inside = cd2 < C.CUP_R * C.CUP_R;
    if (inside) {
      var s2 = B.vx * B.vx + B.vy * B.vy;
      if (s2 < C.CAP * C.CAP) {
        emit(w, EV_SINK, w.cup.x, w.cup.y, Math.sqrt(s2));
        w.mode = M_SUNK; B.vx = 0; B.vy = 0; w.inCup = false;
        return;
      }
      if (!w.inCup) emit(w, EV_RATTLE, w.cup.x, w.cup.y, Math.sqrt(s2));
    }
    w.inCup = inside;

    // rest detection: slower than STOP_V for STILL_STEPS steps -> the ball settles (and
    // ignores slopes until the next putt or until something knocks it)
    var v2 = B.vx * B.vx + B.vy * B.vy;
    var settle = (ax * ax + ay * ay <= fc * fc) || w.step - w.contact < 4;
    if (v2 < C.STOP_V * C.STOP_V && (settle || w.pin)) {
      if (w.still < C.STILL_STEPS) {
        w.still++;
        if (w.still === C.STILL_STEPS) {
          B.vx = 0; B.vy = 0; w.pin = true;
          if (w.mode === M_ROLL) emit(w, EV_REST, B.x, B.y, 0);
          w.mode = M_AIM;
        }
      } else if (w.pin) { B.vx = 0; B.vy = 0; }
    } else {
      w.still = 0;
      if (w.pin && v2 > 400) w.pin = false;
    }
    if (w.mode === M_ROLL) {
      w.shotT += DT;
      if (w.shotT > C.MAX_SHOT_T) { B.vx = 0; B.vy = 0; w.still = C.STILL_STEPS; w.pin = true; w.mode = M_AIM; emit(w, EV_REST, B.x, B.y, 0); }
    }
  }

  function canShoot(w) { return w.mode === M_AIM && w.still >= C.STILL_STEPS; }
  // angle in radians (world), power 0..1
  function shoot(w, angle, power) {
    if (power < 0) power = 0; else if (power > 1) power = 1;
    var B = w.ball, v = power * C.VMAX;
    w.lastX = B.x; w.lastY = B.y;
    B.vx = Math.cos(angle) * v; B.vy = Math.sin(angle) * v;
    w.mode = M_ROLL; w.still = 0; w.shotT = 0; w.pin = false; w.strokes++;
  }
  function score(w) { return w.strokes + w.penalty; }

  // Replays reference shots [[angleDeg, power, waitSeconds], ...]. Returns { sunk, strokes, steps }.
  function replay(hole, shots, maxStrokes) {
    var w = createWorld(hole), i, n, guard;
    maxStrokes = maxStrokes || 99;
    for (i = 0; i < shots.length && w.mode !== M_SUNK && score(w) < maxStrokes; i++) {
      var sh = shots[i];
      n = Math.round((sh[2] || 0) / C.DT);
      while (n-- > 0 || !canShoot(w)) { step(w); if (w.mode === M_SUNK) break; }
      if (w.mode === M_SUNK) break;
      shoot(w, sh[0] * Math.PI / 180, sh[1]);
      guard = 0;
      do { step(w); guard++; } while (w.mode !== M_SUNK && !canShoot(w) && guard < 40 * 240);
    }
    return { sunk: w.mode === M_SUNK, strokes: score(w), world: w };
  }

  var api = {
    C: C, FRIC: FRIC, S_FAIR: S_FAIR, S_ROUGH: S_ROUGH, S_SAND: S_SAND,
    EV_WALL: EV_WALL, EV_BUMP: EV_BUMP, EV_SPLASH: EV_SPLASH, EV_RATTLE: EV_RATTLE, EV_SINK: EV_SINK,
    EV_PIPE: EV_PIPE, EV_PIPEOUT: EV_PIPEOUT, EV_GATE: EV_GATE, EV_BLADE: EV_BLADE, EV_SAND: EV_SAND, EV_REST: EV_REST,
    M_AIM: M_AIM, M_ROLL: M_ROLL, M_SUNK: M_SUNK,
    createWorld: createWorld, step: step, shoot: shoot, canShoot: canShoot, score: score, replay: replay,
    inPoly: inPoly, polyBox: polyBox, surfaceAt: surfaceAt, inWater: inWater
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuttPhysics = api;
})(this);
