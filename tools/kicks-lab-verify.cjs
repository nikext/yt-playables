// Satisfiability check: loads kicks-lab/orders.js in Node and runs KL.selfCheck.
// Usage: node tools/kicks-lab-verify.cjs [orders.js] [orders-per-tier]
const path = require('path');
require(path.resolve(process.argv[2] || path.join(__dirname, "..", "kicks-lab", "orders.js")));
const KL = globalThis.KL;
const per = Number(process.argv[3] || 150);
const res = KL.selfCheck(per, 7);
console.log('orders checked:', res.n, 'fails:', res.fails.length);
res.fails.slice(0, 5).forEach(f => console.log(JSON.stringify(f)));
// distribution stats
const r = KL.rng(5); const stats = {};
for (let t = 0; t < 5; t++) {
  const U = KL.unlocks({ ink: 0x3FFFFF, pat: 63, stk: 63, lace: 15, sil: 15 });
  const U0 = KL.unlocks(KL.START);
  let fb = 0, kinds = {}, n = 0;
  for (let i = 0; i < 300; i++) {
    const o = KL.genOrder(r, t, i % 2 ? U : U0, i % 3 === 0);
    if (o.reqs.length === 2 && o.reqs.every(q => q.t === 'color') && t > 0) fb++;
    o.reqs.forEach(q => kinds[q.t] = (kinds[q.t] || 0) + 1); n += o.reqs.length;
    const d = KL.solve(o, i % 2 ? U : U0);
    const e = KL.encode(d), d2 = KL.decode(e);
    if (KL.encode(d2) !== e) console.log('encode mismatch', e);
  }
  console.log('tier', t, 'avg reqs', (n / 300).toFixed(2), 'plain-2color', fb, JSON.stringify(kinds));
}
// random designs never crash rating
for (let i = 0; i < 2000; i++) { const d = KL.blank(0); d.z.forEach(z => { z[0] = Math.floor(Math.random() * 23) - 1; z[1] = Math.floor(Math.random() * 6); z[2] = Math.floor(Math.random() * 23) - 1; }); KL.rate(KL.tutorialOrder(), d, Math.random() * 200, 1); }
console.log(res.ok ? 'SAT PASS' : 'SAT FAIL');
process.exit(res.ok ? 0 : 1);
