import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import { action, mutation, query, env } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { dateKey, matchingWorkout, weekResult, activity, type WhoopDay } from './whoop/model';
import { sha256Hex } from './tokens';

export const SCOPES = 'offline read:recovery read:cycles read:sleep read:workout read:profile read:body_measurement';

export const connect = action({
  args: { returnTo: v.string() }, returns: v.string(),
  handler: async (ctx, { returnTo }): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Sign in to connect WHOOP.');
    if (!env.WHOOP_CLIENT_ID || !env.WHOOP_CLIENT_SECRET) throw new Error('WHOOP connection is not configured yet.');
    // Only the configured frontend can receive the result; never an arbitrary redirect.
    const target = new URL(returnTo);
    const app = new URL(env.WHOOP_APP_URL ?? 'http://localhost:3027');
    if (target.origin !== app.origin) throw new Error('This app address is not registered for WHOOP.');
    const state = [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
    await ctx.runMutation(internal.whoopStore.saveState, { userId, stateHash: await sha256Hex(state), returnTo: `${app.origin}/` });
    const url = new URL('https://api.prod.whoop.com/oauth/oauth2/auth');
    url.search = new URLSearchParams({ client_id: env.WHOOP_CLIENT_ID, response_type: 'code', scope: SCOPES, state,
      redirect_uri: env.WHOOP_REDIRECT_URI ?? `${env.CONVEX_SITE_URL}/whoop/callback` }).toString();
    return url.toString();
  },
});

export const syncNow = mutation({
  args: {}, returns: v.null(),
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Sign in first.');
    await ctx.runMutation(internal.whoopStore.enqueue, { userId });
    return null;
  },
});

export const disconnect = mutation({
  args: {}, returns: v.null(),
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Sign in first.');
    const c = await ctx.db.query('whoopConnections').withIndex('by_userId', q => q.eq('userId', userId)).unique();
    // Invalidate workers immediately. Revocation and bounded data erasure happen server-side.
    if (c) {
      await ctx.db.patch(c._id, { status: 'disconnecting', lease: undefined, job: undefined });
      await ctx.scheduler.runAfter(0, internal.whoopSync.revoke, { connectionId: c._id });
    }
    for (const state of await ctx.db.query('whoopStates').withIndex('by_userId', q => q.eq('userId', userId)).take(100)) await ctx.db.delete(state._id);
    return null;
  },
});

export const week = query({
  args: { start: v.number(), end: v.number(), timezone: v.string(), todayAt: v.optional(v.number()) }, returns: weekResult,
  handler: async (ctx, { start, end, timezone, todayAt }) => {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 8 * 86400000) throw new Error('Choose one week.');
    dateKey(start, timezone); // Validate IANA timezone.
    const userId = await getAuthUserId(ctx);
    if (!userId) return { status: 'disconnected' as const, days: [], trend: [] };
    const c = await ctx.db.query('whoopConnections').withIndex('by_userId', q => q.eq('userId', userId)).unique();
    if (!c || c.status === 'disconnecting') return { status: 'disconnected' as const, days: [], trend: [] };
    const from = start - 8 * 86400000;
    const records = await ctx.db.query('whoopRecords').withIndex('by_userId_and_startAt', q => q.eq('userId', userId).gte('startAt', from).lt('startAt', end)).take(2000);
    if (todayAt !== undefined && (todayAt < from || todayAt >= end)) {
      if (!Number.isFinite(todayAt)) throw new Error('Invalid date.');
      records.push(...await ctx.db.query('whoopRecords').withIndex('by_userId_and_startAt', q => q.eq('userId', userId).gte('startAt', todayAt - 2 * 86400000).lt('startAt', todayAt + 2 * 86400000)).take(300));
    }
    const workouts = await ctx.db.query('workouts').withIndex('by_userId_and_startedAt', q => q.eq('userId', userId).gte('startedAt', from - 86400000).lt('startedAt', end)).take(500);
    // Today's extra range can overlap the browsed week. Process each record once,
    // in cycle order, so activity counts and same-date cycle overwrites stay stable.
    const ordered = [...new Map(records.map(r => [r._id, r])).values()].sort((a,b) => a.startAt-b.startAt || a._creationTime-b._creationTime);
    const cycles = new Map(ordered.filter(r => r.kind === 'cycle').map(r => [r.externalId, r]));
    const groups = new Map<string, WhoopDay>();
    // Chronological overwrite chooses the last physiological cycle when two begin on one date.
    for (const r of ordered) {
      const cycle = r.cycleId ? cycles.get(r.cycleId) : undefined;
      const at = r.kind === 'workout' ? r.startAt : cycle?.startAt ?? r.startAt;
      const key = dateKey(at, timezone);
      const d = groups.get(key) ?? { date: key, metrics: {}, activities: [], linked: [] };
      if (r.kind === 'cycle') { d.metrics = { ...r.metrics }; delete d.recoveryState; delete d.sleepState; }
      if (r.kind === 'recovery') { Object.assign(d.metrics, r.metrics); d.recoveryState = r.scoreState; }
      if (r.kind === 'sleep' && !r.nap) { Object.assign(d.metrics, r.metrics); d.sleepState = r.scoreState; }
      if (r.kind === 'workout') {
        const { _id, _creationTime, userId: _userId, ...record } = r;
        const liftWorkoutId = matchingWorkout(r, workouts) as Id<'workouts'> | undefined;
        (liftWorkoutId ? d.linked : d.activities).push({ ...record, ...(liftWorkoutId ? { liftWorkoutId } : {}) });
      }
      groups.set(key, d);
    }
    const trend = [...groups.values()].filter(d => d.date >= dateKey(from, timezone) && d.date <= dateKey(end - 1, timezone)).sort((a,b) => a.date.localeCompare(b.date));
    const first = dateKey(start, timezone), last = dateKey(end - 1, timezone);
    return { status: c.status, lastSyncedAt: c.lastSyncedAt, backfilledAt: c.backfilledAt, error: c.error,
      days: trend.filter(d => d.date >= first && d.date <= last), trend, today: todayAt !== undefined ? groups.get(dateKey(todayAt, timezone)) : undefined };
  },
});

export const forWorkout = query({
  args: { workoutId: v.id('workouts') }, returns: v.array(activity),
  handler: async (ctx, { workoutId }) => {
    const userId = await getAuthUserId(ctx);
    const w = await ctx.db.get(workoutId);
    if (!userId || !w || w.userId !== userId) return [];
    const c = await ctx.db.query('whoopConnections').withIndex('by_userId', q=>q.eq('userId',userId)).unique();
    if (!c || c.status === 'disconnecting') return [];
    const records = await ctx.db.query('whoopRecords').withIndex('by_userId_and_startAt', q => q.eq('userId', userId).gte('startAt', w.startedAt - 86400000).lt('startAt', w.finishedAt ?? w.startedAt + 86400000)).take(300);
    return records.filter(r => matchingWorkout(r, [w]) === workoutId).map(({ _id, _creationTime, userId: _userId, ...r }) => ({ ...r, liftWorkoutId: workoutId }));
  },
});
