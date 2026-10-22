# Compact YouTube player verification — 22 October 2026

Follow-up to `cc6d771` on `feature/music-mini`, verified only in `/Users/ankimacbox/.t3/worktrees/lift/music-mini`. This supersedes the video size, docking and sheet-clearance sections in [mobile-fix.md](mobile-fix.md); the persistent body portal and provider behavior remain as described there. No merge, push, backend deployment or production changes.

## Result and accepted size exception

The **56 × 32 CSS px iframe works in the tested Chrome engine**. No larger slot or capsule was needed. The actual official YouTube player reported `PLAYING` (1), unmuted, volume 100, and an advancing playback clock on real connected-account liked songs. Its underlying video element also reported `paused: false`. All observed real `onError` events: **none**. This is live provider playback evidence, not a mocked player; no loopback audio recording or physical listening measurement was made.

YouTube's [current IFrame API requirements](https://developers.google.com/youtube/iframe_api_reference#Requirements) and [player parameters documentation](https://developers.google.com/youtube/player_parameters) still specify **200 × 200px minimum** (checked again today). Both the 56 × 32 capsule player and 96 × 54 dock are below it. The user explicitly accepted that trade-off for this follow-up. Successful Chrome playback does **not** establish policy compliance or guarantee that YouTube will permit these sizes on other devices or in future. No audio streams are extracted, and the iframe remains visible. `playsinline=1`, `controls=0`, `disablekb=1`, `iv_load_policy=3`, `rel=0` are retained from the parent change.

## Real dev checks

Target: **giddy-goldfish-291**, local frontend **http://localhost:5193**, existing real connected YouTube and Spotify accounts. This worktree's ignored `.env.local` initially pointed at an anonymous local deployment; it was corrected to the named cloud dev before testing. An isolated temporary workout was used and removed afterward. Real connection records and training history were preserved.

Browser: authenticated desktop Chrome with mobile viewport / iPhone UA emulation at **360 × 780** and **390 × 844**. An iPhone UA does not make Chrome into iOS WebKit.

- **Liked song:** Suni Suni played through the official iframe at 56 × 32, unmuted, volume 100; clock advanced from 11.28s to over 149s through layout changes. No provider error.
- **Queue:** Next loaded Kante; Previous returned to Suni Suni. Seeking the real Kante player to one second before its actual 157.721s end fired its ended event and auto-advanced to TREAT ME SPECIAL, `PLAYING`, unmuted, volume 100. No synthetic ended callback was used.
- **Persistence:** the exact same iframe DOM node remained mounted across sheet open/close, queue changes and keypad kg/reps/RIR. The official playback clock continued advancing. During a sheet, `#app-root.inert === true`; the player is outside it in the body portal.
- **Alignment:** iframe and empty artwork placeholder had identical x/y/width/height, **all deltas 0px**, in both music themes and with/without RestStrip. At 360 without rest: both `(21,728,56,32)`; with rest: `(21,652,56,32)`. At 390 without rest: both `(24,792,56,32)`; with rest: `(24,716,56,32)`. Capsule remains 48px tall; allocation remains 60px. No CSS offsets or placeholder sizing needed changing.
- **Dock:** sheet dock at 390 is `(279,12,96,54)`, clear of the panel starting at y=84. Keypad dock is at y=76..130; capsule is absent. Replaced the stale **268px** modal reserve with **84px**, leaving an 18px gap below the 54px dock and removing the old large empty area.
- **Keypad:** after animation, tops at 390 were **[463,463,463]**, at 360 **[399,399,399]** for kg/reps/RIR: **0px delta** at both sizes. No capsule or transport overlaps the keypad.
- **Themes:** captured dark and explicit `data-theme="light"` music tokens at both widths and with rest. The host app remains dark; no global theme selector was added.
- **Spotify:** a real liked Khat loaded and played; its capsule kept a loaded **32 × 32** cover image (640px source), normal transport, and no visible YouTube iframe. Captured at both widths. Playback was paused after verification.

## Autoplay recovery and actual mobile limits

The old error copy asked for a Play button inside the video, but `controls=0` hides those controls. It now says **“Tap the small video to allow audio.”** This appears next to the sheet transport and in the capsule subtitle. It survives opening the sheet / loading the library, then clears on an actual YouTube `PLAYING` event. Numeric YouTube error codes are now retained in other video errors.

Recovery test: pause the real player and invoke the component's captured `onAutoplayBlocked` callback, then use a real browser click on the visible iframe. This is **injected blocked-event coverage**, not a naturally occurring iOS autoplay rejection. A tap on the 56 × 32 capsule video and the 96 × 54 dock resumed the actual player with an advancing clock; the prompt cleared. One automated dock click during sheet interaction did not resume; a subsequent stable capsule click did. No claim of guaranteed one-tap iOS recovery follows from this Chrome check.

Actual iOS verification could not run: T3 `device_list` failed with **“Could not communicate with device support.”** (`device hub` required 0.15.3, installed 0.12.0; agent required 0.21.25, installed 0.21.12). `device_open` reported **“No ios devices were found on host local.”** T3 preview snapshot also timed out twice with **“Preview automation snapshot timed out after 15000ms.”** Chrome was used after those failures. No physical iPhone, Safari/PWA, Android Chrome, screen-lock or headphone behavior is claimed as measured by this follow-up. Embedded playback still deliberately pauses when the document backgrounds; the UI states that limitation. Premium does not add official-app background playback to an embed.

## Automated checks

- `bunx tsc --noEmit`: pass.
- `bunx vite build`: pass (equivalent Vite build executable to the requested npx command; Bun only). Existing CSS sourcemap warning remains.
- `bunx vitest run`: **24 tests pass, 3 files**. No dependency changes.
- `bun install --frozen-lockfile`: pass, lockfile unchanged.
- Copies `/tmp/lift-e2e/mini-{r1,r3,superset,dnd}-check.mjs` ran at **5193** against dev; originals untouched. Import helper/cwd/output changed only in copies. Isolated `*@local.test` accounts were used.
  - R1: typo warning true, logging advances to set 2, double-tap leaves set done, finish succeeds; `ERRORS []`.
  - R3: Undo, Back closes sheets/keypad, X then Back reaches home; `ERRORS []`.
  - Superset: 0 → 1, Low Incline Dumbbell Press + Pec-Deck Machine Fly.
  - Dnd: pointer swap and keyboard restore, navigation; `ERRORS []`.

## Captures

All are actual browser captures under [screens/](screens/), prefixed `mini-`: YouTube dark/light at both widths, RestStrip in both music themes, keypad at both widths, sheet dock, real auto-advance, injected autoplay-blocked / recovered states, Spotify cover art at both widths. The blocked screenshots are explicitly test-injected, as described above.
