#!/usr/bin/env node
// Hole checker for Putt Garden.
// Usage: node tools/putt-garden-verify.cjs [--quiet] [--only <n>]
// For every hole it replays the stored reference shots (putt-garden/holes.js) through the
// game's own physics (putt-garden/physics.js) and asserts that:
//  - the ball drops within par (penalty strokes included),
//  - the replay is deterministic (run twice, same step count and position),
//  - tee and cup are on the fairway (inside the outer wall, not in a block, water or post),
//  - the hole has a par, a tee, a cup and well-formed shots.
// It also replays jittered copies of the reference (angle +-1 deg, power +-0.02) and reports
// how forgiving the route is (informational).
'use strict';
const path = require('path');
const P = require(path.join(__dirname, '..', 'putt-garden', 'physics.js'));
const HD = require(path.join(__dirname, '..', 'putt-garden', 'holes.js'));

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? Number(args[onlyIdx + 1]) : -1;

const holes = HD.holes;
let failures = 0, total = 0, parSum = 0, strokeSum = 0;
if (holes.length !== HD.courses * HD.perCourse) { console.log(`expected ${HD.courses * HD.perCourse} holes, found ${holes.length}`); failures++; }

function onFairway(w, h, x, y) {
  if (!P.inPoly(h.out, x, y)) return false;
  for (const b of h.blocks || []) if (P.inPoly(b, x, y)) return false;
  if (P.inWater(w, x, y)) return false;
  for (const c of w.circ) if (Math.hypot(x - c[0], y - c[1]) < c[2] + P.C.R) return false;
  return true;
}

for (let i = 0; i < holes.length; i++) {
  if (only >= 0 && only !== i + 1) continue;
  total++;
  const h = holes[i];
  const errs = [];
  if (!(h.par >= 2 && h.par <= 5)) errs.push(`bad par ${h.par}`);
  if (!Array.isArray(h.shots) || !h.shots.length) errs.push('no reference shots');
  for (const s of h.shots || []) if (s.length !== 3 || !(s[1] > 0 && s[1] <= 1) || !(s[2] >= 0) || !isFinite(s[0])) errs.push(`bad shot ${JSON.stringify(s)}`);
  const w0 = P.createWorld(h);
  if (!onFairway(w0, h, h.tee[0], h.tee[1])) errs.push('tee is not on the fairway');
  if (!onFairway(w0, h, h.cup[0], h.cup[1])) errs.push('cup is not on the fairway');
  const r = P.replay(h, h.shots || [], h.par + 4);
  const r2 = P.replay(h, h.shots || [], h.par + 4);
  if (!r.sunk) errs.push(`reference shots do not sink the ball (ball at ${r.world.ball.x.toFixed(0)},${r.world.ball.y.toFixed(0)} after ${r.strokes} strokes)`);
  else if (r.strokes > h.par) errs.push(`reference needs ${r.strokes} strokes, par is ${h.par}`);
  if (r2.world.step !== r.world.step || r2.world.ball.x !== r.world.ball.x || r2.world.ball.y !== r.world.ball.y) errs.push('replay is not deterministic');
  // forgiveness of the reference route
  let ok = 0, n = 0;
  for (const da of [-1, 0, 1]) for (const dp of [-0.02, 0, 0.02]) {
    n++;
    const js = h.shots.map(s => [s[0] + da, Math.min(1, s[1] + dp), s[2]]);
    const rj = P.replay(h, js, h.par + 4);
    if (rj.sunk && rj.strokes <= h.par) ok++;
  }
  parSum += h.par; strokeSum += r.strokes;
  if (errs.length) failures++;
  if (!quiet || errs.length) {
    console.log(`${String(i + 1).padStart(2)} ${h.id.padEnd(10)} ${errs.length ? 'FAIL' : 'ok  '} par ${h.par}  reference ${r.strokes} stroke${r.strokes === 1 ? ' ' : 's'} ` +
      `(${(h.shots || []).length} putt${(h.shots || []).length === 1 ? '' : 's'}, ${r.world.t.toFixed(2)} s)  forgiveness ${Math.round(ok / n * 100)}%`);
    errs.forEach(e => console.log('     - ' + e));
  }
}
console.log(`total par ${parSum}, reference strokes ${strokeSum}`);
console.log(failures ? `HOLE VERIFY FAIL (${failures}/${total})` : `HOLE VERIFY PASS (${total} holes)`);
process.exit(failures ? 1 : 0);
