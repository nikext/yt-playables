/* Ramen Rush: palette, drawing helpers, cel-shaded food, stations, customers and the
   night-market backdrop. Everything is drawn in code. */
(function () {
  'use strict';
  var RR = window.RR = window.RR || {};
  var TAU = Math.PI * 2;

  // One palette object (the README lists the same tokens).
  var C = RR.C = {
    dusk: '#3B2230', duskDeep: '#24141E', night: '#1B0E16', lantern: '#E8483B', lanternDeep: '#B32F28', glow: '#FFC46B',
    broth: '#E9B872', wood: '#A8683C', woodLight: '#C98A55', woodDark: '#7A4526', woodDeep: '#4E2A1B', nori: '#2E5E4E',
    noriLight: '#4C8A6C', cream: '#FFF3E0', creamDeep: '#EBD9BF', ink: '#2A1620', inkSoft: '#B79CA6', good: '#5CC98A',
    goodDeep: '#2E8A57', metal: '#9196A6', metalDark: '#5E6272', metalLight: '#C9CCD6', water: '#6F8FA0', gold: '#F2B33D'
  };
  // Food colors. Every ingredient also has its own shape, so color is never the only cue.
  var F = RR.F = {
    broth: ['#B5692C', '#E9B872', '#F4E3C6', '#D9452B'],
    brothHi: ['#D08A45', '#F5D29A', '#FFF6E4', '#F07A45'],
    noodle: '#F6DC93', noodleDeep: '#C9A55A', udon: '#FBF1D6',
    eggWhite: '#FFF8EC', yolk: '#F39B26', yolkDeep: '#D9731C', chashu: '#B5654A', chashuFat: '#F2D0B4', chashuDeep: '#7E3E2C',
    scallion: '#7CC44C', scallionDeep: '#3F8A35', naruto: '#FFF8F2', narutoPink: '#E9557A', corn: '#FFD23F', cornDeep: '#D99E1C',
    mushCap: '#8A5232', mushDeep: '#5C321D', mushStem: '#EADBC2', tea: '#A9C46A', cup: '#F4ECDD', soda: '#6FCFE3', sodaDeep: '#2F9DB8'
  };
  RR.FONT = 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
  RR.font = function (px, w) { return (w || '800') + ' ' + Math.max(1, Math.round(px)) + 'px ' + RR.FONT; };

  function rr(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  RR.rr = rr;
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
  RR.circle = circ;
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  RR.ellipse = ell;
  function lw(c, w) { c.lineWidth = Math.max(1, w); c.lineJoin = 'round'; c.lineCap = 'round'; }
  function fillStroke(c, fill, w) { c.fillStyle = fill; c.fill(); if (w) { lw(c, w); c.strokeStyle = C.ink; c.stroke(); } }

  // Cel-shaded panel: a solid offset shadow block, a flat fill and an ink outline.
  RR.panel = function (c, x, y, w, h, r, fill, off, line, shadow) {
    off = off == null ? 4 : off;
    if (off) { c.fillStyle = shadow || 'rgba(20,8,14,0.55)'; rr(c, x, y + off, w, h, r); c.fill(); }
    c.fillStyle = fill; rr(c, x, y, w, h, r); c.fill();
    if (line !== 0) { lw(c, line || 3); c.strokeStyle = C.ink; c.stroke(); }
  };
  RR.fitFont = function (c, text, maxW, px, weight) {
    c.font = RR.font(px, weight);
    var w = c.measureText(text).width;
    if (maxW && w > maxW && w > 0) { px = Math.max(8, Math.floor(px * maxW / w)); c.font = RR.font(px, weight); }
    return px;
  };
  // Text with an optional hard drop shadow (no blur).
  RR.text = function (c, s, x, y, px, col, align, maxW, weight, shadow) {
    RR.fitFont(c, s, maxW, px, weight);
    c.textAlign = align || 'center'; c.textBaseline = 'middle';
    if (shadow) { c.fillStyle = shadow; c.fillText(s, x, y + Math.max(1.5, px * 0.08)); }
    c.fillStyle = col; c.fillText(s, x, y);
  };
  RR.wrap = function (c, s, maxW, px, weight) {
    c.font = RR.font(px, weight);
    var words = String(s).split(' '), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var tst = cur ? cur + ' ' + words[i] : words[i];
      if (c.measureText(tst).width > maxW && cur) { lines.push(cur); cur = words[i]; } else cur = tst;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  // ---------- glyphs: one per broth and noodle, drawn on pots, crates and order icons ----------
  RR.brothGlyph = function (c, n, x, y, s, col) {
    c.save(); c.translate(x, y); c.fillStyle = col; c.strokeStyle = col;
    if (n === 0) { // shoyu: a drop
      c.beginPath(); c.moveTo(0, -s); c.bezierCurveTo(s * 0.55, -s * 0.25, s * 0.8, s * 0.15, s * 0.62, s * 0.5);
      c.arc(0, s * 0.32, s * 0.66, 0.3, Math.PI - 0.3); c.bezierCurveTo(-s * 0.8, s * 0.15, -s * 0.55, -s * 0.25, 0, -s); c.fill();
    } else if (n === 1) { // miso: three soybeans
      for (var i = 0; i < 3; i++) { var a = -Math.PI / 2 + i * TAU / 3; ell(c, Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45 + s * 0.05, s * 0.42, s * 0.32, a); c.fill(); }
    } else if (n === 2) { // tonkotsu: a bone
      lw(c, s * 0.45); c.beginPath(); c.moveTo(-s * 0.55, s * 0.55); c.lineTo(s * 0.55, -s * 0.55); c.stroke();
      // two knobs at each end, either side of the shaft (shaft runs along (1,-1), knobs along (1,1))
      var kp = s * 0.2, ke = s * 0.62;
      [[-ke, ke], [ke, -ke]].forEach(function (e) {
        circ(c, e[0] + kp, e[1] + kp, s * 0.27); c.fill();
        circ(c, e[0] - kp, e[1] - kp, s * 0.27); c.fill();
      });
    } else { // spicy: a chili pepper
      c.beginPath(); c.moveTo(-s * 0.55, -s * 0.45);
      c.bezierCurveTo(-s * 0.2, -s * 0.75, s * 0.75, -s * 0.2, s * 0.6, s * 0.85);
      c.bezierCurveTo(s * 0.2, s * 0.1, -s * 0.5, -s * 0.05, -s * 0.55, -s * 0.45); c.fill();
      lw(c, s * 0.2); c.beginPath(); c.moveTo(-s * 0.5, -s * 0.45); c.quadraticCurveTo(-s * 0.75, -s * 0.8, -s * 0.45, -s * 0.95); c.stroke();
    }
    c.restore();
  };
  RR.noodleGlyph = function (c, n, x, y, s, col) {
    c.save(); c.translate(x, y); c.strokeStyle = col; lw(c, n === 2 ? s * 0.38 : s * 0.16);
    for (var i = -1; i <= 1; i++) {
      var xx = i * s * (n === 2 ? 0.55 : 0.45);
      c.beginPath();
      if (n === 1) { c.moveTo(xx, -s * 0.85); for (var k = 1; k <= 6; k++) c.lineTo(xx + (k % 2 ? s * 0.18 : -s * 0.18), -s * 0.85 + k * s * 0.28); }
      else { c.moveTo(xx, -s * 0.8); c.lineTo(xx, s * 0.8); }
      c.stroke();
    }
    c.restore();
  };

  // ---------- toppings (each a distinct silhouette) ----------
  RR.topping = function (c, n, x, y, s, rot) {
    var w = s * 0.09;
    c.save(); c.translate(x, y); if (rot) c.rotate(rot);
    if (n === 0) { // egg: half egg with a jammy yolk
      ell(c, 0, 0, s * 0.55, s * 0.42); fillStroke(c, F.eggWhite, w);
      ell(c, s * 0.04, s * 0.03, s * 0.3, s * 0.24); c.fillStyle = F.yolk; c.fill();
      ell(c, s * 0.08, s * 0.06, s * 0.17, s * 0.13); c.fillStyle = F.yolkDeep; c.fill();
      ell(c, -s * 0.28, -s * 0.18, s * 0.1, s * 0.06, -0.5); c.fillStyle = '#fff'; c.fill();
    } else if (n === 1) { // nori: a dark square sheet standing up
      c.rotate(-0.12); rr(c, -s * 0.36, -s * 0.55, s * 0.72, s * 1.0, s * 0.06); fillStroke(c, C.nori, w);
      c.strokeStyle = C.noriLight; lw(c, s * 0.05);
      for (var i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-s * 0.26, -s * 0.3 + i * s * 0.28); c.lineTo(s * 0.26, -s * 0.38 + i * s * 0.28); c.stroke(); }
    } else if (n === 2) { // scallion: a heap of little rings
      var P = [[-0.3, 0.05], [0.05, -0.18], [0.32, 0.08], [-0.05, 0.22], [0.15, 0.32], [-0.32, -0.25]];
      for (var j = 0; j < P.length; j++) {
        circ(c, P[j][0] * s, P[j][1] * s, s * 0.19); fillStroke(c, F.scallion, w * 0.8);
        circ(c, P[j][0] * s, P[j][1] * s, s * 0.08); c.fillStyle = '#D9F0B8'; c.fill();
      }
    } else if (n === 3) { // chashu: a round slice with a fat spiral
      circ(c, 0, 0, s * 0.52); fillStroke(c, F.chashu, w);
      c.beginPath(); for (var a = 0; a < 9.5; a += 0.3) { var rr2 = s * (0.06 + a * 0.042); c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
      c.strokeStyle = F.chashuFat; lw(c, s * 0.08); c.stroke();
      circ(c, 0, 0, s * 0.52); c.strokeStyle = F.chashuDeep; lw(c, s * 0.07); c.stroke();
      circ(c, 0, 0, s * 0.56); c.strokeStyle = C.ink; lw(c, w); c.stroke();
    } else if (n === 4) { // naruto: a scalloped disc with a pink swirl
      c.beginPath();
      for (var k = 0; k <= 48; k++) { var b = k / 48 * TAU, r = s * (0.5 + 0.045 * Math.cos(b * 12)); c.lineTo(Math.cos(b) * r, Math.sin(b) * r * 0.9); }
      fillStroke(c, F.naruto, w);
      c.beginPath(); for (var q = 0; q < 10; q += 0.25) { var r3 = s * (0.02 + q * 0.036); c.lineTo(Math.cos(q) * r3, Math.sin(q) * r3 * 0.9); }
      c.strokeStyle = F.narutoPink; lw(c, s * 0.09); c.stroke();
    } else if (n === 5) { // corn: a little pile of square-ish kernels
      var K = [[-0.3, 0.15], [0, 0.18], [0.3, 0.15], [-0.15, -0.1], [0.15, -0.1], [0, -0.35], [-0.42, -0.15], [0.42, -0.15]];
      for (var m = 0; m < K.length; m++) { rr(c, K[m][0] * s - s * 0.14, K[m][1] * s - s * 0.13, s * 0.28, s * 0.26, s * 0.08); fillStroke(c, F.corn, w * 0.8); }
      rr(c, -s * 0.06, s * 0.12, s * 0.12, s * 0.06, s * 0.03); c.fillStyle = F.cornDeep; c.fill();
    } else if (n === 6) { // mushroom: shiitake cap with a cross cut and a stem
      rr(c, -s * 0.12, -s * 0.02, s * 0.24, s * 0.5, s * 0.08); fillStroke(c, F.mushStem, w);
      c.beginPath(); c.moveTo(-s * 0.56, s * 0.08); c.bezierCurveTo(-s * 0.56, -s * 0.62, s * 0.56, -s * 0.62, s * 0.56, s * 0.08);
      c.quadraticCurveTo(0, s * 0.2, -s * 0.56, s * 0.08); fillStroke(c, F.mushCap, w);
      c.strokeStyle = F.mushStem; lw(c, s * 0.07);
      c.beginPath(); c.moveTo(-s * 0.2, -s * 0.36); c.lineTo(s * 0.2, -s * 0.06); c.moveTo(s * 0.2, -s * 0.36); c.lineTo(-s * 0.2, -s * 0.06); c.stroke();
    }
    c.restore();
  };

  RR.drink = function (c, n, x, y, s) {
    var w = s * 0.09;
    c.save(); c.translate(x, y);
    if (n === 0) { // tea: a handleless cup with a wide body and a leaf
      c.beginPath(); c.moveTo(-s * 0.5, -s * 0.45); c.lineTo(s * 0.5, -s * 0.45); c.lineTo(s * 0.38, s * 0.5); c.quadraticCurveTo(0, s * 0.62, -s * 0.38, s * 0.5); c.closePath();
      fillStroke(c, F.cup, w);
      ell(c, 0, -s * 0.45, s * 0.5, s * 0.13); fillStroke(c, F.tea, w);
      c.beginPath(); c.moveTo(-s * 0.4, s * 0.05); c.lineTo(s * 0.4, s * 0.05); c.strokeStyle = C.nori; lw(c, s * 0.1); c.stroke();
      ell(c, 0, s * 0.27, s * 0.12, s * 0.07, 0.4); c.fillStyle = C.nori; c.fill();
    } else { // soda: a pinched glass bottle with a marble
      c.beginPath();
      c.moveTo(-s * 0.16, -s * 0.72); c.lineTo(s * 0.16, -s * 0.72); c.lineTo(s * 0.16, -s * 0.42);
      c.quadraticCurveTo(s * 0.36, -s * 0.32, s * 0.12, -s * 0.12); c.quadraticCurveTo(s * 0.38, 0, s * 0.36, s * 0.3);
      c.lineTo(s * 0.36, s * 0.55); c.quadraticCurveTo(0, s * 0.68, -s * 0.36, s * 0.55); c.lineTo(-s * 0.36, s * 0.3);
      c.quadraticCurveTo(-s * 0.38, 0, -s * 0.12, -s * 0.12); c.quadraticCurveTo(-s * 0.36, -s * 0.32, -s * 0.16, -s * 0.42); c.closePath();
      fillStroke(c, F.soda, w);
      circ(c, 0, -s * 0.27, s * 0.11); fillStroke(c, '#E6FAFF', w * 0.7);
      rr(c, -s * 0.2, -s * 0.84, s * 0.4, s * 0.14, s * 0.04); fillStroke(c, C.lantern, w * 0.8);
      c.beginPath(); c.moveTo(-s * 0.22, s * 0.05); c.lineTo(-s * 0.22, s * 0.42); c.strokeStyle = 'rgba(255,255,255,0.7)'; lw(c, s * 0.07); c.stroke();
    }
    c.restore();
  };

  // ---------- broth surfaces and noodles ----------
  function brothSurface(c, n, x, y, rx, ry, t) {
    ell(c, x, y, rx, ry); c.fillStyle = F.broth[n]; c.fill();
    c.fillStyle = F.brothHi[n];
    if (n === 0) { // shoyu: clear with oil droplets
      for (var i = 0; i < 6; i++) { circ(c, x + Math.cos(i * 2.1 + t * 0.2) * rx * 0.62, y + Math.sin(i * 2.1) * ry * 0.55, rx * 0.06 + (i % 2) * rx * 0.03); c.fill(); }
    } else if (n === 1) { // miso: opaque with fine speckles
      c.fillStyle = '#C98F45';
      for (var j = 0; j < 14; j++) { circ(c, x + Math.cos(j * 2.4) * rx * 0.75 * ((j % 3 + 1) / 3), y + Math.sin(j * 2.4) * ry * 0.7 * ((j % 3 + 1) / 3), rx * 0.025); c.fill(); }
    } else if (n === 2) { // tonkotsu: creamy swirl
      c.strokeStyle = '#E2CBA4'; lw(c, rx * 0.05);
      c.beginPath(); c.ellipse(x, y, rx * 0.55, ry * 0.5, 0, 0.3, 4.4); c.stroke();
      c.beginPath(); c.ellipse(x, y, rx * 0.3, ry * 0.25, 0, 2, 6); c.stroke();
    } else { // spicy: chili oil rings and flakes
      c.fillStyle = '#F2913A';
      for (var k = 0; k < 5; k++) { ell(c, x + Math.cos(k * 1.7) * rx * 0.6, y + Math.sin(k * 1.7) * ry * 0.5, rx * 0.1, ry * 0.12); c.fill(); }
      c.fillStyle = '#7E1F18';
      for (var m = 0; m < 8; m++) { c.fillRect(x + Math.cos(m * 2.9) * rx * 0.7 - 1, y + Math.sin(m * 2.9) * ry * 0.6 - 1, rx * 0.06, rx * 0.04); }
    }
  }
  RR.brothSurface = brothSurface;
  function noodlesIn(c, n, x, y, rx, ry) {
    var col = n === 2 ? F.udon : F.noodle;
    c.strokeStyle = F.noodleDeep; c.lineCap = 'round';
    var rows = n === 2 ? 3 : 5, th = n === 2 ? ry * 0.42 : ry * 0.16;
    for (var pass = 0; pass < 2; pass++) {
      c.strokeStyle = pass ? col : F.noodleDeep; c.lineWidth = pass ? th : th + Math.max(1.5, rx * 0.04);
      for (var i = 0; i < rows; i++) {
        var yy = y - ry * 0.45 + i * (ry * 0.9 / (rows - 1));
        var half = rx * 0.7 * Math.sqrt(Math.max(0.15, 1 - Math.pow((yy - y) / ry, 2)));
        c.beginPath();
        if (n === 1) { var steps = 8; c.moveTo(x - half, yy); for (var k = 1; k <= steps; k++) c.lineTo(x - half + k * half * 2 / steps, yy + (k % 2 ? -1 : 1) * ry * 0.09); }
        else { c.moveTo(x - half, yy); c.quadraticCurveTo(x, yy + (i % 2 ? 1 : -1) * ry * 0.12, x + half, yy); }
        c.stroke();
      }
    }
  }
  RR.noodlesIn = noodlesIn;

  // ---------- the bowl (3/4 view) ----------
  var TOP_POS = [[-0.42, -0.1], [0.4, -0.2], [0.05, 0.42]];
  RR.bowl = function (c, x, y, r, b, t, glow) {
    var ry = r * 0.36, w = Math.max(1.5, r * 0.07);
    ell(c, x, y + r * 0.66, r * 0.8, r * 0.14); c.fillStyle = 'rgba(20,8,14,0.35)'; c.fill();
    // body
    c.beginPath(); c.moveTo(x - r, y); c.bezierCurveTo(x - r, y + r * 0.55, x - r * 0.55, y + r * 0.66, x - r * 0.42, y + r * 0.66);
    c.lineTo(x + r * 0.42, y + r * 0.66); c.bezierCurveTo(x + r * 0.55, y + r * 0.66, x + r, y + r * 0.55, x + r, y); c.closePath();
    c.fillStyle = C.lantern; c.fill();
    c.save(); c.clip();
    c.fillStyle = C.lanternDeep; c.fillRect(x + r * 0.35, y - r, r, r * 2);
    c.fillStyle = C.cream; c.fillRect(x - r, y + r * 0.18, r * 2, r * 0.12);
    c.fillStyle = C.lantern;
    for (var i = -3; i <= 3; i++) { circ(c, x + i * r * 0.28, y + r * 0.24, r * 0.05); c.fill(); }
    c.restore();
    lw(c, w); c.strokeStyle = C.ink; c.stroke();
    // foot
    rr(c, x - r * 0.4, y + r * 0.6, r * 0.8, r * 0.12, r * 0.04); fillStroke(c, C.lanternDeep, w * 0.8);
    // rim and contents
    ell(c, x, y, r, ry); fillStroke(c, C.cream, w);
    ell(c, x, y + ry * 0.04, r * 0.86, ry * 0.8); c.fillStyle = b && b.broth >= 0 ? F.broth[b.broth] : '#E2CDAE'; c.fill();
    if (b) {
      c.save(); ell(c, x, y + ry * 0.04, r * 0.86, ry * 0.8); c.clip();
      if (b.broth >= 0) brothSurface(c, b.broth, x, y + ry * 0.04, r * 0.86, ry * 0.8, t || 0);
      if (b.noodle >= 0) noodlesIn(c, b.noodle, x, y + ry * 0.1, r * 0.62, ry * 0.62);
      c.restore();
      for (var k = 0; k < b.tops.length; k++) {
        var p = TOP_POS[k];
        RR.topping(c, b.tops[k], x + p[0] * r, y + p[1] * ry - r * 0.05, r * 0.42, (k - 1) * 0.25);
      }
      if (b.drink >= 0) RR.drink(c, b.drink, x + r * 0.98, y + r * 0.3, r * 0.42);
      if (b.broth >= 0 && b.noodle >= 0) RR.steam(c, x, y - r * 0.2, r * 0.9, t || 0, 0.35);
    }
    if (glow) { ell(c, x, y, r + 4, ry + 4); c.strokeStyle = C.glow; lw(c, 3); c.stroke(); }
  };

  // Rising steam wisps (alpha only, never flashing).
  RR.steam = function (c, x, y, h, t, a) {
    c.save(); lw(c, Math.max(2, h * 0.07));
    for (var i = 0; i < 3; i++) {
      var ph = (t * 0.6 + i / 3) % 1, yy = y - ph * h, xx = x + (i - 1) * h * 0.28;
      c.globalAlpha = (a || 0.4) * Math.sin(ph * Math.PI);
      c.strokeStyle = C.cream;
      c.beginPath(); c.moveTo(xx, yy);
      c.bezierCurveTo(xx + h * 0.12, yy - h * 0.1, xx - h * 0.12, yy - h * 0.2, xx, yy - h * 0.3);
      c.stroke();
    }
    c.restore();
  };

  // ---------- order icons ----------
  RR.icon = function (c, k, n, x, y, s) {
    if (k === 0) { // a small bowl of that broth with its glyph
      var r = s * 0.5;
      c.beginPath(); c.moveTo(x - r, y - r * 0.1); c.quadraticCurveTo(x - r, y + r * 0.8, x, y + r * 0.8); c.quadraticCurveTo(x + r, y + r * 0.8, x + r, y - r * 0.1); c.closePath();
      fillStroke(c, C.lantern, s * 0.06);
      ell(c, x, y - r * 0.1, r, r * 0.34); fillStroke(c, F.broth[n], s * 0.06);
      circ(c, x, y + r * 0.38, r * 0.42); fillStroke(c, C.cream, s * 0.04);
      RR.brothGlyph(c, n, x, y + r * 0.38, r * 0.3, C.ink);
    } else if (k === 1) { // noodles lifted by chopsticks
      var col = n === 2 ? F.udon : F.noodle;
      c.save(); c.translate(x, y);
      c.strokeStyle = C.ink; lw(c, (n === 2 ? s * 0.16 : s * 0.08) + s * 0.07);
      var xs = n === 2 ? [-0.2, 0.05, 0.3] : [-0.24, -0.08, 0.08, 0.24];
      function strands(stroke, width) {
        c.strokeStyle = stroke; lw(c, width);
        for (var i = 0; i < xs.length; i++) {
          c.beginPath(); var x0 = xs[i] * s;
          if (n === 1) { c.moveTo(x0, -s * 0.22); for (var q = 1; q <= 5; q++) c.lineTo(x0 + (q % 2 ? s * 0.07 : -s * 0.07), -s * 0.22 + q * s * 0.13); }
          else { c.moveTo(x0, -s * 0.22); c.lineTo(x0 + s * 0.02, s * 0.44); }
          c.stroke();
        }
      }
      strands(C.ink, (n === 2 ? s * 0.17 : s * 0.075) + s * 0.07);
      strands(col, n === 2 ? s * 0.17 : s * 0.075);
      c.strokeStyle = C.wood; lw(c, s * 0.08);
      c.beginPath(); c.moveTo(-s * 0.46, -s * 0.3); c.lineTo(s * 0.46, -s * 0.42); c.moveTo(-s * 0.46, -s * 0.18); c.lineTo(s * 0.46, -s * 0.26); c.stroke();
      c.restore();
    } else if (k === 2) RR.topping(c, n, x, y, s * 0.85, 0);
    else RR.drink(c, n, x, y, s * 0.8);
  };

  // ---------- stations ----------
  RR.pot = function (c, x, y, w, h, n, t, hot) {
    var cx = x + w / 2, top = y + h * 0.36, rx = w * 0.4, ry = Math.min(h * 0.11, rx * 0.3), bot = y + h * 0.92, lwid = Math.max(2, w * 0.035);
    RR.steam(c, cx, top - 2, h * 0.38, t, 0.45);
    // handles
    rr(c, cx - rx - w * 0.08, top + h * 0.1, w * 0.12, h * 0.08, h * 0.04); fillStroke(c, C.metalDark, lwid);
    rr(c, cx + rx - w * 0.04, top + h * 0.1, w * 0.12, h * 0.08, h * 0.04); fillStroke(c, C.metalDark, lwid);
    c.beginPath(); c.moveTo(cx - rx, top); c.lineTo(cx - rx, bot - h * 0.05); c.quadraticCurveTo(cx - rx, bot, cx - rx + h * 0.05, bot);
    c.lineTo(cx + rx - h * 0.05, bot); c.quadraticCurveTo(cx + rx, bot, cx + rx, bot - h * 0.05); c.lineTo(cx + rx, top); c.closePath();
    c.fillStyle = C.metal; c.fill();
    c.save(); c.clip(); c.fillStyle = C.metalDark; c.fillRect(cx + rx * 0.45, top, rx, h); c.fillStyle = C.metalLight; c.fillRect(cx - rx * 0.75, top, rx * 0.18, h); c.restore();
    lw(c, lwid); c.strokeStyle = C.ink; c.stroke();
    ell(c, cx, top, rx, ry); fillStroke(c, C.metalDark, lwid);
    brothSurface(c, n, cx, top + 1, rx * 0.88, ry * 0.75, t);
    // bubbles
    c.fillStyle = F.brothHi[n];
    for (var i = 0; i < 3; i++) { var ph = (t * 1.3 + i * 0.37) % 1; circ(c, cx + (i - 1) * rx * 0.45, top + 1, ry * 0.25 * Math.sin(ph * Math.PI)); c.fill(); }
    // ladle
    c.strokeStyle = C.woodDark; lw(c, w * 0.05); c.beginPath(); c.moveTo(cx + rx * 0.3, top); c.lineTo(cx + rx * 0.95, y + h * 0.06); c.stroke();
    // glyph badge
    var br = Math.min(w, h) * 0.17;
    circ(c, cx, top + (bot - top) * 0.52, br); fillStroke(c, C.cream, lwid);
    RR.brothGlyph(c, n, cx, top + (bot - top) * 0.52, br * 0.62, C.ink);
    if (hot) { rr(c, x + 2, y + 2, w - 4, h - 4, 10); c.strokeStyle = C.glow; lw(c, 3); c.stroke(); }
  };

  RR.crate = function (c, x, y, w, h, n) {
    var lwid = Math.max(2, w * 0.035), top = y + h * 0.3;
    // noodle nests peeking out
    var col = n === 2 ? F.udon : F.noodle;
    for (var i = 0; i < 3; i++) {
      var nx = x + w * (0.27 + i * 0.23), ny = top + h * 0.02, nr = w * 0.16;
      circ(c, nx, ny, nr); fillStroke(c, col, lwid * 0.8);
      c.strokeStyle = F.noodleDeep; lw(c, n === 2 ? nr * 0.22 : nr * 0.1);
      c.beginPath();
      if (n === 1) { for (var k = 0; k < 14; k++) { var a = k * 0.9, rad = nr * (0.3 + 0.45 * (k % 2)); c.lineTo(nx + Math.cos(a) * rad, ny + Math.sin(a) * rad); } }
      else if (n === 2) { c.arc(nx, ny, nr * 0.55, 0.4, 5.6); }
      else { c.arc(nx, ny, nr * 0.62, 0, TAU); c.moveTo(nx + nr * 0.32, ny); c.arc(nx, ny, nr * 0.32, 0, TAU); }
      c.stroke();
    }
    rr(c, x + w * 0.06, top, w * 0.88, h * 0.62, h * 0.06); fillStroke(c, C.wood, lwid);
    c.strokeStyle = C.woodDark; lw(c, lwid * 0.8);
    c.beginPath(); c.moveTo(x + w * 0.08, top + h * 0.2); c.lineTo(x + w * 0.92, top + h * 0.2); c.moveTo(x + w * 0.08, top + h * 0.42); c.lineTo(x + w * 0.92, top + h * 0.42); c.stroke();
    var br = Math.min(w, h) * 0.17, by = top + h * 0.33;
    rr(c, x + w / 2 - br * 1.1, by - br, br * 2.2, br * 2, br * 0.4); fillStroke(c, C.cream, lwid);
    RR.noodleGlyph(c, n, x + w / 2, by, br * 0.75, C.ink);
  };

  // Noodle burner. b = {st:0 empty,1 boiling,2 ready,3 overcooked, n, t}. p = boil progress 0..1.
  RR.burner = function (c, x, y, w, h, b, p, t, readyLeft) {
    var cx = x + w / 2, cy = y + h * 0.5, R = Math.min(w, h) * 0.42, lwid = Math.max(2, R * 0.08);
    // stove ring
    circ(c, cx, cy + R * 0.12, R); fillStroke(c, '#3A2A30', lwid);
    for (var i = 0; i < 10; i++) {
      var a = i / 10 * TAU, fx = cx + Math.cos(a) * R * 0.86, fy = cy + R * 0.12 + Math.sin(a) * R * 0.86;
      c.fillStyle = b.st === 0 ? '#4B5B8A' : (i + Math.floor(t * 12)) % 2 ? '#6FA8FF' : '#A9D1FF';
      circ(c, fx, fy, R * 0.07); c.fill();
    }
    // pot of water
    var pr = R * 0.72;
    circ(c, cx, cy, pr); fillStroke(c, C.metal, lwid);
    circ(c, cx, cy, pr * 0.8); c.fillStyle = b.st === 3 ? '#6B5A4E' : C.water; c.fill();
    if (b.st >= 1) {
      c.save(); circ(c, cx, cy, pr * 0.8); c.clip();
      noodlesIn(c, b.n, cx, cy, pr * 0.95, pr * 0.7);
      if (b.st === 3) { c.fillStyle = 'rgba(70,45,30,0.55)'; c.fillRect(cx - pr, cy - pr, pr * 2, pr * 2); }
      c.restore();
    }
    if (b.st === 1 || b.st === 0) {
      c.fillStyle = 'rgba(255,255,255,0.55)';
      var nb = b.st === 1 ? 5 : 2;
      for (var j = 0; j < nb; j++) { var ph = (t * 1.6 + j * 0.29) % 1; circ(c, cx + Math.cos(j * 2.3) * pr * 0.5, cy + Math.sin(j * 2.3) * pr * 0.45, pr * 0.1 * Math.sin(ph * Math.PI)); c.fill(); }
    }
    // basket handle
    c.strokeStyle = C.metalDark; lw(c, lwid * 1.2); c.beginPath(); c.moveTo(cx + pr * 0.5, cy - pr * 0.5); c.lineTo(cx + pr * 1.05, cy - pr * 1.0); c.stroke();
    if (b.st === 1) {
      c.strokeStyle = 'rgba(20,8,14,0.6)'; lw(c, R * 0.16); circ(c, cx, cy, R * 0.98); c.stroke();
      c.strokeStyle = C.glow; c.beginPath(); c.arc(cx, cy, R * 0.98, -Math.PI / 2, -Math.PI / 2 + TAU * p); c.stroke();
      RR.steam(c, cx, cy - pr * 0.4, R * 0.9, t, 0.35);
    } else if (b.st === 2) {
      // ready: a green ring that drains as the noodles wait, and a check badge
      c.strokeStyle = 'rgba(20,8,14,0.6)'; lw(c, R * 0.16); circ(c, cx, cy, R * 0.98); c.stroke();
      c.strokeStyle = C.good; c.beginPath(); c.arc(cx, cy, R * 0.98, -Math.PI / 2, -Math.PI / 2 + TAU * readyLeft); c.stroke();
      RR.badge(c, cx + R * 0.72, cy - R * 0.72, R * 0.3, 'check', C.good);
      RR.steam(c, cx, cy - pr * 0.4, R * 1.1, t, 0.5);
    } else if (b.st === 3) {
      RR.badge(c, cx + R * 0.72, cy - R * 0.72, R * 0.3, 'cross', C.lantern);
      c.save(); c.globalAlpha = 0.5; RR.steam(c, cx, cy - pr * 0.3, R * 1.1, t * 0.7, 0.7); c.restore();
    }
  };

  RR.tray = function (c, x, y, w, h, n, hot) {
    var lwid = Math.max(2, w * 0.035);
    rr(c, x + w * 0.06, y + h * 0.2, w * 0.88, h * 0.68, h * 0.12); fillStroke(c, C.metalLight, lwid);
    rr(c, x + w * 0.12, y + h * 0.27, w * 0.76, h * 0.54, h * 0.09); c.fillStyle = '#B6BAC6'; c.fill();
    var s = Math.min(w, h) * 0.34;
    RR.topping(c, n, x + w * 0.34, y + h * 0.58, s, -0.3);
    RR.topping(c, n, x + w * 0.66, y + h * 0.6, s, 0.35);
    RR.topping(c, n, x + w * 0.5, y + h * 0.44, s * 1.08, 0);
    if (hot) { rr(c, x + 2, y + 2, w - 4, h - 4, 10); c.strokeStyle = C.glow; lw(c, 3); c.stroke(); }
  };
  RR.cooler = function (c, x, y, w, h, n) {
    var lwid = Math.max(2, w * 0.035);
    rr(c, x + w * 0.08, y + h * 0.5, w * 0.84, h * 0.4, h * 0.08); fillStroke(c, n ? '#3F7FA0' : C.nori, lwid);
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x + w * 0.14, y + h * 0.58, w * 0.72, h * 0.05);
    var s = Math.min(w, h) * 0.42;
    RR.drink(c, n, x + w * 0.36, y + h * 0.42, s * 0.85);
    RR.drink(c, n, x + w * 0.64, y + h * 0.4, s);
  };
  RR.trash = function (c, x, y, w, h, hot, t) {
    var cx = x + w / 2, bw = Math.min(w * 0.62, h * 0.55), top = y + h * 0.28, bot = y + h * 0.9, lwid = Math.max(2, bw * 0.06);
    var lid = hot ? -0.35 : 0;
    c.beginPath(); c.moveTo(cx - bw / 2, top); c.lineTo(cx - bw * 0.4, bot); c.lineTo(cx + bw * 0.4, bot); c.lineTo(cx + bw / 2, top); c.closePath();
    fillStroke(c, hot ? C.lantern : C.metalDark, lwid);
    c.strokeStyle = 'rgba(255,255,255,0.35)'; lw(c, lwid * 0.8);
    for (var i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(cx + i * bw * 0.2, top + h * 0.1); c.lineTo(cx + i * bw * 0.16, bot - h * 0.08); c.stroke(); }
    c.save(); c.translate(cx - bw * 0.55, top - h * 0.02); c.rotate(lid);
    rr(c, 0, -h * 0.07, bw * 1.1, h * 0.09, h * 0.03); fillStroke(c, hot ? C.lanternDeep : C.metal, lwid);
    rr(c, bw * 0.4, -h * 0.13, bw * 0.3, h * 0.07, h * 0.03); fillStroke(c, C.metal, lwid * 0.8);
    c.restore();
  };

  // ---------- small UI icons ----------
  RR.badge = function (c, x, y, r, kind, fill) {
    circ(c, x, y, r); fillStroke(c, fill, Math.max(1.5, r * 0.18));
    c.strokeStyle = kind === 'check' ? C.ink : C.cream; lw(c, r * 0.3);
    c.beginPath();
    if (kind === 'check') { c.moveTo(x - r * 0.45, y); c.lineTo(x - r * 0.1, y + r * 0.38); c.lineTo(x + r * 0.5, y - r * 0.38); }
    else { c.moveTo(x - r * 0.38, y - r * 0.38); c.lineTo(x + r * 0.38, y + r * 0.38); c.moveTo(x + r * 0.38, y - r * 0.38); c.lineTo(x - r * 0.38, y + r * 0.38); }
    c.stroke();
  };
  // A round coin with a square hole.
  RR.coin = function (c, x, y, r) {
    circ(c, x, y, r); fillStroke(c, C.gold, Math.max(1.5, r * 0.16));
    circ(c, x, y, r * 0.7); c.strokeStyle = '#C98A1E'; lw(c, r * 0.1); c.stroke();
    c.fillStyle = C.ink; c.fillRect(x - r * 0.24, y - r * 0.24, r * 0.48, r * 0.48);
  };
  RR.star = function (c, x, y, r, on) {
    c.beginPath();
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.48 : r; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
    c.closePath();
    fillStroke(c, on ? C.glow : '#5A4350', Math.max(1.5, r * 0.14));
  };
  RR.lanternIcon = function (c, x, y, r, fill) {
    c.fillStyle = C.ink; c.fillRect(x - r * 0.35, y - r * 1.0, r * 0.7, r * 0.25); c.fillRect(x - r * 0.35, y + r * 0.75, r * 0.7, r * 0.25);
    ell(c, x, y - r * 0.0, r * 0.75, r * 0.85); fillStroke(c, fill || C.lantern, Math.max(1.5, r * 0.14));
    c.strokeStyle = 'rgba(42,22,32,0.45)'; lw(c, r * 0.08);
    c.beginPath(); c.ellipse(x, y, r * 0.35, r * 0.82, 0, 0, TAU); c.moveTo(x, y - r * 0.85); c.lineTo(x, y + r * 0.85); c.stroke();
  };
  RR.clock = function (c, x, y, r, col) {
    circ(c, x, y, r); c.strokeStyle = col; lw(c, r * 0.22); c.stroke();
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - r * 0.55); c.moveTo(x, y); c.lineTo(x + r * 0.45, y + r * 0.1); c.stroke();
  };
  RR.uiIcon = function (c, kind, x, y, s, col) {
    c.save(); c.fillStyle = col; c.strokeStyle = col; lw(c, s * 0.12);
    if (kind === 'pause') { rr(c, x - s * 0.32, y - s * 0.38, s * 0.22, s * 0.76, s * 0.06); c.fill(); rr(c, x + s * 0.1, y - s * 0.38, s * 0.22, s * 0.76, s * 0.06); c.fill(); }
    else if (kind === 'sound' || kind === 'mute') {
      c.beginPath(); c.moveTo(x - s * 0.45, y - s * 0.16); c.lineTo(x - s * 0.22, y - s * 0.16); c.lineTo(x + s * 0.05, y - s * 0.4); c.lineTo(x + s * 0.05, y + s * 0.4); c.lineTo(x - s * 0.22, y + s * 0.16); c.lineTo(x - s * 0.45, y + s * 0.16); c.closePath(); c.fill();
      if (kind === 'sound') { c.beginPath(); c.arc(x + s * 0.08, y, s * 0.22, -0.8, 0.8); c.stroke(); c.beginPath(); c.arc(x + s * 0.08, y, s * 0.4, -0.8, 0.8); c.stroke(); }
      else { c.beginPath(); c.moveTo(x + s * 0.18, y - s * 0.18); c.lineTo(x + s * 0.46, y + s * 0.18); c.moveTo(x + s * 0.46, y - s * 0.18); c.lineTo(x + s * 0.18, y + s * 0.18); c.stroke(); }
    } else if (kind === 'play') { c.beginPath(); c.moveTo(x - s * 0.25, y - s * 0.38); c.lineTo(x + s * 0.4, y); c.lineTo(x - s * 0.25, y + s * 0.38); c.closePath(); c.fill(); }
    else if (kind === 'retry') { c.beginPath(); c.arc(x, y, s * 0.32, -2.6, 2.2); c.stroke(); c.beginPath(); c.moveTo(x - s * 0.42, y - s * 0.42); c.lineTo(x - s * 0.08, y - s * 0.3); c.lineTo(x - s * 0.36, y - s * 0.06); c.closePath(); c.fill(); }
    else if (kind === 'home') { c.beginPath(); c.moveTo(x - s * 0.4, y); c.lineTo(x, y - s * 0.38); c.lineTo(x + s * 0.4, y); c.stroke(); c.fillRect(x - s * 0.26, y - s * 0.02, s * 0.52, s * 0.38); }
    else if (kind === 'lock') { rr(c, x - s * 0.3, y - s * 0.05, s * 0.6, s * 0.45, s * 0.08); c.fill(); c.beginPath(); c.arc(x, y - s * 0.08, s * 0.2, Math.PI, 0); c.stroke(); }
    c.restore();
  };

  // ---------- the tutorial hand ----------
  RR.hand = function (c, x, y, s, press) {
    c.save(); c.translate(x, y); c.rotate(-0.35); var k = press ? 0.9 : 1; c.scale(k, k);
    var w = Math.max(2, s * 0.07);
    rr(c, -s * 0.12, -s * 0.05, s * 0.24, s * 0.62, s * 0.12); fillStroke(c, C.cream, w); // finger
    rr(c, -s * 0.34, s * 0.32, s * 0.68, s * 0.58, s * 0.2); fillStroke(c, C.cream, w);   // palm
    c.strokeStyle = C.ink; lw(c, w * 0.8);
    c.beginPath(); c.moveTo(-s * 0.1, s * 0.34); c.lineTo(-s * 0.1, s * 0.5); c.moveTo(s * 0.08, s * 0.34); c.lineTo(s * 0.08, s * 0.5); c.stroke();
    rr(c, -s * 0.3, s * 0.82, s * 0.6, s * 0.16, s * 0.05); fillStroke(c, C.lantern, w);
    c.restore();
    if (press) { circ(c, x, y, s * 0.3); c.strokeStyle = 'rgba(255,196,107,0.8)'; lw(c, 3); c.stroke(); }
  };

  // ---------- customers ----------
  var FUR = ['#E6B98F', '#C98E62', '#8D5A3B', '#F2D7B6', '#B8B1C8', '#7E8CA8', '#D9A0A6', '#9FB59A', '#E3C46F'];
  var CLOTH = ['#2E5E4E', '#3F5A8A', '#6A4C93', '#C96E3A', '#2D3A4A', '#D9D2C0', '#8C2F45', '#4C8A6C'];
  RR.look = function (seed) {
    var r = RR.rng(seed);
    return { sp: Math.floor(r() * 6), fur: FUR[Math.floor(r() * FUR.length)], cloth: CLOTH[Math.floor(r() * CLOTH.length)],
      acc: Math.floor(r() * 6), acc2: CLOTH[Math.floor(r() * CLOTH.length)], h: 0.92 + r() * 0.16 };
  };
  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r * k); g = Math.round(g * k); b = Math.round(b * k);
    return 'rgb(' + Math.min(255, r) + ',' + Math.min(255, g) + ',' + Math.min(255, b) + ')';
  }
  RR.shade = shade;
  // mood: 0 neutral, 1 happy, 2 angry, 3 impatient. Draws the head centered at x,y with radius r and the torso below it.
  RR.customer = function (c, L, x, y, r, mood, t, vip) {
    var w = Math.max(1.5, r * 0.07), bob = Math.sin(t * 2.2) * r * 0.03;
    y += bob;
    // torso
    c.beginPath(); c.moveTo(x - r * 1.05, y + r * 2.4); c.quadraticCurveTo(x - r * 1.1, y + r * 0.9, x - r * 0.45, y + r * 0.78);
    c.lineTo(x + r * 0.45, y + r * 0.78); c.quadraticCurveTo(x + r * 1.1, y + r * 0.9, x + r * 1.05, y + r * 2.4); c.closePath();
    c.fillStyle = vip ? '#2A1620' : L.cloth; c.fill();
    c.save(); c.clip(); c.fillStyle = shade(vip ? '#2A1620' : L.cloth, 0.75); c.fillRect(x + r * 0.35, y, r * 2, r * 3); c.restore();
    lw(c, w); c.strokeStyle = C.ink; c.stroke();
    if (vip) { // gold lapels and a star pin
      c.strokeStyle = C.gold; lw(c, r * 0.1); c.beginPath(); c.moveTo(x - r * 0.4, y + r * 0.82); c.lineTo(x, y + r * 1.5); c.lineTo(x + r * 0.4, y + r * 0.82); c.stroke();
      RR.star(c, x - r * 0.62, y + r * 1.3, r * 0.2, true);
    } else if (L.acc === 5) { // scarf
      rr(c, x - r * 0.62, y + r * 0.68, r * 1.24, r * 0.3, r * 0.15); fillStroke(c, L.acc2, w);
    } else { // hoodie strings
      c.strokeStyle = C.cream; lw(c, r * 0.06); c.beginPath(); c.moveTo(x - r * 0.18, y + r * 0.85); c.lineTo(x - r * 0.2, y + r * 1.3); c.moveTo(x + r * 0.18, y + r * 0.85); c.lineTo(x + r * 0.2, y + r * 1.3); c.stroke();
    }
    var fur = L.fur, dark = shade(fur, 0.72);
    // ears behind the head
    c.fillStyle = fur;
    if (L.sp === 1 || L.sp === 3) { // cat / fox: pointed ears
      var big = L.sp === 3 ? 1.25 : 1;
      [-1, 1].forEach(function (sd) {
        c.beginPath(); c.moveTo(x + sd * r * 0.85, y - r * 0.2); c.lineTo(x + sd * r * 0.62 * big, y - r * 1.12 * big); c.lineTo(x + sd * r * 0.15, y - r * 0.8); c.closePath();
        fillStroke(c, fur, w);
        c.beginPath(); c.moveTo(x + sd * r * 0.7, y - r * 0.4); c.lineTo(x + sd * r * 0.6 * big, y - r * 0.92 * big); c.lineTo(x + sd * r * 0.32, y - r * 0.72); c.closePath();
        c.fillStyle = L.sp === 3 ? C.ink : '#E9A0A0'; c.fill();
      });
    } else if (L.sp === 2 || L.sp === 5) { // bear / raccoon: round ears
      [-1, 1].forEach(function (sd) { circ(c, x + sd * r * 0.72, y - r * 0.72, r * 0.32); fillStroke(c, fur, w); circ(c, x + sd * r * 0.72, y - r * 0.72, r * 0.15); c.fillStyle = dark; c.fill(); });
    } else if (L.sp === 4) { // rabbit: long ears
      [-1, 1].forEach(function (sd) { ell(c, x + sd * r * 0.38, y - r * 1.25, r * 0.22, r * 0.62, sd * 0.15); fillStroke(c, fur, w); ell(c, x + sd * r * 0.38, y - r * 1.2, r * 0.09, r * 0.42, sd * 0.15); c.fillStyle = '#E9A0A0'; c.fill(); });
    }
    // head with a cel-shade crescent
    circ(c, x, y, r); c.fillStyle = dark; c.fill();
    circ(c, x - r * 0.1, y - r * 0.08, r * 0.92); c.fillStyle = fur; c.fill();
    circ(c, x, y, r); lw(c, w); c.strokeStyle = C.ink; c.stroke();
    if (L.sp === 3 || L.sp === 2) { ell(c, x, y + r * 0.4, r * 0.48, r * 0.36); c.fillStyle = L.sp === 3 ? C.cream : shade(fur, 1.18); c.fill(); }
    if (L.sp === 5) { rr(c, x - r * 0.78, y - r * 0.22, r * 1.56, r * 0.38, r * 0.19); c.fillStyle = 'rgba(42,22,32,0.7)'; c.fill(); }
    if (L.sp === 0) { // hair tuft
      c.beginPath(); c.moveTo(x - r * 0.95, y - r * 0.15); c.quadraticCurveTo(x - r * 0.9, y - r * 1.15, x + r * 0.1, y - r * 1.02);
      c.quadraticCurveTo(x + r * 0.95, y - r * 0.95, x + r * 0.95, y - r * 0.15); c.quadraticCurveTo(x + r * 0.5, y - r * 0.6, x - r * 0.1, y - r * 0.45); c.quadraticCurveTo(x - r * 0.6, y - r * 0.4, x - r * 0.95, y - r * 0.15);
      fillStroke(c, shade(L.cloth, 0.6), w);
    }
    // face
    var ey = y - r * 0.05, ex = r * 0.34;
    c.fillStyle = C.ink; c.strokeStyle = C.ink;
    if (vip) { // shades
      rr(c, x - r * 0.68, ey - r * 0.16, r * 0.58, r * 0.3, r * 0.1); c.fill(); rr(c, x + r * 0.1, ey - r * 0.16, r * 0.58, r * 0.3, r * 0.1); c.fill();
      c.fillRect(x - r * 0.12, ey - r * 0.08, r * 0.24, r * 0.06);
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(x - r * 0.55, ey - r * 0.1, r * 0.14, r * 0.05); c.fillRect(x + r * 0.23, ey - r * 0.1, r * 0.14, r * 0.05);
    } else if (mood === 1) {
      lw(c, r * 0.1); c.beginPath(); c.arc(x - ex, ey + r * 0.06, r * 0.13, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      c.beginPath(); c.arc(x + ex, ey + r * 0.06, r * 0.13, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    } else {
      ell(c, x - ex, ey, r * 0.1, r * 0.13); c.fill(); ell(c, x + ex, ey, r * 0.1, r * 0.13); c.fill();
      c.fillStyle = '#fff'; circ(c, x - ex + r * 0.03, ey - r * 0.05, r * 0.035); c.fill(); circ(c, x + ex + r * 0.03, ey - r * 0.05, r * 0.035); c.fill();
      if (mood === 2) { c.strokeStyle = C.ink; lw(c, r * 0.09); c.beginPath(); c.moveTo(x - ex - r * 0.16, ey - r * 0.28); c.lineTo(x - ex + r * 0.12, ey - r * 0.18); c.moveTo(x + ex + r * 0.16, ey - r * 0.28); c.lineTo(x + ex - r * 0.12, ey - r * 0.18); c.stroke(); }
    }
    if (L.acc === 3 && !vip) { c.strokeStyle = C.ink; lw(c, r * 0.06); circ(c, x - ex, ey, r * 0.22); c.stroke(); circ(c, x + ex, ey, r * 0.22); c.stroke(); c.beginPath(); c.moveTo(x - ex + r * 0.22, ey); c.lineTo(x + ex - r * 0.22, ey); c.stroke(); }
    // mouth
    c.strokeStyle = C.ink; lw(c, r * 0.07); c.beginPath();
    var my = y + r * 0.38;
    if (mood === 1) { c.arc(x, my - r * 0.06, r * 0.16, 0.2, Math.PI - 0.2); }
    else if (mood === 2) { c.arc(x, my + r * 0.12, r * 0.14, Math.PI + 0.3, -0.3); }
    else if (mood === 3) { c.moveTo(x - r * 0.12, my); c.lineTo(x + r * 0.12, my); }
    else { c.arc(x, my - r * 0.08, r * 0.1, 0.4, Math.PI - 0.4); }
    c.stroke();
    if (mood === 1) { c.fillStyle = 'rgba(232,72,59,0.35)'; ell(c, x - r * 0.55, y + r * 0.22, r * 0.14, r * 0.08); c.fill(); ell(c, x + r * 0.55, y + r * 0.22, r * 0.14, r * 0.08); c.fill(); }
    if (mood === 3) { // sweat drop
      c.beginPath(); var sx = x + r * 0.85, sy = y - r * 0.45 + Math.sin(t * 5) * r * 0.04;
      c.moveTo(sx, sy - r * 0.2); c.quadraticCurveTo(sx + r * 0.14, sy + r * 0.02, sx, sy + r * 0.08); c.quadraticCurveTo(sx - r * 0.14, sy + r * 0.02, sx, sy - r * 0.2);
      fillStroke(c, '#9FD8F0', w * 0.7);
    }
    if (mood === 2) { // a puff of steam from the head
      c.save(); c.globalAlpha = 0.7; circ(c, x + r * 0.75, y - r * 0.95, r * 0.18); fillStroke(c, C.cream, w * 0.6); circ(c, x + r * 0.98, y - r * 1.12, r * 0.12); fillStroke(c, C.cream, w * 0.6); c.restore();
    }
    // accessories on top
    if (vip) {
      c.beginPath(); c.moveTo(x - r * 0.55, y - r * 0.78); c.lineTo(x - r * 0.5, y - r * 1.28); c.lineTo(x - r * 0.22, y - r * 1.05); c.lineTo(x, y - r * 1.35);
      c.lineTo(x + r * 0.22, y - r * 1.05); c.lineTo(x + r * 0.5, y - r * 1.28); c.lineTo(x + r * 0.55, y - r * 0.78); c.closePath(); fillStroke(c, C.gold, w);
    } else if (L.acc === 1) { // beanie
      c.beginPath(); c.moveTo(x - r * 0.98, y - r * 0.25); c.quadraticCurveTo(x - r, y - r * 1.2, x, y - r * 1.15); c.quadraticCurveTo(x + r, y - r * 1.2, x + r * 0.98, y - r * 0.25); c.closePath();
      fillStroke(c, L.acc2, w); rr(c, x - r * 1.0, y - r * 0.42, r * 2.0, r * 0.3, r * 0.12); fillStroke(c, shade(L.acc2, 0.8), w);
    } else if (L.acc === 2) { // headphones
      c.strokeStyle = C.ink; lw(c, r * 0.14); c.beginPath(); c.arc(x, y - r * 0.05, r * 1.02, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
      rr(c, x - r * 1.18, y - r * 0.3, r * 0.32, r * 0.55, r * 0.14); fillStroke(c, L.acc2, w); rr(c, x + r * 0.86, y - r * 0.3, r * 0.32, r * 0.55, r * 0.14); fillStroke(c, L.acc2, w);
    } else if (L.acc === 4) { // cap, peak to the side
      c.beginPath(); c.moveTo(x - r * 0.92, y - r * 0.35); c.quadraticCurveTo(x - r * 0.9, y - r * 1.15, x, y - r * 1.1); c.quadraticCurveTo(x + r * 0.9, y - r * 1.15, x + r * 0.92, y - r * 0.35); c.closePath();
      fillStroke(c, L.acc2, w); ell(c, x + r * 0.95, y - r * 0.42, r * 0.5, r * 0.14, -0.15); fillStroke(c, shade(L.acc2, 0.75), w);
    }
  };

  // ---------- backdrop ----------
  RR.lantern = function (c, x, y, r, t, phase) {
    var sw = Math.sin(t * 0.9 + phase) * 0.06;
    c.save(); c.translate(x, y); c.rotate(sw);
    var g = c.createRadialGradient(0, r * 1.3, r * 0.2, 0, r * 1.3, r * 2.6);
    g.addColorStop(0, 'rgba(255,196,107,0.35)'); g.addColorStop(1, 'rgba(255,196,107,0)');
    c.fillStyle = g; circ(c, 0, r * 1.3, r * 2.6); c.fill();
    c.strokeStyle = C.ink; lw(c, 2); c.beginPath(); c.moveTo(0, -r * 0.4); c.lineTo(0, r * 0.3); c.stroke();
    rr(c, -r * 0.45, r * 0.25, r * 0.9, r * 0.22, r * 0.06); fillStroke(c, C.ink, 0);
    ell(c, 0, r * 1.3, r * 0.95, r * 0.9); fillStroke(c, C.lantern, 2.5);
    c.save(); ell(c, 0, r * 1.3, r * 0.95, r * 0.9); c.clip();
    c.fillStyle = 'rgba(255,196,107,0.35)'; ell(c, -r * 0.25, r * 1.15, r * 0.45, r * 0.6); c.fill();
    c.strokeStyle = 'rgba(42,22,32,0.4)'; lw(c, 1.5);
    for (var i = -2; i <= 2; i++) { c.beginPath(); c.ellipse(0, r * 1.3, Math.abs(i) * r * 0.32 + 0.1, r * 0.9, 0, 0, TAU); c.stroke(); }
    c.restore();
    rr(c, -r * 0.45, r * 2.12, r * 0.9, r * 0.2, r * 0.06); fillStroke(c, C.ink, 0);
    c.strokeStyle = C.glow; lw(c, 2); c.beginPath(); c.moveTo(0, r * 2.3); c.lineTo(0, r * 2.7); c.stroke();
    c.restore();
  };

  // Static scenery for a given layout, rendered to an offscreen canvas once per resize.
  RR.backdrop = function (c, W, H, L) {
    var cy = L.counterY, g = c.createLinearGradient(0, 0, 0, cy);
    g.addColorStop(0, C.night); g.addColorStop(0.55, C.dusk); g.addColorStop(1, '#5B2C38');
    c.fillStyle = g; c.fillRect(0, 0, W, cy + 4);
    var r = RR.rng(9);
    // distant stalls
    var x = -20;
    while (x < W + 40) {
      var sw = 70 + r() * 90, sh = cy * (0.22 + r() * 0.18), top = cy * 0.62 - sh * 0.4;
      c.fillStyle = '#2B1824'; rr(c, x, top, sw, cy - top, 6); c.fill();
      c.fillStyle = r() < 0.5 ? '#6B2A30' : '#3D4A3E';
      c.beginPath(); c.moveTo(x - 8, top + 6); c.lineTo(x + sw / 2, top - 18); c.lineTo(x + sw + 8, top + 6); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,196,107,' + (0.22 + r() * 0.2) + ')'; rr(c, x + sw * 0.15, top + 16, sw * 0.7, Math.min(26, sh * 0.35), 4); c.fill();
      x += sw + 10 + r() * 30;
    }
    // string lights
    for (var row = 0; row < 2; row++) {
      var y0 = cy * (0.22 + row * 0.16), sag = cy * 0.08, n = Math.max(6, Math.round(W / 46));
      c.strokeStyle = 'rgba(20,8,14,0.85)'; lw(c, 1.5);
      c.beginPath(); for (var i = 0; i <= 40; i++) { var u = i / 40; c.lineTo(u * W, y0 + Math.sin(u * Math.PI) * sag); } c.stroke();
      for (var k = 0; k <= n; k++) {
        var uu = (k + (row ? 0.5 : 0)) / n, bx = uu * W, by = y0 + Math.sin(uu * Math.PI) * sag + 5;
        var gg = c.createRadialGradient(bx, by, 0, bx, by, 16);
        gg.addColorStop(0, 'rgba(255,196,107,0.55)'); gg.addColorStop(1, 'rgba(255,196,107,0)');
        c.fillStyle = gg; circ(c, bx, by, 16); c.fill();
        c.fillStyle = k % 3 === 0 ? '#FFD9A0' : k % 3 === 1 ? C.glow : '#FF9A6B'; circ(c, bx, by, 3.6); c.fill();
      }
    }
    // our awning across the top
    var aw = Math.max(26, Math.min(44, H * 0.05));
    c.fillStyle = C.lantern; c.fillRect(0, 0, W, aw);
    c.fillStyle = C.lanternDeep; c.fillRect(0, aw - 6, W, 6);
    var sc = Math.max(28, W / Math.round(W / 40));
    for (var s = 0; s < W + sc; s += sc) {
      c.beginPath(); c.arc(s + sc / 2, aw, sc / 2, 0, Math.PI); c.fillStyle = (s / sc) % 2 ? C.lantern : C.cream; c.fill();
      lw(c, 2); c.strokeStyle = C.ink; c.stroke();
    }
    c.fillStyle = C.ink; c.fillRect(0, 0, W, 3);
    // the counter the customers lean on
    var ch = L.counterH;
    c.fillStyle = C.woodLight; c.fillRect(0, cy, W, 8);
    c.fillStyle = C.wood; c.fillRect(0, cy + 8, W, ch - 8);
    c.strokeStyle = 'rgba(78,42,27,0.45)'; lw(c, 2);
    for (var j = 0; j < 4; j++) { c.beginPath(); var gy = cy + 14 + j * (ch - 18) / 4; c.moveTo(0, gy); for (var q = 0; q <= W; q += 30) c.lineTo(q, gy + Math.sin(q * 0.03 + j) * 2); c.stroke(); }
    c.fillStyle = C.ink; c.fillRect(0, cy - 2, W, 3); c.fillRect(0, cy + ch, W, 3);
    // the kitchen side
    var ky = cy + ch + 3;
    var kg = c.createLinearGradient(0, ky, 0, H);
    kg.addColorStop(0, '#3A2028'); kg.addColorStop(1, '#2A1620');
    c.fillStyle = kg; c.fillRect(0, ky, W, H - ky);
    c.strokeStyle = 'rgba(255,196,107,0.05)'; lw(c, 2);
    for (var p = ky + 40; p < H; p += 48) { c.beginPath(); c.moveTo(0, p); c.lineTo(W, p); c.stroke(); }
  };
})();
