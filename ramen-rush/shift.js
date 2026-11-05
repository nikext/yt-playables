/* Ramen Rush: content tables, day configuration, order generation, pricing and the
   shift simulation (customers, burners, prep bowls, serving). No DOM code: game.js drives it
   with player actions, and tools/ramen-rush-verify.cjs drives it with a simulated player. */
(function (root) {
  'use strict';
  var RR = root.RR = root.RR || {};

  // ---------- content ----------
  // k = kind (0 broth, 1 noodle, 2 topping, 3 drink), n = index inside the kind.
  // day = the first day it is on the menu. sp = bit in the "specials" mask when it must be bought.
  var ING = RR.ING = [
    [{ id: 'shoyu', val: 4, day: 1 }, { id: 'miso', val: 5, day: 3 }, { id: 'tonkotsu', val: 6, day: 8 }, { id: 'spicy', val: 7, day: 7, sp: 0, price: 140 }],
    [{ id: 'thin', val: 3, day: 1 }, { id: 'wavy', val: 3, day: 4 }, { id: 'udon', val: 4, day: 10 }],
    [{ id: 'egg', val: 2, day: 1 }, { id: 'nori', val: 1, day: 1 }, { id: 'scallion', val: 1, day: 1 }, { id: 'chashu', val: 3, day: 2 },
      { id: 'naruto', val: 2, day: 6 }, { id: 'corn', val: 2, day: 5, sp: 1, price: 90 }, { id: 'mushroom', val: 3, day: 9, sp: 2, price: 120 }],
    [{ id: 'tea', val: 3, day: 12 }, { id: 'soda', val: 4, day: 14, sp: 3, price: 130 }]
  ];
  RR.KINDS = ['broth', 'noodle', 'top', 'drink'];
  RR.SPECIALS = []; // [{k, n, sp, price, day}]
  ING.forEach(function (list, k) { list.forEach(function (it, n) { if (it.sp != null) RR.SPECIALS[it.sp] = { k: k, n: n, sp: it.sp, price: it.price, day: it.day }; }); });
  RR.ALL_SP = (1 << RR.SPECIALS.length) - 1;

  // Equipment upgrades: key, prices per level (the level count is prices.length).
  RR.UPS = [
    { id: 'slot', prices: [70, 170] },        // prep bowls 2 -> 4
    { id: 'burn', prices: [60, 150] },        // noodle burners 1 -> 3
    { id: 'boil', prices: [40, 100, 180] },   // boil time 5 -> 2.5 s
    { id: 'deco', prices: [50, 120, 220] },   // lanterns: +12% patience per level
    { id: 'tip', prices: [60, 140] }          // tip jar: +25% tips per level
  ];
  RR.UP_INDEX = { slot: 0, burn: 1, boil: 2, deco: 3, tip: 4 };
  RR.BOIL_TIME = [5, 4, 3.2, 2.5];
  RR.READY_WINDOW = 8;      // seconds cooked noodles wait in the burner before they overcook
  RR.MAX_TOPS = 3;
  RR.CAMPAIGN_DAYS = 20;
  RR.MAX_SEATS = 4;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  RR.clamp = clamp;

  // Small deterministic RNG (mulberry32).
  RR.rng = function (seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // ---------- days ----------
  // Everything that makes a day harder lives here. Days past the campaign keep scaling, with caps.
  RR.dayConfig = function (d) {
    d = Math.max(1, d | 0);
    var e = d - 1;
    var top = d <= 2 ? [1, 0, 0] : d <= 5 ? [0.6, 0.4, 0] : d <= 10 ? [0.3, 0.5, 0.2] : d <= 16 ? [0.15, 0.5, 0.35] : [0.1, 0.4, 0.5];
    return {
      day: d,
      seats: d <= 2 ? 2 : d <= 5 ? 3 : 4,
      len: 90 + Math.min(30, e * 2),
      gap: Math.max(3.8, 8.5 - 0.24 * e - (d > 20 ? 0.05 * (d - 20) : 0)),
      patience: Math.max(18, 40 - 0.85 * e - (d > 20 ? 0.2 * (d - 20) : 0)),
      top: top,
      drinkP: d < 12 ? 0 : Math.min(0.45, 0.3 + 0.01 * (d - 12)),
      vipP: d < 7 ? 0 : Math.min(0.25, 0.07 + 0.012 * (d - 7)),
      goal: RR.dayGoal(d)
    };
  };
  // Coins to earn in a day for one star. 2 stars at x1.4, 3 stars at x1.85.
  // Tuned with tools/ramen-rush-verify.cjs (a simulated player on the cheapest upgrade path).
  RR.dayGoal = function (d) {
    var e = Math.min(d, 16) - 1, g = 90 + 30 * e - 0.9 * e * e + 5 * Math.max(0, d - 16);
    return Math.round(g / 5) * 5;
  };
  RR.STAR2 = 1.4; RR.STAR3 = 1.85;
  RR.stars = function (coins, goal) { return coins >= goal * RR.STAR3 ? 3 : coins >= goal * RR.STAR2 ? 2 : coins >= goal ? 1 : 0; };

  // Ingredients on the menu for a day, given the specials mask.
  RR.owned = function (day, sp) {
    var o = [[], [], [], []];
    ING.forEach(function (list, k) {
      list.forEach(function (it, n) {
        if (it.sp != null ? (sp >> it.sp) & 1 : day >= it.day) o[k].push(n);
      });
    });
    return o;
  };
  // Free menu items that arrive on exactly this day.
  RR.newOnDay = function (day) {
    var out = [];
    ING.forEach(function (list, k) { list.forEach(function (it, n) { if (it.sp == null && it.day === day && day > 1) out.push([k, n]); }); });
    return out;
  };

  // ---------- orders ----------
  function wpick(r, items, wfn) {
    var tot = 0, i;
    for (i = 0; i < items.length; i++) tot += wfn(items[i]);
    var x = r() * tot;
    for (i = 0; i < items.length; i++) { x -= wfn(items[i]); if (x <= 0) return items[i]; }
    return items[items.length - 1];
  }
  // Newer items and bought specials show up more often: customers want what is new.
  function weight(k, n, day) {
    var it = ING[k][n];
    if (it.sp != null) return 1.6;
    return day - it.day <= 2 && it.day > 1 ? 2.2 : 1;
  }
  RR.genOrder = function (r, day, own, cfg) {
    cfg = cfg || RR.dayConfig(day);
    var o = { broth: 0, noodle: 0, tops: [], drink: -1, vip: false };
    o.broth = wpick(r, own[0], function (n) { return weight(0, n, day); });
    o.noodle = wpick(r, own[1], function (n) { return weight(1, n, day); });
    var x = r(), k = x < cfg.top[0] ? 1 : x < cfg.top[0] + cfg.top[1] ? 2 : 3;
    k = Math.min(k, own[2].length, RR.MAX_TOPS);
    var pool = own[2].slice();
    for (var i = 0; i < k; i++) {
      var t = wpick(r, pool, function (n) { return weight(2, n, day); });
      o.tops.push(t);
      pool.splice(pool.indexOf(t), 1);
    }
    o.tops.sort(function (a, b) { return a - b; });
    if (own[3].length && r() < cfg.drinkP) o.drink = wpick(r, own[3], function (n) { return weight(3, n, day); });
    o.vip = r() < cfg.vipP;
    return o;
  };
  RR.tutorialOrder = function () { return { broth: 0, noodle: 0, tops: [0], drink: -1, vip: false }; };
  RR.orderPrice = function (o) {
    var p = ING[0][o.broth].val + ING[1][o.noodle].val;
    for (var i = 0; i < o.tops.length; i++) p += ING[2][o.tops[i]].val;
    if (o.drink >= 0) p += ING[3][o.drink].val;
    return o.vip ? Math.round(p * 1.5) : p;
  };
  // Number of taps a perfect player needs for an order (start noodles, broth, toppings, drink, drain, serve).
  RR.orderTaps = function (o) { return 4 + o.tops.length + (o.drink >= 0 ? 1 : 0); };

  // ---------- bowls ----------
  RR.emptyBowl = function () { return { broth: -1, noodle: -1, tops: [], drink: -1 }; };
  RR.bowlEmpty = function (b) { return b.broth < 0 && b.noodle < 0 && !b.tops.length && b.drink < 0; };
  RR.bowlReady = function (b) { return b.broth >= 0 && b.noodle >= 0; };
  RR.matches = function (b, o) {
    if (b.broth !== o.broth || b.noodle !== o.noodle || b.drink !== o.drink || b.tops.length !== o.tops.length) return false;
    for (var i = 0; i < o.tops.length; i++) if (b.tops.indexOf(o.tops[i]) < 0) return false;
    return true;
  };
  // Can this bowl still become the order (nothing wrong in it yet)?
  RR.compatible = function (b, o) {
    if (b.broth >= 0 && b.broth !== o.broth) return false;
    if (b.noodle >= 0 && b.noodle !== o.noodle) return false;
    if (b.drink >= 0 && b.drink !== o.drink) return false;
    for (var i = 0; i < b.tops.length; i++) if (o.tops.indexOf(b.tops[i]) < 0) return false;
    return true;
  };
  RR.canAdd = function (b, k, n) {
    if (k === 0) return b.broth < 0;
    if (k === 1) return b.noodle < 0;
    if (k === 2) return b.tops.length < RR.MAX_TOPS && b.tops.indexOf(n) < 0;
    return b.drink < 0;
  };

  // ---------- the shift ----------
  // opt: { day, up: [slot, burn, boil, deco, tip], sp, rep, seed, tutorial }
  function Shift(opt) {
    var up = opt.up || [0, 0, 0, 0, 0];
    this.day = opt.day;
    this.cfg = RR.dayConfig(opt.day);
    this.own = RR.owned(opt.day, opt.sp || 0);
    this.up = up.slice();
    this.r = RR.rng(opt.seed == null ? opt.day * 7919 + 13 : opt.seed);
    this.t = 0;
    this.len = this.cfg.len;
    this.open = true;
    this.done = false;
    this.hold = !!opt.tutorial; // tutorial: clock, spawns and patience stop until the first bowl is served
    this.tutorial = !!opt.tutorial;
    this.boilTime = RR.BOIL_TIME[up[2]];
    this.patMult = 1 + 0.12 * up[3];
    this.tipMult = 1 + 0.25 * up[4];
    this.rep = opt.rep == null ? 50 : opt.rep;
    this.rep0 = this.rep;
    this.seats = [];
    for (var i = 0; i < this.cfg.seats; i++) this.seats.push(null);
    this.slots = [];
    for (i = 0; i < 2 + up[0]; i++) this.slots.push(RR.emptyBowl());
    this.boilers = [];
    for (i = 0; i < 1 + up[1]; i++) this.boilers.push({ st: 0, n: -1, t: 0 });
    this.sel = 0;
    this.spawnT = 1.0;
    this.streak = 0;
    this.nextId = 1;
    this.ev = [];
    this.stats = { served: 0, lost: 0, wrong: 0, coins: 0, tips: 0, bonus: 0, waste: 0, best: 0, vip: 0 };
  }
  RR.Shift = Shift;
  var P = Shift.prototype;

  P.emit = function (e) { this.ev.push(e); };
  P.freeSeats = function () { var f = []; for (var i = 0; i < this.seats.length; i++) if (!this.seats[i]) f.push(i); return f; };
  P.spawn = function (seat, order) {
    var o = order || RR.genOrder(this.r, this.day, this.own, this.cfg);
    var max = (this.cfg.patience + 2.5 * o.tops.length + (o.drink >= 0 ? 3 : 0)) * this.patMult * (o.vip ? 0.65 : 1);
    var c = { id: this.nextId++, seat: seat, o: o, max: max, pat: max, st: 'in', t: 0, mood: 0, look: (this.r() * 1e9) >>> 0 };
    this.seats[seat] = c;
    this.emit({ type: 'arrive', seat: seat, vip: o.vip });
    return c;
  };
  P.waiting = function (seat) { var c = this.seats[seat]; return c && c.st === 'wait' ? c : null; };

  P.update = function (dt) {
    if (this.done) return;
    var i, c;
    if (!this.hold && this.open) {
      this.t += dt;
      if (this.t >= this.len) { this.t = this.len; this.open = false; this.emit({ type: 'closing' }); }
    }
    // customers arrive
    if (this.open && !this.hold) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        var free = this.freeSeats();
        if (free.length) {
          this.spawn(free[Math.floor(this.r() * free.length)]);
          var busy = 1.15 - 0.3 * (this.rep / 100);
          this.spawnT = this.cfg.gap * busy * (0.7 + this.r() * 0.6);
        } else this.spawnT = 0.6;
      }
    } else if (this.tutorial && this.hold && !this.seats[0] && this.stats.served === 0) {
      this.spawn(0, RR.tutorialOrder());
    }
    for (i = 0; i < this.seats.length; i++) {
      c = this.seats[i];
      if (!c) continue;
      c.t += dt;
      if (c.st === 'in' && c.t >= 0.7) { c.st = 'wait'; c.t = 0; }
      else if (c.st === 'wait' && !this.hold) {
        c.pat -= dt;
        if (c.pat <= 0) { c.pat = 0; this.lose(c, 'timeout'); }
      } else if (c.st === 'out' && c.t >= 0.8) this.seats[i] = null;
    }
    // burners
    for (i = 0; i < this.boilers.length; i++) {
      var b = this.boilers[i];
      if (b.st === 1) {
        b.t += dt;
        if (b.t >= this.boilTime) { b.st = 2; b.t = 0; this.emit({ type: 'ready', b: i }); }
      } else if (b.st === 2 && !this.hold) {
        b.t += dt;
        if (b.t >= RR.READY_WINDOW) { b.st = 3; b.t = 0; this.emit({ type: 'over', b: i }); }
      } else if (b.st === 3) b.t += dt;
    }
    if (!this.open) {
      var any = false;
      for (i = 0; i < this.seats.length; i++) if (this.seats[i]) any = true;
      if (!any) { this.done = true; this.emit({ type: 'end' }); }
    }
  };

  P.lose = function (c, why) {
    c.st = 'out'; c.t = 0; c.mood = 2;
    this.stats.lost++;
    if (why === 'wrong') this.stats.wrong++;
    this.streak = 0;
    this.rep = clamp(this.rep - (why === 'wrong' ? 6 : 5), 0, 100);
    this.emit({ type: 'lost', seat: c.seat, why: why });
  };

  // Which bowl an ingredient goes to: the selected one if it can take it, else the first that can.
  P.target = function (k, n, pref) {
    var s = pref == null ? this.sel : pref;
    if (s >= 0 && s < this.slots.length && RR.canAdd(this.slots[s], k, n)) return s;
    if (pref != null) return -1; // an explicit drop on a bowl that cannot take it
    for (var i = 0; i < this.slots.length; i++) if (RR.canAdd(this.slots[i], k, n)) return i;
    return -1;
  };
  P.select = function (s) { if (s >= 0 && s < this.slots.length) this.sel = s; };

  // Broth, toppings and drinks go straight into a bowl. Returns the bowl index or -1.
  P.add = function (k, n, pref) {
    if (k === 1 || this.own[k].indexOf(n) < 0) return -1;
    var s = this.target(k, n, pref);
    if (s < 0) { this.emit({ type: 'deny', k: k, n: n }); return -1; }
    var b = this.slots[s];
    if (k === 0) b.broth = n; else if (k === 2) { b.tops.push(n); b.tops.sort(function (a, c) { return a - c; }); } else b.drink = n;
    this.sel = s;
    this.emit({ type: 'add', k: k, n: n, slot: s });
    return s;
  };
  // Drop a portion of noodles into a free burner. Returns the burner index or -1.
  P.boil = function (n, pref) {
    if (this.own[1].indexOf(n) < 0) return -1;
    var i = pref != null && this.boilers[pref] && this.boilers[pref].st === 0 ? pref : -1;
    for (var j = 0; i < 0 && j < this.boilers.length; j++) if (this.boilers[j].st === 0) i = j;
    if (i < 0) { this.emit({ type: 'deny', k: 1, n: n, full: true }); return -1; }
    this.boilers[i].st = 1; this.boilers[i].n = n; this.boilers[i].t = 0;
    this.emit({ type: 'boil', b: i, n: n });
    return i;
  };
  // Tap a burner: drain cooked noodles into a bowl, or dump overcooked ones.
  P.drain = function (bi, pref) {
    var b = this.boilers[bi];
    if (!b) return -1;
    if (b.st === 3) { this.dump(bi); return -1; }
    if (b.st !== 2) { this.emit({ type: 'deny', b: bi, notReady: b.st === 1 }); return -1; }
    var s = this.target(1, b.n, pref);
    if (s < 0) { this.emit({ type: 'deny', k: 1, n: b.n }); return -1; }
    this.slots[s].noodle = b.n;
    b.st = 0; b.t = 0;
    var n = b.n; b.n = -1;
    this.sel = s;
    this.emit({ type: 'add', k: 1, n: n, slot: s, b: bi });
    return s;
  };
  P.dump = function (bi) {
    var b = this.boilers[bi];
    if (!b || b.st < 2) return false;
    b.st = 0; b.t = 0; b.n = -1;
    this.stats.waste++;
    this.emit({ type: 'dump', b: bi });
    return true;
  };
  P.trash = function (s) {
    if (s == null) s = this.sel;
    var b = this.slots[s];
    if (!b || RR.bowlEmpty(b)) { this.emit({ type: 'deny', slot: s }); return false; }
    this.slots[s] = RR.emptyBowl();
    this.stats.waste++;
    this.emit({ type: 'trash', slot: s });
    return true;
  };
  // Serve bowl s to the customer in a seat. Returns 'ok', 'wrong', or '' when nothing happened.
  P.serve = function (s, seat) {
    var c = this.waiting(seat), b = this.slots[s];
    if (!c || !b) return '';
    if (!RR.bowlReady(b)) { this.emit({ type: 'deny', slot: s, incomplete: true }); return ''; }
    this.slots[s] = RR.emptyBowl();
    if (!RR.matches(b, c.o)) { this.lose(c, 'wrong'); return 'wrong'; }
    var frac = c.pat / c.max;
    var price = RR.orderPrice(c.o);
    var tip = Math.round(price * (0.1 + 0.5 * frac) * this.tipMult * (0.8 + 0.4 * this.rep / 100) * (c.o.vip ? 1.5 : 1));
    this.streak++;
    var bonus = this.streak >= 2 ? Math.min(4, this.streak - 1) : 0;
    this.stats.served++;
    if (c.o.vip) this.stats.vip++;
    this.stats.coins += price + tip + bonus;
    this.stats.tips += tip;
    this.stats.bonus += bonus;
    this.stats.best = Math.max(this.stats.best, this.streak);
    this.rep = clamp(this.rep + (frac > 0.6 ? 2 : 1), 0, 100);
    c.st = 'out'; c.t = 0; c.mood = 1;
    if (this.hold && this.tutorial) this.hold = false;
    this.emit({ type: 'served', seat: seat, slot: s, price: price, tip: tip, bonus: bonus, streak: this.streak, vip: c.o.vip, frac: frac });
    return 'ok';
  };
  // Tap on a customer: serve a bowl that matches their order (the selected one first),
  // otherwise the selected bowl if it is ready (which will be wrong).
  P.serveTap = function (seat) {
    var c = this.waiting(seat);
    if (!c) return '';
    var i, s = this.sel;
    if (this.slots[s] && RR.bowlReady(this.slots[s]) && RR.matches(this.slots[s], c.o)) return this.serve(s, seat);
    for (i = 0; i < this.slots.length; i++) if (RR.bowlReady(this.slots[i]) && RR.matches(this.slots[i], c.o)) return this.serve(i, seat);
    if (this.slots[s] && RR.bowlReady(this.slots[s])) return this.serve(s, seat);
    this.emit({ type: 'deny', slot: s, incomplete: true });
    return '';
  };
  P.pending = function () { var n = 0; for (var i = 0; i < this.seats.length; i++) if (this.seats[i] && this.seats[i].st !== 'out') n++; return n; };
  P.result = function () {
    var st = this.stats;
    return { coins: st.coins, tips: st.tips, bonus: st.bonus, served: st.served, lost: st.lost, wrong: st.wrong, waste: st.waste, best: st.best, vip: st.vip,
      goal: this.cfg.goal, stars: RR.stars(st.coins, this.cfg.goal), rep: this.rep, dRep: this.rep - this.rep0 };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = RR;
})(typeof window !== 'undefined' ? window : globalThis);
