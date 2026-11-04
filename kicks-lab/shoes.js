/* Kicks Lab: original sneaker silhouettes (side view) built from a few parameters, zone
   Path2Ds, hit testing and the riso-style shoe renderer. Shoe space is 1000 x 600. */
(function () {
  'use strict';
  var KL = window.KL, C = KL.C;
  var TAU = Math.PI * 2;

  // Silhouette parameters: ground g, toe spring sp, sole/mid heights, heel x hx, toe x tx,
  // collar top cy at back x bx, tongue tip (tgx,tgy), vamp (vx,vy), eyelets n.
  var P = [
    { g: 562, sp: 22, sole: 30, midH: 62, midT: 40, hx: 70, tx: 962, cy: 215, bx: 118, tgx: 368, tgy: 150, vx: 790, vy: 338, n: 5, lugs: 0, gore: 0 },
    { g: 562, sp: 12, sole: 36, midH: 40, midT: 34, hx: 82, tx: 954, cy: 66, bx: 132, tgx: 334, tgy: 44, vx: 770, vy: 330, n: 7, lugs: 0, gore: 0, cup: 1 },
    { g: 556, sp: 38, sole: 40, midH: 104, midT: 66, hx: 58, tx: 968, cy: 200, bx: 110, tgx: 362, tgy: 136, vx: 782, vy: 316, n: 5, lugs: 1, gore: 0 },
    { g: 562, sp: 8, sole: 24, midH: 44, midT: 42, hx: 76, tx: 958, cy: 256, bx: 118, tgx: 402, tgy: 234, vx: 792, vy: 346, n: 0, lugs: 0, gore: 1 }
  ];
  function f(n) { return Math.round(n * 10) / 10; }
  function pt(x, y) { return f(x) + ' ' + f(y); }
  function bboxOf(str) {
    var nums = str.match(/-?\d+(\.\d+)?/g).map(Number), b = [1e9, 1e9, -1e9, -1e9];
    for (var i = 0; i + 1 < nums.length; i += 2) {
      b[0] = Math.min(b[0], nums[i]); b[1] = Math.min(b[1], nums[i + 1]);
      b[2] = Math.max(b[2], nums[i]); b[3] = Math.max(b[3], nums[i + 1]);
    }
    return b;
  }
  function inter(a, b) { return [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]; }
  // Rounded polygon path string.
  function roundPoly(pts, r) {
    var s = '', n = pts.length;
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      var d0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      var r0 = Math.min(r, d0 / 2), r2 = Math.min(r, d2 / 2);
      var a = [p1[0] + (p0[0] - p1[0]) * r0 / d0, p1[1] + (p0[1] - p1[1]) * r0 / d0];
      var b = [p1[0] + (p2[0] - p1[0]) * r2 / d2, p1[1] + (p2[1] - p1[1]) * r2 / d2];
      s += (i ? ' L ' : 'M ') + pt(a[0], a[1]) + ' Q ' + pt(p1[0], p1[1]) + ' ' + pt(b[0], b[1]);
    }
    return s + ' Z';
  }

  function build(p) {
    var yh = p.g - p.sole - p.midH, yt = p.g - p.sp - p.sole - p.midT;
    var sh = p.g - p.sole, st = p.g - p.sp - p.sole;
    var midY = function (x) { return yh + (yt - yh) * (x - p.hx) / (p.tx - p.hx); };
    var dipC = [p.bx + (p.tgx - p.bx) * 0.45, p.cy + 50];
    var tb = [p.tgx - 28, p.cy + 18];
    if (p.gore) tb = [p.tgx - 20, p.tgy + 10];
    var body = 'M ' + pt(p.hx + 12, yh + 6) +
      ' C ' + pt(p.hx - 20, yh - 70) + ' ' + pt(p.hx - 6, p.cy + 70) + ' ' + pt(p.bx, p.cy) +
      ' Q ' + pt(dipC[0], dipC[1]) + ' ' + pt(tb[0], tb[1]) +
      ' L ' + pt(p.tgx - 12, p.tgy + 10) +
      ' Q ' + pt(p.tgx + 18, p.tgy - 22) + ' ' + pt(p.tgx + 52, p.tgy + 4) +
      ' L ' + pt(p.vx, p.vy) +
      ' C ' + pt(p.vx + 95, p.vy + 12) + ' ' + pt(p.tx + 4, p.vy + 52) + ' ' + pt(p.tx + 4, yt - 4) +
      ' L ' + pt(p.tx - 10, yt + 8) + ' L ' + pt(p.hx + 12, yh + 8) + ' Z';
    var bodyB = bboxOf(body);
    var bottom = '';
    if (p.lugs) {
      var x = p.tx - 170;
      bottom = ' L ' + pt(x, p.g);
      while (x - 46 > p.hx + 40) { bottom += ' L ' + pt(x - 8, p.g + 12) + ' L ' + pt(x - 28, p.g + 12) + ' L ' + pt(x - 36, p.g); x -= 46; }
      bottom += ' L ' + pt(p.hx + 30, p.g);
    } else bottom = ' L ' + pt(p.hx + 30, p.g);
    var sole = 'M ' + pt(p.hx + 22, sh) + ' L ' + pt(p.tx - 160, sh) + ' Q ' + pt(p.tx - 40, sh) + ' ' + pt(p.tx + 8, st) +
      ' Q ' + pt(p.tx + 24, st + p.sole * 0.55) + ' ' + pt(p.tx - 8, p.g - p.sp + 2) +
      ' Q ' + pt(p.tx - 60, p.g) + ' ' + pt(p.tx - 170, p.g) + bottom +
      ' Q ' + pt(p.hx + 2, p.g) + ' ' + pt(p.hx + 2, p.g - p.sole * 0.5) + ' Q ' + pt(p.hx + 2, sh) + ' ' + pt(p.hx + 22, sh) + ' Z';
    var mid = 'M ' + pt(p.hx + 14, yh) + ' L ' + pt(p.tx - 12, yt) +
      ' C ' + pt(p.tx + 16, yt + 2) + ' ' + pt(p.tx + 26, st - 6) + ' ' + pt(p.tx + 8, st) +
      ' Q ' + pt(p.tx - 40, sh) + ' ' + pt(p.tx - 160, sh) + ' L ' + pt(p.hx + 22, sh) +
      ' C ' + pt(p.hx - 8, sh - 4) + ' ' + pt(p.hx - 14, yh + 12) + ' ' + pt(p.hx + 14, yh) + ' Z';
    if (p.lugs) { // wavy chunky midsole
      mid = 'M ' + pt(p.hx + 14, yh) + ' L ' + pt(p.tx - 12, yt) +
        ' C ' + pt(p.tx + 16, yt + 2) + ' ' + pt(p.tx + 26, st - 6) + ' ' + pt(p.tx + 8, st) +
        ' Q ' + pt(p.tx - 40, sh) + ' ' + pt(p.tx - 160, sh) +
        ' C ' + pt(p.tx - 260, sh - 30) + ' ' + pt(p.tx - 360, sh + 6) + ' ' + pt(p.tx - 460, sh - 20) +
        ' C ' + pt(p.tx - 560, sh - 44) + ' ' + pt(p.hx + 120, sh + 4) + ' ' + pt(p.hx + 22, sh) +
        ' C ' + pt(p.hx - 8, sh - 4) + ' ' + pt(p.hx - 14, yh + 12) + ' ' + pt(p.hx + 14, yh) + ' Z';
    }
    // laces strip runs along the throat
    var T = [p.tgx + 8, p.tgy + 16], V = [p.vx - 6, p.vy - 4];
    var dx = V[0] - T[0], dy = V[1] - T[1], len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len, ux = dx / len, uy = dy / len;
    function along(t, o) { return [T[0] + dx * t + nx * o, T[1] + dy * t + ny * o]; }
    var laces, eyelets = [];
    if (p.gore) {
      var g0 = [p.tgx - 4, p.tgy + 14], g1 = [p.tgx + 150, p.tgy + 46], g2 = [p.tgx + 40, p.tgy + 104];
      laces = roundPoly([g0, g1, g2], 16);
    } else {
      laces = roundPoly([along(0, 0), along(1, 0), along(1, 48), along(0, 48)], 14);
      for (var i = 0; i < p.n; i++) eyelets.push(along(0.06 + 0.88 * i / (p.n - 1), 0));
    }
    // toe cap: the front of the body past a curve
    var toe = 'M ' + pt(p.vx - 24, p.vy - 90) + ' C ' + pt(p.vx + 14, p.vy + 40) + ' ' + pt(p.vx - 12, yt - 36) + ' ' + pt(p.vx - 34, 640) +
      ' L 1100 640 L 1100 ' + f(p.vy - 90) + ' Z';
    // heel counter and the pull tab
    var heel = 'M -60 -60 L ' + pt(p.bx + 62, -60) + ' L ' + pt(p.bx + 62, p.cy + 14) +
      ' C ' + pt(p.bx + 78, p.cy + 110) + ' ' + pt(p.bx + 120, yh - 70) + ' ' + pt(p.bx + 150, yh + 40) + ' L -60 640 Z';
    var tab = 'M ' + pt(p.bx - 32, p.cy + 44) + ' L ' + pt(p.bx - 30, p.cy - 46) + ' Q ' + pt(p.bx - 14, p.cy - 72) + ' ' + pt(p.bx + 22, p.cy - 56) +
      ' L ' + pt(p.bx + 36, p.cy + 26) + ' Z';
    // collar: everything above a soft curve at the back
    var cEnd = p.gore ? p.tgx - 10 : p.tgx - 14;
    var collar = 'M -60 -60 L ' + pt(cEnd, -60) + ' L ' + pt(cEnd, (p.gore ? p.tgy : p.cy) + 64) +
      ' Q ' + pt(p.bx + (p.tgx - p.bx) * 0.45, p.cy + 104) + ' ' + pt(p.hx - 60, p.cy + 56) + ' Z';
    // side panel (the badge area): a slanted, rounded quad under the laces
    var tl = along(0.1, p.gore ? 30 : 76), tr = along(0.84, p.gore ? 28 : 66);
    var br = [tr[0] + 34, midY(tr[0] + 34) - 24], bl = [tl[0] - 36, midY(tl[0] - 36) - 24];
    if (p.gore) { tl = [p.tgx + 60, p.tgy + 108]; }
    var panel = roundPoly([tl, tr, br, bl], 34);
    var Z = [
      [{ d: body }],
      [{ d: panel, clip: 1 }],
      [{ d: toe, clip: 1 }],
      [{ d: heel, clip: 1 }, { d: tab }],
      [{ d: collar, clip: 1 }],
      [{ d: laces }],
      [{ d: mid }],
      [{ d: sole }]
    ];
    var zones = Z.map(function (parts) {
      var b = [1e9, 1e9, -1e9, -1e9];
      parts.forEach(function (q) {
        q.p = new Path2D(q.d);
        var bb = bboxOf(q.d);
        if (q.clip) bb = inter(bb, bodyB);
        b = [Math.min(b[0], bb[0]), Math.min(b[1], bb[1]), Math.max(b[2], bb[2]), Math.max(b[3], bb[3])];
      });
      return { parts: parts, bb: b };
    });
    return {
      p: p, body: new Path2D(body), zones: zones, eyelets: eyelets, T: T, V: V, n: [nx, ny], u: [ux, uy],
      panelBox: inter(bboxOf(panel), bodyB), yh: yh, yt: yt, sh: sh, st: st, midY: midY, bb: [bodyB[0] - 40, Math.min(bodyB[1], p.cy - 80), p.tx + 30, p.g + 14]
    };
  }
  var SIL = KL.SIL = P.map(build);

  // ---------- hit testing ----------
  var hitCtx = KL.canvas(4, 4).getContext('2d');
  function inZone(S, zi, x, y) {
    var z = S.zones[zi];
    if (x < z.bb[0] - 2 || x > z.bb[2] + 2 || y < z.bb[1] - 2 || y > z.bb[3] + 2) return false;
    for (var i = 0; i < z.parts.length; i++) {
      var q = z.parts[i];
      if (hitCtx.isPointInPath(q.p, x, y) && (!q.clip || hitCtx.isPointInPath(S.body, x, y))) return true;
    }
    return false;
  }
  KL.inZone = function (s, zi, x, y) { return inZone(SIL[s], zi, x, y); };
  // Topmost zone under a shoe-space point, or -1.
  var HIT_ORDER = [7, 6, 5, 4, 3, 2, 1, 0];
  KL.zoneAt = function (s, x, y, slop) {
    var S = SIL[s], i;
    for (i = 0; i < HIT_ORDER.length; i++) if (inZone(S, HIT_ORDER[i], x, y)) return HIT_ORDER[i];
    if (slop) { // forgiving taps just outside the outline
      var best = -1, bd = slop;
      for (var a = 0; a < 8; a++) {
        var ox = Math.cos(a * TAU / 8), oy = Math.sin(a * TAU / 8);
        for (var r = slop / 3; r <= slop; r += slop / 3) {
          for (i = 0; i < HIT_ORDER.length; i++) if (inZone(S, HIT_ORDER[i], x + ox * r, y + oy * r)) { if (r < bd) { bd = r; best = HIT_ORDER[i]; } break; }
        }
      }
      return best;
    }
    return -1;
  };
  // A point that is visibly inside each zone (used by the keyboard focus, the hand and tests).
  KL.zoneAnchor = function (s, zi) {
    var S = SIL[s], z = S.zones[zi], bb = z.bb, cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, best = null, bd = 1e9;
    for (var gy = 0; gy <= 10; gy++) for (var gx = 0; gx <= 10; gx++) {
      var x = bb[0] + (bb[2] - bb[0]) * (0.05 + 0.9 * gx / 10), y = bb[1] + (bb[3] - bb[1]) * (0.05 + 0.9 * gy / 10);
      if (KL.zoneAt(s, x, y) !== zi) continue;
      // prefer points well inside (all 4 neighbours at 14 units also in the zone) and near the center
      var inside = 0;
      if (KL.zoneAt(s, x + 14, y) === zi) inside++; if (KL.zoneAt(s, x - 14, y) === zi) inside++;
      if (KL.zoneAt(s, x, y + 14) === zi) inside++; if (KL.zoneAt(s, x, y - 14) === zi) inside++;
      var dd = Math.hypot(x - cx, y - cy) - inside * 200;
      if (dd < bd) { bd = dd; best = [x, y]; }
    }
    return best || [cx, cy];
  };
  var anchors = {};
  KL.anchor = function (s, zi) { var k = s * 10 + zi; return anchors[k] || (anchors[k] = KL.zoneAnchor(s, zi)); };
  // Sticker position (shoe space) from panel-box u,v.
  KL.stickerXY = function (s, u, v) {
    var b = SIL[s].panelBox;
    return [b[0] + (b[2] - b[0]) * (0.12 + 0.76 * u), b[1] + (b[3] - b[1]) * (0.15 + 0.7 * v)];
  };
  KL.stickerUV = function (s, x, y) {
    var b = SIL[s].panelBox;
    var u = ((x - b[0]) / (b[2] - b[0]) - 0.12) / 0.76, v = ((y - b[1]) / (b[3] - b[1]) - 0.15) / 0.7;
    return [Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v))];
  };
  KL.STK_R = 46;

  // ---------- rendering ----------
  var UNPAINTED = '#FFFDF8';
  function inkOf(i) { return i >= 0 ? KL.INKS[i] : UNPAINTED; }
  function mix(a, b, t) {
    var x = KL.hexRgb(a), y = KL.hexRgb(b);
    return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * t) + ',' + Math.round(x[1] + (y[1] - x[1]) * t) + ',' + Math.round(x[2] + (y[2] - x[2]) * t) + ')';
  }
  KL.mix = mix;
  // Draws a pattern (in the accent ink) over the current clip, inside box bb.
  KL.drawPattern = function (c, pat, base, acc, bb, seed) {
    var x0 = bb[0] - 10, y0 = bb[1] - 10, x1 = bb[2] + 10, y1 = bb[3] + 10, w = x1 - x0, h = y1 - y0, r = KL.rng(seed), i, x, y;
    c.fillStyle = acc;
    if (pat === 1) { // halftone fade, dots grow toward the toe
      var st = 17;
      for (y = y0, i = 0; y <= y1; y += st * 0.87, i++) for (x = x0 + (i % 2) * st / 2; x <= x1; x += st) {
        var t = (x - x0) / w, rad = 9.6 * Math.pow(t, 1.15);
        if (rad > 0.8) { c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill(); }
      }
    } else if (pat === 2) { // speckle
      var n = Math.min(260, Math.round(w * h / 650));
      for (i = 0; i < n; i++) { c.beginPath(); c.arc(x0 + r() * w, y0 + r() * h, 2.5 + r() * 5.5, 0, TAU); c.fill(); }
    } else if (pat === 3) { // diagonal stripes
      c.save(); c.translate((x0 + x1) / 2, (y0 + y1) / 2); c.rotate(-0.5);
      var R = Math.hypot(w, h) / 2 + 20;
      for (x = -R; x < R; x += 34) c.fillRect(x, -R, 15, 2 * R);
      c.restore();
    } else if (pat === 4) { // tiny tilted check, softened
      c.save(); c.translate((x0 + x1) / 2, (y0 + y1) / 2); c.rotate(Math.PI / 4);
      var R2 = Math.hypot(w, h) / 2 + 20, s = 15;
      c.globalAlpha *= 0.85;
      for (y = -R2, i = 0; y < R2; y += s, i++) for (x = -R2 + (i % 2) * s; x < R2; x += 2 * s) { c.fillRect(x + 1.5, y + 1.5, s - 3, s - 3); }
      c.restore();
    } else if (pat === 5) { // camo blobs in two tones
      var m = mix(base, acc, 0.5), nb = Math.max(4, Math.round(w * h / 3800));
      for (var tone = 0; tone < 2; tone++) {
        c.fillStyle = tone ? acc : m;
        for (i = 0; i < nb; i++) {
          var bx = x0 + r() * w, by = y0 + r() * h, br = 18 + r() * 30;
          c.beginPath();
          for (var a = 0; a <= 8; a++) {
            var an = a * TAU / 8, rr = br * (0.7 + r() * 0.5), px = bx + Math.cos(an) * rr * 1.3, py = by + Math.sin(an) * rr;
            if (!a) c.moveTo(px, py); else c.quadraticCurveTo(bx + Math.cos(an - 0.4) * rr * 1.6, by + Math.sin(an - 0.4) * rr * 1.2, px, py);
          }
          c.closePath(); c.fill();
        }
      }
    }
  };
  function fillZone(c, S, zi, col) {
    var z = S.zones[zi];
    for (var i = 0; i < z.parts.length; i++) {
      var q = z.parts[i];
      if (q.clip) { c.save(); c.clip(S.body); c.fillStyle = col; c.fill(q.p); c.restore(); }
      else { c.fillStyle = col; c.fill(q.p); }
    }
  }
  function strokeZone(c, S, zi, lw) {
    var z = S.zones[zi];
    c.lineWidth = lw;
    for (var i = 0; i < z.parts.length; i++) {
      var q = z.parts[i];
      if (q.clip) { c.save(); c.clip(S.body); c.stroke(q.p); c.restore(); } else c.stroke(q.p);
    }
  }
  function paintZone(c, S, d, zi) {
    var q = d.z[zi], base = inkOf(q[0]);
    if (zi === 5 && !S.p.gore) return; // laces are strokes, drawn later
    fillZone(c, S, zi, base);
    if (q[1] > 0 && q[2] >= 0) {
      var z = S.zones[zi];
      for (var i = 0; i < z.parts.length; i++) {
        c.save();
        if (z.parts[i].clip) c.clip(S.body);
        c.clip(z.parts[i].p);
        KL.drawPattern(c, q[1], base, KL.INKS[q[2]], z.bb, zi * 97 + 13);
        c.restore();
      }
    }
  }
  // Draw the whole design in shoe space. o: {reg, focus, noStickers, shade}
  KL.drawShoe = function (c, d, o) {
    o = o || {};
    var S = SIL[d.s], p = S.p, reg = o.reg == null ? 6 : o.reg, i;
    c.save();
    c.lineJoin = 'round'; c.lineCap = 'round';
    // ground shadow (halftone)
    c.save();
    c.beginPath(); c.ellipse((p.hx + p.tx) / 2, p.g + 8, (p.tx - p.hx) * 0.52, 20, 0, 0, TAU);
    c.fillStyle = KL.halftone(c, C.ink, 9, 2.6, 0.5); c.fill();
    c.restore();
    // color layer, shifted (misregistration)
    c.save(); c.translate(reg, reg * 0.6);
    for (i = 0; i < 8; i++) paintZone(c, S, d, i);
    // laces strip base (eyestay) in a darker shade of the upper
    if (!p.gore) {
      var ec = d.z[0][0] >= 0 ? KL.shadeOf(KL.INKS[d.z[0][0]]) : '#EFE6D6';
      c.fillStyle = ec; c.fill(S.zones[5].parts[0].p);
    }
    // riso shading: halftone dots in ink along the lower part of the upper and the sole
    c.save(); c.clip(S.body);
    c.fillStyle = KL.halftone(c, C.ink, 11, 2.4, 0.22);
    c.beginPath(); c.moveTo(p.hx - 40, S.yh - 30); c.quadraticCurveTo((p.hx + p.tx) / 2, S.yh - 10, p.tx + 40, S.yt - 70); c.lineTo(p.tx + 40, 640); c.lineTo(p.hx - 40, 640); c.closePath(); c.fill();
    c.restore();
    c.save(); c.clip(S.zones[7].parts[0].p); c.fillStyle = KL.halftone(c, C.ink, 9, 2.2, 0.28); c.fillRect(0, S.sh + (p.g - S.sh) * 0.45, 1000, 80); c.restore();
    c.restore();
    // ink layer: outlines and seams
    c.strokeStyle = C.ink;
    for (i = 1; i < 5; i++) strokeZone(c, S, i, 5);
    if (p.gore) {
      strokeZone(c, S, 5, 5);
      // elastic ribs
      var gc = d.z[5][0] >= 0 ? KL.hexRgb(KL.INKS[d.z[5][0]]) : [255, 255, 255];
      c.save(); c.clip(S.zones[5].parts[0].p); c.lineWidth = 3; c.strokeStyle = gc[0] * 0.3 + gc[1] * 0.59 + gc[2] * 0.11 < 110 ? 'rgba(255,253,248,0.55)' : 'rgba(38,33,58,0.5)';
      var ribs = [5, 8, 3, 6][d.l];
      for (i = 0; i < ribs; i++) { var gx = p.tgx - 10 + i * (170 / ribs); c.beginPath(); c.moveTo(gx, p.tgy); c.lineTo(gx + 30, p.tgy + 120); c.stroke(); }
      c.restore();
    }
    // stitching
    c.save(); c.setLineDash([9, 9]); c.lineWidth = 2.6; c.strokeStyle = 'rgba(38,33,58,0.7)';
    c.save(); c.clip(S.body); c.clip(S.zones[2].parts[0].p); c.translate(18, 0); c.stroke(S.zones[2].parts[0].p); c.restore();
    var pb = S.panelBox, pcx = (pb[0] + pb[2]) / 2, pcy = (pb[1] + pb[3]) / 2;
    c.save(); c.translate(pcx, pcy); c.scale(0.9, 0.86); c.translate(-pcx, -pcy); c.stroke(S.zones[1].parts[0].p); c.restore();
    c.restore();
    c.lineWidth = 7; c.stroke(S.body);
    c.lineWidth = 6; c.stroke(S.zones[6].parts[0].p); c.stroke(S.zones[7].parts[0].p);
    // midsole seam
    c.save(); c.clip(S.zones[6].parts[0].p); c.lineWidth = 3; c.setLineDash(p.cup ? [8, 8] : []); c.beginPath();
    c.moveTo(p.hx, (S.yh + S.sh) / 2 + 4); c.lineTo(p.tx, (S.yt + S.st) / 2 + 2); c.strokeStyle = 'rgba(38,33,58,0.45)'; c.stroke(); c.restore();
    // laces + eyelets
    if (!p.gore) drawLaces(c, S, d, reg);
    // tab hole
    c.lineWidth = 4; c.beginPath(); c.ellipse(p.bx + 2, p.cy - 30, 8, 13, 0.1, 0, TAU); c.stroke();
    // focus ring
    if (o.focus != null && o.focus >= 0) {
      c.save(); c.setLineDash([14, 10]); c.lineDashOffset = -(o.t || 0) * 40; c.strokeStyle = C.blue; strokeZone(c, S, o.focus, 7); c.restore();
    }
    if (!o.noStickers) for (i = 0; i < d.k.length; i++) {
      var sx = KL.stickerXY(d.s, d.k[i][2], d.k[i][3]);
      KL.drawSticker(c, d.k[i][0], KL.INKS[d.k[i][1]], sx[0], sx[1], KL.STK_R, (i - 1) * 0.18, 0);
    }
    c.restore();
  };
  function drawLaces(c, S, d, reg) {
    var col = inkOf(d.z[5][0]), e = S.eyelets, n = S.n, u = S.u, st = d.l, i, a, b;
    var lw = st === 3 ? 17 : 10;
    function seg(x0, y0, x1, y1) {
      c.lineWidth = lw + 7; c.strokeStyle = C.ink; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      c.lineWidth = lw; c.strokeStyle = col; c.beginPath(); c.moveTo(x0 + reg * 0.3, y0 + reg * 0.2); c.lineTo(x1 + reg * 0.3, y1 + reg * 0.2); c.stroke();
    }
    // eyelets on the strip
    for (i = 0; i < e.length; i++) {
      a = e[i];
      c.fillStyle = C.white; c.strokeStyle = C.ink; c.lineWidth = 3.5;
      KL.circle(c, a[0] + n[0] * 34, a[1] + n[1] * 34, 6.5); c.fill(); c.stroke();
    }
    c.lineCap = 'round';
    for (i = 0; i < e.length; i++) {
      a = e[i];
      var p0 = [a[0] + n[0] * 34, a[1] + n[1] * 34], p1 = [a[0] - n[0] * 6 + u[0] * 8, a[1] - n[1] * 6 + u[1] * 8];
      if (st === 0 || st === 3) seg(p0[0], p0[1], p1[0], p1[1]);
      else if (st === 1 && i + 1 < e.length) {
        b = e[i + 1];
        seg(p0[0], p0[1], b[0] - n[0] * 4, b[1] - n[1] * 4);
        seg(b[0] + n[0] * 34, b[1] + n[1] * 34, a[0] - n[0] * 4, a[1] - n[1] * 4);
      } else if (st === 2) {
        seg(p0[0], p0[1], p1[0], p1[1]);
        if (i + 1 < e.length) { b = e[i + 1]; seg(a[0] - n[0] * 2, a[1] - n[1] * 2, b[0] - n[0] * 2, b[1] - n[1] * 2); }
      }
    }
    // bow at the top
    var t = e[0], bx = t[0] - n[0] * 8, by = t[1] - n[1] * 8;
    seg(bx, by, bx - 46, by - 28); seg(bx, by, bx - 18, by - 56);
    c.fillStyle = col; c.strokeStyle = C.ink; c.lineWidth = 3;
    KL.circle(c, bx - 48, by - 29, lw * 0.55); c.fill(); c.stroke();
    KL.circle(c, bx - 19, by - 58, lw * 0.55); c.fill(); c.stroke();
  }
  // Fits the silhouette into a w x h box: returns {s, ox, oy} so screen = o + shoe * s.
  KL.fitShoe = function (s, w, h, pad) {
    var bb = SIL[s].bb, bw = bb[2] - bb[0], bh = bb[3] - bb[1];
    pad = pad || 0;
    var k = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh);
    return { s: k, ox: (w - bw * k) / 2 - bb[0] * k, oy: (h - bh * k) / 2 - bb[1] * k };
  };
  // Small icon of a silhouette, with optional highlighted zone.
  KL.drawSilIcon = function (c, s, x, y, w, h, fill, zone, zcol) {
    var S = SIL[s], f2 = KL.fitShoe(s, w, h, 0);
    c.save(); c.translate(x - w / 2 + f2.ox, y - h / 2 + f2.oy); c.scale(f2.s, f2.s);
    c.fillStyle = fill || C.white; c.fill(S.body); c.fill(S.zones[6].parts[0].p); c.fill(S.zones[7].parts[0].p);
    if (zone != null && zone >= 0) {
      if (zone === 5 && !S.p.gore) { c.fillStyle = zcol; c.fill(S.zones[5].parts[0].p); }
      else fillZone(c, S, zone, zcol);
    }
    c.strokeStyle = C.ink; c.lineJoin = 'round'; c.lineWidth = Math.max(10, 2.6 / f2.s);
    c.stroke(S.body); c.stroke(S.zones[6].parts[0].p); c.stroke(S.zones[7].parts[0].p);
    if (zone != null && zone >= 0) strokeZone(c, S, zone, Math.max(8, 2 / f2.s));
    c.restore();
  };
})();
