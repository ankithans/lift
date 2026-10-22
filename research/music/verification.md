# Music verification and handoff

22 October 2026. Branch `feature/music`, base `main` at `af58069`. No push, merge or production code deployment. Only this worktree was changed. The main checkout was read only to copy gitignored environment/history fixtures.

## Automated verification

- `bun install`; `bun install --frozen-lockfile`: pass. No dependency changes, no package-lock, existing bun.lock unchanged.
- `bunx tsc --noEmit`: pass.
- `npx vite build`: pass. Existing Vite CSS sourcemap warning remains.
- `bunx vitest run`: **18 tests pass** (11 music + 7 WHOOP).
- `bunx convex dev --once --tail-logs disable --env-file /tmp/lift-music-dev.env`: pass on **giddy-goldfish-291**, final functions ready 21:30 IST. Never targeted prod for a function push.

Music coverage: owner-only queries/actions/SDK token; token nonexposure; wrong-user and signed-out refusal; provider-bound single-use/expired OAuth state; disconnect during callback; redirect allowlist; single refresh lease; concurrent real action requests perform one mocked token refresh; rotated refresh persistence; absent refresh token preservation; uncertain refresh requires reconnect; token refresh 429 preserves credentials/releases lease and installs cooldown; cache ownership/expiry/disconnect fencing; provider 401/404/429; LM→LL fallback with provenance; unavailable videos; non-Premium control refusal; per-user budgets; token parsing.

## Existing regression scripts

Unmodified originals remain in `/tmp/lift-e2e/`. Copies `music-dnd-check.mjs`, `music-r1-check.mjs`, `music-r3-check.mjs`, `music-superset-check.mjs` ran at **http://localhost:3037**, against cloud dev. Copy-only edits changed port, screenshot output and import cwd. Their import helper calls the existing secret-protected `/admin` endpoint on dev because the deploy key cannot run internal functions. Dev's existing admin secret differed from the secrets.env production admin secret; the configured dev value was read privately and saved to Keychain, never replaced.

- Dnd: pointer swap, keyboard restore, row navigation; `ERRORS []`.
- R1: implausible-value warning, auto-advance, double-tap set behavior, finish; `ERRORS []`.
- R3: Undo; Back closes move sheet/keypad/exercise sheet; X then Back navigates home; `ERRORS []`.
- Superset: 0 → 1 group, Low Incline Dumbbell Press paired with Pec-Deck Machine Fly.
- Focused `music-ui-check.mjs`: music sheet Back dismissal; explicit light-theme music tokens; reduced motion; offline hides live music controls; header collapses in keypad. Keypad tops **[399,399,399]**, delta **0px**, `errors: []`.

Test accounts are isolated `*@local.test` accounts. Training data on the real account was not edited; an empty dev workout was opened for live music checks and removed afterward. WHOOP connections/readings and Train-home layout remain intact.

## Real accounts, not fixtures

Chrome, Google account `ankithans1947@gmail.com`, local app connected to cloud dev:

**Spotify:** email-code login succeeded; no password reset needed. Lift app created with Web API and Web Playback SDK, both dev/prod callbacks, Website and privacy link in its description. Requested account added to development-mode allowlist. Dashboard confirmed **Premium Individual**. OAuth consent returned `music=connected`; Settings showed Connected. Real Liked (50-item page), Top, Playlists and owned playlist items rendered. Recently played returned an honest empty list at verification. `Lift · this browser` SDK device appeared in the picker and transfer succeeded. Played **Khat**, Next → **Sahiba**, Previous → **Khat**, Pause verified. Played **My top tracks playlist** by context → **Garage**. Spotify controls acknowledge immediately and reconcile once after one second, because provider state can lag its write acknowledgment.

**YouTube:** Data API v3 enabled in `lift-512410`; both callbacks saved on existing Lift web client; separate `youtube.readonly` consent completed, including owner continuation through the expected unverified-app screen. Settings showed Connected. Real LM liked list, 5 playlists and My songs playlist items rendered. Played **Suni Suni** in the official visible IFrame, then advanced the queue to **TREAT ME SPECIAL** and verified playing. Kante encountered YouTube's “too many devices streaming on your plan” response; this is a provider restriction, not a Lift success state. The subsequent track played normally. The official player remains visible at **320×200 CSS px** on the 360px screen. Closing the sheet destroys/pauses it; reopening shows a paused player. No hidden/background audio workaround.

One IFrame transition race was reproduced and fixed: PAUSED from the old video during loadVideoById must not cancel the new skip. Final real playback/skip captures are in `screens/youtube-real-playing-360.png` and `screens/youtube-real-skipped-360.png`.

## Platform and release limits

- Spotify playback requires Premium. Non-Premium users can browse and follow Spotify links. New dev-mode apps permit only allowlisted users (dashboard limit 5). Some non-owned playlist contents may be inaccessible under the 2026 API rules; open/play context remains available when Spotify permits it.
- YouTube Data API is not a YouTube Music playback/library API. LM/LL may include non-music videos and omit Music-only data. No Top/Recent feature is invented for it.
- YouTube's visible player minimum and no-background rule are respected. iOS PWA screen lock/background suspends IFrame audio; use Open in YouTube Music. Ads, regional/embedding restrictions and simultaneous-stream limits remain provider controlled.
- Google sensitive scope remains unverified, as requested. Owner warning expected; no verification submission.
- Production code remains for the parent thread to merge/deploy. Dev/prod OAuth authorizations are separate; the real connections created here belong to dev.
- Host shell remains dark. Music additionally supports the host's explicit `data-theme="light"` token convention; this task does not add a new global theme preference.

## Credentials and deployment configuration — names only

macOS Keychain account `ankithans1947@gmail.com`:

- `spotify-lift-client-id`, `spotify-lift-client-secret`
- `youtube-lift-client-id`, `youtube-lift-client-secret` (reuse existing Lift web credentials)
- `lift-music-dev-admin` (existing dev admin secret, for isolated regression imports)

Both **ardent-butterfly-982** and **giddy-goldfish-291** have:

- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `SPOTIFY_APP_URL`
- `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`, `YOUTUBE_APP_URL`

Dev app URL and dev `SITE_URL`: `http://localhost:3037`. Production music app URLs: `https://lift.ankithans.com`. Redirects are each deployment's `/<provider>/callback` on its Convex `.site` origin. Deploy keys remain in `~/.config/lift/secrets.env`; no secrets committed. OAuth tokens live only in Convex tables; the owner-only SDK action is the access-token exception and stores nothing in browser storage.

## Screenshots

`screens/` includes disconnected and connected Settings, both real consent flows, Google warning, real Spotify liked/playing/playlists/device picker, YouTube liked/playing/skipped, disconnected music dark/light, offline and keypad collapse. These are actual browser captures. No synthetic non-Premium or revoked screenshot is presented as a real-account state; those negative paths are tested with convex-test.
