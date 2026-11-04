# Shared spec for all three games

Every game in this repo follows these rules, so the three of them pass YouTube Playables
certification (see `REQUIREMENTS.md`) and feel like one family.

## Layout

```
<game>/
  index.html   # the SDK <script> first, then ytsdk.js, then the game scripts. Inline CSS only.
  ytsdk.js     # an exact copy of /shared/ytsdk.js. Do not edit it per game.
  game.js      # game code (you may split it into more .js files: relative paths, classic scripts)
  README.md    # the pitch, controls, how it meets the requirements (not part of the bundle)
```

`index.html` skeleton:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <title>Game Name</title>
  <script src="https://www.youtube.com/game_api/v1"></script>
  <style>html,body{margin:0;height:100%;overflow:hidden;background:#FFF7EE;touch-action:none;-webkit-user-select:none;user-select:none}canvas{display:block;width:100%;height:100%}</style>
</head>
<body>
  <canvas id="game"></canvas>
  <script src="ytsdk.js"></script>
  <script src="game.js"></script>
</body>
</html>
```

## Technology

- Vanilla JS and Canvas 2D, **zero dependencies**, no build step.
- No external requests of any kind: no web fonts, CDNs, images or analytics. The only URL
  is the SDK script tag.
- No `eval` / `new Function`, Web Workers, WASM or clipboard. No text inputs, and never ask
  for a name, age or account.
- All art is drawn in code. All sound is synthesized with WebAudio, and there is no music
  licensing.
- Font stack: `ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif`.

## Visual style: soft pastel flat

| Token | Hex | Use |
|---|---|---|
| bg | `#FFF7EE` | cream background |
| ink | `#3D3B54` | text and outlines (never pure black) |
| inkSoft | `#8A87A6` | secondary text |
| peach | `#FFB4A2` | |
| pink | `#F7A1C4` | |
| lavender | `#B9A7F5` | |
| mint | `#9EE0C5` | |
| sky | `#A7D3F5` | |
| butter | `#FFE39A` | |
| coral | `#FF8C7A` | accent / danger |

- Use rounded shapes, soft drop shadows (offset blocks of a slightly darker tint, not
  blur-heavy) and gentle easing animations, with small particle puffs as feedback.
- The tone is calm and charming but aimed at **13+**. Avoid babyish characters or "for kids"
  framing.
- Do not draw high-contrast black-and-white square grids (no QR-like visuals).

## Screen and input

- One full-window canvas, scaled by `devicePixelRatio` (cap it at 2). Handle `resize`.
- It must look and play well in **portrait phone (390×844)**, **landscape desktop
  (1280×720)** and anything in between. Lay out from `min(w, h)`-based units and never
  assume an orientation.
- Use Pointer Events for touch and mouse, plus keyboard controls. Make tap targets ≥ 44 CSS px.
- Respect the safe-area: keep HUD elements away from the edges (about 16 px).

## Lifecycle (required)

1. Synchronously draw the title screen as the first frame, then call
   `PlayablesSDK.firstFrameReady()`.
2. `await PlayablesSDK.load()` (it has a built-in 1 s timeout and resolves to null when
   there's no save) and apply the save.
3. Call `PlayablesSDK.gameReady()` once the title screen accepts input, well under 5 s.
4. `PlayablesSDK.onPause` stops the game loop, timers and audio (suspend the
   AudioContext). `onResume` continues. Action games show a "tap to continue" overlay
   instead of jumping straight back into play.
5. With `PlayablesSDK.onAudioChange(enabled)` / `isAudioEnabled()`, effective sound =
   YouTube audio enabled **AND** the in-game sound toggle. Create the AudioContext lazily on
   the first user gesture.
6. Use `PlayablesSDK.save(obj)` at meaningful moments (game over, level clear, settings
   change), not every frame. Keep saves tiny (well under 500 KiB, ideally < 10 KiB) and
   include a `v` version field.
7. Use `PlayablesSDK.sendScore(n)` for the game's main number (best score / total stars).
8. Call `PlayablesSDK.init({ storageKey: '<game-id>_save' })` first.

## Text and localization

- Keep text minimal and lean on icons. Put all strings in one dictionary with at least
  **en, es, pt, fr, de**, chosen via `PlayablesSDK.getLanguage()` (fall back to en).
- Show a first-play tutorial or hints (text plus an animated hand or arrows).

## Quality bar

- 60 fps on mid-range phones. Avoid per-frame allocations in hot loops.
- No softlocks. There is always a way to continue, retry or go back to the menu.
- The game should be enjoyable for 5+ minutes and give a reason to come back
  (best scores, progression, stars).

## Verification (it must pass before you're done)

```bash
node tools/check-bundle.mjs <game>
```

```bash
node tools/smoke.cjs <game> <screenshot-dir>
```

Also play through the game headlessly with a game-specific Playwright script, and look at
the screenshots.
