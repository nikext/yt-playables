# Island Ferry

*A cozy trade-route game for a pastel archipelago.*

You run a small ferry company. Every island makes one kind of goods and asks for goods it
doesn't make. Drag routes across the sea and your ferries carry the cargo on their own.
Each day ends at sunset. In the harbor you pick an upgrade, and the next morning a new
island has joined the trade. Keep the islands happy for as many days as you can.

## How to play

- Each island shows the goods it **makes** on its badge: fruit, fish, wood, cloth,
  pottery or tea. The dots around the badge show how many crates it has ready.
- A **request bubble** above an island shows goods it needs. The ring around the bubble is
  its patience, and it turns from green to yellow to coral as time runs out.
- **Drag** from one island to another to open a route. If you drag across more islands
  (up to 4 stops), you get a multi-stop route. Each route uses one ferry, which shuttles
  back and forth, picks up goods that someone on its route has asked for, and delivers
  them. A small check mark on a bubble means a ferry is already bringing that cargo.
- A delivery earns **coins**, with a bonus for speed, and adds to your **reputation**. Every
  12 deliveries restore a heart. A request that runs out costs a **heart**. The run ends
  at 0 hearts.
- A day lasts 80 seconds, and the sun arc at the top shows the time. At sunset you go to
  the **harbor**. There you pick **1 of 3 upgrade cards**, reroll the cards for coins, or
  buy back a heart for coins.
- Your score is the total number of **deliveries**. The title screen shows your best score
  and the best day you reached.

## Controls

| Action | Touch / mouse | Keyboard |
|---|---|---|
| Open a route | drag from island to island (the hit areas are generous) | – |
| Select a route | tap its dashed line or its ferry | Tab cycles through the routes |
| Remove the selected route (refunds the ferry) | the **Remove** button in the bottom panel | Delete / Backspace |
| Pause menu (Resume, Sound, Quit to menu) | the pause button, top left | Esc or P |
| Pick an upgrade / reroll / buy a heart | tap a card or a button | 1 2 3 / R / H |
| Sound on/off | the speaker button on the title, or in the pause menu | M |
| Start / continue from the title | the big button | Enter / Space |

## Features

- Upgrade cards: +1 Ferry, Swift Hulls (speed), Bigger Hold (capacity), Calm Harbor (+60%
  patience at one island), Lighthouse (shows tomorrow's island as a dashed ghost, +10%
  patience), Good Name (+1 max heart), Busy Docks (faster production), Quick Crews
  (faster loading).
- The difficulty curve is gentle and grows with the map: 3 islands on day 1, up to 12
  later. Requests also come faster and have less patience as the days go on.
- A guided first day. An animated hand shows the first drag, the first request has a
  90 s timer, and the clock stays stopped until the first useful route exists.
- Feedback: a coin pop and a bell on each delivery, a heart shake and a low tone when a
  request expires, a horn for a new route, wake trails behind the ferries, and an
  optional sound of gentle waves. All of it is synthesized with WebAudio.
- Layout for any aspect ratio. The world is a fixed 1600×860 sea that is fitted into
  the viewport and turned 90° on portrait screens, while the art stays upright. The game
  re-lays itself out on resize or rotation.
- Text in English, Spanish, Portuguese, French and German, chosen with `getLanguage()`.
  The text is short, and inline goods icons replace the names of goods.

## Files

`index.html` (the SDK script first), `ytsdk.js` (the shared wrapper, unmodified),
`i18n.js` (strings), `art.js` (palette, RNG, drawn icons, islands, boats, sea), `audio.js`
(synthesized sound), `game.js` (state, simulation, input, screens, lifecycle).

## Playables compliance

- **SDK calls** all go through `PlayablesSDK`:
  - `init({storageKey:'island-ferry_save'})` runs first.
  - The title frame is drawn synchronously and then `firstFrameReady()` is called.
  - `load()` and `getLanguage()` run next, then `gameReady()` is called once the title
    accepts input (about 100 ms in the smoke test).
  - `onPause` stops the rAF loop, freezes the simulation and suspends the AudioContext.
    `onResume` restarts the loop and shows a "Tap to continue" overlay during a day.
  - `onAudioChange` and `isAudioEnabled()` are ANDed with the in-game sound toggle. The
    AudioContext is created on the first gesture.
  - `sendScore(best)` is called when a finished run beats the best (including a saved run
    that is abandoned by starting a new one).
  - `save()` is called at meaningful moments only: run start, entering the harbor, a
    reroll, buying a heart, after picking a card, game over, the sound toggle, and the
    first tutorial delivery.
- **Save format** (JSON, about 200 characters and always well under 10 KiB):
  `{v:1, best, bestDay, snd, tut, run}`. `run` is `null` or the between-day snapshot
  `{s: seed, d: day, h: hearts, mh: maxHearts, r: rep, c: coins, n: deliveries, f: ferries,
  u: [speed, hold, crew, docks, lighthouse], cl: calm island ids, rt: [[stops]...],
  rr: rerolls, hp: heart buys, hb: 1 if waiting in the harbor, dd: deliveries that day}`.
  The islands are regenerated from the seed with a seeded RNG (mulberry32). Card offers
  are also seeded, so a reload in the harbor shows the same cards. Every field is
  validated and clamped when it is loaded.
- **Size**: 6 shipped files, about 117 KiB in total. There are no assets, no external
  requests, no eval, Workers or WASM, and no text inputs.
- **Checks**: `node tools/check-bundle.mjs island-ferry` gives PASS with no warnings.
  `node tools/smoke.cjs island-ferry <dir>` gives SMOKE PASS.
- `window.__ferryDebug` is a small test hook (time scale, state read-out, and actions a
  player could take anyway). It sends nothing over the network and does nothing unless it
  is called.
