/*
 * levels.js: Potion Sort rules, seeded level generator and optimal solver.
 * No DOM code, so it also runs in Node (tools/potion-sort-verify.cjs).
 *
 * A level is generated deterministically from (level index, try number). The table at the
 * bottom stores, for every level, the try that was accepted and the optimal move count
 * ("par") the solver found for it. The verify tool regenerates every level, solves it again
 * and checks that it is solvable and that par still matches.
 */
(function (root) {
  'use strict';
  var PS = root.PS = root.PS || {};

  var CAP = 4;            // layers per flask
  var PER = 12;           // levels per shelf
  var SHELVES = 6;
  var NLV = PER * SHELVES;
  PS.CAP = CAP; PS.PER = PER; PS.SHELVES = SHELVES; PS.NLV = NLV;

  // ------------------------------------------------------------------ rng
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  PS.rng = rng;
  function seedOf(i, t) { return (0x9E3779B1 ^ Math.imul(i + 1, 0x85EBCA77) ^ Math.imul(t + 7, 0xC2B2AE3D)) >>> 0; }

  // ------------------------------------------------------------------ difficulty ramp
  // colors, spare (empty) flasks, hidden depth (layers hidden from the bottom), cork pours, minimum par
  var COLS = [
    [2, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6],     // shelf 1: learn to pour
    [5, 6, 6, 6, 7, 7, 7, 7, 7, 8, 8, 8],     // shelf 2: more colors
    [4, 5, 5, 5, 6, 6, 6, 6, 6, 7, 7, 7],     // shelf 3: one spare flask fewer
    [5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 8],     // shelf 4: hidden layers
    [6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 8],     // shelf 5: corked flasks
    [6, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8]      // shelf 6: everything
  ];
  function params(i) {
    var k = Math.floor(i / PER), j = i % PER, c = COLS[k][j];
    var p = { colors: c, spare: 2, hide: 0, cork: 0, minPar: 0, maxPar: 99 };
    if (k === 2) p.spare = (j % 3 === 2) ? 2 : 1;           // two of three levels have one spare flask
    if (k === 3) p.hide = j < 4 ? 1 : j < 8 ? 2 : 3;
    if (k === 4) { p.cork = 3 + (j % 4) * 2; p.hide = j >= 6 ? 1 : 0; }
    if (k === 5) {
      p.hide = j < 4 ? 2 : 3;
      p.cork = j % 2 ? 4 + (j % 3) * 2 : 0;
      p.spare = (j === 3 || j === 7 || j === 10) ? 1 : 2;
    }
    if (p.spare === 1) p.colors = Math.min(p.colors, 7);
    p.minPar = Math.round(p.colors * (k === 0 ? 1.5 : 2.2)) + (k >= 3 ? 1 : 0);
    p.maxPar = k === 0 ? Math.round(p.colors * 2.6) : 99;
    if (i === 0) { p.minPar = 3; p.maxPar = 3; }
    return p;
  }
  PS.params = params;

  // ------------------------------------------------------------------ generation
  // flasks[f] lists layers bottom -> top as color indices 0..7.
  function gen(i, t) {
    var p = params(i), r = rng(seedOf(i, t)), f, n;
    var flasks = [];
    if (i === 0) {
      flasks = [[0, 0, 1, 1], [1, 1, 0, 0], []];
    } else {
      // pick which palette colors this level uses (rotating so every color shows up early)
      var pool = [0, 1, 2, 3, 4, 5, 6, 7];
      for (n = pool.length - 1; n > 0; n--) { var q = Math.floor(r() * (n + 1)), tmp = pool[n]; pool[n] = pool[q]; pool[q] = tmp; }
      var cols = pool.slice(0, p.colors).sort(function (a, b) { return a - b; });
      var bag = [];
      for (n = 0; n < p.colors; n++) for (var m = 0; m < CAP; m++) bag.push(cols[n]);
      for (n = bag.length - 1; n > 0; n--) { var q2 = Math.floor(r() * (n + 1)), t2 = bag[n]; bag[n] = bag[q2]; bag[q2] = t2; }
      for (f = 0; f < p.colors; f++) flasks.push(bag.slice(f * CAP, f * CAP + CAP));
      for (f = 0; f < p.spare; f++) flasks.push([]);
    }
    var hidden = [];
    for (f = 0; f < flasks.length; f++) {
      var h = [];
      for (n = 0; n < flasks[f].length; n++) h.push(n < p.hide && n < flasks[f].length - 1);
      hidden.push(h);
    }
    var cork = null;
    if (p.cork) cork = { f: Math.floor(r() * p.colors), n: p.cork };
    return { i: i, t: t, flasks: flasks, hidden: hidden, cork: cork, colors: p.colors, spare: p.spare, hide: p.hide };
  }
  PS.gen = gen;

  // Rejects layouts that are too easy at a glance (a flask already done, or 3 of a color stacked).
  function looksOk(L) {
    for (var f = 0; f < L.flasks.length; f++) {
      var a = L.flasks[f];
      if (a.length === CAP && a[0] === a[1] && a[1] === a[2] && (L.i === 0 || a[2] === a[3])) return false;
      if (L.i > 0 && a.length === CAP && ((a[0] === a[1] && a[1] === a[2]) || (a[1] === a[2] && a[2] === a[3]))) return false;
    }
    return true;
  }
  PS.looksOk = looksOk;

  // ------------------------------------------------------------------ rules (shared by the game and the solver)
  function topRun(a) {
    var n = a.length;
    if (!n) return 0;
    var c = a[n - 1], k = 1;
    while (k < n && a[n - 1 - k] === c) k++;
    return k;
  }
  PS.topRun = topRun;
  // How many layers a pour from a to b moves (0 = not allowed).
  function pourAmount(a, b) {
    if (!a.length || b.length >= CAP) return 0;
    var c = a[a.length - 1];
    if (b.length && b[b.length - 1] !== c) return 0;
    return Math.min(topRun(a), CAP - b.length);
  }
  PS.pourAmount = pourAmount;
  function isDone(a) {
    if (a.length !== CAP) return false;
    for (var k = 1; k < CAP; k++) if (a[k] !== a[0]) return false;
    return true;
  }
  PS.isDone = isDone;
  function solved(flasks) {
    for (var f = 0; f < flasks.length; f++) if (flasks[f].length && !isDone(flasks[f])) return false;
    return true;
  }
  PS.solved = solved;
  function runs(flasks) {
    var r = 0;
    for (var f = 0; f < flasks.length; f++) {
      var a = flasks[f];
      for (var k = 0; k < a.length; k++) if (k === 0 || a[k] !== a[k - 1]) r++;
    }
    return r;
  }
  function colorCount(flasks) {
    var seen = 0, n = 0;
    for (var f = 0; f < flasks.length; f++) for (var k = 0; k < flasks[f].length; k++) {
      var b = 1 << flasks[f][k];
      if (!(seen & b)) { seen |= b; n++; }
    }
    return n;
  }

  // ------------------------------------------------------------------ solver
  // A* over pours. Heuristic: (number of same-color runs) - (number of colors). A pour lowers
  // the run count by at most one, so the heuristic is admissible and consistent and the first
  // solution found is optimal. States are hashed with the flasks sorted (flask order does not
  // matter), except that a still-corked flask keeps its identity.
  // opts: { limit: max expanded states, corkLeft: pours until the cork opens, cork: flask index }
  function solve(flasks, opts) {
    opts = opts || {};
    var limit = opts.limit || 3000000;
    var corkF = opts.cork === undefined || opts.cork === null ? -1 : opts.cork;
    var corkN = corkF >= 0 ? (opts.corkLeft || 0) : 0;
    var nf = flasks.length, nc = colorCount(flasks);
    function key(fl, g) {
      var parts = [], ck = '';
      for (var f = 0; f < nf; f++) {
        var s = '';
        for (var k = 0; k < fl[f].length; k++) s += String.fromCharCode(97 + fl[f][k]);
        if (f === corkF && g < corkN) ck = s; else parts.push(s);
      }
      parts.sort();
      return (g < corkN ? (corkN - g) + ck + '#' : '') + parts.join('|');
    }
    var start = flasks.map(function (a) { return a.slice(); });
    var h0 = runs(start) - nc;
    var seen = new Map();
    var buckets = [];
    function push(node) {
      var f = node.g + node.h;
      (buckets[f] || (buckets[f] = [])).push(node);
    }
    var k0 = key(start, 0);
    seen.set(k0, 0);
    push({ fl: start, g: 0, h: h0, prev: null, mv: null, k: k0 });
    var expanded = 0;
    for (var fcur = h0; fcur < buckets.length || fcur === h0; fcur++) {
      var b = buckets[fcur];
      if (!b) continue;
      // LIFO inside a bucket: deeper nodes first, which finds the goal sooner
      while (b.length) {
        var node = b.pop();
        var fl = node.fl, g = node.g;
        if (seen.get(node.k) < g) continue; // stale duplicate
        if (node.h === 0 && solved(fl)) {
          var path = [];
          for (var nd = node; nd.prev; nd = nd.prev) path.push(nd.mv);
          path.reverse();
          return { par: g, path: path, expanded: expanded };
        }
        if (++expanded > limit) return { par: -1, path: null, expanded: expanded, gaveUp: true };
        var locked = g < corkN ? corkF : -1;
        var firstEmpty = -1;
        for (var e = 0; e < nf; e++) if (!fl[e].length && e !== locked) { firstEmpty = e; break; }
        for (var s = 0; s < nf; s++) {
          var a = fl[s];
          if (!a.length || s === locked || isDone(a)) continue;
          var run = topRun(a), uniform = run === a.length;
          for (var d = 0; d < nf; d++) {
            if (d === s || d === locked) continue;
            var bb = fl[d];
            if (!bb.length) { if (uniform || d !== firstEmpty) continue; }
            var amt = pourAmount(a, bb);
            if (!amt) continue;
            var nfl = fl.slice();
            nfl[s] = a.slice(0, a.length - amt);
            nfl[d] = bb.concat(a.slice(a.length - amt));
            var ng = g + 1, kk = key(nfl, ng);
            var old = seen.get(kk);
            if (old !== undefined && old <= ng) continue;
            seen.set(kk, ng);
            push({ fl: nfl, g: ng, h: runs(nfl) - nc, prev: node, mv: [s, d], k: kk });
          }
        }
      }
    }
    return { par: -1, path: null, expanded: expanded };
  }
  PS.solve = solve;

  function solveLevel(L, limit) {
    return solve(L.flasks, { limit: limit, cork: L.cork ? L.cork.f : -1, corkLeft: L.cork ? L.cork.n : 0 });
  }
  PS.solveLevel = solveLevel;

  // Finds the first try for level i that looks fine, is solvable and has par >= minPar.
  PS.build = function (i, limit, maxTries) {
    var p = params(i);
    for (var t = 0; t < (maxTries || 400); t++) {
      var L = gen(i, t);
      if (!looksOk(L)) continue;
      var r = solveLevel(L, limit);
      if (r.par < 0) continue;
      if (r.par < p.minPar || r.par > p.maxPar) continue;
      return { t: t, par: r.par, expanded: r.expanded };
    }
    return null;
  };

  // ------------------------------------------------------------------ the level table
  // [try, par] per level, produced by PS.build and checked by tools/potion-sort-verify.cjs.
  PS.TABLE = [
    [0,3], [1,8], [0,8], [11,10], [2,8], [4,9], [0,12], [2,13], [6,13], [7,12], [4,13], [28,16],
    [0,16], [0,18], [0,20], [0,16], [0,23], [0,21], [0,23], [0,21], [0,22], [0,23], [0,25], [0,22],
    [2,10], [0,13], [0,15], [2,13], [18,18], [0,19], [4,16], [10,18], [0,18], [11,21], [22,20], [0,22],
    [0,16], [0,14], [1,17], [0,20], [0,19], [0,22], [0,20], [0,21], [0,25], [0,28], [0,24], [0,26],
    [0,17], [0,19], [0,19], [0,22], [0,21], [0,21], [1,24], [0,22], [0,26], [1,27], [0,26], [0,26],
    [0,18], [0,23], [0,22], [44,21], [1,23], [0,25], [0,25], [72,22], [0,27], [0,25], [13,22], [0,25]
  ];

  PS.level = function (i) {
    var row = PS.TABLE[i] || [0, 0];
    var L = gen(i, row[0]);
    L.par = row[1];
    return L;
  };
  // Star thresholds: 3 stars up to par + slack, 2 stars up to the second limit, else 1.
  PS.thresholds = function (par) { return [par + Math.max(1, Math.round(par * 0.1)), par + Math.max(3, Math.round(par * 0.4))]; };
  PS.starsFor = function (moves, par) {
    var th = PS.thresholds(par);
    return moves <= th[0] ? 3 : moves <= th[1] ? 2 : 1;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PS;
})(typeof window !== 'undefined' ? window : globalThis);
