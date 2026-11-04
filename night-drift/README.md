# Night Drift

**Hold to drift. Release to straighten. Chase the neon line.**

A one-finger arcade drift racer on an endless synthwave highway. Your small retro coupe
drives forward on its own down a winding, procedurally generated road at night. Hold to
throw the car sideways into the next bend, let go to catch it and straighten out. Clean
drifts bank points times your combo and charge a boost; touching the neon barrier costs
speed, your combo and hull. The road speeds up, narrows and grows tighter corners, S-bends,
chicanes and hairpins the further you go. Runs are quick, retries are instant, and tokens
you collect unlock paint jobs and light trails in the garage.

## How to play

- The car steers itself only gently. To take a real corner you have to **drift**: hold, and
  the car's nose swings toward the **inside of the next bend** while the tail slides out.
  Release when the nose points where the road goes after the bend.
- The road tells you the direction. Orange **chevron boards** on the outside of each corner
  point the way, and a **ghost arrow** next to the car shows which way a hold will turn. It
  glows brighter as the bend gets close and locks in while you hold.
- A drift lasts while the car is sliding. Re-press before the slide settles to **chain** an
  S-bend into one big drift. When the slide settles, the drift **banks**: its points ×
  the combo go to your score, the combo goes up by one (up to ×10) and the boost meter fills.
- **Boost:** when the meter is full it fires by itself on the next straight: more speed,
  double points and a trail of sparks.
- **Tokens** (glowing cyan diamonds) sit on the racing line, mostly on the inside of
  corners. They give points × combo, charge the boost a little and are the garage currency.
- **Walls:** brushing the barrier is a *scrape* (speed loss, combo reset, some hull). Hitting
  it at a steep angle or spinning round is a *crash* (one full hull pip). The run ends when
  the three hull pips are empty. A clean drift repairs a little hull, and there is a short
  grace period after each hit.
- **First run:** a tutorial on two wide, slow bends. Time slows before the first bend, an
  animated hand says "Hold to drift", and "Release to straighten" appears when the nose
  lines up with the exit. Walls do no damage until the tutorial bends are behind you. The
  tutorial ends after your first successful drift.

### Controls

The direction is chosen by the road, so one finger (or one key) is enough.

| Action | Touch | Mouse | Keyboard |
|---|---|---|---|
| Drift (hold) / straighten (release) | hold anywhere | hold the button | hold Space or any arrow key |
| Pause | pause button (top left) | pause button | Esc or P |
| Continue after a pause | tap (3-2-1 countdown) | click | Enter, Space, Esc or P |
| Restart / menu from the pause menu | buttons | buttons | R / Backspace |
| Start / retry | Drive / Retry button | same | Enter (Space also works) |
| Garage | garage button (title, game over) | same | G |
| Sound on/off | speaker button (title, pause menu) | same | M |
| Garage: choose / unlock | tap a swatch, then the button | same | ←/→ item, ↑/↓ row, Enter unlock, Esc back |

**Why this control scheme:** I also considered a left half / right half split (left drift /
right drift). It's more flexible, but it needs two thumbs or constant hand-switching, and
it turns the game into steering rather than drifting. With "drift into the next bend",
reading the road is part of the skill, the input stays one finger, and the challenge is
**when** to press and **how long** to hold. The physics keep the drift circle the same at
every speed (see below), so the timing you learn keeps working as the game speeds up.

## Features

- **Drift physics** (fixed 120 Hz step, interpolated rendering): holding turns the heading
  at `v / R` and the velocity follows the heading with a lag. That gives a steady slip
  angle of about 31° and a drift circle that doesn't depend on speed. On release the tires
  grip and a gentle lane assist eases the car back toward the middle of the road. The assist
  is rate-limited, so it handles straights and wide sweepers but never a real corner.
- **Procedural road** (`track.js`): a chain of straights and circular arcs: sweepers,
  corners, S-bends, chicanes (after about 30 s) and hairpins (later). It is generated ahead
  of the car and culled behind, from a seeded RNG, so the same seed always gives the same
  road. Corner radius and road width shrink with distance. The overall heading stays
  within ±100° so the road never loops over itself, and scenery is checked against nearby
  road so nothing stands on the asphalt. Wall collision projects the car onto the
  centerline of only the 4 segments around its current one (O(1) amortized), so the
  distance to the edge is exact on both straights and arcs.
- **Difficulty:** speed ramps from 15 to about 28 units/s, and corners, road width and
  feature mix all tighten with distance. Measured with headless bots: not pressing at all
  survives about 40 s, a bot with a sloppy 0.3 s reaction time survives 26–60 s, a 0.2 s
  bot survives 90 s or more, and a precise bot survives 240 s or more.
- **Juice:** tire smoke, skid marks that fade over 10 s, a tapered neon light trail,
  sparks on scrapes, token bursts, combo-colored score popups, a small local camera shake
  on crashes, speed lines and a soft magenta/cyan chromatic edge while boosting (smooth
  fades, no flashing). The camera turns with the road (not with the sliding car body),
  looks ahead, and zooms out a little with speed.
- **Retention:** best score, a token wallet, and a garage with 6 paint jobs and 5 light
  trails. Most cost tokens. *Gold* paint unlocks at a best score of 5000 and the *Spectrum*
  trail at 3000. In the garage you preview an item on a car doing donuts, and buying it
  takes two taps (select, then Unlock), so tokens are never spent by accident.
- **Sound** (`audio.js`, WebAudio only): an engine hum (two detuned saws and a sub through a
  low-pass) whose pitch follows the speed, a tire squeal (band-passed noise) that follows the
  slip, a boost whoosh, a token chime that climbs with chains, drift-bank blips, a crunchy
  scrape, a crash thump, a game-over sting and a new-best fanfare. A quiet, original synth
  bass pulse (i–VI–III–VII in A minor at 104 bpm) plays during runs and gains an arpeggio
  at high combo or while boosting.
- **Layout:** the world zoom comes from the screen size, so at least ~30 units of road are
  visible ahead in landscape and ~40 in portrait. The car sits at 70–73 % of the height and
  the camera rotates to keep the travel direction pointing up. Title, garage and hints
  have separate tall and wide arrangements. The HUD keeps 16 px from the edges plus the CSS
  safe-area insets, and tap targets are at least 46 px.
- **Languages:** English, Spanish, Portuguese, French and German (`i18n.js`), picked from
  `PlayablesSDK.getLanguage()` with English as the fallback. All labels are fitted to their
  boxes.

### Palette (synthwave night)

| Token | Hex | Use |
|---|---|---|
| night | `#140F2D` | background, ground |
| magenta | `#FF2E88` | left road edge, primary accents, default paint |
| cyan | `#2EE6FF` | right road edge, tokens, ghost arrow, secondary buttons |
| sun | `#FF9E3D` | chevrons, boost meter, sun gradient |
| road | `#2A1F4F` | asphalt |
| violet | `#8B5CF6` | grid, crystals, title chrome |
| ink | `#F6F2FF` | text (≈ 17:1 on night) |
| button | `#E0156F` | primary buttons (white text ≈ 4.7:1) |

## Files

| File | Purpose |
|---|---|
| `index.html` | SDK script tag first, then `ytsdk.js`, `i18n.js`, `art.js`, `audio.js`, `track.js`, `game.js`. Inline CSS only (plus a hidden div that reads the safe-area insets). |
| `ytsdk.js` | unmodified copy of `/shared/ytsdk.js` |
| `i18n.js` | string dictionary (en, es, pt, fr, de) |
| `art.js` | palette, pre-rendered glow sprites and headlight cone, the top-down and rear-view car, striped sun, icons |
| `audio.js` | WebAudio engine, squeal, effects and the bass pulse |
| `track.js` | seeded road generator, nearest-point queries, tokens and roadside scenery |
| `game.js` | simulation, camera, rendering, HUD and menus, input and lifecycle |

## Playables compliance

- **SDK calls (only through `PlayablesSDK`):** `init({ storageKey: 'night-drift_save' })`, then
  the title screen is drawn synchronously, then `firstFrameReady()`, then `load()` and
  `getLanguage()`, then `gameReady()` (about 0.1 s after load in tests). `onPause` stops the
  `requestAnimationFrame` loop, clears held input, suspends the AudioContext and, during a
  run, opens the pause overlay. `onResume` restarts the loop, but the overlay ("Tap to
  continue") stays until the player taps, and play resumes after a 3-2-1 countdown.
  `onAudioChange` / `isAudioEnabled()`: sound plays only when YouTube audio is enabled
  **and** the in-game sound toggle is on. The AudioContext is created lazily on the first
  pointer or key gesture. `sendScore(best)` is called at every game over.
- **Save format** (`save()` at game over, when the tutorial is completed, on garage
  purchases and equips, and on sound changes; never per frame), about 100 bytes of JSON:
  `{"v":1,"best":14617,"tokens":45,"unlocked":["p0","t0","p1"],"paint":1,"trail":0,"snd":true,"tut":true}`.
  Loaded values are validated, and a paint or trail that isn't unlocked falls back to the
  default. Outside YouTube the wrapper falls back to `localStorage`.
- **Sizes:** 7 shipped files, about 136 KiB in total. The largest, `game.js`, is about
  87 KiB. No images, fonts or audio files.
- **Performance:** no `shadowBlur`. Glow comes from pre-rendered radial sprites and layered
  strokes. Particles, skid marks and the light trail live in typed-array ring buffers, so
  there are no allocations in the hot loops. DPR is capped at 2. The game holds 60 fps at
  390×844 and 1280×720 at DPR 2 even in headless Chromium's software rasterizer, and JS takes
  well under 1 % of frame time.
- **Safety:** no external requests apart from the SDK script tag, and no `eval`, workers,
  WASM, clipboard or text inputs. Nothing asks for personal data. The car is an original
  design (not a real model), and the name, art and music pattern are original. Aimed at 13+.
  Never more than gentle, local brightness changes (no strobing).
- **Testing hook:** `window.__driftDebug.info()` returns a read-only snapshot of the state
  (speed, offset, slip, next-bend direction, hull, score, button rects), and
  `__driftDebug.setTimeScale(n)` speeds up or slows down the simulation for headless
  tests. Neither has any other effect on the game.
- **Verified with** `node tools/check-bundle.mjs night-drift` (PASS, no warnings) and
  `node tools/smoke.cjs night-drift <dir>` (SMOKE PASS), plus a Playwright play-through in
  portrait (real CDP touch events) and landscape (real mouse and keyboard). The play-through
  follows the tutorial hints to finish the first drift, drives corners with an autopilot
  that holds and releases through real input, checks that the score rises, pauses with the
  button and the keyboard, does an SDK pause/resume with tap-to-continue, survives 66 more
  seconds with an autopilot (boost fires, no wall hits), wrecks on purpose, checks
  `sendScore` and the save, retries, returns to the menu, unlocks and equips a paint in
  the garage, and toggles sound.
