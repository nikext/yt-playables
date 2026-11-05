# Putt Garden

*A papercut mini golf garden.*

A sunny paper diorama of a mini golf course: stone rails cut from card, a mown fairway
glued on top, bunkers and ponds pressed into the paper, bushes and flowers around the
edge. Pull back from the ball like a slingshot, let go, and watch it roll, bank off the
walls, drift down the slopes and rattle into the cup. Putt Garden is a calm top-down mini
golf game with 27 handcrafted holes on three courses, **Meadow**, **Desert Garden** and
**Lagoon**.

## How to play

- **Drag back** anywhere on the course (away from where you want to go) and let go to
  putt. A dotted guide of limited length shows the direction and the ring around the ball
  shows the power (white, gold, then red at full power). Drag back to the start to cancel.
- Sink the ball in as few strokes as you can. Each hole has a **par**:
  under par (or a hole in one) earns 3 stars, par earns 2, any other finish earns 1.
- **Stroke cap:** a hole ends after par + 4 strokes (0 stars), so you can never get stuck.
  The restart button (top right) starts the hole over at any time.
- The **scorecard** after hole 9 shows the round (birdies circled, bogeys boxed), the total
  against par and your stars. The holes screen keeps your best score and stars per hole.

Course elements, introduced one at a time:

| Element | What it does |
|---|---|
| Stone walls (straight, angled, curved) | the ball banks off them |
| Hedges / stone islands | solid blocks to play around |
| Round stones | posts that bounce the ball |
| Tall grass (darker, tufted) | slows the ball |
| Slopes (shaded, with drifting arrows) | push the ball downhill |
| Sand (pressed-in, stippled) | slows the ball hard |
| Flower bumpers | kick the ball away faster than it came |
| One-way gates (wooden bar with chevrons) | let the ball through in the chevron direction only |
| Sliding stone blocks | move back and forth on a track: time the putt |
| Water | +1 penalty stroke, the ball goes back to where it was putted from |
| Windmill blades | turning arms that knock the ball |
| Pipes | the ball drops into a pipe mouth and rolls out of the matching outlet (same colour and glyph, arrows show the direction) |

## Controls

| Action | Touch / mouse | Keyboard |
|---|---|---|
| Aim and set power | drag back from anywhere on the course | ← → aim (Shift for fine), ↑ ↓ power |
| Putt | let go | Space / Enter |
| Restart the hole | ⟳ button | R |
| Pause menu (resume, restart, sound, courses) | ‖ button | Esc / P |
| Sound on/off | sound button (title, pause menu) | M |
| Menus, course and hole select | tap | arrows + Enter, Esc to go back |

## Features

- **27 handcrafted holes**, 9 per course: Meadow (straight, dogleg, angled walls, a curved
  bowl, stones, tall grass, slopes, a valley, an S-course), Desert Garden (sand, dunes,
  bumpers, a one-way gate, sliding blocks, slopes, everything together), Lagoon (ponds, a
  boardwalk, a windmill, pipes, an island green, paddle wheels, plumbing, locks, a grand
  finale). Total par 65.
- **Deterministic physics** (`physics.js`, DOM-free): fixed 240 Hz steps, rolling
  friction (constant deceleration plus drag) per surface, walls as capsule segments with
  restitution (curves are segment chains), round posts, bumpers that add a kick, one-way
  gates, slopes as force fields, water with penalty and reset, rotating blades and sliding
  blocks driven by the hole clock (moving pieces transfer their velocity to the ball),
  teleport pipes, and a cup that only catches the ball below a capture speed (faster
  balls rattle over the lip and get pulled a little). The ball never moves more than about
  half its radius per step, so it cannot tunnel through walls. A ball that is slow and either
  on flat ground or pressed against something settles, so it never jitters forever.
- **Every hole is verified** by `tools/putt-garden-verify.cjs`: it replays the stored
  reference putts (`shots` in `holes.js`, as angle, power and wait time) through the same
  physics and asserts that the ball drops within par, that the replay is deterministic and
  that tee and cup sit on the fairway. It also reports how forgiving each route is.
  The reference putts were found with an offline beam search (angle × power × wait, ranked
  by a geodesic distance field to the cup) and chosen for robustness; pars were set from
  how easy the 2-putt route is (a well-aimed hole in one or birdie is usually possible).
- **Layout:** each hole is designed portrait in world units and fitted to the screen; in
  landscape the view turns 90° so the hole fills the width. Paper shadows are always cast
  down-right in screen space. The HUD (pause, hole, par, strokes, restart) sits above the
  board; tutorial and tip bubbles move to whichever end of the board is clear.
- **Progression:** holes unlock in order, the next course unlocks when every hole of the
  previous one has been played. Progress is saved after every hole.
- **Tutorial:** on the first hole an animated papercut hand pulls back from the ball and
  lets go ("Drag back to aim" / "Let go to putt"), with the keyboard keys shown for
  mouse players. Each new element gets a one-line tip when its hole opens.
- **Art**, all procedural: layered paper with offset shadows and a fibre texture, mowing
  stripes, recessed sand and water with animated ripples, slope shading with drifting
  arrows, stone rails with highlights, hedge islands, flower bumpers, wooden windmills,
  coloured pipe mouths, a flag that waves and lifts out as the ball comes near, confetti on
  every sink, and per-course decor (bushes and flowers, cacti and rocks, reeds and paper
  lanterns).
- **Sound**, all synthesized: wooden putter tock, wall clack scaled by impact, bumper
  boing, gate click, windmill knock, sand shuffle, splash with bubbles, pipe whoosh, cup
  rattle, sink clunk with a bell chime, star pings, and a soft ambience of wind and
  occasional bird chirps.
- English, Spanish, Portuguese, French and German text.

## Palette

| Token | Hex | Use |
|---|---|---|
| mint | `#DFF3E4` | background, menus |
| grass | `#6CC46A` | the board around the course |
| fairway | `#8FD873` | the playing surface |
| sand | `#F2D49B` | bunkers |
| water | `#4FB3E8` | ponds, penalty toast |
| stone | `#C9C2B6` | walls, posts, sliding blocks |
| ink | `#24402E` | text and icons (never pure black) |
| flag | `#F2545B` | flag, title, accents (buttons use the darker `#C9363F` for white-text contrast) |
| inkSoft | `#46634F` | secondary text |
| gold | `#F2B53D` | stars |
| petal | `#F58FB4` | flower bumpers |

## Files

| File | What |
|---|---|
| `index.html` | page shell (SDK script first, inline CSS only) |
| `ytsdk.js` | shared Playables SDK wrapper (identical to `/shared/ytsdk.js`) |
| `i18n.js` | strings in en, es, pt, fr, de |
| `physics.js` | deterministic ball physics, DOM-free (shared with the checker) |
| `holes.js` | the 27 holes with pars and reference putts, DOM-free |
| `art.js` | procedural papercut art: board, hole layers, props, icons |
| `audio.js` | WebAudio synthesis |
| `game.js` | screens, layout, input, game flow, tutorial, save, lifecycle |

Hole checker (not shipped): `node tools/putt-garden-verify.cjs [--quiet] [--only n]`.

## Playables compliance

- **SDK:** the YouTube SDK `<script>` is the first script. The game talks to it only
  through `PlayablesSDK` (`ytsdk.js`):
  `init({storageKey:'putt-garden_save'})` → title screen drawn synchronously →
  `firstFrameReady()` → `load()` and `getLanguage()` (both with 1 s timeouts) →
  `gameReady()` once the title accepts input (about 0.12 s in the smoke test).
- **Pause / resume:** `onPause` stops the animation loop (and with it the physics and the
  moving obstacles), cancels any drag, suspends the AudioContext and draws a paused veil.
  `onResume` continues where you were; nothing moves while paused, and a putt only starts
  from your own input, so there is no countdown.
- **Audio:** the AudioContext is created on the first user gesture. Sound plays only
  when `isAudioEnabled()` / `onAudioChange` say YouTube audio is on **and** the in-game
  sound toggle is on; otherwise the context is suspended.
- **Save:** `PlayablesSDK.save()` after every finished hole and each settings change.
  Format (about 0.2 KiB):
  `{ v:1, best:[best strokes × 27, 0 = not played], stars:[0..3 × 27], snd:0|1, tut:<tutorial flags>, last:<next hole> }`.
  Outside YouTube the wrapper falls back to `localStorage`.
- **Score:** `PlayablesSDK.sendScore(totalStars)` (0–81) after every finished hole.
- **Size:** 8 shipped files, about 135 KiB in total, no assets, no external requests, no
  `eval`, workers, WASM or text inputs. No flashing (the only pulses are slow and small)
  and no QR-like visuals. Stars, pipes and gates use shapes and glyphs, not colour alone.
