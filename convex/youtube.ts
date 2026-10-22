import { v } from 'convex/values';
import { action } from './_generated/server';
import { internal } from './_generated/api';
import { libraryPage, type LibraryPage, type MusicItem } from './music/model';
import { arr, obj, owner, problem, providerRequest, ProviderError, safeError, str } from './music/api';

export function youtubeItem(raw: unknown, playlist: boolean): MusicItem | null {
  const r = obj(raw), s = obj(r.snippet), id = playlist ? str(r.id) : str(obj(s.resourceId).videoId);
  if (!id || !str(s.title) || ['Deleted video', 'Private video'].includes(str(s.title))) return null;
  return { id, title: str(s.title), subtitle: str(s.videoOwnerChannelTitle) || str(s.channelTitle), image: str(obj(obj(s.thumbnails).medium).url) || str(obj(obj(s.thumbnails).default).url) || undefined,
    url: `https://music.youtube.com/${playlist ? 'playlist?list=' : 'watch?v='}${encodeURIComponent(id)}`, kind: playlist ? 'playlist' : 'track' };
}
export const library = action({
  args: { collection: v.union(v.literal('liked'), v.literal('playlists'), v.literal('playlist')), playlistId: v.optional(v.string()), cursor: v.optional(v.string()) }, returns: libraryPage,
  handler: async (ctx, a): Promise<LibraryPage> => {
    const c = await owner(ctx, 'youtube');
    if ((a.cursor && (a.cursor.length > 512 || !/^[\w=.-]+$/.test(a.cursor))) || (a.playlistId && !/^[\w-]{2,100}$/.test(a.playlistId)) || (a.collection === 'playlist' && !a.playlistId)) return problem('INVALID_REQUEST');
    const key = `youtube:${a.collection}:${a.playlistId ?? ''}:${a.cursor ?? ''}`;
    const cached = await ctx.runQuery(internal.musicStore.cache, { connectionId: c._id, key, now: Date.now() });
    if (cached) return cached;
    try {
      const query = new URLSearchParams({ part: 'snippet', maxResults: '50', ...(a.cursor ? { pageToken: a.cursor } : {}) });
      let notice: string | undefined = a.collection === 'liked' ? 'These are liked YouTube videos and may include non-music videos. Your YouTube Music library can differ.' : undefined;
      let raw: unknown;
      if (a.collection === 'playlists') {
        query.set('mine', 'true');
        raw = await providerRequest(ctx, c, `/playlists?${query}`);
      } else {
        query.set('playlistId', a.collection === 'liked' ? 'LM' : a.playlistId!);
        try { raw = await providerRequest(ctx, c, `/playlistItems?${query}`); }
        catch (e) {
          if (a.collection !== 'liked' || !(e instanceof ProviderError) || ![403, 404].includes(e.status)) throw e;
          query.set('playlistId', 'LL');
          raw = await providerRequest(ctx, c, `/playlistItems?${query}`);
          notice = 'YouTube does not expose your Music likes here. Showing liked YouTube videos, which may include non-music videos.';
        }
      }
      const r = obj(raw), items = arr(r.items).slice(0, 50).map(x => youtubeItem(x, a.collection === 'playlists')).filter((x): x is MusicItem => x !== null);
      const page = { items, next: str(r.nextPageToken) || undefined, notice };
      await ctx.runMutation(internal.musicStore.putCache, { connectionId: c._id, key, page });
      return page;
    } catch (e) { return safeError(e); }
  },
});
