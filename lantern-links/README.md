# Lantern Links

*Guide the light. Wake the garden.*

It is dusk in a pastel garden and the paper lanterns are waiting. Turn mirrors, place
your own, split beams with prisms and raise or lower garden stones until every lantern
blooms with warm light. Lantern Links is a calm, level-based light-beam puzzle with
30 handcrafted levels in three chapters: **Dusk**, **Night** and **Dawn**.

## How to play

- Each **emitter** shoots a soft beam in a fixed direction.
- Light **all lanterns** to clear the level. Light passes through lanterns, so one beam
  can light several.
- **Mirrors** are two-sided and bounce the beam 90°:
  - fixed mirrors (dark base) never move,
  - rotatable mirrors (lilac base with a small turn glyph) turn 90° when tapped,
  - your own mirrors (butter base) come from the **tray**: drag one onto the grass, tap
    it to turn it, drag it to another cell to move it, or drag it off the board to put it
    back.
- **Hedges** block light.
- **Night** adds coloured light. A lantern wants exactly its own colour: pink lanterns
  need pink light, sky lanterns need sky light, and **lavender** lanterns need pink
  *and* sky light crossing them. The wrong light makes a lantern flicker with a dashed
  ring instead of blooming.
- **Prisms** split a beam into two beams at right angles. Some sit on the board, some
  come from the tray.
- **Dawn** adds **garden stones**. Tapping any stone flips all of them: the raised ones
  sink and the sunken ones rise.

Every action (place, turn, move, take back, flip stones) is one move. Clear a level in
the fewest moves for three stars. The star goal (`★ ≤ n`) is shown under the level name.

## Controls

| Action | Touch / mouse | Keyboard |
|---|---|---|
| Turn a mirror, flip the stones | tap it | arrows to move the cursor, Enter / Space |
| Place a tray piece | drag it from the tray, or tap an empty cell | Enter / Space on an empty cell |
| Move a placed piece | drag it to another cell | Delete, then place again |
| Return a piece to the tray | drag it off the board | Delete / Backspace |
| Pick mirror or prism (when both exist) | tap its tray stack | Tab or X |
| Undo / reset | ↶ / ⟳ buttons | Z (or U) / R |
| Hint | bulb button | H |
| Back to levels | grid button | Esc |
| Menus | tap | arrows + Enter, Esc to go back |

## Features

- **30 handcrafted levels**, 10 per chapter, growing from 5×5 to 8×8, with mechanics
  introduced one at a time (rotating, placing, pass-through lanterns, colours, colour
  mixing, fixed prisms, tray prisms, garden stones, then everything together).
- Every level was checked with an **offline solver** that reuses the game's own beam
  tracer (uniform-cost search over board configurations). It proves each level solvable
  with the tray it is given and computes the optimal move count ("par") plus one optimal
  solution. Most levels have a unique optimal solution. Par per level:
  Dusk 1 1 2 2 4 3 3 5 4 5, Night 3 3 3 5 1 3 2 3 4 5, Dawn 2 4 5 7 4 4 6 5 5 6.
- **Stars:** 3★ at par (par + 1 for levels with par ≥ 6), 2★ up to par + 2 + ⌊par/2⌋,
  1★ for any clear.
- **Hints** apply the next step of the optimal solution from wherever you are (they can
  also move or remove a misplaced piece). You start with 3, every clear gives one back
  (max 5). A hint costs the same moves as doing it yourself.
- **Progression:** levels unlock in order (you may skip one), Night unlocks by clearing
  Dusk or collecting 15★, Dawn by clearing Night or collecting 36★.
- **Tutorial:** levels 1–3 (and the first tray prism) show an animated hand acting out
  the next step, plus a one-line tip; other new mechanics get a one-line tip.
- Beams grow and glow as they travel, lanterns bloom with a pentatonic chime, clearing a
  level sends the lanterns floating up with a star tally, then Next / Replay / Levels.
- Loops are safe: the tracer visits each (cell, direction, colour) state at most once.
- Synthesized audio only: turn click, place thunk, stone thud, lantern chimes, a clear
  arpeggio and an optional soft ambient pad. Sound and pad have their own toggles on the
  title screen.
- Layout adapts to any aspect ratio: tray below the board in portrait, beside it in
  landscape. Tap targets are at least 44 px (8×8 boards on a 390 px wide phone use 45 px
  cells).
- English, Spanish, Portuguese, French and German text.

## Files

| File | What |
|---|---|
| `index.html` | page shell (SDK script first, inline CSS only) |
| `ytsdk.js` | shared Playables SDK wrapper (identical to `/shared/ytsdk.js`) |
| `engine.js` | board model, beam tracing, moves (shared with the offline solver) |
| `levels.js` | the 30 levels plus the solver-generated par / optimal solution per level |
| `game.js` | rendering, input, audio, screens, save, hints, tutorial |

## Playables compliance

- **SDK:** the YouTube SDK `<script>` is the first script. The game talks to it only
  through `PlayablesSDK` (`ytsdk.js`):
  `init({storageKey:'lantern-links_save'})` → title screen drawn synchronously →
  `firstFrameReady()` → `load()` and `getLanguage()` (both with 1 s timeouts) →
  `gameReady()` once the title accepts input (about 0.1 s in the smoke test).
- **Pause / resume:** `onPause` stops the animation loop, cancels any drag and suspends
  the AudioContext, and draws a "Paused" overlay. `onResume` continues where you were
  (no countdown, it is a puzzle).
- **Audio:** the AudioContext is created on the first user gesture. Sound plays only
  when `isAudioEnabled()` / `onAudioChange` say YouTube audio is on **and** the in-game
  sound toggle is on.
- **Save:** `PlayablesSDK.save()` after each level clear, each hint used, each settings
  change and when leaving a level. Format (about 0.4 KiB):
  `{ v:1, lv:[[stars,bestMoves] × 30], ch:<highest unlocked chapter>, hints:n, snd:0|1, mus:0|1, seenTutorial:bool, last:<last level> }`.
  Outside YouTube the wrapper falls back to `localStorage`.
- **Score:** `PlayablesSDK.sendScore(totalStars)` after every clear that raises the total.
- **Size:** 5 shipped files, about 110 KiB in total, no assets, no external requests, no
  `eval`, workers, WASM or text inputs. Art is drawn in code; no QR-like visuals (the
  board is a soft dusky lilac with rounded, low-contrast tiles).
