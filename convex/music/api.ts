import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';
import { internal } from '../_generated/api';
import { env, type ActionCtx } from '../_generated/server';
import type { Doc } from '../_generated/dataModel';
import type { Provider } from './model';

export const SPOTIFY_SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing streaming user-read-email user-read-private user-library-read user-top-read user-read-recently-played playlist-read-private playlist-read-collaborative';
export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
export const obj = (x: unknown): Record<string, unknown> => x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {};
export const str = (x: unknown) => typeof x === 'string' ? x : '';
export const arr = (x: unknown): unknown[] => Array.isArray(x) ? x : [];
export const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x) ? x : 0;
export const problem = (code: string): never => { throw new ConvexError(code); };

export function config(p: Provider) {
  const clientId = p === 'spotify' ? env.SPOTIFY_CLIENT_ID : env.YOUTUBE_CLIENT_ID;
  const secret = p === 'spotify' ? env.SPOTIFY_CLIENT_SECRET : env.YOUTUBE_CLIENT_SECRET;
  const appUrl = p === 'spotify' ? env.SPOTIFY_APP_URL : env.YOUTUBE_APP_URL;
  const redirect = (p === 'spotify' ? env.SPOTIFY_REDIRECT_URI : env.YOUTUBE_REDIRECT_URI) ?? `${env.CONVEX_SITE_URL}/${p}/callback`;
  if (!clientId || !secret || !appUrl) return problem('NOT_CONFIGURED');
  return { clientId, secret, appUrl, redirect, tokenUrl: p === 'spotify' ? 'https://accounts.spotify.com/api/token' : 'https://oauth2.googleapis.com/token' };
}
export class ProviderError extends Error {
  constructor(public status: number, public retryMs = 60_000, public reason = '') { super(`Music provider response ${status}`); }
}
export async function request(url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) {
    let reason = '';
    try { const body = obj(await r.json()); const error = obj(body.error); reason = str(error.reason) || str(obj(arr(error.errors)[0]).reason) || str(body.error); } catch { /* no raw provider body in errors */ }
    const retry = r.headers.get('retry-after');
    throw new ProviderError(r.status, Math.min(24 * 3600_000, Math.max(1000, retry ? Number(retry) * 1000 || Date.parse(retry) - Date.now() : 60_000)), reason);
  }
  // Player commands have no response model. Spotify can acknowledge a command
  // with 200 + plain text as well as 204; parsing that success as JSON made
  // working remote controls report NETWORK and left the UI out of sync.
  const playerCommand = url.startsWith('https://api.spotify.com/v1/me/player') && (init.method === 'PUT' || init.method === 'POST');
  return r.status === 204 || playerCommand ? null : await r.json() as unknown;
}
export function parseTokens(raw: unknown, requireRefresh: boolean) {
  const r = obj(raw);
  if (!str(r.access_token) || num(r.expires_in) <= 0 || (requireRefresh && !str(r.refresh_token))) throw new Error('Invalid token response');
  return { accessToken: str(r.access_token), refreshToken: str(r.refresh_token) || undefined, expiresAt: Date.now() + num(r.expires_in) * 1000, scope: str(r.scope) };
}
export async function owner(ctx: ActionCtx, p: Provider): Promise<Doc<'musicConnections'>> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return problem('SIGN_IN');
  return await ctx.runMutation(internal.musicStore.authorize, { userId, provider: p });
}
export async function token(ctx: ActionCtx, original: Doc<'musicConnections'>): Promise<string> {
  let c = original;
  for (let attempt = 0; attempt < 12; attempt++) {
    if (c.status !== 'connected') return problem('RECONNECT');
    if (c.expiresAt > Date.now() + 60_000) return c.accessToken;
    const lease = crypto.randomUUID();
    const state: string = await ctx.runMutation(internal.musicStore.claimRefresh, { connectionId: c._id, lease });
    if (state === 'reconnect') return problem('RECONNECT');
    if (state === 'claimed') {
      const cfg = config(c.provider);
      try {
        if (!await ctx.runMutation(internal.musicStore.budget, { provider: c.provider })) {
          // No refresh request was sent, so this lease can safely be released.
          await ctx.runMutation(internal.musicStore.releaseRefresh, { connectionId: c._id, lease });
          return problem('RATE_LIMITED');
        }
        const t = parseTokens(await request(cfg.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: c.refreshToken, client_id: cfg.clientId, client_secret: cfg.secret }).toString() }), false);
        if (!await ctx.runMutation(internal.musicStore.finishRefresh, { connectionId: c._id, lease, accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt })) return problem('RECONNECT');
        return t.accessToken;
      } catch (e) {
        if (e instanceof ConvexError) throw e;
        if (e instanceof ProviderError && e.status === 429) {
          await ctx.runMutation(internal.musicStore.releaseRefresh, { connectionId: c._id, lease });
          await ctx.runMutation(internal.musicStore.mark, { connectionId: c._id, blockedUntil: Date.now() + e.retryMs });
          return problem('RATE_LIMITED');
        }
        // Ambiguous transport failures may have rotated the token: reconnect instead of replay.
        await ctx.runMutation(internal.musicStore.mark, { connectionId: c._id, revoked: true });
        return problem('RECONNECT');
      }
    }
    if (state === 'wait') await new Promise(resolve => setTimeout(resolve, 250));
    const current = await ctx.runQuery(internal.musicStore.getConnection, { connectionId: c._id });
    if (!current) return problem('RECONNECT');
    c = current;
  }
  return problem('REFRESH_BUSY');
}
export async function providerRequest(ctx: ActionCtx, c: Doc<'musicConnections'>, path: string, init: RequestInit = {}): Promise<unknown> {
  const access = await token(ctx, c);
  if (!await ctx.runMutation(internal.musicStore.budget, { provider: c.provider })) return problem('RATE_LIMITED');
  try {
    return await request(`${c.provider === 'spotify' ? 'https://api.spotify.com/v1' : 'https://www.googleapis.com/youtube/v3'}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers, Authorization: `Bearer ${access}` } });
  } catch (e) {
    if (e instanceof ProviderError) {
      if (e.status === 401) { await ctx.runMutation(internal.musicStore.mark, { connectionId: c._id, revoked: true }); return problem('RECONNECT'); }
      if (e.status === 429 || e.reason === 'quotaExceeded') {
        await ctx.runMutation(internal.musicStore.mark, { connectionId: c._id, blockedUntil: Date.now() + e.retryMs });
        return problem('RATE_LIMITED');
      }
    }
    throw e;
  }
}
export function safeError(e: unknown): never {
  if (e instanceof ConvexError) throw e;
  // Preserve Spotify's machine-readable reason, never its raw response/body.
  if (e instanceof ProviderError) {
    const code = e.status === 404 ? 'NO_DEVICE' : e.status === 403 ? 'UNAVAILABLE' : 'NETWORK';
    const reason = /^[a-zA-Z0-9_ -]{1,80}$/.test(e.reason) ? e.reason : '';
    throw new ConvexError({ code, status: e.status, ...(reason ? { reason } : {}) });
  }
  return problem('NETWORK');
}
