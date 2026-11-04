# Prism Runner

**Match your color, dodge the blocks, chase your best.**

You are a small glowing prism-orb racing up an endless three-lane track. Color gates span
the track: slip through a segment that matches your color to score and build your combo,
hit the wrong color and you shatter. Solid blocks have to be dodged. The track speeds up
and its patterns get trickier the longer you survive. Runs are quick, retry is instant,
and new cosmetic trails unlock as your best score climbs.

## How to play

- The orb has one of three colors: **pink (circle)**, **mint (triangle)** and **sky (diamond)**.
  Each color also has a symbol, so you can tell them apart without relying on color alone.
- Pass through gate segments of **your** color. A mismatch ends the run (unless you have a shield).
- Dodge the dark **blocks** by changing lanes.
- The ring in the top-right corner shows your current color in the middle and the **next**
  color (what one tap will give you) around it. The small dot next to the orb shows it too.
- The first run is an onboarding run with slow speed and hints ("swipe to move", "tap to change color").

### Controls

| Action | Touch | Mouse | Keyboard |
|---|---|---|---|
| Move left / right | swipe left / right, or tap the left / right third of the screen | click the left / right third | ← / → or A / D |
| Change color (cycles pink → mint → sky) | tap the middle, or swipe up | click the middle | Space, ↑ or W |
| Pause | pause button (top-left) | pause button | Esc or P |
| Continue after a pause | tap anywhere (3-2-1 countdown) | click | Space / Enter / Esc / P |
| Start / retry | Play button / tap anywhere on the game-over screen | same | Enter or Space |
| Back to the menu | home button | home button | M or Backspace (paused or game over) |
| Choose a trail (title) | tap a trail | click | ← / → |

## Features

- **Scoring:** distance + gates × combo multiplier. Every 4 gates in a row raise the
  multiplier (up to ×8); the meter under the score shows progress to the next step.
  Golden prism pickups add a bonus.
- **Pickups:** prisms (bonus points), a **shield bubble** (absorbs one hit, but resets your
  combo) and a **slow-mo star** (time slows down for a few seconds).
- **Difficulty:** speed and pattern complexity ramp up smoothly. The track is built from
  pattern chunks (mixed gates, single-color gates, block walls, gates with blocks,
  staircases, color runs, slaloms) drawn from a seeded RNG. A fairness rule computes the
  worst-case number of moves needed from any state the player can be in, and spaces each
  row so that there is always a route with enough reaction time at the current speed.
  The visible distance ahead is the same on every screen shape.
- **Retention:** five cosmetic trails (Glow, Bubbles, Sparkle, Ribbon, Comet), unlocked at
  best scores of 0 / 400 / 1200 / 2500 / 5000 and chosen on the title screen. A new
  unlock is equipped automatically and announced on the game-over card.
- **Game over:** score count-up, best score, "New best!" ribbon with confetti and a fanfare,
  instant tap-to-retry, and a home button.
- **Juice:** particle puffs and floating points on gate passes, a screen nudge and
  shatter on hits, squash-and-stretch on lane changes, and a pop when you change color.
  Sound is synthesized: a gate chime pitched by combo, whoosh, color blip, pickup, shield,
  shatter and fanfare, plus an optional soft background beat whose tempo follows the speed.
- **Layout:** the playfield is a centered column. In landscape the sides fill with drifting
  pastel shapes. All sizes come from `min(width, height)`, tap targets are at least 44 px (usually 48 px or more),
  and the HUD keeps 16 px from the edges.
- **Languages:** English, Spanish, Portuguese, French and German (`i18n.js`), picked from
  `PlayablesSDK.getLanguage()` with English as the fallback.

## Files

| File | Purpose |
|---|---|
| `index.html` | SDK script tag first, then `ytsdk.js`, `i18n.js`, `audio.js`, `game.js`. Inline CSS only. |
| `ytsdk.js` | unmodified copy of `/shared/ytsdk.js` |
| `i18n.js` | string dictionary (en, es, pt, fr, de) |
| `audio.js` | WebAudio sound effects and background beat |
| `game.js` | game logic, rendering, input and lifecycle |

## Playables compliance

- **SDK calls (through `PlayablesSDK`, never `window.ytgame` directly):**
  `init({ storageKey: 'prism-runner_save' })` → the title screen is drawn synchronously →
  `firstFrameReady()` → `load()` and `getLanguage()` → `gameReady()` (about 0.1 s after load
  in tests). `onPause` stops the `requestAnimationFrame` loop and suspends the
  AudioContext, and a running game drops into the pause menu. `onResume` restarts the
  loop but keeps the "Tap to continue" overlay up, and play only resumes after a 3-2-1
  countdown. `onAudioChange` / `isAudioEnabled()`: sound plays only when YouTube audio is
  enabled **and** the in-game sound toggle is on. The AudioContext is created lazily on
  the first pointer or key gesture. `sendScore(best)` is called when a run ends with a new best.
- **Save format** (`save()` on game over, settings change, trail choice and returning to
  the menu; never per frame), about 100 bytes of JSON:
  `{"v":1,"best":726,"trail":1,"sound":true,"music":true,"seenTutorial":true,"runs":3}`.
  Loaded values are checked, and a trail that is not unlocked falls back to the default.
  Outside YouTube the wrapper falls back to `localStorage`.
- **Sizes:** 5 shipped files, about 87 KiB in total (the largest, `game.js`, is about 70 KiB). No images,
  fonts or audio files: all art is drawn on a Canvas 2D and all sound is synthesized.
- **Safety:** no external requests apart from the SDK script tag, and no `eval`, workers,
  WASM, clipboard or text inputs. Nothing asks for personal data. Original name, art and
  design, aimed at 13+. Uses a system font stack.
- **Testing hook:** `window.__prism()` returns a read-only snapshot of the game state
  (used by the headless play-test). It has no effect on the game.
- **Verified with** `node tools/check-bundle.mjs prism-runner` (PASS, no warnings) and
  `node tools/smoke.cjs prism-runner <dir>` (SMOKE PASS), plus a Playwright play-test.
  The play-test starts runs with touch, mouse and keyboard, uses taps and swipes, lets a
  bot play through the tutorial and survive about 150 s of ramping difficulty, checks
  in-game pause and SDK pause/resume, dies, retries, returns to the menu, and confirms
  that the save survives a reload through the `localStorage` fallback.
