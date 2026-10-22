# Music in Lift

Research started 22 October 2026, before implementation. The workout owner's header/keypad contract supersedes the original bottom mini-player brief.

## Ranked findings and decisions

1. **Future Pro: music is secondary to session status.** The inspected workout places a music-note entry at the top beside time and pause. Adopt a header entry; avoid filling Lift's occupied rest/keypad/toast edge. `references/future--workout-controls.png`.
2. **Ladder: explicitly optional connection.** Its Apple Music connect view has a visible Skip action. The session keeps timer and exercise first; its queue is a drilldown. Adopt optional connection in Settings and a workout sheet. No Train-home module. `ladder--connect-music`, `ladder--queue`, `ladder--session`, `ladder--rest`.
3. **Spotify: identity → transport → destination.** Full now-playing exposes song/artist, a dominant pause, previous/next, device and queue icons. Adopt that hierarchy with 44px targets, explicit device names and provider attribution; reject Canvas and lyrics in a strength logger. [Phone source](https://mobbin.com/screens/67fde0ef-addf-4773-a3e9-f31ada2dbfb2).
4. **Apple Music: readable transport without competing actions.** The inspected lyrics/player view retains title/artist and three distinct transport controls; output destination and queue are secondary. Lift uses the same transport order, without lyrics. [Phone source](https://mobbin.com/screens/cb958c7e-d09c-4a3c-95dd-4f14b2dbd066).
5. **YouTube Music: stable song identity and discoverable Up next.** The selected Flowers view places art, title/artist, transport, then Up next/Lyrics/Related. Lift uses a visible official video player and an explicit queue, without pretending the Data API is a native Music API. [Phone source](https://mobbin.com/screens/d9b90824-ac50-4e7a-a306-28f3d2d0b39d).
6. **SoundCloud: compact identity persists while browsing.** Its playlist view keeps a small now-playing strip; the expanded view separates transport from feed. Adopt title/art plus pause/next in Lift's header, with separate sibling buttons. [Playlist](https://mobbin.com/screens/e15f41f6-ea7b-4c83-8466-5c3cd3c154b4), [expanded](https://mobbin.com/screens/496b91f6-4043-4958-961f-e97c73c67fe3).
7. **Peloton Strength+, Nike Training Club: don't compete with the session.** Inspected captures make timer and exercise/video primary, with a small control rail. They do not establish a Spotify integration. Adopt hierarchy only. `peloton--session`, `nike-training--session-controls`.
8. **Hevy / Fitbod: keypad owns the editing surface.** Their inspected logger/keypad views reinforce hiding music controls during entry. Adopt zero change to keypad geometry. `hevy--session`, `fitbod--keypad`.

## Evidence

Logged-in Mobbin in Chrome: Spotify (588 screens; Audio Player filter 2), Apple Music (253; Audio Player 1), YouTube Music (150; Audio Player 1), SoundCloud (Audio Player 3). Selected current phone screenshots are cropped from visible Mobbin phone previews, not desktop catalogs. Some are 249px thumbnail crops, identified by their dimensions. Page-assets export retained unrelated prior-page images, so those exports were rejected.

Fitness references were newly inspected from the existing user-downloaded Mobbin archives in Downloads: Future Pro, Nike Training Club, Hevy Oct 2025, Fitbod Jun 2022, Ladder Jul 2024, plus the Peloton Strength+ phone. Archive dates are not claims about current app behavior. Existing source collection provenance remains in `research/mobbin*/manifest.json` and `research/whoop/README.md`. Static screenshots establish layout, not animation, haptics or integrations absent from the capture.

## Wireframes

```text
⌄ Push                                      Finish
  12:04 · 3/18 sets
                  [art  Track · artist] [Ⅱ] [›]  ← 44px header row
───────────────────────────────────────────────
Set logger (unchanged)
...
RestStrip OR keypad (unchanged)
```

The entire music row collapses while editing. The sheet opens only through `openMenu`, committing the draft and closing the keypad. `bottomLayer`, toast position and main bottom padding stay unchanged. Shared Sheet owns Back, focus and toast placement.

```text
Music                                      ×
[Spotify             | YouTube Music       ]
Art / title / artist / provider link
           [previous] [play/pause] [next]
[Listening on: device                  ▾]
[Liked] [Top] [Playlists] [Recent] [Queue]
Track rows: art / title / artist / play

YouTube: visible ≥200×200 official player,
always above the scrollable library.
“Keep this player visible. Open in YouTube Music
for listening while Lift is closed or locked.”
```

At 360px, source choices fit two equal columns; favourites wrap. Titles truncate visually but retain full accessible names. Explicit actions announce results; automatic polling/track changes never announce. Use host surface/raised/line/ink/muted tokens in both themes, mint only for selection/primary action, no new animation. Train and WHOOP remain unchanged.

## Platform references

- [Spotify February 2026 changes](https://developer.spotify.com/documentation/web-api/references/changes/february-2026): playlist items use `/items`; `product` may be absent from `/me`. Premium is checked in the real account dashboard and enforced by playback endpoints/SDK, not inferred from a missing field.
- [Spotify SDK](https://developer.spotify.com/documentation/web-playback-sdk): Premium required; an owner-only access-token action is the sole client token exception.
- [YouTube IFrame reference](https://developers.google.com/youtube/iframe_api_reference): minimum viewport 200×200; controls must fit. Lift keeps a 200px-tall full-width player.
- [YouTube developer policies](https://developers.google.com/youtube/terms/developer-policies): no background/hidden player. Pause on sheet close, source switch, cover, scrolling out of view and document hide. iOS PWAs also suspend IFrame audio when backgrounded/locked. Offer `music.youtube.com` links.
- Separate Google authorization requests only `youtube.readonly`; never mix it into Convex Auth login. Sensitive scope is unverified; owner may continue through Google's app warning. No verification submission.

## Account setup

Spotify Lift: development mode, Web API + Web Playback SDK, both Convex callbacks, requested account allowlisted. Premium confirmed in account overview. Real revealed ID/secret saved in Keychain before use. Google Lift (`lift-512410`): YouTube Data API v3 enabled; reuse Lift web OAuth client with separate `/youtube/callback` redirects. Credentials stay outside git.
