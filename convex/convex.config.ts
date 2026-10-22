import { defineApp } from 'convex/server';
import { v } from 'convex/values';
import rateLimiter from '@convex-dev/rate-limiter/convex.config';
const app = defineApp({ env: {
  WHOOP_CLIENT_ID: v.optional(v.string()), WHOOP_CLIENT_SECRET: v.optional(v.string()),
  WHOOP_WEBHOOK_SECRET: v.optional(v.string()),
  WHOOP_APP_URL: v.optional(v.string()), WHOOP_REDIRECT_URI: v.optional(v.string()),
  SPOTIFY_CLIENT_ID: v.optional(v.string()), SPOTIFY_CLIENT_SECRET: v.optional(v.string()),
  SPOTIFY_APP_URL: v.optional(v.string()), SPOTIFY_REDIRECT_URI: v.optional(v.string()),
  YOUTUBE_CLIENT_ID: v.optional(v.string()), YOUTUBE_CLIENT_SECRET: v.optional(v.string()),
  YOUTUBE_APP_URL: v.optional(v.string()), YOUTUBE_REDIRECT_URI: v.optional(v.string()),
} });
app.use(rateLimiter);
export default app;
