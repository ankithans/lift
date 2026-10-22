# WHOOP in Lift

Research and implementation: 22 October 2026. Base: committed Mobbin R2 redesign. The later calendar brief and fixed-row constraint supersede the earlier quiet-row proposal. The supplied `/tmp/whoop-mock/m.html` was opened and visually inspected before UI implementation.

## Decision

WHOOP belongs to **dates** in the existing week, alongside the strength plan. Keep TodayHero's Start/Resume action, add a short recovery sentence below its support text, and merge a compact sensor summary into WeekSection. Every past/current date has one metric line; future slots have no fabricated readings. Activities are inline indicators that open a day sheet. No additional activity row, motivational card, or second workout CTA.

This deliberately supersedes **“Recovery / freshness: cut in v1”** in `research/mobbin-r2/redesign.md`: WHOOP now supplies sensor data. Weekly set counts still must not be presented as recovery. UI previews and synthetic test fixtures are explicitly marked and do not establish real account data.

## Ranked findings

1. **WHOOP: three legible scores, deeper explanations on demand.** The summary uses recovery, sleep and strain with compact rings; sleep detail separates contributors and a dated history. Adopt the source's recovery bands and explanatory hierarchy, reduce the rings to 18px in date rows. Reject a second dashboard above Start. References: `whoop--summary`, `whoop--sleep-breakdown`, `whoop--sleep-history`, `whoop--metrics-grid`.
2. **Apple Health / Fitness: dates and honest missing columns.** Health shows a short summary sparkline and a weekly bar detail with absent days left blank. Fitness gives the current date a clear marker in a week rail and keeps activity types in a list. Adopt seven aligned columns, today marker, separate scales and labelled series. Do not connect the strain line over missing days. New phone crops: `apple-health--dated-summary`, `apple-health--weekly-bars`; live collection URLs below.
3. **Oura: source attribution and gentle interpretation.** The Android readiness capture pairs a score with dated bars, HR detail provides a separate chart, rest mode makes recovery legitimate. The iOS activity summary explicitly attributes its source. Adopt source/time labels and keep suggestions conditional. The Dec 2023 Android captures are structural references, not claims about today's Oura.
4. **Bevel: summary → specific metric detail.** Dashboard groups recovery/sleep/strain; deep sleep and strain views add trends, dates and contributors. Adopt trend tabs and a compact definition under each selected metric. Avoid repeating large rings inside every metric block. `bevel--dashboard`, `bevel--recovery-detail`, `bevel--sleep-detail`, `bevel--strain-detail`, `bevel--sleep-history`.
5. **Garmin / Strava: activity overview before dense charts.** Garmin's visible run overview groups duration and HR; its Charts view separates pace and HR. Strava's run detail puts small numeric facts below a source activity, then provides a lap chart. Lift uses sport, duration, strain on the day sheet, then avg/max HR, zones and kJ. Maps and feed chrome add no value to this integration.
6. **Gentler Streak: permission to rest.** A rest day is an ordinary recommendation with contextual tone. Lift's suggestion is “Consider one fewer set or leave 3–4 reps in reserve,” never a blocked Start action. Dismiss per date; suppress if today's score is stale, pending, unscorable or calibrating.
7. **Hevy / Ladder / Fitbod: connections stay in Settings.** Hevy has explicit Health connection controls, Ladder groups connected apps in Settings and uses a calendar for activity, Fitbod makes export destinations explicit. Adopt one Connections value row and a small connect sheet explaining the data and disconnect behavior. No onboarding takeover.
8. **Bearable-style calendar: optional context, not a diagnosis.** Bevel's inspected mood calendar offers an adjacent pattern for dated context. Bearable itself and Athlytic were searched in the logged-in Mobbin search and no exact app was returned; no behaviors are attributed to them.

## Evidence and acquisition

Mobbin was already logged in as Ankit in Chrome. T3 preview snapshots timed out twice; research continued in an agent-created Chrome tab. Live collections inspected: WHOOP (772 screens), Garmin Connect (731), Strava (709), Apple Fitness (167), Apple Health (214). Existing Mobbin UI downloads were newly inspected locally for Oura, Bevel, Gentler Streak, Hevy, Fitbod and Ladder. Contact-sheet sampling was followed by selected full phone captures. The archive captures and live thumbnail crops are distinguished in `references/manifest.json` and `references/new-browser-references.json`. Browser asset export retained previously observed assets across navigation; those exports are used only where the visible image can be identified, not as evidence of a different app.

Selected phone screenshots are under `references/`; Lift verification screenshots are under `screens/`. No desktop catalog screenshot is substituted for a phone reference. Captures prove visible structure, not animation, haptics, current product availability, or an inaccessible state. Pending/stale design is a Lift proposal informed by source labels and absent-data patterns, not a claim that all references demonstrate it.

### Source collections

- [WHOOP](https://mobbin.com/apps/whoop-ios-f2d3db04-8fb3-4e1d-ada4-f5dc133be818/ff42691a-a36c-4a33-80c5-a349c719dfcb/screens)
- [Oura iOS](https://mobbin.com/apps/oura-ios-a3164d3a-474c-4ecb-8180-67acda881aa6/601b4b29-6c80-4544-8c4f-28e8c9a8f0bc/screens); Oura Android provenance is retained in the earlier `research/mobbin-r2/manifest.json`.
- [Bevel](https://mobbin.com/apps/bevel-ios-4e7bb614-26f2-4464-a26b-9314adeef824/07003fc7-0512-4a41-b38d-e54efc4d5ec3/screens)
- [Garmin Connect](https://mobbin.com/apps/garmin-connect-ios-0463877a-79d0-44f8-8e13-268fd9a3014a/bfff1615-bc86-432d-bc39-9f642e743bb2/screens)
- [Strava](https://mobbin.com/apps/strava-ios-1ac190cf-46ee-4c65-845d-38bb8354219d/0581b139-5dc9-492d-89ad-da56951a027b/screens)
- [Apple Fitness](https://mobbin.com/apps/apple-fitness-ios-f8b3622e-9edd-41af-b49e-41f6528b1da3/41d59266-03f6-4bed-91bf-f84557ccf8c1/screens)
- [Apple Health](https://mobbin.com/apps/apple-health-ios-76436d76-126b-42ea-a287-9bb453f8d97f/9b150bfa-4e95-489c-9dc0-4af8396899bf/screens)
- [Gentler Streak](https://mobbin.com/apps/gentler-streak-ios-ccc0bb26-39b3-48fa-862d-2df69182840e/91403472-6e15-413b-ae56-0ad41f2ca6d2/screens)
- [Hevy](https://mobbin.com/apps/hevy-ios-cf2a2ec4-b4c9-4a33-96b3-c316e7165a3b/2e8aa5bb-1d4e-46e1-a60c-43919883fbb7/screens)
- [Fitbod](https://mobbin.com/apps/fitbod-ios-3bdabe9b-9287-43ff-9758-82b6558538a9/78b57dd0-e0fb-446f-b5ed-b90dc28cd58c/screens)
- [Ladder](https://mobbin.com/apps/ladder-ios-74898326-8455-4641-a83d-03851ba164dc/b2fd8ade-0fd6-4e24-9cee-20941ca4b603/screens)

## Wireframes and geometry

```
Thu 22 Oct
Train
Today
Push
6 exercises · about 40 min
◉ 48% recovery · keep 2–3 reps in reserve        [dismiss in sheet]
[                  Start Push                  ]

This week                                  ‹  ›
18–24 Oct · 2 of 4 sessions
61% avg recovery     11.8 avg strain    7h 06 avg sleep
 ▆   ▅   ▃   ▄   ─   ─   ─       blue strain line: 0–21
 S   M   T   W   T   F   S          respects user's week start

Thu 22   Push                              Today
         ◉48%  ▰ 4.1 so far · 7h 33       [activity icon]
Fri 23   Rest
         ◉70%  ▰ 10.6 · 6h 58            [run +1]
Sat 24   Pull                                 ›
                       Arrange week
```

Uniform slot height: **76px connected, 60px arranging/disconnected**. All slots, including future/rest days, share the mode's height. Metric text is 12px tabular, single-line and truncates. A separate 32px minimum sensor/activity control is a sibling of the existing day navigation button; it opens the day sheet, preserving row navigation, weekday prefix and `data-handle`. Arrange hides the summary, metrics and activity controls, and uses the original 60px math for drop and settle.

The week mini chart has recovery bars (0–100), blue strain line (0–21), explicit legend, today label and empty stubs; averages include only available readings and show their sample counts in the sheet. Today's incomplete strain is labelled “so far.” Missing values are dashes; no synthetic zero. Averages follow the displayed week. 14-day detail reuses `LineChart`, with accessible dated values available in a table.

## Data semantics

A cycle maps to the user's IANA timezone date at cycle start. Recovery and the main sleep join that cycle; last night's sleep belongs to this morning's cycle, including across DST. Activities map by their own local start date. WHOOP strain is cardiovascular load and is not equivalent to Lift's sets/volume.

Only strength/weightlifting activities with ≥60% overlap of **both** time intervals are matched to completed Lift sessions. Matching is derived on query, so edits/deletions remain correct. The activity is suppressed as a duplicate and its strain/HR/kJ is attached to the Lift session in the day and history sheet. Runs and unrelated activities remain separate.

Offline readings are cached per signed-in Lift user and week; disconnect/sign-out clears them. Offline/stale badges keep the last sync time visible and disable live actions. No advice is generated from stale readings. The integration uses the host's color tokens and reduced-motion rules, with green/yellow/red plus numeric/text labels rather than color alone.

## API references

- [WHOOP v2 OpenAPI](https://api.prod.whoop.com/developer/doc/openapi.json)
- [OAuth and rotating refresh tokens](https://developer.whoop.com/docs/developing/oauth/)
- [v2 webhooks and signature specification](https://developer.whoop.com/docs/developing/webhooks/)
- [Account/device requirements](https://developer.whoop.com/docs/developing/support/)

The initial implementation uses the 30-minute cron and manual sync; no webhook is registered. The OAuth callback is `/whoop/callback`. No production deployment or production environment mutation is authorized.
