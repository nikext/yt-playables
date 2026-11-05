#!/usr/bin/env node
// Level checker for Potion Sort.
// Usage: node tools/potion-sort-verify.cjs [--print-table] [--quiet]
// For every level it regenerates the layout from its seed (potion-sort/levels.js), runs the
// optimal A* solver again and asserts that:
//  - the stored try is still the first acceptable one (looks fine, solvable, par in range),
//  - the level is solvable and the solver's par equals the stored par,
//  - the solver's move list replays legally (cork respected) and ends solved in par moves,
//  - every color has exactly 4 layers, no flask overflows and no top layer is hidden.
// --print-table rebuilds the table from scratch and prints it for pasting into levels.js.
'use strict';
const path = require('path');
const PS = require(path.join(__dirname, '..', 'potion-sort', 'levels.js'));

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const LIMIT = 3000000;

if (args.includes('--print-table')) {
  const rows = [];
  for (let i = 0; i < PS.NLV; i++) {
    const r = PS.build(i, LIMIT, 600);
    if (!r) { console.error('no acceptable layout for level', i + 1); process.exit(1); }
    rows.push(`[${r.t},${r.par}]`);
  }
  const lines = [];
  for (let k = 0; k < PS.SHELVES; k++) lines.push('    ' + rows.slice(k * PS.PER, (k + 1) * PS.PER).join(', '));
  console.log('  PS.TABLE = [\n' + lines.join(',\n') + '\n  ];');
  process.exit(0);
}

function replay(L, path) {
  const fl = L.flasks.map(a => a.slice());
  for (let m = 0; m < path.length; m++) {
    const [s, d] = path[m];
    if (L.cork && m < L.cork.n && (s === L.cork.f || d === L.cork.f)) return `move ${m + 1} uses the corked flask`;
    const amt = PS.pourAmount(fl[s], fl[d]);
    if (!amt) return `move ${m + 1} (${s}->${d}) is not a legal pour`;
    fl[d] = fl[d].concat(fl[s].slice(fl[s].length - amt));
    fl[s] = fl[s].slice(0, fl[s].length - amt);
  }
  return PS.solved(fl) ? null : 'replay does not end solved';
}

let fails = 0, parSum = 0, maxExp = 0;
const t0 = Date.now();
if (PS.TABLE.length !== PS.NLV) { console.log(`table has ${PS.TABLE.length} rows, expected ${PS.NLV}`); fails++; }
for (let i = 0; i < PS.NLV; i++) {
  const errs = [];
  const row = PS.TABLE[i] || [0, 0];
  const L = PS.level(i);
  const p = PS.params(i);
  // composition
  const count = {};
  L.flasks.forEach(a => { if (a.length > PS.CAP) errs.push('flask overflows'); a.forEach(c => { count[c] = (count[c] || 0) + 1; }); });
  const cols = Object.keys(count);
  if (cols.length !== p.colors) errs.push(`expected ${p.colors} colors, found ${cols.length}`);
  cols.forEach(c => { if (count[c] !== PS.CAP) errs.push(`color ${c} has ${count[c]} layers`); });
  L.hidden.forEach((h, f) => { if (h.length && h[h.length - 1]) errs.push(`top layer of flask ${f} is hidden`); });
  if (!PS.looksOk(L)) errs.push('layout rejected by looksOk');
  // first acceptable try
  const b = PS.build(i, LIMIT, row[0] + 1);
  if (!b || b.t !== row[0]) errs.push(`build picks try ${b ? b.t : 'none'}, table says ${row[0]}`);
  // solve
  const r = PS.solveLevel(L, LIMIT);
  maxExp = Math.max(maxExp, r.expanded);
  if (r.par < 0) errs.push(r.gaveUp ? 'solver gave up' : 'UNSOLVABLE');
  else {
    if (r.par !== row[1]) errs.push(`par mismatch: solver ${r.par}, table ${row[1]}`);
    if (r.path.length !== r.par) errs.push('path length differs from par');
    const e = replay(L, r.path);
    if (e) errs.push(e);
    if (r.par < p.minPar || r.par > p.maxPar) errs.push(`par ${r.par} outside [${p.minPar}, ${p.maxPar}]`);
  }
  parSum += row[1];
  const th = PS.thresholds(row[1]);
  if (!quiet || errs.length) {
    console.log(`L${String(i + 1).padStart(2)} shelf ${Math.floor(i / PS.PER) + 1}: ${p.colors} colors, ${p.spare} spare` +
      (p.hide ? `, hide ${p.hide}` : '') + (L.cork ? `, cork ${L.cork.n}` : '') +
      ` | try ${row[0]} par ${row[1]} (3★ ≤ ${th[0]}, 2★ ≤ ${th[1]}) states ${r.expanded}` + (errs.length ? '  FAIL: ' + errs.join('; ') : '  ok'));
  }
  if (errs.length) fails++;
}
console.log(`levels: ${PS.NLV}, failures: ${fails}, total par: ${parSum}, max states expanded: ${maxExp}, ${Date.now() - t0} ms`);
console.log(fails ? 'VERIFY FAIL' : 'VERIFY PASS');
process.exit(fails ? 1 : 0);
