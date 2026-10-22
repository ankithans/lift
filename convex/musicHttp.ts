import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { sha256Hex } from './tokens';
import { config, num, obj, parseTokens, ProviderError, request, SPOTIFY_SCOPES, YOUTUBE_SCOPE } from './music/api';
import type { Provider } from './music/model';
import type { Doc } from './_generated/dataModel';

function callback(provider: Provider): ReturnType<typeof httpAction> {
  return httpAction(async (ctx, req): Promise<Response> => {
    const url = new URL(req.url), rawState = url.searchParams.get('state');
    if (!rawState || rawState.length > 128) return new Response('Invalid music connection state.', { status: 400 });
    const state: Doc<'musicStates'> | null = await ctx.runMutation(internal.musicStore.consumeState, { provider, stateHash: await sha256Hex(rawState) });
    if (!state) return new Response('This connection link expired or was already used. Return to Lift and connect again.', { status: 400 });
    const destination = new URL(state.returnTo);
    let outcome = 'error';
    try {
      const code = url.searchParams.get('code');
      if (url.searchParams.has('error')) outcome = 'cancelled';
      else if (code && code.length < 4096) {
        const cfg = config(provider);
        if (!await ctx.runMutation(internal.musicStore.budget, { provider })) throw new Error('Rate limited');
        const t = parseTokens(await request(cfg.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: cfg.redirect, client_id: cfg.clientId, client_secret: cfg.secret }).toString() }), true);
        const scopes = t.scope.split(' ');
        const required = provider === 'spotify' ? SPOTIFY_SCOPES.split(' ') : [YOUTUBE_SCOPE];
        // Google sometimes omits scope in token responses; Spotify returns granted scopes.
        if (t.scope && required.some(s => !scopes.includes(s))) throw new Error('Missing granted scope');
        let premium: boolean | undefined;
        if (provider === 'spotify') {
          if (!await ctx.runMutation(internal.musicStore.budget, { provider })) throw new Error('Rate limited');
          const profile = obj(await request('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${t.accessToken}` } }));
          if (typeof profile.product === 'string') premium = profile.product === 'premium';
        }
        await ctx.runMutation(internal.musicStore.install, { stateId: state._id, userId: state.userId, provider, ...t, refreshToken: t.refreshToken!, premium });
        outcome = 'connected';
      }
    } catch (e) {
      destination.searchParams.set('music_reason', e instanceof ProviderError ? String(num(e.status)) : 'connection_failed');
    }
    destination.searchParams.set('music', outcome);
    destination.searchParams.set('source', provider);
    return new Response(null, { status: 303, headers: { Location: destination.toString(), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  });
}
export const spotifyCallback = callback('spotify');
export const youtubeCallback = callback('youtube');
