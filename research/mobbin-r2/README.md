# Lift — design research, round 2

Read [`redesign.md`](redesign.md) first: Train, swap feedback, preview and live logging lead the document. All18 screenshot states have problems, reference filenames, exact proposals, wireframes, typography/spacing and interaction notes. [`components.md`](components.md) contains reusable geometry and behavior. [`research-log.md`](research-log.md) states coverage and evidence limits. [`manifest.json`](manifest.json) preserves source URLs, crops and hashes; [`screenshots.md`](screenshots.md) is the browsable source index.

91 unique phone-only reference PNGs (43.1MiB):50 selectively carried from R1,41 new R2 selections. New research focuses on Structured, Todoist, Streaks and Not Boring Habits, plus newly selected states from earlier full Hevy/Things/Fitbod exports. No product code edited.

[`interaction-study.html`](interaction-study.html) is a local, interactive design study of Train, day preview, swap+Undo and PR/fixed-height RIR. It contains illustrative values and does not change a real workout. The study omits preview thumbnails to concentrate on hierarchy; production preview keeps the specified40px thumbnails. It shows the first viewport; Last session is intentionally farther down Train.

## Ranked implementation priorities

1. Give Train one next action; remove duplicate Start and large greeting emphasis.
2. Remove percentage muscle distribution, all prior sets and rest text from day preview.
3. Make both days visibly swap: pickup, ghost, named destination, two-way travel, settle highlight, specific Undo.
4. Keep kg/reps/RIR input shell identical in height; remove all text under RIR choices.
5. Give PR rows a persistent gold hairline, subtle fill and small PR label; preserve normal numeral weight.
6. Hide the form poster in exercise History; show one defined metric and its actual dated sets.
7. Standardize sheet anatomy and task-appropriate detents; reduce menu captions and icon disks.
8. Strip exercise collages and redundant stats from History; use one saved-session summary strip.
9. Split Progress into Training/Body weight; limit recent records and disclose coverage counting.
10. Simplify setup, Settings and program editing into short rows with details on demand.
