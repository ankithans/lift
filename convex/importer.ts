import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { ensureProfileFor } from "./core/profile";
import { insertCompletedWorkout, rebuildPrs, recomputeExerciseStats } from "./core/workouts";

/** Exactly one account must own the email; refuse ambiguous matches. */
async function userByEmail(ctx: MutationCtx, email: string) {
  const users = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .take(2);
  if (users.length > 1) throw new Error(`Multiple accounts use ${email}; resolve by user id.`);
  return users[0] ?? null;
}

const setInput = v.object({
  weightKg: v.optional(v.number()),
  reps: v.optional(v.number()),
  durationSec: v.optional(v.number()),
  kind: v.optional(v.union(v.literal("working"), v.literal("drop"), v.literal("warmup"), v.literal("failure"))),
});

/**
 * Import a program + completed sessions exported from another app.
 * Idempotent per session via externalId. Run with `npx convex run importer:importHistory`.
 */
export const importHistory = internalMutation({
  args: {
    email: v.string(),
    source: v.string(),
    program: v.optional(
      v.object({
        name: v.string(),
        goal: v.optional(v.string()),
        level: v.optional(v.string()),
        days: v.array(
          v.object({
            key: v.string(),
            weekday: v.optional(v.number()),
            title: v.string(),
            kind: v.union(v.literal("workout"), v.literal("rest")),
            exercises: v.array(
              v.object({
                slug: v.string(),
                sets: v.number(),
                repLow: v.number(),
                repHigh: v.number(),
                restSec: v.number(),
                group: v.optional(v.string()),
              }),
            ),
          }),
        ),
      }),
    ),
    sessions: v.array(
      v.object({
        externalId: v.string(),
        planKey: v.optional(v.string()),
        title: v.string(),
        startedAt: v.number(),
        finishedAt: v.number(),
        exercises: v.array(v.object({ slug: v.string(), group: v.optional(v.string()), sets: v.array(setInput) })),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await userByEmail(ctx, args.email);
    if (!user) throw new Error(`No user with email ${args.email}. Sign in to Lift once first.`);
    const userId = user._id;
    const profile = await ensureProfileFor(ctx, userId);

    const bySlug = async (slug: string) =>
      await ctx.db.query("exercises").withIndex("by_slug", (q) => q.eq("slug", slug)).first();

    // Program
    const dayIdByKey = new Map<string, Id<"programDays">>();
    let programId: Id<"programs"> | null = null;
    if (args.program) {
      const existing = (await ctx.db.query("programs").withIndex("by_userId", (q) => q.eq("userId", userId)).take(50)).find(
        (p) => p.source === args.source && !p.archivedAt,
      );
      if (existing) {
        programId = existing._id;
        const days = await ctx.db
          .query("programDays")
          .withIndex("by_programId_and_order", (q) => q.eq("programId", existing._id))
          .take(20);
        for (const [i, d] of args.program.days.entries()) if (days[i]) dayIdByKey.set(d.key, days[i]._id);
      } else {
        programId = await ctx.db.insert("programs", {
          userId,
          name: args.program.name,
          goal: args.program.goal,
          level: args.program.level,
          source: args.source,
          description: "Imported",
        });
        for (const [order, d] of args.program.days.entries()) {
          const dayId = await ctx.db.insert("programDays", {
            userId,
            programId,
            order,
            weekday: d.weekday,
            title: d.title,
            kind: d.kind,
          });
          dayIdByKey.set(d.key, dayId);
          for (const [i, s] of d.exercises.entries()) {
            const e = await bySlug(s.slug);
            if (!e) continue;
            await ctx.db.insert("programExercises", {
              userId,
              programDayId: dayId,
              exerciseId: e._id,
              order: i,
              group: s.group,
              sets: s.sets,
              repLow: s.repLow,
              repHigh: s.repHigh,
              restSec: s.restSec,
            });
          }
        }
      }
      await ctx.db.patch(profile._id, { activeProgramId: programId, onboardedAt: profile.onboardedAt ?? Date.now() });
    }

    // Sessions
    let created = 0;
    let skipped = 0;
    const missing = new Set<string>();
    for (const s of args.sessions) {
      const dup = await ctx.db
        .query("workouts")
        .withIndex("by_userId_and_externalId", (q) => q.eq("userId", userId).eq("externalId", s.externalId))
        .first();
      if (dup) {
        skipped++;
        continue;
      }
      const exercises = [];
      for (const ex of s.exercises) {
        const e = await bySlug(ex.slug);
        if (!e) {
          missing.add(ex.slug);
          continue;
        }
        exercises.push({ exerciseId: e._id, group: ex.group, sets: ex.sets });
      }
      if (exercises.length === 0) continue;
      await insertCompletedWorkout(
        ctx,
        userId,
        {
          title: s.title,
          startedAt: s.startedAt,
          finishedAt: s.finishedAt,
          externalId: s.externalId,
          programDayId: s.planKey ? dayIdByKey.get(s.planKey) : undefined,
          exercises,
        },
        "import",
        { recompute: false },
      );
      created++;
    }
    return { userId, programId, created, skipped, missing: [...missing] };
  },
});

/** Recompute PR flags (chronologically) and per-exercise stats for a user. */
export const rebuildStats = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await userByEmail(ctx, email);
    if (!user) throw new Error("No such user");
    return await rebuild(ctx, user._id);
  },
});

async function rebuild(ctx: MutationCtx, userId: Id<"users">) {
  const exerciseIds = new Set<Id<"exercises">>();
  for (const r of await ctx.db.query("exerciseStats").withIndex("by_userId_and_exerciseId", (q) => q.eq("userId", userId)).take(2000)) exerciseIds.add(r.exerciseId);
  for await (const s of ctx.db.query("sets").withIndex("by_userId_and_doneAt", (q) => q.eq("userId", userId).gt("doneAt", 0))) exerciseIds.add(s.exerciseId);
  for (const id of exerciseIds) {
    await rebuildPrs(ctx, userId, id);
    await recomputeExerciseStats(ctx, userId, id);
  }
  return { exercises: exerciseIds.size };
}

/** Delete a user and everything they own (used for QA accounts / account deletion requests). */
export const deleteUserData = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await userByEmail(ctx, email);
    if (!user) return { deleted: 0 };
    const userId = user._id;
    let deleted = 0;
    const del = async (id: Id<"workouts"> | Id<"workoutExercises"> | Id<"sets"> | Id<"programs"> | Id<"programDays"> | Id<"programExercises">) => {
      await ctx.db.delete(id);
      deleted++;
    };
    for await (const w of ctx.db.query("workouts").withIndex("by_userId_and_startedAt", (q) => q.eq("userId", userId))) {
      for (const s of await ctx.db.query("sets").withIndex("by_workoutId", (q) => q.eq("workoutId", w._id)).take(400)) await del(s._id);
      for (const we of await ctx.db.query("workoutExercises").withIndex("by_workoutId_and_order", (q) => q.eq("workoutId", w._id)).take(80)) await del(we._id);
      await del(w._id);
    }
    for (const p of await ctx.db.query("programs").withIndex("by_userId", (q) => q.eq("userId", userId)).take(100)) {
      for (const d of await ctx.db.query("programDays").withIndex("by_programId_and_order", (q) => q.eq("programId", p._id)).take(20)) {
        for (const s of await ctx.db.query("programExercises").withIndex("by_programDayId_and_order", (q) => q.eq("programDayId", d._id)).take(60)) await del(s._id);
        await del(d._id);
      }
      await del(p._id);
    }
    for (const r of await ctx.db.query("exerciseStats").withIndex("by_userId_and_exerciseId", (q) => q.eq("userId", userId)).take(2000)) await ctx.db.delete(r._id);
    for (const r of await ctx.db.query("bodyMetrics").withIndex("by_userId_and_kind_and_measuredAt", (q) => q.eq("userId", userId)).take(5000)) await ctx.db.delete(r._id);
    for (const r of await ctx.db.query("apiTokens").withIndex("by_userId", (q) => q.eq("userId", userId)).take(100)) await ctx.db.delete(r._id);
    for (const r of await ctx.db.query("activity").withIndex("by_userId_and_at", (q) => q.eq("userId", userId)).take(5000)) await ctx.db.delete(r._id);
    for (const r of await ctx.db.query("profiles").withIndex("by_userId", (q) => q.eq("userId", userId)).take(5)) await ctx.db.delete(r._id);
    for (const r of await ctx.db.query("exercises").withIndex("by_userId_and_name", (q) => q.eq("userId", userId)).take(500)) await ctx.db.delete(r._id);
    for (const r of await ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", userId)).take(200)) {
      for (const t of await ctx.db.query("authRefreshTokens").withIndex("sessionId", (q) => q.eq("sessionId", r._id)).take(500)) await ctx.db.delete(t._id);
      await ctx.db.delete(r._id);
    }
    for (const r of await ctx.db.query("authAccounts").withIndex("userIdAndProvider", (q) => q.eq("userId", userId)).take(20)) await ctx.db.delete(r._id);
    await ctx.db.delete(userId);
    return { deleted };
  },
});
