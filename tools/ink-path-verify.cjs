#!/usr/bin/env node
// Level checker for Ink Path.
// Usage: node tools/ink-path-verify.cjs [--quiet] [--suggest] [--only <n>]
// For every level it feeds the stored reference solution through the game's own
// stroke builder and physics (ink-path/physics.js) and asserts that:
//  - the solution fits in the level's ink pot and earns 3 seals,
//  - every marble ends in a cup (deterministic replay, run twice),
//  - pressing Go with no ink does NOT clear the level.
// It also replays jittered copies of each solution (every point moved up to 4 units)
// and reports how forgiving the level is.
'use strict';
const path = require('path');
const P = require(path.join(__dirname, '..', 'ink-path', 'physics.js'));
const LV = require(path.join(__dirname, '..', 'ink-path', 'levels.js'));

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const suggest = args.includes('--suggest');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? Number(args[onlyIdx + 1]) : -1;
const RES = { 1: 'win', '-1': 'lost', '-2': 'stuck', '-3': 'timeout', 0: 'running' };

function simulate(L, polys) {
  const w = P.createWorld(L);
  P.setStrokes(w, polys);
  P.run(w);
  return w;
}
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

let failures = 0, total = 0;
const levels = LV.levels;
for (let i = 0; i < levels.length; i++) {
  if (only >= 0 && only !== i + 1) continue;
  total++;
  const L = levels[i];
  const errs = [];
  const built = P.buildFrom(L, L.sol);
  const used = built.ink;
  const pct = used / L.ink * 100;
  const stars = P.starsFor(L, used);
  if (used > L.ink) errs.push(`solution needs ${used.toFixed(0)} ink, pot is ${L.ink}`);
  if (stars < 3) errs.push(`solution earns ${stars} seals (${pct.toFixed(1)}% used, 3 seals at <= ${L.st[1]}%)`);
  if (!(L.st[0] > L.st[1] && L.st[0] <= 100)) errs.push(`bad thresholds ${L.st}`);
  const nSol = L.sol.reduce((n, s) => n + s.length / 2, 0);
  const builtPts = built.polys.reduce((n, s) => n + s.length / 2, 0);
  const w = simulate(L, built.polys);
  if (w.result !== P.RES_WIN) {
    const m = w.marbles.map(m => `(${m.x.toFixed(0)},${m.y.toFixed(0)} s${m.state})`).join(' ');
    errs.push(`reference solution: ${RES[w.result]} at t=${w.t.toFixed(2)}s marbles ${m}`);
  }
  const w2 = simulate(L, built.polys);
  if (w2.step !== w.step || w2.result !== w.result) errs.push('replay is not deterministic');
  const w0 = simulate(L, []);
  if (w0.result === P.RES_WIN) errs.push('level is cleared without any ink');
  if ((L.c || []).length < (L.m || []).length) errs.push('fewer cups than marbles');
  // robustness: jitter every solution point by up to 4 units
  const r = rng(1234 + i);
  let ok = 0; const trials = 24;
  for (let k = 0; k < trials; k++) {
    const jit = L.sol.map(s => s.map(v => v + (r() * 8 - 4)));
    const b = P.buildFrom(L, jit);
    if (simulate(L, b.polys).result === P.RES_WIN) ok++;
  }
  const rob = ok / trials;
  if (errs.length) failures++;
  if (!quiet || errs.length) {
    console.log(`${String(i + 1).padStart(2)} ${(L.id || '').padEnd(10)} ${errs.length ? 'FAIL' : 'ok  '} ink ${used.toFixed(0).padStart(4)}/${L.ink} (${pct.toFixed(0)}%, seals at ${L.st[0]}/${L.st[1]}%) ` +
      `${RES[w.result]} t=${w.t.toFixed(2)}s pts ${nSol}->${builtPts} jitter ${(rob * 100).toFixed(0)}%${rob < 0.5 ? '  (fragile)' : ''}`);
    errs.forEach(e => console.log('     - ' + e));
  }
  if (suggest) {
    const pot = Math.ceil(used * 1.9 / 50) * 50;
    const s3 = Math.ceil(used * 1.15 / pot * 100);
    const s2 = Math.ceil(used * 1.5 / pot * 100);
    console.log(`     suggest ink: ${pot}, st: [${s2}, ${s3}]`);
  }
}
console.log(failures ? `LEVEL VERIFY FAIL (${failures}/${total})` : `LEVEL VERIFY PASS (${total} levels)`);
process.exit(failures ? 1 : 0);
