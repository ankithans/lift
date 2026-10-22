import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { defineMutation, defineQuery } from "../lib/commands";
import { e1rm, exerciseSummary, fail, readableExercise, round1, type Ctx } from "../lib/util";
import { statsFor } from "./workouts";

export const MUSCLE_GROUPS = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Forearms",
  "Abs",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Traps",
  "Adductors",
] as const;

async function allVisible(ctx: Ctx, userId: Id<"users">) {
  const shared = await ctx.db
    .query("exercises")
    .withIndex("by_userId_and_name", (q) => q.eq("userId", undefined))
    .take(1000);
  const mine = await ctx.db
    .query("exercises")
    .withIndex("by_userId_and_name", (q) => q.eq("userId", userId))
    .take(500);
  return [...mine, ...shared];
}

export const searchExercises = defineQuery({
  name: "search_exercises",
  description:
    "Search the exercise library by name, and/or filter by muscle group (Chest, Back, Shoulders, Biceps, Triceps, Forearms, Abs, Quads, Hamstrings, Glutes, Calves, Traps, Adductors) or category (Cardio, Rehab, Warm-up). Returns ids to use with other tools.",
  args: {
    query: v.optional(v.string()),
    group: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  run: async (ctx, { userId }, { query, group, limit }) => {
    const max = Math.max(1, Math.min(limit ?? 400, 400));
    const text = query?.trim();
    let rows: Doc<"exercises">[];
    if (text) {
      const mine = await ctx.db
        .query("exercises")
        .withSearchIndex("search_text", (q) => q.search("searchText", text).eq("userId", userId))
        .take(20);
      const shared = await ctx.db
        .query("exercises")
        .withSearchIndex("search_text", (q) => q.search("searchText", text).eq("userId", undefined))
        .take(80);
      rows = [...mine, ...shared];
    } else {
      rows = (await allVisible(ctx, userId)).filter((e) => e.listed);
    }
    if (group) {
      rows = rows.filter(
        (e) => e.primaryGroups.includes(group) || e.categories.includes(group) || e.categories.some((c) => c.startsWith(`${group}:`)),
      );
    }
    return rows.slice(0, max).map((e) => ({ ...exerciseSummary(e), categories: e.categories }));
  },
});

export const recentExercises = defineQuery({
  name: "list_recent_exercises",
  description: "Exercises the user has logged, most recently used first.",
  args: { limit: v.optional(v.number()) },
  run: async (ctx, { userId }, { limit }) => {
    const rows = await ctx.db
      .query("exerciseStats")
      .withIndex("by_userId_and_exerciseId", (q) => q.eq("userId", userId))
      .take(1000);
    const out = [];
    for (const r of rows.filter((r) => r.lastDoneAt).sort((a, b) => (b.lastDoneAt ?? 0) - (a.lastDoneAt ?? 0)).slice(0, Math.max(1, Math.min(limit ?? 40, 200)))) {
      const e = await ctx.db.get(r.exerciseId);
      if (e) out.push({ ...exerciseSummary(e), categories: e.categories, lastDoneAt: r.lastDoneAt ?? null });
    }
    return out;
  },
});

export const getExercise = defineQuery({
  name: "get_exercise",
  description:
    "Everything about one exercise (by id or slug): muscles worked, equipment, how-to steps, cues, video, plus the user's personal best and recent sessions.",
  args: { id: v.optional(v.string()), slug: v.optional(v.string()), historyLimit: v.optional(v.number()) },
  run: async (ctx, { userId }, { id, slug, historyLimit }) => {
    let exercise: Doc<"exercises"> | null = null;
    if (id) exercise = await readableExercise(ctx, userId, id);
    else if (slug) exercise = await ctx.db.query("exercises").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!exercise || (exercise.userId && exercise.userId !== userId)) fail("exercise not found");
    const stats = await statsFor(ctx, userId, exercise._id);

    // Recent sessions for this exercise (newest first).
    const sessions: {
      workoutId: Id<"workouts">;
      title: string;
      at: number;
      sets: { weightKg: number | null; reps: number | null; durationSec: number | null; rir: number | null; isPr: boolean }[];
      bestE1rmKg: number;
      volumeKg: number;
    }[] = [];
    const byWorkout = new Map<string, (typeof sessions)[number]>();
    const workoutCache = new Map<string, Doc<"workouts"> | null>();
    const limit = Math.max(1, Math.min(historyLimit ?? 40, 200));
    for await (const s of ctx.db
      .query("sets")
      .withIndex("by_userId_and_exerciseId_and_doneAt", (q) => q.eq("userId", userId).eq("exerciseId", exercise._id).gt("doneAt", 0))
      .order("desc")) {
      if (!s.done || s.kind === "warmup") continue;
      if (!workoutCache.has(s.workoutId)) workoutCache.set(s.workoutId, await ctx.db.get(s.workoutId));
      const w = workoutCache.get(s.workoutId);
      if (!w || w.status !== "completed") continue;
      let entry = byWorkout.get(w._id);
      if (!entry) {
        if (sessions.length >= limit) break;
        entry = { workoutId: w._id, title: w.title, at: w.startedAt, sets: [], bestE1rmKg: 0, volumeKg: 0 };
        byWorkout.set(w._id, entry);
        sessions.push(entry);
      }
      entry.sets.unshift({ weightKg: s.weightKg ?? null, reps: s.reps ?? null, durationSec: s.durationSec ?? null, rir: s.rir ?? null, isPr: Boolean(s.isPr) });
      entry.bestE1rmKg = round1(Math.max(entry.bestE1rmKg, e1rm(s.weightKg, s.reps)));
      entry.volumeKg += (s.weightKg ?? 0) * (s.reps ?? 0);
    }

    return {
      ...exerciseSummary(exercise),
      aliases: exercise.aliases,
      muscles: exercise.muscles,
      categories: exercise.categories,
      kind: exercise.kind,
      movement: exercise.movement ?? null,
      steps: exercise.steps,
      cues: exercise.cues,
      tips: exercise.tips ?? null,
      videoUrl: exercise.videoUrl ?? null,
      defaults: exercise.defaults,
      custom: Boolean(exercise.userId),
      stats: stats
        ? {
            totalSets: stats.totalSets,
            lastDoneAt: stats.lastDoneAt ?? null,
            lastSets: stats.lastSets,
            bestE1rmKg: stats.bestE1rmKg ?? null,
            bestWeightKg: stats.bestWeightKg ?? null,
            bestReps: stats.bestReps ?? null,
            bestSetAt: stats.bestSetAt ?? null,
          }
        : null,
      sessions,
    };
  },
});

export const createExercise = defineMutation({
  name: "create_custom_exercise",
  description: "Create a custom exercise for this user when the library has no match.",
  args: {
    name: v.string(),
    primaryGroups: v.array(v.string()),
    secondaryGroups: v.optional(v.array(v.string())),
    equipment: v.optional(v.array(v.string())),
    tracking: v.optional(
      v.union(v.literal("weight_reps"), v.literal("reps"), v.literal("duration"), v.literal("weighted_bodyweight")),
    ),
    videoUrl: v.optional(v.string()),
    steps: v.optional(v.array(v.string())),
  },
  audit: true,
  run: async (ctx, { userId }, args) => {
    const name = args.name.trim();
    if (!name) fail("Name required");
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${userId.slice(-6)}`;
    return await ctx.db.insert("exercises", {
      userId,
      slug,
      name,
      aliases: [],
      muscles: [
        ...args.primaryGroups.map((g) => ({ name: g, group: g, role: "primary" as const })),
        ...(args.secondaryGroups ?? []).map((g) => ({ name: g, group: g, role: "secondary" as const })),
      ],
      primaryGroups: args.primaryGroups,
      secondaryGroups: args.secondaryGroups ?? [],
      categories: args.primaryGroups,
      equipment: args.equipment ?? [],
      kind: "custom",
      tracking: args.tracking ?? "weight_reps",
      unilateral: false,
      steps: args.steps ?? [],
      cues: [],
      videoUrl: args.videoUrl,
      defaults: { sets: 3, repLow: 8, repHigh: 12, restSec: 90 },
      listed: true,
      searchText: [name, ...args.primaryGroups, ...(args.equipment ?? [])].join(" "),
      source: "custom",
    });
  },
  summarize: (a) => `Created exercise “${a.name}”`,
});
