import { ConvexError } from "convex/values";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type Ctx = QueryCtx | MutationCtx;

export function fail(message: string): never {
  throw new ConvexError(message);
}

type OwnedTable = {
  [T in TableNames]: Doc<T> extends { userId: Id<"users"> } ? T : never;
}[TableNames];

/** Load a document by (possibly untrusted) id and assert the caller owns it. */
export async function own<T extends OwnedTable>(
  ctx: Ctx,
  userId: Id<"users">,
  table: T,
  id: string,
): Promise<Doc<T>> {
  const normalized = ctx.db.normalizeId(table, id);
  const doc = normalized ? await ctx.db.get(normalized) : null;
  if (!doc || (doc as { userId?: Id<"users"> }).userId !== userId) {
    fail(`${table} not found`);
  }
  return doc as Doc<T>;
}

/** Exercises are shared (no userId) or owned by the caller. */
export async function readableExercise(
  ctx: Ctx,
  userId: Id<"users">,
  id: string,
): Promise<Doc<"exercises">> {
  const normalized = ctx.db.normalizeId("exercises", id);
  const doc = normalized ? await ctx.db.get(normalized) : null;
  if (!doc || (doc.userId !== undefined && doc.userId !== userId)) {
    fail("exercise not found");
  }
  return doc;
}

/** Epley estimated one-rep max. */
export function e1rm(weightKg: number | undefined, reps: number | undefined) {
  if (!weightKg || !reps || weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + Math.min(reps, 30) / 30);
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * One comparable "how good was this set" number per exercise.
 * Loaded sets rank by estimated 1RM (offset so any added load beats pure reps),
 * bodyweight sets by reps, timed sets by duration.
 */
export function setScore(s: { weightKg?: number | null; reps?: number | null; durationSec?: number | null }) {
  const e = e1rm(s.weightKg ?? undefined, s.reps ?? undefined);
  if (e > 0) return 1000 + e;
  if (s.reps) return s.reps;
  if (s.durationSec) return s.durationSec / 100;
  return 0;
}

/** Superset groups only make sense between neighbours: clear any group left without one. */
export function orphanedGroups<T extends { _id: string; group?: string }>(rows: T[]) {
  return rows.filter((r, i) => r.group && rows[i - 1]?.group !== r.group && rows[i + 1]?.group !== r.group);
}

export function exerciseSummary(e: Doc<"exercises">) {
  return {
    _id: e._id,
    slug: e.slug,
    name: e.name,
    thumbnailUrl: e.thumbnailUrl ?? null,
    primaryGroups: e.primaryGroups,
    secondaryGroups: e.secondaryGroups,
    equipment: e.equipment,
    tracking: e.tracking,
    unilateral: e.unilateral,
    hasVideo: Boolean(e.videoUrl),
  };
}
export type ExerciseSummary = ReturnType<typeof exerciseSummary>;

/** Cache exercise reads within one function invocation. */
export function exerciseLoader(ctx: Ctx) {
  const cache = new Map<string, Promise<Doc<"exercises"> | null>>();
  return (id: Id<"exercises">) => {
    let hit = cache.get(id);
    if (!hit) {
      hit = ctx.db.get(id);
      cache.set(id, hit);
    }
    return hit;
  };
}
