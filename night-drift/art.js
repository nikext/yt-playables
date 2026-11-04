/*
 * Night Drift: palette, pre-rendered sprites and vector drawings (all drawn in code).
 * Glow is never made with shadowBlur: it comes from pre-rendered radial sprites or from
 * layered wide, low-alpha strokes.
 */
(function () {
  'use strict';

  var PAL = {
    night: '#140F2D', deep: '#0C0920', night2: '#1C1542', road: '#2A1F4F', roadHi: '#35296A',
    shoulder: '#0F0B25', grid: '#3E2C80', violet: '#8B5CF6', violetD: '#4A2E96', violetL: '#BCA6FF',
    magenta: '#FF2E88', cyan: '#2EE6FF', sun: '#FF9E3D', sunY: '#FFD84D', white: '#F6F2FF',
    ink: '#F6F2FF', inkSoft: '#C3B8EC', inkDim: '#9C90CC', btn: '#E0156F', btnHi: '#FF4D9C',
    panel: '#1B1443', panelHi: '#261C5A', panelEdge: '#4A3698', skid: '#06041A', glass: '#160F33',
    kerb: '#3A1A5E', silhouette: '#221748', red: '#FF3B5C', gold: '#FFC83D'
  };
  var FONT = 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';

  // paint jobs: body, side shade, highlight, stripe. cost > 0 = tokens, cost < 0 = best-score milestone
  var PAINTS = [
    { body: '#FF2E88', dark: '#A8125A', light: '#FF86BC', stripe: '#2EE6FF', cost: 0 },
    { body: '#2EE6FF', dark: '#11819B', light: '#A6F6FF', stripe: '#FF2E88', cost: 30 },
    { body: '#FF9E3D', dark: '#B25A14', light: '#FFCB91', stripe: '#6A2BC2', cost: 60 },
    { body: '#8B5CF6', dark: '#4E2BAE', light: '#BFA4FF', stripe: '#FFD84D', cost: 100 },
    { body: '#E9E3FF', dark: '#8F82C4', light: '#FFFFFF', stripe: '#FF2E88', cost: 160 },
    { body: '#FFC83D', dark: '#A8781A', light: '#FFE7A0', stripe: '#140F2D', cost: -5000 }
  ];
  var SPECTRUM = ['#FF2E88', '#FF5E6E', '#FF9E3D', '#FFD84D', '#7DF27A', '#2EE6FF', '#5B8CFF', '#8B5CF6', '#D35CF6'];
  var TRAILS = [
    { col: '#FF2E88', cost: 0 },
    { col: '#2EE6FF', cost: 40 },
    { col: '#FF9E3D', cost: 80 },
    { col: '#E2DAFF', cost: 140 },
    { col: '#FF2E88', cost: -3000, spectrum: true }
  ];

  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }

  function glowSprite(hex) {
    var c = mk(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(hex, 0.9)); gr.addColorStop(0.22, rgba(hex, 0.5));
    gr.addColorStop(0.55, rgba(hex, 0.14)); gr.addColorStop(1, rgba(hex, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  }
  var GLOW = {
    magenta: glowSprite(PAL.magenta), cyan: glowSprite(PAL.cyan), sun: glowSprite(PAL.sun),
    white: glowSprite('#FFF4DA'), violet: glowSprite(PAL.violet), red: glowSprite(PAL.red), gold: glowSprite(PAL.gold)
  };
  var TRAIL_GLOW = [GLOW.magenta, GLOW.cyan, GLOW.sun, GLOW.white, GLOW.violet];

  // headlight cone: a soft trapezoid that fades with distance (drawn with 'lighter')
  var CONE = (function () {
    var c = mk(256, 128), g = c.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 256, 0);
    gr.addColorStop(0, 'rgba(255,240,205,0.55)'); gr.addColorStop(0.35, 'rgba(255,225,190,0.22)');
    gr.addColorStop(1, 'rgba(255,200,180,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, 50); g.lineTo(256, 0); g.lineTo(256, 128); g.lineTo(0, 78); g.closePath(); g.fill();
    return c;
  })();

  // ------------------------------------------------------------------ shape helpers
  function rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r);
    g.lineTo(x + w, y + h - r); g.arcTo(x + w, y + h, x + w - r, y + h, r);
    g.lineTo(x + r, y + h); g.arcTo(x, y + h, x, y + h - r, r);
    g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r); g.closePath();
  }
  function poly(g, a, sx, sy) {
    g.beginPath(); g.moveTo(a[0] * sx, a[1] * sy);
    for (var i = 2; i < a.length; i += 2) g.lineTo(a[i] * sx, a[i + 1] * sy);
    g.closePath();
  }

  // ------------------------------------------------------------------ top-down car
  // Original retro wedge coupe. Local units: forward = +x, length 2.7, width ~1.3.
  var BODY = [-1.32, -0.6, -1.38, -0.44, -1.38, 0.44, -1.32, 0.6, 0.85, 0.63, 1.26, 0.52, 1.4, 0.3, 1.4, -0.3, 1.26, -0.52, 0.85, -0.63];
  var TOP = [-1.2, -0.45, -1.26, -0.34, -1.26, 0.34, -1.2, 0.45, 0.85, 0.48, 1.22, 0.38, 1.3, 0.22, 1.3, -0.22, 1.22, -0.38, 0.85, -0.48];
  var SCREEN = [0.12, -0.47, 0.6, -0.39, 0.66, 0, 0.6, 0.39, 0.12, 0.47];
  var REARW = [-0.82, -0.36, -0.5, -0.44, -0.5, 0.44, -0.82, 0.36];

  function wheel(g, x, y, a) {
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = '#0A0716'; g.fillRect(-0.27, -0.14, 0.54, 0.28);
    g.fillStyle = '#3B2F66'; g.fillRect(-0.15, -0.14, 0.3, 0.05);
    g.restore();
  }

  /** Draws the car at the origin facing +x. steer = front wheel angle, brake 0..1 brightens the tail lights. */
  function drawCarTop(g, paint, steer, brake) {
    var P = PAINTS[paint] || PAINTS[0];
    // shadow
    g.globalAlpha = 0.45; g.fillStyle = '#05030F';
    rr(g, -1.45, -0.72, 2.95, 1.5, 0.45); g.fill();
    g.globalAlpha = 1;
    wheel(g, -0.86, -0.63, 0); wheel(g, -0.86, 0.63, 0);
    wheel(g, 0.86, -0.63, steer); wheel(g, 0.86, 0.63, steer);
    g.fillStyle = P.dark; poly(g, BODY, 1, 1); g.fill();
    g.fillStyle = P.body; poly(g, TOP, 1, 1); g.fill();
    // racing stripes
    g.fillStyle = P.stripe;
    g.fillRect(-1.26, -0.2, 2.5, 0.1); g.fillRect(-1.26, 0.1, 2.5, 0.1);
    // hood vents
    g.fillStyle = P.dark; g.fillRect(0.75, -0.3, 0.07, 0.6); g.fillRect(0.9, -0.26, 0.07, 0.52);
    // cabin: windshield, roof, rear window
    g.fillStyle = PAL.glass; poly(g, SCREEN, 1, 1); g.fill();
    poly(g, REARW, 1, 1); g.fill();
    g.fillStyle = P.light; rr(g, -0.5, -0.43, 0.64, 0.86, 0.12); g.fill();
    g.fillStyle = P.body; rr(g, -0.44, -0.36, 0.52, 0.72, 0.1); g.fill();
    g.strokeStyle = 'rgba(46,230,255,0.55)'; g.lineWidth = 0.05;
    g.beginPath(); g.moveTo(0.22, -0.36); g.lineTo(0.5, -0.12); g.stroke();
    // pop-up headlights
    g.fillStyle = '#FFF3C8'; g.fillRect(1.2, -0.44, 0.12, 0.2); g.fillRect(1.2, 0.24, 0.12, 0.2);
    // tail light bar
    g.fillStyle = PAL.red; g.fillRect(-1.39, -0.44, 0.08, 0.88);
    g.globalAlpha = 0.5 + 0.5 * (brake || 0); g.fillStyle = '#FFC2CF'; g.fillRect(-1.39, -0.3, 0.05, 0.6); g.globalAlpha = 1;
    // spoiler
    g.fillStyle = '#120C2A'; g.fillRect(-1.3, -0.62, 0.14, 1.24);
    g.fillStyle = P.light; g.fillRect(-1.3, -0.62, 0.04, 1.24);
  }

  // ------------------------------------------------------------------ rear-view car (title screen)
  function drawCarRear(g, x, y, w, paint, t) {
    var P = PAINTS[paint] || PAINTS[0];
    g.save(); g.translate(x, y); g.scale(w, w);
    // ground glow + shadow
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.5; g.drawImage(GLOW.magenta, -0.75, -0.2, 1.5, 0.36);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.7; g.fillStyle = '#05030F';
    g.beginPath(); g.ellipse(0, 0.005, 0.6, 0.05, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    // tires
    g.fillStyle = '#0A0716'; rr(g, -0.52, -0.17, 0.16, 0.17, 0.03); g.fill(); rr(g, 0.36, -0.17, 0.16, 0.17, 0.03); g.fill();
    // lower body
    g.fillStyle = P.dark; rr(g, -0.52, -0.31, 1.04, 0.22, 0.04); g.fill();
    // upper body (wedge)
    g.fillStyle = P.body;
    g.beginPath(); g.moveTo(-0.52, -0.29); g.lineTo(-0.45, -0.41); g.lineTo(0.45, -0.41); g.lineTo(0.52, -0.29); g.closePath(); g.fill();
    // cabin
    g.fillStyle = P.dark;
    g.beginPath(); g.moveTo(-0.38, -0.41); g.lineTo(-0.27, -0.56); g.lineTo(0.27, -0.56); g.lineTo(0.38, -0.41); g.closePath(); g.fill();
    var gl = g.createLinearGradient(0, -0.55, 0, -0.42);
    gl.addColorStop(0, '#3A2C7A'); gl.addColorStop(1, PAL.glass);
    g.fillStyle = gl;
    g.beginPath(); g.moveTo(-0.33, -0.42); g.lineTo(-0.25, -0.535); g.lineTo(0.25, -0.535); g.lineTo(0.33, -0.42); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(46,230,255,0.5)'; g.lineWidth = 0.012;
    g.beginPath(); g.moveTo(-0.2, -0.43); g.lineTo(-0.12, -0.525); g.stroke();
    // spoiler
    g.fillStyle = '#120C2A'; g.fillRect(-0.49, -0.47, 0.98, 0.035); g.fillRect(-0.4, -0.44, 0.03, 0.04); g.fillRect(0.37, -0.44, 0.03, 0.04);
    g.fillStyle = P.light; g.fillRect(-0.49, -0.47, 0.98, 0.01);
    // stripes
    g.fillStyle = P.stripe; g.fillRect(-0.09, -0.41, 0.06, 0.12); g.fillRect(0.03, -0.41, 0.06, 0.12);
    // tail light bar with glow
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.55 + 0.1 * Math.sin((t || 0) * 2);
    g.drawImage(GLOW.red, -0.75, -0.42, 1.5, 0.3);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = PAL.red; g.fillRect(-0.47, -0.27, 0.94, 0.06);
    g.fillStyle = '#FFC2CF'; g.fillRect(-0.45, -0.255, 0.9, 0.02);
    // plate (blank) and exhausts
    g.fillStyle = '#0F0A24'; rr(g, -0.09, -0.19, 0.18, 0.07, 0.01); g.fill();
    g.strokeStyle = P.light; g.lineWidth = 0.008; rr(g, -0.09, -0.19, 0.18, 0.07, 0.01); g.stroke();
    g.fillStyle = '#05030F'; g.beginPath(); g.ellipse(-0.3, -0.11, 0.04, 0.02, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(0.3, -0.11, 0.04, 0.02, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  // ------------------------------------------------------------------ striped sun (pre-rendered)
  function makeSun(r) {
    var R = Math.max(4, Math.round(r)), c = mk(R * 2, R * 2), g = c.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 0, R * 2);
    gr.addColorStop(0, PAL.sunY); gr.addColorStop(0.45, PAL.sun); gr.addColorStop(1, PAL.magenta);
    g.fillStyle = gr; g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (var i = 0; i < 8; i++) {
      var f = i / 8, yy = R * (0.95 + f * 1.05), hh = R * (0.025 + f * 0.07);
      g.fillRect(0, yy, R * 2, hh);
    }
    return c;
  }

  // ------------------------------------------------------------------ icons
  function iconPause(g, x, y, s, col) {
    g.fillStyle = col;
    rr(g, x - s * 0.3, y - s * 0.32, s * 0.2, s * 0.64, s * 0.06); g.fill();
    rr(g, x + s * 0.1, y - s * 0.32, s * 0.2, s * 0.64, s * 0.06); g.fill();
  }
  function iconPlay(g, x, y, s, col) {
    g.fillStyle = col; g.beginPath();
    g.moveTo(x - s * 0.24, y - s * 0.34); g.lineTo(x + s * 0.36, y); g.lineTo(x - s * 0.24, y + s * 0.34); g.closePath(); g.fill();
  }
  function iconHome(g, x, y, s, col) {
    g.fillStyle = col; g.beginPath();
    g.moveTo(x, y - s * 0.38); g.lineTo(x + s * 0.4, y - s * 0.02); g.lineTo(x + s * 0.28, y - s * 0.02);
    g.lineTo(x + s * 0.28, y + s * 0.34); g.lineTo(x + s * 0.08, y + s * 0.34); g.lineTo(x + s * 0.08, y + s * 0.1);
    g.lineTo(x - s * 0.08, y + s * 0.1); g.lineTo(x - s * 0.08, y + s * 0.34); g.lineTo(x - s * 0.28, y + s * 0.34);
    g.lineTo(x - s * 0.28, y - s * 0.02); g.lineTo(x - s * 0.4, y - s * 0.02); g.closePath(); g.fill();
  }
  function iconSound(g, x, y, s, col, on) {
    g.fillStyle = col; g.beginPath();
    g.moveTo(x - s * 0.38, y - s * 0.12); g.lineTo(x - s * 0.2, y - s * 0.12); g.lineTo(x + s * 0.02, y - s * 0.32);
    g.lineTo(x + s * 0.02, y + s * 0.32); g.lineTo(x - s * 0.2, y + s * 0.12); g.lineTo(x - s * 0.38, y + s * 0.12); g.closePath(); g.fill();
    g.strokeStyle = col; g.lineWidth = s * 0.08; g.lineCap = 'round';
    if (on) {
      g.beginPath(); g.arc(x + s * 0.06, y, s * 0.16, -0.9, 0.9); g.stroke();
      g.beginPath(); g.arc(x + s * 0.06, y, s * 0.3, -0.9, 0.9); g.stroke();
    } else {
      g.beginPath(); g.moveTo(x + s * 0.14, y - s * 0.14); g.lineTo(x + s * 0.4, y + s * 0.14);
      g.moveTo(x + s * 0.4, y - s * 0.14); g.lineTo(x + s * 0.14, y + s * 0.14); g.stroke();
    }
    g.lineCap = 'butt';
  }
  function iconRetry(g, x, y, s, col) {
    g.strokeStyle = col; g.lineWidth = s * 0.11; g.lineCap = 'round';
    g.beginPath(); g.arc(x, y, s * 0.28, -2.6, 2.2); g.stroke(); g.lineCap = 'butt';
    var ax = x + Math.cos(-2.6) * s * 0.28, ay = y + Math.sin(-2.6) * s * 0.28;
    g.fillStyle = col; g.beginPath();
    g.moveTo(ax - s * 0.2, ay - s * 0.06); g.lineTo(ax + s * 0.08, ay - s * 0.16); g.lineTo(ax + s * 0.02, ay + s * 0.14); g.closePath(); g.fill();
  }
  function iconLock(g, x, y, s, col) {
    g.fillStyle = col; rr(g, x - s * 0.26, y - s * 0.04, s * 0.52, s * 0.4, s * 0.06); g.fill();
    g.strokeStyle = col; g.lineWidth = s * 0.09;
    g.beginPath(); g.arc(x, y - s * 0.06, s * 0.17, Math.PI, 0); g.stroke();
  }
  function iconToken(g, x, y, s, col, core) {
    g.fillStyle = col; g.beginPath();
    g.moveTo(x, y - s * 0.42); g.lineTo(x + s * 0.3, y); g.lineTo(x, y + s * 0.42); g.lineTo(x - s * 0.3, y); g.closePath(); g.fill();
    g.fillStyle = core || '#E8FDFF'; g.beginPath();
    g.moveTo(x, y - s * 0.2); g.lineTo(x + s * 0.13, y); g.lineTo(x, y + s * 0.2); g.lineTo(x - s * 0.13, y); g.closePath(); g.fill();
  }
  function iconTrophy(g, x, y, s, col) {
    g.fillStyle = col; g.beginPath();
    g.moveTo(x - s * 0.3, y - s * 0.34); g.lineTo(x + s * 0.3, y - s * 0.34); g.lineTo(x + s * 0.24, y - s * 0.02);
    g.quadraticCurveTo(x, y + s * 0.16, x - s * 0.24, y - s * 0.02); g.closePath(); g.fill();
    g.fillRect(x - s * 0.06, y + s * 0.04, s * 0.12, s * 0.16);
    rr(g, x - s * 0.22, y + s * 0.2, s * 0.44, s * 0.12, s * 0.03); g.fill();
    g.strokeStyle = col; g.lineWidth = s * 0.07;
    g.beginPath(); g.arc(x - s * 0.3, y - s * 0.16, s * 0.12, Math.PI * 0.5, Math.PI * 1.5); g.stroke();
    g.beginPath(); g.arc(x + s * 0.3, y - s * 0.16, s * 0.12, -Math.PI * 0.5, Math.PI * 0.5); g.stroke();
  }
  function iconBack(g, x, y, s, col) {
    g.strokeStyle = col; g.lineWidth = s * 0.12; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x + s * 0.3, y); g.lineTo(x - s * 0.28, y);
    g.moveTo(x - s * 0.06, y - s * 0.24); g.lineTo(x - s * 0.3, y); g.lineTo(x - s * 0.06, y + s * 0.24); g.stroke();
    g.lineCap = 'butt'; g.lineJoin = 'miter';
  }
  function iconBolt(g, x, y, s, col) {
    g.fillStyle = col; g.beginPath();
    g.moveTo(x + s * 0.08, y - s * 0.42); g.lineTo(x - s * 0.24, y + s * 0.06); g.lineTo(x - s * 0.02, y + s * 0.06);
    g.lineTo(x - s * 0.1, y + s * 0.42); g.lineTo(x + s * 0.24, y - s * 0.08); g.lineTo(x + s * 0.02, y - s * 0.08); g.closePath(); g.fill();
  }
  /** Garage icon: a tiny top-down car. */
  function iconCar(g, x, y, s, col) {
    g.save(); g.translate(x, y); g.rotate(-Math.PI / 2); g.scale(s * 0.3, s * 0.3);
    g.fillStyle = col; poly(g, BODY, 1, 1); g.fill();
    g.fillStyle = PAL.night; poly(g, SCREEN, 1, 1); g.fill(); poly(g, REARW, 1, 1); g.fill();
    g.restore();
  }
  function iconHull(g, x, y, s, full, col) {
    // hexagonal shield pip; full is 0..1
    g.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 6 + i * Math.PI / 3, px = x + Math.cos(a) * s * 0.46, py = y + Math.sin(a) * s * 0.46;
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath();
    g.fillStyle = '#2A1F57'; g.fill();
    if (full > 0) {
      g.save(); g.clip();
      g.fillStyle = col; g.fillRect(x - s, y + s * 0.46 - s * 0.92 * full, s * 2, s * 0.92 * full);
      g.restore();
    }
    g.strokeStyle = full > 0.01 ? col : '#6A5AA6'; g.lineWidth = Math.max(1.5, s * 0.08); g.stroke();
  }

  window.NDArt = {
    PAL: PAL, FONT: FONT, PAINTS: PAINTS, TRAILS: TRAILS, SPECTRUM: SPECTRUM, GLOW: GLOW, TRAIL_GLOW: TRAIL_GLOW, CONE: CONE,
    rgba: rgba, mk: mk, rr: rr, makeSun: makeSun, drawCarTop: drawCarTop, drawCarRear: drawCarRear,
    iconPause: iconPause, iconPlay: iconPlay, iconHome: iconHome, iconSound: iconSound, iconRetry: iconRetry,
    iconLock: iconLock, iconToken: iconToken, iconTrophy: iconTrophy, iconBack: iconBack, iconBolt: iconBolt,
    iconCar: iconCar, iconHull: iconHull
  };
})();
