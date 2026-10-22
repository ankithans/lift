# Lift — findings by flow

Final research pass, 22 October 2026. **77 curated app-screen PNGs** accompany this file. Read `design-direction.md` for implementation decisions, `screenshots.md` for the complete linked index, and `research-log.md` for scope and limits. Exact collection URLs, screen URLs where recorded, original export names and crops are in `manifest.json`.

The strongest synthesis is **Hevy's set-table clarity + Bevel's numeric editing + Things' quiet hierarchy + Raycast's black-surface restraint**. Lift should express that through a neutral black canvas, generous targets and very little enclosing chrome. None of these references should be copied wholesale.

## 1. Weekly schedule / today

**Best references:** `ladder--week-today-strip.png`, `future--today-focus.png`, `things--dark-upcoming-sections.png`.

Ladder makes the week recognizable with a compact day strip and a dominant current workout. Future puts today's session ahead of secondary discovery. Things makes upcoming dates understandable through section headings and spacing. These work because they answer “what am I doing next?” before offering other choices.

The supplied Built With Science schedule repeatedly communicates state through colored borders, icons, status copy and overflow menus. Rest days carry nearly the same visual weight as training days. Keep its useful program → week → day structure, but reduce the repetition.

**For Lift:** one today panel and one Start action; future and completed sessions become quiet rows. A rest day is an ordinary part of the plan. Avoid a red “missed” wall and seven equally prominent outlined cards. The large title can collapse into a compact sticky header; this is a Lift proposal, not a behavior established by the static references.

## 2. Workout overview / preview

**Best references:** `ladder--workout-overview.png`, `nike-training-club--workout-preview.png`, `hevy--dark-routine-list.png`.

Ladder exposes exercise order, warm-up sections and estimated time with a bottom start action. Nike explains time, level, equipment and purpose before starting. Hevy shows the utility of an immediately actionable saved routine. The common strength is enough information to commit to a session without opening every exercise.

**For Lift:** workout name, concise purpose, estimated duration, target-muscle chips, then exercise names with sets × reps. Show 1A/1B in preview as well as logging. Use small optional thumbnails. Repeated hero photography and multiple Start buttons add little value to a prescribed strength program.

## 3. Active workout / set logging — highest priority

**Best references:** `hevy--active-workout-sets.png`, `bevel--active-workout-sets.png`, `bevel--completed-set-state.png`, `fitbod--active-set-keypad.png`.

Hevy's Set / Previous / KG / Reps / check table is the strongest functional reference. It reserves a Previous column beside the editable values; that adjacency should reduce memory work once history exists (a design inference—the selected first-session capture has little prior data). The supplied Built With Science screenshots also show the value of a corresponding per-row previous result. A separate check column distinguishes editing from completion. Bevel's idle and completed captures demonstrate distinct per-set states and rest information near the affected work. Fitbod keeps the currently edited set visible above the number keyboard.

`hevy--set-type-sheet.png` cleanly separates warm-up, normal, failure and drop sets. `bevel--rest-and-autofill-settings.png` exposes confirmation, rest and auto-fill policies without adding all those choices to each row.

**For Lift:** retain a continuous scrollable workout, separate 48px check targets and stable row identities. Previous performance moves to a quiet second line on mobile so kg/reps/effort stay easy to hit. Use a separate Previous column only in a sufficiently wide table. A checked set should settle into a subdued state rather than filling the whole row with bright green. Keep form/history one tap away.

**Gesture evidence:** the captures show check controls and changed states. They do not prove swipe-to-complete, tap-anywhere-to-check, exact tap count or haptic timing. Lift should complete with the dedicated check or explicit Log set action. Whole-row completion conflicts with editable fields; swipe is suitable for optional secondary actions, with a visible alternative.

## 4. Supersets / circuits

**Best references:** `hevy--superset-group.png`, `fitbod--superset-preview.png`, `bevel--superset-rail.png`.

Hevy associates exercises through a colored label and rail. Fitbod makes the number of rounds explicit. Bevel uses a shared enclosure/link cue. All three communicate a relationship better than leaving two adjacent exercises unrelated, but repeated badges and nested borders increase clutter.

**For Lift:** a single slim rail, explicit 1A/1B identifiers and a round label. Present each round's A/B sets next to each other, so moving through a superset does not require scrolling past all A sets to find B. Recommend A1 → B1 → rest → A2 without enforcing it. The next-exercise cue should be readable in one line. Full rest normally begins after the round; transition time between exercises is a separate setting. This round-first presentation is the proposed synthesis, not a claim that a saved reference implements it exactly.

## 5. Number entry / effort

**Best references:** `hevy--numeric-keypad.png`, `bevel--workout-keypad.png`, `bevel--weight-editor.png`, `cash-app--large-numeric-keypad.png`, `macrofactor--weight-entry-sheet.png`.

Hevy shows a native-style number keyboard with a calculator accessory while the table remains visible. Bevel's custom keypad supplies an explicit advance action and utility keys. Its simple weight editor makes units clear. Cash App demonstrates the value of large, widely separated keys and a dominant entered number. MacroFactor's dated weight sheet keeps entry narrow and purposeful.

**For Lift:** select the existing value on focus, preserve kg/reps context, and use large keys. Kg allows decimals; reps allows integers. Next moves kg → reps; Log set is available from reps, while effort remains optional. Keep a native input fallback, external-keyboard support and readable focus state. A custom keypad must earn its place through fewer errors and better context, not visual novelty. Avoid a calculator or plate-management gate in ordinary logging.

`bevel--session-effort.png` is a whole-workout 1–10 perceived-effort dial. It should not be confused with per-set effort. Lift's proposed per-set control is RIR with plain-language choices; imported RPE/emoji scores must retain their original scale.

## 6. Rest timer

**Best references:** `hevy--inline-rest-timer.png`, `hevy--rest-duration-sheet.png`, `ladder--rest-countdown.png`, `opal--timer-controls.png`.

Hevy's bottom timer is the most transferable pattern: countdown, quick adjustment and Skip while the exercise list remains accessible. Configuration lives in a separate sheet. Ladder's large numerals are easy to glance at. Opal separates minus, duration and plus clearly, although its visual treatment is heavier than Lift needs. `fitbod--rest-sheet.png` and `peloton-strength--active-workout-timer.png` provide alternative floating/timer-led arrangements; the latter sacrifices table space to video.

**For Lift:** a persistent compact rest strip, expandable on tap, with +30s and Skip. It becomes an accessory inside the numeric editor when that editor is open, so two fixed layers never overlap. Countdown uses a deadline timestamp; expiry changes to “Rest complete” without a blocking modal. Background durability is an implementation requirement to verify, not something inferred from screenshots.

`hevy--lockscreen-rest-timer.png` is an iOS Live Activity reference. It is not a web capability promised for Lift. Keep visual feedback sufficient without requiring native haptics or background alarms.

## 7. Finish / summary / PR celebration

**Best references:** `bevel--finish-summary.png`, `fitbod--finish-record-summary.png`, `cash-app--quiet-success.png`, `hevy--finish-summary.png`.

Bevel presents completed work with totals, exercise rows and a clear Done action; template update is a separate choice. Fitbod names the records earned. Cash App's single check and outcome text demonstrate how little decoration is needed to make completion feel definitive. Hevy is more share-first; useful as an optional export reference, less suitable as the primary ending for Lift.

**For Lift:** Workout complete → duration/sets/volume → true PR rows showing previous → current → completed exercises → Done. Gold is reserved for real records. A first workout establishes a benchmark instead of generating several artificial PRs. Missing planned sets warrant a compact review choice; ordinary successful completion does not need another confirmation. Saving the session must not silently edit the program template. No compulsory photo, rating or social-sharing gate.

## 8. Exercise library / search / filters

**Best references:** `hevy--library-search.png`, `hevy--muscle-filter-sheet.png`, `bevel--muscle-filter-sheet.png`, `oura-android--library-filter-chips.png`.

Hevy combines search, equipment and muscle filters with selectable rows and a sticky selected-count action. Anatomical thumbnails help distinguish muscle names. Bevel clearly supports multiple muscle selections before applying them. Oura Android demonstrates category chips above a compact list. `hevy--program-filter-sheet.png` is useful for grouping several filter dimensions behind one Apply action.

**For Lift:** search stays easy to reach; muscle chips handle common filtering; equipment and additional choices live in a sheet. Preserve selected exercises and counts while queries or filters change. Use visible selected states and Clear filters. An empty result should offer a specific recovery action or custom exercise creation, not an illustration with no next step. Avoid full-screen navigation for every filter dimension.

## 9. Exercise detail / form / anatomy

**Best references:** `hevy--exercise-detail-chart.png`, `fitbod--exercise-muscle-anatomy.png`, `nike-training-club--active-form-guidance.png`.

Hevy places the exercise, primary/secondary muscles and metric chart in one context. Fitbod makes the distinction between primary and secondary targets explicit. Nike's demo and next-exercise list make form guidance easy to understand.

**For Lift:** a video poster with an explicit Play action, short technique instructions, and front/back anatomy with a textual muscle legend. Load YouTube only when requested. Keep the exercise's history in the same detail context, with Form / History switching. Video should return the user to the same set/scroll position. Do not autoplay form demos inside every exercise row or use anatomy color as the sole explanation.

## 10. Exercise history / PRs / charts

**Best references:** `hevy--exercise-history-sets.png`, `hevy--personal-records.png`, `fitbod--exercise-record-chart.png`, `ladder--exercise-journal.png`.

A trend is more trustworthy when the underlying dated sets can be inspected. Hevy makes both available and distinguishes heaviest weight, estimated 1RM, set volume and session volume. Ladder's journal is a restrained numerical record. Fitbod gives an exercise its own chart and achievements rather than burying them in a global dashboard.

**For Lift:** one metric at a time, explicit units and date range, visible points and a dated session list below. PR labels must state the metric and load semantics. `hevy--empty-exercise-history.png` is a useful honest empty state: no trend until there is actual history. Never invent a rising line or use tiny unlabeled sparklines as the only evidence.

## 11. Progress / weekly muscle coverage / body weight

**Best references:** `hevy--weekly-muscle-anatomy.png`, `hevy--muscle-distribution.png`, `hevy--bodyweight-history.png`, `macrofactor--scale-weight-chart.png`, `macrofactor--weight-entry-sheet.png`.

Hevy connects muscle coverage with explicit set counts; the body map helps orientation, while a numeric list makes comparisons possible. Its radar chart is less precise for comparing individual muscles than horizontal bars. MacroFactor pairs a time-range chart with dated measurements and an edit sheet. `macrofactor--dark-dashboard.png` shows measured use of small metric modules on a dark canvas.

`gentler-streak--rest-day-tone.png` treats rest as part of training instead of failure. `gentler-streak--activity-history-chart.png` separates period selection, summary and history. `future--consistency-calendar.png` makes consistency inspectable across dates. These are useful tone/layout references; Lift should not infer health recommendations from a calendar or borrow unrelated recovery scores.

`oura-android--dark-metric-detail.png` demonstrates metrics and charts directly on black without enclosing every one in a card. `whoop--metric-breakdown.png` is useful for one main metric plus named contributors; `whoop--today-dashboard.png` is a contrast reference where health, calibration, promotion and AI compete for attention. `hevy--dark-workout-summary.png` links completed work back to muscle distribution.

**For Lift:** this week's direct/secondary sets, clear counting rules, then actual body-weight readings and strength records. Lead with a readable coverage list; anatomy is supporting context. Never color ordinary weight fluctuations as moral success/failure. Separate raw readings from any labeled smoothed trend. Empty progress has one action: start/log the first relevant activity.

## 12. Onboarding / sign-in

**Best references:** `raycast--black-sign-in.png`, `oura-android--sign-in.png`.

Raycast's black sign-in is the strongest restrained visual reference: small title, clear fields, one primary action, recognizable alternatives. Oura Android similarly uses a focused form and bottom action. Both make a useful contrast with long fitness questionnaires, multiple promotional screens or permission requests before the user sees value.

**For Lift:** calm welcome, clear sync benefit, Continue and existing-user sign-in. Ask units and program/day preferences when needed; retain answers on Back. Keep Google branding correct and errors beside the relevant field. No fake successful state while authentication is still pending. A compact contextual hint at first logging is more useful than a long mandatory tour.

## 13. Bottom tabs / sheets / empty states / navigation

**Best references:** `raycast--dark-home.png`, `raycast--dark-settings-sheet.png`, `raycast--dark-keyboard-context.png`, `linear-mobile--filter-sheet.png`, `opal--contextual-sheet.png`, `future--active-context-sheet.png`.

Raised sheets preserve a sense of place while a narrow decision is made. Raycast demonstrates context above keyboard entry. Future keeps the current exercise's controls in a sheet over the session. Opal anchors actions to the affected item; its stone/glass/glow treatment is deliberately outside Lift's direction.

`linear-mobile--borderless-inbox.png` and `linear-mobile--grouped-list.png` demonstrate hierarchy through type, spacing and tiny status glyphs. Its icon-only floating navigation is less suitable for Lift; keep four labeled destinations. `things--dark-today-list.png` shows an especially quiet today/this-evening grouping. Its captured blue-gray palette is not the target black palette.

**For Lift:** Train, Library, Progress, History; preserve each tab's state. A live workout is resumable after minimizing: `ladder--resume-workout-dock.png` is the clearest reference. Sheets need an explicit close control and predictable Back/Escape behavior; swiping down can supplement these. Static screenshots do not establish a drag threshold, spring or gesture contract.

## 14. Desktop and Android adaptation

**Best desktop references:** `linear-web--detail-context-panel.png`, `linear-web--split-inbox.png`, `linear-web--list-density.png`.

Linear separates stable navigation, constrained primary content and a context/properties column. List/detail continuity avoids repeated full-page navigation. Dense rows use group headings and rhythm instead of independent cards. These are light-themed desktop screenshots: borrow structure, not colors.

**For Lift at >=1024px:** a sidebar and constrained 680–760px workout table. Add the roughly 280px rest/form/history context panel only at >=1280px; use a compact dock/sheet below that. Library can use list/detail and progress can use two columns when readable. Never stretch a phone-sized set row across the entire display. At intermediate widths retain the mobile navigation and a constrained content column.

Android Oura proves that useful metrics, library chips and a workout summary can remain legible on black: `oura-android--workout-summary.png` is especially useful. The Android capture is December 2023 while the selected iOS Oura capture is August 2026. Platform differences and redesigns are confounded. No particular breakpoint, sticky rule or responsive behavior is proven by these static captures.

Web searches for Hevy and Strava surfaced iOS collections but no web-app collection in the returned suggestions. That is not evidence their web products do not exist. See `research-log.md` for the bounded catalog checks.

## 15. Motion and craft decisions

The screenshots establish visible hierarchy and control states. They do not independently prove animation duration, haptic behavior, swipe-to-complete, offline persistence or background-timer behavior. Lift's proposed motion values and durability requirements are specified in `design-direction.md` and need implementation verification.

The most useful “world-class” details are functional: no lost draft, no scroll jump, no hidden completion target, corresponding previous-set hints, a timer that survives navigation, deliberate empty states, and a clear return from form video. Add a short check transition and one quiet PR response. Avoid app-wide blur, neon glows, constant shimmer, bouncing numerals, parallax or forced celebrations.
