/*
 * art.js: Putt Garden's procedural papercut art. Everything is drawn in code.
 *
 * Holes are drawn through a "view" V = { a, b, c, d, e, f, s, dpr }: the affine map from
 * world units to CSS pixels (V.s is the scale, the view may be rotated by 90 degrees in
 * landscape). Paper shadows are always offset down-right in screen space, so they look
 * the same whichever way the hole is turned.
 */
(function (root) {
  'use strict';

  var PAL = {
    mint: '#DFF3E4', grass: '#6CC46A', fairway: '#8FD873', sand: '#F2D49B', water: '#4FB3E8',
    stone: '#C9C2B6', ink: '#24402E', flag: '#F2545B',
    // derived tints
    grassDark: '#4E9E52', grassDeep: '#3F8746', fairwayLight: '#A6E38B', rough: '#62B65D',
    sandDark: '#D8B272', sandLight: '#FAE6BF', waterDark: '#2E86BE', waterLight: '#A9DEF7',
    stoneDark: '#8F887C', stoneLight: '#EEEAE2', paper: '#FFFDF7', paperDark: '#EFE9DC',
    inkSoft: '#46634F', shadow: 'rgba(36,64,46,0.22)', shadowSoft: 'rgba(36,64,46,0.12)',
    petal: '#F58FB4', petalDark: '#D9668F', pollen: '#FFD66B', wood: '#C98F5A', woodDark: '#9C6A3E',
    sky: '#7C6CF2', gold: '#F2B53D', btn: '#D93F48', btnDown: '#B8333C'
  };
  var TAU = Math.PI * 2;

  function makeCanvas(w, h, dpr) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
    return c;
  }
  function rng(seed) {
    var s = (seed * 2654435761) >>> 0 || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function setW(g, V, dx, dy) { var k = V.dpr; g.setTransform(k * V.a, k * V.b, k * V.c, k * V.d, k * (V.e + (dx || 0)), k * (V.f + (dy || 0))); }
  function setS(g, V) { g.setTransform(V.dpr, 0, 0, V.dpr, 0, 0); }
  function path(g, p, closed) {
    g.beginPath(); g.moveTo(p[0], p[1]);
    for (var i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
    if (closed !== false) g.closePath();
  }
  function rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); }

  // speckled paper fibres, used as a pattern
  var fibre = null;
  function fibrePattern(g) {
    if (!fibre) {
      fibre = document.createElement('canvas'); fibre.width = 160; fibre.height = 160;
      var f = fibre.getContext('2d'), r = rng(7);
      for (var i = 0; i < 260; i++) {
        f.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(36,64,46,0.045)';
        var x = r() * 160, y = r() * 160, l = 1 + r() * 4, a = r() * TAU;
        f.save(); f.translate(x, y); f.rotate(a); f.fillRect(-l / 2, -0.5, l, 1); f.restore();
      }
    }
    return g.createPattern(fibre, 'repeat');
  }
  function paperFill(g, color, x, y, w, h) {
    g.fillStyle = color; g.fillRect(x, y, w, h);
    g.fillStyle = fibrePattern(g); g.fillRect(x, y, w, h);
  }

  // ------------------------------------------------------------------ small props (drawn in their own local space)
  function bush(g, x, y, r, dark, light, sh) {
    var k = r / 10;
    g.fillStyle = PAL.shadow;
    circle(g, x - 4 * k + sh, y + 1 * k + sh * 1.6, 7 * k); g.fill();
    circle(g, x + 4 * k + sh, y + 0 * k + sh * 1.6, 8 * k); g.fill();
    g.fillStyle = dark;
    circle(g, x - 4 * k, y + 1 * k, 7 * k); g.fill();
    circle(g, x + 4 * k, y, 8 * k); g.fill();
    circle(g, x, y - 4 * k, 7 * k); g.fill();
    g.fillStyle = light;
    circle(g, x - 1 * k, y - 6 * k, 3.4 * k); g.fill();
    circle(g, x + 5 * k, y - 3 * k, 2.6 * k); g.fill();
  }
  function flower(g, x, y, r, petal, center) {
    g.fillStyle = petal;
    for (var i = 0; i < 5; i++) {
      var a = i * TAU / 5 - Math.PI / 2;
      circle(g, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.5); g.fill();
    }
    g.fillStyle = center; circle(g, x, y, r * 0.38); g.fill();
  }
  function cactus(g, x, y, r, sh) {
    var w = r * 0.55, h = r * 1.7;
    g.fillStyle = PAL.shadow; rr(g, x - w / 2 + sh, y - h + sh * 1.6, w, h, w / 2); g.fill();
    g.fillStyle = '#4C9E62'; rr(g, x - w / 2, y - h, w, h, w / 2); g.fill();
    rr(g, x - w * 1.5, y - h * 0.62, w * 0.62, h * 0.38, w * 0.3); g.fill();
    rr(g, x + w * 0.85, y - h * 0.8, w * 0.62, h * 0.42, w * 0.3); g.fill();
    rr(g, x - w * 1.5, y - h * 0.3, w * 1.2, w * 0.45, w * 0.22); g.fill();
    rr(g, x + w * 0.3, y - h * 0.45, w * 1.15, w * 0.45, w * 0.22); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)'; rr(g, x - w * 0.18, y - h * 0.92, w * 0.18, h * 0.7, w * 0.1); g.fill();
    g.fillStyle = PAL.flag; circle(g, x, y - h, w * 0.28); g.fill();
  }
  function rock(g, x, y, r, sh) {
    g.fillStyle = PAL.shadow; g.beginPath(); g.ellipse(x + sh, y + sh * 1.6, r, r * 0.7, 0, 0, TAU); g.fill();
    g.fillStyle = PAL.stone; g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, 0, TAU); g.fill();
    g.fillStyle = PAL.stoneLight; g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.22, r * 0.45, r * 0.25, 0, 0, TAU); g.fill();
  }
  function reeds(g, x, y, r) {
    g.strokeStyle = PAL.grassDeep; g.lineWidth = Math.max(1, r * 0.12); g.lineCap = 'round';
    for (var i = -2; i <= 2; i++) {
      g.beginPath(); g.moveTo(x + i * r * 0.18, y); g.quadraticCurveTo(x + i * r * 0.3, y - r * 0.8, x + i * r * 0.45, y - r * 1.3 + Math.abs(i) * r * 0.2); g.stroke();
    }
    g.fillStyle = PAL.woodDark;
    rr(g, x - r * 0.12, y - r * 1.25, r * 0.16, r * 0.45, r * 0.08); g.fill();
    rr(g, x + r * 0.3, y - r * 1.05, r * 0.16, r * 0.4, r * 0.08); g.fill();
  }
  function lily(g, x, y, r) {
    g.fillStyle = '#5DB86A';
    g.beginPath(); g.moveTo(x, y); g.arc(x, y, r, 0.35, TAU - 0.15); g.closePath(); g.fill();
    g.fillStyle = PAL.petal; circle(g, x + r * 0.2, y - r * 0.2, r * 0.32); g.fill();
  }
  function lantern(g, x, y, r, sh) {
    g.fillStyle = PAL.shadow; rr(g, x - r * 0.5 + sh, y - r * 1.4 + sh * 1.6, r, r * 1.4, r * 0.3); g.fill();
    g.fillStyle = PAL.woodDark; g.fillRect(x - r * 0.08, y - r * 0.2, r * 0.16, r * 0.4);
    g.fillStyle = PAL.gold; rr(g, x - r * 0.5, y - r * 1.4, r, r * 1.2, r * 0.35); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.45)'; rr(g, x - r * 0.3, y - r * 1.25, r * 0.22, r * 0.85, r * 0.1); g.fill();
    g.fillStyle = PAL.flag; g.fillRect(x - r * 0.55, y - r * 1.45, r * 1.1, r * 0.16); g.fillRect(x - r * 0.55, y - r * 0.3, r * 1.1, r * 0.16);
  }

  // ------------------------------------------------------------------ star, icons, hand
  function star(g, x, y, r, fill, stroke, lw) {
    g.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.48 : r;
      if (i === 0) g.moveTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); else g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
    }
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 2; g.lineJoin = 'round'; g.stroke(); }
  }
  function icon(g, name, x, y, s, col) {
    g.save();
    g.translate(x, y);
    var k = s / 24;
    g.scale(k, k);
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round';
    switch (name) {
      case 'pause': rr(g, -7, -9, 5, 18, 2); g.fill(); rr(g, 2, -9, 5, 18, 2); g.fill(); break;
      case 'play': g.beginPath(); g.moveTo(-6, -10); g.lineTo(10, 0); g.lineTo(-6, 10); g.closePath(); g.fill(); break;
      case 'restart':
        g.beginPath(); g.arc(0, 0, 8.5, -Math.PI * 0.3, Math.PI * 1.45); g.stroke();
        g.beginPath(); g.moveTo(4, -13); g.lineTo(9.5, -6.5); g.lineTo(1.5, -4.5); g.closePath(); g.fill(); break;
      case 'grid':
        rr(g, -10, -10, 8.5, 8.5, 2.5); g.fill(); rr(g, 1.5, -10, 8.5, 8.5, 2.5); g.fill();
        rr(g, -10, 1.5, 8.5, 8.5, 2.5); g.fill(); rr(g, 1.5, 1.5, 8.5, 8.5, 2.5); g.fill(); break;
      case 'card':
        rr(g, -9, -11, 18, 22, 3); g.stroke();
        g.beginPath(); g.moveTo(-5, -5); g.lineTo(5, -5); g.moveTo(-5, 0); g.lineTo(5, 0); g.moveTo(-5, 5); g.lineTo(1, 5); g.stroke(); break;
      case 'sound': case 'mute':
        g.beginPath(); g.moveTo(-10, -4); g.lineTo(-5, -4); g.lineTo(1, -10); g.lineTo(1, 10); g.lineTo(-5, 4); g.lineTo(-10, 4); g.closePath(); g.fill();
        if (name === 'sound') { g.beginPath(); g.arc(2, 0, 6, -0.9, 0.9); g.stroke(); g.beginPath(); g.arc(2, 0, 10.5, -0.9, 0.9); g.stroke(); }
        else { g.beginPath(); g.moveTo(5, -5); g.lineTo(12, 5); g.moveTo(12, -5); g.lineTo(5, 5); g.stroke(); }
        break;
      case 'left': g.lineWidth = 3.4; g.beginPath(); g.moveTo(4, -9); g.lineTo(-5, 0); g.lineTo(4, 9); g.stroke(); break;
      case 'right': g.lineWidth = 3.4; g.beginPath(); g.moveTo(-4, -9); g.lineTo(5, 0); g.lineTo(-4, 9); g.stroke(); break;
      case 'lock':
        rr(g, -8, -2, 16, 12, 3); g.fill();
        g.lineWidth = 3; g.beginPath(); g.arc(0, -3, 5.5, Math.PI, 0); g.stroke(); break;
      case 'flag':
        g.lineWidth = 2.4; g.beginPath(); g.moveTo(-6, 11); g.lineTo(-6, -11); g.stroke();
        g.beginPath(); g.moveTo(-6, -11); g.lineTo(9, -6); g.lineTo(-6, -1); g.closePath(); g.fill(); break;
      case 'next': g.lineWidth = 3.4; g.beginPath(); g.moveTo(-9, 0); g.lineTo(8, 0); g.moveTo(2, -7); g.lineTo(9, 0); g.lineTo(2, 7); g.stroke(); break;
      case 'home':
        g.beginPath(); g.moveTo(-10, -1); g.lineTo(0, -10); g.lineTo(10, -1); g.stroke();
        rr(g, -7, -2, 14, 12, 2); g.fill(); break;
      case 'star': star(g, 0, 1, 11, col); break;
    }
    g.restore();
  }
  // a papercut pointing hand, fingertip at (x, y); pressed shrinks it a little
  function hand(g, x, y, s, pressed) {
    g.save();
    g.translate(x, y); var k = s / 40 * (pressed ? 0.92 : 1); g.scale(k, k); g.rotate(-0.35);
    g.fillStyle = 'rgba(36,64,46,0.25)';
    rr(g, -5 + 3, -2 + 5, 10, 30, 5); g.fill(); rr(g, -12 + 3, 18 + 5, 26, 26, 9); g.fill();
    g.fillStyle = PAL.paper; g.strokeStyle = PAL.ink; g.lineWidth = 2.4;
    rr(g, -12, 18, 26, 26, 9); g.fill(); g.stroke();
    rr(g, -5, -2, 10, 30, 5); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-3, 26); g.lineTo(-3, 30); g.moveTo(4, 26); g.lineTo(4, 30); g.stroke();
    g.fillStyle = PAL.paper; rr(g, -4, 19, 8, 8, 3); g.fill();
    g.restore();
  }

  // ------------------------------------------------------------------ the hole (static layer)
  // pipe glyphs so pairs can be told apart without colour
  var PIPE_COL = ['#F2545B', '#7C6CF2', '#F2A541'];
  function pipeGlyph(g, i, x, y, r) {
    g.fillStyle = PAL.paper;
    if (i % 3 === 0) { circle(g, x, y, r); g.fill(); }
    else if (i % 3 === 1) { g.beginPath(); g.moveTo(x, y - r * 1.1); g.lineTo(x + r, y + r * 0.8); g.lineTo(x - r, y + r * 0.8); g.closePath(); g.fill(); }
    else { g.fillRect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7); }
  }

  // draws the board, decor and all static hole pieces into g (screen-sized canvas)
  function hole(g, H, V, W, Hh, course, seed, board) {
    var s = V.s, sh = Math.max(2, s * 4), i, j, a, p;
    var C = root.PuttPhysics.C;
    setS(g, V);
    paperFill(g, PAL.mint, 0, 0, W, Hh);
    // grass board (a paper tray)
    var bx = board.x, by = board.y, bw = board.w, bh = board.h, br = Math.min(28, bw * 0.06);
    g.fillStyle = PAL.shadow; rr(g, bx + 3, by + 6, bw, bh, br); g.fill();
    g.fillStyle = course === 1 ? '#7DC46A' : course === 2 ? '#64BE73' : PAL.grass;
    rr(g, bx, by, bw, bh, br); g.fill();
    g.save(); rr(g, bx, by, bw, bh, br); g.clip();
    g.fillStyle = fibrePattern(g); g.fillRect(bx, by, bw, bh);
    // grass tufts and decor in screen space, kept clear of the fairway
    var r = rng(seed * 31 + 7);
    var inv = V.inv;
    function clearOf(px, py, m) {
      var wx = inv.a * px + inv.c * py + inv.e, wy = inv.b * px + inv.d * py + inv.f;
      if (root.PuttPhysics.inPoly(H.out, wx, wy)) return false;
      var o = H.out, mm = m / s + 6;
      for (var k = 0; k < o.length; k += 2) {
        var k2 = (k + 2) % o.length, ax = o[k], ay = o[k + 1], dx = o[k2] - ax, dy = o[k2 + 1] - ay, l2 = dx * dx + dy * dy;
        var t = l2 ? ((wx - ax) * dx + (wy - ay) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        var ex = ax + dx * t - wx, ey = ay + dy * t - wy;
        if (ex * ex + ey * ey < mm * mm) return false;
      }
      return true;
    }
    g.strokeStyle = 'rgba(36,64,46,0.16)'; g.lineWidth = 1.4; g.lineCap = 'round';
    var n = Math.floor(bw * bh / 900);
    for (i = 0; i < n; i++) {
      var tx = bx + r() * bw, ty = by + r() * bh, tl = 3 + r() * 3;
      g.beginPath(); g.moveTo(tx - 2, ty - tl * 0.8); g.lineTo(tx, ty); g.lineTo(tx + 2, ty - tl); g.stroke();
    }
    var props = [], tries = Math.floor(bw * bh / 2600);
    var sz = Math.max(9, Math.min(22, s * 20));
    for (i = 0; i < tries; i++) {
      var x = bx + 10 + r() * (bw - 20), y = by + 14 + r() * (bh - 20), kind = r(), size = sz * (0.7 + r() * 0.6);
      if (!clearOf(x, y, size * 1.3)) continue;
      var bad = false;
      for (j = 0; j < props.length; j++) { var q = props[j]; if (Math.abs(q[0] - x) < (q[2] + size) * 0.9 && Math.abs(q[1] - y) < (q[2] + size) * 0.9) { bad = true; break; } }
      if (bad) continue;
      props.push([x, y, size, kind]);
    }
    props.sort(function (u, v) { return u[1] - v[1]; });
    for (i = 0; i < props.length; i++) {
      p = props[i];
      var kd = p[3];
      if (course === 0) {
        if (kd < 0.45) bush(g, p[0], p[1], p[2], PAL.grassDark, '#7FCB6F', 2);
        else if (kd < 0.8) { flower(g, p[0], p[1], p[2] * 0.35, kd < 0.6 ? PAL.paper : PAL.petal, PAL.pollen); flower(g, p[0] + p[2] * 0.6, p[1] + p[2] * 0.4, p[2] * 0.28, PAL.pollen, '#F29F3D'); }
        else bush(g, p[0], p[1], p[2] * 1.2, PAL.grassDeep, PAL.grassDark, 2);
      } else if (course === 1) {
        if (kd < 0.4) cactus(g, p[0], p[1] + p[2] * 0.6, p[2], 2);
        else if (kd < 0.75) rock(g, p[0], p[1], p[2] * 0.6, 2);
        else flower(g, p[0], p[1], p[2] * 0.36, PAL.gold, PAL.flag);
      } else {
        if (kd < 0.35) reeds(g, p[0], p[1] + p[2] * 0.5, p[2]);
        else if (kd < 0.6) lantern(g, p[0], p[1] + p[2] * 0.5, p[2] * 0.55, 2);
        else if (kd < 0.8) bush(g, p[0], p[1], p[2], PAL.grassDark, '#86D07A', 2);
        else flower(g, p[0], p[1], p[2] * 0.36, PAL.paper, PAL.pollen);
      }
    }
    g.restore();

    // fairway: a raised paper layer with mowing stripes
    setW(g, V, 3, 6); g.fillStyle = PAL.shadow; path(g, H.out); g.fill();
    setW(g, V); g.fillStyle = PAL.fairway; path(g, H.out); g.fill();
    g.save(); path(g, H.out); g.clip();
    var bb = root.PuttPhysics.polyBox(H.out);
    g.fillStyle = 'rgba(255,255,255,0.07)';
    for (var yy = Math.floor(bb[1] / 80) * 80; yy < bb[3]; yy += 80) g.fillRect(bb[0] - 10, yy, bb[2] - bb[0] + 20, 40);
    setS(g, V); g.fillStyle = fibrePattern(g); g.fillRect(0, 0, W, Hh); setW(g, V);
    // slopes: soft shading from uphill (light) to downhill (dark)
    (H.slopes || []).forEach(function (sl) {
      var b = root.PuttPhysics.polyBox(sl[0]), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      var m = Math.sqrt(sl[1] * sl[1] + sl[2] * sl[2]) || 1, ux = sl[1] / m, uy = sl[2] / m;
      var ext = Math.abs(ux) * (b[2] - b[0]) / 2 + Math.abs(uy) * (b[3] - b[1]) / 2;
      var gr = g.createLinearGradient(cx - ux * ext, cy - uy * ext, cx + ux * ext, cy + uy * ext);
      gr.addColorStop(0, 'rgba(255,255,240,0.22)'); gr.addColorStop(1, 'rgba(36,64,46,0.16)');
      g.fillStyle = gr; path(g, sl[0]); g.fill();
      g.setLineDash([6, 6]); g.strokeStyle = 'rgba(36,64,46,0.18)'; g.lineWidth = 1.5 / s * 1.2; path(g, sl[0]); g.stroke(); g.setLineDash([]);
    });
    // rough: a darker cut-paper layer with tufts
    (H.rough || []).forEach(function (pp, k) {
      setW(g, V, 1.5, 3); g.fillStyle = PAL.shadowSoft; path(g, pp); g.fill();
      setW(g, V); g.fillStyle = PAL.rough; path(g, pp); g.fill();
      g.save(); path(g, pp); g.clip();
      var b = root.PuttPhysics.polyBox(pp), rr3 = rng(seed + 50 + k);
      g.strokeStyle = 'rgba(36,64,46,0.32)'; g.lineWidth = 1.6; g.lineCap = 'round';
      for (var u = 0; u < (b[2] - b[0]) * (b[3] - b[1]) / 160; u++) {
        var x0 = b[0] + rr3() * (b[2] - b[0]), y0 = b[1] + rr3() * (b[3] - b[1]);
        g.beginPath(); g.moveTo(x0 - 3, y0 - 5); g.lineTo(x0, y0); g.lineTo(x0 + 2, y0 - 6); g.stroke();
      }
      g.restore();
    });
    // sand and water: recessed cut-outs (dark rim on the upper-left inside edge)
    function recess(pp, dark, fill, inner) {
      setW(g, V); g.fillStyle = dark; path(g, pp); g.fill();
      g.save(); path(g, pp); g.clip();
      setW(g, V, 2.5, 4); g.fillStyle = fill; path(g, pp); g.fill();
      if (inner) inner(pp);
      g.restore();
      setW(g, V); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.4 / s; path(g, pp); g.stroke();
    }
    (H.sand || []).forEach(function (pp, k) {
      recess(pp, PAL.sandDark, PAL.sand, function () {
        var b = root.PuttPhysics.polyBox(pp), rr3 = rng(seed + 90 + k);
        g.fillStyle = 'rgba(160,110,50,0.28)';
        for (var u = 0; u < (b[2] - b[0]) * (b[3] - b[1]) / 70; u++) { circle(g, b[0] + rr3() * (b[2] - b[0]), b[1] + rr3() * (b[3] - b[1]), 1.1); g.fill(); }
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.6;
        for (var v = b[1] + 14; v < b[3]; v += 22) { g.beginPath(); g.moveTo(b[0], v); g.bezierCurveTo(b[0] + (b[2] - b[0]) * 0.3, v - 6, b[0] + (b[2] - b[0]) * 0.6, v + 6, b[2], v); g.stroke(); }
      });
    });
    (H.water || []).forEach(function (pp) { recess(pp, PAL.waterDark, PAL.water); });
    g.restore();

    // tee mat
    setW(g, V);
    var tx0 = H.tee[0], ty0 = H.tee[1];
    g.fillStyle = 'rgba(36,64,46,0.14)'; rr(g, tx0 - 26, ty0 - 20, 52, 40, 10); g.fill();
    g.fillStyle = PAL.paper; circle(g, tx0 - 19, ty0, 3.2); g.fill(); circle(g, tx0 + 19, ty0, 3.2); g.fill();

    // slider tracks
    (H.sliders || []).forEach(function (sd) {
      g.fillStyle = 'rgba(36,64,46,0.12)';
      rr(g, sd[0] + Math.min(0, sd[4]) + 6, sd[1] + Math.min(0, sd[5]) + sd[3] / 2 - 4, sd[2] + Math.abs(sd[4]) - 12, 8 + Math.abs(sd[5]), 4); g.fill();
    });
    // cup
    var cx0 = H.cup[0], cy0 = H.cup[1], CR = C.CUP_R;
    g.fillStyle = PAL.fairwayLight; circle(g, cx0, cy0, CR + 7); g.fill();
    g.fillStyle = '#16281C'; circle(g, cx0, cy0, CR); g.fill();
    g.save(); circle(g, cx0, cy0, CR); g.clip();
    setW(g, V, 3, 4); g.fillStyle = '#2C4A35'; circle(g, cx0, cy0, CR); g.fill();
    g.restore();
    setW(g, V); g.strokeStyle = PAL.paper; g.lineWidth = 1.5 / s * 1.4; circle(g, cx0, cy0, CR); g.stroke();
    // pipes: a coloured pipe mouth (entry, dark) and outlet (exit, with arrows), matched by colour and glyph
    (H.pipes || []).forEach(function (pp, k) {
      var col = PIPE_COL[k % 3];
      setW(g, V, 2, 3.5); g.fillStyle = PAL.shadow; circle(g, pp[0], pp[1], 21); g.fill(); circle(g, pp[2], pp[3], 21); g.fill();
      setW(g, V);
      [[pp[0], pp[1], '#10201A'], [pp[2], pp[3], '#3C5E46']].forEach(function (m) {
        g.fillStyle = col; circle(g, m[0], m[1], 21); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.3)'; circle(g, m[0] - 3, m[1] - 4, 17); g.fill();
        g.fillStyle = col; circle(g, m[0], m[1], 16.5); g.fill();
        g.fillStyle = m[2]; circle(g, m[0], m[1], 12.5); g.fill();
        g.strokeStyle = 'rgba(36,64,46,0.35)'; g.lineWidth = 1.2; circle(g, m[0], m[1], 21); g.stroke();
      });
      pipeGlyph(g, k, pp[0], pp[1], 4.5);
      pipeGlyph(g, k, pp[2], pp[3], 4.5);
      var an = pp[4] * Math.PI / 180, ux = Math.cos(an), uy = Math.sin(an);
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (var q2 = 0; q2 < 3; q2++) {
        var d0 = 30 + q2 * 12;
        g.strokeStyle = PAL.paper; g.lineWidth = 6.5;
        for (var pass = 0; pass < 2; pass++) {
          g.beginPath();
          g.moveTo(pp[2] + ux * (d0 - 6) - uy * 8, pp[3] + uy * (d0 - 6) + ux * 8);
          g.lineTo(pp[2] + ux * d0, pp[3] + uy * d0);
          g.lineTo(pp[2] + ux * (d0 - 6) + uy * 8, pp[3] + uy * (d0 - 6) - ux * 8);
          g.stroke();
          g.strokeStyle = col; g.lineWidth = 3.5;
        }
      }
    });

    // walls: raised stone strips (shadow, body, highlight)
    var wt = C.WALL_T * 2 + 2;
    function strips(list, closedFlags) {
      g.lineJoin = 'round'; g.lineCap = 'round';
      setW(g, V, 2.5, 4.5); g.strokeStyle = PAL.shadow; g.lineWidth = wt;
      list.forEach(function (pp, k) { path(g, pp, closedFlags[k]); g.stroke(); });
      setW(g, V); g.strokeStyle = PAL.stoneDark; g.lineWidth = wt;
      list.forEach(function (pp, k) { path(g, pp, closedFlags[k]); g.stroke(); });
      setW(g, V, -0.6, -1.2); g.strokeStyle = PAL.stone; g.lineWidth = wt - 2.5;
      list.forEach(function (pp, k) { path(g, pp, closedFlags[k]); g.stroke(); });
      setW(g, V, -1, -1.8); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2 / s * 1.3;
      list.forEach(function (pp, k) { path(g, pp, closedFlags[k]); g.stroke(); });
    }
    (H.blocks || []).forEach(function (pp) {
      setW(g, V, 3, 6); g.fillStyle = PAL.shadow; path(g, pp); g.fill();
      setW(g, V); g.fillStyle = course === 0 ? PAL.grassDark : PAL.stone; path(g, pp); g.fill();
      if (course === 0) {
        g.save(); path(g, pp); g.clip();
        var b = root.PuttPhysics.polyBox(pp), rr4 = rng(seed + 300);
        g.fillStyle = '#5CB062';
        for (var u = 0; u < (b[2] - b[0]) * (b[3] - b[1]) / 260; u++) { circle(g, b[0] + rr4() * (b[2] - b[0]), b[1] + rr4() * (b[3] - b[1]), 6 + rr4() * 6); g.fill(); }
        g.fillStyle = PAL.petal;
        for (u = 0; u < (b[2] - b[0]) * (b[3] - b[1]) / 1400; u++) { circle(g, b[0] + rr4() * (b[2] - b[0]), b[1] + rr4() * (b[3] - b[1]), 2.4); g.fill(); }
        g.restore();
      } else {
        g.save(); path(g, pp); g.clip();
        setW(g, V, -3, -5); g.fillStyle = PAL.stoneLight; path(g, pp); g.fill();
        setW(g, V, -1.5, -2.5); g.fillStyle = PAL.stone; path(g, pp); g.fill();
        g.restore();
      }
    });
    var list = [H.out], flags = [true];
    (H.blocks || []).forEach(function (pp) { list.push(pp); flags.push(true); });
    (H.rails || []).forEach(function (pp) { list.push(pp); flags.push(false); });
    strips(list, flags);
    // posts: round stones
    (H.posts || []).forEach(function (c) {
      setW(g, V, 2.5, 4.5); g.fillStyle = PAL.shadow; circle(g, c[0], c[1], c[2]); g.fill();
      setW(g, V); g.fillStyle = PAL.stoneDark; circle(g, c[0], c[1], c[2]); g.fill();
      setW(g, V, -0.8, -1.4); g.fillStyle = PAL.stone; circle(g, c[0], c[1], c[2] - 1.5); g.fill();
      setW(g, V); g.fillStyle = 'rgba(255,255,255,0.6)'; circle(g, c[0] - c[2] * 0.3, c[1] - c[2] * 0.3, c[2] * 0.28); g.fill();
    });
    // gate posts
    (H.gates || []).forEach(function (gt) {
      setW(g, V, 2, 3.5); g.fillStyle = PAL.shadow; circle(g, gt[0], gt[1], 7); g.fill(); circle(g, gt[2], gt[3], 7); g.fill();
      setW(g, V); g.fillStyle = PAL.woodDark; circle(g, gt[0], gt[1], 7); g.fill(); circle(g, gt[2], gt[3], 7); g.fill();
    });
    setS(g, V);
  }

  // ------------------------------------------------------------------ dynamic hole pieces (called every frame)
  function waterWaves(g, V, zones, t) {
    setW(g, V);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.lineCap = 'round';
    for (var i = 0; i < zones.length; i++) {
      var z = zones[i];
      g.save(); path(g, z.p); g.clip();
      for (var y = z.y0 + 16; y < z.y1; y += 30) {
        var row = Math.round(y / 30);
        for (var x = z.x0 + ((row % 2) * 28) - 40; x < z.x1; x += 56) {
          var off = Math.sin(t * 1.3 + row * 1.7 + x * 0.05) * 6;
          g.beginPath(); g.moveTo(x + off, y); g.quadraticCurveTo(x + off + 8, y - 5, x + off + 16, y); g.stroke();
        }
      }
      g.restore();
    }
  }
  function slopeArrows(g, V, arrows, t) {
    setW(g, V);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (var i = 0; i < arrows.length; i++) {
      var A = arrows[i], ph = (t * 0.5 + A.ph) % 1;
      var x = A.x + A.ux * (ph - 0.5) * 26, y = A.y + A.uy * (ph - 0.5) * 26;
      var al = Math.sin(ph * Math.PI) * 0.55;
      g.strokeStyle = 'rgba(255,255,255,' + al.toFixed(3) + ')'; g.lineWidth = 3.4;
      var px = -A.uy, py = A.ux;
      g.beginPath(); g.moveTo(x - A.ux * 6 + px * 8, y - A.uy * 6 + py * 8); g.lineTo(x + A.ux * 4, y + A.uy * 4); g.lineTo(x - A.ux * 6 - px * 8, y - A.uy * 6 - py * 8); g.stroke();
    }
  }
  function blade(g, V, b, arms, len) {
    var C = root.PuttPhysics.C, i, a, k;
    for (k = 0; k < 2; k++) {
      if (k === 0) { setW(g, V, 3, 5); g.fillStyle = PAL.shadow; } else setW(g, V);
      for (i = 0; i < arms; i++) {
        a = b.ang + i * TAU / arms;
        g.save(); g.translate(b.cx, b.cy); g.rotate(a);
        if (k === 1) g.fillStyle = PAL.wood;
        rr(g, 0, -C.BLADE_T - 1.5, len + C.BLADE_T, (C.BLADE_T + 1.5) * 2, C.BLADE_T); g.fill();
        if (k === 1) { g.fillStyle = PAL.paper; rr(g, len * 0.35, -C.BLADE_T + 1, len * 0.55, C.BLADE_T * 2 - 2, 2); g.fill(); g.fillStyle = PAL.flag; g.fillRect(len * 0.5, -C.BLADE_T + 1, len * 0.12, C.BLADE_T * 2 - 2); }
        g.restore();
      }
      circle(g, b.cx, b.cy, C.HUB_R + 1); g.fillStyle = k ? PAL.woodDark : PAL.shadow; g.fill();
    }
    g.fillStyle = PAL.flag; circle(g, b.cx, b.cy, C.HUB_R * 0.55); g.fill();
  }
  function slider(g, V, sd) {
    setW(g, V, 3, 5); g.fillStyle = PAL.shadow; rr(g, sd.x, sd.y, sd.w, sd.h, 6); g.fill();
    setW(g, V); g.fillStyle = PAL.stoneDark; rr(g, sd.x, sd.y, sd.w, sd.h, 6); g.fill();
    setW(g, V, -1, -2); g.fillStyle = PAL.stone; rr(g, sd.x + 1, sd.y + 1, sd.w - 2, sd.h - 2, 5); g.fill();
    setW(g, V); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(sd.x + 8, sd.y + 6); g.lineTo(sd.x + sd.w - 8, sd.y + 6); g.stroke();
    g.strokeStyle = 'rgba(36,64,46,0.25)';
    for (var x = sd.x + 14; x < sd.x + sd.w - 8; x += 18) { g.beginPath(); g.moveTo(x, sd.y + sd.h * 0.45); g.lineTo(x + 6, sd.y + sd.h * 0.7); g.stroke(); }
  }
  function bumper(g, V, c, pulse) {
    var r = c[2] * (1 + pulse * 0.18), x = c[0], y = c[1];
    setW(g, V, 2.5, 4.5); g.fillStyle = PAL.shadow; circle(g, x, y, r); g.fill();
    setW(g, V);
    g.fillStyle = PAL.petalDark; circle(g, x, y, r); g.fill();
    g.fillStyle = PAL.petal;
    for (var i = 0; i < 6; i++) { var a = i * TAU / 6; circle(g, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.45); g.fill(); }
    g.fillStyle = PAL.pollen; circle(g, x, y, r * 0.38); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; circle(g, x - r * 0.12, y - r * 0.12, r * 0.12); g.fill();
  }
  function gate(g, V, gt, flash) {
    var dx = gt.bx - gt.ax, dy = gt.by - gt.ay, l = Math.sqrt(dx * dx + dy * dy);
    setW(g, V, 2, 3.5); g.strokeStyle = PAL.shadow; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(gt.ax, gt.ay); g.lineTo(gt.bx, gt.by); g.stroke();
    setW(g, V);
    g.strokeStyle = flash > 0 ? PAL.flag : PAL.wood; g.lineWidth = 6;
    g.beginPath(); g.moveTo(gt.ax, gt.ay); g.lineTo(gt.bx, gt.by); g.stroke();
    g.strokeStyle = PAL.paper; g.lineWidth = 2; g.setLineDash([6, 8]);
    g.beginPath(); g.moveTo(gt.ax, gt.ay); g.lineTo(gt.bx, gt.by); g.stroke(); g.setLineDash([]);
    // chevrons in the direction the ball may pass
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3.2; g.lineJoin = 'round';
    var n = Math.max(1, Math.floor(l / 45));
    for (var i = 0; i < n; i++) {
      var t = (i + 0.5) / n, mx = gt.ax + dx * t + gt.nx * 12, my = gt.ay + dy * t + gt.ny * 12, ux = dx / l, uy = dy / l;
      g.beginPath(); g.moveTo(mx - ux * 7 - gt.nx * 5, my - uy * 7 - gt.ny * 5); g.lineTo(mx + gt.nx * 3, my + gt.ny * 3); g.lineTo(mx + ux * 7 - gt.nx * 5, my + uy * 7 - gt.ny * 5); g.stroke();
    }
    g.fillStyle = PAL.woodDark; circle(g, gt.ax, gt.ay, 7); g.fill(); circle(g, gt.bx, gt.by, 7); g.fill();
  }
  // flag on its pole, drawn upright in screen space at (x, y) = cup centre (CSS px); h = pole height
  function flagPole(g, x, y, h, t, lift) {
    var top = y - h - lift;
    g.strokeStyle = 'rgba(36,64,46,0.25)'; g.lineWidth = Math.max(2, h * 0.06); g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + 1, y); g.lineTo(x + h * 0.35, y + h * 0.18); g.stroke();
    g.strokeStyle = PAL.paper; g.lineWidth = Math.max(2, h * 0.055);
    g.beginPath(); g.moveTo(x, y - lift); g.lineTo(x, top); g.stroke();
    var fw = h * 0.62, fh = h * 0.38, wv = Math.sin(t * 3.1) * fh * 0.12, wv2 = Math.sin(t * 3.1 + 1.6) * fh * 0.16;
    g.fillStyle = 'rgba(36,64,46,0.2)';
    g.beginPath(); g.moveTo(x + 2, top + 3); g.quadraticCurveTo(x + fw * 0.5 + 2, top + wv + 3, x + fw + 2, top + fh * 0.5 + wv2 + 3);
    g.quadraticCurveTo(x + fw * 0.5 + 2, top + fh + wv + 3, x + 2, top + fh + 3); g.closePath(); g.fill();
    g.fillStyle = PAL.flag;
    g.beginPath(); g.moveTo(x, top); g.quadraticCurveTo(x + fw * 0.5, top + wv, x + fw, top + fh * 0.5 + wv2);
    g.quadraticCurveTo(x + fw * 0.5, top + fh + wv, x, top + fh); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.beginPath(); g.moveTo(x, top); g.quadraticCurveTo(x + fw * 0.5, top + wv, x + fw, top + fh * 0.5 + wv2); g.lineTo(x, top + fh * 0.4); g.closePath(); g.fill();
    g.fillStyle = PAL.gold; circle(g, x, top - 1, Math.max(2, h * 0.06)); g.fill();
  }
  // golf ball in screen space
  function ball(g, x, y, r, alpha) {
    g.globalAlpha = alpha;
    g.fillStyle = PAL.shadow; circle(g, x + r * 0.35, y + r * 0.6, r); g.fill();
    g.fillStyle = '#FFFFFF'; circle(g, x, y, r); g.fill();
    g.fillStyle = 'rgba(36,64,46,0.12)';
    g.beginPath(); g.arc(x, y, r, 0.2, Math.PI * 0.95); g.arc(x - r * 0.15, y - r * 0.25, r * 0.9, Math.PI * 0.95, 0.2, true); g.fill();
    g.strokeStyle = 'rgba(36,64,46,0.55)'; g.lineWidth = Math.max(1, r * 0.14); circle(g, x, y, r); g.stroke();
    g.globalAlpha = 1;
  }

  root.PuttArt = {
    PAL: PAL, makeCanvas: makeCanvas, rng: rng, setW: setW, setS: setS, path: path, rr: rr, circle: circle,
    paperFill: paperFill, fibrePattern: fibrePattern, bush: bush, flower: flower, cactus: cactus, rock: rock, reeds: reeds, lily: lily, lantern: lantern,
    star: star, icon: icon, hand: hand, hole: hole, waterWaves: waterWaves, slopeArrows: slopeArrows, blade: blade, slider: slider,
    bumper: bumper, gate: gate, flagPole: flagPole, ball: ball, PIPE_COL: PIPE_COL
  };
})(this);
