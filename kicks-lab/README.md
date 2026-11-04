# Kicks Lab

*A tiny custom sneaker studio, printed in riso ink.*

You run a one-person sneaker customizing studio. Clients walk in one at a time with an
order card made of icons: inks they want, a vibe, a pattern, a sticker, an ink they hate,
a mood board to match. You paint, spray and sticker an original sneaker to fit, they rate
it in **hype stamps**, and you earn cash and reputation. Five clients make a day. Between
days you buy new inks, patterns, stickers, lace styles and silhouettes, and your growing
reputation brings pickier clients with harder (and better paid) orders, up to "remix"
jobs where someone brings a finished pair and wants two changes. Pin your best pairs to
the studio wall.

## How to play

- **Pick an ink** from the swatches, then **tap a zone** of the shoe to paint it. The
  zones are the upper, side panel, toe cap, heel (with its pull tab), collar, laces,
  midsole and sole.
- **Pattern**: choose fade (halftone), speckle, stripes, a tiny tilted check or camo, then
  tap a zone. The pattern is sprayed in the selected ink over the zone's base ink.
  The crossed-out chip clears a pattern.
- **Sticker**: drag a sticker (star, bolt, wave, flame, eye, smiley) onto the shoe and it
  lands on the side panel in the selected ink. Drag a placed sticker to move it, or drag it
  off the shoe to peel it off. You can place up to 3.
- **Laces** and **Shoe** switch the lace style and the silhouette (runner, high-top,
  trail, slip-on). Your paint job carries over.
- **Undo** steps back through every edit.
- The **order card** shows each requirement as an icon. A green check appears as soon as
  your design meets it. Tap an icon to see what it means. In landscape each icon has a
  short label too.
- Tap **Done**. The result screen explains the rating:
  - every requirement is a row with a check or a cross,
  - the requirements share 80 points of the **hype meter**,
  - **Harmony** gives up to +10 (2 to 4 inks, related or complementary hues, a neutral
    sole or midsole, and nothing left unpainted),
  - **Speed** gives +10 when you finish within the soft timer on the card, and less after,
  - the **spray booth** upgrade adds +5 per level.
  - 30 / 50 / 70 / 88 points = 2 / 3 / 4 / 5 stamps. A pair that meets every requirement
    gets 5 stamps if it's quick *or* harmonious.
- Cash and reputation scale with the stamps. Reputation tiers (12, 40, 90 and 160 rep)
  unlock more requirement types: zone colors, patterns, bans and vibes first, then mood
  boards, lace styles and silhouettes, then remix orders and 4-requirement orders.

## Controls

| Action | Touch / mouse | Keyboard |
|---|---|---|
| Select an ink | tap a swatch | 1 to 9, 0 (first ten inks) |
| Choose a tool | tap Paint / Pattern / Sticker / Laces / Shoe | B / S / K / L / H |
| Cycle the tool's options | tap a chip | Up / Down |
| Focus a zone | – | Tab / Shift+Tab, Left / Right |
| Apply the tool | tap a zone (stickers: drag or tap the shoe) | Enter |
| Undo | the undo button | Z |
| Done | the Done button | D or Shift+Enter |
| Result: next client / pin to wall | the buttons | Enter / F |
| Shop: buy / next day / wall | tap a card / the buttons | 1 to 4 / Enter / W |
| Pause menu | the pause button | Esc or P |
| Sound on/off | the speaker button, or in the pause menu | M |

## Features

- Four original silhouettes built from a handful of parameters (toe spring, sole and
  midsole heights, collar line, throat). Each zone is a `Path2D` and hit tests use
  `isPointInPath` with a forgiving margin. There are no real-brand logos, stripes or
  trademarked shapes: the side panel is a plain rounded badge area.
- The painted shoe is rendered once to an offscreen canvas and only re-rendered when the
  design or the screen size changes.
- **Every order is satisfiable.** `KL.genOrder` only uses content the player owns and
  keeps an order only when `KL.solve` can build a design for it that meets every
  requirement. `KL.selfCheck(n)` generates orders for every reputation tier with random
  unlock sets (a quarter use only the starting kit) and checks that the solver's design
  scores 5 stamps and uses only owned content. If a draft order fails 40 times, the client
  falls back to a simple two-ink order.
- First-play tutorial: the first client is scripted (pink + blue + a star sticker). An
  animated hand shows each step (pick the ink, tap a zone, add the blue, open the
  stickers, drag the star, tap Done), and it adapts if the player does things in another
  order. There is no timer pressure during the tutorial.
- Shop: four offers per day from what you don't own yet (ink packs, patterns, stickers,
  lace styles, silhouettes, a two-level spray booth for +5 hype per level, and a display
  window that brings picky clients: +1 requirement, +40% pay, +1 rep at 4+ stamps).
- Studio wall: pin up to 6 favorite pairs (the oldest pin is replaced when it is full).
  Each one is stored as a compact string of about 26 to 38 characters.
- Juice: stamp slam with a thud, paper confetti on 5 stamps (it falls, never flashes),
  spray particles, bucket ripples, sticker slaps, a cash counter and a register ding.
- Sound is all WebAudio synthesis: spray hiss, bucket plop, sticker peel and slap, cash
  ding, stamp thud, UI ticks, and a procedural lo-fi beat in the shop (80 bpm, swung
  hats, four 7th chords, soft kick, snare and bass, vinyl crackle). It is original and
  generated on the fly.
- Layout from `min(w, h)` units. Portrait puts the client and order on top, the shoe in
  the middle and the tray at the bottom. Landscape puts the client and order on the left,
  the shoe in the center and the tray on the right. The swatch grid uses the fewest rows
  that keep cells at 44 px or more, and short screens switch to a compact tray. The game
  re-lays itself out on resize or rotation.
- Text in English, Spanish, Portuguese, French and German, chosen with `getLanguage()`.
  The order cards are icon-first.

## Art direction: streetwear risograph print

| Token | Hex | Use |
|---|---|---|
| paper | `#FFF4E2` | background |
| ink | `#26213A` | outlines and text (never pure black) |
| riso pink | `#FF4F9A` | primary accent, Done button, stamps |
| riso blue | `#2F5BEA` | secondary accent, shadows, Next buttons |
| sunflower | `#FFD23F` | selection, highlights, prices |
| inkSoft | `#5A5270` | secondary text |
| mint / orange / violet / teal | `#4FD6A8` `#FF8B2C` `#8A5CF0` `#13A3A6` | extra riso inks |

All of these live in the `KL.C` palette object in `art.js`. The 22 paintable inks are in
`KL.INKS` in `orders.js`. The look comes from flat ink layers whose fills are offset a few
units from the ink outlines (misregistration), colored halftone dot tiles that are
pre-rendered once and used as patterns, and a grain tile that is also pre-rendered.
UI chips are thick-outlined stickers with offset ink shadows, and the type is a chunky
rounded sans with an offset second-ink shadow. Clients are abstract, stylish busts
(hoodies, caps, beanies, bucket hats, shades, varied skin tones and hair) that react to
the rating. The check pattern is tiny, tilted 45° and colored, so it never reads as a
high-contrast grid.

## Files

`index.html` (the SDK script first), `ytsdk.js` (the shared wrapper, unmodified),
`orders.js` (content tables, design model and encoding, order generation, rating, solver
and the self-check; it has no DOM code, so it also runs in Node), `i18n.js` (strings),
`art.js` (palette, riso helpers, sticker glyphs, icons, clients, stamp), `shoes.js`
(silhouettes, zones, hit testing, shoe renderer), `audio.js` (synthesized sound and the
lo-fi beat), `game.js` (state, layout, input, screens and lifecycle).

## Playables compliance

- **SDK calls** all go through `PlayablesSDK`:
  - `init({storageKey:'kicks-lab_save'})` runs first.
  - The title frame is drawn synchronously and then `firstFrameReady()` is called.
  - `load()` and `getLanguage()` run next, then `gameReady()` is called once the title
    accepts input (about 100 ms in the smoke test).
  - `onPause` stops the rAF loop (which freezes the order timer and all animation),
    cancels any drag and suspends the AudioContext. `onResume` restarts them. Kicks Lab is
    not an action game, so it continues without a "tap to continue" overlay. The pause
    menu also stops the order timer.
  - `onAudioChange` and `isAudioEnabled()` are ANDed with the in-game sound toggle. The
    AudioContext is created on the first gesture. The shop beat is scheduled from the game
    loop, so it stops when the game is paused or muted.
  - `sendScore(rep)` reports total reputation at the end of each day.
  - `save()` is called at meaningful moments only: after each client, at the end of a
    day, after each shop purchase, at the start of the next day, on pin and unpin, on a
    new studio, and on the sound toggle.
- **Save format** (JSON, under 500 characters even with a full wall, far below 10 KiB):
  `{v:1, cash, rep, day, cl: clients done today, dc/dr/ds: today's cash, rep and stamps,
  sh: 1 while waiting in the shop, ink/pat/stk/lace/sil: owned-content bitmasks, booth:
  0-2, win: 0/1, wall: [[design code, stamps] x up to 6], snd, tut, pairs, five}`.
  Every field is validated and clamped when it is loaded. The starting kit is always
  ORed into the bitmasks, wall codes that do not decode are dropped, and a finished day
  (`cl` = 5) always resumes in the shop.
- **Size**: 8 shipped files, about 180 KiB in total. There are no assets, no external
  requests, no eval, Workers or WASM, and no text inputs. The game never asks for a name.
- **Checks**: `node tools/check-bundle.mjs kicks-lab` gives PASS with no warnings.
  `node tools/smoke.cjs kicks-lab <dir>` gives SMOKE PASS. `KL.selfCheck` passes for
  several hundred generated orders across all tiers. A Playwright playthrough (portrait
  390×844 with touch and landscape 1280×720 with the mouse) plays the tutorial with real
  taps and drags, plays a full day by tapping out each order, buys from the shop, checks
  the wall and reloads to confirm the save persists.
- `window.__kicksDebug` is a small test hook: a read-only state and layout read-out, the
  solver's design for the current order (used by the test to pick which taps to make),
  and the self-check. It sends nothing over the network and does nothing unless it is
  called.
