import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { defineMutation, defineQuery } from "../lib/commands";
import { exerciseLoader, fail, own, round1 } from "../lib/util";
import { MUSCLE_GROUPS } from "./library";

export const muscleVolume = defineQuery({
  name: "get_muscle_volume",
  description:
    "Working sets per muscle group between two epoch-ms timestamps (primary muscle = 1 set, secondary = 0.5). Use for weekly coverage / volume analysis.",
  args: { from: v.number(), to: v.number() },
  run: async (ctx, { userId }, { from, to }) => {
    const load = exerciseLoader(ctx);
    const totals = new Map<string, number>(MUSCLE_GROUPS.map((g) => [g, 0]));
    const workouts = new Set<Id<"workouts">>();
    let sets = 0;
    for await (const s of ctx.db
      .query("sets")
      .withIndex("by_userId_and_doneAt", (q) => q.eq("userId", userId).gte("doneAt", from).lt("doneAt", to))) {
      if (!s.done || s.kind === "warmup") continue;
      const e = await load(s.exerciseId);
      if (!e) continue;
      sets++;
      workouts.add(s.workoutId);
      for (const g of e.primaryGroups) totals.set(g, (totals.get(g) ?? 0) + 1);
      for (const g of e.secondaryGroups) totals.set(g, (totals.get(g) ?? 0) + 0.5);
      if (sets > 2000) break;
    }
    return {
      sets,
      workouts: workouts.size,
      groups: [...totals.entries()].map(([group, value]) => ({ group, sets: round1(value) })),
    };
  },
});

export const trainingSummary = defineQuery({
  name: "get_training_summary",
  description:
    "Weekly training summary for the last N weeks ending at `weekEnd` (epoch ms, exclusive): workouts, sets, volume (kg) and minutes per week. `weekMs` defaults to 7 days.",
  args: { weekEnd: v.number(), weeks: v.optional(v.number()) },
  run: async (ctx, { userId }, { weekEnd, weeks }) => {
    const n = Math.max(1, Math.min(weeks ?? 12, 52));
    const weekMs = 7 * 24 * 3600 * 1000;
    const from = weekEnd - n * weekMs;
    const buckets = Array.from({ length: n }, (_, i) => ({
      start: from + i * weekMs,
      workouts: 0,
      sets: 0,
      volumeKg: 0,
      minutes: 0,
    }));
    const recent: Doc<"workouts">[] = [];
    for await (const w of ctx.db
      .query("workouts")
      .withIndex("by_userId_and_startedAt", (q) => q.eq("userId", userId).gte("startedAt", from).lt("startedAt", weekEnd))) {
      if (w.status !== "completed") continue;
      const b = buckets[Math.floor((w.startedAt - from) / weekMs)];
      if (!b) continue;
      b.workouts++;
      b.sets += w.stats?.sets ?? 0;
      b.volumeKg += w.stats?.volumeKg ?? 0;
      b.minutes += Math.round((w.stats?.durationSec ?? 0) / 60);
      recent.push(w);
    }
    // Streak = consecutive weeks (ending with the latest) with at least one workout.
    let streak = 0;
    for (let i = n - 1; i >= 0; i--) {
      if (buckets[i].workouts > 0) streak++;
      else if (i === n - 1) continue; // current week may still be empty
      else break;
    }
    const total = await ctx.db
      .query("workouts")
      .withIndex("by_userId_and_status", (q) => q.eq("userId", userId).eq("status", "completed"))
      .take(5000);
    return {
      weeks: buckets,
      streakWeeks: streak,
      totalWorkouts: total.length,
      firstWorkoutAt: total.reduce((min, w) => Math.min(min, w.startedAt), Number.POSITIVE_INFINITY) || null,
    };
  },
});

export const recentPrs = defineQuery({
  name: "list_personal_records",
  description: "Personal records: the best estimated 1RM per exercise, newest first.",
  args: { limit: v.optional(v.number()) },
  run: async (ctx, { userId }, { limit }) => {
    const load = exerciseLoader(ctx);
    const rows = await ctx.db
      .query("exerciseStats")
      .withIndex("by_userId_and_exerciseId", (q) => q.eq("userId", userId))
      .take(1000);
    const withBest = rows.filter((r) => (r.bestE1rmKg || r.bestReps) && r.bestSetAt).sort((a, b) => (b.bestSetAt ?? 0) - (a.bestSetAt ?? 0));
    const out = [];
    for (const r of withBest.slice(0, Math.max(1, Math.min(limit ?? 30, 200)))) {
      const e = await load(r.exerciseId);
      if (!e) continue;
      out.push({
        exerciseId: r.exerciseId,
        name: e.name,
        slug: e.slug,
        tracking: e.tracking,
        thumbnailUrl: e.thumbnailUrl ?? null,
        bestE1rmKg: r.bestE1rmKg ?? null,
        weightKg: r.bestWeightKg ?? null,
        reps: r.bestReps ?? null,
        at: r.bestSetAt!,
        totalSets: r.totalSets,
      });
    }
    return out;
  },
});

// ---------------------------------------------------------------------------
// Body metrics

export const listBodyMetrics = defineQuery({
  name: "list_body_metrics",
  description: "Body measurements of one kind (default 'weight'), newest first.",
  args: { kind: v.optional(v.string()), limit: v.optional(v.number()) },
  run: async (ctx, { userId }, { kind, limit }) =>
    await ctx.db
      .query("bodyMetrics")
      .withIndex("by_userId_and_kind_and_measuredAt", (q) => q.eq("userId", userId).eq("kind", kind ?? "weight"))
      .order("desc")
      .take(Math.max(1, Math.min(limit ?? 120, 1000))),
});

export const logBodyMetric = defineMutation({
  name: "log_body_metric",
  description: "Record a body measurement. kind: weight (kg) | bodyFat (%) | waist (cm) | chest (cm) | arm (cm) | thigh (cm).",
  args: { kind: v.string(), value: v.number(), measuredAt: v.optional(v.number()), notes: v.optional(v.string()) },
  audit: true,
  run: async (ctx, { userId, actor }, { kind, value, measuredAt, notes }) => {
    if (!(value > 0 && value < 1000)) fail("Value out of range");
    const unit = kind === "weight" ? "kg" : kind === "bodyFat" ? "%" : "cm";
    return await ctx.db.insert("bodyMetrics", {
      userId,
      kind,
      value: round1(value),
      unit,
      measuredAt: measuredAt ?? Date.now(),
      notes,
      source: actor,
    });
  },
  summarize: (a) => `Logged ${a.kind} ${a.value}`,
});

export const deleteBodyMetric = defineMutation({
  name: "delete_body_metric",
  description: "Delete a body measurement.",
  args: { metricId: v.id("bodyMetrics") },
  run: async (ctx, { userId }, { metricId }) => {
    const m = await own(ctx, userId, "bodyMetrics", metricId);
    await ctx.db.delete(m._id);
    return null;
  },
});

export const recentActivity = defineQuery({
  name: "list_activity",
  description: "Audit log of recent changes (who: user/agent/import, what, when). Useful to explain or review what an agent changed.",
  args: { limit: v.optional(v.number()) },
  run: async (ctx, { userId }, { limit }) =>
    await ctx.db
      .query("activity")
      .withIndex("by_userId_and_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(Math.max(1, Math.min(limit ?? 50, 500))),
});
