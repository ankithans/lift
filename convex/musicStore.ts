import { getAuthUserId } from '@convex-dev/auth/server';
import { RateLimiter, MINUTE, DAY } from '@convex-dev/rate-limiter';
import { ConvexError, v } from 'convex/values';
import { components, internal } from './_generated/api';
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from './_generated/server';
import schema from './schema';
import { libraryPage, provider, tokenFields } from './music/model';

const limits = new RateLimiter(components.rateLimiter, {
  request: { kind: 'token bucket', rate: 60, period: MINUTE, capacity: 15 },
  global: { kind: 'token bucket', rate: 150, period: MINUTE, capacity: 20 },
  youtubeDay: { kind: 'token bucket', rate: 8000, period: DAY, capacity: 100 },
  connect: { kind: 'token bucket', rate: 5, period: MINUTE, capacity: 3 },
});
const fail = (code: string): never => { throw new ConvexError(code); };
const connectionId = { connectionId: v.id('musicConnections') };

export const connections = query({
  args: {}, returns: v.array(v.object({ provider, status: v.union(v.literal('connected'), v.literal('reconnect')), premium: v.optional(v.boolean()) })),
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const result = [];
    for (const p of ['spotify', 'youtube'] as const) {
      const c = await ctx.db.query('musicConnections').withIndex('by_userId_and_provider', q => q.eq('userId', userId).eq('provider', p)).unique();
      if (c) result.push({ provider: p, status: c.status, premium: c.premium });
    }
    return result;
  },
});

export const saveState = internalMutation({
  args: { userId: v.id('users'), provider, stateHash: v.string(), returnTo: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const budget = await limits.limit(ctx, 'connect', { key: args.userId });
    if (!budget.ok) return fail('RATE_LIMITED');
    for (const row of await ctx.db.query('musicStates').withIndex('by_userId_and_provider', q => q.eq('userId', args.userId).eq('provider', args.provider)).take(10)) await ctx.db.delete(row._id);
    await ctx.db.insert('musicStates', { ...args, expiresAt: Date.now() + 10 * MINUTE });
    return null;
  },
});
export const consumeState = internalMutation({
  args: { provider, stateHash: v.string() }, returns: v.union(schema.doc('musicStates'), v.null()),
  handler: async (ctx, args) => {
    const s = await ctx.db.query('musicStates').withIndex('by_stateHash', q => q.eq('stateHash', args.stateHash)).unique();
    if (!s || s.used || s.provider !== args.provider) return null;
    await ctx.db.patch(s._id, { used: true });
    return s.expiresAt > Date.now() ? s : null;
  },
});
export const install = internalMutation({
  args: { stateId: v.id('musicStates'), userId: v.id('users'), provider, ...tokenFields, premium: v.optional(v.boolean()) }, returns: v.null(),
  handler: async (ctx, { stateId, ...args }) => {
    const state = await ctx.db.get(stateId);
    if (!state || !state.used || state.userId !== args.userId || state.provider !== args.provider || state.expiresAt < Date.now()) return fail('INVALID_STATE');
    await ctx.db.delete(stateId);
    const old = await ctx.db.query('musicConnections').withIndex('by_userId_and_provider', q => q.eq('userId', args.userId).eq('provider', args.provider)).unique();
    if (old) { await ctx.db.delete(old._id); await ctx.scheduler.runAfter(0, internal.musicStore.eraseCache, { connectionId: old._id }); }
    await ctx.db.insert('musicConnections', { ...args, connectedAt: Date.now(), status: 'connected' });
    return null;
  },
});
export const disconnect = mutation({
  args: { provider }, returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return fail('SIGN_IN');
    const c = await ctx.db.query('musicConnections').withIndex('by_userId_and_provider', q => q.eq('userId', userId).eq('provider', args.provider)).unique();
    // Deleting the connection fences every in-flight refresh and cache write immediately.
    if (c) { await ctx.db.delete(c._id); await ctx.scheduler.runAfter(0, internal.musicStore.eraseCache, { connectionId: c._id }); }
    for (const s of await ctx.db.query('musicStates').withIndex('by_userId_and_provider', q => q.eq('userId', userId).eq('provider', args.provider)).take(10)) await ctx.db.delete(s._id);
    return null;
  },
});
export const eraseCache = internalMutation({
  args: connectionId, returns: v.null(),
  handler: async (ctx, args) => {
    const rows = await ctx.db.query('musicCache').withIndex('by_connectionId_and_key', q => q.eq('connectionId', args.connectionId)).take(100);
    for (const r of rows) await ctx.db.delete(r._id);
    if (rows.length === 100) await ctx.scheduler.runAfter(0, internal.musicStore.eraseCache, args);
    return null;
  },
});
export const authorize = internalMutation({
  args: { userId: v.id('users'), provider }, returns: schema.doc('musicConnections'),
  handler: async (ctx, args) => {
    const r = await limits.limit(ctx, 'request', { key: args.userId });
    if (!r.ok) return fail('RATE_LIMITED');
    const c = await ctx.db.query('musicConnections').withIndex('by_userId_and_provider', q => q.eq('userId', args.userId).eq('provider', args.provider)).unique();
    if (!c || c.status !== 'connected') return fail('RECONNECT');
    if ((c.blockedUntil ?? 0) > Date.now()) return fail('RATE_LIMITED');
    return c;
  },
});
export const budget = internalMutation({
  args: { provider }, returns: v.boolean(),
  handler: async (ctx, { provider: p }) => {
    if (!(await limits.limit(ctx, 'global')).ok) return false;
    return p !== 'youtube' || (await limits.limit(ctx, 'youtubeDay')).ok;
  },
});
export const getConnection = internalQuery({ args: connectionId, returns: v.union(schema.doc('musicConnections'), v.null()), handler: (ctx, a) => ctx.db.get(a.connectionId) });
export const claimRefresh = internalMutation({
  args: { ...connectionId, lease: v.string() }, returns: v.union(v.literal('claimed'), v.literal('wait'), v.literal('ready'), v.literal('reconnect')),
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.connectionId);
    if (!c || c.status !== 'connected') return 'reconnect' as const;
    if (c.expiresAt > Date.now() + 60_000) return 'ready' as const;
    if (c.refreshLease) {
      if ((c.refreshUntil ?? 0) > Date.now()) return 'wait' as const;
      // An interrupted rotating refresh cannot safely be replayed.
      await ctx.db.patch(c._id, { status: 'reconnect', accessToken: '', refreshToken: '', refreshLease: undefined });
      return 'reconnect' as const;
    }
    await ctx.db.patch(c._id, { refreshLease: a.lease, refreshUntil: Date.now() + 30_000 });
    return 'claimed' as const;
  },
});
export const finishRefresh = internalMutation({
  args: { ...connectionId, lease: v.string(), accessToken: v.string(), refreshToken: v.optional(v.string()), expiresAt: v.number() }, returns: v.boolean(),
  handler: async (ctx, { connectionId: id, lease, refreshToken, ...tokens }) => {
    const c = await ctx.db.get(id);
    if (!c || c.status !== 'connected' || c.refreshLease !== lease) return false;
    await ctx.db.patch(id, { ...tokens, refreshToken: refreshToken ?? c.refreshToken, refreshLease: undefined, refreshUntil: undefined, refreshCount: (c.refreshCount ?? 0) + 1 });
    return true;
  },
});
export const releaseRefresh = internalMutation({
  args: { ...connectionId, lease: v.string() }, returns: v.null(),
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.connectionId);
    if (c?.refreshLease === a.lease) await ctx.db.patch(c._id, { refreshLease: undefined, refreshUntil: undefined });
    return null;
  },
});
export const mark = internalMutation({
  args: { ...connectionId, revoked: v.optional(v.boolean()), premium: v.optional(v.boolean()), blockedUntil: v.optional(v.number()) }, returns: v.null(),
  handler: async (ctx, { connectionId: id, revoked, ...fields }) => {
    if (await ctx.db.get(id)) await ctx.db.patch(id, { ...fields, ...(revoked ? { status: 'reconnect' as const, accessToken: '', refreshToken: '', refreshLease: undefined } : {}) });
    return null;
  },
});
export const cache = internalQuery({
  args: { ...connectionId, key: v.string(), now: v.number() }, returns: v.union(libraryPage, v.null()),
  handler: async (ctx, a) => {
    if (!(await ctx.db.get(a.connectionId))) return null;
    const r = await ctx.db.query('musicCache').withIndex('by_connectionId_and_key', q => q.eq('connectionId', a.connectionId).eq('key', a.key)).unique();
    return r && r.expiresAt > a.now ? r.page : null;
  },
});
export const putCache = internalMutation({
  args: { ...connectionId, key: v.string(), page: libraryPage }, returns: v.null(),
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.connectionId);
    if (!c || c.status !== 'connected') return null;
    const old = await ctx.db.query('musicCache').withIndex('by_connectionId_and_key', q => q.eq('connectionId', a.connectionId).eq('key', a.key)).unique();
    const value = { ...a, expiresAt: Date.now() + 5 * MINUTE };
    if (old) await ctx.db.replace(old._id, value); else await ctx.db.insert('musicCache', value);
    return null;
  },
});
async function expire(ctx: MutationCtx) {
  for (const table of ['musicStates', 'musicCache'] as const) {
    const rows = await ctx.db.query(table).withIndex('by_expiresAt', q => q.lt('expiresAt', Date.now())).take(100);
    for (const r of rows) await ctx.db.delete(r._id);
    if (rows.length === 100) await ctx.scheduler.runAfter(0, internal.musicStore.cleanup, {});
  }
}
export const cleanup = internalMutation({ args: {}, returns: v.null(), handler: async ctx => { await expire(ctx); return null; } });
