# R2 research and evidence limits

Research: 22 October 2026. Role: visual/product design only. All 18 supplied current screenshots were inspected before the proposals were written, including full-page captures whose proportions differ from the nominal 412×915 viewport. Prior `mobbin/design-direction.md`, `findings.md`, manifest and research log supplied R1 context. Route/component code was read for behavioral/geometry context; no source code was edited.

## What is new

R1 already covered fitness logging, workout previews, charts and dark UI. R2 therefore adds an audit anchored to specific Lift elements, a home-module admission decision, a two-day swap state machine, fixed input-height geometry, a persistent PR treatment, and exact cuts for every screen. First usable `redesign.md` covered Train, preview, reorder, keypad and PR before the rest of the audit was added. Later additions provide individual 05–08 implementation maps and correct the table-width requirement for touch targets.

New Chrome/Mobbin collections explored and downloaded through the logged-in UI in an agent-created Chrome research session:

- Structured, Sep 2026: daily timeline, week/detail detent, property editor, dark choice list, sheets, grouped settings, empty state.
- Todoist, Mar 2026: provider hierarchy, single choice, detail sheet, move destination, completion + Undo, action grouping and dated agenda.
- Streaks, Oct 2021: home affordance, checked state and explicit arrange before/after.
- (Not Boring) Habits, Apr 2023: single dominant action, checked date and minimal dated log. Its game scenery, dramatic typography, materials and onboarding are deliberately outside Lift's direction.

Previously downloaded full Mobbin collections were additionally inspected locally to select **new R2 screens** from Hevy Oct 2025, Things 3 Mar 2023 and Fitbod Jun 2022. These include Hevy's actual reorder before/after states, exercise menu, bounded info panel, routine editor, grouped preferences and email auth; Things' move destinations and logbook; Fitbod's choice list, weekly frequency, instructions and exercise operations. They are marked R2 new selection in the manifest; their files were not in R1's curated 77.

The final set is **91 unique phone-only PNG references: 50 explicitly carried forward from R1 and 41 new R2 selections**. Carried evidence is renamed by use case and original provenance retained. This is not a claim of 91 newly discovered screens. Screenshots demonstrate captured UI, not current shipped app availability. Some collection captures are old and used for component structure only.

## Breadth and bounded coverage

Home decisions build on R1's directly researched Future Pro, Ladder, Gentler Streak, WHOOP, MacroFactor, Hevy, Bevel, Oura and Nike Training Club plus R2's Structured, Things, Todoist, Streaks and Not Boring Habits. Logging/record decisions also use Fitbod. The user's named apps were examples for broad research, not an assertion of catalog availability. R1's bounded searches did not surface exact Strong, Caliber, Alpha Progression or StrongLifts collections. R2 did not repeat those searches or claim those apps are absent. Apple Fitness, Liftosaur, Apple Reminders and Strava were not independently audited in R2. No behavior is attributed to an uninspected app.

## What the screenshots can and cannot prove

- Hevy's set history visibly uses gold medals and named record types at specific sets. This directly supports an inline record marker. Lift's gold hairline, restrained fill and one-time response are proposed design choices.
- Hevy/Streaks before/after captures show order changes and an explicit arrange mode. They do not establish pickup scale, drop spring, threshold, slot feedback, haptic implementation or persistence behavior.
- Todoist visibly has an Undo outcome after completion. That does not prove a six-second timeout; six seconds is Lift's proposal.
- Screensheets show grabbers, headers and lists. Their exact detents, backdrop percentages and animation durations in `components.md` are proposed and require implementation testing.
- No native fitness app was installed, real workout was entered, account settings were changed, or external message was sent. Other Chrome windows/tabs were not operated. Original exports remain in Downloads.

## Provenance / cropping

`manifest.json` records filename, source collection URL, original export name, original dimensions, phone crop and SHA-256. R1 carried files retain their prior verified crops. New original Mobbin PNG exports include a footer outside the phone canvas; it was removed at its export scale (40px per393px width). Phone status and home indicators remain. No product UI content was retouched or redrawn in reference captures. The local contact sheet is a labeled, resized overview only. Collection-level URLs are used where individual screen IDs were not available from the downloaded archive; filenames do not pretend to be deep links.

## Checks performed

- All91 PNGs decode; recorded hashes match; no duplicate PNG hashes.
- All reference filenames in both specs resolve, including supplied screenshots resolved from `current-screens`.
- New selections visually inspected as phone crops; inline record example inspected at full size.
- `interaction-study.html` previews at728,360 and320 CSS px without horizontal overflow or console errors. RIR selection updates the value; editor top edge delta between kg and RIR measured0px in the prototype. Automated in-page assertions check the swapped pair and Undo, PR feedback and Undo, and keypad/action non-overlap. These checks validate the study, not the Lift implementation.
- Product code remains untouched. Browser text/drag/haptic/offline implementation acceptance remains an engineering responsibility, specified in the documents.
