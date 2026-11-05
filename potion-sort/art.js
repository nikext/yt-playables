/* Potion Sort: palette, glyphs, flasks, candles, icons and other drawing helpers.
   Everything is drawn in code. Functions take the 2D context as their first argument. */
(function () {
  'use strict';
  var PS = window.PS = window.PS || {};
  var A = PS.Art = {};

  // ------------------------------------------------------------------ palette (see README)
  var C = A.C = {
    shelf: '#17322B',      // dark green wood: background
    shelfDeep: '#0C1D18',
    shelfHi: '#21443A',
    plankTop: '#2C574A',
    plankFront: '#123029',
    brass: '#D4A84B',
    brassDeep: '#8E6A25',
    brassHi: '#F4D98F',
    parchment: '#F2E6C9',
    parchDeep: '#D6C298',
    ink: '#2B2116',        // text on parchment / brass
    inkSoft: '#5E4C35',
    candle: '#FFC870',
    wax: '#EFE3C6',
    seal: '#A3283A',
    sealDeep: '#6E1724',
    cork: '#BF915E',
    corkDeep: '#8A6038',
    smoke: '#363B49',
    smokeDeep: '#252935',
    glass: 'rgba(214,240,232,0.55)'
  };
  // The eight jewel liquids. glyphDark: draw the rune dark (on bright liquids) or light.
  var LIQ = A.LIQ = [
    { name: 'ruby', c: '#E0475B', glyphDark: false },
    { name: 'sapphire', c: '#3E7BFA', glyphDark: false },
    { name: 'emerald', c: '#2FC77A', glyphDark: true },
    { name: 'amber', c: '#FFB23E', glyphDark: true },
    { name: 'amethyst', c: '#A45CF2', glyphDark: false },
    { name: 'aqua', c: '#3FD8E0', glyphDark: true },
    { name: 'rose', c: '#FF7FB0', glyphDark: true },
    { name: 'lime', c: '#B6E34A', glyphDark: true }
  ];
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(h1, h2, t) {
    var a = hexRgb(h1), b = hexRgb(h2);
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }
  A.mix = mix;
  A.rgba = function (h, a) { var c = hexRgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };
  LIQ.forEach(function (L) { L.hi = mix(L.c, '#FFFFFF', 0.38); L.lo = mix(L.c, '#0A1410', 0.3); L.line = mix(L.c, '#0A1410', 0.45); });

  A.FONT = 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
  A.font = function (size, weight) { return (weight || 700) + ' ' + Math.max(1, Math.round(size)) + 'px ' + A.FONT; };
  A.text = function (g, str, x, y, size, color, align, weight, maxW) {
    var s = size;
    g.font = A.font(s, weight);
    if (maxW) while (s > 9 && g.measureText(str).width > maxW) { s -= 1; g.font = A.font(s, weight); }
    g.fillStyle = color;
    g.textAlign = align || 'center';
    g.textBaseline = 'middle';
    g.fillText(str, x, y);
    return s;
  };
  A.rr = function (g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };
  var rr = A.rr;
  A.hash = function (n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ------------------------------------------------------------------ glyphs (one rune per color)
  function star(g, r, inner, pts) {
    g.beginPath();
    for (var i = 0; i < pts * 2; i++) {
      var a = -Math.PI / 2 + i * Math.PI / pts, rad = i % 2 ? r * inner : r;
      if (i) g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); else g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    g.closePath();
  }
  A.starPath = star;
  function glyphPath(g, ci, s) {
    var h = s / 2;
    g.beginPath();
    switch (ci) {
      case 0: // ruby: diamond
        g.moveTo(0, -h); g.lineTo(h * 0.72, 0); g.lineTo(0, h); g.lineTo(-h * 0.72, 0); g.closePath(); break;
      case 1: // sapphire: drop
        g.moveTo(0, -h); g.bezierCurveTo(h * 0.25, -h * 0.45, h * 0.75, -h * 0.05, h * 0.72, h * 0.32);
        g.arc(0, h * 0.32, h * 0.72, 0, Math.PI, false);
        g.bezierCurveTo(-h * 0.75, -h * 0.05, -h * 0.25, -h * 0.45, 0, -h); g.closePath(); break;
      case 2: // emerald: triangle
        g.moveTo(0, -h * 0.92); g.lineTo(h * 0.9, h * 0.72); g.lineTo(-h * 0.9, h * 0.72); g.closePath(); break;
      case 3: // amber: sun (disc, rays are added in drawGlyph)
        g.arc(0, 0, h * 0.48, 0, Math.PI * 2); break;
      case 4: // amethyst: star
        star(g, h, 0.45, 5); break;
      case 5: // aqua: crescent moon
        g.arc(0, 0, h * 0.85, Math.PI * 0.32, Math.PI * 1.68, false);
        g.arc(h * 0.38, -h * 0.06, h * 0.66, Math.PI * 1.5, Math.PI * 0.55, true);
        g.closePath(); break;
      case 6: // rose: heart
        g.moveTo(0, h * 0.85);
        g.bezierCurveTo(-h * 1.15, h * 0.05, -h * 0.75, -h * 0.95, 0, -h * 0.4);
        g.bezierCurveTo(h * 0.75, -h * 0.95, h * 1.15, h * 0.05, 0, h * 0.85);
        g.closePath(); break;
      case 7: // lime: cross
        var t = h * 0.3;
        g.moveTo(-t, -h * 0.9); g.lineTo(t, -h * 0.9); g.lineTo(t, -t); g.lineTo(h * 0.9, -t); g.lineTo(h * 0.9, t); g.lineTo(t, t);
        g.lineTo(t, h * 0.9); g.lineTo(-t, h * 0.9); g.lineTo(-t, t); g.lineTo(-h * 0.9, t); g.lineTo(-h * 0.9, -t); g.lineTo(-t, -t);
        g.closePath(); break;
    }
  }
  // Draws color ci's rune centered at x,y with size s. onLiquid: pick contrast for that liquid.
  A.glyph = function (g, ci, x, y, s, alpha, onLiquid) {
    var L = LIQ[ci];
    var dark = onLiquid ? L.glyphDark : false;
    g.save();
    g.translate(x, y);
    g.globalAlpha *= alpha === undefined ? 1 : alpha;
    var col = dark ? 'rgba(28,22,16,0.62)' : 'rgba(255,250,236,0.92)';
    var edge = dark ? 'rgba(255,255,255,0.25)' : 'rgba(20,16,10,0.35)';
    g.lineJoin = 'round';
    if (ci === 3) { // sun rays
      g.strokeStyle = col; g.lineWidth = Math.max(1.2, s * 0.09); g.lineCap = 'round';
      g.beginPath();
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4;
        g.moveTo(Math.cos(a) * s * 0.34, Math.sin(a) * s * 0.34); g.lineTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5);
      }
      g.stroke();
    }
    glyphPath(g, ci, s);
    g.strokeStyle = edge; g.lineWidth = Math.max(1, s * 0.07); g.stroke();
    g.fillStyle = col; g.fill();
    g.restore();
  };

  // ------------------------------------------------------------------ flask geometry
  // Units are multiples of the tube width w. Origin = bottom center, y grows downward.
  var G = A.G = { LH: 0.7, BASE: 0.075, FH: 3.36, WALL: 0.075 };
  function tubePath(g, w, ins) {
    var hw = w / 2 - ins, top = -G.FH * w, rb = hw * 0.9, b = -ins;
    g.beginPath();
    g.moveTo(-hw, top);
    g.lineTo(-hw, b - rb);
    g.arcTo(-hw, b, -hw + rb, b, rb);
    g.lineTo(hw - rb, b);
    g.arcTo(hw, b, hw, b - rb, rb);
    g.lineTo(hw, top);
    g.closePath();
  }
  A.tubePath = tubePath;

  var gradCache = {};
  function grads(g, w) {
    var k = Math.round(w * 10);
    var c = gradCache[k];
    if (c) return c;
    var sh = g.createLinearGradient(-w / 2, 0, w / 2, 0);
    sh.addColorStop(0, 'rgba(255,255,255,0.16)');
    sh.addColorStop(0.3, 'rgba(255,255,255,0.05)');
    sh.addColorStop(0.62, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(0,10,8,0.34)');
    var hl = g.createLinearGradient(-w * 0.38, 0, -w * 0.16, 0);
    hl.addColorStop(0, 'rgba(255,255,255,0)');
    hl.addColorStop(0.45, 'rgba(255,255,255,0.42)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    var br = g.createLinearGradient(0, -w * 0.07, 0, w * 0.07);
    br.addColorStop(0, C.brassHi); br.addColorStop(0.5, C.brass); br.addColorStop(1, C.brassDeep);
    c = gradCache[k] = { shade: sh, hl: hl, brass: br };
    return c;
  }
  A.clearCache = function () { gradCache = {}; };

  // o: { x, y: bottom center, w, ang, segs: [{c, a, hid}], n: seg count, sel: 0..1, glow: 0..1,
  //      cork: 0..1 (completed cork drop) or -1, seal: pours left (0 = none), sealPop: 0..1, t: time, focus }
  A.flask = function (g, o) {
    var w = o.w, ang = o.ang || 0, gr = grads(g, w), FHw = G.FH * w;
    g.save();
    g.translate(o.x, o.y);
    // shadow on the shelf
    if (!ang) {
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.beginPath(); g.ellipse(0, w * 0.04, w * 0.62, w * 0.12, 0, 0, Math.PI * 2); g.fill();
    }
    if (o.lift) g.translate(0, -o.lift);
    g.rotate(ang);
    // selection / hint glow
    if (o.glow > 0) {
      g.save();
      g.globalAlpha = o.glow;
      g.shadowColor = o.glowCol || C.brassHi; g.shadowBlur = w * 0.5;
      tubePath(g, w, 0); g.strokeStyle = o.glowCol || C.brassHi; g.lineWidth = w * 0.06; g.stroke();
      g.restore();
    }
    // glass back
    tubePath(g, w, 0);
    g.fillStyle = 'rgba(8,22,18,0.42)'; g.fill();
    // liquid
    g.save();
    tubePath(g, w, G.WALL * w);
    g.clip();
    var LH = G.LH * w, i, s, y0, h;
    if (Math.abs(ang) < 0.01) {
      y0 = -G.BASE * w;
      for (i = 0; i < o.n; i++) {
        s = o.segs[i]; h = s.a * LH;
        if (h <= 0.01) continue;
        g.fillStyle = s.hid ? C.smoke : LIQ[s.c].c;
        g.fillRect(-w, y0 - h - 0.5, w * 2, h + 1);
        if (s.hid) {
          g.fillStyle = C.smokeDeep;
          g.beginPath(); g.ellipse(-w * 0.12, y0 - h * 0.35, w * 0.3, h * 0.16, 0.3, 0, Math.PI * 2); g.fill();
        }
        if (i > 0 && (s.hid || o.segs[i - 1].hid || s.c !== o.segs[i - 1].c)) {
          g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(-w, y0 - 1, w * 2, Math.max(1, w * 0.025));
        }
        y0 -= h;
      }
      // surface
      if (o.n && y0 < -G.BASE * w - 1) {
        var top = o.segs[o.n - 1];
        g.fillStyle = top.hid ? 'rgba(255,255,255,0.12)' : LIQ[top.c].hi;
        g.fillRect(-w, y0, w * 2, Math.max(1.5, w * 0.07));
      }
      g.fillStyle = gr.shade; g.fillRect(-w, -FHw, w * 2, FHw + w);
      // runes, one per whole layer
      y0 = -G.BASE * w;
      var gs = w * 0.46;
      for (i = 0; i < o.n; i++) {
        s = o.segs[i]; h = s.a * LH;
        var whole = Math.floor(s.a + 0.001);
        for (var k = 0; k < whole; k++) {
          var cy = y0 - (k + 0.5) * LH;
          if (s.hid) A.text(g, '?', w * 0.01, cy + w * 0.02, w * 0.5, 'rgba(242,230,201,0.85)', 'center', 900);
          else A.glyph(g, s.c, -w * 0.02, cy, gs, 1, true);
        }
        var frac = s.a - whole;
        if (frac > 0.6 && !s.hid) A.glyph(g, s.c, -w * 0.02, y0 - (whole + frac / 2) * LH, gs * frac, frac, true);
        y0 -= h;
      }
    } else {
      // Tilted: keep the surface level. Draw world-horizontal bands up from the lowest corner.
      var sa = Math.sin(ang), ca = Math.cos(ang), hw = w / 2 - G.WALL * w;
      var yLow = hw * Math.abs(sa) - G.WALL * w * ca;
      var kf = Math.max(ca, 0.42);
      g.rotate(-ang);
      y0 = yLow;
      for (i = 0; i < o.n; i++) {
        s = o.segs[i]; h = s.a * LH * kf;
        if (h <= 0.01) continue;
        g.fillStyle = s.hid ? C.smoke : LIQ[s.c].c;
        g.fillRect(-FHw * 1.5, y0 - h - 0.5, FHw * 3, h + 1);
        y0 -= h;
      }
      if (o.n) {
        var tp = o.segs[o.n - 1];
        g.fillStyle = tp.hid ? 'rgba(255,255,255,0.12)' : LIQ[tp.c].hi;
        g.fillRect(-FHw * 1.5, y0, FHw * 3, Math.max(1.5, w * 0.06));
      }
      g.rotate(ang);
      g.fillStyle = gr.shade; g.fillRect(-w, -FHw, w * 2, FHw + w);
    }
    // little bubbles in liquid
    if (o.bub && !ang) {
      var fillH = 0;
      for (i = 0; i < o.n; i++) fillH += o.segs[i].a;
      fillH = fillH * LH;
      if (fillH > LH * 0.5) {
        g.fillStyle = 'rgba(255,255,255,0.35)';
        for (i = 0; i < 3; i++) {
          var ph = (o.t * (0.18 + i * 0.07) + A.hash(o.bub * 7 + i)) % 1;
          var by = -G.BASE * w - ph * (fillH - w * 0.1);
          var bx = (A.hash(o.bub * 3 + i * 5) - 0.5) * w * 0.5 + Math.sin(o.t * 2 + i) * w * 0.04;
          g.beginPath(); g.arc(bx, by, w * (0.025 + 0.015 * i), 0, Math.PI * 2); g.fill();
        }
      }
    }
    g.restore();
    // glass front
    g.fillStyle = gr.hl;
    rr(g, -w * 0.38, -FHw + w * 0.32, w * 0.22, FHw - w * 0.62, w * 0.1); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.22)';
    rr(g, w * 0.24, -FHw + w * 0.45, w * 0.07, FHw * 0.35, w * 0.035); g.fill();
    tubePath(g, w, 0);
    g.strokeStyle = o.focus ? C.brassHi : C.glass; g.lineWidth = Math.max(1.5, w * (o.focus ? 0.07 : 0.045)); g.stroke();
    // brass collar + glass lip
    g.save();
    g.translate(0, -FHw + w * 0.25);
    g.fillStyle = gr.brass;
    rr(g, -w * 0.53, -w * 0.065, w * 1.06, w * 0.13, w * 0.04); g.fill();
    g.restore();
    g.fillStyle = 'rgba(214,240,232,0.35)';
    rr(g, -w * 0.58, -FHw - w * 0.06, w * 1.16, w * 0.14, w * 0.07); g.fill();
    g.strokeStyle = C.glass; g.lineWidth = Math.max(1, w * 0.035);
    rr(g, -w * 0.58, -FHw - w * 0.06, w * 1.16, w * 0.14, w * 0.07); g.stroke();
    // completed cork
    if (o.cork >= 0) drawCork(g, w, o.cork, false, 0, 0);
    if (o.seal > 0 || o.sealPop > 0) drawCork(g, w, 1, true, o.seal, o.sealPop || 0);
    g.restore();
  };

  function easeBack(x) { x = clamp(x, 0, 1); var c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
  function drawCork(g, w, p, sealed, left, pop) {
    var FHw = G.FH * w;
    g.save();
    var dy = sealed ? -pop * w * 1.6 : -(1 - easeBack(p)) * w * 1.3;
    g.globalAlpha *= sealed ? 1 - pop : clamp(p * 3, 0, 1);
    g.translate(0, -FHw + dy);
    if (sealed && pop) g.rotate(pop * 0.9);
    // cork body (trapezoid)
    var tw = w * 0.86, bw = w * 0.68, ch = w * 0.5;
    g.beginPath();
    g.moveTo(-tw / 2, -ch * 0.62); g.lineTo(tw / 2, -ch * 0.62); g.lineTo(bw / 2, ch * 0.38); g.lineTo(-bw / 2, ch * 0.38); g.closePath();
    g.fillStyle = C.cork; g.fill();
    g.fillStyle = C.corkDeep;
    for (var i = 0; i < 5; i++) {
      g.beginPath(); g.arc((A.hash(i * 3.1) - 0.5) * bw * 0.8, (A.hash(i * 5.7) - 0.5) * ch * 0.7, w * 0.03, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(-tw / 2 + w * 0.06, -ch * 0.58, w * 0.12, ch * 0.75);
    g.beginPath(); g.ellipse(0, -ch * 0.62, tw / 2, w * 0.09, 0, 0, Math.PI * 2);
    g.fillStyle = mix(C.cork, '#FFFFFF', 0.25); g.fill();
    if (sealed) {
      // red wax seal with the pours-left count
      g.fillStyle = C.seal;
      g.beginPath();
      g.moveTo(-tw / 2 - w * 0.04, -ch * 0.7);
      g.lineTo(tw / 2 + w * 0.04, -ch * 0.7);
      g.lineTo(tw / 2 + w * 0.02, -ch * 0.2);
      g.quadraticCurveTo(tw * 0.3, ch * 0.25, tw * 0.22, -ch * 0.05);
      g.quadraticCurveTo(0, ch * 0.05, -tw * 0.18, -ch * 0.1);
      g.quadraticCurveTo(-tw * 0.32, ch * 0.4, -tw / 2 - w * 0.02, -ch * 0.15);
      g.closePath(); g.fill();
      var r = w * 0.36;
      g.fillStyle = C.sealDeep; g.beginPath(); g.arc(0, -ch * 0.95 + w * 0.03, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.seal; g.beginPath(); g.arc(0, -ch * 0.95, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,220,200,0.35)'; g.lineWidth = Math.max(1, w * 0.03);
      g.beginPath(); g.arc(0, -ch * 0.95, r * 0.78, 0, Math.PI * 2); g.stroke();
      if (left > 0) A.text(g, String(left), 0, -ch * 0.95 + 1, r * 1.05, C.parchment, 'center', 900);
    }
    g.restore();
  }

  // ------------------------------------------------------------------ candles
  A.candle = function (g, x, y, cw, ch, t, seed) {
    var fl = 1 + Math.sin(t * 7.3 + seed) * 0.05 + Math.sin(t * 13.1 + seed * 2) * 0.03;
    var sway = Math.sin(t * 2.1 + seed) * cw * 0.06;
    // glow
    var gx = x, gy = y - ch - cw * 0.5, gr = cw * 4.2 * fl;
    var rg = g.createRadialGradient(gx, gy, cw * 0.2, gx, gy, gr);
    rg.addColorStop(0, 'rgba(255,200,112,0.32)');
    rg.addColorStop(1, 'rgba(255,200,112,0)');
    g.fillStyle = rg; g.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    // body
    var bg = g.createLinearGradient(x - cw / 2, 0, x + cw / 2, 0);
    bg.addColorStop(0, '#FFF6DE'); bg.addColorStop(0.6, C.wax); bg.addColorStop(1, '#C9B88F');
    g.fillStyle = bg;
    rr(g, x - cw / 2, y - ch, cw, ch, cw * 0.12); g.fill();
    g.beginPath(); g.ellipse(x, y - ch, cw / 2, cw * 0.14, 0, 0, Math.PI * 2); g.fillStyle = '#FFF9EA'; g.fill();
    // drip
    g.fillStyle = '#FFF4D6';
    rr(g, x + cw * 0.12, y - ch, cw * 0.16, ch * 0.28, cw * 0.08); g.fill();
    // brass holder
    g.fillStyle = C.brassDeep; rr(g, x - cw * 0.85, y - cw * 0.12, cw * 1.7, cw * 0.32, cw * 0.14); g.fill();
    g.fillStyle = C.brass; rr(g, x - cw * 0.85, y - cw * 0.2, cw * 1.7, cw * 0.28, cw * 0.14); g.fill();
    // wick + flame
    g.strokeStyle = '#3A2A1C'; g.lineWidth = Math.max(1, cw * 0.06);
    g.beginPath(); g.moveTo(x, y - ch); g.lineTo(x, y - ch - cw * 0.18); g.stroke();
    var fx = x + sway, fy = y - ch - cw * 0.12, fh = cw * 1.05 * fl, fw = cw * 0.36;
    g.beginPath();
    g.moveTo(fx, fy - fh);
    g.bezierCurveTo(fx + fw, fy - fh * 0.45, fx + fw * 0.9, fy, fx, fy);
    g.bezierCurveTo(fx - fw * 0.9, fy, fx - fw, fy - fh * 0.45, fx, fy - fh);
    var fg = g.createRadialGradient(fx, fy - fh * 0.25, 0, fx, fy - fh * 0.3, fh * 0.75);
    fg.addColorStop(0, '#FFFBEA'); fg.addColorStop(0.35, '#FFE29A'); fg.addColorStop(1, '#FF9A3C');
    g.fillStyle = fg; g.fill();
  };

  // ------------------------------------------------------------------ icons (s = box size)
  function arcArrow(g, cx, cy, r, a0, a1, ccw, h) {
    g.beginPath(); g.arc(cx, cy, r, a0, a1, ccw); g.stroke();
    var tx = cx + Math.cos(a1) * r, ty = cy + Math.sin(a1) * r;
    var dx = ccw ? Math.sin(a1) : -Math.sin(a1), dy = ccw ? -Math.cos(a1) : Math.cos(a1);
    var al = h * 0.45, sp = 0.6;
    g.beginPath();
    g.moveTo(tx - al * (dx * Math.cos(sp) - dy * Math.sin(sp)), ty - al * (dy * Math.cos(sp) + dx * Math.sin(sp)));
    g.lineTo(tx, ty);
    g.lineTo(tx - al * (dx * Math.cos(-sp) - dy * Math.sin(-sp)), ty - al * (dy * Math.cos(-sp) + dx * Math.sin(-sp)));
    g.stroke();
  }
  A.icon = function (g, name, x, y, s, color) {
    g.save();
    g.translate(x, y);
    g.strokeStyle = color; g.fillStyle = color;
    g.lineWidth = Math.max(2, s * 0.12); g.lineCap = 'round'; g.lineJoin = 'round';
    var h = s / 2, i;
    switch (name) {
      case 'grid':
        for (i = 0; i < 4; i++) { rr(g, -h * 0.8 + (i % 2) * h * 0.9, -h * 0.8 + (i >> 1) * h * 0.9, h * 0.7, h * 0.7, h * 0.18); g.fill(); }
        break;
      case 'left': case 'right':
        g.beginPath(); var d = name === 'left' ? 1 : -1;
        g.moveTo(h * 0.3 * d, -h * 0.6); g.lineTo(-h * 0.3 * d, 0); g.lineTo(h * 0.3 * d, h * 0.6); g.stroke();
        break;
      case 'undo':
        arcArrow(g, h * 0.1, h * 0.15, h * 0.55, 0.15, -Math.PI - 0.1, true, h);
        break;
      case 'reset':
        arcArrow(g, 0, 0, h * 0.6, -Math.PI * 0.4, Math.PI * 1.25, false, h);
        break;
      case 'addFlask':
        g.lineWidth = Math.max(2, s * 0.1);
        g.beginPath(); g.moveTo(-h * 0.55, -h * 0.75); g.lineTo(-h * 0.55, h * 0.45);
        g.arc(-h * 0.2, h * 0.45, h * 0.35, Math.PI, 0, true); g.lineTo(h * 0.15, -h * 0.75); g.stroke();
        g.beginPath(); g.moveTo(-h * 0.75, -h * 0.75); g.lineTo(h * 0.35, -h * 0.75); g.stroke();
        g.lineWidth = Math.max(2, s * 0.12);
        g.beginPath(); g.moveTo(h * 0.62, -h * 0.25); g.lineTo(h * 0.62, h * 0.45); g.moveTo(h * 0.27, h * 0.1); g.lineTo(h * 0.97, h * 0.1); g.stroke();
        break;
      case 'pause':
        rr(g, -h * 0.5, -h * 0.6, h * 0.35, h * 1.2, h * 0.12); g.fill();
        rr(g, h * 0.15, -h * 0.6, h * 0.35, h * 1.2, h * 0.12); g.fill();
        break;
      case 'sound': case 'soundOff':
        g.beginPath(); g.moveTo(-h * 0.75, -h * 0.25); g.lineTo(-h * 0.4, -h * 0.25); g.lineTo(0, -h * 0.65); g.lineTo(0, h * 0.65); g.lineTo(-h * 0.4, h * 0.25); g.lineTo(-h * 0.75, h * 0.25); g.closePath(); g.fill();
        if (name === 'sound') {
          g.beginPath(); g.arc(h * 0.05, 0, h * 0.4, -0.8, 0.8); g.stroke();
          g.beginPath(); g.arc(h * 0.05, 0, h * 0.72, -0.8, 0.8); g.stroke();
        } else {
          g.beginPath(); g.moveTo(h * 0.25, -h * 0.3); g.lineTo(h * 0.8, h * 0.3); g.moveTo(h * 0.8, -h * 0.3); g.lineTo(h * 0.25, h * 0.3); g.stroke();
        }
        break;
      case 'music': case 'musicOff':
        g.beginPath(); g.ellipse(-h * 0.35, h * 0.45, h * 0.3, h * 0.22, -0.4, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(h * 0.45, h * 0.3, h * 0.3, h * 0.22, -0.4, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(-h * 0.08, h * 0.42); g.lineTo(-h * 0.08, -h * 0.6); g.lineTo(h * 0.72, -h * 0.78); g.lineTo(h * 0.72, h * 0.28); g.stroke();
        if (name === 'musicOff') { g.beginPath(); g.moveTo(-h * 0.85, -h * 0.85); g.lineTo(h * 0.85, h * 0.85); g.stroke(); }
        break;
      case 'play':
        g.beginPath(); g.moveTo(-h * 0.4, -h * 0.6); g.lineTo(h * 0.6, 0); g.lineTo(-h * 0.4, h * 0.6); g.closePath(); g.fill();
        break;
      case 'home':
        g.beginPath(); g.moveTo(-h * 0.75, -h * 0.05); g.lineTo(0, -h * 0.72); g.lineTo(h * 0.75, -h * 0.05); g.stroke();
        rr(g, -h * 0.5, -h * 0.15, h, h * 0.8, h * 0.1); g.fill();
        break;
      case 'lock':
        rr(g, -h * 0.55, -h * 0.1, h * 1.1, h * 0.85, h * 0.18); g.fill();
        g.beginPath(); g.arc(0, -h * 0.15, h * 0.35, Math.PI, 0); g.stroke();
        break;
      case 'star':
        A.star(g, 0, 0, h * 0.9, true);
        break;
    }
    g.restore();
  };
  A.star = function (g, x, y, r, on, dim) {
    g.save(); g.translate(x, y + r * 0.12);
    star(g, r, 0.5, 5);
    g.fillStyle = on ? C.brassDeep : 'rgba(0,0,0,0.3)'; g.fill();
    g.translate(0, -r * 0.12);
    star(g, r, 0.5, 5);
    if (on) {
      var sg = g.createLinearGradient(0, -r, 0, r);
      sg.addColorStop(0, '#FFF1C2'); sg.addColorStop(0.5, C.brassHi); sg.addColorStop(1, C.brass);
      g.fillStyle = sg; g.fill();
      g.strokeStyle = C.brassDeep; g.lineWidth = Math.max(1, r * 0.08); g.lineJoin = 'round'; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.ellipse(-r * 0.18, -r * 0.3, r * 0.16, r * 0.09, -0.6, 0, Math.PI * 2); g.fill();
    } else { g.fillStyle = dim || 'rgba(242,230,201,0.18)'; g.fill(); }
    g.restore();
  };
  // four-point twinkle
  A.twinkle = function (g, x, y, r, alpha, col) {
    g.save(); g.globalAlpha *= alpha; g.translate(x, y);
    g.fillStyle = col || '#FFF6D8';
    g.beginPath();
    g.moveTo(0, -r); g.quadraticCurveTo(0, 0, r, 0); g.quadraticCurveTo(0, 0, 0, r); g.quadraticCurveTo(0, 0, -r, 0); g.quadraticCurveTo(0, 0, 0, -r);
    g.fill();
    g.restore();
  };

  // ------------------------------------------------------------------ background (cached by caller)
  A.background = function (g, W, H) {
    var m = Math.min(W, H);
    var bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1D3E35'); bg.addColorStop(0.55, C.shelf); bg.addColorStop(1, '#10251F');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // vertical wood panels with soft grain
    var pw = Math.max(70, m * 0.28), n = Math.ceil(W / pw) + 1, x0 = (W - (n - 1) * pw) / 2 - pw / 2;
    for (var i = 0; i < n; i++) {
      var x = x0 + i * pw;
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.05)';
      g.fillRect(x, 0, pw, H);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, 0, Math.max(1, m * 0.004), H);
      g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(x + Math.max(1, m * 0.004), 0, 1, H);
      g.strokeStyle = 'rgba(0,0,0,0.07)'; g.lineWidth = 1;
      for (var k = 0; k < 4; k++) {
        var gx = x + pw * (0.18 + k * 0.2 + A.hash(i * 9 + k) * 0.08);
        g.beginPath(); g.moveTo(gx, 0);
        for (var y = 0; y <= H; y += 40) g.lineTo(gx + Math.sin(y / (60 + k * 13) + i + k) * pw * 0.025, y);
        g.stroke();
      }
    }
    // vignette
    var vg = g.createRadialGradient(W / 2, H * 0.45, m * 0.3, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    // warm candlelight wash from the top
    var wg = g.createRadialGradient(W / 2, -H * 0.1, 0, W / 2, -H * 0.1, Math.max(W, H) * 0.7);
    wg.addColorStop(0, 'rgba(255,190,100,0.10)'); wg.addColorStop(1, 'rgba(255,190,100,0)');
    g.fillStyle = wg; g.fillRect(0, 0, W, H);
  };

  // A shelf plank from x0 to x1 whose top face is at y.
  A.plank = function (g, x0, x1, y, th) {
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x0 + th * 0.3, y + th * 1.25, x1 - x0, th * 0.6);
    g.fillStyle = C.plankTop; g.fillRect(x0, y - th * 0.15, x1 - x0, th * 0.45);
    g.fillStyle = C.plankFront; g.fillRect(x0, y + th * 0.3, x1 - x0, th);
    g.fillStyle = C.brassDeep; g.fillRect(x0, y + th * 0.3, x1 - x0, Math.max(1, th * 0.14));
    g.fillStyle = 'rgba(244,217,143,0.35)'; g.fillRect(x0, y + th * 0.3, x1 - x0, Math.max(1, th * 0.05));
    // brass brackets
    g.fillStyle = C.brass;
    var bw = th * 0.7;
    rr(g, x0 + th * 0.4, y + th * 0.3, bw, th * 1.2, th * 0.15); g.fill();
    rr(g, x1 - th * 0.4 - bw, y + th * 0.3, bw, th * 1.2, th * 0.15); g.fill();
    g.fillStyle = C.brassDeep;
    g.beginPath(); g.arc(x0 + th * 0.4 + bw / 2, y + th * 0.85, th * 0.14, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x1 - th * 0.4 - bw / 2, y + th * 0.85, th * 0.14, 0, Math.PI * 2); g.fill();
  };

  // Parchment panel with a brass frame.
  A.panel = function (g, x, y, w, h, r) {
    g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, x + 3, y + 6, w, h, r); g.fill();
    g.fillStyle = C.brassDeep; rr(g, x - 3, y - 3, w + 6, h + 6, r + 3); g.fill();
    g.fillStyle = C.brass; rr(g, x - 3, y - 4, w + 6, h + 5, r + 3); g.fill();
    var pg = g.createLinearGradient(0, y, 0, y + h);
    pg.addColorStop(0, '#F7EDD5'); pg.addColorStop(1, '#E9D9B2');
    g.fillStyle = pg; rr(g, x, y, w, h, r); g.fill();
    g.strokeStyle = 'rgba(94,76,53,0.25)'; g.lineWidth = 1.5;
    rr(g, x + 6, y + 6, w - 12, h - 12, Math.max(2, r - 4)); g.stroke();
  };
})();
