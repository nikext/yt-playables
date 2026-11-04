#!/usr/bin/env node
// Headless smoke test for a Playables game directory.
// Usage: node tools/smoke.cjs <game-dir> [out-dir-for-screenshots]
// - serves the directory over local HTTP
// - replaces the real SDK with tools/mock-ytgame.js
// - checks that firstFrameReady comes before gameReady, gameReady arrives within 5 s, and there are no page errors
// - taps around, fires pause/resume/audio events, and takes portrait + landscape screenshots
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const dir = path.resolve(process.argv[2] || '');
const out = path.resolve(process.argv[3] || path.join(dir, '..', '.smoke-out'));
if (!fs.existsSync(path.join(dir, 'index.html'))) { console.error('usage: node tools/smoke.cjs <game-dir> [out-dir]'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const mock = fs.readFileSync(path.join(__dirname, 'mock-ytgame.js'), 'utf8');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const p = path.join(dir, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!p.startsWith(dir) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const failures = [];
  const name = path.basename(dir);

  for (const vp of [{ w: 390, h: 844, tag: 'portrait', touch: true }, { w: 1280, h: 720, tag: 'landscape', touch: false }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.touch, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    const external = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.route('**/*', route => {
      const u = route.request().url();
      if (u === 'https://www.youtube.com/game_api/v1') return route.fulfill({ contentType: 'text/javascript', body: mock });
      if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) { external.push(u); return route.abort(); }
      return route.continue();
    });
    const t0 = Date.now();
    await page.goto(base);
    await page.waitForFunction(() => (window.__ytCalls || []).includes('gameReady'), null, { timeout: 5000 })
      .catch(() => failures.push(`[${vp.tag}] gameReady not called within 5 s`));
    const readyMs = Date.now() - t0;
    await page.screenshot({ path: path.join(out, `${name}-${vp.tag}-title.png`) });

    // Generic interaction: taps/clicks across the screen and a few keys.
    for (let i = 0; i < 12; i++) {
      const x = Math.round(vp.w * (0.2 + 0.6 * ((i * 37) % 10) / 10));
      const y = Math.round(vp.h * (0.3 + 0.5 * ((i * 53) % 10) / 10));
      if (vp.touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
      await page.waitForTimeout(250);
    }
    for (const k of ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'Enter']) { await page.keyboard.press(k); await page.waitForTimeout(150); }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(out, `${name}-${vp.tag}-play.png`) });

    await page.evaluate(() => { window.__yt.setAudio(false); window.__yt.pause(); });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(out, `${name}-${vp.tag}-paused.png`) });
    await page.evaluate(() => { window.__yt.resume(); window.__yt.setAudio(true); });
    await page.waitForTimeout(500);
    await page.setViewportSize({ width: vp.h, height: vp.w }); // rotate
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(out, `${name}-${vp.tag}-rotated.png`) });

    const calls = await page.evaluate(() => window.__ytCalls.slice());
    const ff = calls.indexOf('firstFrameReady'), gr = calls.indexOf('gameReady');
    if (ff < 0) failures.push(`[${vp.tag}] firstFrameReady never called`);
    if (gr >= 0 && ff > gr) failures.push(`[${vp.tag}] gameReady called before firstFrameReady`);
    if (calls.filter(c => c === 'gameReady').length > 1) failures.push(`[${vp.tag}] gameReady called more than once`);
    errors.forEach(e => failures.push(`[${vp.tag}] ${e}`));
    external.forEach(u => failures.push(`[${vp.tag}] external request: ${u}`));
    console.log(`[${vp.tag}] ready in ${readyMs} ms; SDK calls: ${calls.join(', ')}`);
    await ctx.close();
  }

  await browser.close();
  server.close();
  console.log(`screenshots: ${out}`);
  failures.forEach(f => console.log('  FAIL', f));
  console.log(failures.length ? 'SMOKE FAIL' : 'SMOKE PASS');
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
