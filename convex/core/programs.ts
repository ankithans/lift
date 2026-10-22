import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { TEMPLATES } from "../data/templates";
import { defineMutation, defineQuery } from "../lib/commands";
import { exerciseLoader, exerciseSummary, fail, orphanedGroups, own, readableExercise, type Ctx } from "../lib/util";
import { weekBoundaries } from "../lib/time";
import { getProfile } from "./profile";
import { statsFor } from "./workouts";

const WORK_SEC_PER_SET = 45;

export async function loadDayDetail(ctx: Ctx, day: Doc<"programDays">) {
  const load = exerciseLoader(ctx);
  const slots = await ctx.db
    .query("programExercises")
    .withIndex("by_programDayId_and_order", (q) => q.eq("programDayId", day._id))
    .take(60);
  const exercises = [];
  for (const slot of slots) {
    const e = await load(slot.exerciseId);
    if (!e) continue;
    const stats = await statsFor(ctx, day.userId, e._id);
    exercises.push({
      ...slot,
      exercise: exerciseSummary(e),
      last: stats?.lastSets.length ? { sets: stats.lastSets, at: stats.lastDoneAt ?? null } : null,
    });
  }
  // Target-muscle split by working sets (primary groups only).
  const groupSets = new Map<string, number>();
  let seconds = 0;
  for (const [i, slot] of exercises.entries()) {
    for (const g of slot.exercise.primaryGroups) {
      groupSets.set(g, (groupSets.get(g) ?? 0) + slot.sets / slot.exercise.primaryGroups.length);
    }
    const next = exercises[i + 1];
    const restsAfter = !slot.group || !next || next.group !== slot.group;
    seconds += slot.sets * (WORK_SEC_PER_SET + (restsAfter ? slot.restSec : 15));
  }
  const total = [...groupSets.values()].reduce((a, b) => a + b, 0) || 1;
  const targets = [...groupSets.entries()]
    .map(([group, sets]) => ({ group, share: sets / total }))
    .sort((a, b) => b.share - a.share);
  return {
    ...day,
    exercises,
    targets,
    estimatedMinutes: Math.round(seconds / 60 / 5) * 5 || 0,
    totalSets: exercises.reduce((n, s) => n + s.sets, 0),
  };
}
export type DayDetail = Awaited<ReturnType<typeof loadDayDetail>>;

export async function programDays(ctx: Ctx, programId: Id<"programs">) {
  return await ctx.db
    .query("programDays")
    .withIndex("by_programId_and_order", (q) => q.eq("programId", programId))
    .take(14);
}

async function activeProgram(ctx: Ctx, userId: Id<"users">) {
  const profile = await getProfile(ctx, userId);
  if (!profile?.activeProgramId) return null;
  const program = await ctx.db.get(profile.activeProgramId);
  return program && program.userId === userId ? program : null;
}

export const getActiveProgram = defineQuery({
  name: "get_program",
  description:
    "Get the user's active training program: every day (weekday 0=Sun..6=Sat, workout or rest) with its exercises, sets, rep range, rest and superset group.",
  args: {},
  run: async (ctx, { userId }) => {
    const program = await activeProgram(ctx, userId);
    if (!program) return null;
    const days = await programDays(ctx, program._id);
    return { ...program, days: await Promise.all(days.map((d) => loadDayDetail(ctx, d))) };
  },
});

export const getProgramDay = defineQuery({
  name: "get_program_day",
  description: "Get one program day (planned workout) with exercises, targets and estimated duration.",
  args: { dayId: v.id("programDays") },
  run: async (ctx, { userId }, { dayId }) => loadDayDetail(ctx, await own(ctx, userId, "programDays", dayId)),
});

export const getWeek = defineQuery({
  name: "get_week",
  description:
    "The weekly schedule with status per day (done, missed, today, upcoming, rest, active). Omit arguments for the current week in the user's time zone. Optional `boundaries`: 8 epoch-ms local midnights (each day of the week plus the next); `now`: epoch ms.",
  args: { boundaries: v.optional(v.array(v.number())), now: v.optional(v.number()) },
  run: async (ctx, { userId }, args) => {
    const now = args.now ?? Date.now();
    const profile = await getProfile(ctx, userId);
    const weekStartsOn = profile?.weekStartsOn ?? 0;
    const boundaries = args.boundaries ?? weekBoundaries(now, profile?.timezone, weekStartsOn);
    if (boundaries.length !== 8) fail("boundaries must have 8 timestamps");
    const program = await activeProgram(ctx, userId);
    const days = program ? await programDays(ctx, program._id) : [];
    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_userId_and_startedAt", (q) =>
        q.eq("userId", userId).gte("startedAt", boundaries[0]).lt("startedAt", boundaries[7]),
      )
      .take(50);
    const live = workouts.filter((w) => w.status !== "discarded");
    const usedWorkouts = new Set<string>();
    const result = [];
    for (let i = 0; i < 7; i++) {
      const start = boundaries[i];
      const end = boundaries[i + 1];
      const weekday = (weekStartsOn + i) % 7;
      const plannedDay = days.find((d) => d.weekday === weekday) ?? null;
      const planned = plannedDay ? await loadDayDetail(ctx, plannedDay) : null;
      const onThisDay = live.filter((w) => w.startedAt >= start && w.startedAt < end);
      let match: Doc<"workouts"> | undefined;
      if (planned) {
        match =
          onThisDay.find((w) => w.programDayId === planned._id) ??
          live.find((w) => w.programDayId === planned._id && !usedWorkouts.has(w._id));
      }
      if (match) usedWorkouts.add(match._id);
      const isToday = now >= start && now < end;
      let status: "done" | "active" | "missed" | "today" | "upcoming" | "rest";
      if (match?.status === "active") status = "active";
      else if (match?.status === "completed") status = "done";
      else if (!planned || planned.kind === "rest") status = "rest";
      else if (isToday) status = "today";
      else if (end <= now) status = "missed";
      else status = "upcoming";
      result.push({ start, weekday, isToday, status, planned, workout: match ?? null, extras: [] as Doc<"workouts">[] });
    }
    for (const w of live) {
      if (usedWorkouts.has(w._id)) continue;
      const slot = result.find((_, i) => w.startedAt >= boundaries[i] && w.startedAt < boundaries[i + 1]);
      slot?.extras.push(w);
    }
    return { program: program ? { _id: program._id, name: program.name, goal: program.goal, level: program.level } : null, days: result };
  },
});

// ---------------------------------------------------------------------------
// Program building

export async function createProgramFromTemplate(
  ctx: MutationCtx,
  userId: Id<"users">,
  key: string,
) {
  const template = TEMPLATES.find((t) => t.key === key);
  if (!template) fail(`Unknown template ${key}`);
  const programId = await ctx.db.insert("programs", {
    userId,
    name: template.name,
    goal: template.goal,
    level: template.level,
    description: template.description,
    source: `template:${key}`,
  });
  for (const [order, day] of template.days.entries()) {
    const dayId = await ctx.db.insert("programDays", {
      userId,
      programId,
      order,
      weekday: day.weekday ?? undefined,
      title: day.title,
      kind: day.kind,
    });
    for (const [i, [slug, sets, repLow, repHigh, restSec, group]] of day.exercises.entries()) {
      const exercise = await ctx.db.query("exercises").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
      if (!exercise) continue;
      await ctx.db.insert("programExercises", {
        userId,
        programDayId: dayId,
        exerciseId: exercise._id,
        order: i,
        group,
        sets,
        repLow,
        repHigh,
        restSec,
      });
    }
  }
  return programId;
}

async function setActiveProgram(ctx: MutationCtx, userId: Id<"users">, programId: Id<"programs">) {
  const profile = await getProfile(ctx, userId);
  if (!profile) fail("Profile missing");
  await ctx.db.patch(profile._id, { activeProgramId: programId, onboardedAt: profile.onboardedAt ?? Date.now() });
}

export const listTemplates = defineQuery({
  name: "list_program_templates",
  description: "List built-in program templates a user can start.",
  args: {},
  run: async () =>
    TEMPLATES.map((t) => ({
      key: t.key,
      name: t.name,
      goal: t.goal,
      level: t.level,
      description: t.description,
      daysPerWeek: t.daysPerWeek,
      days: t.days.map((d) => ({ title: d.title, weekday: d.weekday, kind: d.kind, exercises: d.exercises.length })),
    })),
});

export const startProgram = defineMutation({
  name: "start_program_from_template",
  description: "Create a program from a template and make it the active program.",
  args: { template: v.string() },
  audit: true,
  run: async (ctx, { userId }, { template }) => {
    const programId = await createProgramFromTemplate(ctx, userId, template);
    await setActiveProgram(ctx, userId, programId);
    return programId;
  },
  summarize: (a) => `Started program ${a.template}`,
});

export const createEmptyProgram = defineMutation({
  name: "create_program",
  description: "Create an empty 7-day program (all rest days) and make it active. Use add_program_exercise / update_program_day to fill it.",
  args: { name: v.string() },
  audit: true,
  run: async (ctx, { userId }, { name }) => {
    const programId = await ctx.db.insert("programs", { userId, name, source: "custom" });
    for (let weekday = 0; weekday < 7; weekday++) {
      await ctx.db.insert("programDays", { userId, programId, order: weekday, weekday, title: "Rest", kind: "rest" });
    }
    await setActiveProgram(ctx, userId, programId);
    return programId;
  },
  summarize: (a) => `Created program “${a.name}”`,
});

// ---------------------------------------------------------------------------
// Editing the plan

async function reindexDay(ctx: MutationCtx, dayId: Id<"programDays">) {
  const slots = await ctx.db
    .query("programExercises")
    .withIndex("by_programDayId_and_order", (q) => q.eq("programDayId", dayId))
    .take(60);
  for (const [i, s] of slots.entries()) if (s.order !== i) await ctx.db.patch(s._id, { order: i });
  return slots;
}

async function normalizeDayGroups(ctx: MutationCtx, dayId: Id<"programDays">) {
  const slots = await ctx.db
    .query("programExercises")
    .withIndex("by_programDayId_and_order", (q) => q.eq("programDayId", dayId))
    .take(60);
  for (const r of orphanedGroups(slots)) await ctx.db.patch(r._id, { group: undefined });
}

export const renameProgram = defineMutation({
  name: "rename_program",
  description: "Rename the active program (or a specific program by id).",
  args: { name: v.string(), programId: v.optional(v.id("programs")) },
  audit: true,
  run: async (ctx, { userId }, { name, programId }) => {
    const id = programId ?? (await activeProgram(ctx, userId))?._id;
    if (!id) fail("No program");
    const program = await own(ctx, userId, "programs", id);
    const clean = name.trim().slice(0, 60);
    if (!clean) fail("Name required");
    await ctx.db.patch(program._id, { name: clean });
    return null;
  },
  summarize: (a) => `Renamed program to “${a.name}”`,
});

export const updateDay = defineMutation({
  name: "update_program_day",
  description: "Rename a program day, move it to another weekday (0=Sun..6=Sat), or switch it between workout and rest.",
  args: {
    dayId: v.id("programDays"),
    title: v.optional(v.string()),
    weekday: v.optional(v.union(v.number(), v.null())),
    kind: v.optional(v.union(v.literal("workout"), v.literal("rest"))),
    notes: v.optional(v.string()),
  },
  audit: true,
  run: async (ctx, { userId }, { dayId, title, weekday, kind, notes }) => {
    const day = await own(ctx, userId, "programDays", dayId);
    if (weekday !== undefined && weekday !== null) {
      // Swap with whatever day currently sits on that weekday.
      const siblings = await programDays(ctx, day.programId);
      const occupant = siblings.find((d) => d.weekday === weekday && d._id !== day._id);
      if (occupant) await ctx.db.patch(occupant._id, { weekday: day.weekday });
    }
    await ctx.db.patch(day._id, {
      ...(title !== undefined ? { title } : {}),
      ...(weekday !== undefined ? { weekday: weekday ?? undefined } : {}),
      ...(kind !== undefined ? { kind } : {}),
      ...(notes !== undefined ? { notes } : {}),
    });
    return null;
  },
  summarize: (a) => `Updated day ${a.title ?? ""}`.trim(),
});

export const arrangeWeek = defineMutation({
  name: "arrange_week",
  description:
    "Rearrange the weekly schedule in one go. `slots` maps each weekday (0=Sun..6=Sat) to a program day id, or null to leave that weekday free (rest). Every day of the active program listed here moves to its new weekday; days not listed keep theirs unless their weekday is taken.",
  args: { slots: v.array(v.object({ weekday: v.number(), dayId: v.union(v.id("programDays"), v.null()) })) },
  audit: true,
  run: async (ctx, { userId }, { slots }) => {
    if (slots.length === 0 || slots.length > 7) fail("slots must cover 1–7 weekdays");
    const weekdays = new Set<number>();
    const moved = new Map<string, number>();
    let programId: Id<"programs"> | null = null;
    for (const { weekday, dayId } of slots) {
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || weekdays.has(weekday)) fail("invalid weekday");
      weekdays.add(weekday);
      if (!dayId) continue;
      const day = await own(ctx, userId, "programDays", dayId);
      if (programId && day.programId !== programId) fail("days must belong to one program");
      programId = day.programId;
      if (moved.has(day._id)) fail("a day can only appear once");
      moved.set(day._id, weekday);
    }
    if (!programId) return null;
    for (const d of await programDays(ctx, programId)) {
      const target = moved.get(d._id);
      if (target !== undefined) {
        if (d.weekday !== target) await ctx.db.patch(d._id, { weekday: target });
      } else if (d.weekday !== undefined && weekdays.has(d.weekday)) {
        // Displaced from a weekday the caller reassigned: becomes unscheduled.
        await ctx.db.patch(d._id, { weekday: undefined });
      }
    }
    return null;
  },
  summarize: () => "Rearranged the week",
});

export const addSlot = defineMutation({
  name: "add_program_exercise",
  description: "Add an exercise to a program day. Defaults come from the exercise when sets/reps/rest are omitted.",
  args: {
    dayId: v.id("programDays"),
    exerciseId: v.id("exercises"),
    sets: v.optional(v.number()),
    repLow: v.optional(v.number()),
    repHigh: v.optional(v.number()),
    restSec: v.optional(v.number()),
    group: v.optional(v.string()),
    position: v.optional(v.number()),
  },
  audit: true,
  run: async (ctx, { userId }, args) => {
    const day = await own(ctx, userId, "programDays", args.dayId);
    const exercise = await readableExercise(ctx, userId, args.exerciseId);
    const slots = await reindexDay(ctx, day._id);
    const position = Math.max(0, Math.min(args.position ?? slots.length, slots.length));
    for (const s of slots) if (s.order >= position) await ctx.db.patch(s._id, { order: s.order + 1 });
    if (day.kind === "rest") await ctx.db.patch(day._id, { kind: "workout", title: day.title === "Rest" ? "Workout" : day.title });
    return await ctx.db.insert("programExercises", {
      userId,
      programDayId: day._id,
      exerciseId: exercise._id,
      order: position,
      group: args.group,
      sets: Math.max(1, Math.min(12, Math.round(args.sets ?? exercise.defaults.sets ?? 3))),
      repLow: args.repLow ?? (exercise.defaults.repLow || 8),
      repHigh: args.repHigh ?? (exercise.defaults.repHigh || 12),
      restSec: args.restSec ?? (exercise.defaults.restSec || 90),
    });
  },
  summarize: () => "Added exercise to plan",
});

export const updateSlot = defineMutation({
  name: "update_program_exercise",
  description: "Change sets, rep range, rest, target RIR, notes or superset group of a planned exercise. Pass group null to unlink a superset.",
  args: {
    slotId: v.id("programExercises"),
    sets: v.optional(v.number()),
    repLow: v.optional(v.number()),
    repHigh: v.optional(v.number()),
    restSec: v.optional(v.number()),
    targetRir: v.optional(v.union(v.number(), v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
    group: v.optional(v.union(v.string(), v.null())),
    /** Join this exercise and the next one into a superset (one atomic step). */
    linkNext: v.optional(v.boolean()),
  },
  audit: true,
  run: async (ctx, { userId }, { slotId, linkNext, ...patch }) => {
    const slot = await own(ctx, userId, "programExercises", slotId);
    if (linkNext) {
      const slots = await ctx.db
        .query("programExercises")
        .withIndex("by_programDayId_and_order", (q) => q.eq("programDayId", slot.programDayId))
        .take(60);
      const next = slots[slots.findIndex((s) => s._id === slot._id) + 1];
      if (!next) fail("No next exercise to superset with");
      const g = next.group ?? slot.group ?? `ss-${slot._id.slice(-6)}${next._id.slice(-4)}`;
      await ctx.db.patch(slot._id, { group: g });
      await ctx.db.patch(next._id, { group: g });
      return null;
    }
    const clean: Partial<Doc<"programExercises">> = {};
    if (patch.sets !== undefined) clean.sets = Math.max(1, Math.min(12, Math.round(patch.sets)));
    if (patch.repLow !== undefined) clean.repLow = Math.max(0, patch.repLow);
    if (patch.repHigh !== undefined) clean.repHigh = Math.max(0, patch.repHigh);
    if (patch.restSec !== undefined) clean.restSec = Math.max(0, Math.min(900, patch.restSec));
    if (patch.targetRir !== undefined) clean.targetRir = patch.targetRir ?? undefined;
    if (patch.notes !== undefined) clean.notes = patch.notes ?? undefined;
    if (patch.group !== undefined) clean.group = patch.group ?? undefined;
    await ctx.db.patch(slot._id, clean);
    return null;
  },
  summarize: () => "Updated planned exercise",
});

export const removeSlot = defineMutation({
  name: "remove_program_exercise",
  description: "Remove an exercise from a program day.",
  args: { slotId: v.id("programExercises") },
  audit: true,
  run: async (ctx, { userId }, { slotId }) => {
    const slot = await own(ctx, userId, "programExercises", slotId);
    await ctx.db.delete(slot._id);
    await reindexDay(ctx, slot.programDayId);
    await normalizeDayGroups(ctx, slot.programDayId);
    return null;
  },
  summarize: () => "Removed exercise from plan",
});

export const swapSlot = defineMutation({
  name: "swap_program_exercise",
  description: "Replace the exercise in a planned slot, keeping sets/reps/rest.",
  args: { slotId: v.id("programExercises"), exerciseId: v.id("exercises") },
  audit: true,
  run: async (ctx, { userId }, { slotId, exerciseId }) => {
    const slot = await own(ctx, userId, "programExercises", slotId);
    const exercise = await readableExercise(ctx, userId, exerciseId);
    await ctx.db.patch(slot._id, { exerciseId: exercise._id });
    return null;
  },
  summarize: () => "Swapped planned exercise",
});

export const moveSlot = defineMutation({
  name: "move_program_exercise",
  description: "Move a planned exercise to a new 0-based position within its day.",
  args: { slotId: v.id("programExercises"), position: v.number() },
  audit: true,
  run: async (ctx, { userId }, { slotId, position }) => {
    const slot = await own(ctx, userId, "programExercises", slotId);
    const slots = (await reindexDay(ctx, slot.programDayId)).filter((s) => s._id !== slot._id);
    const target = Math.max(0, Math.min(position, slots.length));
    slots.splice(target, 0, slot);
    for (const [i, s] of slots.entries()) if (s.order !== i || s._id === slot._id) await ctx.db.patch(s._id, { order: i });
    await normalizeDayGroups(ctx, slot.programDayId);
    return null;
  },
  summarize: () => "Reordered plan",
});

