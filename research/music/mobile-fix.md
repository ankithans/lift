# Music mobile correction — 22 October 2026

This supersedes the header-pill placement and close-to-pause decisions in the earlier README and verification report. Final scope is **play in Lift for both providers**. Play never redirects. A provider link exists only under More in the sheet. The intermediate native-app handoff proposal was withdrawn and is not implemented.

## Root causes and production evidence

1. **YouTube was tied to the sheet lifecycle.** The previous parent effect paused on `!open || hidden`, the Close handler paused again, and conditional sheet content unmounted the iframe. Its IntersectionObserver also paused when the player was covered. Those paths made sheet dismissal incompatible with training playback.
2. **Spotify did not establish a usable device before Play.** The previous action simply sent `/me/player/play` with an optional, usually absent device ID. It offered no automatic discovery/transfer or Retry state. The production owner’s `spotify:devices` action returned **`[]` successfully** during this investigation.
3. **A successful Spotify command could look like failure.** On the real dev account, Pause changed Spotify’s actual state to `playing: false`, but the action returned `NETWORK`. A direct diagnostic request returned **HTTP 200, a 27-byte non-JSON body, no content type**. The shared request helper parsed every non-204 success as JSON. Player commands now accept their successful HTTP acknowledgement without parsing a nonexistent response model. After the fix, Connect Pause produced `playing: false` and a matching capsule without an error. A regression test covers 200 with a text body.
4. **Errors lost useful reasons.** The backend reduced provider failures to broad strings; structured errors now retain the safe code, HTTP status and machine-readable reason. The UI handles structured and legacy errors and names no-device, Premium, revoked access and throttling failures.

Production `ardent-butterfly-982` was inspected without deploying code or sending playback controls. Secrets were parsed line by line and never printed. Dev and prod use the same Spotify client; both have client credentials, deployment-specific callback URLs and the expected app URL. A redacted dashboard query showed the production owner connected to Spotify, Premium true, with streaming, playback read/write and library scopes. The owner-scoped devices action succeeded with an empty list. This establishes the current no-device condition; it is not a replay of the phone’s historical request. No evidence of a prod-only missing credential, scope or callback mismatch was found. No prod environment changes were needed.

The stored deploy keys allow env reads and dev deployment but refuse data viewing and acting as a user. The production metadata query and devices action therefore used the already authenticated dashboard. No tokens were included in the query output. CLI credentials belonged to another team and were left unchanged.

## Implementation and layout contract

`WorkoutMusic` is mounted once in the workout content, outside Header. With no loaded item, a quiet Music action follows Add exercise. Loaded music produces a raised 48px capsule with thumbnail, truncated identity, play/pause and Next. Its identity button is labelled `Now playing: <title>, open music controls`. No-device state replaces transport with Retry. Source order remains Spotify, then YouTube Music.

All opens use the route’s `openMenu()` so pending input commits and the keypad closes first. Shared overlays retain Back dismissal. The capsule is absent during editing and while a sheet is mounted, including its exit animation. No periodic playback/track-change announcements are added to the polite live region; transport announcements follow explicit actions.

- Capsule bottom: safe area + **12px**, or safe area + **88px** when `rest.endsAt || rest.endedAt` is truthy (64px strip + 12px outer margin + 12px gap).
- Capsule allocation: **48px + 12px**. The route adds this to both `bottomLayer` and main padding. Attached YouTube video adds another **252px** for the video, docking target, borders and gap.
- Existing base toast offsets **16 / 96 / 430px** remain; music augments the first two. Keypad padding remains **460px**. Ordinary main padding is safe area + 150px + music allocation.
- YouTube’s card can move between the lower-right attached position and upper-right corner. Editing docks it above the keypad. Sheets reserve **268px** at the top; their panel and backdrop leave the video clear. Toasts also respect that space.
- Capsule maximum width 360px, 12px viewport gutters, existing dark tokens and explicit light-theme overrides, 44px minimum controls, no entrance animation with reduced motion.

## YouTube size, visibility and background decision

The current [IFrame API Requirements](https://developers.google.com/youtube/iframe_api_reference#Requirements) specify a **minimum 200 × 200px player viewport**, with enough room for controls; 480 × 270 is a recommendation for 16:9. Lift uses an actual 200 × 200 iframe, native controls and attribution, with a separate 44px docking row. It is already at the smallest supported size; docking does not shrink or conceal it.

[Developer Policies §III.I.7–9](https://developers.google.com/youtube/terms/developer-policies#additional-prohibitions) prohibit audio separation and hidden/background players; §III.I.4 and §III.F protect player functionality and attribution. Lift does not extract audio, cover the player, or create audio-only mode. The iframe and card are portalled directly to `document.body`, outside inert `#app-root`. The same iframe remains through sheet changes, with `playsinline=1`, gesture-triggered controls, its own queue, Previous/Next and `onEnded` advance.

The page deliberately pauses embedded YouTube when visibility becomes hidden, on loss of connectivity, or explicit user action/source change. It does not pause on sheet close or keypad entry. A single quiet sheet note explains that locking the screen or leaving Lift stops this embedded audio. Premium does not change the embed into the official app’s background player. Physical lock-screen behavior was not measured here. Media Session metadata and play/pause/next/previous handlers are installed where supported; they do not bypass the visibility rule or guarantee background execution.

## Spotify capability and device decision

The current [Spotify SDK overview](https://developer.spotify.com/documentation/web-playback-sdk) lists desktop **and mobile**, including iOS, and notes that iOS transfer alone does not start audio. The original claim that the SDK universally lacks mobile support is inaccurate. Lift probes Widevine EME, then Safari FairPlay EME rather than blocking a mobile UA. The FairPlay probe follows [WebKit’s own capability test](https://github.com/WebKit/WebKit/blob/main/LayoutTests/platform/mac/media/encrypted-media/fps-requestMediaKeySystemAccess.html).

The SDK’s [ready, initialization/error and autoplay events](https://developer.spotify.com/documentation/web-playback-sdk/reference) are the final capability check. Activation starts in the play gesture when the SDK is available. An unsupported DRM probe or failed SDK startup falls back to real Connect devices: matching phone, last used, active, then first unrestricted device; explicit device selection is respected. Transfer precedes Play. Spotify warns that ordering across player endpoints is not guaranteed, so the controller waits briefly between transfer and Play. [Transfer API](https://developer.spotify.com/documentation/web-api/reference/transfer-a-users-playback).

If no device exists, the chosen item remains loaded and Retry re-polls. On a subsequent visibility return, discovery is bounded to five attempts. No automatic app opening occurs. The control destination is always a real SDK or Connect device; there is no fallback that pretends Lift itself is producing audio.

## What was actually proven

Local server **http://localhost:5193**, cloud dev **giddy-goldfish-291**, real account already connected to both providers. A disposable workout and exercise/set rows were created only for this check and removed afterward. Original training history and WHOOP data were not edited. `SITE_URL` was temporarily changed for Google sign-in on this port, then restored to its original `http://localhost:3037` value.

- **Real Spotify SDK, desktop Chrome engine, 390px iPhone UA:** Khat played on `Lift · this browser`; capsule Next selected Sahiba; Web API confirmed playback and then Pause. This is real streamed playback, not proof of iPhone Safari.
- **Real Connect path, 360px iPhone UA:** the second controller’s EME method was deliberately made unavailable before mounting the route. No browser-player offer appeared. It played Khat remotely on the first tab’s real Spotify SDK device. Next reached Sahiba. After the acknowledgement fix, Play/Pause stayed synchronized without `NETWORK`. No native Spotify app was installed on the Mac; the remote target was another actual Connect SDK device.
- **Media Session:** all four action handlers registered. Invoking registered Next selected Tony Montana through real Connect, and Pause returned provider `playing: false` with page state paused. No physical headset/lock-screen buttons were tested.
- **Real no-device:** after unmounting the first SDK device, the devices endpoint returned `[]`. Choosing Khat rendered the inline prompt and Retry capsule. Retry stayed on `/workout`; no redirect or browser SDK offer appeared.
- **Real YouTube embed, 390px iPhone UA in Chrome:** Suni Suni played; the identical iframe survived opening/closing the sheet. Observed player time advanced from 56.212s to 56.744s across close. Capsule Next loaded Kante. Seeking Kante to its final second let its real ended event advance to TREAT ME SPECIAL in the same iframe.
- **Visibility branch test:** a deliberately injected hidden visibility event paused the real YouTube player and retained its iframe. This was an application-handler test, not a physical OS background/lock test.
- **Layout:** 48px capsule; 44px Retry and transport targets; exact 24px shift for an injected 24px safe area. With Spotify + RestStrip, toast offset 156px and main padding 210px (zero safe area). Discard bottom 578.5px was above capsule top 644px. YouTube’s iframe viewport measured 200×200, card bottom 258px and sheet panel top 268px while open. During editing, video bottom 322px cleared keypad top 463px; capsule count was zero.
- **Keypad:** at 390px, kg/reps/RIR tops `[463,463,463]`; at 360px, `[399,399,399]`. Both deltas **0px**. Explicit light music ink was `#171717`; reduced-motion capsule animation was `none`.

### Platform limits and proof boundaries

| Platform | Spotify audio destination | YouTube audio destination | Evidence here |
|---|---|---|---|
| iPhone Safari / installed PWA | Try supported DRM + SDK; if unavailable, controls stay in Lift but audio comes from an active Connect app/device. No device means Retry, no sound. | In-Lift iframe while foreground and visible; pauses on hidden visibility. | iPhone UA/layout and unavailable-DRM fault tested in Chrome. Actual Safari/PWA SDK, audio unlock and OS lock behavior **not tested**. |
| Android Chrome | Prefer Lift SDK after Widevine and ready succeed; Connect fallback otherwise. | In-Lift visible iframe; same explicit background-pause rule. | Runtime paths implemented and covered; **no actual Android device/emulator** playback or lock test. |
| Desktop Chrome | Lift’s own SDK audio, or another real Connect device. | In-Lift visible iframe. | **Real playback, controls and queue verified.** Mobile-sized desktop Chrome does not establish mobile OS support. |

T3 device listing repeatedly failed with `Could not communicate with device support`; required hub/agent versions were 0.15.3 / 0.21.25 while installed versions were 0.12.0 / 0.21.12. `device_open(platform: ios)` returned no devices. No Android emulator or adb CLI was present. A bounded simctl attempt produced no device list and was terminated. T3 browser snapshots timed out twice, so the logged-in Chrome session and requested Playwright workflow were used. No physical mobile playback claim is made.

## Automated checks

- `bun install`, `bun install --frozen-lockfile`: pass; dependencies and bun.lock unchanged.
- `bunx tsc --noEmit`: pass.
- `npx vite build`: pass; pre-existing CSS sourcemap warning remains.
- `bunx vitest run`: **24 tests pass**: 20 backend/WHOOP tests and four client capability/error/device-selection tests.
- `bunx convex dev --once --tail-logs disable --env-file /tmp/lift-music-fix-dev.env`: pass on **giddy-goldfish-291**, including final backend acknowledgement fix at 22:18:51 IST. Never pushed functions to prod.
- Copies of `/tmp/lift-e2e/{r1-check,r3-check,superset-check,dnd-check}.mjs` ran twice on **5193**. Copy-only changes selected the port, this worktree’s import helper and screenshot output. Originals and main checkout were not modified. R1, R3 and Dnd reported `ERRORS []`; superset creation changed count 0→1 with the expected pair. Back dismissal, Undo, set entry, double tap, Finish, pointer and keyboard swap all passed.

Screenshots are `screens/fix-*`: real SDK playing, remote Connect playing, capsule over RestStrip, no-device sheet/capsule, YouTube attached card and sheet docking, keypad at both widths, and explicit light/reduced-motion state. These are real-account Chrome captures; the unavailable-DRM scenario is labelled above.
