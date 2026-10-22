import { ConvexError, v } from 'convex/values';
import { action } from './_generated/server';
import { internal } from './_generated/api';
import { collection, libraryPage, musicItem, type LibraryPage, type MusicItem } from './music/model';
import { arr, num, obj, owner, problem, providerRequest, ProviderError, safeError, str, token } from './music/api';

export function spotifyItem(raw: unknown, playlist = false): MusicItem | null {
  const r = obj(raw), id = str(r.id);
  if (!id || r.is_local === true || !str(r.name)) return null;
  const image = str(obj(arr(playlist ? r.images : obj(r.album).images)[0]).url) || undefined;
  return { id, title: str(r.name), subtitle: playlist ? str(obj(r.owner).display_name) || 'Playlist' : arr(r.artists).map(x => str(obj(x).name)).filter(Boolean).join(', '), image,
    url: `https://open.spotify.com/${playlist ? 'playlist' : 'track'}/${id}`, uri: `spotify:${playlist ? 'playlist' : 'track'}:${id}`, kind: playlist ? 'playlist' : 'track' };
}
export const library = action({
  args: { collection, playlistId: v.optional(v.string()), cursor: v.optional(v.string()) }, returns: libraryPage,
  handler: async (ctx, a): Promise<LibraryPage> => {
    const c = await owner(ctx, 'spotify');
    const offset = a.cursor === undefined ? 0 : Number(a.cursor);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100_000 || (a.playlistId && !/^[a-zA-Z0-9]{22}$/.test(a.playlistId))) return problem('INVALID_REQUEST');
    if (a.collection === 'playlist' && !a.playlistId) return problem('INVALID_REQUEST');
    const key = `spotify:${a.collection}:${a.playlistId ?? ''}:${offset}`;
    const cached = await ctx.runQuery(internal.musicStore.cache, { connectionId: c._id, key, now: Date.now() });
    if (cached) return cached;
    const path = { liked: '/me/tracks', top: '/me/top/tracks', recent: '/me/player/recently-played', playlists: '/me/playlists', playlist: `/playlists/${a.playlistId}/items` }[a.collection];
    try {
      const r = obj(await providerRequest(ctx, c, `${path}?limit=50${a.collection === 'recent' ? '' : `&offset=${offset}`}`));
      const items = arr(r.items).map(raw => { const entry = obj(raw); return spotifyItem(a.collection === 'liked' || a.collection === 'recent' ? entry.track : a.collection === 'playlist' ? entry.item ?? entry.track : raw, a.collection === 'playlists'); }).filter((x): x is MusicItem => x !== null);
      const page = { items, ...(r.next && a.collection !== 'recent' ? { next: String(offset + 50) } : {}) };
      await ctx.runMutation(internal.musicStore.putCache, { connectionId: c._id, key, page });
      return page;
    } catch (e) { return safeError(e); }
  },
});
const device = v.object({ id: v.string(), name: v.string(), active: v.boolean(), restricted: v.boolean(), type: v.string() });
export const devices = action({
  args: {}, returns: v.array(device),
  handler: async ctx => {
    const c = await owner(ctx, 'spotify');
    try { return arr(obj(await providerRequest(ctx, c, '/me/player/devices')).devices).map(obj).filter(d => typeof d.id === 'string').slice(0, 50).map(d => ({ id: str(d.id), name: str(d.name), active: d.is_active === true, restricted: d.is_restricted === true, type: str(d.type) })); }
    catch (e) { return safeError(e); }
  },
});
export const playback = action({
  args: {}, returns: v.object({ playing: v.boolean(), item: v.optional(musicItem), device: v.optional(v.string()), progressMs: v.number(), durationMs: v.number(), restricted: v.boolean() }),
  handler: async ctx => {
    const c = await owner(ctx, 'spotify');
    try {
      const r = obj(await providerRequest(ctx, c, '/me/player'));
      return { playing: r.is_playing === true, item: spotifyItem(r.item) ?? undefined, device: str(obj(r.device).name) || undefined, progressMs: num(r.progress_ms), durationMs: num(obj(r.item).duration_ms), restricted: obj(r.device).is_restricted === true };
    } catch (e) { return safeError(e); }
  },
});
export const queue = action({
  args: {}, returns: v.array(musicItem),
  handler: async ctx => {
    const c = await owner(ctx, 'spotify');
    try { return arr(obj(await providerRequest(ctx, c, '/me/player/queue')).queue).slice(0, 50).map(x => spotifyItem(x)).filter((x): x is MusicItem => x !== null); }
    catch (e) { return safeError(e); }
  },
});
export const control = action({
  args: { command: v.union(v.literal('play'), v.literal('pause'), v.literal('next'), v.literal('previous'), v.literal('transfer')), deviceId: v.optional(v.string()), contextUri: v.optional(v.string()), uris: v.optional(v.array(v.string())) }, returns: v.null(),
  handler: async (ctx, a) => {
    const c = await owner(ctx, 'spotify');
    if (c.premium === false) return problem('PREMIUM');
    if (a.deviceId && (a.deviceId.length > 256 || !/^[\w-]+$/.test(a.deviceId))) return problem('INVALID_REQUEST');
    if (a.contextUri && !/^spotify:(playlist|album):[a-zA-Z0-9]{22}$/.test(a.contextUri)) return problem('INVALID_REQUEST');
    if (a.uris && (!a.uris.length || a.uris.length > 50 || a.uris.some(u => !/^spotify:track:[a-zA-Z0-9]{22}$/.test(u)))) return problem('INVALID_REQUEST');
    if ((a.contextUri && a.uris) || (a.command === 'transfer' && !a.deviceId)) return problem('INVALID_REQUEST');
    const path = a.command === 'transfer' ? '/me/player' : `/me/player/${a.command}`;
    const body = a.command === 'transfer' ? { device_ids: [a.deviceId], play: false } : a.command === 'play' ? { ...(a.contextUri ? { context_uri: a.contextUri } : {}), ...(a.uris ? { uris: a.uris } : {}) } : undefined;
    try {
      await providerRequest(ctx, c, path + (a.deviceId && a.command !== 'transfer' ? `?device_id=${encodeURIComponent(a.deviceId)}` : ''), { method: a.command === 'next' || a.command === 'previous' ? 'POST' : 'PUT', ...(body ? { body: JSON.stringify(body) } : {}) });
      await ctx.runMutation(internal.musicStore.mark, { connectionId: c._id, premium: true });
      return null;
    } catch (e) {
      if (e instanceof ProviderError && e.status === 403 && (e.reason === 'PREMIUM_REQUIRED' || e.reason === 'premium_required')) {
        await ctx.runMutation(internal.musicStore.mark, { connectionId: c._id, premium: false }); return problem('PREMIUM');
      }
      return safeError(e);
    }
  },
});
// The SDK needs a bearer token in memory. No refresh token, secret or token-bearing URL leaves the server.
export const sdkToken = action({
  args: {}, returns: v.object({ accessToken: v.string(), expiresAt: v.number() }),
  handler: async (ctx): Promise<{ accessToken: string; expiresAt: number }> => {
    const c = await owner(ctx, 'spotify');
    if (c.premium === false) throw new ConvexError('PREMIUM');
    const accessToken = await token(ctx, c);
    const current = await ctx.runQuery(internal.musicStore.getConnection, { connectionId: c._id });
    if (!current || current.status !== 'connected') return problem('RECONNECT');
    return { accessToken, expiresAt: current.expiresAt };
  },
});
