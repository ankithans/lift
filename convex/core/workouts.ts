import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { setKind } from "../schema";
import { defineMutation, defineQuery } from "../lib/commands";
import { e1rm, exerciseLoader, exerciseSummary, fail, orphanedGroups, own, readableExercise, round1, setScore, type Ctx } from "../lib/util";
import { getProfile } from "./profile";

// ---------------------------------------------------------------------------
// Reading

async function exercisesOf(ctx: Ctx, workoutId: Id<"workouts">) {
  return await ctx.db
    .query("workoutExercises")
    .withIndex("by_workoutId_and_order", (q) => q.eq("workoutId", workoutId))
    .take(80);
}

async function setsOf(ctx: Ctx, workoutExerciseId: Id<"workoutExercises">) {
  return await ctx.db
    .query("sets")
    .withIndex("by_workoutExerciseId_and_order", (q) => q.eq("workoutExerciseId", workoutExerciseId))
    .take(40);
}

export async function statsFor(ctx: Ctx, userId: Id<"users">, exerciseId: Id<"exercises">) {
  return await ctx.db
    .query("exerciseStats")
    .withIndex("by_userId_and_exerciseId", (q) => q.eq("userId", userId).eq("exerciseId", exerciseId))
    .unique();
}

export async function loadWorkout(ctx: Ctx, workout: Doc<"workouts">) {
  const load = exerciseLoader(ctx);
  const rows = await exercisesOf(ctx, workout._id);
  const exercises = [];
  for (const we of rows) {
    const e = await load(we.exerciseId);
    if (!e) continue;
    const stats = await statsFor(ctx, workout.userId, we.exerciseId);
    const fromThisWorkout = stats?.lastWorkoutId === workout._id;
    exercises.push({
      ...we,
      exercise: exerciseSummary(e),
      sets: await setsOf(ctx, we._id),
      // For completed workouts the stats may point at this very workout; then "previous" is unknown here.
      previous: fromThisWorkout ? [] : (stats?.lastSets ?? []),
      best: stats && (stats.bestE1rmKg || stats.bestReps) ? { e1rmKg: stats.bestE1rmKg ?? null, weightKg: stats.bestWeightKg ?? null, reps: stats.bestReps ?? null } : null,
    });
  }
  const programDay = workout.programDayId ? await ctx.db.get(workout.programDayId) : null;
  return { ...workout, programDayTitle: programDay?.title ?? null, exercises };
}
export type WorkoutDetail = Awaited<ReturnType<typeof loadWorkout>>;

export async function findActive(ctx: Ctx, userId: Id<"users">) {
  return await ctx.db
    .query("workouts")
    .withIndex("by_userId_and_status", (q) => q.eq("userId", userId).eq("status", "active"))
    .first();
}

export const getActiveWorkout = defineQuery({
  name: "get_active_workout",
  description: "The workout in progress (if any) with every exercise, its sets (weight kg, reps, rir, done) and the previous session's sets for reference.",
  args: {},
  run: async (ctx, { userId }) => {
    const w = await findActive(ctx, userId);
    return w ? await loadWorkout(ctx, w) : null;
  },
});

export const getWorkout = defineQuery({
  name: "get_workout",
  description: "Full detail of one workout (active or completed) including all sets.",
  args: { workoutId: v.id("workouts") },
  run: async (ctx, { userId }, { workoutId }) => loadWorkout(ctx, await own(ctx, userId, "workouts", workoutId)),
});

export const listWorkouts = defineQuery({
  name: "list_workouts",
  description: "Completed workouts, newest first, paginated. Each has title, start/finish time and stats (duration, sets, reps, volume kg, PRs).",
  args: { paginationOpts: paginationOptsValidator },
  run: async (ctx, { userId }, { paginationOpts }) => {
    const page = await ctx.db
      .query("workouts")
      .withIndex("by_userId_and_startedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .filter((q) => q.eq(q.field("status"), "completed"))
      .paginate(paginationOpts);
    const load = exerciseLoader(ctx);
    const enriched = [];
    for (const w of page.page) {
      const rows = await exercisesOf(ctx, w._id);
      const names = [];
      for (const r of rows.slice(0, 8)) {
        const e = await load(r.exerciseId);
        if (e) names.push({ name: e.name, thumbnailUrl: e.thumbnailUrl ?? null });
      }
      enriched.push({ ...w, exerciseCount: rows.length, exercises: names });
    }
    return { ...page, page: enriched };
  },
});

// ---------------------------------------------------------------------------
// Starting

async function insertExercise(
  ctx: MutationCtx,
  workout: Doc<"workouts">,
  exercise: Doc<"exercises">,
  opts: { order: number; group?: string; sets: number; repLow?: number; repHigh?: number; restSec: number; notes?: string },
) {
  const weId = await ctx.db.insert("workoutExercises", {
    userId: workout.userId,
    workoutId: workout._id,
    exerciseId: exercise._id,
    order: opts.order,
    group: opts.group,
    repLow: opts.repLow,
    repHigh: opts.repHigh,
    restSec: opts.restSec,
    notes: opts.notes,
  });
  for (let i = 0; i < opts.sets; i++) {
    await ctx.db.insert("sets", {
      userId: workout.userId,
      workoutId: workout._id,
      workoutExerciseId: weId,
      exerciseId: exercise._id,
      order: i,
      kind: "working",
      done: false,
    });
  }
  return weId;
}

export const startWorkout = defineMutation({
  name: "start_workout",
  description: "Start a workout. Pass programDayId to start a planned day (pre-fills its exercises and sets), or nothing for an empty workout. Fails if a workout is already in progress.",
  args: { programDayId: v.optional(v.id("programDays")), title: v.optional(v.string()) },
  audit: true,
  run: async (ctx, { userId, actor }, { programDayId, title }) => {
    const existing = await findActive(ctx, userId);
    if (existing) {
      // A workout left open for hours was forgotten: close it out instead of resuming it.
      if (Date.now() - existing.startedAt < 6 * 3600 * 1000) return existing._id;
      const sets = await ctx.db.query("sets").withIndex("by_workoutId", (q) => q.eq("workoutId", existing._id)).take(400);
      const lastDone = Math.max(0, ...sets.filter((s) => s.done).map((s) => s.doneAt ?? 0));
      if (lastDone > 0) await finalizeWorkout(ctx, existing, lastDone + 60_000);
      else {
        for (const s of sets) await ctx.db.delete(s._id);
        for (const we of await exercisesOf(ctx, existing._id)) await ctx.db.delete(we._id);
        await ctx.db.delete(existing._id);
      }
    }
    const day = programDayId ? await own(ctx, userId, "programDays", programDayId) : null;
    const workoutId = await ctx.db.insert("workouts", {
      userId,
      programDayId: day?._id,
      title: title ?? day?.title ?? "Workout",
      status: "active",
      startedAt: Date.now(),
      source: actor,
    });
    if (day) {
      const workout = (await ctx.db.get(workoutId))!;
      const slots = await ctx.db
        .query("programExercises")
        .withIndex("by_programDayId_and_order", (q) => q.eq("programDayId", day._id))
        .take(60);
      for (const [order, slot] of slots.entries()) {
        const exercise = await ctx.db.get(slot.exerciseId);
        if (!exercise) continue;
        await insertExercise(ctx, workout, exercise, {
          order,
          group: slot.group,
          sets: Math.max(1, Math.min(12, slot.sets)),
          repLow: slot.repLow,
          repHigh: slot.repHigh,
          restSec: slot.restSec,
          notes: slot.notes,
        });
      }
    }
    return workoutId;
  },
  summarize: (a) => `Started workout ${a.title ?? ""}`.trim(),
});

// ---------------------------------------------------------------------------
// Sets

const nullableNumber = v.optional(v.union(v.number(), v.null()));

function cleanValues(args: { weightKg?: number | null; reps?: number | null; rir?: number | null; durationSec?: number | null }) {
  const out: Partial<Doc<"sets">> = {};
  // Reject typos instead of silently clamping them into PRs.
  if (args.weightKg != null && (args.weightKg < 0 || args.weightKg > 1000)) fail("That weight looks wrong (max 1000 kg).");
  if (args.reps != null && (args.reps < 0 || args.reps > 500)) fail("That rep count looks wrong (max 500).");
  if (args.durationSec != null && (args.durationSec < 0 || args.durationSec > 6 * 3600)) fail("That duration looks wrong (max 6 hours).");
  const num = (x: number | null | undefined, max: number) =>
    x === null ? undefined : Math.max(0, Math.min(max, round1(x as number)));
  // Weight keeps gram precision so lb entries (135 lb = 61.235 kg) round-trip exactly.
  if (args.weightKg !== undefined)
    out.weightKg = args.weightKg === null ? undefined : Math.max(0, Math.min(2000, Math.round(args.weightKg * 1000) / 1000));
  if (args.reps !== undefined) out.reps = args.reps === null ? undefined : Math.round(num(args.reps, 1000)!);
  if (args.rir !== undefined) out.rir = args.rir === null ? undefined : Math.round(num(args.rir, 10)!);
  if (args.durationSec !== undefined) out.durationSec = num(args.durationSec, 86400);
  return out;
}

async function afterHistoryEdit(ctx: MutationCtx, workout: Doc<"workouts">, exerciseIds: Id<"exercises">[]) {
  if (workout.status !== "completed") return;
  for (const id of new Set(exerciseIds)) {
    await rebuildPrs(ctx, workout.userId, id);
    await recomputeExerciseStats(ctx, workout.userId, id);
  }
  const fresh = (await ctx.db.get(workout._id))!;
  await ctx.db.patch(workout._id, { stats: await computeStats(ctx, fresh) });
}

async function normalizeGroups(ctx: MutationCtx, workoutId: Id<"workouts">) {
  for (const r of orphanedGroups(await exercisesOf(ctx, workoutId))) await ctx.db.patch(r._id, { group: undefined });
}

/**
 * Re-flag PRs for one exercise across the user's whole history, in time order:
 * a workout's best set is a PR when it beats every earlier workout.
 */
export async function rebuildPrs(ctx: MutationCtx, userId: Id<"users">, exerciseId: Id<"exercises">) {
  const byWorkout = new Map<Id<"workouts">, Doc<"sets">[]>();
  let n = 0;
  for await (const s of ctx.db
    .query("sets")
    .withIndex("by_userId_and_exerciseId_and_doneAt", (q) => q.eq("userId", userId).eq("exerciseId", exerciseId).gt("doneAt", 0))) {
    byWorkout.set(s.workoutId, [...(byWorkout.get(s.workoutId) ?? []), s]);
    if (++n > 4000) break;
  }
  const workouts = [];
  for (const id of byWorkout.keys()) {
    const w = await ctx.db.get(id);
    if (w && w.status === "completed") workouts.push(w);
  }
  workouts.sort((a, b) => a.startedAt - b.startedAt);
  let best: number | null = null;
  const touched = new Set<Id<"workouts">>();
  for (const w of workouts) {
    const sets = byWorkout.get(w._id)!;
    const eligible = sets.filter((s) => s.done && s.kind !== "warmup");
    const top = eligible.reduce<Doc<"sets"> | null>((a, b) => (!a || setScore(b) > setScore(a) ? b : a), null);
    const topScore = top ? setScore(top) : 0;
    for (const s of sets) {
      const isPr = best !== null && top?._id === s._id && topScore > best + 0.01;
      if (Boolean(s.isPr) !== isPr) {
        await ctx.db.patch(s._id, { isPr });
        touched.add(w._id);
      }
    }
    if (top) best = Math.max(best ?? 0, topScore);
  }
  for (const id of touched) {
    const w = (await ctx.db.get(id))!;
    await ctx.db.patch(id, { stats: await computeStats(ctx, w) });
  }
}

export const updateSet = defineMutation({
  name: "update_set",
  description: "Change a set's weight (kg), reps, RIR (reps in reserve, 0 = failure), duration or kind. Use null to clear a value. Works on active and completed workouts.",
  args: {
    setId: v.id("sets"),
    weightKg: nullableNumber,
    reps: nullableNumber,
    rir: nullableNumber,
    durationSec: nullableNumber,
    kind: v.optional(setKind),
  },
  run: async (ctx, { userId }, { setId, kind, ...values }) => {
    const set = await own(ctx, userId, "sets", setId);
    await ctx.db.patch(set._id, { ...cleanValues(values), ...(kind ? { kind } : {}) });
    const workout = (await ctx.db.get(set.workoutId))!;
    await afterHistoryEdit(ctx, workout, [set.exerciseId]);
    return null;
  },
});

export const completeSet = defineMutation({
  name: "complete_set",
  description: "Mark a set done, optionally with its final values. Starts the rest timer (skipped between exercises of a superset). Returns whether it is a provisional PR.",
  args: {
    setId: v.id("sets"),
    weightKg: nullableNumber,
    reps: nullableNumber,
    rir: nullableNumber,
    durationSec: nullableNumber,
  },
  run: async (ctx, { userId }, { setId, ...values }) => {
    const set = await own(ctx, userId, "sets", setId);
    const workout = (await ctx.db.get(set.workoutId))!;
    const now = Date.now();
    // Back-filling a finished workout keeps its sets inside that workout's time.
    const doneAt = set.doneAt ?? (workout.status === "active" ? now : (workout.finishedAt ?? workout.startedAt));
    const patch = { ...cleanValues(values), done: true, doneAt };
    const merged = { ...set, ...patch };
    let isPr = false;
    const stats = await statsFor(ctx, userId, set.exerciseId);
    const score = setScore(merged);
    const priorBest = stats?.bestScore ?? (stats?.bestE1rmKg ? 1000 + stats.bestE1rmKg : 0);
    if (set.kind !== "warmup" && stats && stats.totalSets > 0 && score > 0 && score > priorBest + 0.01) {
      const siblings = await ctx.db
        .query("sets")
        .withIndex("by_workoutExerciseId_and_order", (q) => q.eq("workoutExerciseId", set.workoutExerciseId))
        .take(40);
      isPr = siblings.every((s) => s._id === set._id || !s.isPr || setScore(s) < score);
      if (isPr) for (const s of siblings) if (s.isPr && s._id !== set._id) await ctx.db.patch(s._id, { isPr: false });
    }
    await ctx.db.patch(set._id, { ...patch, isPr });

    let restSec = 0;
    if (workout.status === "active") {
      const we = (await ctx.db.get(set.workoutExerciseId))!;
      restSec = we.restSec;
      if (we.group) {
        // Superset = adjacent exercises sharing a group; go straight to the next one.
        const all = await exercisesOf(ctx, workout._id);
        const next = all[all.findIndex((x) => x._id === we._id) + 1];
        if (next && next.group === we.group) restSec = 0;
      }
      if (restSec > 0) await ctx.db.patch(workout._id, { restEndsAt: now + restSec * 1000, restTotalSec: restSec });
    } else {
      await afterHistoryEdit(ctx, workout, [set.exerciseId]);
    }
    return { isPr, restSec };
  },
});

export const uncompleteSet = defineMutation({
  name: "uncomplete_set",
  description: "Mark a done set as not done.",
  args: { setId: v.id("sets") },
  run: async (ctx, { userId }, { setId }) => {
    const set = await own(ctx, userId, "sets", setId);
    await ctx.db.patch(set._id, { done: false, doneAt: undefined, isPr: false });
    const workout = (await ctx.db.get(set.workoutId))!;
    // Only cancel the rest timer this very set started.
    const restStart = workout.restEndsAt ? workout.restEndsAt - (workout.restTotalSec ?? 0) * 1000 : null;
    if (workout.status === "active" && restStart !== null && set.doneAt !== undefined && Math.abs(set.doneAt - restStart) < 3000) {
      await ctx.db.patch(workout._id, { restEndsAt: undefined });
    }
    await afterHistoryEdit(ctx, workout, [set.exerciseId]);
    return null;
  },
});

export const addSet = defineMutation({
  name: "add_set",
  description: "Append a set to an exercise in a workout.",
  args: { workoutExerciseId: v.id("workoutExercises"), kind: v.optional(setKind) },
  run: async (ctx, { userId }, { workoutExerciseId, kind }) => {
    const we = await own(ctx, userId, "workoutExercises", workoutExerciseId);
    const sets = await setsOf(ctx, we._id);
    if (sets.length >= 30) fail("Too many sets");
    const last = sets[sets.length - 1];
    return await ctx.db.insert("sets", {
      userId,
      workoutId: we.workoutId,
      workoutExerciseId: we._id,
      exerciseId: we.exerciseId,
      order: (last?.order ?? -1) + 1,
      kind: kind ?? "working",
      done: false,
    });
  },
});

export const removeSet = defineMutation({
  name: "remove_set",
  description: "Delete a set.",
  args: { setId: v.id("sets") },
  run: async (ctx, { userId }, { setId }) => {
    const set = await own(ctx, userId, "sets", setId);
    await ctx.db.delete(set._id);
    const workout = (await ctx.db.get(set.workoutId))!;
    await afterHistoryEdit(ctx, workout, [set.exerciseId]);
    return null;
  },
});

// ---------------------------------------------------------------------------
// Exercises within a workout

export const addWorkoutExercise = defineMutation({
  name: "add_workout_exercise",
  description: "Add an exercise to a workout (at the end, or right after `afterWorkoutExerciseId`). Optionally join a superset group.",
  args: {
    workoutId: v.id("workouts"),
    exerciseId: v.id("exercises"),
    sets: v.optional(v.number()),
    group: v.optional(v.string()),
    afterWorkoutExerciseId: v.optional(v.id("workoutExercises")),
  },
  audit: true,
  run: async (ctx, { userId }, args) => {
    const workout = await own(ctx, userId, "workouts", args.workoutId);
    const exercise = await readableExercise(ctx, userId, args.exerciseId);
    const rows = await exercisesOf(ctx, workout._id);
    let order = rows.length;
    if (args.afterWorkoutExerciseId) {
      const anchor = rows.find((r) => r._id === args.afterWorkoutExerciseId);
      if (anchor) {
        order = anchor.order + 1;
        for (const r of rows) if (r.order >= order) await ctx.db.patch(r._id, { order: r.order + 1 });
      }
    }
    const profile = await getProfile(ctx, userId);
    return await insertExercise(ctx, workout, exercise, {
      order,
      group: args.group,
      sets: Math.max(1, Math.min(10, args.sets ?? (exercise.defaults.sets || 3))),
      repLow: exercise.defaults.repLow || undefined,
      repHigh: exercise.defaults.repHigh || undefined,
      restSec: exercise.defaults.restSec || profile?.defaultRestSec || 90,
    });
  },
  summarize: () => "Added exercise to workout",
});

export const removeWorkoutExercise = defineMutation({
  name: "remove_workout_exercise",
  description: "Remove an exercise (and its sets) from a workout.",
  args: { workoutExerciseId: v.id("workoutExercises") },
  audit: true,
  run: async (ctx, { userId }, { workoutExerciseId }) => {
    const we = await own(ctx, userId, "workoutExercises", workoutExerciseId);
    for (const s of await setsOf(ctx, we._id)) await ctx.db.delete(s._id);
    await ctx.db.delete(we._id);
    await normalizeGroups(ctx, we.workoutId);
    const workout = (await ctx.db.get(we.workoutId))!;
    await afterHistoryEdit(ctx, workout, [we.exerciseId]);
    return null;
  },
  summarize: () => "Removed exercise from workout",
});

export const swapWorkoutExercise = defineMutation({
  name: "swap_workout_exercise",
  description: "Replace an exercise in a workout with another, keeping its sets (values are cleared on not-done sets).",
  args: { workoutExerciseId: v.id("workoutExercises"), exerciseId: v.id("exercises") },
  audit: true,
  run: async (ctx, { userId }, { workoutExerciseId, exerciseId }) => {
    const we = await own(ctx, userId, "workoutExercises", workoutExerciseId);
    const exercise = await readableExercise(ctx, userId, exerciseId);
    await ctx.db.patch(we._id, {
      exerciseId: exercise._id,
      repLow: exercise.defaults.repLow || undefined,
      repHigh: exercise.defaults.repHigh || undefined,
      restSec: exercise.defaults.restSec || we.restSec,
    });
    for (const s of await setsOf(ctx, we._id)) {
      await ctx.db.patch(s._id, {
        exerciseId: exercise._id,
        isPr: false,
        ...(s.done ? {} : { weightKg: undefined, reps: undefined, rir: undefined, durationSec: undefined }),
      });
    }
    const workout = (await ctx.db.get(we.workoutId))!;
    await afterHistoryEdit(ctx, workout, [we.exerciseId, exercise._id]);
    return null;
  },
  summarize: () => "Swapped exercise",
});

export const updateWorkoutExercise = defineMutation({
  name: "update_workout_exercise",
  description: "Change rest seconds, notes, rep target or superset group (null = unlink) of an exercise in a workout, move it to a new 0-based position, or `linkNext` to superset it with the following exercise.",
  args: {
    workoutExerciseId: v.id("workoutExercises"),
    restSec: v.optional(v.number()),
    notes: v.optional(v.union(v.string(), v.null())),
    group: v.optional(v.union(v.string(), v.null())),
    repLow: v.optional(v.number()),
    repHigh: v.optional(v.number()),
    position: v.optional(v.number()),
    /** Join this exercise and the next one into a superset (one atomic step). */
    linkNext: v.optional(v.boolean()),
  },
  run: async (ctx, { userId }, { workoutExerciseId, position, linkNext, ...patch }) => {
    const we = await own(ctx, userId, "workoutExercises", workoutExerciseId);
    if (linkNext) {
      const rows = await exercisesOf(ctx, we.workoutId);
      const next = rows[rows.findIndex((r) => r._id === we._id) + 1];
      if (!next) fail("No next exercise to superset with");
      const g = next.group ?? we.group ?? `ss-${we._id.slice(-6)}${next._id.slice(-4)}`;
      await ctx.db.patch(we._id, { group: g });
      await ctx.db.patch(next._id, { group: g });
      return null;
    }
    await ctx.db.patch(we._id, {
      ...(patch.restSec !== undefined ? { restSec: Math.max(0, Math.min(900, patch.restSec)) } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes ?? undefined } : {}),
      ...(patch.group !== undefined ? { group: patch.group ?? undefined } : {}),
      ...(patch.repLow !== undefined ? { repLow: patch.repLow } : {}),
      ...(patch.repHigh !== undefined ? { repHigh: patch.repHigh } : {}),
    });
    if (position !== undefined) {
      const rows = (await exercisesOf(ctx, we.workoutId)).filter((r) => r._id !== we._id);
      rows.splice(Math.max(0, Math.min(position, rows.length)), 0, we);
      for (const [i, r] of rows.entries()) if (r.order !== i) await ctx.db.patch(r._id, { order: i });
    }
    await normalizeGroups(ctx, we.workoutId);
    return null;
  },
});

// ---------------------------------------------------------------------------
// Rest timer

export const setRest = defineMutation({
  name: "set_rest_timer",
  description: "Control the rest timer of the active workout: `addSec` to extend/shorten (negative), or `skip` to end it.",
  args: { workoutId: v.id("workouts"), addSec: v.optional(v.number()), skip: v.optional(v.boolean()) },
  run: async (ctx, { userId }, { workoutId, addSec, skip }) => {
    const w = await own(ctx, userId, "workouts", workoutId);
    if (skip || !w.restEndsAt) {
      await ctx.db.patch(w._id, { restEndsAt: undefined });
      return null;
    }
    const now = Date.now();
    const ends = Math.max(now, w.restEndsAt + (addSec ?? 0) * 1000);
    await ctx.db.patch(w._id, {
      restEndsAt: ends > now ? ends : undefined,
      restTotalSec: Math.max(1, (w.restTotalSec ?? 0) + (addSec ?? 0)),
    });
    return null;
  },
});

// ---------------------------------------------------------------------------
// Finishing

export async function computeStats(ctx: Ctx, workout: Doc<"workouts">) {
  const sets = await ctx.db
    .query("sets")
    .withIndex("by_workoutId", (q) => q.eq("workoutId", workout._id))
    .take(400);
  const done = sets.filter((s) => s.done && s.kind !== "warmup");
  const end = workout.finishedAt ?? Date.now();
  return {
    durationSec: Math.max(0, Math.round((end - workout.startedAt) / 1000)),
    sets: done.length,
    reps: done.reduce((n, s) => n + (s.reps ?? 0), 0),
    volumeKg: Math.round(done.reduce((n, s) => n + (s.weightKg ?? 0) * (s.reps ?? 0), 0)),
    prs: sets.filter((s) => s.isPr).length,
  };
}

/** Rebuild the cached per-exercise stats (previous sets + bests) from history. */
export async function recomputeExerciseStats(ctx: MutationCtx, userId: Id<"users">, exerciseId: Id<"exercises">) {
  const statusCache = new Map<Id<"workouts">, Doc<"workouts"> | null>();
  const workoutOf = async (id: Id<"workouts">) => {
    if (!statusCache.has(id)) statusCache.set(id, await ctx.db.get(id));
    return statusCache.get(id)!;
  };
  let best = { score: 0, e1rm: 0, weightKg: 0, reps: 0, at: 0 };
  let totalSets = 0;
  let last: Doc<"workouts"> | null = null;
  for await (const s of ctx.db
    .query("sets")
    .withIndex("by_userId_and_exerciseId_and_doneAt", (q) => q.eq("userId", userId).eq("exerciseId", exerciseId).gt("doneAt", 0))
    .order("desc")) {
    if (!s.done || s.kind === "warmup") continue;
    const w = await workoutOf(s.workoutId);
    if (!w || w.status !== "completed") continue;
    if (!last) last = w; // sets arrive newest first
    totalSets++;
    const score = setScore(s);
    if (score > best.score) best = { score, e1rm: e1rm(s.weightKg, s.reps), weightKg: s.weightKg ?? 0, reps: s.reps ?? 0, at: s.doneAt ?? 0 };
    if (totalSets > 3000) break;
  }
  let lastSets: Doc<"exerciseStats">["lastSets"] = [];
  if (last) {
    const rows = await ctx.db
      .query("sets")
      .withIndex("by_workoutId", (q) => q.eq("workoutId", last!._id))
      .take(400);
    lastSets = rows
      .filter((s) => s.exerciseId === exerciseId && s.done && s.kind !== "warmup")
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ weightKg: s.weightKg, reps: s.reps, durationSec: s.durationSec, rir: s.rir }));
  }
  const existing = await statsFor(ctx, userId, exerciseId);
  const doc = {
    userId,
    exerciseId,
    lastWorkoutId: last?._id,
    lastDoneAt: last ? (last.finishedAt ?? last.startedAt) : undefined,
    lastSets,
    bestE1rmKg: best.e1rm >= 1 ? round1(best.e1rm) : undefined,
    bestScore: best.score || undefined,
    bestWeightKg: best.weightKg || undefined,
    bestReps: best.reps || undefined,
    bestSetAt: best.at || undefined,
    totalSets,
  };
  if (existing) await ctx.db.replace(existing._id, doc);
  else await ctx.db.insert("exerciseStats", doc);
}

/** Flag the best set per exercise as a PR when it beats every earlier completed workout. */
async function markPrs(ctx: MutationCtx, workout: Doc<"workouts">) {
  const rows = await exercisesOf(ctx, workout._id);
  let count = 0;
  for (const we of rows) {
    const all = await setsOf(ctx, we._id);
    const sets = all.filter((s) => s.done && s.kind !== "warmup");
    const stats = await statsFor(ctx, workout.userId, we.exerciseId);
    const prior =
      stats && stats.totalSets > 0 && stats.lastWorkoutId !== workout._id ? (stats.bestScore ?? (stats.bestE1rmKg ? 1000 + stats.bestE1rmKg : 0)) : null;
    let top: Doc<"sets"> | null = null;
    for (const s of sets) if (!top || setScore(s) > setScore(top)) top = s;
    for (const s of all) {
      const isPr = prior !== null && top?._id === s._id && setScore(s) > prior + 0.01;
      if (isPr) count++;
      if (Boolean(s.isPr) !== isPr) await ctx.db.patch(s._id, { isPr });
    }
  }
  return count;
}

export async function finalizeWorkout(ctx: MutationCtx, workout: Doc<"workouts">, finishedAt: number, notes?: string) {
  // Drop sets that were never performed.
  const all = await ctx.db
    .query("sets")
    .withIndex("by_workoutId", (q) => q.eq("workoutId", workout._id))
    .take(400);
  for (const s of all) if (!s.done) await ctx.db.delete(s._id);
  for (const we of await exercisesOf(ctx, workout._id)) {
    const remaining = await setsOf(ctx, we._id);
    if (remaining.length === 0) await ctx.db.delete(we._id);
  }
  await markPrs(ctx, workout);
  const patched = { ...workout, status: "completed" as const, finishedAt };
  await ctx.db.patch(workout._id, {
    status: "completed",
    finishedAt,
    restEndsAt: undefined,
    ...(notes !== undefined ? { notes } : {}),
    stats: await computeStats(ctx, patched),
  });
  const exerciseIds = new Set(all.filter((s) => s.done).map((s) => s.exerciseId));
  for (const id of exerciseIds) await recomputeExerciseStats(ctx, workout.userId, id);
}

export const finishWorkout = defineMutation({
  name: "finish_workout",
  description: "Finish the active workout: drops sets that were not done, records PRs and stats. Returns the workout id.",
  args: { workoutId: v.id("workouts"), notes: v.optional(v.string()) },
  audit: true,
  run: async (ctx, { userId }, { workoutId, notes }) => {
    const workout = await own(ctx, userId, "workouts", workoutId);
    if (workout.status === "completed") return workout._id; // retried after a lost response
    if (workout.status !== "active") fail("Workout is not active");
    await finalizeWorkout(ctx, workout, Date.now(), notes);
    return workout._id;
  },
  summarize: () => "Finished workout",
});

export const discardWorkout = defineMutation({
  name: "delete_workout",
  description: "Delete a workout (active or completed) and all its sets. Irreversible.",
  args: { workoutId: v.id("workouts") },
  audit: true,
  run: async (ctx, { userId }, { workoutId }) => {
    const workout = await own(ctx, userId, "workouts", workoutId);
    const sets = await ctx.db
      .query("sets")
      .withIndex("by_workoutId", (q) => q.eq("workoutId", workout._id))
      .take(400);
    const exerciseIds = new Set(sets.filter((s) => s.done).map((s) => s.exerciseId));
    for (const s of sets) await ctx.db.delete(s._id);
    for (const we of await exercisesOf(ctx, workout._id)) await ctx.db.delete(we._id);
    await ctx.db.delete(workout._id);
    if (workout.status === "completed") for (const id of exerciseIds) await recomputeExerciseStats(ctx, userId, id);
    return null;
  },
  summarize: () => "Deleted workout",
});

export const updateWorkout = defineMutation({
  name: "update_workout",
  description: "Edit a workout's title, notes, or start/finish times (epoch ms).",
  args: {
    workoutId: v.id("workouts"),
    title: v.optional(v.string()),
    notes: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
  },
  run: async (ctx, { userId }, { workoutId, ...patch }) => {
    const workout = await own(ctx, userId, "workouts", workoutId);
    await ctx.db.patch(workout._id, patch);
    if (workout.status === "completed") {
      const updated = (await ctx.db.get(workout._id))!;
      await ctx.db.patch(workout._id, { stats: await computeStats(ctx, updated) });
    }
    return null;
  },
});

// ---------------------------------------------------------------------------
// One-shot logging (agents, imports)

export const workoutInput = v.object({
  title: v.string(),
  startedAt: v.number(),
  finishedAt: v.optional(v.number()),
  notes: v.optional(v.string()),
  programDayId: v.optional(v.id("programDays")),
  externalId: v.optional(v.string()),
  exercises: v.array(
    v.object({
      exerciseId: v.id("exercises"),
      group: v.optional(v.string()),
      notes: v.optional(v.string()),
      restSec: v.optional(v.number()),
      sets: v.array(
        v.object({
          weightKg: v.optional(v.number()),
          reps: v.optional(v.number()),
          durationSec: v.optional(v.number()),
          rir: v.optional(v.number()),
          kind: v.optional(setKind),
        }),
      ),
    }),
  ),
});

export async function insertCompletedWorkout(
  ctx: MutationCtx,
  userId: Id<"users">,
  input: typeof workoutInput.type,
  source: Doc<"workouts">["source"],
  opts: { recompute: boolean } = { recompute: true },
) {
  if (input.programDayId) await own(ctx, userId, "programDays", input.programDayId);
  const finishedAt = input.finishedAt ?? input.startedAt + 60 * 60 * 1000;
  const workoutId = await ctx.db.insert("workouts", {
    userId,
    programDayId: input.programDayId,
    title: input.title,
    status: "active",
    startedAt: input.startedAt,
    notes: input.notes,
    source,
    externalId: input.externalId,
  });
  const span = Math.max(1, finishedAt - input.startedAt);
  const totalSets = input.exercises.reduce((n, e) => n + e.sets.length, 0) || 1;
  let k = 0;
  for (const [order, item] of input.exercises.entries()) {
    const exercise = await readableExercise(ctx, userId, item.exerciseId);
    const weId = await ctx.db.insert("workoutExercises", {
      userId,
      workoutId,
      exerciseId: exercise._id,
      order,
      group: item.group,
      notes: item.notes,
      restSec: item.restSec ?? exercise.defaults.restSec ?? 90,
      repLow: exercise.defaults.repLow || undefined,
      repHigh: exercise.defaults.repHigh || undefined,
    });
    for (const [i, s] of item.sets.entries()) {
      k++;
      await ctx.db.insert("sets", {
        userId,
        workoutId,
        workoutExerciseId: weId,
        exerciseId: exercise._id,
        order: i,
        kind: s.kind ?? "working",
        weightKg: s.weightKg,
        reps: s.reps,
        durationSec: s.durationSec,
        rir: s.rir,
        done: true,
        doneAt: Math.round(input.startedAt + (span * k) / (totalSets + 1)),
      });
    }
  }
  const workout = (await ctx.db.get(workoutId))!;
  if (opts.recompute) {
    await finalizeWorkout(ctx, workout, finishedAt, input.notes);
  } else {
    await ctx.db.patch(workoutId, {
      status: "completed",
      finishedAt,
      stats: await computeStats(ctx, { ...workout, finishedAt }),
    });
  }
  return workoutId;
}

export const logWorkout = defineMutation({
  name: "log_workout",
  description: "Record an already-completed workout in one call (e.g. from memory or another app). Exercise ids come from search_exercises. Weights in kg.",
  args: { workout: workoutInput },
  audit: true,
  run: async (ctx, { userId, actor }, { workout }) => insertCompletedWorkout(ctx, userId, workout, actor),
  summarize: (a) => `Logged workout “${a.workout.title}”`,
});
