/*
 * Night Drift: a one-finger arcade drift racer for YouTube Playables.
 * Vanilla JS + Canvas 2D. Art is drawn in code (art.js), sound is synthesized (audio.js),
 * the endless road comes from track.js.
 *
 * Control: HOLD anywhere (or Space / any arrow key) to drift. The car always drifts toward
 * the inside of the NEXT bend, so the road tells you the direction and the skill is timing
 * and duration. The direction is locked when you press, and a ghost arrow next to the car
 * shows it. Release to straighten out: the tires grip again and a gentle lane assist eases
 * the car back toward the middle of the road (it can follow straights and wide sweepers,
 * but not real corners).
 *
 * Physics (fixed 120 Hz step): heading h, velocity angle va, speed v. Holding rotates h at
 * v / RTURN and va follows h with a lag, which gives a constant drift slip angle and a
 * turning circle that does not depend on speed. Releasing lets va snap back to h.
 */
(function () {
  'use strict';

  var AU = window.NDAudio, I18N = window.ND_I18N, ART = window.NDArt, TR = window.NDTrack;
  var PAL = ART.PAL, FONT = ART.FONT, GLOW = ART.GLOW, PAINTS = ART.PAINTS, TRAILS = ART.TRAILS;

  PlayablesSDK.init({ storageKey: 'night-drift_save' });

  // ---------------------------------------------------------------- tuning
  var PI = Math.PI, TAU = PI * 2;
  var DT = 1 / 120;
  var RTURN = 8.6;        // drift turning radius while holding (world units)
  var SLIP_C = 0.55;      // steady-state slip angle while holding (rad)
  var R_ASSIST = 30;      // tightest radius the release assist can follow
  var GRIP = 7;           // how fast the velocity catches up with the heading after release
  var CAR_R = 0.72;       // half width used for wall contact
  var HULL_MAX = 3;
  var CRASH_SEV = 0.42;   // sin(impact angle) above which a wall hit is a crash
  var BOOST_TIME = 2.6, BOOST_MUL = 1.42, BOOST_PTS = 150;
  var COMBO_MAX = 10, TOKEN_PTS = 25;
  var V0 = 15, VADD = 13, TUT_V = 12.5;
  var TILT = 0.8;         // vertical squash of the ground plane (3/4 top-down look)
  var CAR_Y = 0.7;        // car position on screen (fraction of height; set in layout)
  var COUNT_STEP = 0.5;

  // ---------------------------------------------------------------- utils
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  var wrap = TR.wrap;
  function lerpA(a, b, t) { return a + wrap(b - a) * t; }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t) * (1 - t); }
  function easeOutBack(t) { t = clamp(t, 0, 1); var c = 1.70158; t -= 1; return 1 + (c + 1) * t * t * t + c * t * t; }

  // ---------------------------------------------------------------- canvas
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var saEl = document.getElementById('sa');
  var W = 1, H = 1, DPR = 1, u = 1, minD = 1, portrait = true;
  var SA = { t: 0, r: 0, b: 0, l: 0 };
  var L = {};
  var baseZ = 18;

  // ---------------------------------------------------------------- save / i18n
  var T = I18N.en;
  function tr(k) { return T[k] != null ? T[k] : I18N.en[k]; }
  var save = { v: 1, best: 0, tokens: 0, unlocked: ['p0', 't0'], paint: 0, trail: 0, snd: true, tut: false };

  function itemCost(kind, i) { return (kind === 'p' ? PAINTS[i] : TRAILS[i]).cost; }
  function isUnlocked(kind, i) {
    var c = itemCost(kind, i);
    if (c === 0) return true;
    if (c < 0) return save.best >= -c;
    return save.unlocked.indexOf(kind + i) >= 0;
  }
  function applySave(o) {
    if (!o || typeof o !== 'object') return;
    if (typeof o.best === 'number' && o.best >= 0) save.best = Math.floor(o.best);
    if (typeof o.tokens === 'number' && o.tokens >= 0) save.tokens = Math.floor(o.tokens);
    if (Array.isArray(o.unlocked)) {
      save.unlocked = o.unlocked.filter(function (s) { return typeof s === 'string' && /^[pt]\d$/.test(s); }).slice(0, 16);
    }
    if (typeof o.snd === 'boolean') save.snd = o.snd;
    if (typeof o.tut === 'boolean') save.tut = o.tut;
    var p = o.paint | 0, t = o.trail | 0;
    save.paint = p >= 0 && p < PAINTS.length && isUnlocked('p', p) ? p : 0;
    save.trail = t >= 0 && t < TRAILS.length && isUnlocked('t', t) ? t : 0;
  }
  function persist() {
    PlayablesSDK.save({ v: 1, best: save.best, tokens: save.tokens, unlocked: save.unlocked.slice(), paint: save.paint,
      trail: save.trail, snd: save.snd, tut: save.tut });
  }

  // ---------------------------------------------------------------- pools
  var PN = 420;
  var pX = new Float32Array(PN), pY = new Float32Array(PN), pVX = new Float32Array(PN), pVY = new Float32Array(PN);
  var pLife = new Float32Array(PN), pMax = new Float32Array(PN), pSize = new Float32Array(PN);
  var pType = new Uint8Array(PN), pCol = new Uint8Array(PN), pHead = 0;
  var P_SMOKE = 0, P_SPARK = 1, P_GLINT = 2;
  var SPARK_COLS = ['#FFD84D', '#FF9E3D', '#FF2E88', '#2EE6FF', '#F6F2FF'];

  function spawn(type, x, y, vx, vy, life, size, col) {
    var i = pHead; pHead = (pHead + 1) % PN;
    pX[i] = x; pY[i] = y; pVX[i] = vx; pVY[i] = vy; pLife[i] = life; pMax[i] = life; pSize[i] = size; pType[i] = type; pCol[i] = col;
  }
  function sparks(x, y, nx, ny, n, spd) {
    for (var i = 0; i < n; i++) {
      var a = Math.atan2(ny, nx) + (Math.random() - 0.5) * 2.2, s = spd * (0.4 + Math.random());
      spawn(P_SPARK, x, y, Math.cos(a) * s + Math.cos(car.va) * car.v * 0.6, Math.sin(a) * s + Math.sin(car.va) * car.v * 0.6,
        0.25 + Math.random() * 0.35, 1, (Math.random() * 3) | 0);
    }
  }
  function glints(x, y, n, col, spd) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, s = spd * (0.3 + Math.random());
      spawn(P_GLINT, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + Math.random() * 0.3, 0.5 + Math.random() * 0.5, col);
    }
  }

  // skid marks: ring buffer of segments (x1, y1, x2, y2, birth time)
  var SKN = 1400, SK = new Float32Array(SKN * 5), skHead = 0, skCount = 0;
  function addSkid(x1, y1, x2, y2, t) {
    var o = skHead * 5;
    SK[o] = x1; SK[o + 1] = y1; SK[o + 2] = x2; SK[o + 3] = y2; SK[o + 4] = t;
    skHead = (skHead + 1) % SKN; if (skCount < SKN) skCount++;
  }
  // light trail: ring of rear positions
  var TRN = 64, TRX = new Float32Array(TRN), TRY = new Float32Array(TRN), TRB = new Float32Array(TRN), trHead = 0, trCount = 0;
  function trailPush(x, y, b) { TRX[trHead] = x; TRY[trHead] = y; TRB[trHead] = b; trHead = (trHead + 1) % TRN; if (trCount < TRN) trCount++; }

  // floating texts (screen space, relative to the car)
  var FLOATS = [];
  for (var fi = 0; fi < 6; fi++) FLOATS.push({ str: '', t: 0, life: 0, col: '#fff', sz: 1, dy: 0 });
  var floatHead = 0;
  function floatText(str, col, sz) {
    var f = FLOATS[floatHead]; floatHead = (floatHead + 1) % FLOATS.length;
    // stack above the texts that are still young so they never overlap
    var row = 0;
    for (var i = 0; i < FLOATS.length; i++) if (FLOATS[i] !== f && FLOATS[i].life > 0 && FLOATS[i].t < 0.6) row = Math.max(row, FLOATS[i].dy + 1);
    f.str = str; f.t = 0; f.life = 1.1; f.col = col; f.sz = sz || 1; f.dy = Math.min(row, 3);
  }

  // speed lines for boost
  var SLN = 22, SLA = new Float32Array(SLN), SLR = new Float32Array(SLN), SLS = new Float32Array(SLN);
  for (var si = 0; si < SLN; si++) { SLA[si] = Math.random() * TAU; SLR[si] = Math.random(); SLS[si] = 0.6 + Math.random() * 0.8; }

  // ---------------------------------------------------------------- state
  var state = 'title';          // 'title' | 'garage' | 'play' | 'over'
  var pauseMode = null;         // null | 'menu' | 'count'
  var countT = 0, lastCount = 0;
  var ready = false, running = false, rafId = 0, lastT = 0, time = 0, acc = 0;
  var timeScale = 1, slowTarget = 1, dbgScale = 1;
  var lastInput = 'touch';
  var runT = 0;                 // simulated seconds this run

  var car = { x: 0, y: 0, h: 0, va: 0, v: 0, px: 0, py: 0, ph: 0, seg: 0, s: 0, d: 0, hw: 5, tang: 0, k: 0, alive: true, spin: 0 };
  var cam = { x: 0, y: 0, a: 0, z: 1, px: 0, py: 0, pa: 0, pz: 1 };
  var P1 = { x: 0, y: 0, h: 0, k: 0, hw: 0, id: 0, s: 0, d: 0, t: 0 };
  var P2 = { x: 0, y: 0, h: 0, k: 0, hw: 0, id: 0, s: 0, d: 0, t: 0 };

  var score = 0, maxS = 0, tokensRun = 0, combo = 1, maxCombo = 1, hull = HULL_MAX, boost = 0, boostT = 0, boostWait = 0, boostVis = 0;
  var driftOn = false, driftPts = 0, driftT = 0, holdPrev = false, latched = 1, dirAhead = 1, bendDist = 99;
  var hitCount = { crash: 0, scrape: 0, wrong: 0, log: [] };
  var graceT = 0;
  var contact = false, scrapeCD = 0, shake = 0, tokenChain = 0, tokenChainT = 0, deadT = 0;
  var tutorialOn = false, tutProtectS = 0, hintMode = 0, hintT = 0;
  var wheelL = { x: 0, y: 0 }, wheelR = { x: 0, y: 0 }, skidOn = false, stepN = 0;
  var overT = 0, finalScore = 0, newBest = false, newUnlock = '', overSfx = 0, shownScore = 0;
  var scoreShown = -1, scoreStr = '0', tokStr = '0', tokShown = -1;

  // input
  var ptrs = {}, ptrHold = 0, keys = {}, keyHold = 0, needRelease = false, pressed = null;
  function holdingNow() { return !needRelease && (ptrHold > 0 || keyHold > 0); }

  // garage
  var gRow = 0, gPaint = 0, gTrail = 0, gFlash = 0, gDeny = 0;

  // ---------------------------------------------------------------- run lifecycle
  function resetPools() {
    for (var i = 0; i < PN; i++) pLife[i] = 0;
    skHead = 0; skCount = 0; trHead = 0; trCount = 0;
    for (var j = 0; j < FLOATS.length; j++) FLOATS[j].life = 0;
  }

  function startRun() {
    tutorialOn = !save.tut;
    TR.reset((Math.random() * 4294967295) >>> 0, tutorialOn);
    TR.ensure(360);
    TR.sample(0, 4, 0, P1);
    car.x = car.px = P1.x; car.y = car.py = P1.y; car.h = car.va = car.ph = P1.h; car.v = 9;
    car.seg = 0; car.s = 4; car.d = 0; car.hw = P1.hw; car.tang = P1.h; car.k = 0; car.alive = true; car.spin = 0;
    cam.x = cam.px = car.x; cam.y = cam.py = car.y; cam.a = cam.pa = car.h; cam.z = cam.pz = 1;
    score = 0; maxS = car.s; tokensRun = 0; combo = 1; maxCombo = 1; hull = HULL_MAX; boost = 0; boostT = 0; boostWait = 0; boostVis = 0;
    driftOn = false; driftPts = 0; driftT = 0; holdPrev = false; latched = 1; dirAhead = 1;
    hitCount.crash = hitCount.scrape = hitCount.wrong = 0;
    contact = false; scrapeCD = 0; graceT = 0; shake = 0; tokenChain = 0; tokenChainT = 0; deadT = 0;
    hintMode = 0; hintT = 0; runT = 0; acc = 0; timeScale = 1; slowTarget = 1; skidOn = false; stepN = 0;
    var t2 = TR.segById(TR.tutSeg() + 2); // the second tutorial bend
    tutProtectS = tutorialOn && t2 ? t2.s0 + t2.len + 30 : 0;
    resetPools();
    state = 'play'; pauseMode = null;
    needRelease = ptrHold > 0 || keyHold > 0;
    AU.click();
  }

  function toTitle() {
    state = 'title'; pauseMode = null; timeScale = 1;
    AU.click();
  }
  function openGarage() {
    state = 'garage'; pauseMode = null; gPaint = save.paint; gTrail = save.trail; gRow = 0;
    AU.click();
  }
  function openPause() {
    if (state === 'play' && car.alive && !pauseMode) { pauseMode = 'menu'; AU.click(); }
  }
  function beginCount() { pauseMode = 'count'; countT = COUNT_STEP * 3; lastCount = 4; }

  function finishTutorial() {
    if (!tutorialOn) return;
    tutorialOn = false; save.tut = true; hintMode = 0; slowTarget = 1;
    floatText(tr('niceDrift'), PAL.cyan, 1.1);
    persist();
  }

  function die(side) {
    car.alive = false; car.spin = (side || 1) * 7; deadT = 0;
    driftOn = false; slowTarget = 0.6;
    AU.crash();
  }

  function gameOver() {
    state = 'over'; overT = 0; pauseMode = null; timeScale = 1; slowTarget = 1;
    finalScore = Math.floor(score); shownScore = 0;
    var prevBest = save.best;
    newBest = finalScore > save.best;
    if (newBest) save.best = finalScore;
    save.tokens += tokensRun;
    newUnlock = '';
    for (var i = 0; i < PAINTS.length; i++) if (PAINTS[i].cost < 0 && prevBest < -PAINTS[i].cost && save.best >= -PAINTS[i].cost) newUnlock = tr('paints')[i];
    for (var j = 0; j < TRAILS.length; j++) if (TRAILS[j].cost < 0 && prevBest < -TRAILS[j].cost && save.best >= -TRAILS[j].cost) newUnlock = tr('trails')[j];
    persist();
    PlayablesSDK.sendScore(save.best);
    AU.over(); overSfx = newBest ? 0.7 : 0;
  }

  // ---------------------------------------------------------------- simulation
  function targetSpeed() {
    var v = V0 + VADD * (1 - Math.exp(-car.s / 4200));
    if (tutorialOn && car.s < tutProtectS) v = Math.min(v, TUT_V);
    if (boostT > 0) v *= BOOST_MUL;
    return car.alive ? v : 0;
  }

  /** Direction (+1 right / -1 left) of the next bend, and the distance to it. */
  function nextBend() {
    var look = car.s + 2 + car.v * 0.2;
    for (var j = car.seg; j < car.seg + 14; j++) {
      var g = TR.segById(j); if (!g) break;
      if (g.k !== 0 && g.s0 + g.len > look) { bendDist = Math.max(0, g.s0 - car.s); return g.dir; }
    }
    bendDist = 99;
    return dirAhead;
  }
  function straightAhead(len) {
    for (var j = car.seg; j < car.seg + 10; j++) {
      var g = TR.segById(j); if (!g) break;
      if (g.s0 > car.s + len) break;
      if (g.k !== 0 && g.R < 30 && g.s0 + g.len > car.s) return false;
    }
    return true;
  }

  function hitWall(sev, crash, side) {
    scrapeCD = 0.35;
    if (crash) hitCount.crash++; else hitCount.scrape++;
    if (driftOn && driftPts > 5) floatText(crash ? tr('crash') : tr('scrape'), PAL.red, 0.9);
    driftOn = false; driftPts = 0; driftT = 0;
    combo = 1;
    var protect = (tutorialOn && car.s < tutProtectS) || graceT > 0;
    if (!protect) { hull -= crash ? 1 : 0.28 + 0.5 * sev; graceT = crash ? 1.3 : 0.3; }
    var nx = -Math.sin(car.tang) * side, ny = Math.cos(car.tang) * side;
    sparks(car.x + nx * CAR_R, car.y + ny * CAR_R, -nx, -ny, crash ? 26 : 10, crash ? 9 : 6);
    shake = Math.max(shake, crash ? 0.45 : 0.15);
    if (crash) AU.crash(); else AU.scrape(sev);
    if (hull <= 0.001) { hull = 0; die(side); }
  }

  function bankDrift() {
    driftOn = false;
    if (driftT < 0.2 || driftPts < 4) { driftPts = 0; return; }
    var pts = Math.round(driftPts) * combo;
    score += pts;
    if (boostT <= 0) boost = Math.min(1, boost + driftPts / BOOST_PTS);
    combo = Math.min(COMBO_MAX, combo + 1); if (combo > maxCombo) maxCombo = combo;
    hull = Math.min(HULL_MAX, hull + 0.06);
    floatText('+' + pts, combo >= 5 ? PAL.sunY : combo >= 3 ? PAL.cyan : PAL.white, 1);
    AU.bank(combo);
    driftPts = 0;
    if (tutorialOn) finishTutorial();
  }

  function fireBoost() {
    boostT = BOOST_TIME; boost = 0; boostWait = 0;
    floatText(tr('boost'), PAL.sunY, 1.15);
    AU.boost();
  }

  function takeToken(k) {
    k.taken = true; k.tt = 0;
    tokensRun++;
    score += TOKEN_PTS * combo;
    if (boostT <= 0) boost = Math.min(1, boost + 0.025);
    tokenChain = tokenChainT > 0 ? tokenChain + 1 : 0; tokenChainT = 1.3;
    glints(k.x, k.y, 10, 3, 7);
    AU.token(tokenChain);
  }

  function savePrev() {
    car.px = car.x; car.py = car.y; car.ph = car.h;
    cam.px = cam.x; cam.py = cam.y; cam.pa = cam.a; cam.pz = cam.z;
  }

  function step(dt) {
    runT += dt; stepN++;
    var hold = car.alive && holdingNow();
    dirAhead = nextBend();
    if (hold && !holdPrev) latched = dirAhead;
    holdPrev = hold;

    // speed
    var vt = targetSpeed();
    if (car.v < vt) car.v = Math.min(vt, car.v + (boostT > 0 ? 24 : 6.5) * dt);
    else car.v = Math.max(vt, car.v - (car.alive ? 9 : 14) * dt);

    // steering / slip
    if (car.alive) {
      var v = Math.max(car.v, 4), kv;
      if (hold) {
        car.h += latched * v / RTURN * dt;
        kv = v / (RTURN * SLIP_C);
        car.v -= car.v * 0.035 * dt;
      } else {
        TR.sample(car.seg, car.s + 5 + car.v * 0.45, 0, P2);
        var err = wrap(Math.atan2(P2.y - car.y, P2.x - car.x) - car.h), mr = v / R_ASSIST;
        car.h += clamp(err * 4.5, -mr, mr) * dt;
        kv = GRIP;
      }
      car.va += wrap(car.h - car.va) * Math.min(1, kv * dt);
    } else {
      car.h += car.spin * dt; car.spin *= Math.max(0, 1 - 1.8 * dt);
      car.va += wrap(car.h - car.va) * Math.min(1, 1.2 * dt);
    }
    car.x += Math.cos(car.va) * car.v * dt;
    car.y += Math.sin(car.va) * car.v * dt;

    TR.project(car.x, car.y, car.seg, P1);
    car.seg = P1.id; car.s = P1.s; car.d = P1.d; car.hw = P1.hw; car.tang = P1.h; car.k = P1.k;

    // distance score
    if (car.s > maxS) { if (car.alive) score += (car.s - maxS) * 0.5 * (boostT > 0 ? 2 : 1); maxS = car.s; }

    // wrong way (spun round): counts as a crash, then the car is set straight
    if (car.alive && Math.abs(wrap(car.va - car.tang)) > 1.95) {
      hitCount.wrong++;
      hitWall(1, true, car.d >= 0 ? 1 : -1);
      if (car.alive) { car.h = car.va = car.tang; car.v *= 0.5; }
    }

    // walls
    var lim = car.hw - CAR_R, ad = Math.abs(car.d), touching = false;
    if (scrapeCD > 0) scrapeCD -= dt;
    if (graceT > 0) graceT -= dt;
    if (ad > lim) {
      touching = true;
      var sd = car.d > 0 ? 1 : -1;
      var nx = -Math.sin(car.tang) * sd, ny = Math.cos(car.tang) * sd;
      var push = ad - lim;
      car.x -= nx * push; car.y -= ny * push; car.d = sd * lim;
      var vx = Math.cos(car.va) * car.v, vy = Math.sin(car.va) * car.v, vOut = vx * nx + vy * ny;
      if (vOut > 0) {
        var sev = vOut / Math.max(1, car.v);
        vx -= nx * vOut * 1.2; vy -= ny * vOut * 1.2;
        car.va = Math.atan2(vy, vx);
        car.h = car.va + wrap(car.h - car.va) * 0.5;
        var nv = Math.sqrt(vx * vx + vy * vy);
        if (car.alive && sev > CRASH_SEV) { car.v = nv * 0.55; hitWall(sev, true, sd); }
        else {
          car.v = nv * (1 - 0.3 * sev);
          if (car.alive && (!contact || scrapeCD <= 0)) hitWall(sev, false, sd);
        }
      }
      if (car.alive) {
        car.v -= car.v * 0.6 * dt;
        if (!(tutorialOn && car.s < tutProtectS) && graceT <= 0) { hull -= 0.4 * dt; if (hull <= 0) { hull = 0; die(sd); } }
        if (Math.random() < 0.45) sparks(car.x + nx * CAR_R, car.y + ny * CAR_R, -nx, -ny, 1, 5);
      }
    }
    contact = touching;

    // drifting & scoring
    var slipS = wrap(car.h - car.va), slip = Math.abs(slipS);
    if (hold && !driftOn) { driftOn = true; driftPts = 0; driftT = 0; }
    if (driftOn) {
      if (slip > 0.06) { driftPts += car.v * slip * 5 * dt * (boostT > 0 ? 2 : 1); driftT += dt; }
      if (!hold && slip < 0.08) bankDrift();
    }

    // boost
    if (boostT > 0) { boostT -= dt; if (boostT < 0) boostT = 0; }
    else if (boost >= 1 && car.alive) {
      boostWait += dt;
      if (straightAhead(22) || boostWait > 2.2) fireBoost();
    }

    // tokens
    var toks = TR.tokens;
    for (var i = 0; i < toks.length; i++) {
      var k = toks[i];
      if (k.s > car.s + 4) break;
      if (k.taken) { k.tt += dt; continue; }
      if (k.s < car.s - 4 || !car.alive) continue;
      var dx = k.x - car.x, dy = k.y - car.y;
      if (dx * dx + dy * dy < 2.9) takeToken(k);
    }
    if (tokenChainT > 0) tokenChainT -= dt;

    // effects: smoke, skid marks, light trail, boost sparks
    var ch = Math.cos(car.h), sh = Math.sin(car.h);
    var lx = car.x - ch * 0.86 + sh * 0.63, ly = car.y - sh * 0.86 - ch * 0.63;
    var rx = car.x - ch * 0.86 - sh * 0.63, ry = car.y - sh * 0.86 + ch * 0.63;
    var marking = slip > 0.22 && car.v > 4;
    if (stepN % 3 === 0) {
      if (marking && skidOn) { addSkid(wheelL.x, wheelL.y, lx, ly, runT); addSkid(wheelR.x, wheelR.y, rx, ry, runT); }
      skidOn = marking;
      wheelL.x = lx; wheelL.y = ly; wheelR.x = rx; wheelR.y = ry;
    }
    if (marking && Math.random() < slip * 0.9) {
      var side = Math.random() < 0.5;
      spawn(P_SMOKE, side ? lx : rx, side ? ly : ry, (Math.random() - 0.5) * 2 + Math.cos(car.va) * car.v * 0.25,
        (Math.random() - 0.5) * 2 + Math.sin(car.va) * car.v * 0.25, 0.7 + Math.random() * 0.6, 0.45 + Math.random() * 0.35, 0);
    }
    if (stepN % 2 === 0) trailPush(car.x - ch * 1.4, car.y - sh * 1.4, boostT > 0 ? 1 : 0);
    if (boostT > 0 && Math.random() < 0.6) {
      spawn(P_GLINT, car.x - ch * 1.5 + (Math.random() - 0.5) * 0.6, car.y - sh * 1.5 + (Math.random() - 0.5) * 0.6,
        -ch * 6 + (Math.random() - 0.5) * 3, -sh * 6 + (Math.random() - 0.5) * 3, 0.3 + Math.random() * 0.2, 0.6, 4 + save.trail);
    }

    // particles
    for (var p = 0; p < PN; p++) {
      if (pLife[p] <= 0) continue;
      pLife[p] -= dt;
      var damp = pType[p] === P_SMOKE ? 1 - 1.6 * dt : 1 - 2.5 * dt;
      pVX[p] *= damp; pVY[p] *= damp;
      pX[p] += pVX[p] * dt; pY[p] += pVY[p] * dt;
    }

    // camera: turn toward where the road goes, not where the car body points
    TR.sample(car.seg, car.s + 12, 0, P2);
    if (car.alive) {
      var target = car.va + 0.55 * wrap(P2.h - car.va);
      cam.a += wrap(target - cam.a) * Math.min(1, 2.6 * dt);
    }
    cam.x = car.x; cam.y = car.y;
    var zt = (V0 + 6) / (V0 + 6 + Math.max(0, car.v - V0) * 0.5) * (boostT > 0 ? 0.92 : 1);
    cam.z += (zt - cam.z) * Math.min(1, 1.5 * dt);
    if (shake > 0) shake = Math.max(0, shake - dt * 1.2);

    // tutorial hints: slow time just before the first bend until the player holds
    if (tutorialOn && car.alive) {
      var g = TR.segById(car.seg), inBend = g && g.k !== 0;
      if (!hold && !driftOn && bendDist < 7 && (inBend ? car.s - g.s0 < g.len * 0.4 : true)) { hintMode = 1; slowTarget = 0.3; }
      else if (hold) {
        slowTarget = 1;
        // heading close to where the road goes after the bend: time to let go
        TR.sample(car.seg, car.s + 9, 0, P2);
        hintMode = Math.abs(wrap(P2.h - car.h)) < 0.35 && inBend ? 2 : 0;
      } else { slowTarget = 1; if (hintMode === 1 && bendDist > 7) hintMode = 0; if (hintMode === 2) hintMode = 0; }
    }

    // death
    if (!car.alive) { deadT += dt; if (deadT > 0.85) gameOver(); }

    // world upkeep
    TR.ensure(car.s + 320);
    TR.cull(car.s - 70);
  }

  // ---------------------------------------------------------------- update (per frame)
  function update(dt) {
    time += dt;
    for (var i = 0; i < FLOATS.length; i++) if (FLOATS[i].life > 0) { FLOATS[i].t += dt; if (FLOATS[i].t >= FLOATS[i].life) FLOATS[i].life = 0; }
    if (gFlash > 0) gFlash -= dt;
    if (gDeny > 0) gDeny -= dt;

    if (state === 'play') {
      if (pauseMode === 'count') {
        countT -= dt;
        var n = Math.ceil(countT / COUNT_STEP);
        if (n !== lastCount && n > 0) { lastCount = n; AU.tick(false); }
        if (countT <= 0) { pauseMode = null; AU.tick(true); }
      }
      if (!pauseMode) {
        timeScale += (slowTarget - timeScale) * Math.min(1, dt * (slowTarget < timeScale ? 6 : 10));
        acc += dt * timeScale * dbgScale;
        var steps = 0;
        while (acc >= DT && steps < 60 && state === 'play') { savePrev(); step(DT); acc -= DT; steps++; }
        if (steps >= 60) acc = 0;
        boostVis += ((boostT > 0 ? 1 : 0) - boostVis) * Math.min(1, dt * 4);
      }
      var playing = state === 'play' && !pauseMode && car.alive;
      var slip = Math.abs(wrap(car.h - car.va));
      AU.engine(state === 'play' && !pauseMode, clamp((car.v - 6) / 30, 0, 1), playing ? clamp((slip - 0.15) * 2.2, 0, 1) : 0, boostVis);
      AU.music(playing, clamp(Math.max(boostVis, (combo - 2) / 6), 0, 1));
    } else {
      AU.engine(false, 0, 0, 0);
      AU.music(false, 0);
    }
    if (state === 'over') {
      overT += dt;
      shownScore = finalScore * easeOut(overT / 1.1);
      if (overSfx > 0) { overSfx -= dt; if (overSfx <= 0) AU.best(); }
      for (var p = 0; p < PN; p++) if (pLife[p] > 0) { pLife[p] -= dt; pX[p] += pVX[p] * dt; pY[p] += pVY[p] * dt; }
    }
  }

  // ---------------------------------------------------------------- camera transform
  var CA = 1, CB = 0, CC = 0, CD = 1, CE = 0, CF = 0, SX = 0, SY = 0, ZPX = 1;
  function setCam(cx, cy, ca, z, ox, oy) {
    var th = -PI / 2 - ca, cs = Math.cos(th), sn = Math.sin(th);
    ZPX = z;
    CA = z * cs; CB = z * TILT * sn; CC = -z * sn; CD = z * TILT * cs;
    CE = ox - (CA * cx + CC * cy); CF = oy - (CB * cx + CD * cy);
  }
  function applyCam() { ctx.setTransform(CA * DPR, CB * DPR, CC * DPR, CD * DPR, CE * DPR, CF * DPR); }
  function screenT() { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
  function toS(x, y) { SX = CA * x + CC * y + CE; SY = CB * x + CD * y + CF; }
  var BX0 = 0, BX1 = 0, BY0 = 0, BY1 = 0;
  function worldBounds() {
    var det = CA * CD - CB * CC;
    BX0 = BY0 = 1e9; BX1 = BY1 = -1e9;
    for (var i = 0; i < 4; i++) {
      var sx = (i & 1 ? W : 0) - CE, sy = (i & 2 ? H : 0) - CF;
      var wx = (CD * sx - CC * sy) / det, wy = (-CB * sx + CA * sy) / det;
      if (wx < BX0) BX0 = wx; if (wx > BX1) BX1 = wx; if (wy < BY0) BY0 = wy; if (wy > BY1) BY1 = wy;
    }
  }

  // ---------------------------------------------------------------- drawing helpers
  var FONT_CACHE = {};
  function setFont(sz, wt, it) {
    var px = Math.max(1, Math.round(sz)), key = (it ? 'i' : 'n') + (wt || 800) + '_' + px;
    var f = FONT_CACHE[key];
    if (!f) f = FONT_CACHE[key] = (it ? 'italic ' : '') + (wt || 800) + ' ' + px + 'px ' + FONT;
    ctx.font = f;
  }
  function fitFont(str, sz, wt, maxW, it) {
    setFont(sz, wt, it);
    var w = ctx.measureText(str).width;
    if (w > maxW && w > 0) { sz = sz * maxW / w; setFont(sz, wt, it); }
    return sz;
  }
  function label(str, x, y, sz, col, align, wt, maxW, it) {
    if (maxW) fitFont(str, sz, wt, maxW, it); else setFont(sz, wt, it);
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = col; ctx.fillText(str, x, y);
  }
  /** Text with a soft colored glow made of offset copies (no shadowBlur). */
  function glowLabel(str, x, y, sz, col, glow, align, wt, maxW, it) {
    if (maxW) sz = fitFont(str, sz, wt, maxW, it); else setFont(sz, wt, it);
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.35; ctx.fillStyle = glow;
    var o = Math.max(1, sz * 0.05);
    ctx.fillText(str, x - o, y + o); ctx.fillText(str, x + o, y + o);
    ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.fillText(str, x, y);
  }
  function rr(x, y, w, h, r) { ART.rr(ctx, x, y, w, h, r); }
  function rect(x, y, w, h) { return { x: x, y: y, w: w, h: h }; }
  function inRect(b, x, y, pad) { pad = pad || 0; return b && x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad; }

  function neonStroke(col, w) {
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.18; ctx.lineWidth = w * 4; ctx.stroke();
    ctx.globalAlpha = 0.35; ctx.lineWidth = w * 2; ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = w; ctx.stroke();
  }

  /** kind: 'primary' | 'ghost' | 'disabled' */
  function drawBtn(b, kind, id) {
    var down = pressed === id, s = down ? 0.96 : 1;
    var x = b.x + b.w * (1 - s) / 2, y = b.y + b.h * (1 - s) / 2, w = b.w * s, h = b.h * s, r = Math.min(h * 0.32, 18 * u);
    if (kind === 'primary') {
      rr(x, y + 4 * u, w, h, r); ctx.fillStyle = '#7A0B3D'; ctx.fill();
      rr(x, y, w, h, r); ctx.fillStyle = down ? '#C3125F' : PAL.btn; ctx.fill();
      ctx.save(); rr(x, y, w, h, r); ctx.clip();
      ctx.globalAlpha = 0.22; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h * 0.42); ctx.globalAlpha = 1;
      ctx.restore();
      rr(x, y, w, h, r); neonStroke(PAL.btnHi, 1.5 * u);
    } else {
      rr(x, y, w, h, r); ctx.fillStyle = kind === 'disabled' ? '#1A1438' : PAL.panelHi; ctx.fill();
      rr(x, y, w, h, r);
      if (kind === 'disabled') { ctx.strokeStyle = '#3A2E6E'; ctx.lineWidth = 1.5 * u; ctx.stroke(); }
      else neonStroke(PAL.cyan, 1.2 * u);
    }
  }
  function roundBtn(b, id, icon, on) {
    var down = pressed === id, cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = b.w / 2 * (down ? 0.94 : 1);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = PAL.panelHi; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); neonStroke(PAL.cyan, 1.2 * u);
    var s = r * 1.1;
    if (icon === 'pause') ART.iconPause(ctx, cx, cy, s, PAL.ink);
    else if (icon === 'sound') ART.iconSound(ctx, cx, cy, s, PAL.ink, on);
    else if (icon === 'garage') ART.iconCar(ctx, cx, cy, s, PAL.ink);
    else if (icon === 'home') ART.iconHome(ctx, cx, cy, s, PAL.ink);
    else if (icon === 'retry') ART.iconRetry(ctx, cx, cy, s, PAL.ink);
    else if (icon === 'back') ART.iconBack(ctx, cx, cy, s, PAL.ink);
  }

  // ---------------------------------------------------------------- world rendering
  var DASH_C = [2.4, 3.6], DASH_K = [0.9, 0.9], NO_DASH = [];
  var AHEAD = 150, BEHIND = 45;

  function pathSeg(g, o) {
    if (g.k === 0) {
      var c = Math.cos(g.h0), s = Math.sin(g.h0);
      ctx.lineTo(g.x0 - s * o, g.y0 + c * o);
      ctx.lineTo(g.x1 - s * o, g.y1 + c * o);
    } else {
      ctx.arc(g.cx, g.cy, g.R - g.dir * o, g.a0, g.a0 + g.k * g.len, g.k < 0);
    }
  }
  var visA = 0, visB = -1;
  function visibleRange() {
    var segs = TR.segs; visA = 0; visB = -1;
    for (var i = 0; i < segs.length; i++) {
      var g = segs[i];
      if (g.s0 + g.len < car.s - BEHIND) { visA = i + 1; continue; }
      if (g.s0 > car.s + AHEAD) break;
      visB = i;
    }
  }
  function roadPath(o, sideW) {
    var segs = TR.segs;
    ctx.beginPath();
    for (var i = visA; i <= visB; i++) {
      var g = segs[i];
      if (sideW) pathSeg(g, o * (g.w + sideW));
      else pathSeg(g, o);
      if (i === visA) { /* arc() started the subpath; lineTo of straights too */ }
    }
  }
  function edgePath(side) {
    var segs = TR.segs;
    ctx.beginPath();
    for (var i = visA; i <= visB; i++) { var g = segs[i]; pathSeg(g, side * g.w); }
  }

  function drawGrid() {
    worldBounds();
    var G = 6, x, y;
    ctx.beginPath();
    for (x = Math.ceil(BX0 / G) * G; x <= BX1; x += G) { ctx.moveTo(x, BY0); ctx.lineTo(x, BY1); }
    for (y = Math.ceil(BY0 / G) * G; y <= BY1; y += G) { ctx.moveTo(BX0, y); ctx.lineTo(BX1, y); }
    ctx.strokeStyle = PAL.grid; ctx.globalAlpha = 0.55; ctx.lineWidth = 0.07; ctx.stroke();
    ctx.beginPath();
    var G4 = G * 4;
    for (x = Math.ceil(BX0 / G4) * G4; x <= BX1; x += G4) { ctx.moveTo(x, BY0); ctx.lineTo(x, BY1); }
    for (y = Math.ceil(BY0 / G4) * G4; y <= BY1; y += G4) { ctx.moveTo(BX0, y); ctx.lineTo(BX1, y); }
    ctx.strokeStyle = PAL.violet; ctx.globalAlpha = 0.28; ctx.lineWidth = 0.12; ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawRoad() {
    if (visB < visA) return;
    var segs = TR.segs, hw = car.hw;
    ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
    // dark shoulder hides the grid next to the road, a faint violet spill sells the glow
    roadPath(0); ctx.strokeStyle = PAL.shoulder; ctx.lineWidth = 2 * (hw + 1.6); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.07; ctx.strokeStyle = PAL.violet; ctx.lineWidth = 2 * (hw + 2.6); ctx.stroke();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = PAL.road; ctx.lineWidth = 2 * hw; ctx.stroke();
    ctx.globalAlpha = 0.35; ctx.strokeStyle = PAL.roadHi; ctx.lineWidth = hw * 1.1; ctx.stroke();
    // center dashes, phase anchored to the road distance so they do not jump
    ctx.globalAlpha = 0.4; ctx.strokeStyle = PAL.violetL; ctx.lineWidth = 0.16;
    ctx.setLineDash(DASH_C); ctx.lineDashOffset = segs[visA].s0 % 6; ctx.stroke();
    ctx.setLineDash(NO_DASH); ctx.lineDashOffset = 0;
    ctx.globalAlpha = 1;
    // kerbs on the inside of real corners
    ctx.beginPath();
    var any = false;
    for (var i = visA; i <= visB; i++) {
      var g = segs[i];
      if (g.k === 0 || g.R > 27) continue;
      var a0 = g.a0, a1 = g.a0 + g.k * g.len, rr2 = g.R - (g.w - 0.3);
      ctx.moveTo(g.cx + Math.cos(a0) * rr2, g.cy + Math.sin(a0) * rr2);
      ctx.arc(g.cx, g.cy, rr2, a0, a1, g.k < 0);
      any = true;
    }
    if (any) {
      ctx.lineWidth = 0.55; ctx.strokeStyle = PAL.kerb; ctx.stroke();
      ctx.setLineDash(DASH_K); ctx.strokeStyle = PAL.magenta; ctx.globalAlpha = 0.75; ctx.stroke();
      ctx.setLineDash(NO_DASH); ctx.globalAlpha = 1;
    }
    // neon edges: magenta on the left, cyan on the right (layered strokes, additive)
    ctx.lineCap = 'round';
    for (var side = -1; side <= 1; side += 2) {
      var col = side < 0 ? PAL.magenta : PAL.cyan;
      edgePath(side);
      ctx.strokeStyle = col;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.07; ctx.lineWidth = 1.9; ctx.stroke();
      ctx.globalAlpha = 0.14; ctx.lineWidth = 0.9; ctx.stroke();
      ctx.globalAlpha = 0.6; ctx.lineWidth = 0.36; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1; ctx.lineWidth = 0.16; ctx.stroke();
      ctx.globalAlpha = 0.7; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 0.05; ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  }

  function drawSkids() {
    if (!skCount) return;
    ctx.strokeStyle = PAL.skid; ctx.lineWidth = 0.24; ctx.lineCap = 'round';
    for (var band = 0; band < 4; band++) {
      var a0 = band * 2.5, a1 = a0 + 2.5;
      ctx.beginPath();
      var n = 0;
      for (var i = 0; i < skCount; i++) {
        var o = i * 5, age = runT - SK[o + 4];
        if (age < a0 || age >= a1) continue;
        ctx.moveTo(SK[o], SK[o + 1]); ctx.lineTo(SK[o + 2], SK[o + 3]); n++;
      }
      if (n) { ctx.globalAlpha = 0.6 - band * 0.15; ctx.stroke(); }
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  }

  function drawTokens() {
    var toks = TR.tokens, z = ZPX, i, k;
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < toks.length; i++) {
      k = toks[i];
      if (k.s > car.s + AHEAD) break;
      if (k.taken && k.tt > 0.35) continue;
      toS(k.x, k.y);
      if (SX < -60 || SX > W + 60 || SY < -60 || SY > H + 60) continue;
      var a = k.taken ? 1 - k.tt / 0.35 : 0.85, r = z * (k.taken ? 1.4 + k.tt * 4 : 1.25);
      ctx.globalAlpha = a; ctx.drawImage(GLOW.cyan, SX - r * 1.3, SY - r * 1.3 - z * 0.5, r * 2.6, r * 2.6);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (i = 0; i < toks.length; i++) {
      k = toks[i];
      if (k.s > car.s + AHEAD) break;
      if (k.taken) continue;
      toS(k.x, k.y);
      if (SX < -40 || SX > W + 40 || SY < -40 || SY > H + 40) continue;
      var bob = Math.sin(time * 3 + k.s) * z * 0.12, sp = Math.cos(time * 2.6 + k.s * 0.7);
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#05030F';
      ctx.beginPath(); ctx.ellipse(SX, SY + z * 0.15, z * 0.38, z * 0.14, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(SX, SY - z * 0.55 + bob); ctx.scale(0.35 + 0.65 * Math.abs(sp), 1);
      ART.iconToken(ctx, 0, 0, z * 1.15, PAL.cyan, '#E8FDFF');
      ctx.restore();
    }
  }

  function drawDecor() {
    var dec = TR.decor, z = ZPX;
    for (var i = dec.length - 1; i >= 0; i--) {
      var d = dec[i];
      if (d.hidden || d.s > car.s + AHEAD || d.s < car.s - BEHIND) continue;
      toS(d.x, d.y);
      var hp = d.h * z * 0.95;
      if (SX < -80 || SX > W + 80 || SY < -20 || SY - hp > H + 20) continue;
      if (d.kind === TR.DEC_PALM) drawPalm(SX, SY, hp, z, d);
      else if (d.kind === TR.DEC_PYLON) drawPylon(SX, SY, hp, z, d);
      else if (d.kind === TR.DEC_LAMP) drawLamp(SX, SY, hp, z, d);
      else drawChevron(SX, SY, z, d);
    }
    ctx.globalAlpha = 1;
  }
  function baseShadow(x, y, rx, ry) {
    ctx.globalAlpha = 0.55; ctx.fillStyle = '#06041A';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  function drawPalm(x, y, hp, z, d) {
    var lean = Math.sin(d.ph) * hp * 0.22, tx = x + lean, ty = y - hp;
    baseShadow(x, y, z * 0.5, z * 0.2);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * 0.1, y - hp * 0.5, tx, ty);
    ctx.strokeStyle = PAL.silhouette; ctx.lineWidth = z * 0.32; ctx.stroke();
    ctx.strokeStyle = d.col ? PAL.cyan : PAL.magenta; ctx.globalAlpha = 0.45; ctx.lineWidth = z * 0.07; ctx.stroke(); ctx.globalAlpha = 1;
    var sway = Math.sin(time * 0.8 + d.ph) * 0.06;
    ctx.beginPath();
    for (var j = 0; j < 7; j++) {
      var a = -PI / 2 + (j - 3) * 0.52 + sway, Lf = z * (1.9 + (j % 2) * 0.5);
      var ex = tx + Math.cos(a) * Lf, ey = ty + Math.sin(a) * Lf * 0.55 + Lf * 0.42;
      ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * Lf * 0.6, ty + Math.sin(a) * Lf * 0.75 - z * 0.3, ex, ey);
    }
    ctx.strokeStyle = '#2C1D60'; ctx.lineWidth = z * 0.3; ctx.stroke();
    ctx.strokeStyle = d.col ? PAL.cyan : PAL.magenta; ctx.globalAlpha = 0.55; ctx.lineWidth = z * 0.06; ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  }
  function drawPylon(x, y, hp, z, d) {
    var w = z * 0.62, col = d.col ? PAL.cyan : PAL.magenta;
    baseShadow(x, y, w * 1.2, w * 0.45);
    ctx.fillStyle = PAL.violetD;
    ctx.beginPath(); ctx.moveTo(x, y - hp); ctx.lineTo(x - w, y - hp * 0.3); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = d.col ? '#2F6E9E' : '#7A3AB8';
    ctx.beginPath(); ctx.moveTo(x, y - hp); ctx.lineTo(x + w, y - hp * 0.3); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y - hp); ctx.lineTo(x - w, y - hp * 0.3); ctx.lineTo(x, y); ctx.lineTo(x + w, y - hp * 0.3); ctx.closePath();
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, z * 0.07); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 + 0.15 * Math.sin(time * 1.5 + d.ph);
    var gs = z * 2.2;
    ctx.drawImage(d.col ? GLOW.cyan : GLOW.magenta, x - gs / 2, y - hp - gs / 2, gs, gs);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function drawLamp(x, y, hp, z, d) {
    var dir = d.col ? 1 : -1;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35;
    ctx.drawImage(GLOW.sun, x - z * 2.4 + dir * z * 0.8, y - z * 0.9, z * 4.8, z * 1.8);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.strokeStyle = PAL.silhouette; ctx.lineWidth = z * 0.16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - hp); ctx.lineTo(x + dir * z * 0.7, y - hp); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = '#FFE2B0'; ctx.fillRect(x + dir * z * 0.7 - z * 0.25, y - hp - z * 0.04, z * 0.5, z * 0.14);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7;
    ctx.drawImage(GLOW.sun, x + dir * z * 0.7 - z, y - hp - z, z * 2, z * 2);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  function drawChevron(x, y, z, d) {
    var bw = z * 1.5, bh = z * 0.85, by = y - z * 1.25;
    ctx.fillStyle = PAL.silhouette; ctx.fillRect(x - z * 0.06, by, z * 0.12, y - by);
    rr(x - bw / 2, by - bh / 2, bw, bh, z * 0.12); ctx.fillStyle = '#1A1038'; ctx.fill();
    ctx.strokeStyle = PAL.sun; ctx.lineWidth = Math.max(1, z * 0.06); ctx.stroke();
    ctx.lineWidth = Math.max(1.2, z * 0.13); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    var s = d.dir, cw = bh * 0.28;
    ctx.beginPath();
    for (var j = -1; j <= 1; j += 2) {
      var cx = x + j * bw * 0.18;
      ctx.moveTo(cx - s * cw * 0.5, by - cw); ctx.lineTo(cx + s * cw * 0.5, by); ctx.lineTo(cx - s * cw * 0.5, by + cw);
    }
    ctx.stroke(); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  }

  function trailColor(c) {
    var tdef = TRAILS[state === 'garage' ? gTrail : save.trail] || TRAILS[0];
    return tdef.spectrum ? ART.SPECTRUM[(c + ((time * 6) | 0)) % ART.SPECTRUM.length] : tdef.col;
  }
  function drawTrail(al) {
    if (trCount < 2) return;
    var ch = Math.cos(car.h), sh = Math.sin(car.h);
    var hx = lerp(car.px, car.x, al) - ch * 1.4, hy = lerp(car.py, car.y, al) - sh * 1.4;
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
    var CH = 8, per = Math.ceil(trCount / CH), n0 = Math.min(trCount, per * 5);
    // one continuous soft glow under the whole trail, then the tapered core in chunks
    ctx.beginPath(); ctx.moveTo(hx, hy);
    for (var g = 0; g < n0; g++) { var gi = (trHead - 1 - g + TRN * 2) % TRN; ctx.lineTo(TRX[gi], TRY[gi]); }
    ctx.lineCap = 'round'; ctx.strokeStyle = trailColor(0); ctx.globalAlpha = 0.13 + boostVis * 0.08; ctx.lineWidth = 1.3 + boostVis * 0.6; ctx.stroke();
    ctx.lineCap = 'butt';
    for (var c = 0; c < CH; c++) {
      var i0 = c * per, i1 = Math.min(trCount - 1, i0 + per);
      if (i0 >= trCount - 1) break;
      ctx.beginPath();
      for (var i = i0; i <= i1; i++) {
        var idx = (trHead - 1 - i + TRN * 2) % TRN;
        if (i === 0) { ctx.moveTo(hx, hy); ctx.lineTo(TRX[idx], TRY[idx]); }
        else if (i === i0) ctx.moveTo(TRX[idx], TRY[idx]);
        else ctx.lineTo(TRX[idx], TRY[idx]);
      }
      var f = c / CH, b = TRB[(trHead - 1 - i0 + TRN * 2) % TRN];
      var w = lerp(0.5, 0.06, f) * (1 + b * 0.8);
      ctx.strokeStyle = trailColor(c);
      ctx.globalAlpha = (1 - f) * 0.85; ctx.lineWidth = w; ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  }

  function drawCar(al, paint) {
    var x = lerp(car.px, car.x, al), y = lerp(car.py, car.y, al), h = lerpA(car.ph, car.h, al);
    var slipS = wrap(car.h - car.va);
    ctx.save(); ctx.translate(x, y); ctx.rotate(h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = car.alive ? 0.5 : 0.2; ctx.drawImage(ART.CONE, 1.25, -3.4, 12, 6.8);
    ctx.globalAlpha = 0.55; ctx.drawImage(ART.TRAIL_GLOW[(TRAILS[save.trail].spectrum ? 4 : save.trail)], -2.1, -1.5, 4.2, 3);
    ctx.globalAlpha = 0.5 + 0.3 * boostVis; ctx.drawImage(GLOW.red, -2.6, -1.1, 2, 2.2);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ART.drawCarTop(ctx, paint, clamp(-slipS, -0.5, 0.5), driftOn ? 0.8 : 0.2);
    ctx.restore();
  }

  function drawParticles() {
    var i;
    ctx.fillStyle = '#CDBFF8';
    for (i = 0; i < PN; i++) {
      if (pLife[i] <= 0 || pType[i] !== P_SMOKE) continue;
      var f = pLife[i] / pMax[i];
      ctx.globalAlpha = 0.2 * f;
      ctx.beginPath(); ctx.arc(pX[i], pY[i], pSize[i] * (1 + (1 - f) * 2.2), 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineWidth = 0.1;
    for (i = 0; i < PN; i++) {
      if (pLife[i] <= 0 || pType[i] !== P_SPARK) continue;
      ctx.globalAlpha = clamp(pLife[i] / pMax[i] * 1.5, 0, 1);
      ctx.strokeStyle = SPARK_COLS[pCol[i]];
      ctx.beginPath(); ctx.moveTo(pX[i], pY[i]); ctx.lineTo(pX[i] - pVX[i] * 0.035, pY[i] - pVY[i] * 0.035); ctx.stroke();
    }
    for (i = 0; i < PN; i++) {
      if (pLife[i] <= 0 || pType[i] !== P_GLINT) continue;
      var g = pLife[i] / pMax[i], s = pSize[i] * (0.6 + g);
      ctx.globalAlpha = g * 0.9;
      var spr = pCol[i] >= 4 ? ART.TRAIL_GLOW[TRAILS[pCol[i] - 4].spectrum ? (i % 5) : pCol[i] - 4] : GLOW.cyan;
      ctx.drawImage(spr, pX[i] - s, pY[i] - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt';
  }

  function drawWorld() {
    var al = clamp(acc / DT, 0, 1);
    if (state !== 'play' || pauseMode) al = 1;
    var cx = lerp(cam.px, cam.x, al), cy = lerp(cam.py, cam.y, al), ca = lerpA(cam.pa, cam.a, al), z = baseZ * lerp(cam.pz, cam.z, al);
    if (shake > 0 && state === 'play' && !pauseMode) { cx += (Math.random() - 0.5) * shake; cy += (Math.random() - 0.5) * shake; }
    setCam(cx, cy, ca, z, W * 0.5, H * CAR_Y);
    screenT();
    ctx.fillStyle = PAL.night; ctx.fillRect(0, 0, W, H);
    visibleRange();
    applyCam();
    drawGrid();
    drawRoad();
    drawSkids();
    screenT();
    drawDecor();
    drawTokens();
    applyCam();
    drawTrail(al);
    drawCar(al, save.paint);
    drawParticles();
    screenT();
    // vignette + boost speed lines and chromatic edges (smooth fades, never flashing)
    if (VIG) ctx.drawImage(VIG, 0, 0, W, H);
    if (boostVis > 0.01) drawBoostFx();
  }

  function drawBoostFx() {
    var a = boostVis, cx = W / 2, cy = H * CAR_Y * 0.55, R = Math.max(W, H) * 0.75;
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#E8E0FF'; ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, 1.5 * u);
    for (var i = 0; i < SLN; i++) {
      SLR[i] += 0.025 * SLS[i];
      if (SLR[i] > 1) { SLR[i] -= 1; SLA[i] = Math.random() * TAU; }
      var r0 = (0.35 + SLR[i] * 0.65) * R, r1 = r0 + R * 0.12 * SLS[i];
      var c = Math.cos(SLA[i]), s = Math.sin(SLA[i]);
      ctx.globalAlpha = a * 0.22 * SLR[i];
      ctx.beginPath(); ctx.moveTo(cx + c * r0, cy + s * r0); ctx.lineTo(cx + c * r1, cy + s * r1); ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.globalAlpha = a * 0.55;
    ctx.fillStyle = CHROMA_L; ctx.fillRect(0, 0, W * 0.09, H);
    ctx.fillStyle = CHROMA_R; ctx.fillRect(W * 0.91, 0, W * 0.09, H);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- HUD
  function drawHUD() {
    roundBtn(L.pause, 'pause', 'pause');
    var sc = Math.floor(score);
    if (sc !== scoreShown) { scoreShown = sc; scoreStr = String(sc); }
    glowLabel(scoreStr, W / 2, L.scoreY, 34 * u, PAL.ink, PAL.magenta, 'center', 900, W * 0.4, true);
    if (combo > 1) {
      var cy = L.scoreY + 30 * u, cw = 54 * u, chh = 24 * u;
      rr(W / 2 - cw / 2, cy - chh / 2, cw, chh, chh / 2);
      ctx.fillStyle = combo >= 5 ? '#5A3A0E' : '#3A1660'; ctx.fill();
      ctx.strokeStyle = combo >= 5 ? PAL.sunY : PAL.magenta; ctx.lineWidth = 1.5 * u; ctx.stroke();
      label('×' + combo, W / 2, cy + 1, 16 * u, combo >= 5 ? PAL.sunY : PAL.ink, 'center', 900, 0, true);
    }
    // hull pips
    var ps = 22 * u, px = L.r - ps / 2, py = L.t + ps / 2 + 2 * u;
    for (var i = HULL_MAX - 1; i >= 0; i--) {
      ART.iconHull(ctx, px, py, ps, clamp(hull - i, 0, 1), hull <= 1.01 ? PAL.red : PAL.cyan);
      px -= ps * 1.05;
    }
    // tokens this run
    if (tokensRun !== tokShown) { tokShown = tokensRun; tokStr = String(tokensRun); }
    var ty = py + ps * 1.05;
    ART.iconToken(ctx, L.r - 6 * u, ty, 16 * u, PAL.cyan, '#E8FDFF');
    label(tokStr, L.r - 16 * u, ty + 1, 15 * u, PAL.ink, 'right', 800);
    // boost meter
    var b = L.boost, fill = boostT > 0 ? boostT / BOOST_TIME : boost;
    rr(b.x, b.y, b.w, b.h, b.h / 2); ctx.fillStyle = '#100A28'; ctx.fill();
    ctx.strokeStyle = '#4A3698'; ctx.lineWidth = 1.2 * u; ctx.stroke();
    if (fill > 0.005) {
      rr(b.x + 2 * u, b.y + 2 * u, Math.max(b.h - 4 * u, (b.w - 4 * u) * fill), b.h - 4 * u, (b.h - 4 * u) / 2);
      ctx.fillStyle = boostT > 0 || boost >= 1 ? PAL.sunY : PAL.sun; ctx.fill();
      if (boostT > 0 || boost >= 1) {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.1 * Math.sin(time * 4);
        ctx.drawImage(GLOW.sun, b.x - 10 * u, b.y - b.h * 1.5, b.w + 20 * u, b.h * 4);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
    }
    ART.iconBolt(ctx, b.x - 14 * u, b.y + b.h / 2, 22 * u, boost >= 1 || boostT > 0 ? PAL.sunY : PAL.sun);

    drawCarHud();
    drawFloats();
  }

  /** Drift meter above the car and the ghost arrow that shows the drift direction. */
  function drawCarHud() {
    if (!car.alive) return;
    toS(car.x, car.y);
    var x = SX, y = SY, z = ZPX;
    var hold = holdingNow() && !pauseMode;
    var side = hold ? latched : dirAhead;
    var prox = clamp(1 - bendDist / 32, 0, 1);
    var a = hold ? 0.95 : 0.22 + 0.5 * prox;
    if (tutorialOn && hintMode === 1) a = 0.6 + 0.4 * Math.sin(time * 6);
    // ghost arrow: a curved arrow on the inside of the next bend
    var s = z * 1.7, ax = x + side * z * 2.1, ay = y - z * 1.2;
    ctx.beginPath();
    ctx.moveTo(ax, ay + s * 0.45); ctx.lineTo(ax, ay);
    ctx.quadraticCurveTo(ax, ay - s * 0.55, ax + side * s * 0.55, ay - s * 0.55);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = PAL.cyan; ctx.globalAlpha = a * 0.25; ctx.lineWidth = z * 0.55; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a; ctx.lineWidth = z * 0.2; ctx.stroke();
    var hx = ax + side * s * 0.55, hy = ay - s * 0.55, hs = z * 0.45;
    ctx.beginPath(); ctx.moveTo(hx + side * hs, hy); ctx.lineTo(hx - side * hs * 0.4, hy - hs * 0.8); ctx.lineTo(hx - side * hs * 0.4, hy + hs * 0.8); ctx.closePath();
    ctx.fillStyle = PAL.cyan; ctx.fill();
    ctx.globalAlpha = 1; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';

    // live drift points
    if (driftOn && driftPts > 2) {
      var txt = Math.round(driftPts) + (combo > 1 ? '  ×' + combo : '');
      var my = y - z * 3.4;
      setFont(16 * u, 900, true);
      var tw = ctx.measureText(txt).width + 22 * u, th = 26 * u;
      rr(x - tw / 2, my - th / 2, tw, th, th / 2); ctx.fillStyle = 'rgba(20,15,45,0.82)'; ctx.fill();
      ctx.strokeStyle = PAL.magenta; ctx.lineWidth = 1.5 * u; ctx.stroke();
      label(txt, x, my + 1, 16 * u, PAL.ink, 'center', 900, 0, true);
      label(tr('drift').toUpperCase(), x, my - th * 0.85, 10 * u, PAL.inkSoft, 'center', 800);
    }
  }

  function drawFloats() {
    toS(car.x, car.y);
    for (var i = 0; i < FLOATS.length; i++) {
      var f = FLOATS[i];
      if (f.life <= 0) continue;
      var k = f.t / f.life, y = SY - ZPX * 4.2 - 46 * u * easeOut(k) - f.dy * 30 * u;
      ctx.globalAlpha = clamp((1 - k) * 2, 0, 1);
      var sz = 22 * u * f.sz * (0.8 + 0.2 * easeOutBack(Math.min(1, k * 4)));
      glowLabel(f.str, SX, y, sz, f.col, PAL.night, 'center', 900, W * 0.8, true);
      ctx.globalAlpha = 1;
    }
  }

  function drawFinger(x, y, s, down) {
    var py = y + (down ? s * 0.12 : 0);
    if (down) {
      ctx.globalAlpha = 0.5; ctx.strokeStyle = PAL.cyan; ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.arc(x, y - s * 0.62, s * (0.32 + 0.1 * Math.sin(time * 5)), 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = PAL.ink; ctx.strokeStyle = PAL.night; ctx.lineWidth = 2 * u;
    rr(x - s * 0.13, py - s * 0.7, s * 0.26, s * 0.75, s * 0.13); ctx.fill(); ctx.stroke();
    rr(x - s * 0.3, py - s * 0.1, s * 0.6, s * 0.55, s * 0.18); ctx.fill(); ctx.stroke();
    rr(x - s * 0.13, py - s * 0.7, s * 0.26, s * 0.75, s * 0.13); ctx.fill();
  }

  function drawHint() {
    if (!tutorialOn || !car.alive || pauseMode) return;
    // below the car when there is room (portrait), otherwise text above it and the hand to the side
    var roomy = H * (1 - CAR_Y) > 190 * u;
    var y = roomy ? L.boost.y - 64 * u : H * CAR_Y - ZPX * 6.5;
    var fx = roomy ? W / 2 : W / 2 + Math.min(W * 0.24, 230 * u), fy = roomy ? y + 20 * u : H * CAR_Y + 30 * u;
    var ty = roomy ? y - 48 * u : y;
    if (hintMode === 1) {
      var down = (time % 1.6) > 0.5;
      drawFinger(fx, fy, 56 * u, down);
      glowLabel(lastInput === 'key' ? tr('holdKey') : tr('holdDrift'), W / 2, ty, 24 * u, PAL.ink, PAL.magenta, 'center', 900, W - 40 * u, true);
    } else if (hintMode === 2) {
      glowLabel(tr('release'), W / 2, roomy ? y - 20 * u : y, 22 * u, PAL.cyan, PAL.night, 'center', 900, W - 40 * u, true);
    } else if (runT < 4 && bendDist > 7) {
      ctx.globalAlpha = clamp(4 - runT, 0, 1);
      glowLabel(lastInput === 'key' ? tr('holdKey') : tr('holdDrift'), W / 2, roomy ? y - 20 * u : y, 20 * u, PAL.inkSoft, PAL.night, 'center', 800, W - 40 * u, true);
      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- overlays
  function veil(a) { ctx.globalAlpha = a; ctx.fillStyle = PAL.deep; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  function panel(b) {
    rr(b.x, b.y, b.w, b.h, 22 * u); ctx.fillStyle = PAL.panel; ctx.fill();
    rr(b.x, b.y, b.w, b.h, 22 * u); neonStroke(PAL.magenta, 1.5 * u);
  }

  function drawPause() {
    veil(0.72);
    panel(L.pPanel);
    var p = L.pPanel;
    glowLabel(tr('paused').toUpperCase(), W / 2, p.y + 40 * u, 32 * u, PAL.ink, PAL.magenta, 'center', 900, p.w - 40 * u, true);
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(time * 3);
    label(tr('tapContinue'), W / 2, p.y + 76 * u, 16 * u, PAL.cyan, 'center', 800, p.w - 40 * u);
    ctx.globalAlpha = 1;
    drawBtn(L.pResume, 'primary', 'resume');
    var r = L.pResume;
    ART.iconPlay(ctx, r.x + r.h * 0.6, r.y + r.h / 2, r.h * 0.5, PAL.ink);
    label(tr('resume'), r.x + r.w / 2 + r.h * 0.2, r.y + r.h / 2 + 1, 22 * u, PAL.ink, 'center', 900, r.w - r.h * 1.6);
    roundBtn(L.pRestart, 'restart', 'retry');
    roundBtn(L.pMenu, 'menu', 'home');
    roundBtn(L.pSound, 'psound', 'sound', save.snd);
    label(tr('restart'), L.pRestart.x + L.pRestart.w / 2, L.pRestart.y + L.pRestart.h + 14 * u, 12 * u, PAL.inkSoft, 'center', 700, L.pRestart.w * 1.5);
    label(tr('menu'), L.pMenu.x + L.pMenu.w / 2, L.pMenu.y + L.pMenu.h + 14 * u, 12 * u, PAL.inkSoft, 'center', 700, L.pMenu.w * 1.5);
    label(tr('sound'), L.pSound.x + L.pSound.w / 2, L.pSound.y + L.pSound.h + 14 * u, 12 * u, PAL.inkSoft, 'center', 700, L.pSound.w * 1.5);
  }

  function drawCount() {
    veil(0.35);
    var n = Math.max(1, Math.ceil(countT / COUNT_STEP)), f = 1 - (countT % COUNT_STEP) / COUNT_STEP;
    var R = 56 * u;
    ctx.beginPath(); ctx.arc(W / 2, H * 0.42, R, -PI / 2, -PI / 2 + TAU * f);
    ctx.lineCap = 'round'; neonStroke(PAL.cyan, 4 * u); ctx.lineCap = 'butt';
    glowLabel(String(n), W / 2, H * 0.42 + 2, 64 * u * (1.15 - 0.15 * easeOut(f * 2)), PAL.ink, PAL.magenta, 'center', 900, 0, true);
  }

  function drawOver() {
    veil(clamp(overT * 2, 0, 0.74));
    var k = easeOutBack(clamp(overT * 2.2, 0, 1)), p = L.oPanel;
    ctx.save();
    ctx.translate(W / 2, p.y + p.h / 2); ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k); ctx.translate(-W / 2, -(p.y + p.h / 2));
    ctx.globalAlpha = clamp(overT * 3, 0, 1);
    panel(p);
    glowLabel(tr('gameOver').toUpperCase(), W / 2, p.y + 42 * u, 34 * u, PAL.magenta, PAL.night, 'center', 900, p.w - 40 * u, true);
    label(tr('score').toUpperCase(), W / 2, p.y + 84 * u, 13 * u, PAL.inkSoft, 'center', 800);
    glowLabel(String(Math.round(shownScore)), W / 2, p.y + 122 * u, 52 * u, PAL.ink, PAL.magenta, 'center', 900, p.w - 40 * u, true);
    var ry = p.y + 166 * u;
    if (newBest && overT > 1.0) {
      var bw = Math.min(p.w - 60 * u, 200 * u), bh = 30 * u;
      rr(W / 2 - bw / 2, ry - bh / 2, bw, bh, bh / 2); ctx.fillStyle = PAL.sunY; ctx.fill();
      label(tr('newBest'), W / 2, ry + 1, 16 * u, PAL.night, 'center', 900, bw - 16 * u, true);
    } else {
      ART.iconTrophy(ctx, W / 2 - 50 * u, ry, 22 * u, PAL.sunY);
      label(tr('best') + '  ' + save.best, W / 2 - 34 * u, ry + 1, 17 * u, PAL.ink, 'left', 800, p.w * 0.6);
    }
    // stats row: tokens earned and max combo
    var sy = p.y + 212 * u, colW = p.w / 2;
    ART.iconToken(ctx, p.x + colW * 0.5 - 30 * u, sy, 22 * u, PAL.cyan, '#E8FDFF');
    label('+' + tokensRun, p.x + colW * 0.5 - 14 * u, sy + 1, 22 * u, PAL.ink, 'left', 900, colW * 0.5);
    label(tr('tokens'), p.x + colW * 0.5, sy + 24 * u, 11 * u, PAL.inkSoft, 'center', 700, colW - 16 * u);
    label('×' + maxCombo, p.x + colW * 1.5, sy + 1, 22 * u, PAL.sunY, 'center', 900, colW * 0.5, true);
    label(tr('maxCombo'), p.x + colW * 1.5, sy + 24 * u, 11 * u, PAL.inkSoft, 'center', 700, colW - 16 * u);
    if (newUnlock) {
      label(tr('newItem') + '  ' + newUnlock, W / 2, sy + 50 * u, 14 * u, PAL.cyan, 'center', 800, p.w - 30 * u);
    }
    drawBtn(L.oRetry, 'primary', 'retry');
    var r = L.oRetry;
    ART.iconRetry(ctx, r.x + r.h * 0.62, r.y + r.h / 2, r.h * 0.55, PAL.ink);
    label(tr('retry'), r.x + r.w / 2 + r.h * 0.22, r.y + r.h / 2 + 1, 24 * u, PAL.ink, 'center', 900, r.w - r.h * 1.6);
    drawBtn(L.oMenu, 'ghost', 'menu');
    ART.iconHome(ctx, L.oMenu.x + L.oMenu.h * 0.55, L.oMenu.y + L.oMenu.h / 2, L.oMenu.h * 0.5, PAL.ink);
    label(tr('menu'), L.oMenu.x + L.oMenu.w / 2 + L.oMenu.h * 0.2, L.oMenu.y + L.oMenu.h / 2 + 1, 16 * u, PAL.ink, 'center', 800, L.oMenu.w - L.oMenu.h * 1.2);
    drawBtn(L.oGarage, 'ghost', 'garage');
    ART.iconCar(ctx, L.oGarage.x + L.oGarage.h * 0.55, L.oGarage.y + L.oGarage.h / 2, L.oGarage.h * 0.55, PAL.ink);
    label(tr('garage'), L.oGarage.x + L.oGarage.w / 2 + L.oGarage.h * 0.2, L.oGarage.y + L.oGarage.h / 2 + 1, 16 * u, PAL.ink, 'center', 800, L.oGarage.w - L.oGarage.h * 1.2);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- title
  var TBG = null, LOGO = null, VIG = null, SUN = null, CHROMA_L = null, CHROMA_R = null, GROUND = null, HAZE = null;

  function buildStatic() {
    // vignette
    VIG = ART.mk(W * DPR / 2, H * DPR / 2);
    var vg = VIG.getContext('2d'), vw = VIG.width, vh = VIG.height;
    var gr = vg.createRadialGradient(vw / 2, vh * 0.55, Math.min(vw, vh) * 0.35, vw / 2, vh * 0.55, Math.max(vw, vh) * 0.75);
    gr.addColorStop(0, 'rgba(12,9,32,0)'); gr.addColorStop(1, 'rgba(12,9,32,0.7)');
    vg.fillStyle = gr; vg.fillRect(0, 0, vw, vh);
    CHROMA_L = ctx.createLinearGradient(0, 0, W * 0.09, 0);
    CHROMA_L.addColorStop(0, 'rgba(255,46,136,0.6)'); CHROMA_L.addColorStop(1, 'rgba(255,46,136,0)');
    CHROMA_R = ctx.createLinearGradient(W, 0, W * 0.91, 0);
    CHROMA_R.addColorStop(0, 'rgba(46,230,255,0.6)'); CHROMA_R.addColorStop(1, 'rgba(46,230,255,0)');

    // title background: sky, stars, sun, mountains
    TBG = ART.mk(W * DPR, H * DPR);
    var g = TBG.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    var hy = L.horizon;
    var sky = g.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, '#0B0820'); sky.addColorStop(0.55, PAL.night); sky.addColorStop(0.85, '#3A1452'); sky.addColorStop(1, '#6A1A5E');
    g.fillStyle = sky; g.fillRect(0, 0, W, hy + 2);
    var rnd = 1234567;
    function rn() { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; }
    for (var i = 0; i < 90; i++) {
      var sx = rn() * W, sy = rn() * hy * 0.85, sr = 0.5 + rn() * 1.3 * u;
      g.globalAlpha = 0.25 + rn() * 0.6; g.fillStyle = rn() < 0.2 ? PAL.cyan : '#FFFFFF';
      g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    var sr2 = L.sunR;
    SUN = ART.makeSun(sr2 * DPR);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55;
    g.drawImage(GLOW.sun, W / 2 - sr2 * 2.1, L.sunY - sr2 * 2.1, sr2 * 4.2, sr2 * 4.2);
    g.globalAlpha = 0.35; g.drawImage(GLOW.magenta, W / 2 - sr2 * 2.6, hy - sr2 * 1.2, sr2 * 5.2, sr2 * 2.4);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.drawImage(SUN, W / 2 - sr2, L.sunY - sr2, sr2 * 2, sr2 * 2);
    // mountains
    for (var layer = 0; layer < 2; layer++) {
      var peaks = 9 + layer * 5, amp = (layer ? 0.06 : 0.11) * Math.min(W, H) + 10 * u;
      g.beginPath(); g.moveTo(0, hy);
      for (var j = 0; j <= peaks; j++) {
        var px = W * j / peaks, ph = amp * (0.35 + rn() * 0.65) * (j % 2 ? 1 : 0.45);
        var mid = Math.abs(px - W / 2) / (W / 2);
        if (mid < 0.32) ph *= 0.15 + mid * 2; // keep the sun visible
        g.lineTo(px, hy - ph);
      }
      g.lineTo(W, hy); g.closePath();
      g.fillStyle = layer ? '#2A1758' : '#1C1046'; g.fill();
      g.strokeStyle = layer ? PAL.magenta : PAL.violet; g.globalAlpha = 0.6; g.lineWidth = 1.2 * u; g.stroke(); g.globalAlpha = 1;
    }
    GROUND = ctx.createLinearGradient(0, hy, 0, H);
    GROUND.addColorStop(0, '#2A0F48'); GROUND.addColorStop(0.25, '#170F38'); GROUND.addColorStop(1, PAL.deep);
    HAZE = ctx.createLinearGradient(0, hy, 0, hy + (H - hy) * 0.3);
    HAZE.addColorStop(0, 'rgba(255,46,136,0.45)'); HAZE.addColorStop(1, 'rgba(255,46,136,0)');

    // logo
    var lw = L.logoW, lh = lw * 0.5;
    LOGO = ART.mk(lw * DPR, lh * DPR);
    var c = LOGO.getContext('2d');
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    var f1 = lw * 0.2, f2 = lw * 0.27;
    c.font = 'italic 900 ' + f1 + 'px ' + FONT;
    var w1 = c.measureText('NIGHT').width; if (w1 > lw * 0.8) { f1 *= lw * 0.8 / w1; c.font = 'italic 900 ' + f1 + 'px ' + FONT; }
    var y1 = lh * 0.38;
    var chrome = c.createLinearGradient(0, y1 - f1 * 0.8, 0, y1);
    chrome.addColorStop(0, '#FFFFFF'); chrome.addColorStop(0.45, '#BFEFFF'); chrome.addColorStop(0.5, '#7B4FE0');
    chrome.addColorStop(0.75, '#E6B8FF'); chrome.addColorStop(1, '#FFFFFF');
    c.lineJoin = 'round';
    softGlow(c, 'NIGHT', lw / 2, y1, f1 * 0.07, PAL.violet, 0.1);
    c.strokeStyle = '#1A0F3D'; c.lineWidth = f1 * 0.08; c.strokeText('NIGHT', lw / 2, y1);
    c.fillStyle = chrome; c.fillText('NIGHT', lw / 2, y1);
    c.font = 'italic 900 ' + f2 + 'px ' + FONT;
    var w2 = c.measureText('DRIFT').width; if (w2 > lw * 0.94) { f2 *= lw * 0.94 / w2; c.font = 'italic 900 ' + f2 + 'px ' + FONT; }
    var y2 = lh * 0.9;
    softGlow(c, 'DRIFT', lw / 2, y2, f2 * 0.09, PAL.magenta, 0.09);
    softGlow(c, 'DRIFT', lw / 2, y2, f2 * 0.04, PAL.magenta, 0.12);
    c.globalAlpha = 0.9; c.fillStyle = PAL.cyan; c.fillText('DRIFT', lw / 2 - f2 * 0.035, y2 + f2 * 0.03);
    c.globalAlpha = 1; c.fillStyle = PAL.magenta; c.fillText('DRIFT', lw / 2, y2);
    c.strokeStyle = '#FFD0E6'; c.lineWidth = Math.max(1, f2 * 0.025); c.strokeText('DRIFT', lw / 2, y2);
  }

  /** Fake blur: copies of the text on a ring of offsets, at low alpha (pre-render only). */
  function softGlow(c, str, x, y, r, col, a) {
    c.fillStyle = col; c.globalAlpha = a;
    for (var i = 0; i < 12; i++) { var an = i * TAU / 12; c.fillText(str, x + Math.cos(an) * r, y + Math.sin(an) * r); }
    c.globalAlpha = 1;
  }

  function drawTitleGround(hy, speed) {
    ctx.fillStyle = GROUND; ctx.fillRect(0, hy, W, H - hy);
    var vx = W / 2, depth = H - hy, i;
    // perspective grid
    ctx.beginPath();
    var scroll = (time * speed) % 1;
    for (i = 0; i < 18; i++) {
      var d = i + 1 - scroll; if (d <= 0.05) continue;
      var y = hy + depth * (1.2 / d) * 0.85; if (y > H) continue;
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    var spread = Math.max(W, H * 0.8) * 0.16;
    for (i = -14; i <= 14; i++) { ctx.moveTo(vx + i * spread * 0.04, hy); ctx.lineTo(vx + i * spread * 2.2, H + depth * 0.4); }
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = PAL.magenta; ctx.globalAlpha = 0.42; ctx.lineWidth = Math.max(1, 1.1 * u); ctx.stroke();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // road
    var bw = Math.min(W * 0.62, H * 0.42), tw = bw * 0.03;
    ctx.beginPath(); ctx.moveTo(vx - tw, hy); ctx.lineTo(vx + tw, hy); ctx.lineTo(vx + bw, H); ctx.lineTo(vx - bw, H); ctx.closePath();
    ctx.fillStyle = PAL.road; ctx.fill();
    for (var side = -1; side <= 1; side += 2) {
      ctx.beginPath(); ctx.moveTo(vx + side * tw, hy); ctx.lineTo(vx + side * bw, H);
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter'; neonStroke(side < 0 ? PAL.magenta : PAL.cyan, 2 * u);
      ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt';
    }
    // center dashes in perspective
    ctx.fillStyle = PAL.violetL; ctx.globalAlpha = 0.6;
    for (i = 0; i < 14; i++) {
      var d0 = i + 1 - ((time * speed * 2) % 1), d1 = d0 + 0.5;
      if (d0 <= 0.15) continue;
      var y0 = hy + depth * (1.2 / d1) * 0.85, y1 = Math.min(H, hy + depth * (1.2 / d0) * 0.85);
      if (y0 > H) continue;
      var w0 = (y0 - hy) / depth * bw * 0.025 + 0.4, w1 = (y1 - hy) / depth * bw * 0.025 + 0.4;
      ctx.beginPath(); ctx.moveTo(vx - w0, y0); ctx.lineTo(vx + w0, y0); ctx.lineTo(vx + w1, y1); ctx.lineTo(vx - w1, y1); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = HAZE; ctx.fillRect(0, hy, W, (H - hy) * 0.3);
  }

  function drawTitle() {
    screenT();
    ctx.drawImage(TBG, 0, 0, W, H);
    drawTitleGround(L.horizon, 1.4);
    ART.drawCarRear(ctx, W / 2 + Math.sin(time * 0.9) * 3 * u, L.carY, L.carW, save.paint, time);
    ctx.drawImage(LOGO, W / 2 - L.logoW / 2, L.logoY, L.logoW, L.logoW * 0.5);
    // best + tokens line
    var by = L.bestY;
    setFont(18 * u, 800);
    var bs = tr('best') + '  ' + save.best, ts = String(save.tokens);
    var w1 = ctx.measureText(bs).width, w2 = ctx.measureText(ts).width, gap = 26 * u;
    var total = 26 * u + w1 + gap + 22 * u + w2, x0 = W / 2 - total / 2;
    rr(x0 - 16 * u, by - 18 * u, total + 32 * u, 36 * u, 18 * u); ctx.fillStyle = 'rgba(12,9,32,0.6)'; ctx.fill();
    ART.iconTrophy(ctx, x0 + 10 * u, by, 20 * u, PAL.sunY);
    label(bs, x0 + 26 * u, by + 1, 18 * u, PAL.ink, 'left', 800);
    ART.iconToken(ctx, x0 + 26 * u + w1 + gap + 8 * u, by, 20 * u, PAL.cyan, '#E8FDFF');
    label(ts, x0 + 26 * u + w1 + gap + 22 * u, by + 1, 18 * u, PAL.ink, 'left', 800);

    drawBtn(L.play, 'primary', 'play');
    var p = L.play;
    ART.iconPlay(ctx, p.x + p.h * 0.62, p.y + p.h / 2, p.h * 0.5, PAL.ink);
    label(tr('play').toUpperCase(), p.x + p.w / 2 + p.h * 0.18, p.y + p.h / 2 + 1, 26 * u, PAL.ink, 'center', 900, p.w - p.h * 1.5, true);
    roundBtn(L.tGarage, 'garage', 'garage');
    roundBtn(L.tSound, 'sound', 'sound', save.snd);
    label(tr('garage'), L.tGarage.x + L.tGarage.w / 2, L.tGarage.y - 12 * u, 13 * u, PAL.inkSoft, 'center', 800, L.tGarage.w * 2);
    if (!ready) {
      ctx.globalAlpha = 0.5; label('• • •', W / 2, p.y + p.h + 22 * u, 16 * u, PAL.inkSoft, 'center', 800); ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- garage
  function drawGarage() {
    screenT();
    ctx.fillStyle = PAL.night; ctx.fillRect(0, 0, W, H);
    var pv = L.gPrev, cx = pv.x, cy = pv.y, R = pv.r;
    // ground grid around the turntable
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(1, TILT);
    ctx.beginPath();
    var G = R * 0.35, ext = Math.max(W, H) * 1.5, off = (time * R * 0.1) % G;
    for (var x = -ext; x <= ext; x += G) { ctx.moveTo(x + off, -ext); ctx.lineTo(x + off, ext); }
    for (var y = -ext; y <= ext; y += G) { ctx.moveTo(-ext, y + off); ctx.lineTo(ext, y + off); }
    ctx.strokeStyle = PAL.grid; ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(0, 0, R * 1.02, 0, TAU); ctx.fillStyle = '#1A1240'; ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath(); ctx.arc(0, 0, R * 1.02, 0, TAU); neonStroke(PAL.cyan, 2 * u);
    ctx.globalCompositeOperation = 'source-over';
    // donut drift preview: the car circles with its tail out, leaving its trail
    var zs = R / 4.3, rc = 2.5, ph = time * 1.3;
    ctx.scale(zs, zs);
    ctx.beginPath(); ctx.arc(0, 0, rc - 0.1, 0, TAU); ctx.strokeStyle = PAL.skid; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.4; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    var CH = 8;
    for (var c = 0; c < CH; c++) {
      var a0 = ph - 0.2 - c * 0.3, a1 = a0 - 0.32, f = c / CH;
      ctx.beginPath(); ctx.arc(0, 0, rc + 0.2, a1, a0);
      ctx.strokeStyle = trailColor(c);
      ctx.globalAlpha = (1 - f) * 0.18; ctx.lineWidth = lerp(0.5, 0.08, f) * 4; ctx.stroke();
      ctx.globalAlpha = (1 - f) * 0.9; ctx.lineWidth = lerp(0.5, 0.08, f); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt';
    ctx.translate(Math.cos(ph) * rc, Math.sin(ph) * rc);
    ctx.rotate(ph + PI / 2 + 0.55);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6;
    var tg = TRAILS[gTrail].spectrum ? GLOW.violet : ART.TRAIL_GLOW[gTrail];
    ctx.drawImage(tg, -2.2, -1.6, 4.4, 3.2);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ART.drawCarTop(ctx, gPaint, -0.45, 0.6);
    ctx.restore();

    // top bar
    roundBtn(L.gBack, 'back', 'back');
    glowLabel(tr('garage').toUpperCase(), W / 2, L.gBack.y + L.gBack.h / 2, 26 * u, PAL.ink, PAL.magenta, 'center', 900, W * 0.45, true);
    var ts = String(save.tokens);
    setFont(20 * u, 900);
    var tw = ctx.measureText(ts).width;
    rr(L.r - tw - 46 * u, L.gBack.y + L.gBack.h / 2 - 18 * u, tw + 46 * u, 36 * u, 18 * u); ctx.fillStyle = PAL.panelHi; ctx.fill();
    ART.iconToken(ctx, L.r - tw - 26 * u, L.gBack.y + L.gBack.h / 2, 22 * u, PAL.cyan, '#E8FDFF');
    label(ts, L.r - 12 * u, L.gBack.y + L.gBack.h / 2 + 1, 20 * u, gFlash > 0 ? PAL.sunY : PAL.ink, 'right', 900);

    // rows
    drawSwatchRow(0, tr('paint'), PAINTS.length);
    drawSwatchRow(1, tr('trail'), TRAILS.length);

    // action button for the previewed item
    var kind = gRow === 0 ? 'p' : 't', idx = gRow === 0 ? gPaint : gTrail;
    var b = L.gAction, cost = itemCost(kind, idx), un = isUnlocked(kind, idx);
    var eq = gRow === 0 ? save.paint === idx : save.trail === idx;
    var name = (gRow === 0 ? tr('paints') : tr('trails'))[idx];
    label(name, W / 2 + (L.gLand ? L.gColX - W / 2 : 0), b.y - 22 * u, 18 * u, PAL.ink, 'center', 900, b.w, true);
    if (un) {
      drawBtn(b, eq ? 'disabled' : 'ghost', 'gaction');
      label(eq ? tr('equipped') : tr('equip'), b.x + b.w / 2, b.y + b.h / 2 + 1, 18 * u, eq ? PAL.inkSoft : PAL.ink, 'center', 900, b.w - 20 * u);
    } else if (cost > 0) {
      var can = save.tokens >= cost;
      drawBtn(b, can ? 'primary' : 'disabled', 'gaction');
      var bx = b.x + b.w / 2 + (gDeny > 0 ? Math.sin(gDeny * 40) * 5 * u : 0);
      setFont(18 * u, 900);
      var s1 = tr('unlock') + '  ', s2 = String(cost), w1 = ctx.measureText(s1).width, w2 = ctx.measureText(s2).width;
      var tot = w1 + 22 * u + w2, x0 = bx - tot / 2;
      label(s1, x0, b.y + b.h / 2 + 1, 18 * u, can ? PAL.ink : PAL.inkDim, 'left', 900, b.w * 0.6);
      ART.iconToken(ctx, x0 + w1 + 9 * u, b.y + b.h / 2, 20 * u, can ? PAL.cyan : '#5D6E8A', can ? '#E8FDFF' : '#A9B4C6');
      label(s2, x0 + w1 + 22 * u, b.y + b.h / 2 + 1, 18 * u, can ? PAL.ink : PAL.inkDim, 'left', 900);
    } else {
      drawBtn(b, 'disabled', 'gaction');
      ART.iconTrophy(ctx, b.x + b.w / 2 - 50 * u, b.y + b.h / 2, 20 * u, PAL.sunY);
      label(tr('reach') + ' ' + (-cost), b.x + b.w / 2 + 10 * u, b.y + b.h / 2 + 1, 18 * u, PAL.inkSoft, 'center', 900, b.w - 80 * u);
    }
  }

  function drawSwatchRow(row, title, n) {
    var R = L.gRows[row];
    label(title.toUpperCase(), R.x, R.y - R.s * 0.5 - 14 * u, 13 * u, PAL.inkSoft, 'left', 800);
    for (var i = 0; i < n; i++) {
      var b = R.items[i], cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = b.w * 0.42;
      var kind = row === 0 ? 'p' : 't', un = isUnlocked(kind, i);
      var sel = gRow === row && (row === 0 ? gPaint : gTrail) === i, eq = (row === 0 ? save.paint : save.trail) === i;
      if (pressed === 'sw' + row + '_' + i) r *= 0.94;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = '#120C2E'; ctx.fill();
      if (row === 0) {
        var P = PAINTS[i];
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, 0, TAU); ctx.fillStyle = P.body; ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, 0, TAU); ctx.clip();
        ctx.fillStyle = P.dark; ctx.fillRect(cx - r, cy + r * 0.25, r * 2, r);
        ctx.fillStyle = P.stripe; ctx.fillRect(cx - r * 0.2, cy - r, r * 0.13, r * 2); ctx.fillRect(cx + r * 0.07, cy - r, r * 0.13, r * 2);
        ctx.restore();
      } else {
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, TAU); ctx.clip();
        ctx.lineCap = 'round';
        for (var k = 0; k < 5; k++) {
          ctx.beginPath(); ctx.arc(cx - r * 1.1, cy + r * 1.1, r * 1.55, -PI / 2 + k * 0.32 - 0.05, -PI / 2 + (k + 1) * 0.32);
          var tcol = TRAILS[i].spectrum ? ART.SPECTRUM[k * 2 % ART.SPECTRUM.length] : TRAILS[i].col;
          ctx.strokeStyle = tcol; ctx.globalAlpha = 0.3; ctx.lineWidth = r * 0.5; ctx.stroke();
          ctx.globalAlpha = 1; ctx.lineWidth = r * 0.18; ctx.stroke();
        }
        ctx.restore(); ctx.lineCap = 'butt';
      }
      if (!un) {
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, TAU); ctx.fillStyle = 'rgba(12,9,32,0.62)'; ctx.fill();
        if (itemCost(kind, i) < 0) ART.iconTrophy(ctx, cx, cy, r * 0.8, PAL.sunY); else ART.iconLock(ctx, cx, cy, r * 0.8, PAL.ink);
      }
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
      if (sel) neonStroke(PAL.ink, 2.2 * u);
      else { ctx.strokeStyle = eq ? PAL.cyan : '#3A2E6E'; ctx.lineWidth = 2 * u; ctx.stroke(); }
      if (eq) {
        ctx.beginPath(); ctx.arc(cx + r * 0.72, cy - r * 0.72, r * 0.26, 0, TAU); ctx.fillStyle = PAL.cyan; ctx.fill();
        ctx.strokeStyle = PAL.night; ctx.lineWidth = Math.max(1.5, r * 0.08); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx + r * 0.6, cy - r * 0.72); ctx.lineTo(cx + r * 0.69, cy - r * 0.62); ctx.lineTo(cx + r * 0.85, cy - r * 0.82); ctx.stroke(); ctx.lineCap = 'butt';
      }
    }
  }

  function garagePick(row, i) {
    gRow = row;
    if (row === 0) gPaint = i; else gTrail = i;
    var kind = row === 0 ? 'p' : 't';
    if (isUnlocked(kind, i)) {
      if (row === 0 && save.paint !== i) { save.paint = i; persist(); }
      if (row === 1 && save.trail !== i) { save.trail = i; persist(); }
    }
    AU.click();
  }
  function garageAction() {
    var kind = gRow === 0 ? 'p' : 't', idx = gRow === 0 ? gPaint : gTrail, cost = itemCost(kind, idx);
    if (isUnlocked(kind, idx)) { garagePick(gRow, idx); return; }
    if (cost > 0 && save.tokens >= cost) {
      save.tokens -= cost; save.unlocked.push(kind + idx);
      if (gRow === 0) save.paint = idx; else save.trail = idx;
      gFlash = 0.6; persist(); AU.unlock();
    } else { gDeny = 0.35; AU.deny(); }
  }

  // ---------------------------------------------------------------- frame
  function draw() {
    screenT();
    if (state === 'title') { drawTitle(); return; }
    if (state === 'garage') { drawGarage(); return; }
    drawWorld();
    if (state === 'play') {
      drawHUD();
      drawHint();
      if (pauseMode === 'menu') drawPause();
      else if (pauseMode === 'count') drawCount();
    } else if (state === 'over') {
      drawOver();
    }
  }

  function frame(now) {
    rafId = 0;
    if (!running) return;
    var dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    update(dt);
    draw();
    rafId = requestAnimationFrame(frame);
  }
  function startLoop() {
    if (running) return;
    running = true; lastT = performance.now();
    rafId = requestAnimationFrame(frame);
  }
  function stopLoop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // ---------------------------------------------------------------- layout
  function readSafe() {
    try {
      var cs = getComputedStyle(saEl);
      SA.t = parseFloat(cs.paddingTop) || 0; SA.r = parseFloat(cs.paddingRight) || 0;
      SA.b = parseFloat(cs.paddingBottom) || 0; SA.l = parseFloat(cs.paddingLeft) || 0;
    } catch (e) { SA.t = SA.r = SA.b = SA.l = 0; }
  }

  function layout() {
    var m = 16;
    L.l = SA.l + m; L.r = W - SA.r - m; L.t = SA.t + m; L.b = H - SA.b - m;
    portrait = H >= W;
    // world zoom: enough road ahead in both orientations
    CAR_Y = portrait ? 0.7 : 0.73;
    baseZ = Math.min(W / 23, H / (44 * TILT));
    // HUD
    var pb = Math.max(46, 46 * u);
    L.pause = rect(L.l, L.t, pb, pb);
    L.scoreY = L.t + pb * 0.5;
    var bw = Math.min(W - 2 * m - 60 * u, 300 * u), bh = 12 * u;
    L.boost = rect(W / 2 - bw / 2 + 8 * u, L.b - bh - 4 * u, bw, bh);

    // title
    var tall = H > W * 1.25;
    var pw = Math.min(W - 2 * m - 40, 270 * u), ph = 62 * u;
    var rb = Math.max(52, 54 * u);
    if (tall) {
      L.horizon = Math.round(H * 0.5);
      L.sunR = Math.round(Math.min(W * 0.34, H * 0.16));
      L.logoW = Math.min(W - 2 * m - 20, 460 * u, H * 0.75);
      L.logoY = L.t + 18 * u;
      L.bestY = L.logoY + L.logoW * 0.5 + 18 * u;
      L.play = rect(W / 2 - pw / 2, Math.min(L.b - rb - 30 * u - ph, H * 0.79 - ph / 2), pw, ph);
      L.carW = Math.min(W * 0.42, (L.play.y - L.horizon) * 1.5, 220 * u);
      L.carY = L.play.y - 22 * u;
    } else {
      // wide screens: logo above the sun, the car against the horizon, best score under the button
      L.logoW = Math.min(W - 2 * m - 20, 460 * u, H * 0.58);
      L.logoY = Math.max(SA.t + 4, L.t - 6 * u);
      L.horizon = Math.round(Math.max(H * 0.6, L.logoY + L.logoW * 0.5 + H * 0.24));
      L.sunR = Math.round(Math.min(W * 0.34, H * 0.2, (L.horizon - L.logoY - L.logoW * 0.5) / 1.2));
      L.play = rect(W / 2 - pw / 2, L.b - 36 * u - 24 * u - ph, pw, ph);
      L.bestY = L.play.y + ph + 32 * u;
      L.carW = Math.min(W * 0.2, 200 * u, (L.play.y - L.horizon) * 2.2);
      L.carY = L.play.y - 12 * u;
    }
    L.sunY = L.horizon - L.sunR * 0.32;
    L.tGarage = rect(L.l, L.b - rb, rb, rb);
    L.tSound = rect(L.r - rb, L.b - rb, rb, rb);

    // pause
    var pw2 = Math.min(W - 2 * m, 340 * u), ph2 = 282 * u;
    L.pPanel = rect(W / 2 - pw2 / 2, H / 2 - ph2 / 2, pw2, ph2);
    var pp = L.pPanel;
    L.pResume = rect(pp.x + 28 * u, pp.y + 104 * u, pp.w - 56 * u, 60 * u);
    var rs = Math.max(48, 52 * u), gap = (pp.w - 3 * rs) / 4;
    var ry = pp.y + 186 * u;
    L.pRestart = rect(pp.x + gap, ry, rs, rs);
    L.pMenu = rect(pp.x + gap * 2 + rs, ry, rs, rs);
    L.pSound = rect(pp.x + gap * 3 + rs * 2, ry, rs, rs);

    // game over
    var ow = Math.min(W - 2 * m, 360 * u), oh = 400 * u;
    if (oh > H - 2 * m) oh = H - 2 * m;
    L.oPanel = rect(W / 2 - ow / 2, H / 2 - oh / 2, ow, oh);
    var op = L.oPanel;
    L.oRetry = rect(op.x + 24 * u, op.y + oh - 140 * u, ow - 48 * u, 64 * u);
    var hb = Math.max(46, 48 * u), hw2 = (ow - 48 * u - 12 * u) / 2;
    L.oMenu = rect(op.x + 24 * u, op.y + oh - 64 * u, hw2, hb);
    L.oGarage = rect(op.x + 24 * u + hw2 + 12 * u, op.y + oh - 64 * u, hw2, hb);

    // garage
    L.gBack = rect(L.l, L.t, pb, pb);
    L.gLand = !portrait && W > H * 1.2;
    var colX, colW, top = L.t + pb + 12 * u;
    if (L.gLand) {
      var pr = Math.min(W * 0.2, (L.b - top) * 0.42);
      L.gPrev = { x: L.l + (W * 0.5 - L.l) / 2 + 10 * u, y: top + (L.b - top) / 2, r: pr };
      colX = W * 0.5 + 10 * u; colW = L.r - colX;
    } else {
      colX = L.l; colW = L.r - L.l;
    }
    var sw = Math.min(58 * u, colW / 6.4), sgap = (colW - sw * 6) / 5;
    var rowsH = sw * 2 + 70 * u + 30 * u + 60 * u, y0;
    if (L.gLand) y0 = top + Math.max(30 * u, ((L.b - top) - rowsH - 30 * u) / 2) + 20 * u;
    else {
      var pr2 = Math.min(W * 0.4, (H - top) * 0.22);
      var contentH = pr2 * 2 * TILT + 60 * u + sw * 2 + 44 * u + 52 * u + 56 * u;
      var startY = top + Math.max(0, (L.b - top - contentH) * 0.45);
      L.gPrev = { x: W / 2, y: startY + pr2 * TILT + 6 * u, r: pr2 };
      y0 = L.gPrev.y + pr2 * TILT + 60 * u;
    }
    L.gRows = [];
    for (var row = 0; row < 2; row++) {
      var ycen = y0 + row * (sw + 44 * u) + sw / 2, items = [];
      var n = row === 0 ? PAINTS.length : TRAILS.length;
      for (var i = 0; i < n; i++) items.push(rect(colX + i * (sw + sgap), ycen - sw / 2, sw, sw));
      L.gRows.push({ x: colX, y: ycen, s: sw, items: items });
    }
    L.gColX = colX + colW / 2;
    var aw = Math.min(colW, 280 * u), ay = L.gRows[1].y + sw / 2 + 52 * u;
    ay = Math.min(ay, L.b - 56 * u);
    L.gAction = rect(colX + colW / 2 - aw / 2, ay, aw, 56 * u);
  }

  function resize() {
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    minD = Math.min(W, H);
    u = clamp(minD / 430, 0.82, 1.4);
    readSafe();
    layout();
    buildStatic();
    if (!running) draw();
  }

  // ---------------------------------------------------------------- input
  function hitButton(x, y) {
    var i;
    if (state === 'title') {
      if (inRect(L.play, x, y, 6)) return 'play';
      if (inRect(L.tGarage, x, y, 6)) return 'garage';
      if (inRect(L.tSound, x, y, 6)) return 'sound';
      return null;
    }
    if (state === 'garage') {
      if (inRect(L.gBack, x, y, 6)) return 'back';
      if (inRect(L.gAction, x, y, 4)) return 'gaction';
      for (var row = 0; row < 2; row++) for (i = 0; i < L.gRows[row].items.length; i++) if (inRect(L.gRows[row].items[i], x, y, 3)) return 'sw' + row + '_' + i;
      return null;
    }
    if (state === 'play') {
      if (pauseMode === 'menu') {
        if (inRect(L.pResume, x, y, 4)) return 'resume';
        if (inRect(L.pRestart, x, y, 4)) return 'restart';
        if (inRect(L.pMenu, x, y, 4)) return 'menu';
        if (inRect(L.pSound, x, y, 4)) return 'psound';
        return null;
      }
      if (!pauseMode && car.alive && inRect(L.pause, x, y, 8)) return 'pause';
      return null;
    }
    if (state === 'over' && overT > 0.4) {
      if (inRect(L.oRetry, x, y, 4)) return 'retry';
      if (inRect(L.oMenu, x, y, 4)) return 'menu';
      if (inRect(L.oGarage, x, y, 4)) return 'garage';
    }
    return null;
  }

  function toggleSound() { save.snd = !save.snd; AU.setSound(save.snd); AU.click(); persist(); }

  function pressButton(id) {
    switch (id) {
      case 'play': case 'retry': startRun(); break;
      case 'restart': startRun(); break;
      case 'garage': openGarage(); break;
      case 'sound': case 'psound': toggleSound(); break;
      case 'pause': openPause(); break;
      case 'resume': AU.click(); beginCount(); break;
      case 'menu': toTitle(); break;
      case 'back': toTitle(); break;
      case 'gaction': garageAction(); break;
      default:
        if (id && id.indexOf('sw') === 0) garagePick(+id.charAt(2), +id.slice(4));
    }
  }

  function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function recountHolds() {
    var n = 0, k;
    for (k in ptrs) if (ptrs[k].hold) n++;
    ptrHold = n;
    n = 0;
    for (k in keys) if (keys[k]) n++;
    keyHold = n;
    if (!ptrHold && !keyHold) needRelease = false;
  }
  function clearInput() { ptrs = {}; keys = {}; ptrHold = 0; keyHold = 0; pressed = null; }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    AU.ensure();
    lastInput = e.pointerType === 'mouse' ? 'mouse' : 'touch';
    if (!ready) return;
    var p = pos(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    var btn = hitButton(p.x, p.y);
    var hold = !btn && state === 'play' && pauseMode !== 'menu' && car.alive;
    ptrs[e.pointerId] = { btn: btn, hold: hold };
    if (btn) pressed = btn;
    recountHolds();
  });
  function endPtr(e, cancel) {
    var s = ptrs[e.pointerId];
    delete ptrs[e.pointerId];
    recountHolds();
    if (!s) return;
    if (s.btn) {
      pressed = null;
      var p = pos(e);
      if (!cancel && hitButton(p.x, p.y) === s.btn) pressButton(s.btn);
      return;
    }
    if (!cancel && !s.hold && state === 'play' && pauseMode === 'menu') { AU.click(); beginCount(); }
  }
  canvas.addEventListener('pointerup', function (e) { endPtr(e, false); });
  canvas.addEventListener('pointercancel', function (e) { endPtr(e, true); });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('blur', function () { clearInput(); });

  var HOLD_KEYS = { Space: 1, ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1 };
  window.addEventListener('keydown', function (e) {
    var k = e.code || e.key;
    if (k === ' ' || k === 'Spacebar') k = 'Space';
    var handled = true;
    AU.ensure();
    lastInput = 'key';
    if (HOLD_KEYS[k]) { keys[k] = true; recountHolds(); }
    if (!ready) { if (HOLD_KEYS[k] || k === 'Enter') e.preventDefault(); return; }
    if (e.repeat) { e.preventDefault(); return; }
    if (k === 'KeyM') { toggleSound(); e.preventDefault(); return; }
    if (state === 'title') {
      if (k === 'Enter' || k === 'NumpadEnter' || k === 'Space') startRun();
      else if (k === 'KeyG') openGarage();
      else handled = false;
    } else if (state === 'garage') {
      var n = gRow === 0 ? PAINTS.length : TRAILS.length, cur = gRow === 0 ? gPaint : gTrail;
      if (k === 'Escape' || k === 'Backspace' || k === 'KeyG') toTitle();
      else if (k === 'ArrowLeft') garagePick(gRow, (cur + n - 1) % n);
      else if (k === 'ArrowRight') garagePick(gRow, (cur + 1) % n);
      else if (k === 'ArrowUp' || k === 'ArrowDown') { var nr = 1 - gRow; garagePick(nr, nr === 0 ? gPaint : gTrail); }
      else if (k === 'Enter' || k === 'NumpadEnter' || k === 'Space') garageAction();
      else handled = false;
    } else if (state === 'play') {
      if (pauseMode === 'menu') {
        if (k === 'Enter' || k === 'NumpadEnter' || k === 'Space' || k === 'Escape' || k === 'KeyP') { AU.click(); beginCount(); }
        else if (k === 'KeyR') startRun();
        else if (k === 'Backspace') toTitle();
        else if (!HOLD_KEYS[k]) handled = false;
      } else if (pauseMode === 'count') {
        if (k === 'Escape' || k === 'KeyP') pauseMode = 'menu';
        else if (!HOLD_KEYS[k]) handled = false;
      } else if (k === 'Escape' || k === 'KeyP') openPause();
      else if (!HOLD_KEYS[k]) handled = false;
    } else if (state === 'over') {
      if (overT < 0.5) { if (!HOLD_KEYS[k]) handled = false; }
      else if (k === 'Enter' || k === 'NumpadEnter' || k === 'Space') startRun();
      else if (k === 'Escape' || k === 'Backspace') toTitle();
      else if (k === 'KeyG') openGarage();
      else if (!HOLD_KEYS[k]) handled = false;
    }
    if (handled) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) {
    var k = e.code || e.key;
    if (k === ' ' || k === 'Spacebar') k = 'Space';
    if (HOLD_KEYS[k]) { delete keys[k]; recountHolds(); e.preventDefault(); }
  });

  window.addEventListener('resize', resize);

  // ---------------------------------------------------------------- SDK lifecycle
  PlayablesSDK.onPause(function () {
    if (state === 'play' && car.alive) pauseMode = 'menu';
    clearInput();
    stopLoop();
    AU.suspend();
    draw();
  });
  PlayablesSDK.onResume(function () {
    AU.resume();
    startLoop();
  });
  PlayablesSDK.onAudioChange(function (enabled) { AU.setSdk(enabled); });
  AU.setSdk(PlayablesSDK.isAudioEnabled());

  // Read-only state snapshot and a time-scale knob for automated play-tests. No other effect.
  window.__driftDebug = {
    setTimeScale: function (n) { dbgScale = clamp(Number(n) || 1, 0.1, 8); },
    info: function () {
      var aimPt = 0;
      if (TR.segs.length) { TR.sample(car.seg, car.s + 6 + car.v * 0.35, 0, P2); aimPt = Math.atan2(P2.y - car.y, P2.x - car.x); }
      return {
        state: state, pauseMode: pauseMode, ready: ready, running: running, tutorial: tutorialOn, hint: hintMode,
        alive: car.alive, score: Math.floor(score), best: save.best, runTokens: tokensRun, tokens: save.tokens,
        hull: hull, combo: combo, maxCombo: maxCombo, boost: boost, boostT: boostT, v: car.v, s: car.s, d: car.d, hw: car.hw,
        slip: wrap(car.h - car.va), holding: holdingNow(), dir: dirAhead, latched: latched, bendDist: bendDist,
        roadErrV: wrap(P2.h - car.va), roadErrH: wrap(P2.h - car.h), aimErrV: wrap(aimPt - car.va), k: car.k, runT: runT,
        drift: driftOn, driftPts: driftPts, timeScale: timeScale, hits: { crash: hitCount.crash, scrape: hitCount.scrape, wrong: hitCount.wrong },
        save: JSON.parse(JSON.stringify(save)),
        buttons: { play: L.play, garage: L.tGarage, sound: L.tSound, pause: L.pause, resume: L.pResume, restart: L.pRestart,
          menu: L.pMenu, psound: L.pSound, retry: L.oRetry, oMenu: L.oMenu, oGarage: L.oGarage, back: L.gBack, action: L.gAction,
          rows: L.gRows.map(function (r) { return r.items; }) }
      };
    }
  };

  // 1) draw the title synchronously, 2) firstFrameReady, 3) load save + language, 4) gameReady
  resize();
  draw();
  PlayablesSDK.firstFrameReady();
  startLoop();
  Promise.all([PlayablesSDK.load(), PlayablesSDK.getLanguage()]).then(function (res) {
    applySave(res[0]);
    var tag = String(res[1] || 'en').toLowerCase().split('-')[0];
    T = I18N[tag] || I18N.en;
    AU.setSound(save.snd);
  }).catch(function () { /* play with defaults */ }).then(function () {
    ready = true;
    if (!running) draw();
    PlayablesSDK.gameReady();
  });
})();
