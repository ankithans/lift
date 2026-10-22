# Lift R2 — less to read, more confidence

22 October 2026. First implementation handoff: Train, preview, day swap, input and PR. This is a design specification; no product code is edited. Measurements are CSS px at 412×915, independent of screenshot pixel density. R2 supersedes R1 where they conflict. Inter throughout, Lucide icons, pure black, mint #B8F4D0, record gold #E9C778.

## Design contract

Wireframes use a Monday-start example,19–25 Oct2026. Preserve the user's chosen week start; the supplied Sunday-start week is18–24 Oct. Do not silently change that preference.

One primary decision per view. One filled primary action. One line of supporting information per ordinary list row. Put explanations at the point of request. A card earns a fill only by grouping controls or distinguishing the next action. Empty space is deliberate. Do not fill it with another metric.

Tokens: canvas #000; surface #101010; raised #1A1A1A; separators #262626; text #F5F5F5; secondary #A3A3A3. Title 32/36 weight 650, screen section 18/24 weight 600, row 16/22 weight 550, supporting 13/18 weight 400, label 12/16 weight 500. Gutter 20; section gap 28–32; internal gap 8/12/16; buttons 52 high; targets >=48; sheet radius 28; cards radius 20. Do not uppercase every section. No new gradients or ambient glows.

## 03 — Train: a today page with a useful week

### Problems

In `03-train.png`, “Evening, Ankit” is the largest element, although Push is the reason to open the screen. “Today is Push · 6 exercises · ~40 min” and Start Push repeat the highlighted Thursday Push row and its second Start button. Completed Monday/Wednesday show minutes, sets AND kg in a scheduling list. Rest has footsteps, text and a full-height slot. Drag grips appear on every day before the user wants to edit. The bottom drag instruction competes with/extends behind the tab bar. The week header omits the actual date range. These make the app a calendar to decipher before it is a training tool.

### References

- `train--future--today-focus.png`: one obvious next workout; reject its oversized promotional imagery.
- `train--ladder--week-today-strip.png`: week context adjacent to a daily focus; reject stacked secondary promotions.
- `train--things--dark-today-list.png`: quiet groups and strong row alignment.
- `train--gentler-streak--rest-day-tone.png`: rest is a valid state.
- `train--macrofactor--dark-dashboard.png`: readable dark metric hierarchy; use a single small metric here.
- `train--whoop--today-dashboard.png`: useful contrast evidence—several simultaneous scores demand too many decisions.

### Proposal, exact top-to-bottom

```text
Thu, 22 Oct                         [avatar]
Train

Today
Push
6 exercises · about 40 min
[              Start Push                ]

This week                 2 of 5 sessions
19–25 Oct                        [‹] [›]
Mon 19    Upper                        ✓
Tue 20    Rest
Wed 21    Lower · Quad focus            ✓
Thu 22    Push                      Today
Fri 23    Rest
Sat 24    Pull                          ›
Sun 25    Lower · Glute focus           ›
                            [Arrange week]

Last session                          ›
Lower · Wed 21 Oct             50 min

Train      Library      Progress     History
```

Header: date 13/18 secondary, then Train 32/36. Avatar 48 target. Gap 28 to Today 13/18. Push 28/34 600, support 14/20, gap 16 to full-width 52 mint button. Group sits directly on black; do not enclose another huge card. Gap 32 to week. Week summary 13/18 right aligned; show actual completed/planned training sessions, not days active. No ring: seven date rows already express the schedule; a separate ring adds an extra encoding without an extra decision. Week rows 56 high, day/date rail 56 wide, title 16/22; completed check 18, no “Done”. Today uses mint date and a 12/16 Today label, no second CTA or outlined row. Rest rows remain 56 so drag slots have stable geometry but use secondary ink. Long titles wrap to two lines with 72px row when text size requires it; “Quad focus” can become a second line. The 412px example has enough space for the primary action and most of the week; Last session is deliberately below the first viewport. Do not compress rows to force everything on screen.

Last session is exactly one tappable 64px row: title, date, duration. No exercise collage, volume or record count. It deep-links to that saved session. It is omitted until one session exists. Arrange week is a 48px secondary text target after the list. Program name moves to the Train overflow or week header tap; no program marketing on this page.

### Which modules earn home space

| Candidate | Decision | Exact destination / reason |
|---|---|---|
| Today / resume | Always, first | One action reduces time to start. Active session replaces Start; no second resume dock on Train. |
| Week consistency | Always, inline `2 of 5 sessions` | Already collected, meaningful against the user's schedule. No separate ring/card. |
| Last session | One compact row below week | Useful memory and edit shortcut. Hide after opening a past week. |
| Daily streak | Cut from home | Rest days break the metaphor. Optional weekly consistency lives in Progress. |
| Next PR to chase | In the exercise logger/history | A target needs current exercise and rep range. Do not prescribe an unsafe load from an isolated dashboard record. |
| Body-weight quick log | Progress title action | Weight is optional and unrelated to starting today's workout. Optional user-pinned shortcut could replace Last session later, never add a fourth module. |
| Recovery / freshness | Cut in v1 | No sensor/readiness inputs establish a trustworthy recovery score. Weekly sets are workload, not recovery. |
| Coach note | Only an explicit, dated program note | Put behind today's title tap; no invented AI encouragement or empty note card. |

Today states: rest → “Rest day” 28/34, “Next: Pull · Saturday” support, secondary View workout action; do not promote streak anxiety. Done → “Push complete” with check and View session outline button, same footprint. Active → “Push in progress” and Resume, timer support; hide global dock here. No program → one Set up your week CTA. Past/future week browsing keeps today's hero stable only for current week; other weeks show the date range and list, with Return to today. No historical schedule edit masquerading as workout-history edit.

### Interaction / motion

Start provides pressed feedback immediately, loading after 150ms if needed, then enters session. Tapping day title previews; tapping completed day opens history. Arrange enters an explicit edit state, reveals handles, replaces week summary with “Drag a workout onto another day”, and provides Done. No teaching copy in normal mode. Use swap contract below. Preserve scroll through week changes; no list entrance stagger.

## Week swapping — visible, causal feedback

### References

`reorder--hevy--routine-before.png` / `reorder--hevy--routine-after.png`: explicit handles and before/after order. `reorder--streaks--arrange-before.png` / `reorder--streaks--arrange-after.png`: a named arrange mode distinct from everyday use. `reorder--todoist--move-destination.png` and `reorder--things-3--move-destination.png`: accessible destination selection. `toast--todoist--completion-and-undo.png`: Undo remains adjacent to the outcome. Static captures cannot prove pickup/drop animation.

Static references establish hierarchy, not timing or haptics. All timing below is Lift's proposed contract. Existing code has swap/settle machinery; this specification strengthens the visible causal chain without changing semantics. Dates remain anchored; only future planned workout/rest contents swap. A saved session never moves with its planned template.

```text
BEFORE                  DRAG OVER SAT          AFTER
Thu 22 [Push      ⠿]    Thu 22 [ghost Push]    Thu 22 [Pull      ⠿]
Fri 23 [Rest      ⠿]    Fri 23  Rest           Fri 23  Rest
Sat 24 [Pull      ⠿]    Sat 24 [Swap with Pull] Sat 24 [Push      ⠿]
                         [floating Push]
Toast: Push ↔ Pull swapped                  Undo
```

1. **Enter arrange:** handles appear in 120ms fade, one short instruction replaces summary. Rows keep their existing dimensions. Tap a handle may open accessible “Swap with day” list; drag remains optional.
2. **Pick up:** handle drag starts after 6px travel; long-press anywhere on an editable workout can activate after 300ms with <8px travel. Page scroll continues normally until activation. In 100ms the workout content scales to 1.025, translates -2px, gets surface #1A1A1A, a 1px white/16% edge and soft `0 8px 24px #0008` shadow. Date rail stays put. Origin retains a dashed 1px #464646 ghost slot with the title at 35% opacity. Optional light haptic once.
3. **Hover target:** use the dragged center crossing target midpoint with 8px hysteresis. Eligible slot gets 1px mint/65% outline and 6% mint fill. Its title stays legible and label becomes “Swap with Pull”. Source ghost stays visible. Floating object says “Push → Sat 24”. Do not shift every intervening row: this is a two-slot swap, not an insertion reorder. Optional single selection haptic on entering a new target; none on every pointer move.
4. **Release:** commit the pair atomically to local UI. Push travels to Sat and Pull travels to Thu along their direct vertical paths over 220ms `cubic-bezier(.22,1,.36,1)`. Clip neither moving row. Keep dates fixed. Releasing over origin/outside target cancels with 160ms return, no toast. Dropping on rest swaps the workout with rest; label outcome “Push moved to Friday”. Past/done/active slots are visibly disabled in arrange mode with a lock and one accessible reason; no flashing error after drop.
5. **Settle:** scale 1.025→1 over 140ms, no bounce overshoot. Both changed slots retain a 1px mint/45% edge for 700ms then fade over 300ms. Optional success haptic once after local commit. This outline is the durable visual evidence missing from a silent reorder.
6. **Confirm:** toast sits above tab bar/dock: “Push ↔ Pull swapped” and Undo for 6 seconds. Screen reader announces “Push moved to Saturday. Pull moved to Thursday. Undo available.” The toast must name both results; generic “Updated” is insufficient.
7. **Persist:** small saving state only in arrange header if request takes >600ms. On failure animate both items back in 180ms; toast “Couldn't save. Week restored. Retry”. Undo reverses the exact last transaction and remains available after arrange closes. An incoming server refresh must not snap away an optimistic drag. If a second move occurs, supersede old undo with the newest complete transaction. Respect concurrent edits by checking schedule version before restoring; explain conflict rather than overwriting newer work.

Keyboard/screen reader: handle label “Move Push, Thursday”; Enter opens swap-day list, arrow through eligible days, Enter swaps, Escape cancels. Focus follows the moved workout's handle. Reduced motion: no scale/path animation, immediate exchange plus 700ms outline and toast. Web vibration is optional and unsupported on some devices; never claim universal iOS haptics.

## 04 — Upcoming day preview

### Problems

`04-day-preview.png`: the target-muscle percentage bar and three percentage labels precede the actual workout. Each exercise then has three dense lines: name, sets/reps/rest and every last-session set plus a date. The user must parse weights from a prior workout before deciding to begin this one. Six bright thumbnails create competing visual anchors; the fixed action and persistent tab bar consume two navigation layers.

### References

`preview--ladder--workout-overview.png` (identity before contents), `preview--nike-training-club--workout-preview.png` (clear single start), `preview--fitbod--superset-preview.png` (paired exercise relationship). Keep the useful hierarchy, cut their media or promotional bulk.

### Proposal

```text
[‹]                                  [···]
Saturday, 24 Oct
Pull
6 exercises · about 40 min

01  [40px] Pull-ups                   ›
             3 × 6–10
02  [40px] Lat-focused cable row      ›
             3 × 10–15
03  [40px] Reverse pec deck           ›
             3 × 10–15
04  [40px] Incline dumbbell curl      ›
             3 × 8–12
05  [40px] Hammer curl                ›
             3 × 8–12
06  [40px] Standing face pull         ›
             2 × 12–15

[               Start Pull               ]
```

56px top bar; date 13/18 then title 32/36 with 8px gap to 14/20 support. 28px gap to list. Rows min 76px with 40px neutral-backed thumbnail, 12px gap, 16/22 medium name (wrap, never truncate identity), 13/18 secondary prescription. Small row ordinal 12/16 optional only if no superset label; do not show both 01 and 1A. 1A/1B and a 1px neutral rail express a superset; its header says “Superset · 3 rounds” once. Six rows plus header may scroll above the 52px Start dock. Start dock is black with 16 top / 20 horizontal padding plus safe area. This is a pushed task route: hide tab bar here; back returns to Train. If shell cannot hide tabs in first implementation, retain them temporarily and position action above with full content inset; never overlap.

Cut muscle distribution, total set count, per-exercise rest and last-set strings from default. Muscle emphasis and total sets go in overflow → Workout details (plain rows). Tapping an exercise opens form/history sheet; plan prescription and rest appear below its title there. Program editing lives in overflow → Edit workout, replacing unlabeled pencil. This retains useful information without asking everyone to read it.

### Interaction / motion

Back restores Train position. Start enters resumable logger. If a session is active, single Resume {session} action replaces Start; explain different-workout identity above it with one line. Do not silently replace an active session. Overflow Edit opens this exact day in program editor. No animated percentage bars. Sheet returns to same exercise row.

## 05–08 — Live logging, keypad and PR/rest

### Problems

`05-workout.png` shows the full six-exercise stack; its fundamentals are good. Do not redesign the workflow. `06-keypad-weight.png` has a tall numeric panel; `07-keypad-rir.png` collapses it into a much shorter panel, pulling the header and current values downward. The RIR explanation and per-option captions add text exactly when attention should stay on the choice. `08-workout-pr-rest.png` has a gold toast over the exercise heading and a tiny trophy above set 1; the record's durable state is easy to miss, and bold values are indistinguishable from ordinary completed sets. The bottom rest panel also adds a second Next line.

### References

`logging--hevy--active-workout-sets.png`, `logging--bevel--completed-set-state.png`, `logging--fitbod--active-set-keypad.png`, `logging--ladder--set-logging-keypad.png`; records: `pr--fitbod--finish-record-summary.png`, `pr--hevy--personal-records.png`, `pr--fitbod--exercise-record-chart.png`. Record references demonstrate explicit recognition/metric naming; they do not prove inline gold animation. Lift's treatment below is original.

### Proposal: retain the logger

Keep current column order and general exercise card geometry for the first implementation. Reduce repeated trophy+best-set line under every exercise to the target rep range only. Historical best moves to info/history. Use 18/24 600 exercise names, support 13/18. Set values 20/24 500 tabular (no italic drafts; prefill is a real draft). Completed values stay 500, not suddenly bold. Every input and completion target >=48. Add set and rest-duration sit in one 48px footer. Exercise cards use #101010 and 20 radius with 16 padding and 16 gap; no nested completed-row card except focused/PR state. Avoid structural column churn while improving the parts the owner called out.

### Fixed-height RIR editor

Reserve exactly **392px + safe-area** for the editor body at 412×915, plus a **40px rest accessory only while rest is running**. Its top edge and all header/control positions stay identical across kg, reps and RIR. Structure: 44px context header + 72px current-values strip + 260px input area + 16px bottom spacing; safe area after. In numeric mode use 4 rows of 56px keys, 8px gaps; action occupies the right column as current UI. RIR mode **replaces** that same 260px input area, never adds/removes an explanatory row. Six 48px choices `0 1 2 3 4 5+` in one row (52px wide, 8px gaps = 352px), positioned 16px from its top, then deliberate empty space, with Skip and Log set anchored at the bottom 56px row. At 360px use a 3×2 grid of 48px choices; editor footprint unchanged. `0` can be labeled `0` with accessible name “0, no reps remaining”; no visible “Failure”, “easy” or caption text. Remove “Reps in reserve — how many more…” completely. A one-time help affordance belongs in the RIR column header, outside the keypad. Selecting a value does not auto-log. Reps → Log set; effort stays optional.

```text
SAME TOP EDGE: kg / reps / RIR
Exercise · Set 1 of 3             [⌄]
[ KG 20 ]    [ REPS 13 ]   [ RIR 2 ]
┌────── same 260px input zone ──────┐
│ [0] [1] [2] [3] [4] [5+]        │
│                                 │
│                                 │
│ [Skip]             [✓ Log set]   │
└─────────────────────────────────┘
```

Small viewport fallback: if remaining visible workout <160px or available height <700px, open native numeric input or a full-screen compact editor; do not shrink targets. RIR then uses same full-screen editing shell. Test viewport resize, safe areas and text zoom. Animation between modes is opacity 80ms only; zero vertical movement.

### Subtle but unmistakable PR

The closest exact inline reference is `exercise-history--hevy--exercise-history-sets.png`: set 3 has a gold medal + “1RM”, set 4 a medal + “Weight”. This validates a modest record glyph plus a named category directly at the set. It also shows why a generic trophy alone is weaker.

1. Keep weight/reps in ordinary white at the same font weight. Add a **2px #E9C778 vertical rule** inset at the completed set row's left, height 40px, radius 1px.
2. Apply **gold 5% row fill** (`rgba(233,199,120,.05)`) to that one row, not the exercise card. Use a fixed reserved 40px record gutter associated with set number; a 12px medal plus `PR` 10/14 600 sits there. Do not push numeric columns. If current set-number gutter is too narrow, reserve 40px for every row before rollout, never widen only after a record.
3. On completion only: gold rule opacity 0→1 in 120ms, subtle row fill 0→9%→5% over 500ms. **No glow, no looping shimmer, no confetti.** Remains visible after toast disappears and in saved history. Reduced motion is immediate persistent rule + label.
4. Screen reader: “Set 1 logged. Personal record, heaviest set: 40 kilograms for 13 reps.” Inline PR is a 48px target with accessible explanation via row details; visual glyph can remain small.
5. A quiet **bottom toast** says “New PR · 40 kg × 13” with Undo. It uses the same neutral toast shell, 14px gold medal, white copy; no large gold banner over exercise name. Position above rest/editor layer. If viewport is too short, use the editor's fixed accessory feedback slot instead of stacking a second overlay.
6. Tap PR opens a content-sized sheet: “Heaviest weight” / “40 kg × 13” / “Previous: 27.5 kg × 6 · 6 Oct”. The PR category must match the computation; heaviest weight, rep PR and estimated 1RM are different. More weight with fewer reps is not automatically every category. First-ever set is a benchmark; warm-ups excluded; assisted load semantics handled. Recompute if edited/undone; remove marker when no longer a record.

### Rest

Collapsed strip 64px: `Rest 1:59   −15   +15   Skip` in one line. Remove Next from the always-visible strip; tap timer expands details including next set. Countdown 22/26 550 tabular, no rolling digits. While editing, 40px accessory becomes part of editor top; no duplicate dock. Rest continues off-route from its deadline. Completed-set feedback does not steal focus or auto-scroll.

## 01 — Sign-in

### Problems

`01-signin.png` is already calm; preserve its negative space. The two-line “Your program, every set, every PR. Quiet, fast, and yours.” competes with the brand without adding a decision. The footer “By continuing you agree to keep lifting” sounds legal while linking only Privacy. Large secondary email fill makes two actions look equally primary. A faint decorative background wash weakens the pure-black identity.

### References

`signin--raycast--black-sign-in.png` (restrained black form), `signin--todoist--provider-hierarchy.png` (clear provider order), `signin--oura-android--sign-in.png` (focused auth task), `signin--hevy--email-and-providers.png` (email alternative and recovery). Borrow composition, retain correct Google branding.

### Proposal

```text

[40px Lift mark]
Lift.
Your next set starts here.

          generous flexible space

[ G   Continue with Google ]
[     Continue with email  ]
Privacy                 Terms, if applicable
```

20px gutters; brand group vertically near upper third, not absolute to a particular phone size. Mark 40; 20 gap to Lift 40/44 650; 12 gap to one-line subtitle 16/24 secondary. Buttons 52 high, 12 gap; Google uses approved white provider treatment; email black with #383838 border and 16/20 550 label. Bottom legal/support links 12/18 but 48px targets, safe area +16. Cut jokey quasi-legal copy; use truthful product terms only if they exist. Email form is its own focused route/sheet with title 24/30, labels 14, fields 52, one Continue and Back. No new slideshow or physique photography.

### Interaction / motion

Provider loading locks duplicate submission, retains button width and label; authentication error appears above actions in one sentence with Retry. Email errors appear beside relevant fields; preserve email on Back. No celebration before verified session. Reduced motion removes entrance translation.

## 02 — Welcome / choose program

### Problems

`02-welcome.png` combines welcome copy, units, three large radio cards, a Popular badge, goal/experience tags, descriptive paragraphs AND seven tiny day pills per plan. The third card runs behind the fixed Let's lift action. It asks the user to compare both training structure and marketing prose at once. The selected mint outline and check are sufficient; the badge isn't.

### References

`welcome--todoist--single-selection.png` (one clear radio decision), `welcome--fitbod--experience-choice.png` (readable choice rows), `welcome--hevy--program-overview.png` (details belong on a distinct overview), `welcome--hevy--units.png` (explicit unit choice). `welcome--structured--single-decision.png` is a contrast: a clear headline can coexist with too much illustration; use the headline discipline only.

### Proposal

```text
Choose your week
You can change it later.

(●) 5 days             Upper / Lower / PPL   [i]
( ) 4 days             Upper / Lower         [i]
( ) 3 days             Full body             [i]

Weight unit                          [kg | lb]

[            Use 5-day plan                ]
```

Title 28/34 650, subtitle 14/20 secondary, 28 gap. Three 80px rows with single-line name 16/22 550, second line 13/18; neutral #101010 group, separators inset after radio. Radio 20 in a 48px target, whole row selectable; info target separate. Selected row gets check/radio plus mint 1px edge only, no Popular pill, descriptions or weekday microcalendar. Units are one 56px row below with 24 gap. Do not default to a 5-day plan because it is “popular”; retain previous selection or start unselected and disable action until choice. Keep the setup on one short page; no new mandatory quiz. Info opens sheet with plan split, suggested weekdays, experience fit, and “Use this plan”; choosing returns with selected state. Detailed plan text must be specific and concise, no promise about optimal results.

### Interaction / motion

Selection changes immediately with 100ms ring/check fade; CTA text follows exact selected plan. Create plan once, show pending state, retain unit/selection on errors. On completion navigate to Train with the real populated week; no intermediate confetti. Footer reserves height + safe area, never covers last choice.

## 09 — Exercise menu sheet

### Problems

`09-exercise-menu.png`: seven equally weighted rows, repeated icon disks and captions under Replace/Superset/Rest. The long exercise name repeats visible context and pushes actions down. “Move down” exposes a single direction instead of a coherent reordering task. Remove is visually adjacent to routine edits despite different consequence.

### References

`menu--hevy--exercise-actions.png` (compact workout operations), `menu--fitbod--exercise-actions.png` (form, replace and record access), `menu--todoist--task-actions.png` (context label plus grouped operations), `sheet--linear-mobile--filter-sheet.png` (clear sheet header). Fitbod is a contrast for too many secondary settings; do not copy its entire list.

### Proposal

```text
                   ━
Low incline dumbbell press                [×]

[info]    Form & history                   ›
[repeat]  Replace exercise                 ›
[link]    Pair as superset                 ›
[clock]   Rest duration                 2:00
[more]    More                             ›
───────────────────────────────────────────
[trash]   Remove exercise
```

Content-sized sheet, initial target about 470–520px incl safe area for short title; expands if title wraps. Header 18/24 600, max two lines with 48 close; gap 12. Rows 56px, icon20 directly on surface (remove circular disks), label16/22 500. Right-aligned rest value13/18. Cut persistent helper captions. More subview contains Add note and Reorder exercises (full list with handles); back stays inside same sheet shell, no sheet-on-sheet pile. Superset chooser names next exercise in the destination view. Remove separated by 16px gap + hairline, danger text only. If data has been logged, the remove decision must explain affected sets then allow undo; do not conceal that in an always-visible caption.

### Interaction / motion

Open 240ms transform from bottom, backdrop opacity 0→0.55 with no blur. Dismiss returns focus to originating overflow. Replacing shows the existing-set consequence only when relevant. On action, close then show neutral success/undo toast, avoiding two competing overlays. More preserves height where practical; do not resize per row hover.

## 10 — Exercise info sheet

### Problems

`10-exercise-info-sheet.png` opens directly into History yet still shows a large video poster. Best set gold card, current estimated 1RM value/date, chart and dated sets stack into one viewport. The title is repeated by video context; “History · 8” adds a count before the reader asks for it. Chart's main value/date and gold best value can be different, with too little explanation of why.

### References

`exercise--hevy--info-sheet.png` (bounded contextual form), `exercise--fitbod--instructions.png` (instruction hierarchy), `sheet--future--active-context-sheet.png` (retain workout context), `exercise-history--ladder--exercise-journal.png` (plain session numbers), `exercise-history--hevy--exercise-history-sets.png` (records near actual dated sets).

### Proposal

```text
                    ━
Low incline dumbbell press                [×]
[ Form            | History ]

IF FORM:                     IF HISTORY:
[16:9 poster · Play]          Heaviest set       [v]
3 short numbered cues        27.5 kg × 6 · 6 Oct
Equipment · Dumbbells        [one chart, 160px]
Muscles                 ›    6 Oct · Push
                             20×13  25×10  27.5×6
                             9 Sep · Push …
```

Initial detent 72dvh (659px at 915 before browser chrome), max92dvh. Header and segment sticky, content scrolls within sheet. Title18/24 600, 16 top padding after grabber. Segmented control44px, 12 gap below title. Show video **only in Form**, no poster in History. Default Form when opened from preview; remember last tab within a live session when user explicitly chooses it. History chart and record share one metric; an understated 12px gold medal/PR label beside the relevant value replaces standalone best-set gold card. 16px value + 13px date, not two giant metrics. Date-session rows64px, values16 tabular. “View all history” pushes full exercise history if more space is needed. Form: poster16:9, at most three cues16/24 with16 gap, equipment one13/18 line, anatomy under Muscles disclosure. No full anatomy, long transcript and chart together.

### Interaction / motion

Expand to92dvh via grabber or upward content drag from top; content scroll must win after expansion. No nested scroll while compact. Playing lazy-loads player only on request and pauses on close. Tab changes keep fixed header and detent, reset only that tab's scroll. Chart readout supports tap/drag and accessible dated values. No synthetic trend for <2 samples. Open source video externally if playback unavailable, retaining current set draft.

## 11 — History list

### Problems

`11-history.png`: the large day rail plus title, PR pill, duration, sets, kg and a row of overlapping exercise thumbnails makes each saved workout a dense mini-summary. The image collages are hard to distinguish and add almost a full line of height. Month header “OCTOBER 2026 7” is ambiguous. The active-workout dock covers content near the tab bar.

### References

`history--things-3--logbook.png` (date-grouped completed work), `history--hevy--chronological-workouts.png` (saved sessions with clear dates; reject social controls), `history--gentler-streak--activity-history-chart.png` (activity period/history relationship), `history--todoist--dated-agenda.png` (date-group rhythm; reject calendar above every short list).

### Proposal

```text
History                              [search]
October 2026

Wed 21   Lower · Quad focus               ›
         50 min · 14 sets
Mon 19   Upper                       [PR·3] ›
         58 min · 18 sets
Fri 09   Lower · Glute focus              ›
         52 min · 13 sets
```

Title32/36, 24 gap to month18/24 600, 12 gap to first row. Rows80px, date rail64 (weekday/date on one 13/18 line or two if localization needs), title16/22 550, meta13/18. Remove thumbnail collage, volume and routine secondary labels. PR shows medal + count in gold text only (no gold capsule), maximum one small trailing indicator; no record detail until tap. Long workout names wrap; use 96px row when needed. Month count moves to accessible label “7 workouts” or is omitted. Search opens full-width focused search, optional month selector inside search; no filter-chip parade in normal history. Dock is a reserved64px lane above tab bar and content padding includes its height.

### Interaction / motion

Tap row pushes saved workout. Back restores exact scroll. Lazy-load by date with stable rows; no shimmer across every thumbnail. Empty: “No workouts yet” + “Your completed sessions will appear here.” + Go train. Search empty names the query and offers Clear search. Swipe to delete is optional with explicit overflow alternative and Undo, not a whole-row surprise gesture.

## 12 — Saved workout detail

### Problems

`12-history-detail.png`: duration/sets/volume each get their own filled tile, then a filled gold personal-record summary, then each exercise gets another filled set block. The page resembles nested containers. Superset A/B and numbered rows are visually detached. Edit sets appears only at the bottom after a long workout. The resume dock/tab bar cross the document halfway down the tall capture, obscuring logged sets.

### References

`history--hevy--dark-workout-summary.png` (saved workout with inspectable sets), `history--bevel--finish-summary.png` (compact outcome totals), `pr--fitbod--finish-record-summary.png` (explicit record category/value), `exercise-history--hevy--exercise-history-sets.png` (dated set table). Use totals as text and retain Lift's numerical precision.

### Proposal

```text
[‹]                                  [···]
Wed, 21 Oct 2026
Lower
Quad focus
50 min        14 sets        4,200 kg

Personal record                          ›
Smith squat · 40 kg × 10

Smith machine squat
1             30 kg × 10
2     PR      40 kg × 10
3             40 kg × 9

Barbell Romanian deadlift
1             60 kg × 8
…
```

Date13/18, title28/34 650, optional focus14/20, 20 gap then one unboxed stat strip. Values20/24 550; labels12/16 below, spacing24. Record summary is one64px row on black with tiny gold medal; omit entire section if none. 28 gap to exercises. Exercise names17/23 600; sets48px rows with inset separators only where needed; no grey wrapper per exercise. Working/warm-up type uses12/16 label alongside set number, not another column. Supersets share1px rail and IDs1A/1B, no arbitrary A and B pills detached from rows. Session note appears only when present, collapsed after two lines. Footer time/import metadata13/18 secondary behind overflow → Session details. Edit workout moves to overflow at top; read state has no sticky Edit button. Hide tab bar on this pushed route; reserve resume dock only when a different live workout exists, with title so it cannot be mistaken for this saved session.

### Interaction / motion

Edit opens explicit edit mode with Save/Cancel and retained originals. Tapping a PR opens comparison; same gold hairline/label on original set. Share is secondary, no required share screen. Deleting/undoing a set recomputes totals and records without jumping scroll. Imported session provenance remains accessible.

## 13 — Library

### Problems

`13-library.png` has a strong base. Search includes volatile count “326 exercises”; chip row already overflows; each row repeats muscle and long equipment lists. Bright white-backed stock thumbnails dominate the names. Resume dock makes the last visible row look disabled/covered.

### References

`library--hevy--library-search.png` (exercise search/result identity), `library--hevy--muscle-filter-sheet.png` (muscle selection), `library--oura-android--library-filter-chips.png` (category/filter rhythm), `library--structured--dark-choice-list.png` (quiet dark choice rows, component structure only).

### Proposal

```text
Library                              [filter]
[⌕ Search exercises                      ]
[All] [Recent] [Favorites]                 

A
[40] Ab crunch                           ›
     Bodyweight
[40] Ab roller                           ›
     Ab wheel
[40] Arnold press                        ›
     Dumbbells
B
…
```

Title32/36, search52 high with16/20 text, 16 gap to chip group44 high; chips only three fixed scopes. Muscle/equipment move into filter sheet, button shows small selected count; active filter summary one line “Chest · Dumbbells” with Clear. Result rows72, thumb40 radius10 on neutral background, title16/22 550 (wrap), equipment13/18 short canonical noun. Remove repeated muscle from every row because filter already supplies it; show it in details. Alphabet headings12/16 medium with24 top/8 bottom. Do not invert white images algorithmically; use neutral containment/new consistent assets when available. Never add card borders around each row. Search count moves to result status after filtering, not placeholder. Keep dock separate with full bottom inset.

### Interaction / motion

Search local/debounced150ms where applicable; preserve query/filter/scroll on return. Filter sheet combines muscles/equipment/favorites with Clear and one Show N exercises action; no count until real results loaded. Empty offers Clear filters and Create exercise only if custom exercise creation exists. Picking an exercise during program editing uses checkbox plus sticky Add N, whereas ordinary library uses chevron; never confuse these modes.

## 14 — Exercise detail, Form

### Problems

`14-exercise-detail.png`: video poster repeats a dramatic “mistake” collage; muscles chips, equipment line, long numbered tutorial and Cues card all compete. The same video remains above the History tab in `15`. Narrow content makes instructions look like a wall of text. A separate Cues card repeats advice rather than summarizing it.

### References

`exercise--fitbod--instructions.png` (readable form steps), `exercise--fitbod--exercise-muscle-anatomy.png` (primary/secondary distinction), `exercise--nike-training-club--active-form-guidance.png` (explicit play/demo), `exercise--hevy--info-sheet.png` (name + muscles + instructions).

### Proposal

```text
[‹]                                  [···]
Barbell back squat
Barbell · Squat rack
[ Form              | History ]

[     16:9 poster · Watch form            ]

Technique
1   Brace before you descend.
2   Keep pressure through the whole foot.
3   Drive up with your torso controlled.
[Full instructions                       ›]

Muscles                                  ›
Primary: Quads · Secondary: Glutes
```

Title28/34 650, equipment13/18, 16 gap to44px segments. Poster below segments16:9, radius16, 16 gap; prefer clean relevant frame over text baked into a thumbnail when source assets permit. Three useful cues16/24 with16 gaps; author/review exercise-specific text rather than auto-truncating into unsafe fragments. Full instructions expands inline with visible Show less or pushes a reading view. Remove separate Cues card, duplicated equipment heading and chip collection. Muscles one64px disclosure; anatomy and all primary/secondary labels appear there. No add-to-workout action unless opened in an exercise-selection flow. 28px section gaps and bottom dock padding.

### Interaction / motion

Switch tabs in place with fixed title/equipment/segments; video unmounts/pauses on History. Back returns exact originating tab context. Lazy-load YouTube after Play, no autoplay. Instructions accessible as text if media fails. Expanded instructions do not alter user's stored form/history selection.

## 15 — Exercise detail, History

### Problems

`15-exercise-history.png` spends the top third on form video while History is selected. Gold Best set card and large estimated1RM value tell two different stories: 50×2 ≈53.3kg vs current13.3kg. This is easy to misread as a 75% strength loss. Sparse chart and small dated set strings need clearer metric/date context; the workout dock covers the newest rows.

### References

`exercise-history--hevy--exercise-history-sets.png` (inspectable dated sets), `exercise-history--ladder--exercise-journal.png` (plain numerical session record), `pr--fitbod--exercise-record-chart.png` (explicit metric view), `exercise-history--hevy--empty-exercise-history.png` (honest absence of data).

### Proposal

```text
[‹]
Barbell back squat
Barbell · Squat rack
[ Form              | History ]

Heaviest set                          [v]
50 kg × 2                       26 Jul
[      chart · actual dated points       ]
[1M] [3M] [All]

2 Aug · Lower                             ›
10 kg × 3    10 kg × 3    10 kg × 3
26 Jul · Lower                            ›
50 kg × 2    50 kg × 2
```

Shared detail header from14. No video here. One metric selector16/22, latest/selected value28/34 550 with full date13/18 (year when needed), chart160px, range44px targets. PR marker small gold “Best” on actual maximum point/readout, not a second filled panel. Default use heaviest completed working set, not opaque estimated1RM. If user chooses estimated1RM, label “Estimated 1RM”, expose calculation and rep validity in info sheet, and distinguish latest vs all-time best text explicitly. Dated sessions72px min, workout title/date13/18, values16/22 tabular; wrap sets over2 lines, “+N sets” opens full table if >6. Unit appears in metric heading/readout, no ambiguous naked numbers. Separate exercise/equipment variants and assistance semantics.

### Interaction / motion

Tap chart point selects real dated sample, vertical marker and one readout; no hovering-only access. Tap session opens saved workout anchored to exercise. Sparse history displays actual points and “2 sessions” rather than smoothing. No-data state names exercise and links to Train; no fake line. Time range changes keep chart footprint fixed, no bounce or sweeping fill.

## 16 — Progress

### Problems

`16-progress.png`: three stat tiles (streak, per-week, total), 12-week bar chart, coverage bars and explanatory paragraph, empty weight card, then a very long personal-record list. Each metric is reasonable; together they create an endless dashboard with no priority. “1” streak, “1.8” per week and “42” total have different windows. Fractional muscle counts (12.5) need a clear accounting basis. Record rows repeat trophy numbers labeled estimated1RM, which can look like actual lifted weights.

### References

`progress--hevy--muscle-distribution.png` (coverage with named counts), `progress--hevy--weekly-muscle-anatomy.png` (supporting anatomical context), `progress--macrofactor--scale-weight-chart.png` (dated weight trend), `progress--macrofactor--weight-entry-sheet.png` (one focused entry), `progress--whoop--metric-breakdown.png` (one metric with disclosed contributors).

### Proposal

```text
Progress
[Training             | Body weight]

This week                        [‹] [›]
19–25 Oct
2 sessions                32 working sets

Muscle coverage                         [i]
Chest       ━━━━━━━━                    7
Back        ━━━━━━━                     6
Shoulders   ━━━━━                       5
… [Show all muscles]

Recent records                     See all
Smith squat                 40 kg × 10  PR
Lateral raise               7.5 kg × 12 PR
[View consistency                         ›]
```

Title32/36; segment44, 24 gap. Two unboxed summary values24/28 550 with labels13/18, no card trio. Keep coverage on black, rows40px visually but entire Show all/info controls48px. Top6 primary muscle groups, show all reveals remaining counts. Label exact counting method; if existing model gives0.5 secondary credit, call it “Weighted sets” and explain on tap; **do not quietly relabel existing fractions as direct sets**. Preferred model displays direct and secondary separately (R1). Data/methodology migration is a separate implementation decision. Remove persistent educational paragraph from chart; info sheet holds it. No universal “optimal” band. Recent records: last3 actual record events, 64px rows, exercise16/22 + explicit record value13/18; See all list handles the rest. Move 12-week consistency graph behind View consistency; remove daily streak and lifetime total from default. Body weight tab: latest reading/date, chart, Add reading, dated history. If empty: one sentence “Log your first reading” +52px action, no tiny dead chart card on Training.

### Interaction / motion

Week arrows update only week-scoped content; records have explicit independent “Recent” scope. Weight entry bottom sheet: title, numeric value/unit, measurement date, Save; keyboard does not cover Save. Weight changes stay neutral (no moral red/green). Tab state retained. No-data training screen has one Go train action; weight logging still available independently. Chart controls have accessible data list alternative.

## 17 — Settings

### Problems

`17-settings.png`: Program and Switch program are adjacent separate rows for the same object. Units/week starts/default rest expose three different selector forms at once. AI access is a promotional card with MCP implementation prose and multiple actions; it competes with basic training preferences. Avatar card + top avatar duplicate identity. Footer slogan is extra content in a utility screen.

### References

`settings--hevy--grouped-preferences.png` (account vs training groups), `settings--things-3--compact-groups.png` (few navigable rows), `settings--structured--grouped-settings.png` (clear group labels), `settings--raycast--dark-settings-sheet.png` (dark preference hierarchy), `settings--bevel--rest-and-autofill-settings.png` (logging-specific preferences).

### Proposal

```text
[‹]
Settings
Ankit
email@example.com                         ›

Training
Program                   5-Day ULPPL    ›
Weight unit                         kg    ›
Week starts                     Monday    ›
Default rest                      2:00    ›

Connections
AI access                                 ›

Account
Privacy                                   ›
Sign out
```

Title32/36, account identity ordinary72px row (name16/22, email13/18), remove filled avatar card and top avatar. Group labels13/18 medium, 24px above, 8px below. Rows56 high, label16/22 regular, current value14/20 secondary, chevron16. All selectors move to compact value sheets—no three segmented controls on settings home. Program row opens editor; its overflow contains Switch program with explicit preservation explanation there. AI access becomes one row, details on dedicated page/sheet: connection status, supported clients, token management. Keep essential token permission consequences in that flow, remove MCP sales pitch from Settings. Footer only version13/18 and legal link if needed, no slogan.

### Interaction / motion

Tap value sheet: current choice checked; immediate-save simple unit/week preference then dismiss with short confirmation. Default rest presets + custom duration, one Done. Program switching preserves history and explains schedule replacement before applying. Sign out confirmation only if unsynced work needs a decision; no extra generic confirmation for ordinary navigation. Active-workout dock remains reserved above tab bar; all account rows accessible below it.

## 18 — Program editor

### Problems

`18-program.png`: a giant full program name, program eyebrow and sentence precede seven individual rounded day cards. Each card has weekday, workout title, summary, chevron AND overflow; two controls compete for what “edit” means. Rest gets the same visual weight as six-exercise days. Top pencil is ambiguous (rename? edit?). The main list shows no distinction between template editing and this-week swaps.

### References

`program--hevy--routine-editor.png` (editable prescriptions in context), `welcome--hevy--program-overview.png` (program identity and routines), `program--fitbod--weekly-frequency.png` (week setup as a clear choice), `program--structured--day-detail-editor.png` (properties under selected object), `reorder--hevy--routine-before.png` (explicit edit/reorder state).

### Proposal

```text
[‹] Program                            [···]
5-Day ULPPL
Future workouts only

Sun  Lower · Glute focus        6 ex      ›
Mon  Upper                      6 ex      ›
Tue  Rest                                ›
Wed  Lower · Quad focus          6 ex      ›
Thu  Push                       6 ex      ›
Fri  Rest                                ›
Sat  Pull                       6 ex      ›

[Arrange template]
```

Compact56px nav header with Program18/24; title28/34 two lines max, editable name via overflow Rename. Subtitle13/18, 24gap to group. One #101010 list group radius20 instead of7 independent cards, rows64 workout /56 rest, separators inset past weekday rail. Weekday13/18 secondary, name16/22 550, trailing exercise count13/18 then chevron. Remove estimated duration here and seven overflows. Tap day pushes editor: `Back / Push / Done`; name, plain exercise rows with prescription `3 × 8–12`, trailing edit target; Add exercise after rows. Only selected exercise expands a compact editor for sets/reps/rest/RIR. Reorder mode reveals handles plus Add/Remove in context; do not expose every knob at once. Rest editor contains Rest/Workout choice and date position. Template changes and current-week swaps must be named separately; Arrange template affects future recurring schedule, Arrange week affects current plan only.

### Interaction / motion

Day editor saves changes deliberately on Done or uses clearly indicated autosave; do not mix them. Keep edit drafts on accidental sheet dismissal; prompt only when discarding real unsaved data. Superset pairing displays1A/1B plus rail; one pairing/unpairing control in overflow. Removing an exercise offers Undo; changes never rewrite saved sessions. Reordering days follows same pickup/slot/settle feedback as week, with “Template updated” outcome copy and future-workout scope. Copy day/switch program/rename live in program overflow. Hide tab bar on deep editing views; resume live workout remains available with reserved dock.

## Cross-screen acceptance gate

- At 412×915 and360×800: no clipped names/values, no action covered by tab/dock/keyboard; test200% text size with natural row growth.
- Train has one Start/Resume target and no always-visible instruction/handle parade. Today's action and weekly summary are visible without scrolling.
- Preview has no last-set strings, target percentages or per-row rest in default state. All6 exercises reachable above dock.
- Kg→reps→RIR toggles change editor top edge by **0px**. No visible explanatory paragraph under RIR.
- A real PR remains visibly marked after feedback toast expires; normal vs PR set numerals have identical weight. Undo removes/recomputes marker.
- A Thu↔Sat swap visibly moves both workout contents while dates remain fixed, names both results, and can be undone. Failed save visibly restores.
- Info sheet/Form and History have mutually appropriate content: no video above chart in History. One selected metric per chart.
- Fixed bars reserve real document space. A tall full-page screenshot must not show a dock crossing readable mid-page content due to incorrect capture/layout behavior.
- Keyboard, screen reader, reduced motion and unsupported haptic environments get the same outcome information.
- No new decorative asset, animation library, chart library or browser sensor integration is needed for these changes.

## 05–08 — implementation map by screenshot

This map makes the shared logging proposal above explicit for each supplied capture.

### 05-workout.png

**Problems:** repeated best-set trophy line and filled exercise stack create noise, but input/completion fundamentals are strong.

**References:** `logging--hevy--active-workout-sets.png`, `logging--bevel--completed-set-state.png`, `logging--ladder--set-logging-keypad.png`.

**Proposal:** preserve overall logger; top bar56 → exercise group header → target reps13/18 → set headers12/16 → rows → Add set/rest footer48 → next exercise16 gap → Add exercise52 after list. No timer/PR value in every header.

```text
[⌄] Push                         Finish
0:02 · 0 of 18 sets

Low incline dumbbell press       [···]
8–12 reps
Set      Previous     kg    Reps   RIR   ✓
1        20 × 13      20     13     —   [✓]
2        25 × 10      25     10     —   [✓]
3        27.5 × 6    27.5     6     —   [✓]
[+ Add set]                   [Rest 2:00]
```

Geometry correction: keeping the logger familiar does not justify small targets. At412px, with20 outer gutters and16 card padding, table width340. Use a40px set/record gutter, minimum64kg,56reps,48RIR,48check and4×8gap =288; put Previous on a13/18 second line under the relevant set. This leaves52px flexible slack for numeric columns. A separate Previous column requires a table container >=440px **after** internal padding; the existing390 viewport breakpoint is too early to guarantee48px targets. At360px use16 outer/12card, table304, same288px grid fits; wrap previous hint and grow row to76. Superset indentation must reduce gutters or use the compact hint layout, never steal touch width. Do this measured correction if changing PR gutter/targets; do not merely widen one cell.

**Interaction/motion:** same row identity, completion commits values once, check160ms, no automatic scroll/focus jump; numeric text stays500.

### 06-keypad-weight.png

**Problems:** good large keys; selected set is duplicated between table and panel, and header information can truncate. Its tall footprint becomes the reference height the RIR mode must retain.

**References:** `logging--fitbod--active-set-keypad.png`, `logging--ladder--set-logging-keypad.png`, `components--raycast--dark-keyboard-context.png`.

**Proposal:** fixed392px body with44 context,72 values,260input,16bottom; one compact exercise/set context, no extra target badge if it forces title truncation. Rows/key dimensions as specified above. Weight label12/16, value24/28, keys22/26 500.

```text
Exercise · Set 1 of 3                [⌄]
[kg 20]          [reps 13]       [RIR —]
[1] [2] [3] [−2.5]
[4] [5] [6] [+2.5]
[7] [8] [9] [Next ]
[.] [0] [⌫] [     ]
```

**Interaction/motion:** selects whole value; Next→reps; dismiss saves draft. Entry/reopen does not change active row height.

### 07-keypad-rir.png

**Problems:** shorter panel repositions hand targets; visible Failure/easy/subcaptions plus explanatory paragraph over-teach an optional field.

**References:** `logging--ladder--set-logging-keypad.png` (entry context), `sheet--hevy--set-type-sheet.png` (bounded options), `sheet--structured--alert-list.png` (contained selector anatomy). These are component analogues; none establishes an exact RIR design.

**Proposal:** same392px shell, same top edge/current value positions; replace260px key region with six numeric choices and bottom-anchored Skip/Log. No explanatory text. The earlier RIR wireframe is authoritative.

**Interaction/motion:** choice does not log automatically; selected check/ring,80ms content crossfade,0px vertical movement.

### 08-workout-pr-rest.png

**Problems:** transient banner obscures exercise header, tiny trophy is disconnected from value, bottom rest has a redundant Next row.

**References:** `exercise-history--hevy--exercise-history-sets.png`, `pr--fitbod--finish-record-summary.png`, `logging--bevel--completed-set-state.png`, `toast--todoist--completion-and-undo.png`.

**Proposal:** same table; record row gets2px gold rule+5%fill+reserved PR label, white values same weight. Bottom rest64 one line; neutral toast sits above it, never over heading.

```text
│ 1 PR     40          13        —      ✓
│ gold rule · ordinary-weight numerals

[New PR · 40 kg × 13                Undo]
[Rest 1:59            −15   +15     Skip]
```

**Interaction/motion:** one500ms fill response then persistent marker, exact-category record sheet on tap, Undo recomputes and removes obsolete marker. Rest deadline persists. No celebration loop.

## Additional home / feedback evidence added in R2

`train--structured--dark-today.png` demonstrates a stable week rail plus quiet current-day tasks, but multiple colored timeline objects are too much for Lift. `train--streaks--habit-home.png` gives completion one clear circular affordance; its all-screen color is outside Lift's palette. `train--not-boring-habits--single-action.png` demonstrates a single dominant action with a quiet date rail; reject its game scenery and long onboarding. `feedback--streaks--completed-habit.png` and `feedback--not-boring-habits--completed-check.png` show unmistakable checked outcomes without explanatory paragraphs. `history--not-boring-habits--dated-log.png` is the restrained counterpoint: dates and checks, no card collage. These extend the R1 fitness research into task/habit references; they do not add extra home modules.
