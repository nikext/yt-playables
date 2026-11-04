# YouTube Playables: requirements research

Researched 2026-11-04. Rules quoted below come from Google's certification and SDK
pages (`developers.google.com/youtube/gaming/playables/...`). The official site could
not be reached from the build sandbox, so the quotes are taken from a public verbatim
snapshot of those pages made on 2026-10-24 and from the official Phaser YouTube
Playables template. **Check them against the live docs before you submit.**

MUST = a hard rule; the game is rejected if it breaks one. SHOULD = recommended; it gives
better visibility on the platform.

## 1. How access works

- Developer access is still **early access**. You apply through the **Playables interest
  form** on <https://developers.google.com/youtube/gaming/playables>.
- Once you are onboarded you get the full SDK docs, the **Test Suite**, the Developer
  Portal and a Partner Manager.
- To use the Developer Portal you need *channel manager* permission on a YouTube channel
  that has been onboarded to Playables.
- Every Playable is reviewed before it goes live. Your Partner Manager handles release.
- The Gemini-powered "Playables Builder" is a different, separate beta. It is not the
  developer program.

**Why three finished games help the application:** they show you can ship polished,
SDK-ready HTML5 games that already pass the technical bar below.

## 2. SDK integration (all MUST unless noted)

| Item | Rule |
|---|---|
| Load the SDK | `<script src="https://www.youtube.com/game_api/v1"></script>` must be the **first** script on the page, before any game code. Never overwrite `window.ytgame`. |
| `ytgame.game.firstFrameReady()` | Must be called, or the game is never shown. Call it as soon as the first (loading) frame is drawn, and **before** `gameReady()`. |
| `ytgame.game.gameReady()` | Call it once the game is **interactable**. Never call it while a loading screen is still shown. |
| Audio | Read `ytgame.system.isAudioEnabled()` and listen to `ytgame.system.onAudioEnabledChange(cb)`. YouTube controls whether the game plays sound. |
| Pause / resume | `ytgame.system.onPause(cb)` / `onResume(cb)` must pause and resume the game (required if ads are enabled; best practice either way). |
| Cloud save | `ytgame.game.saveData(string)` and `ytgame.game.loadData()` → `Promise<string>`. The data must be a well-formed UTF-16 string: MUST be < 3 MiB, SHOULD be < 500 KiB. `loadData` can hang, so wrap it in a timeout. Outside YouTube (`!ytgame.IN_PLAYABLES_ENV`), fall back to `localStorage`. |
| Score (optional) | `ytgame.engagement.sendScore({ value })`. The value must be ≤ `Number.MAX_SAFE_INTEGER`. |
| Language (optional) | `ytgame.system.getLanguage()` returns a BCP-47 tag. |
| Health (optional) | `ytgame.health.logError()` / `logWarning()` is the only allowed telemetry. |
| Ads (optional) | `ytgame.ads.requestInterstitialAd()` and `requestRewardedAd(id)`. These also have to be switched on in the Developer Portal. |

## 3. Technical, stability and size

- Initial bundle (everything downloaded up to `gameReady`): **MUST < 30 MiB, SHOULD < 15 MiB**.
- Total bundle **MUST < 250 MiB**. Each file **MUST < 30 MiB, SHOULD < 512 KiB**. At most **8000 files**.
- File names may contain only `A-Z a-z 0-9 _ - .`. Use **relative paths only**.
- The game SHOULD be interactive in **under 5 s** and lazy-load the rest.
- Peak JS heap **MUST NOT exceed 512 MB**. No consistently reproducible crashes.
- Use standard Web APIs (JS, Canvas, WebGL). The game MUST work in the **YouTube app on Android and iOS**.
- It MUST be a **Single Page Application**.

## 4. Privacy, data and security

- **No external network calls** except to Google/YouTube APIs. That rules out CDNs, web
  fonts, analytics and your own servers. Everything ships inside the bundle.
- Do not try to get around that blocking.
- **Never ask for personal information**: names, ages, locations, usernames, passwords.
  No login or sign-up screens, and nothing that looks like one.
- **No QR codes**, and nothing that looks like one.
- Read the clipboard only when the player explicitly pastes.
- **No obfuscation** (minifying is fine). Code size and complexity must be scannable.
  `eval()`, WebAssembly and Web Workers may lead to rejection.

## 5. Content / trust and safety

- The audience is **13+**. The game must **not** be "made for kids".
- It must follow the YouTube Community Guidelines. No misleading title, thumbnail or description.
- All content must be original or properly licensed, including **music rights**.
- No duplicates or near-identical copies of Playables already on the platform.
- Do not share dev or staging links outside certification testing.

## 6. Monetization (optional)

- Use YouTube ad functions only. No third-party ads and no off-platform in-app purchases.
- Interstitials only at natural breaks (level end, game over), never during active play.
- Rewarded ads must be opt-in only, never block progress, and never give rewards with
  real-world monetary value.
- YouTube adds pre-roll ads itself.

## 7. Not covered by the snapshot (check after onboarding)

The Design, Integration, Accessibility and i18n requirement pages were not part of the
snapshot. To be safe, these games:

- adapt to **any aspect ratio** (portrait phone, landscape desktop, TV-like),
- support **touch, mouse and keyboard**,
- use short, mostly icon-based text and read `getLanguage()`,
- keep tap targets large and show text with good contrast.

## 8. Planned approach for the games in this repo

- **Vanilla JS + Canvas 2D, zero dependencies.** Each game is a few dozen KiB, far under
  every size limit, with no `eval`, WASM or workers.
- Graphics are drawn in code and sound is synthesized with WebAudio, so there are **no
  licensing issues** and **no external requests**.
- A shared `ytsdk.js` wrapper does `firstFrameReady → gameReady`, audio, pause/resume,
  save/load with a timeout and a localStorage fallback, and `sendScore`. Without the SDK
  it degrades gracefully.

## Sources

- [YouTube Playables (Google Developers)](https://developers.google.com/youtube/gaming/playables)
- [Certification requirements index](https://developers.google.com/youtube/gaming/playables/certification/requirements)
- [Verbatim requirement snapshot, 2026-10-24 (camp-tribe-eu research notes)](https://github.com/camp-tribe-eu/camptribe-game/pull/49)
- [Phaser YouTube Playables template](https://github.com/phaserjs/template-youtube-playables)
- [PocketGamer.biz: Playables expands to 50+ markets](https://www.pocketgamer.biz/youtube-playables-expands-to-more-than-50-markets-including-the-eu-and-nordics/)
