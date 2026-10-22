# Lift — design direction

Status: final research-backed implementation spec, 22 October 2026. Decisions below are Lift proposals, not claims about reference-app behavior. Read `findings.md` for the comparison and `screenshots.md` / `manifest.json` for evidence provenance.

## Product idea
**A quiet instrument for the next set.** Pure black, typographic hierarchy, one mint accent, ordinary lists, and unusually good numeric input. Show the minimum useful context for the current decision. The workout must feel faster than a notes app.

## Foundation tokens
```css
@import "tailwindcss";
@theme {
  --color-canvas: #000000;
  --color-surface: #101010;
  --color-raised: #191919;
  --color-pressed: #242424;
  --color-line: #262626;
  --color-ink: #F5F5F5;
  --color-muted: #A3A3A3;
  --color-subtle: #737373;
  --color-accent: #B8F4D0;
  --color-success: #75D99B;
  --color-pr: #E9C778;
  --color-warning: #F0B574;
  --color-danger: #FF8E8E;
  --font-sans: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
  --radius-control: 12px;
  --radius-panel: 20px;
  --radius-sheet: 28px;
}
```
Mint reads as calm forward motion, remains distinct from PR gold, and works against neutral black without the navy cast of the current app. Use it for the primary action, focused control, current day and active tab only. Filled mint controls use #07110B text. Success is semantic, with a check icon and text; never color alone. No gradients, luminous glows or tinted page backgrounds. Borders separate dense controls and overlay surfaces; do not outline every exercise or day.

System font first for native-feeling performance. Optional Google Fonts Inter variable with `font-display: swap`; avoid a second font. Large title 32/36, 650, -0.035em; screen title 24/29, 650, -0.025em; exercise title 19/25, 600, -0.015em; body 16/24, 400; control 16/20, 600; supporting 13/18, 450; metadata 12/16, 500. Set numbers 20/24, 600, `font-variant-numeric: tabular-nums lining-nums`. Body text >=16 in editable fields to avoid iOS zoom. Limit heavy weights to titles and values. Meaningful labels/previous hints/chart axes use muted #A3A3A3 or brighter; subtle #737373 is reserved for decorative or disabled content because it is insufficient for small meaningful text on some elevated surfaces. Line #262626 is decorative separation, not the only way to identify a control; inputs have filled surfaces, readable labels and a visible focus state.

Spacing: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px. Mobile gutter 20px (16px at <=360). Section gap 32px, exercise gap 24px, set rows 56px. Interactive target minimum 48×48px; primary button height 56px. Lucide icons 20px, stroke 1.75; 24px navigation icons. Always label bottom tabs. Content bottom padding includes fixed controls plus safe area.

## Navigation
Four tabs: Train, Library, Progress, History. Profile/settings through the top-right avatar or Settings icon. Train opens this week with today emphasized. Each tab preserves scroll and filter state. Exercise details push within the current tab. Back restores position. Live workout is a resumable full-screen route over tabs; minimize returns to a persistent "Workout in progress" bar. Do not let back discard work.

## Mobile screen layouts
### Train / week
```text
Lift                              [profile]
Thursday, Oct 22
This week                    [<] Oct 19 [>]
 M✓  T·  W✓  T●  F·  S·  S·

TODAY
Push
6 exercises · about 45 min
[                 Start workout         ]

YOUR WEEK
Mon   Upper                         ✓
Tue   Rest
Wed   Lower                         ✓
Thu   Push                       Today
Fri   Rest
Sat   Pull                          >
Sun   Lower                         >

[Train] [Library] [Progress] [History]
```
One today panel may use surface fill; week entries are borderless 64px rows with subtle dividers. No missed-day red warnings. Use "Not completed" in details if needed.

Screen chrome: 56px compact header, content begins 20px below it. The 32px large title may visually collapse into the compact header after its section scrolls away; keep the sticky header's footprint fixed so the list does not jump. Bottom bar is 64px plus `env(safe-area-inset-bottom)`, four equally sized labeled targets, black background and one decorative top hairline. Current tab uses mint icon + text, inactive tabs muted. Avoid floating glass behind the navigation during logging.

### Workout preview
Back / overflow → title, purpose and duration → muscle chips → ordered exercise list with sets × target reps and superset 1A/1B labels → sticky Start workout. Form thumbnails are optional small 48px squares, not repeated large hero cards. Start immediately creates a resumable session.

### Active workout — core screen
```text
[⌄] Push                    [Finish]
12:48 elapsed                 4 / 18 sets
────────────────────────────────────────
1A  Incline dumbbell press          [···]
3 × 8–12 · 2 reps in reserve     [form >]
SET           KG     REPS    RIR       ✓
1            22.5     10      2        ✓
             Last time 22.5 kg × 10
2           [22.5]   [10]    [—]      [✓]
             Last time 22.5 kg × 9
3           [22.5]   [  ]    [—]      [✓]
             Last time 22.5 kg × 8
              + Add set
│ Superset 1 · 3 rounds
1B  Chest-supported row             [···]
... set rows ...

[Rest 1:24  ━━━━━━━━━    +30s   Skip]
```
On all mobile widths, previous performance is a 13px second line; reveal a separate Previous column only when the actual table container is >=600px. Mobile grid: `24px minmax(64px,1.25fr) minmax(52px,1fr) minmax(48px,1fr) 48px`, column gap 8px; outer gutter 20px. Each numeric/check control is 48px high; total row height 76px including previous hint. At <=360px, gutter 16px and column gap 6px. Never shrink targets to squeeze columns. Effort cell uses short numeric RIR, with a clear "reps in reserve" explanation accessible from the header. Plan effort target is separate from actual logged effort. If text resizing makes the table too wide, switch to a stacked set editor rather than horizontal scrolling.

### Library / exercise detail
Library: title → persistent search → horizontally scrolling muscle chips → compact A–Z list; thumbnail, exercise name, equipment. Filter button opens sheet for equipment, muscles and favorites; selected count in badge. Empty search offers clear filters and create custom exercise.
Detail: name, equipment → form video poster + play (YouTube loaded on demand) → Form / History tabs → instructions + primary/secondary muscle anatomy → history chart with metric selector and dates → recent sessions. No auto-playing video in workout list.

### Finish / history / progress
Finish: "Workout complete" → duration, completed sets, volume → PR rows (if any) with prior → new value → exercises performed → Done. Share is secondary. Missing sets show a compact review sheet before finishing; offer finish with completed sets and keep training.
History: chronological date sections, session title, set count and duration; tap to full saved session with edit action. Exercise history presents actual session data, PR definition and chart unit; no fabricated trend before enough samples.
Progress: week selector → muscle coverage (direct/secondary set counts, stated counting method) → body-weight line with last reading/date → strength PR list. Body weight entry is a single numeric sheet. Empty progress says "Your first workout starts the story" and links to Train.

Coverage default: count completed working sets only; warm-ups are excluded. Show direct and secondary sets separately, rather than silently adding fractional secondary credits to a single total. A completed superset contributes its exercise sets independently. A bilateral exercise's programmed set is one set, not two. Targets come from the selected program or a user setting, not a universal "optimal" number. Label the view "This week" and its exact date range.

Body weight: display the most recent actual reading and date; plot actual dated samples with units and a 1M/3M/1Y range control. A straight segment between logged samples is not a daily inferred measurement. Do not color normal daily fluctuations red/green or imply that lower is always better. An optional smoothed trend must be separately labeled and explain its averaging window. Default v1 needs only the raw series and dated history.

PRs: label each record (heaviest weight, reps at this weight, estimated 1RM if supported) and show the prior value/date. Compare compatible exercise/equipment/load semantics and canonical units; never compare assistance load as if more assistance meant a stronger record. Exclude warm-ups by default. A first-ever entry can say "Starting benchmark"; it should not produce five artificial PR celebrations. For dumbbells, state whether weight means each dumbbell; retain that convention in previous hints, charts and total volume. Bodyweight exercises may use rep records rather than misleading kg volume.

### Onboarding / sign-in
One calm welcome screen with Continue, existing-account sign-in, concise data-sync benefit. Ask units, training days and program selection only when needed; one decision per screen with Back and retained answers. Avoid a long quiz before the user sees the schedule. Google sign-in button follows provider branding; email alternative, inline error, clear loading state. Never show a fake success before session confirmation.

## Set logging — implementation contract
1. Each set has stable identity, draft kg/reps/effort and completion status. Draft values auto-save locally on input; persistence status stays unobtrusive unless a failure needs action.
2. Prefill kg/reps from the corresponding previous session, with explicit previous-performance hint. Prefilled values are real editable drafts, not placeholder text. Do not silently copy effort. Support kg decimals, bodyweight, assistance and per-side exercise semantics.
3. Tap a kg/reps cell: select its whole value. Open a bottom numeric editor; keep exercise name, set number and currently edited values visible above it. Proposed editor has large 56px keys, decimal only for kg, backspace and Next. Provide native `inputmode="decimal"`/`numeric` as reliable fallback and external keyboard support.
4. Next goes kg → reps. From reps, the primary editor action is Log set; effort remains an optional separate control and is never an intervening mandatory modal. Tapping effort opens RIR choices 0,1,2,3,4,5+ with plain-language labels (0 = no more reps possible; 2 = could do two more); no ambiguous sad-to-happy scale. Reps required; weight rules depend on exercise type. Validate inline without shaking the entire screen. Store the effort scale with its value; never silently reinterpret imported RPE or emoji ratings as RIR.
5. Dedicated 48px trailing check is the completion target. Do not make the whole editable row complete a set. Swipe may expose delete, never the sole completion gesture. Completion atomically commits current drafts, updates set count and starts rest. Undo remains available for 5 seconds and tapping completed check reopens safely. Never require effort confirmation to complete.
6. After completion, maintain scroll anchor; use a short accent check transition, then a subdued completed row. Next set becomes focusable without automatically opening its keyboard or jumping the viewport.
7. Rest strip stays above keyboard/safe area with countdown, +30 seconds and Skip. Tapping countdown expands a sheet with presets and ±15/30 controls. Base countdown on a deadline timestamp, so tab sleep and route changes don't reset it. On expiry show "Rest complete" without modal interruption. Do not imply guaranteed background alarms on web.
8. Supersets share a slim left rail and label, never nested outlined cards. Preserve 1A/1B exercise identifiers everywhere. Default presentation is round-first: "Round 1" → compact 1A name + one set row → compact 1B name + one set row → "Round 2" and so on. This keeps paired work adjacent for one-handed use. Completed rounds stay visible but subdued; do not auto-collapse them under the user's finger. Order suggestion is A1 → B1 → rest → A2; after A completes, the bottom strip says "Next: 1B · Chest-supported row" with a Go action, without stealing keyboard focus. Default full rest after the round, configurable transition time between exercises. If B is blocked, allow any set to be logged; show next recommendation without enforcing it. Add round is the group action; individual Add set is available from exercise overflow when an uneven superset is intentional.
9. Add set sits below its exercise; duplicate last draft weight/reps, not completion/effort. Exercise overflow: history/form, replace, superset, reorder, remove. Add exercise is after the list. Removing logged data offers Undo. Reordering uses explicit handles in edit mode plus accessible Move up/down.
10. Finish stays top-right away from check buttons. Confirm only if there are unlogged planned sets; keep completed work even if network is offline. Errors preserve all entered values and offer retry.

### Numeric editor and rest stacking
The editor occupies one bottom layer, approximately 424px plus safe-area inset (and up to 44px for the rest accessory). It contains a 40px context header (exercise + set), a compact copy of the selected kg/reps/RIR controls, then a 3-column keypad with 56px keys and 8px gaps, plus a 56px action. Backspace has an accessible label. Decimal separator follows displayed locale; store a canonical numeric value. Kg permits decimals; reps permits integers only. A web custom keypad should use real buttons and an accessible input, not canvas text. The native keyboard remains the fallback for assistive technology and unsupported browsers. In landscape or short viewports, prefer native numeric entry or a two-column editor rather than scaling down keys.

When this editor is open, the rest strip becomes a 40–44px accessory inside its top edge; do not render a second fixed dock beneath or over it. On very short viewports the timer accessory collapses to a clock + remaining time while the expanded controls remain one tap away. With the native keyboard, anchor the accessory to the visual viewport and verify iOS Safari/Android Chrome behavior. The underlying workout scrolls just enough to expose the active row; restoring editor state must not reset page scroll. Honor browser zoom, safe-area inset and `100dvh`; never lock the entire document's scroll indefinitely after dismissing a sheet.

## Desktop >=1024px
At 1024–1279px use a 200px left sidebar (brand, four destinations, profile), 32px main gutters and one 680–760px logging table. Rest stays in a compact dock; form/history opens a sheet or detail route. At >=1280px use a 220px sidebar, max-width 1200px main area, 32px gutters, and add a 280px sticky context column (rest, next exercise, form/history) separated by 24px from the 680–760px table. The minimum three-column total is 1268px including gutters, so do not enable it at 1024px. Train keeps a week strip and selected-day content at smaller desktop widths; wider screens can show week list + selected-day detail, never seven tiny workout cards. Same set cells and completion interaction, no stretched phone UI. Numeric editor becomes anchored panel or direct native field entry; Enter advances, Shift+Enter goes back, Space activates a focused check only, Escape dismisses. Library can use list + exercise-detail panel when both are readable; Progress can use two columns with a larger chart. <=1023px retains mobile tabs, max-width 640px content; test 360,390,430,768,1024,1280,1440px.

## Motion / scrolling
Control press: 90ms ease-out to scale .98 (buttons only). Color/state: 120–160ms. Route push: 220ms `cubic-bezier(.22,1,.36,1)` with 12px translation and opacity; no global page scale. Sheet: 280ms same easing; optional spring stiffness 420, damping 38, mass 1 if a motion library already exists. Check glyph 160ms; PR icon 300ms once. Animate transform/opacity; avoid height transitions in long lists. Countdown digits update without roll animation. Preserve scroll through data changes and return navigation. Use `prefers-reduced-motion` to remove transforms/springs and cap fades at 80ms. No parallax, animated backgrounds, bouncing numbers or staggered set rows.

Use native scrolling and momentum; no JS scroll smoothing or scroll hijacking. Explicit Go-to-next-set can scroll smoothly over about 180–220ms, but ordinary completion must not move the page beneath the user's hand. Haptics are optional enhancement only; the visual response must fully communicate success. Completed rows lose filled input emphasis, values move to muted text and the check stays semantic green. Focused cells get a 2px mint ring. Do not use a full bright-green row wash.

## Component geometry / CSS sketch
```css
.set-grid {
  display: grid;
  grid-template-columns: 24px minmax(64px, 1.25fr) minmax(52px, 1fr) minmax(48px, 1fr) 48px;
  column-gap: 8px;
  align-items: center;
}
.set-input, .set-complete { min-height: 48px; border-radius: 12px; }
.set-input { background: var(--color-surface); font-variant-numeric: tabular-nums; }
.set-input:focus-visible, button:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px; }
.screen-content { padding: 20px 20px calc(88px + env(safe-area-inset-bottom)); }
.bottom-bar { padding-bottom: env(safe-area-inset-bottom); }
@media (max-width: 360px) { .set-grid { column-gap: 6px; } }
@media (prefers-reduced-motion: reduce) {
  .route-transition, .sheet-transition, .set-feedback { transform: none; transition-duration: 80ms; }
}
```
For the separate Previous column, change the grid at a container width of 600px; do not use the overall viewport width when a desktop sidebar has narrowed the table. Numeric input, check and previous hint must share one stable set identity. The selected/pressed state, optimistic completion and persistence error should never rearrange columns.

## State and performance details
Loading uses static placeholders with final layout geometry; no glowing shimmer across an entire workout. An empty exercise list provides Add exercise. Failed search preserves the query and offers Retry. A failed video shows the exercise instructions and an external YouTube link. An offline session uses local drafts and a small status affordance; show a clear recovery banner only if saving needs user action. Sheet dismissal returns focus to its trigger; Escape, Back and an explicit close action work. Drag handles have accessible move controls. Do not preload all YouTube players or anatomy animations; one lazy-loaded poster per detail is enough. Prefer CSS transitions and SVG/Lucide; no new animation or chart package solely for decoration.

## Ten signature details
1. Previous-session hint aligned to the exact corresponding set.
2. A completion check that responds immediately, then quietly settles.
3. Rest strip persists through navigation and app backgrounding.
4. No-scroll-jump keyboard editor with the current set always visible.
5. Superset rail shows the next exercise/round in one line.
6. Week strip shows completion through glyphs and weight, not seven colored boxes.
7. Form video opens at the exercise context and returns to the same scroll anchor.
8. PR gold appears only for a real, defined record and states previous → current.
9. Offline logging feels ordinary: drafts persist, sync recovery never erases a set.
10. Empty states have one useful action; no charts, badges or zeros pretending to be progress.

## Acceptance bar
One-handed: change prefilled reps and complete in <=3 deliberate taps after input. Reopening a session restores every draft and rest deadline. No overlay covers active field or completion control. All statuses have text/icon alternatives, focus rings and screen-reader names. Contrast and 200% text resizing must be verified on implementation. Keep animation dependencies optional; browser-native CSS and lightweight charts suffice.
