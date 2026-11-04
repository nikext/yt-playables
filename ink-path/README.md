# Ink Path

*One stroke at a time.*

A lacquered marble hangs from a silk thread above a sheet of rice paper. Somewhere below
waits a small celadon bowl. Draw brushstrokes with your finger or mouse, press Go, and
the thread is cut: the marble falls, rolls and slides along your ink. Ink Path is a calm
draw-a-path physics puzzle in sumi-e style with 36 handcrafted levels in three chapters,
**Stone**, **Wind** and **Lantern**.

## How to play

- **Draw** one or more strokes on the paper. Each stroke becomes a solid path once the
  marble is released. Ink comes from a limited **pot** (the meter under the scroll).
- Press **Go**. The strokes dry, the thread is cut and the marble drops. Get every marble
  into a bowl to clear the level.
- **Seals** (stars): 1 for clearing, 2 or 3 for using little ink. The two vermilion ticks
  on the ink meter mark the 2-seal and 3-seal limits, and the three small seals beside it
  show what the current drawing would earn.
- **Undo** removes your last stroke, **Clear** removes them all. Missing is never a dead
  end: if the marble falls off the paper, stops, or takes too long, the level returns to
  drawing with your strokes still in place. Pressing Go (now a retry button) or touching
  the paper during a run does the same at once.
- After two misses a **hint** button appears; it shows a faint ghost of a known solution.

Level elements, introduced one at a time:

| Element | What it does |
|---|---|
| Stone ledges | fixed, solid ink-wash rocks |
| Mist (indigo wash, dashed edge) | ink will not stick there; the marble passes through freely |
| The void | leave the paper on any side and the marble is lost |
| Wind (moving streaks) | pushes the marble while it is inside the zone; rising wind lifts it |
| Bamboo springs | launch the marble away from their coil |
| Paper screens | solid, but a marble hitting them fast enough tears straight through |
| Lanterns | swing on a fixed track once you press Go and bounce the marble away |
| Second marble | both marbles need a bowl (each bowl holds one) |

## Controls

| Action | Touch / mouse | Keyboard |
|---|---|---|
| Draw | drag on the paper | (pointer only) |
| Go / retry while running | red button | Enter / Space |
| Undo last stroke | ↶ button | Z / Backspace |
| Clear all strokes | slashed-stroke button | C |
| Retry (back to drawing; clears strokes when already drawing) | | R |
| Hint (after two misses) | bulb button | H |
| Pause menu (resume, retry, levels, sound) | ‖ button | Esc / P |
| Sound on/off | sound button (title, pause menu) | M |
| Menus and level select | tap | arrows + Enter, Esc to go back |

## Features

- **36 handcrafted levels**, 12 per chapter: Stone (ramps, ledges, mist, the void, jumps,
  narrow gaps), Wind (side winds, updrafts, bamboo springs, paper screens), Lantern
  (moving lanterns, two marbles, then everything together).
- **Deterministic physics** (`physics.js`): fixed 240 Hz steps, circle-vs-capsule
  collisions with restitution, Coulomb friction and rolling resistance, a speed cap that
  keeps each step far below the contact band (no tunnelling), kinematic lanterns,
  marble-vs-marble collisions. Only `+ - * /`, `Math.sqrt` and `Math.floor` are used in
  the simulation, so a drawing always gives the same run.
- **Strokes** are sampled every 8 world units, cut where they enter mist or the space
  around a marble or bowl, and simplified with Ramer–Douglas–Peucker before they become
  colliders. The same builder is used by the game and the level checker.
- **Every level is verified** by `tools/ink-path-verify.cjs`: it replays the stored
  reference solution through the game's own stroke builder and physics, checks that it
  clears the level with 3 seals within the pot, that the replay is deterministic, and that
  pressing Go with no ink does *not* clear the level. It also replays 24 jittered copies
  of each solution (every point moved up to 4 units) and reports how forgiving it is.
- **Seal thresholds** come from the reference solution: 3 seals at about 1.4× its ink,
  2 seals at about 2.2×, and a pot of about 2.8× (with generous minimum margins).
- **Progression:** a level unlocks when the one before it (or the one before that) is
  cleared, so one level can always be skipped.
- **Tutorial:** on level 1 an animated hand draws the first stroke and the Go button
  pulses; level 2 points at the ink meter. New elements get a one-line tip.
- **Art**, all procedural: rice paper with fibres (pre-rendered once), ink-wash
  mountains, a hanging-scroll mount, brush strokes with speed-based width, tapered ends,
  dry-brush streaks and wet edges that dry and darken when you press Go, a brush
  calligraphy title inside an ensō, lacquered marbles with gold swirls, celadon bowls,
  vermilion seal stamps, gold leaf flecks on success.
- **Sound**, all synthesized: a soft brush scratch while drawing (filtered noise), wood
  block knocks on impacts, a quiet rolling rumble, a singing-bowl ring when a marble lands
  in a bowl, a low taiko thud on a miss, paper tearing, spring boings, and koto-like plucks
  in a miyako-bushi scale in the menus (no melodies, no samples).
- Works in portrait (HUD above and below the scroll) and landscape (HUD beside it); the
  layout picks whichever gives the larger scroll. Tap targets are at least 46 px.
- English, Spanish, Portuguese, French and German text.

## Palette

| Token | Hex | Use |
|---|---|---|
| paper | `#F3EBDD` | background |
| ink | `#2B2622` | strokes, text, outlines |
| vermilion | `#D9452B` | seals, lanterns, marble lacquer (buttons use the darker `#B83A22` for text contrast) |
| gold | `#C9A24A` | leaf flecks, focus rings, mount lines |
| indigo wash | `#5B6B85` | mist and wind |
| moss | `#7A8B5A` | bamboo springs |
| celadon | `#A3BBA8` | bowls |

## Files

| File | What |
|---|---|
| `index.html` | page shell (SDK script first, inline CSS only) |
| `ytsdk.js` | shared Playables SDK wrapper (identical to `/shared/ytsdk.js`) |
| `i18n.js` | strings in en, es, pt, fr, de |
| `physics.js` | deterministic physics, stroke builder, seal rule (shared with the checker) |
| `levels.js` | the 36 levels with reference solutions, ink pots and seal thresholds |
| `art.js` | procedural paper, brush renderer, calligraphy, sprites and level pieces |
| `audio.js` | WebAudio synthesis |
| `game.js` | screens, layout, input, game flow, tutorial, save, lifecycle |

Level checker (not shipped): `node tools/ink-path-verify.cjs [--only n] [--suggest]`.

## Playables compliance

- **SDK:** the YouTube SDK `<script>` is the first script. The game talks to it only
  through `PlayablesSDK` (`ytsdk.js`):
  `init({storageKey:'ink-path_save'})` → title screen drawn synchronously →
  `firstFrameReady()` → `load()` and `getLanguage()` (both with 1 s timeouts) →
  `gameReady()` once the title accepts input (about 0.15 s in the smoke test).
- **Pause / resume:** `onPause` stops the animation loop (and with it the physics), ends
  any stroke in progress, suspends the AudioContext and draws a paused veil. `onResume`
  continues where you were; it is a calm puzzle, so there is no countdown.
- **Audio:** the AudioContext is created on the first user gesture. Sound plays only
  when `isAudioEnabled()` / `onAudioChange` say YouTube audio is on **and** the in-game
  sound toggle is on; otherwise the context is suspended.
- **Save:** `PlayablesSDK.save()` after each level clear and each settings change.
  Format (about 0.2 KiB):
  `{ v:1, stars:[0..3 × 36], ink:[best % of the pot used × 36], snd:0|1, tut:<bit flags for the two tutorials>, last:<next level> }`.
  Outside YouTube the wrapper falls back to `localStorage`.
- **Score:** `PlayablesSDK.sendScore(totalStars)` (0–108) after every clear that raises
  the total.
- **Size:** 8 shipped files, about 140 KiB in total, no assets, no external requests, no
  `eval`, workers, WASM or text inputs. The level select uses rounded paper cards with
  seals, never a high-contrast square grid. No flashing: the only pulses are slow
  (≤ 1 Hz) and small.
