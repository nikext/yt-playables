# yt-playables

Nine original HTML5 games built to the **YouTube Playables** requirements. Each game lives
in its own directory and is a self-contained bundle: no dependencies, no build step, no
external requests.

| Game | Genre | Directory |
|---|---|---|
| **Prism Runner** | Arcade / reflex: switch lanes and colors to pass through gates | [`prism-runner/`](prism-runner/) |
| **Lantern Links** | Puzzle: place and rotate mirrors to light every lantern | [`lantern-links/`](lantern-links/) |
| **Island Ferry** | Casual management: draw ferry routes and deliver goods day by day | [`island-ferry/`](island-ferry/) |
| **Ink Path** | Physics puzzle: draw brushstrokes to guide a marble into a bowl, 36 levels | [`ink-path/`](ink-path/) |
| **Night Drift** | One-finger arcade racing: hold to drift through an endless neon highway | [`night-drift/`](night-drift/) |
| **Kicks Lab** | Creative / styling: paint and sticker sneakers to match client orders | [`kicks-lab/`](kicks-lab/) |
| **Potion Sort** | Brain puzzle: pour layered elixirs until every flask holds one color, 72 solver-verified levels | [`potion-sort/`](potion-sort/) |
| **Ramen Rush** | Time management: cook and serve icon orders at a night-market noodle stall, 20 nights + endless | [`ramen-rush/`](ramen-rush/) |
| **Putt Garden** | Sports / physics: top-down papercut mini golf, 27 holes on 3 courses | [`putt-garden/`](putt-garden/) |

**Play online:** <https://nikext.github.io/yt-playables/>. Pushes to `main` deploy automatically via
`.github/workflows/pages.yml`, which runs the compliance check, then publishes `site/` (the landing
page) and the nine game folders.

All nine share a common SDK wrapper and the rules in `docs/GAME_SPEC.md`. The first batch (Prism
Runner, Lantern Links, Island Ferry) shares a soft pastel flat style. Each game in the second
batch has its own art direction: sumi-e ink on rice paper (Ink Path), synthwave night (Night
Drift) and streetwear risograph print (Kicks Lab). Batch 3 continues that: candlelit apothecary
(Potion Sort), evening night market (Ramen Rush) and sunny papercut diorama (Putt Garden).

## Repo layout

```
docs/REQUIREMENTS.md   Playables rules, researched with sources
docs/GAME_SPEC.md      shared spec every game follows (lifecycle, style, input, i18n)
shared/ytsdk.js        PlayablesSDK wrapper (each game ships an identical copy)
tools/check-bundle.mjs static compliance check (sizes, file names, external URLs, eval...)
tools/smoke.cjs        headless Playwright smoke test against a mock SDK
tools/mock-ytgame.js   fake window.ytgame for local tests
tools/ink-path-verify.cjs   replays every Ink Path level's reference solution through the physics
tools/kicks-lab-verify.cjs  checks that generated Kicks Lab orders are always satisfiable
tools/potion-sort-verify.cjs   solves every Potion Sort level and checks its par
tools/ramen-rush-verify.cjs    checks every Ramen Rush order is makeable and simulates players per night
tools/putt-garden-verify.cjs   replays every Putt Garden hole's reference shots through the physics
tools/package.sh       zip each game into dist/ for upload
site/                  landing page for GitHub Pages (index.html + screenshots)
```

## Run locally

Any static file server works. For example:

```bash
python3 -m http.server 8080 --directory prism-runner
```

Then open <http://localhost:8080>. Outside YouTube, the SDK isn't active, so saves fall
back to `localStorage`.

Once you have Playables access, you can point the official **Test Suite** at your local URL
(e.g. `http://localhost:8080`) to validate the SDK integration.

## Check and package

```bash
node tools/check-bundle.mjs prism-runner
```

```bash
node tools/smoke.cjs prism-runner
```

```bash
tools/package.sh
```

`tools/package.sh` writes `dist/<game>.zip` with `index.html` at the root.

## Applying for access

Developer access is in early access. Apply through the interest form on
<https://developers.google.com/youtube/gaming/playables>. Host the games somewhere public
(GitHub Pages, itch.io, Netlify...) and link them in the application. See
[`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) for the full rules.
