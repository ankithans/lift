/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, describe, expect, test, vi } from 'vitest';
import rateLimiter from '@convex-dev/rate-limiter/test';
import schema from './schema';
import { api, internal } from './_generated/api';
import { parseTokens } from './music/api';
import { spotifyItem } from './spotify';
import { youtubeItem } from './youtube';
const modules = import.meta.glob('./**/*.ts');
function setup() { const t = convexTest(schema, modules); rateLimiter.register(t); return t; }
async function fixture() {
  const t = setup();
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert('users', {}), other = await ctx.db.insert('users', {});
    const connectionId = await ctx.db.insert('musicConnections', { userId, provider: 'spotify', status: 'connected', accessToken: 'server-access', refreshToken: 'server-refresh', scope: 'streaming', expiresAt: Date.now() + 3600_000, connectedAt: 1 });
    return { userId, other, connectionId };
  });
  return { t, ...ids, owner: t.withIdentity({ subject: `${ids.userId}|session` }), stranger: t.withIdentity({ subject: `${ids.other}|session` }) };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('music ownership and OAuth', () => {
  test('queries never expose tokens; public actions derive owner; SDK access is owner-only', async () => {
    const { t, owner, stranger } = await fixture();
    const result = await owner.query(api.musicStore.connections, {});
    expect(result).toEqual([{ provider: 'spotify', status: 'connected' }]);
    expect(JSON.stringify(result)).not.toMatch(/Token|server-/);
    expect(await stranger.query(api.musicStore.connections, {})).toEqual([]);
    expect(await t.query(api.musicStore.connections, {})).toEqual([]);
    await expect(stranger.action(api.spotify.sdkToken, {})).rejects.toThrow('RECONNECT');
    await expect(t.action(api.spotify.playback, {})).rejects.toThrow('SIGN_IN');
    expect((await owner.action(api.spotify.sdkToken, {})).accessToken).toBe('server-access');
  });
  test('state is provider-bound, single-use, expires and disconnect fences callback installation', async () => {
    vi.useFakeTimers();
    const { t, userId, owner } = await fixture();
    await t.mutation(internal.musicStore.saveState, { userId, provider: 'spotify', stateHash: 'hash', returnTo: 'https://lift.ankithans.com/workout' });
    expect(await t.mutation(internal.musicStore.consumeState, { provider: 'youtube', stateHash: 'hash' })).toBeNull();
    const state = await t.mutation(internal.musicStore.consumeState, { provider: 'spotify', stateHash: 'hash' });
    expect(state?.userId).toBe(userId);
    expect(await t.mutation(internal.musicStore.consumeState, { provider: 'spotify', stateHash: 'hash' })).toBeNull();
    await owner.mutation(api.musicStore.disconnect, { provider: 'spotify' });
    await expect(t.mutation(internal.musicStore.install, { stateId: state!._id, userId, provider: 'spotify', accessToken: 'late', refreshToken: 'late', expiresAt: 9e15, scope: '' })).rejects.toThrow('INVALID_STATE');
    await t.run(ctx => ctx.db.insert('musicStates', { userId, provider: 'spotify', stateHash: 'old', returnTo: 'https://lift.ankithans.com/', expiresAt: 0 }));
    expect(await t.mutation(internal.musicStore.consumeState, { provider: 'spotify', stateHash: 'old' })).toBeNull();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });
  test('connect rejects attacker origins and paths without creating state', async () => {
    vi.stubEnv('SPOTIFY_CLIENT_ID', 'id'); vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'secret'); vi.stubEnv('SPOTIFY_APP_URL', 'https://lift.ankithans.com');
    const { owner } = await fixture();
    await expect(owner.action(api.music.connect, { provider: 'spotify', returnTo: 'https://attacker.example/workout' })).rejects.toThrow('INVALID_RETURN');
    await expect(owner.action(api.music.connect, { provider: 'spotify', returnTo: 'https://lift.ankithans.com//attacker' })).rejects.toThrow('INVALID_RETURN');
    vi.unstubAllEnvs();
  });
});
describe('music refresh and cache fencing', () => {
  test('one refresh lease, optional refresh token preservation, rotation and interrupted refresh', async () => {
    const { t, connectionId } = await fixture();
    await t.run(ctx => ctx.db.patch(connectionId, { expiresAt: 0 }));
    expect(await t.mutation(internal.musicStore.claimRefresh, { connectionId, lease: 'one' })).toBe('claimed');
    expect(await t.mutation(internal.musicStore.claimRefresh, { connectionId, lease: 'two' })).toBe('wait');
    expect(await t.mutation(internal.musicStore.finishRefresh, { connectionId, lease: 'wrong', accessToken: 'stale', expiresAt: 0 })).toBe(false);
    expect(await t.mutation(internal.musicStore.finishRefresh, { connectionId, lease: 'one', accessToken: 'new', expiresAt: 0 })).toBe(true);
    expect((await t.run(ctx => ctx.db.get(connectionId)))?.refreshToken).toBe('server-refresh');
    await t.mutation(internal.musicStore.claimRefresh, { connectionId, lease: 'next' });
    await t.mutation(internal.musicStore.finishRefresh, { connectionId, lease: 'next', accessToken: 'rotated', refreshToken: 'rotated-refresh', expiresAt: 0 });
    expect((await t.run(ctx => ctx.db.get(connectionId)))?.refreshToken).toBe('rotated-refresh');
    await t.mutation(internal.musicStore.claimRefresh, { connectionId, lease: 'uncertain' });
    await t.run(ctx => ctx.db.patch(connectionId, { refreshUntil: 0 }));
    expect(await t.mutation(internal.musicStore.claimRefresh, { connectionId, lease: 'retry' })).toBe('reconnect');
    expect((await t.run(ctx => ctx.db.get(connectionId)))?.refreshToken).toBe('');
  });
  test('library cache is scoped, expires, and cannot be resurrected after disconnect', async () => {
    const { t, connectionId, owner, stranger } = await fixture();
    const page = { items: [{ id: 'x', title: 'Favourite', subtitle: 'Artist', kind: 'track' as const, url: 'https://open.spotify.com/track/x' }] };
    await t.mutation(internal.musicStore.putCache, { connectionId, key: 'spotify:liked::0', page });
    expect(await owner.action(api.spotify.library, { collection: 'liked' })).toEqual(page);
    await expect(stranger.action(api.spotify.library, { collection: 'liked' })).rejects.toThrow('RECONNECT');
    expect(await t.query(internal.musicStore.cache, { connectionId, key: 'spotify:liked::0', now: Date.now() + 600_000 })).toBeNull();
    await owner.mutation(api.musicStore.disconnect, { provider: 'spotify' });
    await t.mutation(internal.musicStore.putCache, { connectionId, key: 'late', page });
    expect(await t.query(internal.musicStore.cache, { connectionId, key: 'late', now: 0 })).toBeNull();
    expect(await t.mutation(internal.musicStore.finishRefresh, { connectionId, lease: 'late', accessToken: 'late', expiresAt: 9e15 })).toBe(false);
  });
  test('provider 401 reconnects, 404 reports missing device, 429 sets a cooldown', async () => {
    for (const status of [404, 429, 401]) {
      const { t, owner, connectionId } = await fixture();
      vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status, headers: { 'retry-after': '60' } })));
      await expect(owner.action(api.spotify.playback, {})).rejects.toThrow(status === 404 ? 'NO_DEVICE' : status === 429 ? 'RATE_LIMITED' : 'RECONNECT');
      const c = await t.run(ctx => ctx.db.get(connectionId));
      if (status === 429) expect(c!.blockedUntil).toBeGreaterThan(Date.now());
      if (status === 401) expect(c!.status).toBe('reconnect');
    }
  });
  test('YouTube LM falls back to LL with explicit provenance and removes unavailable videos', async () => {
    const { t, userId } = await fixture();
    await t.run(ctx => ctx.db.insert('musicConnections', { userId, provider: 'youtube', accessToken: 'youtube-server', refreshToken: 'refresh', expiresAt: 9e15, scope: '', status: 'connected', connectedAt: 1 }));
    const fetcher = vi.fn(async (url: string) => url.includes('playlistId=LM') ? new Response('{}', { status: 404 }) : new Response(JSON.stringify({ items: [{ snippet: { title: 'Song', resourceId: { videoId: 'abcdefghijk' }, videoOwnerChannelTitle: 'Artist' } }, { snippet: { title: 'Private video', resourceId: { videoId: 'private' } } }], nextPageToken: 'page2' }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const result = await t.withIdentity({ subject: `${userId}|session` }).action(api.youtube.library, { collection: 'liked' });
    expect(result.items.map(i => i.title)).toEqual(['Song']); expect(result.notice).toContain('liked YouTube videos'); expect(result.next).toBe('page2');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  test('per-user budgets reject bursts and non-Premium cannot control playback', async () => {
    const { owner, t, connectionId } = await fixture();
    await t.run(ctx => ctx.db.patch(connectionId, { premium: false }));
    await expect(owner.action(api.spotify.control, { command: 'play' })).rejects.toThrow('PREMIUM');
    let limited = false;
    for (let i = 0; i < 20; i++) { try { await owner.action(api.spotify.sdkToken, {}); } catch (e) { if (String(e).includes('RATE_LIMITED')) limited = true; } }
    expect(limited).toBe(true);
  });
});
test('provider parsers tolerate absent product/refresh fields and preserve identity', () => {
  expect(parseTokens({ access_token: 'x', expires_in: 3600 }, false).refreshToken).toBeUndefined();
  expect(() => parseTokens({ access_token: 'x', expires_in: 0 }, false)).toThrow();
  expect(spotifyItem({ id: 'track', name: 'Track', artists: [{ name: 'Artist' }] })?.subtitle).toBe('Artist');
  expect(youtubeItem({ snippet: { title: 'Deleted video', resourceId: { videoId: 'x' } } }, false)).toBeNull();
});
