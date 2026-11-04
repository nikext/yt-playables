/* Kicks Lab: palette, riso print helpers (misregistration, halftone, grain), sticker glyphs,
   UI icons, client characters and the hype stamp. Everything is drawn in code. */
(function () {
  'use strict';
  var KL = window.KL = window.KL || {};
  var TAU = Math.PI * 2;

  var C = KL.C = {
    paper: '#FFF4E2', paperDeep: '#F7E6CB', pink: '#FF4F9A', blue: '#2F5BEA', sun: '#FFD23F', ink: '#26213A',
    inkSoft: '#5A5270', white: '#FFFDF8', mint: '#4FD6A8', orange: '#FF8B2C', violet: '#8A5CF0', teal: '#13A3A6',
    good: '#1F9E6A', bad: '#E5374A', shade: 'rgba(38,33,58,0.16)'
  };
  KL.FONT = 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
  KL.font = function (px, w) { return (w || '800') + ' ' + Math.max(1, Math.round(px)) + 'px ' + KL.FONT; };

  KL.rr = function (c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };
  KL.circle = function (c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); };

  // Sticker-like panel: an offset ink block, a flat fill and a thick ink outline.
  KL.panel = function (c, x, y, w, h, r, fill, shadow, off, lw) {
    off = off == null ? 4 : off;
    if (off) { c.fillStyle = shadow || C.ink; KL.rr(c, x + off, y + off, w, h, r); c.fill(); }
    c.fillStyle = fill; KL.rr(c, x, y, w, h, r); c.fill();
    if (lw !== 0) { c.lineWidth = lw || 3; c.strokeStyle = C.ink; c.stroke(); }
  };

  // Sets c.font to the largest size <= px that fits maxW. Returns the size.
  KL.fitFont = function (c, text, maxW, px, weight) {
    c.font = KL.font(px, weight);
    var w = c.measureText(text).width;
    if (w > maxW && w > 0) { px = Math.max(8, Math.floor(px * maxW / w)); c.font = KL.font(px, weight); }
    return px;
  };
  // Chunky type with a misregistered riso shadow in a second ink.
  KL.text = function (c, s, x, y, px, col, shadow, align, maxW, weight) {
    if (maxW) KL.fitFont(c, s, maxW, px, weight); else c.font = KL.font(px, weight);
    c.textAlign = align || 'center'; c.textBaseline = 'middle';
    if (shadow) { var o = Math.max(1.5, px * 0.07); c.fillStyle = shadow; c.fillText(s, x + o, y + o); }
    c.fillStyle = col; c.fillText(s, x, y);
  };

  // ---------- pre-rendered tiles ----------
  var tileCache = {};
  function mk(w, h) { var cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
  KL.canvas = mk;
  // Colored halftone dots (offset rows). Small and soft, never a high-contrast grid.
  KL.halftone = function (c, col, step, r, alpha) {
    var key = col + step + '_' + r + '_' + alpha;
    if (tileCache[key]) return tileCache[key];
    var s = step * 2, cv = mk(s, s), g = cv.getContext('2d');
    g.globalAlpha = alpha; g.fillStyle = col;
    [[0, 0], [step, step], [s, 0], [0, s], [s, s]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], r, 0, TAU); g.fill(); });
    return (tileCache[key] = c.createPattern(cv, 'repeat'));
  };
  // Grain: tiny specks of ink and paper, very low contrast.
  KL.grain = function (c) {
    if (tileCache.grain) return tileCache.grain;
    var s = 192, cv = mk(s, s), g = cv.getContext('2d'), r = KL.rng(77);
    for (var i = 0; i < 1500; i++) {
      var x = r() * s, y = r() * s, a = 0.025 + r() * 0.05;
      g.fillStyle = r() < 0.65 ? 'rgba(38,33,58,' + a + ')' : 'rgba(255,255,255,' + (a * 2.2) + ')';
      g.fillRect(x, y, 1 + (r() < 0.2 ? 1 : 0), 1 + (r() < 0.2 ? 1 : 0));
    }
    return (tileCache.grain = c.createPattern(cv, 'repeat'));
  };

  // ---------- sticker glyphs (original shapes) ----------
  // Builds the glyph path centered at 0,0 with radius ~r.
  function star(c, r) {
    c.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.5 : r;
      if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
  }
  function poly(c, r, pts) {
    c.beginPath();
    for (var i = 0; i < pts.length; i += 2) { var x = pts[i] * r, y = pts[i + 1] * r; if (!i) c.moveTo(x, y); else c.lineTo(x, y); }
    c.closePath();
  }
  KL.glyph = function (c, k, r) {
    if (k === 0) star(c, r);
    else if (k === 1) poly(c, r, [0.25, -1, -0.55, 0.12, -0.02, 0.12, -0.3, 1, 0.6, -0.22, 0.06, -0.22, 0.42, -1]);
    else if (k === 2) {
      c.beginPath();
      c.moveTo(-1 * r, 0.55 * r);
      c.bezierCurveTo(-0.95 * r, -0.4 * r, -0.2 * r, -0.95 * r, 0.45 * r, -0.62 * r);
      c.bezierCurveTo(0.95 * r, -0.35 * r, 0.75 * r, 0.28 * r, 0.28 * r, 0.12 * r);
      c.bezierCurveTo(0.05 * r, 0.02 * r, 0.2 * r, -0.3 * r, 0.42 * r, -0.2 * r);
      c.bezierCurveTo(0.1 * r, -0.5 * r, -0.4 * r, -0.2 * r, -0.2 * r, 0.3 * r);
      c.bezierCurveTo(-0.05 * r, 0.62 * r, 0.6 * r, 0.6 * r, 1 * r, 0.42 * r);
      c.lineTo(1 * r, 0.75 * r);
      c.lineTo(-1 * r, 0.75 * r);
      c.closePath();
    } else if (k === 3) {
      c.beginPath();
      c.moveTo(0, r);
      c.bezierCurveTo(-0.75 * r, r, -0.85 * r, 0.25 * r, -0.55 * r, -0.2 * r);
      c.bezierCurveTo(-0.45 * r, 0.05 * r, -0.3 * r, 0.1 * r, -0.22 * r, 0.05 * r);
      c.bezierCurveTo(-0.4 * r, -0.45 * r, -0.05 * r, -0.75 * r, 0.05 * r, -r);
      c.bezierCurveTo(0.15 * r, -0.6 * r, 0.45 * r, -0.5 * r, 0.42 * r, -0.12 * r);
      c.bezierCurveTo(0.55 * r, -0.2 * r, 0.62 * r, -0.35 * r, 0.6 * r, -0.45 * r);
      c.bezierCurveTo(0.95 * r, -0.05 * r, 0.85 * r, r, 0, r);
      c.closePath();
    } else if (k === 4) {
      c.beginPath();
      c.moveTo(-r, 0);
      c.quadraticCurveTo(0, -0.95 * r, r, 0);
      c.quadraticCurveTo(0, 0.95 * r, -r, 0);
      c.closePath();
    } else {
      c.beginPath();
      c.arc(0, 0, r * 0.92, 0, TAU);
    }
  };
  // Inner details (pupil, face) drawn after the glyph fill.
  KL.glyphDetail = function (c, k, r, col) {
    c.fillStyle = C.ink; c.strokeStyle = C.ink;
    if (k === 4) {
      KL.circle(c, 0, 0, r * 0.32); c.fill();
      KL.circle(c, r * 0.1, -r * 0.1, r * 0.1); c.fillStyle = C.white; c.fill();
    } else if (k === 5) {
      c.lineWidth = Math.max(1.5, r * 0.12); c.lineCap = 'round';
      c.beginPath(); c.moveTo(-r * 0.42, -r * 0.28); c.lineTo(-r * 0.18, -r * 0.12); c.lineTo(-r * 0.42, 0.02 * r); c.stroke();
      KL.circle(c, r * 0.3, -r * 0.14, r * 0.12); c.fill();
      c.beginPath(); c.arc(0, r * 0.12, r * 0.45, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    }
  };
  // A die-cut sticker: thick paper border, ink fill offset (misregistered), ink outline.
  KL.drawSticker = function (c, k, col, x, y, r, rot, lift) {
    c.save(); c.translate(x, y); if (rot) c.rotate(rot);
    var lw = Math.max(2, r * 0.1), reg = Math.max(1, r * 0.06);
    if (lift) { c.save(); c.translate(lift, lift); KL.glyph(c, k, r); c.lineJoin = 'round'; c.lineWidth = r * 0.34; c.strokeStyle = 'rgba(38,33,58,0.22)'; c.stroke(); c.fillStyle = 'rgba(38,33,58,0.22)'; c.fill(); c.restore(); }
    KL.glyph(c, k, r); c.lineJoin = 'round'; c.lineWidth = r * 0.34; c.strokeStyle = C.white; c.stroke(); c.fillStyle = C.white; c.fill();
    c.save(); c.translate(reg, reg); KL.glyph(c, k, r); c.fillStyle = col; c.fill(); c.restore();
    KL.glyph(c, k, r); c.lineWidth = lw; c.strokeStyle = C.ink; c.stroke();
    KL.glyphDetail(c, k, r, col);
    c.restore();
  };

  // ---------- icons (centered at x,y, size s) ----------
  function line(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); }
  KL.icon = function (c, name, x, y, s, col, fill) {
    col = col || C.ink;
    c.save(); c.translate(x, y); c.scale(s / 40, s / 40);
    c.lineWidth = 3.4; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = col; c.fillStyle = fill || col;
    switch (name) {
      case 'bucket':
        c.beginPath(); c.moveTo(-12, -6); c.lineTo(10, -6); c.lineTo(7, 14); c.lineTo(-9, 14); c.closePath();
        c.fillStyle = fill || C.sun; c.fill(); c.stroke();
        c.beginPath(); c.arc(-1, -6, 10, Math.PI, TAU); c.stroke();
        c.beginPath(); c.moveTo(10, -4); c.quadraticCurveTo(18, 0, 15, 10); c.stroke();
        KL.circle(c, 15, 14, 3); c.fillStyle = col; c.fill();
        break;
      case 'spray':
        KL.rr(c, -9, -6, 15, 22, 4); c.fillStyle = fill || C.pink; c.fill(); c.stroke();
        KL.rr(c, -5, -13, 7, 7, 2); c.stroke();
        c.fillStyle = col;
        [[9, -14], [13, -10], [9, -7], [15, -16], [16, -6]].forEach(function (p) { KL.circle(c, p[0], p[1], 1.8); c.fill(); });
        break;
      case 'sticker':
        KL.rr(c, -14, -14, 28, 28, 6); c.fillStyle = C.white; c.fill(); c.stroke();
        c.save(); c.scale(0.5, 0.5); star(c, 18); c.fillStyle = fill || C.sun; c.fill(); c.lineWidth = 5; c.stroke(); c.restore();
        c.beginPath(); c.moveTo(14, 4); c.lineTo(4, 14); c.lineTo(14, 14); c.closePath(); c.fillStyle = C.paperDeep; c.fill(); c.stroke();
        break;
      case 'laces':
        c.beginPath(); c.moveTo(-14, -10); c.lineTo(14, 10); c.moveTo(14, -10); c.lineTo(-14, 10); c.stroke();
        c.beginPath(); c.moveTo(-14, 0); c.lineTo(14, 0); c.stroke();
        [[-14, -10], [14, -10], [-14, 10], [14, 10], [-14, 0], [14, 0]].forEach(function (p) { KL.circle(c, p[0], p[1], 3.5); c.fillStyle = C.white; c.fill(); c.lineWidth = 2.4; c.stroke(); });
        break;
      case 'shoe':
        c.beginPath(); c.moveTo(-17, 8); c.lineTo(-16, -9); c.quadraticCurveTo(-8, -5, -4, -9); c.lineTo(4, 0); c.quadraticCurveTo(16, 2, 18, 8); c.closePath();
        c.fillStyle = fill || C.blue; c.fill(); c.stroke();
        c.beginPath(); c.moveTo(-18, 13); c.lineTo(18, 13); c.stroke();
        break;
      case 'undo':
        c.beginPath(); c.arc(2, 3, 11, -Math.PI * 0.85, Math.PI * 0.6); c.stroke();
        line(c, [-14, -10, -10, 1, -1, -6]); c.stroke();
        break;
      case 'check':
        line(c, [-12, 1, -4, 10, 13, -10]); c.lineWidth = 5.5; c.stroke();
        break;
      case 'cross':
        line(c, [-10, -10, 10, 10]); c.lineWidth = 5.5; c.stroke(); line(c, [10, -10, -10, 10]); c.stroke();
        break;
      case 'pause':
        KL.rr(c, -9, -11, 6, 22, 2); c.fill(); KL.rr(c, 3, -11, 6, 22, 2); c.fill();
        break;
      case 'sound': case 'mute':
        c.beginPath(); c.moveTo(-14, -5); c.lineTo(-7, -5); c.lineTo(1, -12); c.lineTo(1, 12); c.lineTo(-7, 5); c.lineTo(-14, 5); c.closePath(); c.fill();
        if (name === 'sound') { c.beginPath(); c.arc(3, 0, 8, -0.9, 0.9); c.stroke(); c.beginPath(); c.arc(3, 0, 14, -0.9, 0.9); c.stroke(); }
        else { line(c, [7, -6, 16, 6]); c.stroke(); line(c, [16, -6, 7, 6]); c.stroke(); }
        break;
      case 'play':
        c.beginPath(); c.moveTo(-8, -12); c.lineTo(12, 0); c.lineTo(-8, 12); c.closePath(); c.fill();
        break;
      case 'arrow':
        line(c, [-12, 0, 12, 0]); c.lineWidth = 4.5; c.stroke(); line(c, [3, -9, 12, 0, 3, 9]); c.stroke();
        break;
      case 'back':
        line(c, [12, 0, -12, 0]); c.lineWidth = 4.5; c.stroke(); line(c, [-3, -9, -12, 0, -3, 9]); c.stroke();
        break;
      case 'wall':
        KL.rr(c, -15, -12, 30, 24, 3); c.stroke();
        KL.rr(c, -9, -6, 18, 12, 2); c.fillStyle = fill || C.pink; c.fill();
        line(c, [-6, -12, 0, -18, 6, -12]); c.lineWidth = 2.4; c.stroke();
        break;
      case 'pin':
        KL.circle(c, 0, -6, 9); c.fillStyle = fill || C.pink; c.fill(); c.stroke();
        line(c, [0, 3, 0, 16]); c.stroke();
        KL.circle(c, -3, -9, 2.5); c.fillStyle = C.white; c.fill();
        break;
      case 'lock':
        KL.rr(c, -10, -3, 20, 16, 3); c.fill();
        c.beginPath(); c.arc(0, -5, 7, Math.PI, TAU); c.stroke();
        break;
      case 'cash':
        KL.rr(c, -16, -10, 32, 20, 4); c.fillStyle = fill || C.mint; c.fill(); c.stroke();
        KL.circle(c, 0, 0, 5.5); c.lineWidth = 2.6; c.stroke();
        break;
      case 'flame':
        c.save(); c.translate(0, 2); KL.glyph(c, 3, 15); c.fillStyle = fill || C.orange; c.fill(); c.lineWidth = 3; c.stroke(); c.restore();
        break;
      case 'harmony':
        KL.circle(c, -6, -4, 9); c.fillStyle = C.pink; c.fill(); c.lineWidth = 2.6; c.stroke();
        KL.circle(c, 6, -4, 9); c.fillStyle = 'rgba(47,91,234,0.8)'; c.fill(); c.stroke();
        KL.circle(c, 0, 6, 9); c.fillStyle = 'rgba(255,210,63,0.85)'; c.fill(); c.stroke();
        break;
      case 'clock':
        KL.circle(c, 0, 2, 14); c.fillStyle = C.white; c.fill(); c.stroke();
        line(c, [0, 2, 0, -6]); c.stroke(); line(c, [0, 2, 6, 6]); c.stroke();
        line(c, [-4, -16, 4, -16]); c.stroke();
        break;
      case 'booth':
        KL.rr(c, -14, -14, 28, 28, 4); c.fillStyle = C.white; c.fill(); c.stroke();
        c.save(); c.translate(0, 2); c.scale(0.6, 0.6); KL.icon(c, 'spray', 0, 0, 40, col, fill); c.restore();
        break;
      case 'window':
        KL.rr(c, -16, -13, 32, 26, 3); c.fillStyle = fill || C.sun; c.fill(); c.stroke();
        line(c, [0, -13, 0, 13]); c.stroke(); line(c, [-16, 0, 16, 0]); c.stroke();
        break;
      case 'shop':
        c.beginPath(); c.moveTo(-15, -4); c.lineTo(15, -4); c.lineTo(12, 14); c.lineTo(-12, 14); c.closePath(); c.fillStyle = fill || C.sun; c.fill(); c.stroke();
        c.beginPath(); c.arc(0, -4, 8, Math.PI, TAU); c.stroke();
        break;
      case 'keep':
        KL.rr(c, -10, -3, 20, 16, 3); c.fillStyle = fill || C.sun; c.fill(); c.stroke();
        c.beginPath(); c.arc(0, -5, 7, Math.PI, TAU); c.stroke();
        break;
      case 'remix':
        c.beginPath(); c.arc(0, 0, 11, -Math.PI * 0.2, Math.PI * 0.9); c.stroke();
        line(c, [-12, 11, -11, 2, -3, 6]); c.stroke();
        c.beginPath(); c.arc(0, 0, 11, Math.PI * 0.8, Math.PI * 1.9); c.stroke();
        line(c, [12, -11, 11, -2, 3, -6]); c.stroke();
        break;
      case 'tier':
        star(c, 15); c.fillStyle = fill || C.sun; c.fill(); c.stroke();
        break;
    }
    c.restore();
  };

  // Vibe badges: small round prints that read without words.
  KL.vibeIcon = function (c, v, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s / 40, s / 40);
    c.lineWidth = 3; c.strokeStyle = C.ink; c.lineJoin = 'round'; c.lineCap = 'round';
    KL.circle(c, 0, 0, 18); c.save(); c.clip();
    if (v === 0) { // retro: sunset bands
      c.fillStyle = '#FFD23F'; c.fillRect(-20, -20, 40, 40);
      c.fillStyle = '#FF8B2C'; c.fillRect(-20, 0, 40, 6);
      c.fillStyle = '#FF5148'; c.fillRect(-20, 8, 40, 5);
      c.fillStyle = '#13A3A6'; c.fillRect(-20, 15, 40, 6);
    } else if (v === 1) { // night: moon + star
      c.fillStyle = '#1E2D6E'; c.fillRect(-20, -20, 40, 40);
      KL.circle(c, -2, -1, 10); c.fillStyle = '#FFD23F'; c.fill();
      KL.circle(c, 4, -5, 9); c.fillStyle = '#1E2D6E'; c.fill();
      c.save(); c.translate(9, 8); star(c, 4.5); c.fillStyle = '#FF4F9A'; c.fill(); c.restore();
    } else if (v === 2) { // beach: sun over water
      c.fillStyle = '#6EC9FF'; c.fillRect(-20, -20, 40, 40);
      KL.circle(c, 0, 0, 8); c.fillStyle = '#FFD23F'; c.fill();
      c.fillStyle = '#13A3A6'; c.beginPath(); c.moveTo(-20, 6);
      for (var i = -20; i <= 20; i += 8) c.quadraticCurveTo(i + 2, 2, i + 4, 6), c.quadraticCurveTo(i + 6, 10, i + 8, 6);
      c.lineTo(20, 20); c.lineTo(-20, 20); c.closePath(); c.fill();
    } else if (v === 3) { // forest: pine
      c.fillStyle = '#C4E33A'; c.fillRect(-20, -20, 40, 40);
      c.fillStyle = '#2FAE5B'; c.beginPath(); c.moveTo(0, -14); c.lineTo(11, 4); c.lineTo(-11, 4); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(0, -6); c.lineTo(13, 12); c.lineTo(-13, 12); c.closePath(); c.fill();
      c.fillStyle = '#9C5A3A'; c.fillRect(-2.5, 12, 5, 8);
    } else if (v === 4) { // candy: swirl
      c.fillStyle = '#FF9CCB'; c.fillRect(-20, -20, 40, 40);
      c.strokeStyle = '#FFFDF8'; c.lineWidth = 4.5; c.beginPath();
      for (var a = 0; a < 14; a += 0.3) { var rr = a * 1.25; if (!a) c.moveTo(0, 0); else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      c.stroke(); c.strokeStyle = C.ink;
    } else { // mono: split
      c.fillStyle = '#A6A3B8'; c.fillRect(-20, -20, 40, 40);
      c.fillStyle = C.ink; c.beginPath(); c.moveTo(-20, 20); c.lineTo(20, -20); c.lineTo(20, 20); c.closePath(); c.fill();
      KL.circle(c, -6, -6, 5); c.fillStyle = '#FFF8EC'; c.fill();
    }
    c.restore();
    c.lineWidth = 3; KL.circle(c, 0, 0, 18); c.stroke();
    c.restore();
  };

  // ---------- tutorial hand ----------
  KL.drawHand = function (c, x, y, s, press) {
    c.save(); c.translate(x, y); c.scale(s / 60, s / 60); c.rotate(-0.35);
    if (press) c.scale(0.92, 0.92);
    c.lineJoin = 'round'; c.lineWidth = 4; c.strokeStyle = C.ink;
    c.beginPath();
    c.moveTo(-6, 0); c.lineTo(-6, 26);
    c.quadraticCurveTo(-18, 18, -22, 26); c.quadraticCurveTo(-22, 32, -10, 44);
    c.quadraticCurveTo(0, 58, 16, 58); c.quadraticCurveTo(30, 56, 30, 40);
    c.lineTo(30, 26); c.quadraticCurveTo(30, 18, 22, 19); c.quadraticCurveTo(20, 14, 13, 15);
    c.quadraticCurveTo(10, 10, 4, 12); c.lineTo(4, 0); c.quadraticCurveTo(-1, -8, -6, 0);
    c.closePath();
    c.fillStyle = C.ink; c.save(); c.translate(3, 3); c.fill(); c.restore();
    c.fillStyle = C.white; c.fill(); c.stroke();
    c.restore();
  };

  // ---------- hype stamp ----------
  KL.drawStamp = function (c, x, y, r, stars, label, col) {
    c.save(); c.translate(x, y);
    c.globalAlpha = 0.95;
    c.lineWidth = r * 0.09; c.strokeStyle = col;
    KL.circle(c, 0, 0, r); c.stroke();
    c.lineWidth = r * 0.03; KL.circle(c, 0, 0, r * 0.8); c.stroke();
    c.fillStyle = col;
    c.font = KL.font(r * 0.24, '900'); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(label, 0, -r * 0.48);
    c.font = KL.font(r * 0.62, '900'); c.fillText(String(stars), 0, r * 0.04);
    // flame row
    for (var i = 0; i < 5; i++) {
      var fx = (i - 2) * r * 0.25, fy = r * 0.52;
      c.save(); c.translate(fx, fy); KL.glyph(c, 3, r * 0.1);
      if (i < stars) { c.fillStyle = col; c.fill(); } else { c.lineWidth = r * 0.025; c.stroke(); }
      c.restore();
    }
    // worn ink: knock out a few specks
    c.globalCompositeOperation = 'destination-out';
    var rg = KL.rng(stars * 31 + 7);
    for (i = 0; i < 26; i++) { KL.circle(c, (rg() * 2 - 1) * r, (rg() * 2 - 1) * r, r * (0.01 + rg() * 0.025)); c.fill(); }
    c.restore();
  };

  // ---------- clients ----------
  var SKIN = ['#F7D5B5', '#E9B48A', '#C98E62', '#A86B45', '#7C4B2E', '#5B3522'];
  var HAIR = ['#26213A', '#5A3424', '#9C5A3A', '#D9971A', '#FF4F9A', '#2F5BEA', '#8A5CF0', '#A6A3B8'];
  var HOOD = ['#2F5BEA', '#FF4F9A', '#FFD23F', '#13A3A6', '#8A5CF0', '#FF8B2C', '#2FAE5B', '#26213A', '#A6A3B8', '#4FD6A8'];
  KL.makeClient = function (seed) {
    var r = KL.rng(seed);
    function p(n) { return Math.floor(r() * n); }
    var c = { skin: SKIN[p(6)], hair: HAIR[p(HAIR.length)], hairStyle: p(6), hat: p(5), glasses: p(4), hood: HOOD[p(HOOD.length)], hat2: HOOD[p(HOOD.length)], earring: r() < 0.35, chain: r() < 0.3, hoodUp: false, bg: p(4) };
    if (c.hat === 4) { c.hat = 0; c.hoodUp = true; }
    if (c.hat2 === c.hood) c.hat2 = C.sun;
    return c;
  };
  function ell(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); }
  // Draws a stylish abstract bust in a 200x220 box. mood: 0 neutral, 1 happy, 2 meh, 3 thrilled.
  KL.drawClient = function (c, k, mood) {
    var reg = 3.5;
    c.save();
    c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = C.ink;
    function shape(build, fill, lw) {
      c.save(); c.translate(reg, reg * 0.6); build(); c.fillStyle = fill; c.fill(); c.restore();
      build(); c.lineWidth = lw || 4; c.stroke();
    }
    // hood behind / hood up
    if (k.hoodUp) shape(function () { ell(c, 100, 96, 56, 62); }, k.hood);
    // long hair behind
    if (k.hairStyle === 2 && !k.hoodUp) shape(function () { KL.rr(c, 56, 62, 88, 104, 34); }, k.hair);
    if (k.hairStyle === 1 && !k.hoodUp && k.hat === 0) shape(function () { ell(c, 100, 66, 50, 44); }, k.hair);
    // torso
    shape(function () {
      c.beginPath(); c.moveTo(22, 224); c.bezierCurveTo(22, 172, 52, 150, 100, 150); c.bezierCurveTo(148, 150, 178, 172, 178, 224); c.closePath();
    }, k.hood);
    // halftone shade on the torso
    c.save(); c.beginPath(); c.moveTo(22, 224); c.bezierCurveTo(22, 172, 52, 150, 100, 150); c.bezierCurveTo(148, 150, 178, 172, 178, 224); c.closePath(); c.clip();
    c.fillStyle = KL.halftone(c, C.ink, 7, 1.6, 0.35); c.fillRect(120, 150, 70, 80); c.restore();
    // hood collar
    shape(function () { ell(c, 100, 154, 40, 15); }, k.hoodUp ? k.hood : shadeOf(k.hood));
    // neck + head
    shape(function () { KL.rr(c, 87, 116, 26, 40, 8); }, k.skin, 3.5);
    shape(function () { ell(c, 100, 92, 34, 39); }, k.skin);
    // ears
    shape(function () { ell(c, 66, 96, 7, 10); }, k.skin, 3);
    shape(function () { ell(c, 134, 96, 7, 10); }, k.skin, 3);
    if (k.earring) { KL.circle(c, 134, 110, 4); c.lineWidth = 2.5; c.strokeStyle = '#D9971A'; c.stroke(); c.strokeStyle = C.ink; }
    // hair on top
    if (!k.hoodUp && k.hat === 0) {
      var hs = k.hairStyle;
      if (hs === 0) shape(function () { c.beginPath(); c.ellipse(100, 82, 36, 33, 0, Math.PI * 1.02, Math.PI * 1.98); c.closePath(); }, k.hair, 3.5);
      else if (hs === 3) {
        shape(function () { ell(c, 100, 44, 15, 13); }, k.hair, 3.5);
        shape(function () { c.beginPath(); c.ellipse(100, 84, 36, 36, 0, Math.PI * 1.0, Math.PI * 2.0); c.closePath(); }, k.hair, 3.5);
      } else if (hs === 4) {
        shape(function () { c.beginPath(); for (var i = 0; i < 6; i++) { c.moveTo(70 + i * 12 + 11, 60); c.arc(70 + i * 12, 60 + Math.abs(2.5 - i) * 3, 11, 0, TAU); } }, k.hair, 3);
      } else if (hs === 5) {
        shape(function () { c.beginPath(); c.moveTo(64, 92); c.bezierCurveTo(60, 50, 120, 38, 138, 70); c.bezierCurveTo(120, 64, 96, 66, 80, 78); c.quadraticCurveTo(70, 84, 64, 92); c.closePath(); }, k.hair, 3.5);
      } else {
        shape(function () { c.beginPath(); c.ellipse(100, 80, 37, 30, 0, Math.PI, TAU); c.quadraticCurveTo(110, 76, 100, 66); c.quadraticCurveTo(84, 78, 63, 80); c.closePath(); }, k.hair, 3.5);
      }
    }
    // hats
    if (k.hat === 1) { // beanie
      shape(function () { c.beginPath(); c.ellipse(100, 76, 38, 34, 0, Math.PI, TAU); c.closePath(); }, k.hat2, 3.5);
      shape(function () { KL.rr(c, 60, 66, 80, 16, 6); }, shadeOf(k.hat2), 3.5);
    } else if (k.hat === 2) { // cap, brim to the side
      shape(function () { c.beginPath(); c.ellipse(100, 76, 37, 32, 0, Math.PI, TAU); c.closePath(); }, k.hat2, 3.5);
      shape(function () { c.beginPath(); c.moveTo(118, 70); c.quadraticCurveTo(160, 64, 168, 76); c.quadraticCurveTo(150, 82, 118, 78); c.closePath(); }, shadeOf(k.hat2), 3.5);
      KL.circle(c, 100, 44, 3.5); c.fillStyle = C.ink; c.fill();
    } else if (k.hat === 3) { // bucket
      shape(function () { c.beginPath(); c.moveTo(70, 70); c.quadraticCurveTo(72, 38, 100, 38); c.quadraticCurveTo(128, 38, 130, 70); c.closePath(); }, k.hat2, 3.5);
      shape(function () { c.beginPath(); c.moveTo(56, 80); c.lineTo(72, 66); c.lineTo(128, 66); c.lineTo(144, 80); c.closePath(); }, shadeOf(k.hat2), 3.5);
    }
    if (k.hoodUp) { c.lineWidth = 4; c.beginPath(); c.ellipse(100, 92, 42, 47, 0, Math.PI * 1.08, Math.PI * 1.92); c.stroke(); }
    // face
    c.fillStyle = C.ink; c.strokeStyle = C.ink;
    var ey = 96;
    if (k.glasses >= 2) {
      // shades
      c.save(); c.translate(1.5, 1); KL.rr(c, 74, ey - 9, 22, 15, 6); c.fillStyle = C.blue; c.fill(); KL.rr(c, 104, ey - 9, 22, 15, 6); c.fill(); c.restore();
      KL.rr(c, 74, ey - 9, 22, 15, 6); c.fillStyle = C.ink; c.fill(); KL.rr(c, 104, ey - 9, 22, 15, 6); c.fill();
      c.lineWidth = 3; c.beginPath(); c.moveTo(96, ey - 4); c.lineTo(104, ey - 4); c.stroke();
      c.strokeStyle = 'rgba(255,253,248,0.7)'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(78, ey - 4); c.lineTo(84, ey - 7); c.moveTo(108, ey - 4); c.lineTo(114, ey - 7); c.stroke(); c.strokeStyle = C.ink;
    } else {
      if (mood === 3) { c.lineWidth = 3; c.beginPath(); c.arc(86, ey + 2, 5, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.beginPath(); c.arc(114, ey + 2, 5, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
      else { KL.circle(c, 86, ey, 3.6); c.fill(); KL.circle(c, 114, ey, 3.6); c.fill(); }
      c.lineWidth = 3;
      var bt = mood === 2 ? 3 : mood === 3 ? -3 : 0;
      c.beginPath(); c.moveTo(79, ey - 11 + bt); c.lineTo(92, ey - 12 - bt); c.moveTo(108, ey - 12 - bt); c.lineTo(121, ey - 11 + bt); c.stroke();
      if (k.glasses === 1) { c.lineWidth = 2.6; KL.circle(c, 86, ey, 10); c.stroke(); KL.circle(c, 114, ey, 10); c.stroke(); c.beginPath(); c.moveTo(96, ey - 1); c.lineTo(104, ey - 1); c.stroke(); }
    }
    // blush
    c.fillStyle = 'rgba(255,79,154,0.28)'; ell(c, 78, 110, 7, 4); c.fill(); ell(c, 122, 110, 7, 4); c.fill();
    // mouth
    c.strokeStyle = C.ink; c.lineWidth = 3.2;
    if (mood === 1) { c.beginPath(); c.arc(100, 110, 9, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
    else if (mood === 3) { c.beginPath(); c.moveTo(89, 112); c.quadraticCurveTo(100, 128, 111, 112); c.closePath(); c.fillStyle = C.ink; c.fill(); }
    else if (mood === 2) { c.beginPath(); c.moveTo(92, 118); c.quadraticCurveTo(100, 112, 108, 118); c.stroke(); }
    else { c.beginPath(); c.moveTo(93, 116); c.lineTo(107, 115); c.stroke(); }
    // hoodie strings / chain
    c.strokeStyle = C.white; c.lineWidth = 3;
    c.beginPath(); c.moveTo(90, 160); c.lineTo(88, 186); c.moveTo(110, 160); c.lineTo(112, 186); c.stroke();
    if (k.chain) { c.strokeStyle = '#D9971A'; c.lineWidth = 3; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(80, 152); c.quadraticCurveTo(100, 182, 120, 152); c.stroke(); c.setLineDash([]); }
    c.restore();
  };
  function shadeOf(hex) {
    var c = KL.hexRgb(hex);
    return 'rgb(' + Math.round(c[0] * 0.78) + ',' + Math.round(c[1] * 0.78) + ',' + Math.round(c[2] * 0.82) + ')';
  }
  KL.shadeOf = shadeOf;
})();
