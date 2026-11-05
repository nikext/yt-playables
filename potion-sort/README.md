# Potion Sort

*Sort the elixirs, one pour at a time.*

An apothecary's shelves have been knocked about and every flask now holds a jumble of
layered elixirs. Tilt and pour them, glass to glass, until each flask holds a single
potion and gets its cork. Potion Sort is a calm brain puzzle with **72 levels on six
shelves**: Herb Cellar, Ember Shelf, Narrow Nook, Fog Cabinet, Wax Seal Vault and the
Grand Laboratory. Every level is generated from a seed and proven solvable by an optimal
solver, which also sets its par.

## How to play

- Every flask holds up to **4 layers**. Tap a flask to pick it up (it lifts and glows),
  then tap another flask to pour.
- A pour moves the **whole run of the top color** (all touching layers of that color),
  as much as fits. You can only pour **onto the same color** or **into an empty flask**.
- A flask full of one color is **complete**: a cork pops on with a sparkle and it is
  locked. Clear the level when every flask is complete or empty.
- Every pour is one move. Beat **par** (the optimal move count) for stars:
  - 3 stars at par + slack (slack = max(1, round(par × 0.1))),
  - 2 stars up to par + max(3, round(par × 0.4)),
  - 1 star for any clear.
  The HUD shows the stars you would get at your current move count.
- **Every color has its own rune** drawn in each layer (ruby diamond, sapphire drop,
  emerald triangle, amber sun, amethyst star, aqua moon, rose heart, lime cross), so the
  game never relies on color alone.
- Later mechanics:
  - **Narrow Nook**: only one spare flask on most levels.
  - **Fog Cabinet**: hidden layers are smoky and marked **?**. They reveal themselves
    as soon as they reach the top (a hidden layer that is part of the top color run is
    shown too, because it would move with the run).
  - **Wax Seal Vault**: one flask is sealed with red wax. The seal shows how many pours
    are left until it pops open; until then you cannot pour into or out of it.
  - **Grand Laboratory**: everything together.

### Tools

| Tool | What it does |
|---|---|
| Undo | Steps back one pour (unlimited). The move counter goes back too. |
| Restart | Back to the starting layout (revealed layers stay revealed). |
| Extra flask | Adds one empty flask to this level. You hold up to 3. You start with 2 and get one back for every 3 new levels cleared. One per level, and a level cleared with it gives at most 2 stars. |

**No softlocks.** After every pour the game checks the position. If there is no legal
pour left it says *No moves left*; if the solver proves the position can no longer be
solved (it searches the whole reachable space, capped at 25k states) it says *Dead end*.
Either way the undo, restart and extra-flask buttons pulse. The pause menu also has
restart and the level list.

## Controls

| Action | Touch / mouse | Keyboard |
|---|---|---|
| Pick up / pour | tap a flask, then another | arrows to move the cursor, Enter / Space |
| Pick a flask directly | – | 1 to 9, 0 (flasks 1 to 10) |
| Put a flask back down | tap it again, or tap empty space | Enter on it again |
| Undo | undo button | Z, U or Backspace |
| Restart | restart button | R |
| Extra flask | flask+ button | F or A |
| Pause menu | pause button | Esc or P |
| Level list | grid button | – |
| Sound on/off | title screen or pause menu | M |
| Menus | tap | arrows + Enter, Esc to go back |

## Features

- **72 levels** in 6 shelves of 12, ramping from 2 colors to all 8, then taking spare
  flasks away, then hiding layers, then sealing flasks, then mixing everything. Par
  grows from 3 (level 1) to 28.
- **Deterministic generation.** `levels.js` builds each level from a hash of (level,
  try): pick the colors, shuffle 4 layers of each into the flasks, add the spare flasks,
  mark hidden layers and pick the sealed flask. The level table stores only `[try, par]`
  per level (72 pairs). Layouts that look trivial (a flask already complete, or three of
  a color stacked) are skipped.
- **Optimal solver.** A* over pours with the admissible, consistent heuristic
  *(number of color runs) − (number of colors)* (a pour removes at most one run), so the
  first solution found is optimal. States are hashed with the flasks sorted (order does
  not matter) except a still-sealed flask, and pointless moves (moving a single-color
  flask into an empty one, picking between identical empty flasks) are pruned. The
  hardest level expands about 13k states; all 72 verify in about one second.
- **Tutorial:** level 1 shows an animated hand that always points at the next optimal
  tap (from the live solver, so it adapts if you pick a different flask), with
  *Tap a flask to pick it up* / *Tap another flask to pour*. The first level of each
  new mechanic shows a one-line tip.
- **Animation:** the picked flask lifts and glows; a pour slides the flask over the
  target, tilts it (more for emptier flasks) while the liquid surface stays level, sends
  a wobbling stream into the target whose level rises as the source drains, with
  droplets at the surface, then returns it. Completed flasks get a cork that drops in
  with a pop and sparkles. Seals pop off. Bubbles drift up inside the liquids, dust
  motes float in the candlelight, candles flicker gently (no flashing).
- **Audio** (WebAudio only): glass clinks on pick-up, bubbly glugs that rise in pitch as
  the target fills plus a liquid hiss, a cork pop, a seal crack, a reveal shimmer, a
  sparkle arpeggio, star chimes, a clear fanfare and an optional ambient pad (a warm,
  slowly filtered drone with soft candle crackles). Sound and pad have separate toggles.
- **Layout** from `min(w, h)` units. The board picks 1 to 4 shelf rows, whichever gives
  the biggest flasks for the screen (e.g. 3 flasks in one row, 10 flasks in 2 rows on a
  phone and 1 row on desktop). Candles stand at the ends of the shelf when there is room.
  Tap targets are whole flask columns (at least 44 px).
- English, Spanish, Portuguese, French and German, chosen with `getLanguage()`.

## Art direction: candlelit apothecary

| Token | Hex | Use |
|---|---|---|
| shelf | `#17322B` | dark green wood background and panels |
| shelfDeep / shelfHi | `#0C1D18` / `#21443A` | shadows, panel highlights |
| plankTop / plankFront | `#2C574A` / `#123029` | shelf planks |
| brass | `#D4A84B` | primary buttons, frames, collars, stars |
| brassDeep / brassHi | `#8E6A25` / `#F4D98F` | brass shading and highlights |
| parchment | `#F2E6C9` | text on wood, cards, secondary buttons |
| ink | `#2B2116` | text on parchment and brass |
| seal / cork | `#A3283A` / `#BF915E` | wax seals, corks |
| ruby | `#E0475B` | liquid, rune: diamond |
| sapphire | `#3E7BFA` | liquid, rune: drop |
| emerald | `#2FC77A` | liquid, rune: triangle |
| amber | `#FFB23E` | liquid, rune: sun |
| amethyst | `#A45CF2` | liquid, rune: star |
| aqua | `#3FD8E0` | liquid, rune: crescent moon |
| rose | `#FF7FB0` | liquid, rune: heart |
| lime | `#B6E34A` | liquid, rune: cross |

All tokens live in `PS.Art.C` and `PS.Art.LIQ` in `art.js`. Runes are light on the darker
liquids and dark on the bright ones. Text is parchment on dark green (about 11:1) or ink
on parchment/brass (above 7:1).

## Files

| File | What |
|---|---|
| `index.html` | page shell (SDK script first, inline CSS only) |
| `ytsdk.js` | shared Playables SDK wrapper (identical to `/shared/ytsdk.js`) |
| `levels.js` | rules, seeded generator, A* solver, level table, star thresholds (no DOM, runs in Node) |
| `i18n.js` | strings in en, es, pt, fr, de |
| `art.js` | palette, runes, flask renderer, candles, icons, panels, background |
| `audio.js` | synthesized sound effects and the ambient pad |
| `game.js` | state, pours and animation, layout, screens, input, save, lifecycle |

`tools/potion-sort-verify.cjs` regenerates every level, checks its composition, solves it
again, replays the solution legally (seal respected) and asserts that the level is
solvable, that par matches the table and that the stored try is still the first
acceptable one. `--print-table` rebuilds the table.

## Playables compliance

- **SDK:** the YouTube SDK `<script>` is the first script. The game talks to it only
  through `PlayablesSDK`: `init({storageKey:'potion-sort_save'})` → title drawn
  synchronously → `firstFrameReady()` → `load()` and `getLanguage()` (1 s timeouts) →
  `gameReady()` once the title accepts input (about 0.1 s in the smoke test).
- **Pause / resume:** `onPause` stops the animation loop and timers (pours freeze
  mid-air), suspends the AudioContext and draws a *Paused* overlay. `onResume` continues
  where you were (it is a puzzle, so there is no countdown).
- **Audio:** the AudioContext is created on the first gesture. Sound plays only when
  YouTube audio is enabled (`isAudioEnabled()` / `onAudioChange`) **and** the in-game
  sound toggle is on, and never while paused.
- **Save:** `PlayablesSDK.save()` on level clear, extra-flask use, settings changes and
  when leaving a level. Format (about 0.5 KiB):
  `{ v:1, lv:[[stars, bestMoves] × 72], add: extra flasks (0-3), ap: progress to the next one, snd, mus, tut, last }`.
  Every field is validated and clamped on load.
- **Score:** `PlayablesSDK.sendScore(totalStars)` (max 216) whenever the total rises.
- **Size:** 7 shipped files, about 110 KiB, no assets, no external requests, no `eval`,
  workers, WASM or text inputs. Never asks for personal data.
- **Checks:** `node tools/check-bundle.mjs potion-sort` → PASS,
  `node tools/smoke.cjs potion-sort <dir>` → SMOKE PASS,
  `node tools/potion-sort-verify.cjs` → VERIFY PASS. A Playwright playthrough (portrait
  390×844 with touch, landscape 1280×720 with the mouse) solves the first levels and
  hidden/sealed levels with real taps at par for 3 stars, uses undo, restart, the extra
  flask and the menus, wanders randomly into a dead end and checks the warning, and
  checks pause, the save and `sendScore`.
- `window.__potionDebug` is a small test hook (state read-out, flask and button
  positions, the solver's moves from the current position, start a level). It sends
  nothing over the network.
