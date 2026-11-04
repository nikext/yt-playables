# yt-playables

Three original HTML5 games built to the **YouTube Playables** requirements. Each game lives
in its own directory and is a self-contained bundle: no dependencies, no build step, no
external requests.

| Game | Genre | Directory |
|---|---|---|
| **Prism Runner** | Arcade / reflex: switch lanes and colors to pass through gates | [`prism-runner/`](prism-runner/) |
| **Lantern Links** | Puzzle: place and rotate mirrors to light every lantern | [`lantern-links/`](lantern-links/) |
| **Island Ferry** | Casual management: draw ferry routes and deliver goods day by day | [`island-ferry/`](island-ferry/) |

All three share a soft pastel flat style and a common SDK wrapper.

## Repo layout

```
docs/REQUIREMENTS.md   Playables rules, researched with sources
docs/GAME_SPEC.md      shared spec every game follows (lifecycle, style, input, i18n)
shared/ytsdk.js        PlayablesSDK wrapper (each game ships an identical copy)
tools/check-bundle.mjs static compliance check (sizes, file names, external URLs, eval...)
tools/smoke.cjs        headless Playwright smoke test against a mock SDK
tools/mock-ytgame.js   fake window.ytgame for local tests
tools/package.sh       zip each game into dist/ for upload
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
