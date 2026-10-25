# Lift

An agent-native workout tracker. Live at [lift.ankithans.com](https://lift.ankithans.com).

Plan a weekly program, log sets from your phone (offline included), and track PRs and progress. Every action in the app is also exposed as an MCP tool, so an AI agent can do anything you can.

## Features

- **Programs**: start from a template or build your own, then rearrange the week by dragging days
- **Workout logging**: a set keypad, RIR, warm-ups, supersets, rest timers with notifications, and live PR detection
- **Offline**: the app shell is cached, and sets go into a durable outbox that syncs when you're back online
- **History and progress**: edit past workouts, see per-exercise trends and bodyweight
- **MCP server** at `/mcp`: create an API token in Settings and connect any MCP client
- **WHOOP**: recovery, sleep and strain shown on the calendar alongside workouts
- **Music**: control Spotify or YouTube from a floating player during a workout

## Stack

[TanStack Start](https://tanstack.com/start) + React 19 + Tailwind v4 on Cloudflare Workers, and [Convex](https://convex.dev) for the database, auth (Google + password), crons and HTTP endpoints.

```
src/        UI routes and components
convex/     backend: core commands, MCP tool registry, WHOOP/Spotify/YouTube integrations
scripts/    deploy, admin, and data import helpers
```

## Development

```sh
bun install
npx convex dev   # in one terminal
bun run dev      # http://localhost:3000
```

Auth keys for Convex Auth can be generated with `node scripts/gen-auth-keys.mjs`. The WHOOP, Spotify and YouTube integrations need their own OAuth client IDs and secrets set as Convex env vars (`WHOOP_*`, `SPOTIFY_*`, `YOUTUBE_*`).

Tests: `npx vitest`
