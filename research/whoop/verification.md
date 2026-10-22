# Verification log

- `npm install` encountered the existing @auth/core peer mismatch; `npm install --legacy-peer-deps` preserved current auth versions.
- `npx tsc --noEmit`: passed after implementation.
- `npm run build`: passed (existing CSS sourcemap warning).
- `npx vitest run`: 5 backend tests passed (ownership, state replay/expiry, IANA date mapping and sleep stages, overlap deduplication, refresh fencing/rotation).
- `npx convex dev --once --local-cloud-port 3220 --local-site-port 3221`: passed against this worktree's isolated project-local backend, without modifying the other checkout's running backend on 3210.
- Copies of `/tmp/lift-e2e/dnd-check.mjs` and `/tmp/lift-e2e/r3-check.mjs` ran at `http://localhost:3027`, with their import-script cwd changed to this worktree and their output redirected to `/tmp/lift-whoop-shots`. Originals untouched.
- Dnd: drag swapped Saturday/Friday, keyboard moved it back, row navigation passed, `ERRORS []`.
- R3: Undo available; Back dismissed move sheet, keypad and exercise sheet; close-then-Back returned home; `ERRORS []`.

These regression runs covered the disconnected state. Real-data connected, stale, pending and connected Arrange verification will be appended after OAuth setup.
