import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { action } from './_generated/server';
import { internal } from './_generated/api';
import { provider } from './music/model';
import { config, problem, SPOTIFY_SCOPES, YOUTUBE_SCOPE } from './music/api';
import { sha256Hex } from './tokens';

export const connect = action({
  args: { provider, returnTo: v.string() }, returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return problem('SIGN_IN');
    const cfg = config(args.provider);
    const app = new URL(cfg.appUrl), target = new URL(args.returnTo);
    if (app.origin !== target.origin || !['/', '/workout', '/settings'].includes(target.pathname)) return problem('INVALID_RETURN');
    const state = [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
    await ctx.runMutation(internal.musicStore.saveState, { userId, provider: args.provider, stateHash: await sha256Hex(state), returnTo: `${app.origin}${target.pathname}` });
    const url = new URL(args.provider === 'spotify' ? 'https://accounts.spotify.com/authorize' : 'https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: cfg.redirect, response_type: 'code', state,
      scope: args.provider === 'spotify' ? SPOTIFY_SCOPES : YOUTUBE_SCOPE,
      ...(args.provider === 'youtube' ? { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'false' } : {}),
    }).toString();
    return url.toString();
  },
});
