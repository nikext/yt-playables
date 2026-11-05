/*
 * holes.js: Putt Garden's 27 handcrafted holes (3 courses x 9).
 *
 * World units, y down (see physics.js for every field). Holes are laid out portrait,
 * inside roughly 600 x 1000; the game rotates the view in landscape.
 *   par    strokes for par;  tip  one-line tip key shown the first time the hole opens
 *   shots  reference solution [[angleDeg, power 0..1, wait s before the putt], ...].
 *          tools/putt-garden-verify.cjs replays it through physics.js and checks that the
 *          ball drops within par.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- shape helpers
  var D2R = Math.PI / 180;
  function r1(v) { return Math.round(v * 10) / 10; }
  function rect(x, y, w, h) { return [x, y, x + w, y, x + w, y + h, x, y + h]; }
  // arc from a0 to a1 degrees (inclusive), n segments
  function arc(cx, cy, rx, ry, a0, a1, n) {
    var p = [];
    for (var i = 0; i <= n; i++) {
      var a = (a0 + (a1 - a0) * i / n) * D2R;
      p.push(r1(cx + Math.cos(a) * rx), r1(cy + Math.sin(a) * ry));
    }
    return p;
  }
  function ellipse(cx, cy, rx, ry, n) { var p = arc(cx, cy, rx, ry, 0, 360, n || 24); p.length -= 2; return p; }
  function rrect(x, y, w, h, r, n) {
    n = n || 4;
    return [].concat(
      arc(x + w - r, y + r, r, r, -90, 0, n), arc(x + w - r, y + h - r, r, r, 0, 90, n),
      arc(x + r, y + h - r, r, r, 90, 180, n), arc(x + r, y + r, r, r, 180, 270, n));
  }
  // closed annular sector (a ring piece), degrees
  function ring(cx, cy, r0, r1_, a0, a1, n) {
    return [].concat(arc(cx, cy, r1_, r1_, a0, a1, n), arc(cx, cy, r0, r0, a1, a0, n));
  }
  function cat() { var o = []; for (var i = 0; i < arguments.length; i++) o = o.concat(arguments[i]); return o; }

  var holes = [
    // =============================================================== Meadow
    { id: 'meadow-1', par: 2, tip: 'drag',
      out: rrect(190, 120, 220, 780, 70, 5), tee: [300, 810], cup: [300, 250],
      shots: [[222, 0.9, 0]] },
    { id: 'meadow-2', par: 2, tip: 'bank',
      out: [100, 950, 300, 950, 300, 330, 520, 330, 520, 100, 230, 100, 100, 230], tee: [200, 860], cup: [440, 215],
      shots: [[238, 0.98, 0], [6, 0.42, 0]] },
    { id: 'meadow-3', par: 2,
      out: [170, 90, 430, 90, 520, 180, 520, 830, 430, 920, 170, 920, 80, 830, 80, 180], tee: [300, 850], cup: [300, 190],
      blocks: [[300, 420, 390, 520, 300, 620, 210, 520]],
      shots: [[232, 0.86, 0]] },
    { id: 'meadow-4', par: 2, tip: 'curve',
      out: ellipse(300, 500, 250, 410, 40), tee: [300, 850], cup: [300, 150],
      blocks: [ellipse(300, 500, 110, 150, 20)],
      shots: [[232, 0.94, 0], [94, 0.1, 0]] },
    { id: 'meadow-5', par: 2, tip: 'posts',
      out: rrect(110, 80, 380, 860, 60), tee: [300, 860], cup: [300, 180],
      posts: [[300, 600, 18], [200, 520, 16], [400, 520, 16], [300, 440, 18], [190, 360, 16], [410, 360, 16], [300, 290, 14]],
      shots: [[304, 0.78, 0], [184, 0.58, 0]] },
    { id: 'meadow-6', par: 3, tip: 'rough',
      out: rrect(100, 80, 400, 860, 50), tee: [210, 860], cup: [390, 190],
      rough: [ellipse(300, 520, 210, 70, 20), ellipse(420, 330, 90, 60, 16), rect(100, 680, 120, 90)],
      posts: [[300, 330, 16]],
      shots: [[288, 0.94, 0], [198, 0.26, 0]] },
    { id: 'meadow-7', par: 2, tip: 'slope',
      out: rrect(90, 80, 420, 860, 60), tee: [300, 860], cup: [410, 190],
      slopes: [[rect(90, 340, 420, 330), -280, 0]],
      shots: [[284, 0.94, 0], [4, 0.1, 0]] },
    { id: 'meadow-8', par: 2,
      out: rrect(70, 80, 460, 860, 60), tee: [140, 860], cup: [300, 190],
      slopes: [[rect(70, 260, 205, 560), 300, 0], [rect(325, 260, 205, 560), -300, 0]],
      posts: [[300, 330, 14]],
      shots: [[268, 0.86, 0], [102, 0.14, 0]] },
    { id: 'meadow-9', par: 3,
      out: rrect(70, 70, 460, 880, 50), tee: [140, 870], cup: [410, 170],
      rails: [[70, 650, 400, 650], [200, 370, 530, 370]],
      slopes: [[rect(100, 400, 400, 220), 0, 240]],
      rough: [ellipse(300, 230, 90, 55, 16)],
      posts: [[470, 760, 15]],
      shots: [[326, 0.94, 0], [254, 0.94, 0], [6, 0.54, 0]] },

    // =============================================================== Desert Garden
    { id: 'desert-1', par: 2, tip: 'sand',
      out: rrect(120, 80, 360, 860, 70), tee: [300, 860], cup: [300, 200],
      sand: [ellipse(300, 340, 115, 60, 20)],
      shots: [[246, 0.98, 0]] },
    { id: 'desert-2', par: 3,
      out: rrect(110, 80, 380, 870, 50), tee: [190, 880], cup: [390, 170],
      sand: [rrect(110, 590, 260, 90, 30), rrect(230, 380, 260, 90, 30), ellipse(250, 200, 70, 50, 16)],
      shots: [[274, 0.94, 0], [298, 0.9, 0]] },
    { id: 'desert-3', par: 2, tip: 'bumper',
      out: rrect(80, 80, 440, 860, 60), tee: [300, 870], cup: [300, 180],
      bumpers: [[300, 640, 24], [190, 500, 22], [410, 500, 22], [300, 380, 24]],
      shots: [[234, 0.82, 0], [274, 0.42, 0]] },
    { id: 'desert-4', par: 3, tip: 'gate',
      out: rrect(80, 80, 440, 860, 60), tee: [300, 860], cup: [300, 190],
      rails: [[80, 400, 240, 400], [360, 400, 520, 400]],
      gates: [[360, 400, 240, 400]],
      slopes: [[rect(84, 84, 432, 312), 0, 260]],
      sand: [ellipse(300, 600, 90, 50, 16)],
      shots: [[222, 0.74, 0], [270, 0.5, 0]] },
    { id: 'desert-5', par: 2, tip: 'slider',
      out: rrect(100, 80, 400, 860, 60), tee: [300, 860], cup: [300, 190],
      sliders: [[130, 470, 160, 46, 180, 0, 3.2, 0]],
      sand: [ellipse(160, 300, 50, 70, 14), ellipse(440, 300, 50, 70, 14)],
      shots: [[236, 0.78, 0], [302, 0.14, 0]] },
    { id: 'desert-6', par: 2,
      out: rrect(80, 80, 440, 870, 60), tee: [150, 870], cup: [430, 200],
      slopes: [[rect(80, 300, 440, 200), 0, 270]],
      sand: [rrect(300, 520, 220, 100, 40), ellipse(300, 160, 60, 45, 14)],
      posts: [[200, 220, 16]],
      shots: [[286, 0.98, 0], [2, 0.34, 0]] },
    { id: 'desert-7', par: 2,
      out: rrect(90, 80, 420, 880, 60), tee: [300, 880], cup: [300, 180],
      sliders: [[120, 640, 150, 44, 210, 0, 2.6, 0], [120, 380, 150, 44, 210, 0, 3.4, 0.5]],
      sand: [ellipse(300, 510, 80, 40, 16)],
      shots: [[270, 0.98, 1.05]] },
    { id: 'desert-8', par: 3,
      out: rrect(80, 80, 440, 870, 60), tee: [150, 870], cup: [430, 180],
      bumpers: [[300, 560, 24], [180, 420, 22], [420, 420, 22], [300, 290, 22]],
      rails: [[330, 160, 330, 300, 520, 300]],
      gates: [[520, 300, 420, 300]],
      sand: [ellipse(450, 680, 60, 50, 14)],
      shots: [[264, 0.98, 0], [2, 0.54, 0]] },
    { id: 'desert-9', par: 3,
      out: rrect(70, 70, 460, 890, 50), tee: [130, 880], cup: [420, 160],
      rails: [[70, 660, 380, 660], [220, 380, 530, 380]],
      sliders: [[260, 500, 120, 40, 120, 0, 2.8, 0.25]],
      bumpers: [[470, 740, 20]],
      sand: [ellipse(150, 230, 70, 60, 16)],
      slopes: [[rect(74, 74, 452, 302), 260, 0]],
      shots: [[332, 0.98, 0], [286, 0.58, 0.35]] },

    // =============================================================== Lagoon
    { id: 'lagoon-1', par: 2, tip: 'water',
      out: rrect(80, 80, 440, 860, 70), tee: [300, 870], cup: [300, 170],
      water: [ellipse(300, 500, 130, 170, 24)],
      shots: [[238, 0.98, 0], [134, 0.22, 0]] },
    { id: 'lagoon-2', par: 3,
      out: rrect(80, 80, 440, 870, 60), tee: [300, 880], cup: [390, 175],
      water: [rrect(76, 330, 180, 330, 30), rrect(344, 330, 180, 330, 30)],
      posts: [[300, 255, 16]],
      rough: [ellipse(300, 760, 120, 40, 16)],
      shots: [[272, 0.82, 0], [182, 0.14, 0]] },
    { id: 'lagoon-3', par: 2, tip: 'blade',
      out: rrect(80, 80, 440, 860, 60), tee: [300, 860], cup: [300, 190],
      blocks: [rect(80, 478, 150, 44), rect(370, 478, 150, 44)],
      blades: [[300, 500, 56, 4, 1.4, 0]],
      shots: [[262, 0.9, 0], [304, 0.42, 0]] },
    { id: 'lagoon-4', par: 2, tip: 'pipe',
      out: rrect(80, 80, 440, 860, 60), tee: [300, 860], cup: [300, 210],
      rails: [[80, 500, 520, 500]],
      pipes: [[420, 640, 170, 440, -80]],
      water: [ellipse(190, 700, 70, 60, 16)],
      blocks: [ellipse(380, 290, 55, 40, 14)],
      shots: [[298, 0.86, 0], [4, 0.7, 0]] },
    { id: 'lagoon-5', par: 3,
      out: rrect(70, 70, 460, 880, 60), tee: [300, 880], cup: [300, 345],
      water: [ring(300, 345, 85, 165, -70, 250, 24)],
      shots: [[244, 0.98, 0], [68, 0.3, 0]] },
    { id: 'lagoon-6', par: 3,
      out: rrect(80, 70, 440, 890, 60), tee: [300, 880], cup: [300, 160],
      water: [rect(84, 560, 120, 140), rect(396, 560, 120, 140), rect(84, 300, 120, 120), rect(396, 300, 120, 120)],
      blocks: [rect(204, 618, 40, 24), rect(356, 618, 40, 24)],
      blades: [[300, 630, 50, 3, 1.2, 0], [300, 360, 58, 2, -1.6, 0.6]],
      shots: [[204, 0.98, 1.05], [282, 0.5, 0]] },
    { id: 'lagoon-7', par: 3,
      out: rrect(70, 70, 460, 890, 50), tee: [150, 880], cup: [440, 160],
      rails: [[300, 70, 300, 520], [70, 520, 300, 520]],
      pipes: [[150, 600, 180, 160, -45], [450, 700, 380, 600, -90]],
      slopes: [[rect(304, 74, 222, 380), 0, 240]],
      water: [ellipse(420, 820, 60, 45, 14)],
      shots: [[300, 0.98, 0]] },
    { id: 'lagoon-8', par: 2,
      out: rrect(70, 70, 460, 890, 50), tee: [300, 880], cup: [300, 170],
      water: [rect(74, 420, 160, 180), rect(366, 420, 160, 180)],
      gates: [[366, 410, 234, 410]],
      rails: [[234, 410, 234, 380], [366, 410, 366, 380]],
      sliders: [[110, 270, 140, 40, 240, 0, 3, 0]],
      slopes: [[rect(234, 300, 132, 108), 0, 200]],
      shots: [[270, 0.78, 0.35]] },
    { id: 'lagoon-9', par: 3,
      out: rrect(60, 60, 480, 900, 50), tee: [130, 880], cup: [430, 160],
      rails: [[60, 640, 400, 640]],
      water: [ellipse(300, 470, 110, 70, 20), ellipse(150, 760, 70, 34, 16)],
      blades: [[460, 640, 48, 3, 1.3, 0]],
      pipes: [[110, 420, 300, 300, -60]],
      bumpers: [[200, 220, 20]],
      sand: [ellipse(420, 290, 60, 40, 14)],
      slopes: [[rect(400, 680, 136, 260), 0, -180]],
      shots: [[10, 0.98, 0], [340, 0.34, 0]] }
  ];

  var api = { holes: holes, perCourse: 9, courses: 3, courseIds: ['meadow', 'desert', 'lagoon'] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuttHoles = api;
})(this);
