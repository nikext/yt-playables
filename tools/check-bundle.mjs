#!/usr/bin/env node
// Static compliance check for a Playables game directory.
// Usage: node tools/check-bundle.mjs <game-dir>
// Checks the rules from docs/REQUIREMENTS.md that can be verified statically.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) {
  console.error('usage: node tools/check-bundle.mjs <game-dir>');
  process.exit(2);
}

const MiB = 1024 * 1024;
const SDK_URL = 'https://www.youtube.com/game_api/v1';
const errors = [];
const warnings = [];
const files = [];

(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else files.push(p);
  }
})(dir);

const shipped = files.filter(f => !/(^|\/)README\.md$/i.test(path.relative(dir, f)));
let total = 0;
for (const f of shipped) {
  const rel = path.relative(dir, f);
  const size = fs.statSync(f).size;
  total += size;
  if (!/^[A-Za-z0-9_.\-/]+$/.test(rel)) errors.push(`bad file name characters: ${rel}`);
  if (size >= 30 * MiB) errors.push(`file >= 30 MiB: ${rel}`);
  else if (size >= 512 * 1024) warnings.push(`file >= 512 KiB (SHOULD be smaller): ${rel}`);

  if (/\.(html|js|css|json)$/i.test(f)) {
    const src = fs.readFileSync(f, 'utf8');
    const urls = src.match(/https?:\/\/[^\s"'`)<>]+/g) || [];
    for (const u of urls) {
      if (u === SDK_URL) continue;
      // URLs inside comments are tolerated but flagged so they can be reviewed.
      warnings.push(`URL literal in ${rel}: ${u} (must not be fetched)`);
    }
    if (/\beval\s*\(|new\s+Function\s*\(/.test(src)) errors.push(`eval/new Function in ${rel}`);
    if (/\bnew\s+(Shared)?Worker\s*\(/.test(src)) errors.push(`Web Worker in ${rel}`);
    if (/WebAssembly\./.test(src)) errors.push(`WebAssembly in ${rel}`);
    if (/navigator\.clipboard/.test(src)) errors.push(`clipboard access in ${rel}`);
    if (/(src|href)\s*=\s*["']\//.test(src)) errors.push(`absolute path reference in ${rel}`);
    if (/fetch\s*\(\s*["'`]https?:/.test(src) || /XMLHttpRequest/.test(src)) errors.push(`network request in ${rel}`);
    if (/<input[^>]*type=["']?(text|email|password)/i.test(src)) errors.push(`text input (personal data risk) in ${rel}`);
  }
}

const index = path.join(dir, 'index.html');
if (!fs.existsSync(index)) errors.push('missing index.html');
else {
  const html = fs.readFileSync(index, 'utf8');
  const firstScript = (html.match(/<script[^>]*src=["']([^"']+)["']/i) || [])[1];
  if (firstScript !== SDK_URL) errors.push(`first <script> must be the SDK (${SDK_URL}), found: ${firstScript}`);
  if (!/viewport/.test(html)) warnings.push('no viewport meta tag');
}
const allJs = shipped.filter(f => f.endsWith('.js') && path.basename(f) !== 'ytsdk.js').map(f => fs.readFileSync(f, 'utf8')).join('\n');
for (const call of ['firstFrameReady', 'gameReady', 'onPause', 'onResume', 'onAudioChange', 'sendScore', 'save', 'load']) {
  const re = call === 'save' || call === 'load'
    ? new RegExp(`PlayablesSDK\\.${call}\\(`)
    : new RegExp(`\\b${call}\\b`);
  if (!re.test(allJs)) {
    warnings.push(`game code never seems to use ${call}`);
  }
}

if (shipped.length > 8000) errors.push(`too many files: ${shipped.length}`);
if (total >= 30 * MiB) errors.push(`bundle >= 30 MiB: ${(total / MiB).toFixed(2)} MiB`);
else if (total >= 15 * MiB) warnings.push(`bundle >= 15 MiB`);

console.log(`${dir}: ${shipped.length} files, ${(total / 1024).toFixed(1)} KiB`);
warnings.forEach(w => console.log('  WARN ', w));
errors.forEach(e => console.log('  ERROR', e));
console.log(errors.length ? 'FAIL' : 'PASS');
process.exit(errors.length ? 1 : 0);
