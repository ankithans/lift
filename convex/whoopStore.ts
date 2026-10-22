import { v } from 'convex/values';
import { RateLimiter, MINUTE, DAY } from '@convex-dev/rate-limiter';
import schema from './schema';
import { components, internal } from './_generated/api';
import { internalMutation } from './_generated/server';
import { record, job } from './whoop/model';

const limits = new RateLimiter(components.rateLimiter, {
  whoopMinute: { kind: 'token bucket', rate: 75, period: MINUTE, capacity: 1 },
  whoopDay: { kind: 'token bucket', rate: 8500, period: DAY, capacity: 100 },
});
const connId = { connectionId: v.id('whoopConnections') };
const leased = { ...connId, lease: v.string() };

export const saveState = internalMutation({
  args: { userId: v.id('users'), stateHash: v.string(), returnTo: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    for (const s of await ctx.db.query('whoopStates').withIndex('by_userId', q=>q.eq('userId',args.userId)).take(20)) await ctx.db.delete(s._id);
    await ctx.db.insert('whoopStates', { ...args, expiresAt: Date.now() + 10 * MINUTE });
    return null;
  },
});
export const consumeState = internalMutation({
  args: { stateHash: v.string() }, returns: v.union(schema.doc('whoopStates'), v.null()),
  handler: async (ctx, { stateHash }) => {
    const s = await ctx.db.query('whoopStates').withIndex('by_stateHash',q=>q.eq('stateHash',stateHash)).unique();
    if (!s) return null;
    await ctx.db.delete(s._id);
    return s.expiresAt > Date.now() ? s : null;
  },
});
export const install = internalMutation({
  args: { userId: v.id('users'), whoopUserId: v.number(), accessToken: v.string(), refreshToken: v.string(), expiresAt: v.number(), scope: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const linked = await ctx.db.query('whoopConnections').withIndex('by_whoopUserId',q=>q.eq('whoopUserId',args.whoopUserId)).unique();
    if (linked && linked.userId !== args.userId) throw new Error('This WHOOP account is already connected to another Lift account.');
    const old = await ctx.db.query('whoopConnections').withIndex('by_userId',q=>q.eq('userId',args.userId)).unique();
    // Reconnect invalidates every old worker. Require explicit disconnect before switching sensor accounts.
    if (old && old.whoopUserId !== args.whoopUserId) throw new Error('Disconnect your previous WHOOP account first.');
    if (old?.status === 'disconnecting') throw new Error('Disconnect is still finishing. Try again shortly.');
    if (old) await ctx.db.delete(old._id);
    await ctx.db.insert('whoopConnections', { ...args, connectedAt: Date.now(), status: 'connected', backfilledAt: old?.backfilledAt, lastSyncedAt: old?.lastSyncedAt });
    await ctx.runMutation(internal.whoopStore.enqueue, { userId: args.userId });
    return null;
  },
});
export const enqueue = internalMutation({
  args: { userId: v.id('users') }, returns: v.null(),
  handler: async (ctx, { userId }) => {
    const c = await ctx.db.query('whoopConnections').withIndex('by_userId',q=>q.eq('userId',userId)).unique();
    if (!c || c.status === 'reconnect' || c.status === 'disconnecting') return null;
    const now = Date.now();
    if (c.leaseUntil && c.leaseUntil > now) return null;
    if (c.lastAttemptAt && now - c.lastAttemptAt < MINUTE) return null;
    await ctx.db.patch(c._id, { status: 'syncing', error: undefined, retryCount: 0,
      job: c.job ?? { start: now - (c.backfilledAt ? 3 : 60) * DAY, end: now, resource: 0 } });
    await ctx.scheduler.runAfter(0, internal.whoopSync.page, { connectionId: c._id });
    return null;
  },
});
export const claim = internalMutation({
  args: { ...connId, lease: v.string() }, returns: v.union(schema.doc('whoopConnections'), v.null()),
  handler: async (ctx, { connectionId, lease }) => {
    const c = await ctx.db.get(connectionId);
    if (!c || c.status !== 'syncing' || !c.job || (c.leaseUntil ?? 0) > Date.now()) return null;
    if (c.refreshInFlight) {
      // An interrupted refresh may already have rotated at WHOOP. Never replay that refresh token.
      await ctx.db.patch(c._id, { status: 'reconnect', error: 'A token refresh was interrupted. Reconnect WHOOP to continue.', lease: undefined, leaseUntil: undefined });
      return null;
    }
    await ctx.db.patch(c._id, { lease, leaseUntil: Date.now() + 120_000, lastAttemptAt: Date.now() });
    return { ...c, lease };
  },
});
export const budget = internalMutation({
  args: {}, returns: v.number(),
  handler: async ctx => {
    const minute = await limits.limit(ctx, 'whoopMinute');
    if (!minute.ok) return minute.retryAfter;
    const daily = await limits.limit(ctx, 'whoopDay');
    return daily.ok ? 0 : daily.retryAfter;
  },
});
export const beginRefresh = internalMutation({
  args: leased, returns: v.boolean(),
  handler: async (ctx, {connectionId,lease}) => {
    const c=await ctx.db.get(connectionId);
    if (!c || c.lease!==lease || c.status!=='syncing' || (c.leaseUntil??0)<Date.now() || c.refreshInFlight) return false;
    await ctx.db.patch(c._id,{refreshInFlight:true}); return true;
  },
});
export const tokens = internalMutation({
  args: { ...leased, accessToken:v.string(), refreshToken:v.string(), expiresAt:v.number() }, returns:v.boolean(),
  handler:async(ctx,{connectionId,lease,...tokens})=>{
    const c=await ctx.db.get(connectionId);
    if(!c || c.lease!==lease || c.status!=='syncing')return false;
    await ctx.db.patch(c._id,{...tokens,refreshInFlight:false});return true;
  },
});
export const finishPage = internalMutation({
  args: { ...leased, records:v.array(record), nextJob:v.optional(job) }, returns:v.null(),
  handler:async(ctx,{connectionId,lease,records,nextJob})=>{
    const c=await ctx.db.get(connectionId);
    if(!c || c.lease!==lease || c.status!=='syncing')return null;
    for(const data of records){
      const old=await ctx.db.query('whoopRecords').withIndex('by_userId_and_kind_and_externalId',q=>q.eq('userId',c.userId).eq('kind',data.kind).eq('externalId',data.externalId)).unique();
      let startAt=data.startAt;
      if(data.kind==='sleep'||data.kind==='recovery'){
        const cycle=await ctx.db.query('whoopRecords').withIndex('by_userId_and_kind_and_externalId',q=>q.eq('userId',c.userId).eq('kind','cycle').eq('externalId',data.cycleId??'')).unique();
        if(cycle)startAt=cycle.startAt;
      }
      if(!old || data.updatedAt>=old.updatedAt){
        const value={...data,startAt,userId:c.userId};
        if(old)await ctx.db.replace(old._id,value);else await ctx.db.insert('whoopRecords',value);
      }
    }
    await ctx.db.patch(c._id,{job:nextJob,lease:undefined,leaseUntil:undefined,retryCount:0,error:undefined,
      ...(nextJob?{}:{status:'connected' as const,lastSyncedAt:Date.now(),backfilledAt:c.backfilledAt??Date.now()})});
    if(nextJob)await ctx.scheduler.runAfter(1100,internal.whoopSync.page,{connectionId});
    return null;
  },
});
export const failed = internalMutation({
  args:{...leased,revoked:v.boolean(),message:v.string(),retryMs:v.optional(v.number())},returns:v.null(),
  handler:async(ctx,{connectionId,lease,revoked,message,retryMs})=>{
    const c=await ctx.db.get(connectionId);if(!c||c.lease!==lease||c.status!=='syncing')return null;
    const count=(c.retryCount??0)+1;
    const reconnect=revoked||c.refreshInFlight===true;
    await ctx.db.patch(c._id,{lease:undefined,leaseUntil:undefined,retryCount:count,error:message,
      status:reconnect?'reconnect':count>=5?'error':'syncing',
      ...(reconnect?{accessToken:'',refreshToken:'',refreshInFlight:false}:{}),
    });
    if(!reconnect&&count<5)await ctx.scheduler.runAfter(Math.max(retryMs??0,Math.min(15*MINUTE,2**count*5000)),internal.whoopSync.page,{connectionId});
    return null;
  },
});
export const defer = internalMutation({
  args:{...leased,delay:v.number()},returns:v.null(),
  handler:async(ctx,{connectionId,lease,delay})=>{
    const c=await ctx.db.get(connectionId);if(!c||c.lease!==lease||c.status!=='syncing')return null;
    await ctx.db.patch(c._id,{lease:undefined,leaseUntil:undefined});
    await ctx.scheduler.runAfter(Math.max(1000,delay),internal.whoopSync.page,{connectionId});return null;
  },
});
export const sweep = internalMutation({
  args:{ cursor:v.optional(v.string()) },returns:v.null(),
  handler:async(ctx,{cursor})=>{
    const page=await ctx.db.query('whoopConnections').withIndex('by_userId').paginate({cursor:cursor??null,numItems:50});
    for(const c of page.page)await ctx.runMutation(internal.whoopStore.enqueue,{userId:c.userId});
    if(!page.isDone)await ctx.scheduler.runAfter(1000,internal.whoopStore.sweep,{cursor:page.continueCursor});
    const expired=await ctx.db.query('whoopStates').withIndex('by_expiresAt',q=>q.lt('expiresAt',Date.now())).take(100);
    for(const s of expired)await ctx.db.delete(s._id);
    return null;
  },
});
export const erase = internalMutation({
  args:connId,returns:v.null(),
  handler:async(ctx,{connectionId})=>{
    const c=await ctx.db.get(connectionId);if(!c||c.status!=='disconnecting')return null;
    const rows=await ctx.db.query('whoopRecords').withIndex('by_userId_and_startAt',q=>q.eq('userId',c.userId)).take(200);
    for(const r of rows)await ctx.db.delete(r._id);
    if(rows.length===200)await ctx.scheduler.runAfter(0,internal.whoopStore.erase,{connectionId});else await ctx.db.delete(c._id);
    return null;
  },
});

export const readConnection = internalMutation({
  args:connId,returns:v.union(schema.doc('whoopConnections'),v.null()),
  handler:async(ctx,{connectionId})=>await ctx.db.get(connectionId),
});

/** Explicitly used for end-to-end token-rotation verification; never callable by clients. */
export const expireForRefresh = internalMutation({
  args:connId,returns:v.boolean(),
  handler:async(ctx,{connectionId})=>{
    const c=await ctx.db.get(connectionId);
    if(!c||c.status!=='connected'||(c.leaseUntil??0)>Date.now())return false;
    await ctx.db.patch(c._id,{expiresAt:0,lastAttemptAt:0});
    await ctx.runMutation(internal.whoopStore.enqueue,{userId:c.userId});return true;
  },
});
