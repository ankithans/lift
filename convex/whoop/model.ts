import { defineTable } from 'convex/server';
import { v, type Infer } from 'convex/values';

export const kind = v.union(v.literal('cycle'), v.literal('recovery'), v.literal('sleep'), v.literal('workout'));
export const scoreState = v.union(v.literal('SCORED'), v.literal('PENDING_SCORE'), v.literal('UNSCORABLE'));
export const metrics = v.object({
  recovery: v.optional(v.number()), hrv: v.optional(v.number()), rhr: v.optional(v.number()),
  spo2: v.optional(v.number()), skinTemp: v.optional(v.number()), calibrating: v.optional(v.boolean()),
  strain: v.optional(v.number()), kilojoule: v.optional(v.number()),
  sleepPerformance: v.optional(v.number()), sleepMs: v.optional(v.number()),
  lightMs: v.optional(v.number()), deepMs: v.optional(v.number()), remMs: v.optional(v.number()), awakeMs: v.optional(v.number()),
  respiratoryRate: v.optional(v.number()), avgHr: v.optional(v.number()), maxHr: v.optional(v.number()),
  zones: v.optional(v.array(v.number())),
});
export const record = v.object({
  kind, externalId: v.string(), cycleId: v.optional(v.string()), sleepId: v.optional(v.string()),
  startAt: v.number(), endAt: v.optional(v.number()), updatedAt: v.number(),
  scoreState, nap: v.optional(v.boolean()), sport: v.optional(v.string()), metrics,
});
export type SensorRecord = Infer<typeof record>;
export const job = v.object({ start: v.number(), end: v.number(), resource: v.number(), nextToken: v.optional(v.string()) });
export const connectionStatus = v.union(v.literal('connected'), v.literal('syncing'), v.literal('reconnect'), v.literal('error'), v.literal('disconnecting'));
export const whoopTables = {
  whoopConnections: defineTable({
    userId: v.id('users'), whoopUserId: v.number(), accessToken: v.string(), refreshToken: v.string(), expiresAt: v.number(),
    scope: v.string(), status: connectionStatus, connectedAt: v.number(), lastSyncedAt: v.optional(v.number()),
    backfilledAt: v.optional(v.number()), lastAttemptAt: v.optional(v.number()), error: v.optional(v.string()),
    lease: v.optional(v.string()), leaseUntil: v.optional(v.number()), refreshInFlight: v.optional(v.boolean()),
    job: v.optional(job), retryCount: v.optional(v.number()),
  }).index('by_userId', ['userId']).index('by_whoopUserId', ['whoopUserId']).index('by_status', ['status']),
  whoopStates: defineTable({ userId: v.id('users'), stateHash: v.string(), expiresAt: v.number(), returnTo: v.string() })
    .index('by_stateHash', ['stateHash']).index('by_userId', ['userId']).index('by_expiresAt', ['expiresAt']),
  whoopRecords: defineTable({ userId: v.id('users'), ...record.fields })
    .index('by_userId_and_kind_and_externalId', ['userId', 'kind', 'externalId'])
    .index('by_userId_and_startAt', ['userId', 'startAt'])
    .index('by_userId_and_kind_and_cycleId', ['userId', 'kind', 'cycleId']),
};

export const activity = v.object({
  ...record.fields, liftWorkoutId: v.optional(v.id('workouts')),
});
export const day = v.object({
  date: v.string(), recoveryState: v.optional(scoreState), sleepState: v.optional(scoreState),
  metrics, activities: v.array(activity), linked: v.array(activity),
});
export type WhoopDay = Infer<typeof day>;
export const weekResult = v.object({
  status: v.union(v.literal('disconnected'), connectionStatus), lastSyncedAt: v.optional(v.number()),
  error: v.optional(v.string()), backfilledAt: v.optional(v.number()), days: v.array(day), trend: v.array(day),
});
export type WhoopWeek = Infer<typeof weekResult>;

export function dateKey(at: number, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** Require most of BOTH activities to overlap: a short run during a long Lift session is not a duplicate. */
export function matchingWorkout(record: SensorRecord, workouts: { _id: string; startedAt: number; finishedAt?: number; status: string }[]) {
  if (record.kind !== 'workout' || !/weightlift|strength|functional fitness|powerlift/i.test(record.sport ?? '') || !record.endAt) return undefined;
  let best: { id: string; overlap: number } | undefined;
  for (const w of workouts) {
    if (w.status !== 'completed' || !w.finishedAt) continue;
    const overlap = Math.max(0, Math.min(record.endAt, w.finishedAt) - Math.max(record.startAt, w.startedAt));
    if (overlap / Math.max(record.endAt - record.startAt, w.finishedAt - w.startedAt, 1) < 0.6) continue;
    if (!best || overlap > best.overlap) best = { id: w._id, overlap };
  }
  return best?.id;
}
