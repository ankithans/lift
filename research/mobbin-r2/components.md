# Lift R2 — reusable components

22 October 2026. All dimensions CSS px. This file and `redesign.md` form one contract. Static reference images establish visible layouts/states. Motion, detents, haptics, optimistic updates and accessibility details below are Lift proposals. Keep implementation in the current stack; no new decorative library required.

## Foundation and density

Canvas #000000; surface #101010; raised #1A1A1A; pressed #242424; line #262626; ink #F5F5F5; muted #A3A3A3; mint #B8F4D0; PR #E9C778; danger #FF8E8E. Mint is primary action/focus/current location; gold is a defined record. Never use either for arbitrary category decoration. Surface fill groups related controls, not every content object. Pure black occupies most of the screen.

Inter variable with system fallback; never delay text rendering for font. Large title32/36 650 -0.03em; compact nav18/24 600; section18/24 600; row16/22 550; paragraph16/24 400; support13/18 400; label12/16 500; numbers20/24 500 tabular lining figures. Estimated values explicitly say estimated; do not style them as actual lifted loads. Use at most three visible type sizes within one component. Avoid italic numeric drafts, uppercase paragraph headings and small grey explanatory walls.

Gutters20 (16 at<=360); vertical rhythm4/8/12/16/20/24/28/32/40. Touch targets>=48×48, primary button52, dense visual controls can be40/44 if invisible hit area reaches48 without collision. Small body text never substitutes for targets. Row height is a minimum; wrap/grow at larger text sizes. Safe-area insets are additive. No fixed-height content panels clipping scaled text.

## List rows

References: `components--linear-mobile--borderless-inbox.png`, `components--linear-mobile--grouped-list.png`, `history--things-3--logbook.png`, `library--hevy--library-search.png`.

```text
[optional leading 40]  Name, 16/22             [value] [›]
                      One support line, 13/18
```

Variants: single-line preference56; library72 with40 thumb; workout preview76 with40 thumb; history80 with64 date rail; saved set48; week56 with56 date rail. Add12 between leading content and text. Right-side action48; value max90 before wrapping. Separators1px #262626 begin at text baseline edge, omitted between unrelated sections. Default rows have no fill, border, capsule or shadow. A selected row gets a clear check/radio and subtle surface; a pending pressed row gets #1A1A1A for90ms. Never make a chevron another separate tab stop if the whole row navigates. Never nest buttons: secondary overflow lives as a sibling target. Names wrap to2 lines; equipment/meta compress before identity. Search highlights match text by weight/color without changing width.

Empty support line vanishes rather than retaining a fake dash. Loading rows reserve real geometry; static neutral blocks, no sweeping shimmer. Error rows retain data/identity and expose Retry. Selection mode swaps chevron for checkbox and shows one batch action. Normal browsing never displays checkboxes.

## Section headers

References: `components--linear-mobile--grouped-list.png`, `history--things-3--logbook.png`, `train--things--dark-today-list.png`.

Title18/24 600 left, optional action13/18 550 right within48px target; baseline align. Use sentence case. 28/32px above,12 below. A section label inside a grouped preferences list may be13/18 medium with24 above and8 below. Do not render a heading that merely says “Exercises” when the list is the only content below workout identity. A date-range subtitle13/18 sits4px below title. Actions name destination: “See all”, “Arrange week”, “Log weight”; avoid several unlabeled icons. Counts belong next to noun (“7 workouts”), never bare7.

## Stat tiles / strips

References: `history--bevel--finish-summary.png`, `train--macrofactor--dark-dashboard.png`, `progress--whoop--metric-breakdown.png`.

Default is an unboxed strip:2 or3 columns, value20/24 or24/28 550, label12/16 secondary with4 gap. Group gap24. Only use a filled tile when it is independently tappable and leads to its own metric detail; padding16, radius16, min104 high. One large metric plus supporting explanation beats a row of unrelated windows. Do not put lifetime total, weekly rate and daily streak in one undifferentiated strip. Every metric has unit, period and definition discoverable within one tap. No arrows up/down or percentage deltas without a comparable baseline.

## Segmented controls

References: `exercise--fitbod--instructions.png`, `program--fitbod--weekly-frequency.png`, `welcome--hevy--units.png`, `sheet--todoist--display-controls.png`.

Track #101010, radius12, visual height44 (target48), padding4. Segments equal when two short choices; active #242424 and ink, inactive muted; label14/20 550. Mint reserved for focus/primary action, so passive view switching does not introduce a second big mint surface. Units compact96–112px total when in a form. No counts in Form/History labels. Keyboard arrow navigation, semantic tablist/panels for view switch and radiogroup for stored value. Selected state has text/position in addition to color. Fade content80ms while geometry stays fixed; avoid sliding the whole page.

## Chips

References: `library--oura-android--library-filter-chips.png`, `library--hevy--muscle-filter-sheet.png`.

Use only for3–5 short, mutually understandable scopes. Library default All / Recent / Favorites. Visual36–40 high, target48, horizontal12, gap8, radius999. Unselected transparent with1px #383838; selected white #F5F5F5 with black text,13/18 550. No mint chip collection under every exercise. Filter selections can wrap inside sheet. Category chips must scroll horizontally only if actual alternatives justify overflow; show edge/partial next chip, no masked essential selected state. Long equipment/filter combinations become one summary line with Clear instead of six pills. Display-only muscle text should be plain labels, not fake interactive chips.

## Navigation headers / large-title collapse

References: `history--things-3--logbook.png`, `components--linear-mobile--borderless-inbox.png`, `settings--hevy--grouped-preferences.png`.

Root tabs use Train / Library / Progress / History32/36 650. Date/greeting optional13/18, but never outranks the task title. Top-right avatar48 target. Header viewport footprint56; large title is a separate content row. On scroll when large-title baseline crosses sticky header bottom, compact18/24 title fades in120ms. Do not animate the actual list height or change its scroll offset. Use IntersectionObserver threshold rather than a per-frame React rerender. Header black, subtle hairline only when content is beneath. No blur dependency.

Pushed preview/details/editor hide root tabs and show back48 target, compact route name only when needed, overflow48. Workout name may wrap; nav bar grows for text zoom. A single back action returns to the actual origin, preserving filter/scroll. Never place back and minimize with identical chevrons in same context; live workout down-chevron means minimize, ordinary left-chevron means navigate back. Finish is text/quiet control top-right; mint filled action reserved for current logging action where applicable.

## Tab bar and active workout dock

References: `library--oura-android--library-filter-chips.png`, `components--ladder--resume-workout-dock.png`.

Four equal slots: Train / Library / Progress / History. Black opaque background, decorative top1px line,64px plus safe-area inset. Lucide22/24 stroke1.75; label11/16 weight500, gap4. Active mint icon+label; inactive #A3A3A3. No floating frosted pill, bouncing icons or unlabeled navigation. Target covers whole column with minimum48 height. Preserve each tab's scroll and filter state.

Resume dock64px incl8 top/bottom margin, content #101010, radius16, horizontal16. Leading8px mint status dot, title15/20 550 + optional rest13/18, trailing Resume text+chevron. It occupies its own layout lane above bar, not overlaying readable rows. Main content padding is tabbar + safe area + dock(if present) +16. On Train an active-session hero replaces dock; on live workout no bar/dock; on pushed details dock only if a different session remains active. At very short heights one line “Push · Resume” with timer detail on tap.

## Bottom sheet anatomy and detents

References: `sheet--linear-mobile--filter-sheet.png`, `sheet--hevy--set-type-sheet.png`, `sheet--fitbod--rest-sheet.png`, `sheet--future--active-context-sheet.png`, `sheet--structured--alert-list.png`, `sheet--todoist--task-detail.png`.

```text
             36×4 grabber
Title, 18/24 600                       [×]
Optional short subtitle, 13/18
──────────────── optional boundary ────────
Scrollable content / 56px action rows

[ one primary action, when needed ]
16px + device safe area
```

Sheet surface #101010, radius28 top corners,1px #303030 edge, no neon edge/glass/large shadow. Backdrop black55%, no default blur. Grabber36×4 #666, radius2, centered12px from top; decorative affordance plus48px drag header hit zone. Header horizontal20;16 after grabber; title wraps2 lines, no truncating exercise identity, close48. Gap12 to body. Body20 horizontal, bottom16+safe area. Action rows56;20px Lucide then16px gap to16/22 label; remove background icon disks. Secondary values13/18 right-aligned. Maximum one helper line where a consequence is relevant. Destructive action separated16 gap +line. No generic Cancel row if close+outside-dismiss already works; explicit Cancel needed for real draft decision.

Detents by task:

| Kind | Initial | Maximum | Footer |
|---|---|---|---|
| Simple action menu | Content fit, typically380–520px | min(content,80dvh) then body scroll | None |
| Rest presets / units / swap destination | Content fit, typically300–440px |80dvh | Done only if multiple changes |
| Filter |72dvh |92dvh | Clear + Show N results; primary52 |
| Exercise info |72dvh |92dvh | No permanent Done; close available |
| Numeric editor |392px+safe area | Fixed across kg/reps/RIR; short-view fallback | Log set inside reserved body |
| Long form / deep edit | Full route preferred | Full route | Save/Cancel tied to actual edits |

Do not add three detents to every sheet. Content-sized menu does not need a middle stop. 72/92dvh are browser visual-viewport dimensions, not physical screen capture heights. Max top safe-area+12. Scroll body, keep header/footer fixed within sheet; scrolling down from content scrollTop>0 never dismisses. At top, deliberate header drag>96px or velocity>650px/s downward dismisses; otherwise settle to nearest valid detent. These are starting implementation values, test with real thumbs. Do not dismiss while editing text based on accidental scroll. A nested destination replaces sheet content with back header; never pile several dimmed sheets. Native keyboard reduces available body region; focused field and Save remain visible.

Opening240ms and closing180ms `cubic-bezier(.22,1,.36,1)`; backdrop fade160ms. Body does not stagger. Respect reduced motion:80ms fade only. Focus trap, role=dialog, aria-modal, title linkage, Escape/Back and explicit close; restore focus and underlying scroll on close. Background inert while modal. Browser scroll lock released reliably. Expanded detent announcement only on user action. Status/haptic is optional, not needed to understand result.

## Empty states

References: `empty--structured--inbox.png`, `exercise-history--hevy--empty-exercise-history.png`, `components--cash-app--quiet-success.png` (tone/one outcome).

No giant empty card. Lucide32 optional in muted,24px gap, title20/26 550, one or two lines14/20 muted max280 wide,20 gap to one52px action. Position within relevant content area, not centered against tab bar. Distinguish no data, no search matches, offline failure and permission state. Wording examples: History: “No workouts yet” → “Completed sessions appear here.” → Go train. Exercise: “No sets logged for this exercise” → View workout. Search: “No exercises match ‘…’” → Clear filters. Weight: “Log your first reading” → Log weight. Error must retain existing data; never replace saved rows with an empty-state illustration.

## PR treatment

References: `exercise-history--hevy--exercise-history-sets.png` visibly places gold medal and record type adjacent to individual sets; `pr--hevy--personal-records.png` lists categories; `pr--fitbod--finish-record-summary.png` names achievements. None proves Lift's animation.

Persistent row:2px gold rule40 high,5% gold fill, tiny medal+PR in reserved40px set gutter; normal values stay20/24 500 white. Marker must persist after toast and be visible in saved set history. Accessible48px action opens record comparison with actual category/date/previous value. Weight/reps font weight never changes to signify a PR. Rule and word PR provide redundant recognition; color alone insufficient. No animation on render/scroll/reopen.

One-time response: rule fade120ms; row fill0→9%→5% over500ms, then stop. Reduced motion immediate. No glow, confetti, flashing numbers, gold whole-card border or looping shimmer. Gold toast14px medal + “New PR ·40kg×13” in neutral shell; row remains the primary evidence. Metric semantics: canonical units, compatible equipment/load definitions, exclude warm-ups, inverse assistance handled, first entry benchmark. Undo/re-edit recomputes real record and removes stale marker. Two records from one set can show one PR label and list both in detail; never stack badges.

## Drag / swap feedback

References: `reorder--hevy--routine-before.png` and `reorder--hevy--routine-after.png` show explicit reorder UI and exchanged order; `reorder--streaks--arrange-before.png` / `reorder--streaks--arrange-after.png` show a named arrange mode; `reorder--todoist--move-destination.png` and `reorder--things-3--move-destination.png` show destination alternatives. Static before/after states do not verify gesture mechanics.

Apply complete seven-step contract in `redesign.md`: arrange→pickup100ms/scale1.025→source ghost→mint target plus “Swap with Pull”→two-way220ms travel→140ms settle +700ms changed-slot outline→specific6s Undo toast. Dates anchored, only two contents move. Pointer6px threshold; optional300ms hold;8px target hysteresis. Cancel outside target returns160ms; failure restores180ms with named message. Haptics pickup/target/drop optional, never continuous. List insertion reorder in exercise editor uses ghost gap and displaced-neighbor motion160ms; week swap does **not** shift intermediate days. This semantic distinction is crucial.

Stable IDs on workout/template objects, not array indices. Snapshot pair/version for Undo. Prevent route-opening click after drag ends. Auto-scroll near44px top/bottom edge, speed0→240px/s proportional to penetration; stop when pointer leaves. No auto-scroll past sticky header/action bar, no accidental tab activation. Disable ineligible slots before drag. Keyboard/screen reader handle opens day choice; Enter confirms, Escape cancels, focus follows moved item. Reduced motion direct exchange with outline and announcement. No universal haptic promise on mobile web.

## Toasts with Undo

Reference: `toast--todoist--completion-and-undo.png` shows outcome toast plus Undo; reject its first-task confetti and second competing banner. `components--cash-app--quiet-success.png` supports restrained success.

Single toast instance, #1A1A1A background,1px #383838, radius16, horizontal16, min56, max2 text lines. Label14/20 weight450, optional16 icon, Undo14/20 600 mint in48 target. Inset16 from viewport edges; position12 above highest persistent layer (tabs/dock/editor). Never cover exercise heading. If insufficient vertical space, occupy reserved40px editor accessory message region rather than piling overlays. Maximum toast lifetime6s for undo; ordinary neutral confirmation3s; persistence failures stay until resolved/dismissed. Pause timeout on hover/focus, make Undo available in relevant overflow/history after timeout for important edits. One latest transaction displayed; do not queue six undo banners.

Copy names outcome: “Push ↔ Pull swapped” / “Push moved to Friday” / “Exercise removed” / “New PR ·40kg×13”. Undo restores exact prior transaction, marks pending and reports failure without lying about success. Announce once with polite live region, actionable error role=alert. Toast must not steal focus. Dismissal of toast is never same as undoing action. No progress countdown ring unless the remaining expiry is needed; avoid unnecessary animation.

## Numeric editor invariant

Reference: `logging--fitbod--active-set-keypad.png`, `logging--ladder--set-logging-keypad.png`, `components--raycast--dark-keyboard-context.png`.

Fixed392px body +safe area across fields:44 header +72 value strip +260 input region +16 bottom space. Optional40px rest accessory exists for all fields while rest active. Numeric grid4×56 with8 gaps; RIR replaces same input region and puts0/1/2/3/4/5+ choices at top and Skip/Log at bottom. No explanatory text beneath choices. No auto-submit. For very narrow width use3×2 RIR grid. Input labels12/16, values24/28, fields>=16 font to avoid iOS zoom. Selected field mint2px focus ring; whole value initially selected. Decimal locale respected; reps integer. Bodyweight/assisted/per-dumbbell semantics explicit in context on tap. Native keyboard fallback for short viewport/assistive tech; do not force custom grid at unreadable size. Live row remains anchored and draft survives dismiss/route.

## Validation at handoff

Measure rather than eyeball: top edge delta across input modes0px; all interactive targets>=48; PR numerals same weight as completed normal; one screen-level primary action; long names+200% text retain identity; focus returns after sheets; Undo restores pair; save failure cannot leave a toast claiming persisted success. Test360/412/430px widths, short landscape, iOS Safari and Android Chrome visual-viewport behavior. A screenshot cannot certify these interactions; run them in implementation before release.
