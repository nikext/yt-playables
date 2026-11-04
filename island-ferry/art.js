/* Island Ferry: palette, seeded RNG and all code-drawn art (icons, islands, boats, sea). */
(function () {
  'use strict';
  var IF = window.IF = window.IF || {};

  var C = IF.C = {
    bg: '#FFF7EE', ink: '#3D3B54', inkSoft: '#8A87A6', peach: '#FFB4A2', pink: '#F7A1C4',
    lavender: '#B9A7F5', mint: '#9EE0C5', sky: '#A7D3F5', butter: '#FFE39A', coral: '#FF8C7A',
    sea: '#A9D6F2', seaDeep: '#97C9EC', seaLine: '#D2ECFB', shallow: 'rgba(255,255,255,0.32)',
    sand: '#FBE6BD', sandDark: '#E9CC97', grass: '#BCE7B2', grassDark: '#8FCF9D',
    white: '#FFFFFF', shadow: 'rgba(61,59,84,0.16)', coralDark: '#E86F5E', mintDark: '#6FC6A5'
  };
  IF.FONT = 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
  IF.font = function (px, w) { return (w || '700') + ' ' + Math.max(1, Math.round(px)) + 'px ' + IF.FONT; };

  // Goods: fruit, fish, wood, cloth, pottery, tea.
  IF.GOODS = [
    { col: '#F7A1C4', dark: '#E0668F' },
    { col: '#A7D3F5', dark: '#4F9AD6' },
    { col: '#F2CF9B', dark: '#B9864F' },
    { col: '#C9BAF8', dark: '#7F69D8' },
    { col: '#FFB4A2', dark: '#DE7357' },
    { col: '#A9E6CC', dark: '#3FA57F' }
  ];

  IF.rng = function (a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  var TAU = Math.PI * 2;

  IF.rr = function (c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };

  // Flat panel with an offset "block" shadow.
  IF.panel = function (c, x, y, w, h, r, fill, shade, off) {
    off = off == null ? Math.max(3, h * 0.07) : off;
    c.fillStyle = shade || C.shadow;
    IF.rr(c, x, y + off, w, h, r); c.fill();
    c.fillStyle = fill;
    IF.rr(c, x, y, w, h, r); c.fill();
  };

  IF.circle = function (c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); };

  // Sets c.font to the biggest size <= px that fits maxW; returns the size.
  IF.fitFont = function (c, text, maxW, px, weight) {
    var p = px;
    c.font = IF.font(p, weight);
    var w = c.measureText(text).width;
    if (w > maxW && w > 0) {
      p = Math.max(8, Math.floor(p * maxW / w));
      c.font = IF.font(p, weight);
    }
    return p;
  };

  // ---------- rich text: words, with {g} replaced by a goods icon ----------
  function wordWidth(c, w, iw) {
    var parts = w.split('{g}'), s = 0;
    for (var i = 0; i < parts.length; i++) s += parts[i] ? c.measureText(parts[i]).width : 0;
    return s + (parts.length - 1) * iw;
  }
  IF.richLayout = function (c, str, maxW, px, weight) {
    c.font = IF.font(px, weight);
    var iw = px * 1.25, sp = c.measureText(' ').width;
    var words = str.split(' '), lines = [], cur = '', curW = 0, widest = 0;
    for (var i = 0; i < words.length; i++) {
      var ww = wordWidth(c, words[i], iw);
      if (cur && curW + sp + ww > maxW) {
        lines.push({ s: cur, w: curW }); widest = Math.max(widest, curW);
        cur = words[i]; curW = ww;
      } else {
        curW = cur ? curW + sp + ww : ww;
        cur = cur ? cur + ' ' + words[i] : words[i];
      }
    }
    if (cur) { lines.push({ s: cur, w: curW }); widest = Math.max(widest, curW); }
    return { lines: lines, w: widest, lh: px * 1.3, px: px, iw: iw, weight: weight };
  };
  IF.richDraw = function (c, lay, cx, top, good, col, left) {
    c.font = IF.font(lay.px, lay.weight);
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillStyle = col;
    for (var i = 0; i < lay.lines.length; i++) {
      var ln = lay.lines[i], x = left ? cx : cx - ln.w / 2, y = top + lay.lh * (i + 0.5);
      var parts = ln.s.split('{g}');
      for (var k = 0; k < parts.length; k++) {
        if (parts[k]) { c.fillStyle = col; c.fillText(parts[k], x, y); x += c.measureText(parts[k]).width; }
        if (k < parts.length - 1) {
          IF.drawGood(c, good, x + lay.iw / 2, y, lay.px * 0.58);
          x += lay.iw;
          c.font = IF.font(lay.px, lay.weight);
        }
      }
    }
  };

  // ---------- small icons ----------
  IF.drawGood = function (c, g, x, y, r) {
    var G = IF.GOODS[g] || IF.GOODS[0];
    c.save();
    IF.circle(c, x, y, r); c.fillStyle = G.col; c.fill();
    c.lineWidth = Math.max(1, r * 0.12); c.strokeStyle = C.ink; c.stroke();
    c.lineJoin = 'round'; c.lineCap = 'round';
    var lw = Math.max(0.8, r * 0.08);
    c.lineWidth = lw;
    c.fillStyle = G.dark;
    if (g === 0) { // fruit
      c.beginPath();
      c.moveTo(x, y - r * 0.24);
      c.bezierCurveTo(x - r * 0.62, y - r * 0.5, x - r * 0.6, y + r * 0.42, x - r * 0.12, y + r * 0.5);
      c.quadraticCurveTo(x, y + r * 0.44, x + r * 0.12, y + r * 0.5);
      c.bezierCurveTo(x + r * 0.6, y + r * 0.42, x + r * 0.62, y - r * 0.5, x, y - r * 0.24);
      c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x, y - r * 0.24); c.quadraticCurveTo(x + r * 0.02, y - r * 0.46, x + r * 0.1, y - r * 0.58); c.stroke();
      c.fillStyle = '#7BCB8F';
      c.beginPath(); c.ellipse(x + r * 0.28, y - r * 0.46, r * 0.2, r * 0.1, -0.5, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.8)'; IF.circle(c, x - r * 0.2, y - r * 0.02, r * 0.09); c.fill();
    } else if (g === 1) { // fish
      c.beginPath();
      c.moveTo(x + r * 0.22, y);
      c.lineTo(x + r * 0.6, y - r * 0.28); c.lineTo(x + r * 0.56, y + r * 0.28); c.closePath();
      c.fill(); c.stroke();
      c.beginPath(); c.ellipse(x - r * 0.1, y, r * 0.44, r * 0.27, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#fff'; IF.circle(c, x - r * 0.3, y - r * 0.05, r * 0.09); c.fill();
      c.fillStyle = C.ink; IF.circle(c, x - r * 0.3, y - r * 0.05, r * 0.04); c.fill();
    } else if (g === 2) { // wood logs
      var pts = [-0.22, 0.17, 0.22, 0.17, 0, -0.2];
      for (var i = 0; i < 6; i += 2) {
        IF.circle(c, x + r * pts[i], y + r * pts[i + 1], r * 0.22); c.fillStyle = '#F7DDB2'; c.fill(); c.stroke();
        IF.circle(c, x + r * pts[i], y + r * pts[i + 1], r * 0.09); c.strokeStyle = G.dark; c.stroke(); c.strokeStyle = C.ink;
      }
    } else if (g === 3) { // cloth bolt
      IF.rr(c, x - r * 0.46, y - r * 0.3, r * 0.92, r * 0.6, r * 0.14); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = lw * 1.4;
      c.beginPath(); c.moveTo(x - r * 0.38, y - r * 0.02);
      c.quadraticCurveTo(x - r * 0.18, y - r * 0.2, x, y - r * 0.02);
      c.quadraticCurveTo(x + r * 0.18, y + r * 0.16, x + r * 0.38, y - r * 0.02); c.stroke();
    } else if (g === 4) { // pottery
      c.beginPath();
      c.moveTo(x - r * 0.14, y - r * 0.48); c.lineTo(x + r * 0.14, y - r * 0.48);
      c.quadraticCurveTo(x + r * 0.1, y - r * 0.32, x + r * 0.2, y - r * 0.24);
      c.quadraticCurveTo(x + r * 0.5, y + r * 0.05, x + r * 0.18, y + r * 0.48);
      c.lineTo(x - r * 0.18, y + r * 0.48);
      c.quadraticCurveTo(x - r * 0.5, y + r * 0.05, x - r * 0.2, y - r * 0.24);
      c.quadraticCurveTo(x - r * 0.1, y - r * 0.32, x - r * 0.14, y - r * 0.48);
      c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = lw * 1.3;
      c.beginPath(); c.moveTo(x - r * 0.3, y + r * 0.04); c.lineTo(x + r * 0.3, y + r * 0.04); c.stroke();
    } else { // tea leaf
      c.beginPath();
      c.moveTo(x - r * 0.42, y + r * 0.4);
      c.quadraticCurveTo(x - r * 0.48, y - r * 0.36, x + r * 0.44, y - r * 0.42);
      c.quadraticCurveTo(x + r * 0.4, y + r * 0.36, x - r * 0.42, y + r * 0.4);
      c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.beginPath(); c.moveTo(x - r * 0.3, y + r * 0.28); c.quadraticCurveTo(x, y, x + r * 0.32, y - r * 0.3); c.stroke();
    }
    c.restore();
  };

  IF.heartPath = function (c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y + s * 0.42);
    c.bezierCurveTo(x - s * 0.62, y - s * 0.02, x - s * 0.5, y - s * 0.52, x, y - s * 0.24);
    c.bezierCurveTo(x + s * 0.5, y - s * 0.52, x + s * 0.62, y - s * 0.02, x, y + s * 0.42);
    c.closePath();
  };
  IF.drawHeart = function (c, x, y, s, full) {
    IF.heartPath(c, x, y, s);
    c.fillStyle = full ? C.coral : 'rgba(61,59,84,0.10)'; c.fill();
    c.lineWidth = Math.max(1, s * 0.09); c.strokeStyle = full ? C.ink : 'rgba(61,59,84,0.35)'; c.lineJoin = 'round'; c.stroke();
    if (full) { c.fillStyle = 'rgba(255,255,255,0.7)'; IF.circle(c, x - s * 0.2, y - s * 0.12, s * 0.07); c.fill(); }
  };
  IF.drawCoin = function (c, x, y, r) {
    IF.circle(c, x, y, r); c.fillStyle = '#FFD772'; c.fill();
    c.lineWidth = Math.max(1, r * 0.16); c.strokeStyle = C.ink; c.stroke();
    IF.circle(c, x, y, r * 0.55); c.lineWidth = Math.max(0.8, r * 0.1); c.strokeStyle = '#D9A93A'; c.stroke();
  };
  IF.drawCrate = function (c, x, y, s, col) {
    c.save();
    c.lineJoin = 'round';
    IF.rr(c, x - s / 2, y - s / 2, s, s, s * 0.16); c.fillStyle = col || '#F2CF9B'; c.fill();
    c.lineWidth = Math.max(1, s * 0.09); c.strokeStyle = C.ink; c.stroke();
    c.beginPath(); c.moveTo(x - s * 0.3, y - s * 0.3); c.lineTo(x + s * 0.3, y + s * 0.3);
    c.moveTo(x + s * 0.3, y - s * 0.3); c.lineTo(x - s * 0.3, y + s * 0.3);
    c.lineWidth = Math.max(0.8, s * 0.07); c.strokeStyle = 'rgba(61,59,84,0.45)'; c.stroke();
    c.restore();
  };
  IF.drawSun = function (c, x, y, r, rot, col) {
    c.save(); c.translate(x, y); c.rotate(rot || 0);
    c.strokeStyle = col || '#FFC75A'; c.lineCap = 'round'; c.lineWidth = Math.max(1.5, r * 0.18);
    c.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = i * TAU / 8;
      c.moveTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35);
      c.lineTo(Math.cos(a) * r * 1.7, Math.sin(a) * r * 1.7);
    }
    c.stroke();
    IF.circle(c, 0, 0, r); c.fillStyle = col || '#FFD772'; c.fill();
    c.lineWidth = Math.max(1, r * 0.12); c.strokeStyle = C.ink; c.stroke();
    c.restore();
  };
  IF.drawSpeaker = function (c, x, y, s, on) {
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    c.fillStyle = C.ink; c.strokeStyle = C.ink; c.lineWidth = Math.max(1.5, s * 0.1);
    c.beginPath();
    c.moveTo(x - s * 0.45, y - s * 0.16); c.lineTo(x - s * 0.22, y - s * 0.16); c.lineTo(x + s * 0.05, y - s * 0.4);
    c.lineTo(x + s * 0.05, y + s * 0.4); c.lineTo(x - s * 0.22, y + s * 0.16); c.lineTo(x - s * 0.45, y + s * 0.16);
    c.closePath(); c.fill();
    c.beginPath();
    if (on) {
      c.arc(x + s * 0.12, y, s * 0.22, -0.9, 0.9);
      c.moveTo(x + s * 0.12 + Math.cos(-0.9) * s * 0.42, y + Math.sin(-0.9) * s * 0.42);
      c.arc(x + s * 0.12, y, s * 0.42, -0.9, 0.9);
    } else {
      c.moveTo(x + s * 0.18, y - s * 0.18); c.lineTo(x + s * 0.48, y + s * 0.18);
      c.moveTo(x + s * 0.48, y - s * 0.18); c.lineTo(x + s * 0.18, y + s * 0.18);
    }
    c.stroke(); c.restore();
  };
  IF.drawPauseIcon = function (c, x, y, s) {
    c.fillStyle = C.ink;
    IF.rr(c, x - s * 0.32, y - s * 0.36, s * 0.22, s * 0.72, s * 0.08); c.fill();
    IF.rr(c, x + s * 0.1, y - s * 0.36, s * 0.22, s * 0.72, s * 0.08); c.fill();
  };
  IF.drawPlayIcon = function (c, x, y, s, col) {
    c.fillStyle = col || C.ink; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x - s * 0.3, y - s * 0.4); c.lineTo(x + s * 0.42, y); c.lineTo(x - s * 0.3, y + s * 0.4); c.closePath();
    c.strokeStyle = col || C.ink; c.lineWidth = s * 0.12; c.stroke(); c.fill();
  };
  IF.drawTrash = function (c, x, y, s, col) {
    c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = Math.max(1.5, s * 0.11); c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x - s * 0.42, y - s * 0.28); c.lineTo(x + s * 0.42, y - s * 0.28); c.stroke();
    c.beginPath(); c.moveTo(x - s * 0.14, y - s * 0.3); c.lineTo(x - s * 0.1, y - s * 0.44); c.lineTo(x + s * 0.1, y - s * 0.44); c.lineTo(x + s * 0.14, y - s * 0.3); c.stroke();
    c.beginPath(); c.moveTo(x - s * 0.32, y - s * 0.18); c.lineTo(x - s * 0.24, y + s * 0.44); c.lineTo(x + s * 0.24, y + s * 0.44); c.lineTo(x + s * 0.32, y - s * 0.18); c.closePath(); c.stroke();
    c.restore();
  };
  IF.drawX = function (c, x, y, s, col) {
    c.strokeStyle = col; c.lineWidth = Math.max(2, s * 0.14); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - s * 0.3, y - s * 0.3); c.lineTo(x + s * 0.3, y + s * 0.3);
    c.moveTo(x + s * 0.3, y - s * 0.3); c.lineTo(x - s * 0.3, y + s * 0.3); c.stroke();
  };

  // Top-down ferry. L = length in px, ang = heading (radians).
  IF.drawBoat = function (c, x, y, ang, L, col, cargo, n) {
    var w = L * 0.46;
    c.save(); c.translate(x, y); c.rotate(ang);
    c.lineJoin = 'round';
    c.fillStyle = 'rgba(61,59,84,0.18)';
    c.beginPath(); c.ellipse(-L * 0.02, w * 0.16, L * 0.52, w * 0.52, 0, 0, TAU); c.fill();
    c.beginPath();
    c.moveTo(L * 0.52, 0);
    c.quadraticCurveTo(L * 0.34, -w * 0.5, L * 0.04, -w * 0.5);
    c.lineTo(-L * 0.42, -w * 0.5);
    c.quadraticCurveTo(-L * 0.5, -w * 0.5, -L * 0.5, -w * 0.38);
    c.lineTo(-L * 0.5, w * 0.38);
    c.quadraticCurveTo(-L * 0.5, w * 0.5, -L * 0.42, w * 0.5);
    c.lineTo(L * 0.04, w * 0.5);
    c.quadraticCurveTo(L * 0.34, w * 0.5, L * 0.52, 0);
    c.closePath();
    c.fillStyle = '#fff'; c.fill();
    c.lineWidth = Math.max(1, L * 0.055); c.strokeStyle = C.ink; c.stroke();
    IF.rr(c, -L * 0.42, -w * 0.32, L * 0.34, w * 0.64, w * 0.14);
    c.fillStyle = col; c.fill(); c.stroke();
    if (n) {
      var cs = w * 0.36;
      for (var i = 0; i < n; i++) {
        var gx = L * 0.06 + Math.floor(i / 2) * cs * 1.1, gy = (n - i === 1 && i % 2 === 0) ? 0 : (i % 2 ? cs * 0.55 : -cs * 0.55);
        if (gx > L * 0.36) gx = L * 0.36;
        var G = IF.GOODS[cargo[i].good];
        IF.rr(c, gx - cs / 2, gy - cs / 2, cs, cs, cs * 0.2);
        c.fillStyle = G.dark; c.fill(); c.lineWidth = Math.max(0.8, L * 0.04); c.stroke();
      }
    }
    c.restore();
  };

  // A cartoon pointing hand; fingertip at (x, y).
  IF.drawHand = function (c, x, y, s, press) {
    c.save(); c.translate(x, y); c.rotate(-0.35);
    var k = press ? 0.92 : 1; c.scale(k, k);
    c.lineJoin = 'round'; c.lineWidth = Math.max(1.5, s * 0.07); c.strokeStyle = C.ink; c.fillStyle = '#fff';
    IF.rr(c, -s * 0.13, 0, s * 0.26, s * 0.62, s * 0.13); c.fill(); c.stroke();
    IF.rr(c, -s * 0.36, s * 0.42, s * 0.64, s * 0.56, s * 0.2); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(-s * 0.36, s * 0.62, s * 0.12, s * 0.2, -0.4, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(61,59,84,0.4)';
    c.beginPath(); c.moveTo(s * 0.12, s * 0.58); c.lineTo(s * 0.12, s * 0.72); c.moveTo(-s * 0.06, s * 0.6); c.lineTo(-s * 0.06, s * 0.74); c.stroke();
    c.restore();
  };

  // ---------- upgrade card icons ----------
  IF.drawUpIcon = function (c, k, x, y, r, param) {
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    if (k === 'ferry' || k === 'speed') {
      IF.drawBoat(c, x + (k === 'speed' ? r * 0.15 : 0), y, -0.0, r * 1.25, C.coral, null, 0);
      if (k === 'speed') {
        c.strokeStyle = C.ink; c.lineWidth = Math.max(1.5, r * 0.1);
        c.beginPath();
        c.moveTo(x - r * 0.95, y - r * 0.25); c.lineTo(x - r * 0.62, y - r * 0.25);
        c.moveTo(x - r * 1.05, y + r * 0.02); c.lineTo(x - r * 0.62, y + r * 0.02);
        c.moveTo(x - r * 0.95, y + r * 0.28); c.lineTo(x - r * 0.62, y + r * 0.28);
        c.stroke();
      } else {
        IF.circle(c, x + r * 0.62, y - r * 0.5, r * 0.3); c.fillStyle = C.mint; c.fill();
        c.lineWidth = Math.max(1, r * 0.08); c.strokeStyle = C.ink; c.stroke();
        c.beginPath(); c.moveTo(x + r * 0.48, y - r * 0.5); c.lineTo(x + r * 0.76, y - r * 0.5);
        c.moveTo(x + r * 0.62, y - r * 0.64); c.lineTo(x + r * 0.62, y - r * 0.36); c.stroke();
      }
    } else if (k === 'hold') {
      IF.drawCrate(c, x - r * 0.3, y + r * 0.2, r * 0.62, '#F2CF9B');
      IF.drawCrate(c, x + r * 0.34, y + r * 0.2, r * 0.62, '#C9BAF8');
      IF.drawCrate(c, x + r * 0.02, y - r * 0.4, r * 0.62, '#A9E6CC');
    } else if (k === 'calm') {
      c.strokeStyle = C.mintDark; c.lineWidth = r * 0.16;
      c.beginPath(); c.arc(x, y, r * 0.85, -Math.PI / 2, Math.PI * 1.2); c.stroke();
      IF.drawGood(c, param == null ? 0 : param, x, y, r * 0.6);
    } else if (k === 'light') {
      c.fillStyle = 'rgba(255,227,154,0.8)';
      c.beginPath(); c.moveTo(x, y - r * 0.62); c.lineTo(x + r * 1.1, y - r * 0.95); c.lineTo(x + r * 1.1, y - r * 0.3); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(x, y - r * 0.62); c.lineTo(x - r * 1.1, y - r * 0.95); c.lineTo(x - r * 1.1, y - r * 0.3); c.closePath(); c.fill();
      c.lineWidth = Math.max(1, r * 0.08); c.strokeStyle = C.ink;
      c.beginPath(); c.moveTo(x - r * 0.28, y + r * 0.85); c.lineTo(x - r * 0.18, y - r * 0.45); c.lineTo(x + r * 0.18, y - r * 0.45); c.lineTo(x + r * 0.28, y + r * 0.85); c.closePath();
      c.fillStyle = '#fff'; c.fill(); c.stroke();
      c.fillStyle = C.coral;
      c.beginPath(); c.moveTo(x - r * 0.25, y + r * 0.45); c.lineTo(x + r * 0.25, y + r * 0.45); c.lineTo(x + r * 0.23, y + r * 0.2); c.lineTo(x - r * 0.23, y + r * 0.2); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(x - r * 0.22, y - r * 0.02); c.lineTo(x + r * 0.22, y - r * 0.02); c.lineTo(x + r * 0.2, y - r * 0.22); c.lineTo(x - r * 0.2, y - r * 0.22); c.closePath(); c.fill();
      IF.rr(c, x - r * 0.22, y - r * 0.8, r * 0.44, r * 0.36, r * 0.08); c.fillStyle = C.butter; c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x - r * 0.26, y - r * 0.8); c.lineTo(x, y - r * 1.0); c.lineTo(x + r * 0.26, y - r * 0.8); c.closePath(); c.fillStyle = C.coral; c.fill(); c.stroke();
    } else if (k === 'heart') {
      IF.drawHeart(c, x, y + r * 0.05, r * 1.5, true);
    } else if (k === 'docks') {
      c.strokeStyle = C.ink; c.lineWidth = Math.max(1, r * 0.08);
      IF.rr(c, x - r * 0.9, y + r * 0.45, r * 1.8, r * 0.25, r * 0.06); c.fillStyle = '#D9AE79'; c.fill(); c.stroke();
      IF.drawCrate(c, x - r * 0.4, y + r * 0.12, r * 0.6, '#F7A1C4');
      IF.drawCrate(c, x + r * 0.28, y + r * 0.12, r * 0.6, '#A7D3F5');
      c.beginPath(); c.moveTo(x + r * 0.5, y - r * 0.55); c.lineTo(x + r * 0.5, y - r * 0.95); c.moveTo(x + r * 0.3, y - r * 0.75); c.lineTo(x + r * 0.7, y - r * 0.75); c.lineWidth = r * 0.14; c.stroke();
    } else { // crew: anchor
      c.strokeStyle = C.ink; c.lineWidth = Math.max(2, r * 0.18);
      c.beginPath(); c.moveTo(x, y - r * 0.55); c.lineTo(x, y + r * 0.7);
      c.moveTo(x - r * 0.4, y - r * 0.25); c.lineTo(x + r * 0.4, y - r * 0.25);
      c.moveTo(x - r * 0.7, y + r * 0.2); c.quadraticCurveTo(x - r * 0.6, y + r * 0.72, x, y + r * 0.72); c.quadraticCurveTo(x + r * 0.6, y + r * 0.72, x + r * 0.7, y + r * 0.2);
      c.stroke();
      IF.circle(c, x, y - r * 0.72, r * 0.18); c.lineWidth = Math.max(1.5, r * 0.12); c.stroke();
    }
    c.restore();
  };

  // ---------- islands ----------
  // Renders one island to an offscreen canvas. Returns {cv, half}.
  IF.renderIsland = function (deco, rpx, dpr) {
    var r = IF.rng(deco);
    var half = Math.ceil(rpx * 1.35);
    var cv = document.createElement('canvas');
    cv.width = cv.height = Math.max(2, Math.ceil(half * 2 * dpr));
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, half * dpr, half * dpr);
    var N = 28, ph1 = r() * TAU, ph2 = r() * TAU, a1 = 0.05 + r() * 0.06, a2 = 0.03 + r() * 0.04;
    function blob(scale, oy) {
      c.beginPath();
      for (var i = 0; i <= N; i++) {
        var a = i / N * TAU;
        var rad = rpx * scale * (1 + a1 * Math.sin(3 * a + ph1) + a2 * Math.sin(5 * a + ph2));
        var px = Math.cos(a) * rad, py = Math.sin(a) * rad * 0.9 + oy;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
    }
    var lw = Math.max(1, rpx * 0.045);
    c.lineJoin = 'round'; c.lineCap = 'round';
    blob(1.22, rpx * 0.04); c.fillStyle = C.shallow; c.fill();
    blob(1.0, rpx * 0.1); c.fillStyle = C.sandDark; c.fill();
    blob(1.0, 0); c.fillStyle = C.sand; c.fill(); c.lineWidth = lw; c.strokeStyle = 'rgba(61,59,84,0.55)'; c.stroke();
    blob(0.76, -rpx * 0.06); c.fillStyle = C.grass; c.fill();
    // dock at the bottom
    c.fillStyle = '#D9AE79'; c.strokeStyle = 'rgba(61,59,84,0.6)'; c.lineWidth = lw * 0.8;
    var dx = (r() - 0.5) * rpx * 0.5;
    IF.rr(c, dx - rpx * 0.08, rpx * 0.66, rpx * 0.16, rpx * 0.36, rpx * 0.04); c.fill(); c.stroke();
    // decorations around the rim of the grass (the centre stays clear for the goods badge)
    var items = [], nT = 2 + Math.floor(r() * 3), nH = 1 + Math.floor(r() * 2), palms = r() < 0.55;
    var slots = [-2.6, -2.0, -1.45, -0.9, -0.35, 0.3, 2.85, 3.5];
    for (var s = slots.length - 1; s > 0; s--) { var j = Math.floor(r() * (s + 1)); var tmp = slots[s]; slots[s] = slots[j]; slots[j] = tmp; }
    for (var k = 0; k < nT + nH && k < slots.length; k++) {
      var ang = slots[k] + (r() - 0.5) * 0.2, dist = rpx * (0.5 + r() * 0.1);
      items.push({ x: Math.cos(ang) * dist, y: Math.sin(ang) * dist * 0.85 - rpx * 0.06, house: k < nH, v: r() });
    }
    items.sort(function (a, b) { return a.y - b.y; });
    var roofs = [C.coral, C.lavender, C.sky, C.peach, C.pink];
    for (var m = 0; m < items.length; m++) {
      var it = items[m], x = it.x, y = it.y;
      if (it.house) {
        var hw = rpx * 0.28, hh = rpx * 0.2;
        c.fillStyle = 'rgba(61,59,84,0.15)'; IF.rr(c, x - hw / 2, y - hh / 2 + rpx * 0.06, hw, hh, rpx * 0.04); c.fill();
        c.fillStyle = '#FFFDF8'; IF.rr(c, x - hw / 2, y - hh / 2, hw, hh, rpx * 0.03); c.fill();
        c.lineWidth = lw * 0.8; c.strokeStyle = C.ink; c.stroke();
        c.beginPath(); c.moveTo(x - hw * 0.62, y - hh * 0.45); c.lineTo(x, y - hh * 1.35); c.lineTo(x + hw * 0.62, y - hh * 0.45); c.closePath();
        c.fillStyle = roofs[Math.floor(it.v * roofs.length)]; c.fill(); c.stroke();
        c.fillStyle = C.ink; IF.rr(c, x - hw * 0.1, y, hw * 0.2, hh * 0.5, 1); c.fill();
      } else if (palms) {
        c.strokeStyle = '#B98A55'; c.lineWidth = Math.max(1.5, rpx * 0.06);
        c.beginPath(); c.moveTo(x, y + rpx * 0.12); c.quadraticCurveTo(x + rpx * 0.06, y - rpx * 0.06, x + rpx * 0.02, y - rpx * 0.2); c.stroke();
        c.fillStyle = '#7FCB8C'; c.strokeStyle = 'rgba(61,59,84,0.6)'; c.lineWidth = lw * 0.7;
        for (var l = 0; l < 5; l++) {
          var la = -Math.PI / 2 + (l - 2) * 0.75;
          c.beginPath(); c.ellipse(x + 0.02 * rpx + Math.cos(la) * rpx * 0.12, y - rpx * 0.2 + Math.sin(la) * rpx * 0.08, rpx * 0.15, rpx * 0.055, la, 0, TAU); c.fill(); c.stroke();
        }
      } else {
        var tw = rpx * 0.2, th = rpx * 0.34;
        c.fillStyle = 'rgba(61,59,84,0.15)'; c.beginPath(); c.ellipse(x, y + th * 0.4, tw * 0.6, tw * 0.25, 0, 0, TAU); c.fill();
        c.fillStyle = '#6FBF8E'; c.strokeStyle = 'rgba(61,59,84,0.6)'; c.lineWidth = lw * 0.7;
        c.beginPath(); c.moveTo(x, y - th * 0.6); c.lineTo(x + tw * 0.62, y + th * 0.35); c.lineTo(x - tw * 0.62, y + th * 0.35); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(x, y - th * 0.9); c.lineTo(x + tw * 0.45, y - th * 0.05); c.lineTo(x - tw * 0.45, y - th * 0.05); c.closePath(); c.fill(); c.stroke();
      }
    }
    return { cv: cv, half: half };
  };

  // ---------- sea ----------
  var waves = [];
  (function () {
    var r = IF.rng(12345);
    for (var i = 0; i < 46; i++) waves.push({ x: r(), y: r(), p: r() * TAU, s: 0.6 + r() * 0.6, v: 0.5 + r() });
  })();
  IF.drawSea = function (c, x0, y0, w, h, time, u, col, lineCol) {
    c.fillStyle = col || C.sea; c.fillRect(x0, y0, w, h);
    var sz = Math.max(6, u * 0.022);
    c.strokeStyle = lineCol || C.seaLine; c.lineWidth = Math.max(1.5, u * 0.0045); c.lineCap = 'round';
    c.beginPath();
    for (var i = 0; i < waves.length; i++) {
      var wv = waves[i];
      var span = w + sz * 4;
      var x = x0 - sz * 2 + ((wv.x * span + time * 6 * wv.v) % span);
      var y = y0 + wv.y * h + Math.sin(time * 0.9 + wv.p) * sz * 0.25;
      var s = sz * wv.s * (0.85 + 0.15 * Math.sin(time * 1.3 + wv.p));
      c.moveTo(x - s, y);
      c.quadraticCurveTo(x - s * 0.5, y - s * 0.45, x, y);
      c.quadraticCurveTo(x + s * 0.5, y - s * 0.45, x + s, y);
    }
    c.stroke();
  };
})();
