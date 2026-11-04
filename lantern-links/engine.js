/*
 * engine.js: Lantern Links board model and beam tracing.
 * Shared by the game (window.LLEngine) and the offline level solver (module.exports).
 *
 * Grid tokens (two characters, space separated):
 *   ..  grass (empty, tray pieces can go here)     ##  hedge (blocks light)
 *   e>  gold emitter  p>  pink emitter  s>  sky emitter   (direction: > v < ^)
 *   Lg  gold lantern  Lp  pink  Ls  sky  Lv  lavender (needs pink + sky)
 *   f/ f\  fixed mirror        r/ r\  rotatable mirror (tap to turn)
 *   x+  fixed splitter (splits a beam into two perpendicular beams)
 *   T0  toggle stone, raised at start      T1  toggle stone, lowered at start
 */
(function (root) {
  'use strict';

  var DX = [1, 0, -1, 0];
  var DY = [0, 1, 0, -1];
  // Direction 0 = right, 1 = down, 2 = left, 3 = up.
  var SLASH = [3, 2, 1, 0]; // "/"
  var BACK = [1, 0, 3, 2];  // "\"
  var T = { EMPTY: 0, WALL: 1, EMIT: 2, LANT: 3, FIX: 4, ROT: 5, SPLIT: 6, TOG: 7 };
  // Colour bits: pink = 1, sky = 2, lavender = pink + sky = 3, gold = 4.
  var CBIT = { p: 1, s: 2, v: 3, g: 4 };
  var DIRS = { '>': 0, 'v': 1, '<': 2, '^': 3 };
  // Placed piece codes.
  var P_NONE = 0, P_SLASH = 1, P_BACK = 2, P_SPLIT = 3;

  function parse(def) {
    var rows = def.g.map(function (r) { return r.trim().split(/\s+/); });
    var h = rows.length, w = rows[0].length, n = w * h;
    var L = {
      w: w, h: h, n: n,
      type: new Uint8Array(n), dir: new Int8Array(n), col: new Uint8Array(n),
      ori: new Int8Array(n), phase: new Int8Array(n),
      emitters: [], lanterns: [], rots: [], toggles: [],
      trayM: def.m | 0, trayX: def.x | 0, colored: false
    };
    for (var y = 0; y < h; y++) {
      if (rows[y].length !== w) throw new Error('ragged row ' + y);
      for (var x = 0; x < w; x++) {
        var tok = rows[y][x], a = tok.charAt(0), b = tok.charAt(1), c = y * w + x;
        if (tok === '..') L.type[c] = T.EMPTY;
        else if (tok === '##') L.type[c] = T.WALL;
        else if ((a === 'e' || a === 'p' || a === 's') && b in DIRS) {
          L.type[c] = T.EMIT; L.dir[c] = DIRS[b]; L.col[c] = a === 'e' ? 4 : CBIT[a];
          L.emitters.push(c);
        } else if (a === 'L' && b in CBIT) {
          L.type[c] = T.LANT; L.col[c] = CBIT[b]; L.lanterns.push(c);
        } else if ((a === 'f' || a === 'r') && (b === '/' || b === '\\')) {
          L.type[c] = a === 'f' ? T.FIX : T.ROT; L.ori[c] = b === '/' ? 0 : 1;
          if (a === 'r') L.rots.push(c);
        } else if (tok === 'x+') L.type[c] = T.SPLIT;
        else if (a === 'T' && (b === '0' || b === '1')) {
          L.type[c] = T.TOG; L.phase[c] = b === '0' ? 0 : 1; L.toggles.push(c);
        } else throw new Error('bad token "' + tok + '" at ' + x + ',' + y);
      }
    }
    for (var i = 0; i < L.emitters.length; i++) if (L.col[L.emitters[i]] !== 4) L.colored = true;
    return L;
  }

  function newState(L) {
    return { rot: new Int8Array(L.ori), placed: new Uint8Array(L.n), tog: 0, usedM: 0, usedX: 0 };
  }
  function cloneState(S) {
    return { rot: new Int8Array(S.rot), placed: new Uint8Array(S.placed), tog: S.tog, usedM: S.usedM, usedX: S.usedX };
  }
  function stateKey(L, S) {
    var k = S.tog + ':';
    for (var i = 0; i < L.rots.length; i++) k += S.rot[L.rots[i]];
    k += ':';
    for (var c = 0; c < L.n; c++) if (S.placed[c]) k += c + '.' + S.placed[c] + ',';
    return k;
  }
  function isRaised(L, S, c) { return L.type[c] === T.TOG && L.phase[c] === S.tog; }
  function canPlace(L, S, c) { return L.type[c] === T.EMPTY && S.placed[c] === P_NONE; }

  /*
   * Traces every beam. Returns a Uint8Array of colour masks per cell (only lanterns matter).
   * rec (optional) collects: segs (array of {x1,y1,x2,y2,ci,d0,d1}), visit (Uint8Array, 1 = a beam
   * entered this cell), hit (Float32Array, distance at which each lantern was first reached).
   * Loops are safe: each (cell, direction, colour) state is entered at most once.
   */
  function trace(L, S, rec) {
    var w = L.w, h = L.h, n = L.n;
    var seen = new Uint8Array(n * 12);
    var lm = new Uint8Array(n);
    var stack = [];
    var segs = rec ? rec.segs : null;
    var i, e;
    if (rec) {
      rec.visit = new Uint8Array(n);
      rec.hit = new Float32Array(n);
      for (i = 0; i < n; i++) rec.hit[i] = 1e9;
    }
    for (i = 0; i < L.emitters.length; i++) {
      e = L.emitters[i];
      var bit = L.col[e];
      stack.push(e % w, (e / w) | 0, L.dir[e], bit === 4 ? 2 : bit - 1, 0);
    }
    while (stack.length) {
      var dist = stack.pop(), ci = stack.pop(), d = stack.pop(), y = stack.pop(), x = stack.pop();
      var sx = x + 0.5, sy = y + 0.5, sd = dist, cb = 1 << ci;
      for (;;) {
        var nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
          if (segs) segs.push({ x1: sx, y1: sy, x2: x + 0.5 + DX[d] * 0.5, y2: y + 0.5 + DY[d] * 0.5, ci: ci, d0: sd, d1: dist + 0.5 });
          break;
        }
        var c = ny * w + nx, k = (c * 4 + d) * 3 + ci;
        if (seen[k]) {
          if (segs) segs.push({ x1: sx, y1: sy, x2: nx + 0.5, y2: ny + 0.5, ci: ci, d0: sd, d1: dist + 1 });
          break;
        }
        seen[k] = 1;
        var t = L.type[c];
        if (t === T.WALL || t === T.EMIT || (t === T.TOG && L.phase[c] === S.tog)) {
          if (segs) segs.push({ x1: sx, y1: sy, x2: x + 0.5 + DX[d] * 0.5, y2: y + 0.5 + DY[d] * 0.5, ci: ci, d0: sd, d1: dist + 0.5 });
          break;
        }
        x = nx; y = ny; dist += 1;
        if (rec) {
          rec.visit[c] = 1;
          if (t === T.LANT && dist < rec.hit[c]) rec.hit[c] = dist;
        }
        if (t === T.LANT) { lm[c] |= cb; continue; }
        var m = -1, split = false;
        if (t === T.FIX) m = L.ori[c];
        else if (t === T.ROT) m = S.rot[c];
        else if (t === T.SPLIT) split = true;
        else if (t === T.EMPTY) {
          var p = S.placed[c];
          if (p === P_SLASH) m = 0; else if (p === P_BACK) m = 1; else if (p === P_SPLIT) split = true;
        }
        if (m >= 0 || split) {
          if (segs) segs.push({ x1: sx, y1: sy, x2: x + 0.5, y2: y + 0.5, ci: ci, d0: sd, d1: dist });
          if (split) {
            stack.push(x, y, (d + 1) & 3, ci, dist);
            stack.push(x, y, (d + 3) & 3, ci, dist);
            break;
          }
          d = m === 0 ? SLASH[d] : BACK[d];
          sx = x + 0.5; sy = y + 0.5; sd = dist;
        }
      }
    }
    return lm;
  }

  function solved(L, lm) {
    for (var i = 0; i < L.lanterns.length; i++) {
      var c = L.lanterns[i];
      if (lm[c] !== L.col[c]) return false;
    }
    return true;
  }

  /*
   * Moves (also used for solutions): {a:'p', c, o} place mirror (o 0 = "/", 1 = "\"),
   * {a:'x', c} place splitter, {a:'r', c} turn a mirror, {a:'t'} flip toggle stones,
   * {a:'u', c} take a placed piece back to the tray, {a:'mv', c, to} move a placed piece.
   * Returns true when the move was legal and applied.
   */
  function apply(L, S, mv) {
    var c = mv.c;
    switch (mv.a) {
      case 'p':
        if (!canPlace(L, S, c) || S.usedM >= L.trayM) return false;
        S.placed[c] = mv.o ? P_BACK : P_SLASH; S.usedM++; return true;
      case 'x':
        if (!canPlace(L, S, c) || S.usedX >= L.trayX) return false;
        S.placed[c] = P_SPLIT; S.usedX++; return true;
      case 'r':
        if (L.type[c] === T.ROT) { S.rot[c] ^= 1; return true; }
        if (S.placed[c] === P_SLASH) { S.placed[c] = P_BACK; return true; }
        if (S.placed[c] === P_BACK) { S.placed[c] = P_SLASH; return true; }
        return false;
      case 't':
        if (!L.toggles.length) return false;
        S.tog ^= 1; return true;
      case 'u':
        if (!S.placed[c]) return false;
        if (S.placed[c] === P_SPLIT) S.usedX--; else S.usedM--;
        S.placed[c] = P_NONE; return true;
      case 'mv':
        if (!S.placed[c] || !canPlace(L, S, mv.to)) return false;
        S.placed[mv.to] = S.placed[c]; S.placed[c] = P_NONE; return true;
    }
    return false;
  }

  // Solutions are stored as compact strings: "p12/ p20\ x7 r3 t" (cell index, then orientation).
  function decodeSolution(str) {
    if (!str) return [];
    return str.trim().split(/\s+/).map(function (tok) {
      var a = tok.charAt(0);
      if (a === 't') return { a: 't' };
      if (a === 'p') return { a: 'p', c: parseInt(tok.slice(1), 10), o: tok.slice(-1) === '\\' ? 1 : 0 };
      return { a: a, c: parseInt(tok.slice(1), 10) };
    });
  }

  var api = {
    DX: DX, DY: DY, T: T, P_NONE: P_NONE, P_SLASH: P_SLASH, P_BACK: P_BACK, P_SPLIT: P_SPLIT,
    parse: parse, newState: newState, cloneState: cloneState, stateKey: stateKey,
    isRaised: isRaised, canPlace: canPlace, trace: trace, solved: solved, apply: apply,
    decodeSolution: decodeSolution
  };
  root.LLEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
