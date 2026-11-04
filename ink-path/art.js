/*
 * art.js: Ink Path's procedural sumi-e art. Everything is drawn in code:
 * rice paper, brush strokes, the calligraphy title, lacquered marbles, ceramic cups,
 * stones, mist, bamboo springs, paper screens, lanterns, seals, icons and the tutorial hand.
 */
(function (root) {
  'use strict';
  var PAL = {
    paper: '#F3EBDD', paperLight: '#F8F2E7', paperDark: '#E4D7C1', mount: '#DCCDB3',
    ink: '#2B2622', inkSoft: '#5E554D', inkFaint: 'rgba(43,38,34,0.35)',
    vermilion: '#D9452B', vermDark: '#A8321E', gold: '#C9A24A', goldLight: '#E2C77E',
    indigo: '#5B6B85', moss: '#7A8B5A', mossDark: '#556339', stone: '#8C8478',
    celadon: '#A3BBA8', celadonDark: '#6F8C78', wood: '#6B4E31', shoji: '#FBF7EC'
  };
  var TAU = Math.PI * 2;

  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function makeCanvas(w, h, dpr) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
    return c;
  }

  // ------------------------------------------------------------------ paper
  // Rice paper: warm base, soft mottling, short fibres, a few long fibres and a gentle vignette.
  function paper(w, h, dpr, seed, base, opt) {
    opt = opt || {};
    var c = makeCanvas(w, h, dpr), g = c.getContext('2d'), r = rng(seed || 7);
    g.scale(dpr, dpr);
    g.fillStyle = base || PAL.paper; g.fillRect(0, 0, w, h);
    var i, n = Math.min(260, Math.floor(w * h / 3500));
    for (i = 0; i < n; i++) {
      var x = r() * w, y = r() * h, rad = 20 + r() * 90;
      var gr = g.createRadialGradient(x, y, 0, x, y, rad);
      var dark = r() < 0.5;
      gr.addColorStop(0, dark ? 'rgba(150,120,80,0.035)' : 'rgba(255,255,250,0.05)');
      gr.addColorStop(1, 'rgba(150,120,80,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.lineCap = 'round';
    n = Math.min(2600, Math.floor(w * h / 260));
    for (i = 0; i < n; i++) {
      var fx = r() * w, fy = r() * h, a = r() * TAU, l = 3 + r() * 10;
      g.strokeStyle = r() < 0.6 ? 'rgba(120,95,60,' + (0.05 + r() * 0.08).toFixed(3) + ')' : 'rgba(255,255,255,' + (0.18 + r() * 0.2).toFixed(3) + ')';
      g.lineWidth = 0.4 + r() * 0.5;
      g.beginPath(); g.moveTo(fx, fy);
      g.quadraticCurveTo(fx + Math.cos(a + 0.5) * l * 0.5, fy + Math.sin(a + 0.5) * l * 0.5, fx + Math.cos(a) * l, fy + Math.sin(a) * l);
      g.stroke();
    }
    n = Math.min(120, Math.floor(w * h / 9000));
    for (i = 0; i < n; i++) {
      var lx = r() * w, ly = r() * h, la = r() * TAU, ll = 25 + r() * 60;
      g.strokeStyle = 'rgba(110,85,55,0.07)'; g.lineWidth = 0.5;
      g.beginPath(); g.moveTo(lx, ly);
      g.bezierCurveTo(lx + Math.cos(la) * ll * 0.3 + (r() - 0.5) * 12, ly + Math.sin(la) * ll * 0.3 + (r() - 0.5) * 12,
        lx + Math.cos(la) * ll * 0.7 + (r() - 0.5) * 12, ly + Math.sin(la) * ll * 0.7 + (r() - 0.5) * 12,
        lx + Math.cos(la) * ll, ly + Math.sin(la) * ll);
      g.stroke();
    }
    if (opt.vignette !== false) {
      var vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(120,90,50,0)');
      vg.addColorStop(1, 'rgba(120,90,50,0.13)');
      g.fillStyle = vg; g.fillRect(0, 0, w, h);
    }
    return c;
  }

  // Far mountains in ink wash (for the backdrop).
  function mountains(g, w, h, seed, alpha) {
    var r = rng(seed || 3);
    for (var layer = 0; layer < 3; layer++) {
      var base = h * (0.72 + layer * 0.1), amp = h * (0.16 - layer * 0.04), a = (0.07 + layer * 0.05) * (alpha || 1);
      var gr = g.createLinearGradient(0, base - amp, 0, h);
      gr.addColorStop(0, 'rgba(70,72,82,' + a.toFixed(3) + ')');
      gr.addColorStop(0.55, 'rgba(70,72,82,' + (a * 0.45).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(70,72,82,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(0, h);
      var x = 0, y = base - r() * amp;
      g.lineTo(0, y);
      while (x < w) {
        var nx = x + w * (0.08 + r() * 0.12);
        var ny = base - r() * amp;
        g.quadraticCurveTo((x + nx) / 2, Math.min(y, ny) - amp * (0.3 + r() * 0.6), nx, ny);
        x = nx; y = ny;
      }
      g.lineTo(w, h); g.closePath(); g.fill();
    }
  }

  // ------------------------------------------------------------------ brush
  var MAXP = 1024;
  var BL = new Float32Array(MAXP * 2), BR = new Float32Array(MAXP * 2), NX = new Float32Array(MAXP), NY = new Float32Array(MAXP), CL = new Float32Array(MAXP), HH = new Float32Array(MAXP);

  // Rounded corner at vertex i (coming from vertex a, going to b): the outline stays on the
  // straight segments (as the physics sees them) and only the last few px round the joint.
  function corner(g, Q, i, a, b) {
    var x = Q[i * 2], y = Q[i * 2 + 1];
    var ax = Q[a * 2] - x, ay = Q[a * 2 + 1] - y, bx = Q[b * 2] - x, by = Q[b * 2 + 1] - y;
    var la = Math.sqrt(ax * ax + ay * ay) || 1, lb = Math.sqrt(bx * bx + by * by) || 1;
    var fa = Math.min(0.5, 5 / la), fb = Math.min(0.5, 5 / lb);
    g.lineTo(x + ax * fa, y + ay * fa);
    g.quadraticCurveTo(x, y, x + bx * fb, y + by * fb);
  }

  // Brush stroke through n points (flat P, screen px) with full widths Wd (px, or one number).
  // opt: color 'r,g,b', alpha, wet 0..1, tin/tout taper lengths px, dry (dry-brush streaks), progress 0..1
  function brush(g, P, Wd, n, opt) {
    if (n > MAXP) n = MAXP;
    if (n < 1) return;
    var col = opt.color || '43,38,34', alpha = opt.alpha === undefined ? 1 : opt.alpha, wet = opt.wet || 0;
    var i, total = 0;
    CL[0] = 0;
    for (i = 1; i < n; i++) {
      var ddx = P[i * 2] - P[i * 2 - 2], ddy = P[i * 2 + 1] - P[i * 2 - 1];
      total += Math.sqrt(ddx * ddx + ddy * ddy); CL[i] = total;
    }
    var prog = opt.progress === undefined ? 1 : opt.progress;
    var lim = total * prog, m = n;
    if (prog < 1) { for (i = 1; i < n; i++) if (CL[i] > lim) { m = i + 1; break; } }
    if (m < 2) {
      var w0 = typeof Wd === 'number' ? Wd : Wd[0];
      g.fillStyle = 'rgba(' + col + ',' + alpha + ')';
      g.beginPath(); g.arc(P[0], P[1], w0 * 0.4, 0, TAU); g.fill();
      return;
    }
    var tin = opt.tin || 6, tout = opt.tout || 14, endL = Math.min(lim, total);
    for (i = 0; i < m; i++) {
      var i0 = i > 0 ? i - 1 : 0, i1 = i < m - 1 ? i + 1 : m - 1;
      var x = P[i * 2], y = P[i * 2 + 1];
      if (i === m - 1 && prog < 1 && CL[i] > lim) {
        var f0 = (lim - CL[i - 1]) / Math.max(1e-6, CL[i] - CL[i - 1]);
        x = P[i * 2 - 2] + (P[i * 2] - P[i * 2 - 2]) * f0; y = P[i * 2 - 1] + (P[i * 2 + 1] - P[i * 2 - 1]) * f0;
      }
      var tx = P[i1 * 2] - P[i0 * 2], ty = P[i1 * 2 + 1] - P[i0 * 2 + 1], tl = Math.sqrt(tx * tx + ty * ty) || 1;
      NX[i] = -ty / tl; NY[i] = tx / tl;
      var s = CL[i] < lim ? CL[i] : lim, e = endL - s, f = 1;
      if (s < tin) f *= 0.55 + 0.45 * s / tin;
      if (e < tout) f *= 0.28 + 0.72 * e / tout;
      if (opt.wobble) f *= 1 + opt.wobble * Math.sin(CL[i] * 0.035 + opt.seed) * Math.sin(CL[i] * 0.011 + opt.seed * 2.3);
      var h = (typeof Wd === 'number' ? Wd : Wd[i]) * f * 0.5;
      HH[i] = h;
      BL[i * 2] = x + NX[i] * h; BL[i * 2 + 1] = y + NY[i] * h;
      BR[i * 2] = x - NX[i] * h; BR[i * 2 + 1] = y - NY[i] * h;
    }
    g.beginPath();
    g.moveTo(BL[0], BL[1]);
    for (i = 1; i < m - 1; i++) corner(g, BL, i, i - 1, i + 1);
    g.lineTo(BL[m * 2 - 2], BL[m * 2 - 1]);
    var ex = (BL[m * 2 - 2] + BR[m * 2 - 2]) / 2, ey = (BL[m * 2 - 1] + BR[m * 2 - 1]) / 2, ae = Math.atan2(NY[m - 1], NX[m - 1]);
    g.arc(ex, ey, HH[m - 1], ae, ae - Math.PI, true);
    for (i = m - 2; i > 0; i--) corner(g, BR, i, i + 1, i - 1);
    g.lineTo(BR[0], BR[1]);
    var a0 = Math.atan2(NY[0], NX[0]);
    g.arc((BL[0] + BR[0]) / 2, (BL[1] + BR[1]) / 2, HH[0], a0 + Math.PI, a0, true);
    g.closePath();
    if (wet > 0) {
      g.lineJoin = 'round';
      g.strokeStyle = 'rgba(' + col + ',' + (0.08 * wet * alpha).toFixed(3) + ')';
      g.lineWidth = opt.bleed || 3; g.stroke();
    }
    g.fillStyle = 'rgba(' + col + ',' + (alpha * (1 - 0.2 * wet)).toFixed(3) + ')';
    g.fill();
    if (wet > 0) {
      g.strokeStyle = 'rgba(' + col + ',' + (0.55 * wet * alpha).toFixed(3) + ')';
      g.lineWidth = 0.9; g.stroke();
    }
    if (opt.dry !== false && m > 4) {
      // dry-brush streaks: thin paper-coloured hairlines near the tail
      g.lineCap = 'round';
      var st = Math.floor(m * 0.5);
      for (var k = 0; k < 2; k++) {
        var off = k === 0 ? -0.42 : 0.3;
        g.strokeStyle = 'rgba(243,235,221,' + (0.35 * alpha).toFixed(3) + ')';
        g.lineWidth = Math.max(0.5, HH[st] * 0.16);
        g.beginPath();
        for (i = st; i < m; i++) {
          var px = (BL[i * 2] + BR[i * 2]) / 2 + NX[i] * HH[i] * off, py = (BL[i * 2 + 1] + BR[i * 2 + 1]) / 2 + NY[i] * HH[i] * off;
          if (i === st) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.stroke();
      }
    }
  }

  // Catmull-Rom densify of a short control polyline (for authored strokes).
  function smooth(pts, per) {
    var out = [], n = pts.length / 2;
    if (n < 3) {
      for (var q = 0; q < n - 1; q++) for (var u = 0; u < per; u++) {
        var tt = u / per;
        out.push(pts[q * 2] + (pts[q * 2 + 2] - pts[q * 2]) * tt, pts[q * 2 + 1] + (pts[q * 2 + 3] - pts[q * 2 + 1]) * tt);
      }
      out.push(pts[n * 2 - 2], pts[n * 2 - 1]);
      return out;
    }
    function P(i, k) { i = i < 0 ? 0 : i >= n ? n - 1 : i; return pts[i * 2 + k]; }
    for (var i = 0; i < n - 1; i++) {
      for (var s = 0; s < per; s++) {
        var t = s / per, t2 = t * t, t3 = t2 * t;
        for (var k = 0; k < 2; k++) {
          var p0 = P(i - 1, k), p1 = P(i, k), p2 = P(i + 1, k), p3 = P(i + 2, k);
          out.push(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3));
        }
      }
    }
    out.push(pts[n * 2 - 2], pts[n * 2 - 1]);
    return out;
  }

  // ------------------------------------------------------------------ calligraphy title
  var LETTERS = {
    I: { w: 0.42, s: [[0.2, 0.02, 0.23, 0.5, 0.2, 0.98]] },
    N: { w: 0.84, s: [[0.1, 0.97, 0.12, 0.5, 0.1, 0.04], [0.11, 0.04, 0.4, 0.5, 0.68, 0.96], [0.68, 0.96, 0.7, 0.5, 0.68, 0.02]] },
    K: { w: 0.8, s: [[0.1, 0.02, 0.12, 0.5, 0.1, 0.98], [0.66, 0.04, 0.4, 0.3, 0.14, 0.55], [0.32, 0.43, 0.52, 0.7, 0.74, 0.97]] },
    P: { w: 0.76, s: [[0.1, 0.98, 0.12, 0.5, 0.1, 0.03], [0.1, 0.05, 0.4, 0.0, 0.62, 0.08, 0.68, 0.25, 0.58, 0.42, 0.35, 0.5, 0.14, 0.5]] },
    A: { w: 0.82, s: [[0.04, 0.98, 0.2, 0.5, 0.38, 0.02], [0.38, 0.02, 0.56, 0.5, 0.74, 0.98], [0.2, 0.66, 0.4, 0.63, 0.6, 0.64]] },
    T: { w: 0.78, s: [[0.0, 0.07, 0.36, 0.03, 0.74, 0.05], [0.37, 0.05, 0.39, 0.5, 0.37, 0.98]] },
    H: { w: 0.82, s: [[0.1, 0.02, 0.12, 0.5, 0.1, 0.98], [0.68, 0.02, 0.7, 0.5, 0.68, 0.98], [0.12, 0.52, 0.4, 0.49, 0.68, 0.5]] }
  };
  function wordWidth(word) { var w = 0; for (var i = 0; i < word.length; i++) w += LETTERS[word[i]] ? LETTERS[word[i]].w : 0.4; return w; }
  // Draws a word in brush calligraphy; (x, y) = top-left, h = cap height.
  function calligraphy(g, word, x, y, h, seed, opt) {
    opt = opt || {};
    var r = rng(seed || 11), cx = x;
    for (var i = 0; i < word.length; i++) {
      var L = LETTERS[word[i]];
      if (!L) { cx += h * 0.4; continue; }
      for (var k = 0; k < L.s.length; k++) {
        var src = L.s[k], pts = [];
        for (var j = 0; j < src.length; j += 2) pts.push(cx + (src[j] + (r() - 0.5) * 0.03) * h, y + (src[j + 1] + (r() - 0.5) * 0.02) * h);
        var d = smooth(pts, 10), n = d.length / 2, ws = [];
        for (var q = 0; q < n; q++) {
          var t = q / (n - 1);
          ws.push(h * (0.15 + 0.06 * Math.sin(t * Math.PI * 1.3 + k) + (t < 0.12 ? 0.05 * (1 - t / 0.12) : 0)));
        }
        brush(g, d, ws, n, { color: opt.color || '43,38,34', alpha: opt.alpha || 0.96, tin: h * 0.05, tout: h * 0.25, wet: opt.wet || 0.3, bleed: h * 0.04 });
      }
      cx += L.w * h;
    }
  }

  // Ensō: a single circular brush stroke with an open end.
  function enso(g, cx, cy, rad, width, seed, alpha) {
    var r = rng(seed || 5), pts = [], ws = [];
    var a0 = -1.25, sweep = TAU * 0.9, n = 90;
    for (var i = 0; i <= n; i++) {
      var t = i / n, a = a0 + sweep * t, rr = rad * (1 + 0.025 * Math.sin(t * 9 + r() * 0.3));
      pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      ws.push(width * (0.55 + 0.6 * Math.sin(Math.min(1, t * 1.15) * Math.PI) * (1 - 0.35 * t)));
    }
    brush(g, pts, ws, n + 1, { alpha: alpha || 0.9, tin: width * 0.8, tout: width * 5, wet: 0.4, bleed: width * 0.25 });
  }

  // ------------------------------------------------------------------ seals
  function sealPath(g, x, y, s) {
    var h = s / 2, r = s * 0.14;
    g.beginPath();
    g.moveTo(x - h + r, y - h);
    g.lineTo(x + h - r, y - h * 1.02); g.quadraticCurveTo(x + h, y - h, x + h, y - h + r);
    g.lineTo(x + h * 1.02, y + h - r); g.quadraticCurveTo(x + h, y + h, x + h - r, y + h);
    g.lineTo(x - h + r, y + h * 0.98); g.quadraticCurveTo(x - h, y + h, x - h, y + h - r);
    g.lineTo(x - h * 0.98, y - h + r); g.quadraticCurveTo(x - h, y - h, x - h + r, y - h);
    g.closePath();
  }
  // Vermilion seal stamp. on=false draws an empty dashed frame.
  function seal(g, x, y, s, on, rot, alpha) {
    g.save();
    g.translate(x, y); g.rotate(rot || 0);
    g.globalAlpha = alpha === undefined ? 1 : alpha;
    if (!on) {
      g.setLineDash([s * 0.12, s * 0.1]);
      g.strokeStyle = 'rgba(43,38,34,0.32)'; g.lineWidth = Math.max(1, s * 0.06);
      sealPath(g, 0, 0, s * 0.9); g.stroke();
      g.setLineDash([]);
      g.restore();
      return;
    }
    g.fillStyle = PAL.vermilion;
    sealPath(g, 0, 0, s); g.fill();
    // carved border and glyph in paper colour
    g.strokeStyle = 'rgba(248,242,231,0.95)'; g.lineWidth = Math.max(1, s * 0.07); g.lineCap = 'round';
    sealPath(g, 0, 0, s * 0.74); g.stroke();
    g.beginPath(); g.arc(0, -s * 0.04, s * 0.17, 0.3, TAU - 0.3); g.stroke();
    g.beginPath(); g.moveTo(-s * 0.22, s * 0.22); g.quadraticCurveTo(0, s * 0.12, s * 0.22, s * 0.22); g.stroke();
    g.fillStyle = 'rgba(248,242,231,0.95)';
    g.beginPath(); g.arc(0, -s * 0.04, s * 0.05, 0, TAU); g.fill();
    // stamp texture: a few uneven pale specks
    g.fillStyle = 'rgba(243,235,221,0.35)';
    for (var i = 0; i < 6; i++) { var a = i * 2.4 + 0.7, d = s * (0.18 + (i % 3) * 0.1); g.fillRect(Math.cos(a) * d, Math.sin(a) * d, s * 0.05, s * 0.03); }
    g.restore();
  }

  // ------------------------------------------------------------------ marbles
  // kind 0: vermilion lacquer, 1: black lacquer. Returns {body, gloss, r} sprites at radius r px.
  function marbleSprites(r, dpr, kind) {
    var size = Math.ceil(r * 2 + 6), c = makeCanvas(size, size, dpr), g = c.getContext('2d');
    g.scale(dpr, dpr);
    var m = size / 2;
    var gr = g.createRadialGradient(m - r * 0.35, m - r * 0.35, r * 0.1, m, m, r);
    if (kind === 1) { gr.addColorStop(0, '#5A514A'); gr.addColorStop(0.6, '#2B2622'); gr.addColorStop(1, '#141110'); }
    else { gr.addColorStop(0, '#EE6A4A'); gr.addColorStop(0.55, '#C8381F'); gr.addColorStop(1, '#7A1E10'); }
    g.fillStyle = gr; g.beginPath(); g.arc(m, m, r, 0, TAU); g.fill();
    // gold swirl (rotates with the marble)
    g.strokeStyle = 'rgba(226,199,126,0.9)'; g.lineCap = 'round';
    g.lineWidth = Math.max(1, r * 0.16);
    g.beginPath(); g.arc(m, m, r * 0.55, -0.4, 1.9); g.stroke();
    g.lineWidth = Math.max(0.8, r * 0.09);
    g.beginPath(); g.arc(m + r * 0.18, m - r * 0.1, r * 0.25, 2.2, 4.8); g.stroke();
    g.fillStyle = 'rgba(226,199,126,0.9)';
    g.beginPath(); g.arc(m - r * 0.42, m + r * 0.38, r * 0.08, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(30,20,16,0.85)'; g.lineWidth = Math.max(1, r * 0.08);
    g.beginPath(); g.arc(m, m, r - g.lineWidth / 2, 0, TAU); g.stroke();
    var c2 = makeCanvas(size, size, dpr), h = c2.getContext('2d');
    h.scale(dpr, dpr);
    var hg = h.createRadialGradient(m - r * 0.38, m - r * 0.42, 0, m - r * 0.38, m - r * 0.42, r * 0.5);
    hg.addColorStop(0, 'rgba(255,255,255,0.75)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    h.fillStyle = hg; h.beginPath(); h.arc(m, m, r, 0, TAU); h.fill();
    h.strokeStyle = 'rgba(255,240,220,0.25)'; h.lineWidth = Math.max(1, r * 0.08);
    h.beginPath(); h.arc(m, m, r * 0.78, 0.5, 1.3); h.stroke();
    return { body: c, gloss: c2, r: r, size: size };
  }
  function drawMarble(g, spr, x, y, rot, alpha) {
    var s = spr.size;
    g.save();
    if (alpha !== undefined) g.globalAlpha = alpha;
    g.translate(x, y);
    g.rotate(rot);
    g.drawImage(spr.body, -s / 2, -s / 2, s, s);
    g.rotate(-rot);
    g.drawImage(spr.gloss, -s / 2, -s / 2, s, s);
    g.restore();
  }

  // ------------------------------------------------------------------ level pieces (k = px per world unit)
  function stone(g, ax, ay, bx, by, rad, seed) {
    var r = rng(seed), dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len, ny = dx / len;
    if (ny > 0) { nx = -nx; ny = -ny; }
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(120,112,100,0.62)'; g.lineWidth = rad * 2;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    g.strokeStyle = 'rgba(90,84,76,0.35)'; g.lineWidth = rad * 0.9;
    g.beginPath(); g.moveTo(ax - nx * rad * 0.45, ay - ny * rad * 0.45); g.lineTo(bx - nx * rad * 0.45, by - ny * rad * 0.45); g.stroke();
    g.strokeStyle = 'rgba(255,250,240,0.18)'; g.lineWidth = rad * 0.5;
    g.beginPath(); g.moveTo(ax + nx * rad * 0.3, ay + ny * rad * 0.3); g.lineTo(bx + nx * rad * 0.3, by + ny * rad * 0.3); g.stroke();
    // contour: heavier along the top edge, like a dry brush
    var pts = [ax + nx * rad, ay + ny * rad, bx + nx * rad, by + ny * rad];
    var d = smooth(pts, Math.max(4, Math.round(len / 10)));
    for (var i = 0; i < d.length; i += 2) { d[i] += (r() - 0.5) * rad * 0.15; d[i + 1] += (r() - 0.5) * rad * 0.15; }
    brush(g, d, Math.max(1.6, rad * 0.32), d.length / 2, { alpha: 0.85, tin: rad, tout: rad * 1.5, dry: true });
    g.strokeStyle = 'rgba(43,38,34,0.55)'; g.lineWidth = Math.max(0.8, rad * 0.1);
    var a = Math.atan2(ny, nx);
    g.beginPath(); g.moveTo(ax + nx * rad, ay + ny * rad);
    g.arc(ax, ay, rad, a, a + Math.PI, Math.atan2(dy, dx) > 0 ? false : false);
    g.stroke();
    g.beginPath();
    g.moveTo(ax - nx * rad, ay - ny * rad); g.lineTo(bx - nx * rad, by - ny * rad);
    g.arc(bx, by, rad, a + Math.PI, a + TAU);
    g.stroke();
    // moss dots
    g.fillStyle = 'rgba(43,38,34,0.75)';
    var dots = Math.max(2, Math.floor(len / (rad * 3)));
    for (var k = 0; k < dots; k++) {
      var t = (k + 0.3 + r() * 0.4) / dots;
      var px = ax + dx * t + nx * rad * (0.9 + r() * 0.3), py = ay + dy * t + ny * rad * (0.9 + r() * 0.3);
      g.beginPath(); g.ellipse(px, py, rad * (0.12 + r() * 0.1), rad * 0.08, Math.atan2(dy, dx), 0, TAU); g.fill();
    }
  }

  function mist(g, x, y, w, h, seed, k) {
    var r = rng(seed);
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = 'rgba(91,107,133,0.13)'; g.fillRect(x, y, w, h);
    var n = Math.max(4, Math.floor(w * h / (2400 * k * k)));
    for (var i = 0; i < n; i++) {
      var cx = x + r() * w, cy = y + r() * h, rad = (18 + r() * 40) * k;
      var gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      gr.addColorStop(0, 'rgba(91,107,133,0.12)'); gr.addColorStop(1, 'rgba(91,107,133,0)');
      g.fillStyle = gr; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    // cloud curls
    g.strokeStyle = 'rgba(91,107,133,0.38)'; g.lineWidth = Math.max(1, 2 * k); g.lineCap = 'round';
    var curls = Math.max(1, Math.floor(w * h / (14000 * k * k)));
    for (var j = 0; j < curls; j++) {
      var qx = x + (0.15 + r() * 0.7) * w, qy = y + (0.15 + r() * 0.7) * h, qr = (10 + r() * 8) * k;
      g.beginPath();
      for (var s = 0; s <= 24; s++) {
        var t = s / 24, a = t * TAU * 1.3, rr = qr * (1 - t * 0.7);
        var px = qx + Math.cos(a) * rr, py = qy + Math.sin(a) * rr * 0.75;
        if (s === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.moveTo(qx + qr, qy); g.quadraticCurveTo(qx + qr * 2, qy + qr * 0.4, qx + qr * 3.2, qy + qr * 0.1);
      g.stroke();
    }
    g.restore();
    // soft dashed edge
    g.setLineDash([6 * k, 7 * k]);
    g.strokeStyle = 'rgba(91,107,133,0.45)'; g.lineWidth = Math.max(1, 1.5 * k);
    g.strokeRect(x, y, w, h);
    g.setLineDash([]);
  }

  // "no ink" glyph: a brush with a slash
  function noInk(g, x, y, s, alpha) {
    g.save(); g.translate(x, y); g.globalAlpha = alpha;
    g.strokeStyle = PAL.indigo; g.lineCap = 'round';
    g.lineWidth = s * 0.12;
    g.beginPath(); g.moveTo(-s * 0.3, s * 0.3); g.lineTo(s * 0.18, -s * 0.18); g.stroke();
    g.fillStyle = PAL.indigo;
    g.beginPath(); g.moveTo(-s * 0.3, s * 0.3); g.quadraticCurveTo(-s * 0.48, s * 0.42, -s * 0.5, s * 0.5); g.quadraticCurveTo(-s * 0.36, s * 0.22, -s * 0.22, s * 0.22); g.fill();
    g.lineWidth = s * 0.07;
    g.beginPath(); g.arc(0, 0, s * 0.48, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(-s * 0.34, -s * 0.34); g.lineTo(s * 0.34, s * 0.34); g.stroke();
    g.restore();
  }

  // Ceramic bowl. back = inside of the bowl (drawn before the marble), front = body (after).
  function cupBack(g, x, y, k) {
    g.fillStyle = '#4D5E52';
    g.beginPath(); g.ellipse(x, y - 50 * k, 48 * k, 9 * k, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath(); g.ellipse(x, y - 48 * k, 40 * k, 6 * k, 0, 0, TAU); g.fill();
  }
  function cupFront(g, x, y, k, glow) {
    g.save();
    if (glow > 0) {
      var gr = g.createRadialGradient(x, y - 30 * k, 0, x, y - 30 * k, 90 * k);
      gr.addColorStop(0, 'rgba(226,199,126,' + (0.45 * glow).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(226,199,126,0)');
      g.fillStyle = gr; g.fillRect(x - 90 * k, y - 120 * k, 180 * k, 180 * k);
    }
    // shadow
    g.fillStyle = 'rgba(43,38,34,0.12)';
    g.beginPath(); g.ellipse(x, y + 4 * k, 34 * k, 4 * k, 0, 0, TAU); g.fill();
    // body
    g.beginPath();
    g.moveTo(x - 49 * k, y - 50 * k);
    g.bezierCurveTo(x - 47 * k, y - 18 * k, x - 32 * k, y - 2 * k, x - 18 * k, y - 1 * k);
    g.lineTo(x + 18 * k, y - 1 * k);
    g.bezierCurveTo(x + 32 * k, y - 2 * k, x + 47 * k, y - 18 * k, x + 49 * k, y - 50 * k);
    g.ellipse(x, y - 50 * k, 49 * k, 9 * k, 0, 0, Math.PI, false);
    g.closePath();
    var bg = g.createLinearGradient(x - 49 * k, 0, x + 49 * k, 0);
    bg.addColorStop(0, '#7E9A86'); bg.addColorStop(0.35, '#B8CDBB'); bg.addColorStop(0.7, '#9AB4A0'); bg.addColorStop(1, '#6F8C78');
    g.fillStyle = bg; g.fill();
    g.strokeStyle = 'rgba(43,38,34,0.85)'; g.lineWidth = Math.max(1, 2 * k); g.stroke();
    // glaze band and crackle
    g.strokeStyle = 'rgba(70,95,80,0.55)'; g.lineWidth = Math.max(1, 3.5 * k);
    g.beginPath(); g.ellipse(x, y - 30 * k, 43 * k, 7 * k, 0, 0.15, Math.PI - 0.15); g.stroke();
    g.strokeStyle = 'rgba(201,162,74,0.9)'; g.lineWidth = Math.max(0.8, 1.4 * k);
    g.beginPath(); g.ellipse(x, y - 50 * k, 49 * k, 9 * k, 0, 0.05, Math.PI - 0.05); g.stroke();
    // foot ring
    g.fillStyle = '#5E6F60';
    g.beginPath(); g.moveTo(x - 17 * k, y - 1 * k); g.lineTo(x + 17 * k, y - 1 * k); g.lineTo(x + 14 * k, y + 4 * k); g.lineTo(x - 14 * k, y + 4 * k); g.closePath(); g.fill();
    g.restore();
  }

  // Bamboo spring: slat along a->b, coil underneath (away from the launch direction). comp 0..1
  function pad(g, ax, ay, bx, by, k, comp) {
    var dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var tx = dx / len, ty = dy / len, nx = ty, ny = -tx;
    var off = -comp * 8 * k;
    var cx = (ax + bx) / 2, cy = (ay + by) / 2, depth = 26 * k;
    var bxx = cx - nx * depth, byy = cy - ny * depth;
    g.lineCap = 'round'; g.lineJoin = 'round';
    // coils
    g.strokeStyle = 'rgba(43,38,34,0.85)'; g.lineWidth = Math.max(1, 1.8 * k);
    for (var side = -1; side <= 1; side += 2) {
      var sx = cx + tx * side * len * 0.28, sy = cy + ty * side * len * 0.28;
      g.beginPath();
      var top = depth + off;
      for (var i = 0; i <= 8; i++) {
        var t = i / 8, d = -top * t + (-(depth) - (-top)) * 0, zz = (i % 2 ? 1 : -1) * 6 * k;
        if (i === 0 || i === 8) zz = 0;
        var px = sx + nx * (off - (depth + off) * t) + tx * zz, py = sy + ny * (off - (depth + off) * t) + ty * zz;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        d = d + 0;
      }
      g.stroke();
    }
    // base
    g.strokeStyle = 'rgba(43,38,34,0.8)'; g.lineWidth = Math.max(2, 5 * k);
    g.beginPath(); g.moveTo(bxx - tx * len * 0.4, byy - ty * len * 0.4); g.lineTo(bxx + tx * len * 0.4, byy + ty * len * 0.4); g.stroke();
    // slat
    var sax = ax + nx * off, say = ay + ny * off, sbx = bx + nx * off, sby = by + ny * off;
    g.strokeStyle = PAL.mossDark; g.lineWidth = 15 * k;
    g.beginPath(); g.moveTo(sax, say); g.lineTo(sbx, sby); g.stroke();
    g.strokeStyle = PAL.moss; g.lineWidth = 11 * k;
    g.beginPath(); g.moveTo(sax, say); g.lineTo(sbx, sby); g.stroke();
    g.strokeStyle = 'rgba(230,240,200,0.45)'; g.lineWidth = 3 * k;
    g.beginPath(); g.moveTo(sax + nx * 3 * k, say + ny * 3 * k); g.lineTo(sbx + nx * 3 * k, sby + ny * 3 * k); g.stroke();
    // nodes
    g.strokeStyle = 'rgba(43,38,34,0.75)'; g.lineWidth = Math.max(1, 2 * k);
    for (var q = 1; q <= 2; q++) {
      var f = q / 3, qx = sax + (sbx - sax) * f, qy = say + (sby - say) * f;
      g.beginPath(); g.moveTo(qx + nx * 7 * k, qy + ny * 7 * k); g.lineTo(qx - nx * 7 * k, qy - ny * 7 * k); g.stroke();
    }
  }

  // Paper screen (shoji) along a->b. broken: only torn stubs remain.
  function screen(g, ax, ay, bx, by, k, broken, seed) {
    var dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy) || 1, ang = Math.atan2(dy, dx), h = 7 * k;
    var r = rng(seed);
    g.save(); g.translate(ax, ay); g.rotate(ang);
    function panel(x0, x1, ragged0, ragged1) {
      g.beginPath();
      g.moveTo(x0, -h);
      if (ragged1) { for (var i = 0; i <= 4; i++) g.lineTo(x1 + (r() - 0.5) * 8 * k, -h + 2 * h * i / 4); }
      else { g.lineTo(x1, -h); g.lineTo(x1, h); }
      g.lineTo(x0, h);
      if (ragged0) { for (var j = 4; j >= 0; j--) g.lineTo(x0 + (r() - 0.5) * 8 * k, -h + 2 * h * j / 4); }
      g.closePath();
      g.fillStyle = PAL.shoji; g.fill();
      g.strokeStyle = PAL.wood; g.lineWidth = Math.max(1, 1.6 * k); g.stroke();
      g.strokeStyle = 'rgba(107,78,49,0.45)'; g.lineWidth = Math.max(0.6, 0.8 * k);
      g.beginPath(); g.moveTo(x0, 0); g.lineTo(x1, 0);
      for (var q = x0 + 22 * k; q < x1 - 4 * k; q += 22 * k) { g.moveTo(q, -h); g.lineTo(q, h); }
      g.stroke();
    }
    if (!broken) panel(0, len, false, false);
    else { panel(0, len * 0.18, false, true); panel(len * 0.84, len, true, false); }
    g.restore();
  }

  function lanternGlow(rad, dpr) {
    var s = Math.ceil(rad * 5), c = makeCanvas(s, s, dpr), g = c.getContext('2d');
    g.scale(dpr, dpr);
    var gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(240,190,90,0.5)'); gr.addColorStop(0.45, 'rgba(230,150,70,0.18)'); gr.addColorStop(1, 'rgba(230,150,70,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    return { c: c, s: s };
  }
  // Paper lantern with radius rad px, hanging from a string to topY.
  function lantern(g, x, y, rad, topY, glow, sway) {
    g.save();
    g.strokeStyle = 'rgba(43,38,34,0.5)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, topY); g.lineTo(x, y - rad * 1.1); g.stroke();
    if (glow) g.drawImage(glow.c, x - glow.s / 2, y - glow.s / 2, glow.s, glow.s);
    g.translate(x, y); g.rotate(sway || 0);
    var rx = rad, ry = rad * 1.08;
    g.fillStyle = PAL.vermilion;
    g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,220,150,0.35)';
    g.beginPath(); g.ellipse(-rx * 0.15, -ry * 0.1, rx * 0.55, ry * 0.75, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(80,20,10,0.45)'; g.lineWidth = Math.max(0.8, rad * 0.05);
    for (var i = 1; i <= 3; i++) { g.beginPath(); g.ellipse(0, 0, rx * i / 4, ry, 0, 0, TAU); g.stroke(); }
    for (var j = -2; j <= 2; j++) { var yy = j * ry * 0.35, w = rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry))); g.beginPath(); g.moveTo(-w, yy); g.lineTo(w, yy); g.stroke(); }
    g.strokeStyle = 'rgba(43,38,34,0.9)'; g.lineWidth = Math.max(1, rad * 0.07);
    g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.stroke();
    g.fillStyle = PAL.ink;
    g.fillRect(-rx * 0.45, -ry - rad * 0.16, rx * 0.9, rad * 0.2);
    g.fillRect(-rx * 0.45, ry - rad * 0.04, rx * 0.9, rad * 0.2);
    g.strokeStyle = PAL.gold; g.lineWidth = Math.max(1, rad * 0.06);
    g.beginPath(); g.moveTo(0, ry + rad * 0.16); g.lineTo(0, ry + rad * 0.55); g.stroke();
    g.restore();
  }

  // Pointing hand (tutorial). (x, y) = fingertip.
  function hand(g, x, y, s, press) {
    g.save();
    g.translate(x, y + (press ? s * 0.04 : 0));
    g.rotate(-0.45);
    g.scale(s / 100, s / 100);
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-8, 0);
    g.quadraticCurveTo(0, -6, 8, 0);
    g.lineTo(9, 42);
    g.quadraticCurveTo(17, 36, 24, 44);
    g.quadraticCurveTo(32, 40, 38, 49);
    g.quadraticCurveTo(48, 47, 50, 58);
    g.lineTo(48, 86);
    g.quadraticCurveTo(44, 104, 24, 106);
    g.lineTo(2, 106);
    g.quadraticCurveTo(-16, 104, -22, 86);
    g.lineTo(-30, 62);
    g.quadraticCurveTo(-32, 52, -22, 52);
    g.lineTo(-9, 64);
    g.closePath();
    g.fillStyle = 'rgba(248,242,231,0.97)'; g.fill();
    g.strokeStyle = PAL.ink; g.lineWidth = 5; g.stroke();
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(9, 46); g.lineTo(9, 60); g.moveTo(24, 46); g.lineTo(24, 62); g.moveTo(38, 51); g.lineTo(38, 64); g.stroke();
    g.restore();
  }

  // ------------------------------------------------------------------ icons
  function icon(g, name, x, y, s, color) {
    g.save();
    g.translate(x, y);
    g.strokeStyle = color; g.fillStyle = color;
    g.lineWidth = Math.max(2, s * 0.13); g.lineCap = 'round'; g.lineJoin = 'round';
    var h = s / 2, i;
    switch (name) {
      case 'pause':
        g.beginPath(); g.moveTo(-h * 0.32, -h * 0.55); g.lineTo(-h * 0.3, h * 0.55); g.moveTo(h * 0.32, -h * 0.55); g.lineTo(h * 0.3, h * 0.55);
        g.lineWidth = s * 0.17; g.stroke();
        break;
      case 'go':
        g.beginPath(); g.moveTo(-h * 0.35, -h * 0.6); g.lineTo(h * 0.62, 0); g.lineTo(-h * 0.35, h * 0.6); g.closePath();
        g.lineWidth = s * 0.08; g.fill(); g.stroke();
        break;
      case 'undo':
        g.beginPath(); g.arc(h * 0.05, h * 0.15, h * 0.52, Math.PI * 1.05, Math.PI * 2.25, false); g.stroke();
        g.beginPath(); g.moveTo(-h * 0.75, -h * 0.35); g.lineTo(-h * 0.47, h * 0.18); g.lineTo(h * 0.0 - h * 0.05, -h * 0.12); g.stroke();
        break;
      case 'retry':
        g.beginPath(); g.arc(0, 0, h * 0.58, -Math.PI * 0.35, Math.PI * 1.3); g.stroke();
        g.beginPath(); g.moveTo(h * 0.2, -h * 0.85); g.lineTo(h * 0.42, -h * 0.46); g.lineTo(0, -h * 0.3); g.stroke();
        break;
      case 'clear':
        g.beginPath(); g.moveTo(-h * 0.7, h * 0.15); g.bezierCurveTo(-h * 0.3, -h * 0.35, h * 0.0, h * 0.5, h * 0.7, -h * 0.15); g.stroke();
        g.lineWidth = s * 0.1;
        g.beginPath(); g.moveTo(-h * 0.5, -h * 0.6); g.lineTo(h * 0.5, h * 0.6); g.stroke();
        break;
      case 'hint':
        g.beginPath(); g.arc(0, -h * 0.15, h * 0.42, Math.PI * 0.75, Math.PI * 2.25); g.lineTo(h * 0.18, h * 0.42); g.lineTo(-h * 0.18, h * 0.42); g.closePath(); g.stroke();
        g.beginPath(); g.moveTo(-h * 0.16, h * 0.65); g.lineTo(h * 0.16, h * 0.65); g.stroke();
        break;
      case 'grid':
        for (i = 0; i < 9; i++) { g.beginPath(); g.arc((i % 3 - 1) * h * 0.55, (Math.floor(i / 3) - 1) * h * 0.55, h * 0.13, 0, TAU); g.fill(); }
        break;
      case 'left': case 'right':
        var d = name === 'left' ? 1 : -1;
        g.beginPath(); g.moveTo(h * 0.25 * d, -h * 0.55); g.lineTo(-h * 0.3 * d, 0); g.lineTo(h * 0.25 * d, h * 0.55); g.stroke();
        break;
      case 'sound': case 'soundOff':
        g.lineWidth = s * 0.09;
        g.beginPath(); g.moveTo(-h * 0.7, -h * 0.22); g.lineTo(-h * 0.38, -h * 0.22); g.lineTo(-h * 0.02, -h * 0.58); g.lineTo(-h * 0.02, h * 0.58); g.lineTo(-h * 0.38, h * 0.22); g.lineTo(-h * 0.7, h * 0.22); g.closePath(); g.fill();
        if (name === 'sound') {
          g.beginPath(); g.arc(h * 0.05, 0, h * 0.38, -0.8, 0.8); g.stroke();
          g.beginPath(); g.arc(h * 0.05, 0, h * 0.68, -0.8, 0.8); g.stroke();
        } else {
          g.beginPath(); g.moveTo(h * 0.25, -h * 0.28); g.lineTo(h * 0.75, h * 0.28); g.moveTo(h * 0.75, -h * 0.28); g.lineTo(h * 0.25, h * 0.28); g.stroke();
        }
        break;
      case 'lock':
        g.fillRect(-h * 0.45, -h * 0.05, h * 0.9, h * 0.7);
        g.lineWidth = s * 0.1;
        g.beginPath(); g.arc(0, -h * 0.1, h * 0.3, Math.PI, 0); g.stroke();
        break;
      case 'play':
        g.beginPath(); g.moveTo(-h * 0.3, -h * 0.55); g.lineTo(h * 0.55, 0); g.lineTo(-h * 0.3, h * 0.55); g.closePath(); g.fill();
        break;
    }
    g.restore();
  }

  root.InkArt = {
    PAL: PAL, rng: rng, makeCanvas: makeCanvas, paper: paper, mountains: mountains,
    brush: brush, smooth: smooth, calligraphy: calligraphy, wordWidth: wordWidth, enso: enso,
    seal: seal, sealPath: sealPath, marbleSprites: marbleSprites, drawMarble: drawMarble,
    stone: stone, mist: mist, noInk: noInk, cupBack: cupBack, cupFront: cupFront, pad: pad, screen: screen,
    lanternGlow: lanternGlow, lantern: lantern, hand: hand, icon: icon
  };
})(this);
