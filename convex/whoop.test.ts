/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, test, vi, afterEach } from 'vitest';
import schema from './schema';
import { api, internal } from './_generated/api';
import { dateKey, matchingWorkout } from './whoop/model';
import { parseRecord } from './whoop/api';
import { verifySignature } from './whoop/signature';
const modules=import.meta.glob('./**/*.ts');
afterEach(()=>vi.useRealTimers());
const sensor={kind:'workout' as const,externalId:'sport-1',startAt:1000,endAt:61000,updatedAt:61000,scoreState:'SCORED' as const,sport:'strength trainer',metrics:{strain:9.8,avgHr:123,kilojoule:450}};

describe('WHOOP ownership, calendar dates and deduplication',()=>{
 test('only overlapping strength sessions deduplicate',()=>{
  const w={_id:'lift',startedAt:1000,finishedAt:61000,status:'completed'};
  expect(matchingWorkout(sensor,[w])).toBe('lift');
  expect(matchingWorkout({...sensor,sport:'running'},[w])).toBeUndefined();
  expect(matchingWorkout({...sensor,startAt:50000,endAt:100000},[w])).toBeUndefined();
  expect(matchingWorkout({...sensor,startAt:20000,endAt:30000},[w])).toBeUndefined();
 });
 test('cycle start follows IANA timezone including DST, sleep sums actual stages',()=>{
  expect(dateKey(Date.parse('2026-10-22T00:30:00Z'),'America/Los_Angeles')).toBe('2026-10-21');
  expect(dateKey(Date.parse('2026-03-08T10:30:00Z'),'America/Los_Angeles')).toBe('2026-03-08');
  const r=parseRecord('sleep',{id:'s',cycle_id:1,start:'2026-10-21T20:00Z',end:'2026-10-22T04:00Z',updated_at:'2026-10-22T05:00Z',score_state:'SCORED',score:{stage_summary:{total_light_sleep_time_milli:100,total_slow_wave_sleep_time_milli:200,total_rem_sleep_time_milli:300,total_awake_time_milli:400}}});
  expect(r.metrics.sleepMs).toBe(600);
  expect(parseRecord('sleep',{...{id:'p',start:'2026-10-21T20:00Z',updated_at:'2026-10-22T05:00Z'},score_state:'PENDING_SCORE',score:{sleep_performance_percentage:0}}).metrics).toEqual({});
 });
 test('one week query scopes all readings and matching history to the signed-in owner',async()=>{
  const t=convexTest(schema,modules);
  const [u,other,w]=await t.run(async ctx=>{
   const u=await ctx.db.insert('users',{email:'one@test.local'}),other=await ctx.db.insert('users',{email:'two@test.local'});
   await ctx.db.insert('whoopConnections',{userId:u,whoopUserId:123,accessToken:'server-only-access',refreshToken:'server-only-refresh',expiresAt:9e15,scope:'offline',status:'connected',connectedAt:1});
   const w=await ctx.db.insert('workouts',{userId:u,title:'Push',status:'completed',startedAt:Date.parse('2026-10-22T07:00Z'),finishedAt:Date.parse('2026-10-22T08:00Z'),source:'user'});
   const at=Date.parse('2026-10-22T05:00Z');
   await ctx.db.insert('whoopRecords',{userId:u,kind:'cycle',externalId:'1',startAt:at,updatedAt:at,scoreState:'SCORED',metrics:{strain:10}});
   await ctx.db.insert('whoopRecords',{userId:u,kind:'recovery',cycleId:'1',externalId:'1',startAt:at,updatedAt:at,scoreState:'SCORED',metrics:{recovery:48,hrv:62,rhr:55}});
   await ctx.db.insert('whoopRecords',{userId:u,kind:'sleep',cycleId:'1',externalId:'s',startAt:at,updatedAt:at,scoreState:'SCORED',metrics:{sleepMs:27e6}});
   await ctx.db.insert('whoopRecords',{userId:u,...sensor,startAt:Date.parse('2026-10-22T07:00Z'),endAt:Date.parse('2026-10-22T08:00Z')});
   return [u,other,w] as const;
  });
  const args={start:Date.parse('2026-10-19T00:00Z'),end:Date.parse('2026-10-26T00:00Z'),timezone:'UTC'};
  const owner=t.withIdentity({subject:`${u}|session`}),stranger=t.withIdentity({subject:`${other}|session`});
  const data=await owner.query(api.whoop.week,args);
  expect(data.days[0].metrics.recovery).toBe(48);expect(data.days[0].activities).toHaveLength(0);expect(data.days[0].linked[0].liftWorkoutId).toBe(w);
  expect(JSON.stringify(data)).not.toMatch(/server-only|accessToken|refreshToken/);
  expect((await stranger.query(api.whoop.week,args)).status).toBe('disconnected');
  expect(await stranger.query(api.whoop.forWorkout,{workoutId:w})).toEqual([]);
  expect((await owner.query(api.whoop.forWorkout,{workoutId:w}))).toHaveLength(1);
  // Today's independent lookup overlaps this week's end when browsing last week.
  const overlap=await owner.query(api.whoop.week,{...args,end:Date.parse('2026-10-23T00:00Z'),todayAt:Date.parse('2026-10-23T00:00Z')});
  expect(overlap.days.find(d=>d.date==='2026-10-22')?.linked).toHaveLength(1);
  expect((await t.query(api.whoop.week,args)).days).toEqual([]);
 });
 test('OAuth states are single use and expire',async()=>{
  const t=convexTest(schema,modules);const u=await t.run(ctx=>ctx.db.insert('users',{}));
  await t.mutation(internal.whoopStore.saveState,{userId:u,stateHash:'hash',returnTo:'http://localhost/'});
  expect(await t.mutation(internal.whoopStore.consumeState,{stateHash:'hash'})).not.toBeNull();
  expect(await t.mutation(internal.whoopStore.consumeState,{stateHash:'hash'})).toBeNull();
  await t.run(ctx=>ctx.db.insert('whoopStates',{userId:u,stateHash:'expired',expiresAt:0,returnTo:'http://localhost/'}));
  expect(await t.mutation(internal.whoopStore.consumeState,{stateHash:'expired'})).toBeNull();
 });
 test('concurrent workers cannot refresh twice; an uncertain expired refresh requires reconnect',async()=>{
  const t=convexTest(schema,modules);
  const id=await t.run(async ctx=>{
   const u=await ctx.db.insert('users',{});
   return await ctx.db.insert('whoopConnections',{userId:u,whoopUserId:9,accessToken:'old',refreshToken:'old-refresh',expiresAt:0,scope:'offline',status:'syncing',connectedAt:1,job:{start:1,end:2,resource:0}});
  });
  expect(await t.mutation(internal.whoopStore.claim,{connectionId:id,lease:'one'})).not.toBeNull();
  expect(await t.mutation(internal.whoopStore.claim,{connectionId:id,lease:'two'})).toBeNull();
  expect(await t.mutation(internal.whoopStore.beginRefresh,{connectionId:id,lease:'one'})).toBe(true);
  expect(await t.mutation(internal.whoopStore.beginRefresh,{connectionId:id,lease:'one'})).toBe(false);
  expect(await t.mutation(internal.whoopStore.tokens,{connectionId:id,lease:'other',accessToken:'stale',refreshToken:'burned',expiresAt:1})).toBe(false);
  expect(await t.mutation(internal.whoopStore.tokens,{connectionId:id,lease:'one',accessToken:'rotated',refreshToken:'rotated-refresh',expiresAt:999999})).toBe(true);
  expect((await t.run(ctx=>ctx.db.get(id)))?.refreshToken).toBe('rotated-refresh');
  await t.run(ctx=>ctx.db.patch(id,{refreshInFlight:true,leaseUntil:0}));
  expect(await t.mutation(internal.whoopStore.claim,{connectionId:id,lease:'three'})).toBeNull();
  expect((await t.run(ctx=>ctx.db.get(id)))?.status).toBe('reconnect');
 });
});


test('webhook signatures reject alteration, wrong keys and expired timestamps',async()=>{
 const timestamp='1792665000000',body='{"user_id":123,"id":"sleep-uuid","type":"recovery.updated"}',secret='test-signing-secret';
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signed=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+body)));
 const signature=btoa(String.fromCharCode(...signed));
 expect(await verifySignature(body,timestamp,signature,secret,Number(timestamp))).toBe(true);
 expect(await verifySignature(body+' ',timestamp,signature,secret,Number(timestamp))).toBe(false);
 expect(await verifySignature(body,timestamp,signature,'wrong',Number(timestamp))).toBe(false);
 expect(await verifySignature(body,timestamp,signature,secret,Number(timestamp)+300001)).toBe(false);
});

test('v2 recovery webhook uses the sleep UUID, deduplicates delivery and deletes only that owner’s record',async()=>{
 const t=convexTest(schema,modules);
 const c=await t.run(async ctx=>{
  const owner=await ctx.db.insert('users',{}),other=await ctx.db.insert('users',{});
  const c=await ctx.db.insert('whoopConnections',{userId:owner,whoopUserId:7,accessToken:'test-access',refreshToken:'test-refresh',expiresAt:9e15,scope:'offline',status:'connected',connectedAt:1});
  for(const userId of [owner,other])await ctx.db.insert('whoopRecords',{userId,kind:'recovery',externalId:'cycle-1',sleepId:'sleep-uuid',startAt:1,updatedAt:1,scoreState:'SCORED',metrics:{recovery:44}});
  return c;
 });
 const event={whoopUserId:7,traceId:'delivery-1',kind:'recovery' as const,externalId:'sleep-uuid',deleted:true};
 await t.mutation(internal.whoopStore.webhook,event);
 await t.mutation(internal.whoopStore.webhook,event);
 const connection=await t.run(ctx=>ctx.db.get(c));
 expect(connection?.job?.target?.externalId).toBe('sleep-uuid');
 const claimed=await t.mutation(internal.whoopStore.claim,{connectionId:c,lease:'event-worker'});
 expect(claimed).not.toBeNull();
 await t.mutation(internal.whoopStore.finishPage,{connectionId:c,lease:'event-worker',records:[],eventDoneId:connection!.job!.target!.eventId,remove:{kind:'recovery',externalId:'sleep-uuid'}});
 const rows=await t.run(ctx=>ctx.db.query('whoopRecords').withIndex('by_userId_and_startAt').take(10));
 expect(rows).toHaveLength(1);expect(rows[0].userId).not.toBe(connection?.userId);
 const events=await t.run(ctx=>ctx.db.query('whoopEvents').withIndex('by_traceId',q=>q.eq('traceId','delivery-1')).take(10));
 expect(events).toHaveLength(1);expect(events[0].done).toBe(true);
});
