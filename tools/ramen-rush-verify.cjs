#!/usr/bin/env node
// Ramen Rush: headless checks of the order generator and the day goals.
// Usage: node tools/ramen-rush-verify.cjs [shift.js] [--verbose]
//
// 1. Makeability: for every day 1..40 and every specials set the player could own by then
//    (including none, i.e. the minimal upgrade path), thousands of generated orders are checked:
//    every ingredient is on the menu and has a station, toppings are distinct and fit a bowl,
//    and a single bowl can be made in time by one player on the cheapest equipment.
// 2. Goals: a simulated player (it taps at human speed, makes a few mistakes and only sees what a
//    player sees) plays the real shift simulation from shift.js. On a sensible upgrade path it must
//    reach every campaign day's goal on the first try, and on the minimal path it must keep moving.
const path = require('path');
const file = process.argv.find(a => a.endsWith('.js') && !a.endsWith('.cjs')) || path.join(__dirname, '..', 'ramen-rush', 'shift.js');
const verbose = process.argv.includes('--verbose');
require(path.resolve(file));
const RR = globalThis.RR;

let fails = [];
const fail = (m) => { if (fails.length < 40) fails.push(m); };

// ---------- 1. makeability ----------
function availableSpecials(day) { let m = 0; RR.SPECIALS.forEach(s => { if (day >= s.day) m |= 1 << s.sp; }); return m; }
let ordersChecked = 0, worstRatio = 0, worstAt = '';
const seen = {};
for (let day = 1; day <= 40; day++) {
  const avail = availableSpecials(day);
  const cfg = RR.dayConfig(day);
  for (let sp = 0; sp <= RR.ALL_SP; sp++) {
    if ((sp & avail) !== sp) continue; // cannot own a special before it is sold
    const own = RR.owned(day, sp);
    if (!own[0].length || !own[1].length || !own[2].length) fail(`day ${day} sp ${sp}: empty station group`);
    const r = RR.rng(day * 131 + sp * 7 + 1);
    const n = sp === 0 || sp === avail ? 1500 : 300;
    for (let i = 0; i < n; i++) {
      const o = RR.genOrder(r, day, own, cfg);
      ordersChecked++;
      const tag = `day ${day} sp ${sp}: ${JSON.stringify(o)}`;
      if (own[0].indexOf(o.broth) < 0) fail('broth not on the menu, ' + tag);
      if (own[1].indexOf(o.noodle) < 0) fail('noodle not on the menu, ' + tag);
      if (o.tops.length < 1 || o.tops.length > RR.MAX_TOPS) fail('topping count, ' + tag);
      if (new Set(o.tops).size !== o.tops.length) fail('duplicate topping, ' + tag);
      o.tops.forEach(t => { if (own[2].indexOf(t) < 0) fail('topping not on the menu, ' + tag); });
      if (o.drink >= 0 && own[3].indexOf(o.drink) < 0) fail('drink not on the menu, ' + tag);
      if (o.vip && day < 7) fail('VIP too early, ' + tag);
      // Build it for real in a minimal-equipment shift: every order must be assemblable and match.
      const sh = new RR.Shift({ day, sp, up: [0, 0, 0, 0, 0], seed: 1 });
      sh.hold = true;
      sh.spawn(0, o); sh.update(1);
      if (sh.boil(o.noodle) < 0) fail('cannot boil, ' + tag);
      if (sh.add(0, o.broth) < 0) fail('cannot ladle, ' + tag);
      o.tops.forEach(t => { if (sh.add(2, t) < 0) fail('cannot add topping, ' + tag); });
      if (o.drink >= 0 && sh.add(3, o.drink) < 0) fail('cannot add drink, ' + tag);
      for (let k = 0; k < 200 && sh.boilers[0].st !== 2; k++) sh.update(0.05);
      if (sh.drain(0) < 0) fail('cannot drain, ' + tag);
      if (sh.serve(0, 0) !== 'ok') fail('bowl does not match its order, ' + tag);
      // Time: one player at 0.8 s per tap on the cheapest burner, against the order's patience.
      const pat = (cfg.patience + 2.5 * o.tops.length + (o.drink >= 0 ? 3 : 0)) * (o.vip ? 0.65 : 1);
      const prepTaps = 1 + o.tops.length + (o.drink >= 0 ? 1 : 0);
      const need = 0.8 + Math.max(RR.BOIL_TIME[0], prepTaps * 0.8) + 2 * 0.8;
      const ratio = need / pat;
      if (ratio > worstRatio) { worstRatio = ratio; worstAt = tag; }
      if (ratio > 0.6) fail(`order too slow to make (${need.toFixed(1)} s of ${pat.toFixed(1)} s), ` + tag);
      const key = day + ':' + sp;
      seen[key] = seen[key] || new Set();
      seen[key].add('b' + o.broth); seen[key].add('n' + o.noodle); o.tops.forEach(t => seen[key].add('t' + t)); if (o.drink >= 0) seen[key].add('d' + o.drink);
    }
    // Every item on the menu must actually be ordered (otherwise its station is useless).
    const s = seen[day + ':' + sp];
    own[0].forEach(x => { if (!s.has('b' + x)) fail(`day ${day} sp ${sp}: broth ${x} never ordered`); });
    own[1].forEach(x => { if (!s.has('n' + x)) fail(`day ${day} sp ${sp}: noodle ${x} never ordered`); });
    own[2].forEach(x => { if (!s.has('t' + x)) fail(`day ${day} sp ${sp}: topping ${x} never ordered`); });
    own[3].forEach(x => { if (!s.has('d' + x)) fail(`day ${day} sp ${sp}: drink ${x} never ordered`); });
  }
}
console.log(`makeability: ${ordersChecked} orders over days 1-40 and every ownable specials set; slowest order needs ${(worstRatio * 100).toFixed(0)}% of its patience`);
if (verbose) console.log('  slowest:', worstAt);

// ---------- 2. simulated player ----------
// skill: tap = seconds per tap, err = chance a topping tap goes wrong, notice = delay before a new customer is noticed.
const SKILL = {
  casual: { tap: 1.25, err: 0.06, notice: 1.6 },
  reasonable: { tap: 0.95, err: 0.04, notice: 1.2 },
  good: { tap: 0.65, err: 0.02, notice: 0.7 }
};
function playDay(day, st, skill, seed) {
  const sh = new RR.Shift({ day, up: st.up, sp: st.sp, rep: st.rep, seed, tutorial: day === 1 && seed === 1 });
  const r = RR.rng(seed * 977 + 5);
  const assign = sh.slots.map(() => 0); // customer id per bowl
  const seenAt = {};
  let cd = 0, t = 0;
  const dt = 0.05;
  const busy = () => { cd = skill.tap * (0.8 + r() * 0.4); };
  function custById(id) { for (const c of sh.seats) if (c && c.id === id && c.st === 'wait') return c; return null; }
  function act() {
    const waiting = sh.seats.filter(c => c && c.st === 'wait' && t - (seenAt[c.id] || 0) >= skill.notice).sort((a, b) => a.pat - b.pat);
    // forget customers who left, recycle or trash their bowls
    for (let s = 0; s < sh.slots.length; s++) {
      if (assign[s] && !custById(assign[s])) assign[s] = 0;
      if (!assign[s] && !RR.bowlEmpty(sh.slots[s])) {
        const c = waiting.find(c => !assign.includes(c.id) && RR.compatible(sh.slots[s], c.o));
        if (c) assign[s] = c.id; else { sh.trash(s); busy(); return; }
      }
    }
    for (const c of waiting) {
      if (assign.includes(c.id)) continue;
      const s = sh.slots.findIndex((b, i) => !assign[i] && RR.bowlEmpty(b));
      if (s >= 0) assign[s] = c.id;
    }
    const jobs = [];
    for (let s = 0; s < sh.slots.length; s++) { const c = custById(assign[s]); if (c) jobs.push({ s, c }); }
    jobs.sort((a, b) => a.c.pat - b.c.pat);
    // a bowl that went wrong goes in the bin
    for (const j of jobs) if (!RR.compatible(sh.slots[j.s], j.c.o)) { sh.trash(j.s); assign[j.s] = 0; busy(); return; }
    for (const j of jobs) if (RR.matches(sh.slots[j.s], j.c.o)) { sh.serve(j.s, j.c.seat); assign[j.s] = 0; busy(); return; }
    for (let b = 0; b < sh.boilers.length; b++) if (sh.boilers[b].st === 3) { sh.dump(b); busy(); return; }
    for (let b = 0; b < sh.boilers.length; b++) {
      const bo = sh.boilers[b];
      if (bo.st !== 2) continue;
      const j = jobs.find(j => sh.slots[j.s].noodle < 0 && j.c.o.noodle === bo.n);
      if (j) { sh.drain(b, j.s); busy(); return; }
    }
    // start noodles that are needed and not already cooking
    const need = {};
    for (const j of jobs) if (sh.slots[j.s].noodle < 0) need[j.c.o.noodle] = (need[j.c.o.noodle] || 0) + 1;
    for (const bo of sh.boilers) if (bo.st === 1 || bo.st === 2) need[bo.n] = (need[bo.n] || 0) - 1;
    for (const j of jobs) {
      const n = j.c.o.noodle;
      if (sh.slots[j.s].noodle < 0 && need[n] > 0 && sh.boilers.some(b => b.st === 0)) { sh.boil(n); busy(); return; }
    }
    for (const j of jobs) {
      const b = sh.slots[j.s], o = j.c.o;
      const sel = sh.sel === j.s ? 0 : 0.25 * skill.tap;
      if (b.broth < 0) { sh.add(0, o.broth, j.s); busy(); cd += sel; return; }
      const miss = o.tops.find(x => b.tops.indexOf(x) < 0);
      if (miss != null) {
        let x = miss;
        if (r() < skill.err) { const wrong = sh.own[2].filter(y => o.tops.indexOf(y) < 0); if (wrong.length) x = wrong[Math.floor(r() * wrong.length)]; }
        sh.add(2, x, j.s); busy(); cd += sel; return;
      }
      if (o.drink >= 0 && b.drink < 0) { sh.add(3, o.drink, j.s); busy(); cd += sel; return; }
    }
    cd = 0.1;
  }
  while (!sh.done && t < 400) {
    sh.update(dt); t += dt;
    for (const c of sh.seats) if (c && seenAt[c.id] == null) seenAt[c.id] = t;
    sh.ev.length = 0;
    cd -= dt;
    if (cd <= 0) act();
  }
  return sh.result();
}

const PLAN = [['up', 0], ['up', 1], ['up', 2], ['up', 3], ['sp', 1], ['up', 4], ['up', 0], ['sp', 0], ['up', 2], ['up', 1], ['sp', 2], ['up', 3], ['up', 4], ['up', 2], ['sp', 3], ['up', 3]];
function shop(st, day, plan) {
  if (!plan) return;
  for (let guard = 0; guard < 6; guard++) {
    let bought = false;
    for (const [k, i] of PLAN) {
      if (k === 'up') {
        const u = RR.UPS[i], lvl = st.up[i];
        if (lvl >= u.prices.length) continue;
        if (st.coins >= u.prices[lvl]) { st.coins -= u.prices[lvl]; st.up[i]++; bought = true; }
        break; // buy in plan order: save up for the next item
      } else {
        const s = RR.SPECIALS[i];
        if ((st.sp >> i) & 1) continue;
        if (day < s.day) continue;
        if (st.coins >= s.price) { st.coins -= s.price; st.sp |= 1 << i; bought = true; }
        break;
      }
    }
    if (!bought) return;
  }
}
function campaign(skill, plan, seed, days) {
  const st = { coins: 0, rep: 50, up: [0, 0, 0, 0, 0], sp: 0 };
  const log = [];
  let day = 1, tries = 0, firstTryFails = 0;
  while (day <= days && tries < days * 4) {
    tries++;
    const res = playDay(day, st, skill, seed * 1000 + tries);
    st.coins += res.coins; st.rep = res.rep;
    log.push({ day, goal: res.goal, coins: res.coins, stars: res.stars, served: res.served, lost: res.lost, up: st.up.join(''), sp: st.sp });
    if (res.stars >= 1) day++; else firstTryFails++;
    shop(st, day, plan);
  }
  return { reached: day - 1, tries, firstTryFails, log, st };
}

const SEEDS = 12;
const summary = {};
for (const [name, plan] of [['reasonable', true], ['casual', true], ['good', true], ['reasonable', false]]) {
  const label = name + (plan ? ' +upgrades' : ' no-upgrades');
  let reachedMin = 1e9, fails1 = 0, totalTries = 0, starsSum = 0, n = 0;
  const perDay = {};
  for (let s = 1; s <= SEEDS; s++) {
    const c = campaign(SKILL[name], plan, s, 30);
    reachedMin = Math.min(reachedMin, c.reached);
    fails1 += c.firstTryFails; totalTries += c.tries;
    c.log.forEach(e => { starsSum += e.stars; n++; const p = perDay[e.day] = perDay[e.day] || { goal: e.goal, coins: 0, n: 0, stars: [0, 0, 0, 0], lost: 0, served: 0 }; p.coins += e.coins; p.n++; p.stars[e.stars]++; p.lost += e.lost; p.served += e.served; });
  }
  summary[label] = { reachedMin, fails1, totalTries, perDay };
  console.log(`${label.padEnd(24)} min day reached ${reachedMin}/30, retries ${fails1} in ${totalTries} days played, avg stars ${(starsSum / n).toFixed(2)}`);
  if (verbose) {
    Object.keys(perDay).forEach(d => {
      const p = perDay[d];
      console.log(`   day ${String(d).padStart(2)} goal ${String(p.goal).padStart(4)} avg ${String(Math.round(p.coins / p.n)).padStart(4)} served ${(p.served / p.n).toFixed(1).padStart(5)} lost ${(p.lost / p.n).toFixed(1).padStart(4)} stars0-3 ${p.stars.join('/')}`);
    });
  }
}
// Requirements on the goal curve.
const R = summary['reasonable +upgrades'];
if (R.reachedMin < 30) fail(`a reasonable player with upgrades got stuck before day 30 (reached ${R.reachedMin})`);
for (let d = 1; d <= RR.CAMPAIGN_DAYS; d++) {
  const p = R.perDay[d];
  if (!p) continue;
  const firstTry = p.n ? (p.stars[1] + p.stars[2] + p.stars[3]) / p.n : 0;
  if (firstTry < 0.85) fail(`day ${d}: a reasonable player with upgrades reaches the goal only ${(firstTry * 100).toFixed(0)}% of the time`);
}
const G = summary['good +upgrades'];
let three = 0; Object.keys(G.perDay).forEach(d => { three += G.perDay[d].stars[3]; });
if (three === 0) fail('3 stars are never reached by a good player');
const Cz = summary['casual +upgrades'];
if (Cz.reachedMin < 10) fail(`a casual player gets stuck before day 10 (reached ${Cz.reachedMin})`);
const M = summary['reasonable no-upgrades'];
if (M.reachedMin < 6) fail(`without any upgrades a reasonable player gets stuck before day 6 (reached ${M.reachedMin})`);
// The goal curve must rise.
for (let d = 2; d <= 40; d++) if (RR.dayGoal(d) < RR.dayGoal(d - 1)) fail(`goal drops on day ${d}`);

fails.forEach(f => console.log('  FAIL', f));
console.log(fails.length ? 'VERIFY FAIL' : 'VERIFY PASS');
process.exit(fails.length ? 1 : 0);
