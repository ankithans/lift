# Verification log

## Automated checks

- `npm install --legacy-peer-deps` preserved current auth versions after the existing @auth/core peer mismatch.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; existing CSS sourcemap warning remains.
- `npx vitest run`: all **7 tests passed**. Coverage: user ownership and token nonexposure; single-use/expired OAuth state; IANA timezone/DST and actual sleep stages; pending scores remain absent; strength overlap deduplication; overlapping week/today fetches do not duplicate activities; refresh fencing and atomic rotation; webhook signature integrity/age; v2 recovery sleep UUID delivery deduplication and owner-scoped deletion.
- Isolated `convex dev --once` passed on this worktree's backend (3220/3221). Main checkout backend (3210) was not modified.
- `npx convex dev --once --tail-logs disable --env-file /tmp/lift-whoop-dev.env`: passed on cloud dev after disabling unavailable log tailing.
- Cloud dev functions pushed successfully using the dev deploy key and `npx convex deploy -y --env-file /tmp/lift-whoop-dev.env`. CLI output explicitly classified `[Development]` / `giddy-goldfish-291`. This is not a production deployment. The deploy key lacks log-view and internal-function-run permissions; existing authenticated `/admin` operations were used for narrow diagnostics.
- Live dev webhook HTTP checks: valid HMAC -> 204; altered body -> 401; expired timestamp -> 401. Unknown WHOOP user used, so no member data was changed.

## Existing regression scripts

Copies of `/tmp/lift-e2e/dnd-check.mjs` and `r3-check.mjs` ran against this worktree's isolated local backend and app at `http://localhost:3027`. Import cwd changed to this worktree and screenshot output redirected to `/tmp/lift-whoop-shots`; originals untouched.

- Dnd: pointer drag swapped Saturday/Friday, keyboard restored it, row navigation passed, `ERRORS []`.
- R3: Undo available; Back dismissed move sheet, keypad and exercise sheet; close-then-Back returned home; `ERRORS []`.

## Real WHOOP end to end

Local app `http://localhost:3027` was then restarted against cloud dev. Google sign-in, WHOOP authorization-code callback, profile lookup and paginated backfill all completed for the requested account. Counts: **61 cycles, 60 recoveries, 68 sleeps, 56 workouts**. Sanitized evidence is in `sync-verification.json`.

Real current-day readings rendered: recovery 44%, HRV 43 ms, RHR 73 bpm, sleep performance 81%, sleep 6h 53, day strain 7.2 so far. The displayed week's averages were 66% recovery, 9.7 strain and 6h 41 sleep.

The authenticated operator `whoopRefresh` action forced expiry and queued refresh. `refreshCount` advanced 0 -> 1; `refreshedAt` was written and `lastSyncedAt` advanced after a successful incremental sync. The replacement access/refresh tokens remained server-side.

Connected interaction checks at **360 × 900**:

- Seven rows measured 76px each, both normal and Arrange. Date-row metrics and activity controls were absent while arranging. The summary stays in place.
- Pointer drag used a 76px slot and swapped Saturday/Friday. ArrowDown restored it.
- Enter on a handle opened the shared move sheet; choosing Friday moved Thursday's Push workout. Thursday's recovery/strain/sleep remained on Thursday. Restored original plan after the check.
- Real activity disclosure showed duration, strain, avg/max HR, kJ and heart rate zones.
- Offline emulation retained real saved readings, showed an offline/stale label, disabled live sync and suppressed training advice. Network restored afterward.
- Reduced-motion preference was exercised; no new motion is needed to read the data.

## Screenshots

All images are in `screens/`.

- `home-disconnected-dev-360.png`: disconnected cloud-dev account, quiet connect row.
- `whoop-app-configuration.png`: app creation form, before credentials existed.
- `whoop-oauth-consent-360.png`: actual consent screen.
- `home-real-connected-360.png`, `week-real-connected-360.png`: real data, 360px home and week.
- `today-real-details-360.png`: real recovery and metric detail sheet.
- `activity-real-details-360.png`: real workout disclosure.
- `arrange-real-connected-360.png`: connected Arrange, hidden metric lines and uniform rows.
- `home-real-offline-360.png`: real cached readings and offline marker.
- `home-real-syncing-360.png`: captured immediately after OAuth; backfill completed quickly, so this capture is not proof of a visible pending score.
- Earlier 412px disconnected/drag captures are retained alongside account-recovery and API-Terms setup evidence.

No real pending or unscorable score was encountered in the current displayed week. Those states are implemented with absent metrics/dashes and covered by normalization tests; the screenshots do not misrepresent a synthetic score as real data.
