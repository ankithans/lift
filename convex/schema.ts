import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { whoopTables } from "./whoop/model";
import { musicTables } from "./music/model";

/**
 * Lift data model.
 *
 * Everything a person owns is scoped by `userId`. The exercise library is
 * shared (userId undefined) with optional per-user custom exercises.
 *
 * Every write goes through the command layer in `convex/core/*` so the app UI,
 * the MCP endpoint and future in-app AI share one set of verbs.
 */

export const muscleRole = v.union(v.literal("primary"), v.literal("secondary"));

export const setKind = v.union(
  v.literal("working"),
  v.literal("warmup"),
  v.literal("drop"),
  v.literal("failure"),
);

export const trackingMode = v.union(
  v.literal("weight_reps"), // kg × reps
  v.literal("reps"), // bodyweight reps
  v.literal("duration"), // seconds
  v.literal("weighted_bodyweight"), // added kg × reps
);

export const actor = v.union(
  v.literal("user"),
  v.literal("agent"),
  v.literal("import"),
  v.literal("system"),
);

export default defineSchema({
  ...authTables,
  ...whoopTables,
  ...musicTables,

  profiles: defineTable({
    userId: v.id("users"),
    displayName: v.optional(v.string()),
    unit: v.union(v.literal("kg"), v.literal("lb")),
    weekStartsOn: v.number(), // 0 = Sunday, 1 = Monday
    timezone: v.optional(v.string()),
    defaultRestSec: v.number(),
    activeProgramId: v.optional(v.id("programs")),
    onboardedAt: v.optional(v.number()),
    bodyweightKg: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  exercises: defineTable({
    userId: v.optional(v.id("users")), // undefined = shared library
    slug: v.string(),
    name: v.string(),
    aliases: v.array(v.string()),
    muscles: v.array(
      v.object({ name: v.string(), group: v.string(), role: muscleRole }),
    ),
    primaryGroups: v.array(v.string()),
    secondaryGroups: v.array(v.string()),
    categories: v.array(v.string()), // library filters: "Chest", "Cardio", "Rehab: Knee"…
    equipment: v.array(v.string()),
    kind: v.string(), // compound | accessory | warmup | rehab | cardio | core | mobility…
    movement: v.optional(v.string()),
    tracking: trackingMode,
    unilateral: v.boolean(),
    steps: v.array(v.string()),
    cues: v.array(v.string()),
    tips: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    defaults: v.object({
      sets: v.number(),
      repLow: v.number(),
      repHigh: v.number(),
      restSec: v.number(),
    }),
    listed: v.boolean(), // visible in the library by default
    searchText: v.string(),
    source: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_userId_and_name", ["userId", "name"])
    .searchIndex("search_text", { searchField: "searchText", filterFields: ["listed", "userId"] }),

  programs: defineTable({
    userId: v.id("users"),
    name: v.string(),
    goal: v.optional(v.string()),
    level: v.optional(v.string()),
    description: v.optional(v.string()),
    source: v.optional(v.string()),
    archivedAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  programDays: defineTable({
    userId: v.id("users"),
    programId: v.id("programs"),
    order: v.number(),
    weekday: v.optional(v.number()), // 0-6, Sunday = 0
    title: v.string(),
    kind: v.union(v.literal("workout"), v.literal("rest")),
    notes: v.optional(v.string()),
  }).index("by_programId_and_order", ["programId", "order"]),

  programExercises: defineTable({
    userId: v.id("users"),
    programDayId: v.id("programDays"),
    exerciseId: v.id("exercises"),
    order: v.number(),
    group: v.optional(v.string()), // same group = superset
    sets: v.number(),
    repLow: v.number(),
    repHigh: v.number(),
    restSec: v.number(),
    targetRir: v.optional(v.number()),
    notes: v.optional(v.string()),
  }).index("by_programDayId_and_order", ["programDayId", "order"]),

  workouts: defineTable({
    userId: v.id("users"),
    programDayId: v.optional(v.id("programDays")),
    title: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("discarded"),
    ),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    source: actor,
    externalId: v.optional(v.string()),
    stats: v.optional(
      v.object({
        durationSec: v.number(),
        sets: v.number(),
        reps: v.number(),
        volumeKg: v.number(),
        prs: v.number(),
      }),
    ),
    restEndsAt: v.optional(v.number()),
    restTotalSec: v.optional(v.number()),
  })
    .index("by_userId_and_startedAt", ["userId", "startedAt"])
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_userId_and_externalId", ["userId", "externalId"]),

  workoutExercises: defineTable({
    userId: v.id("users"),
    workoutId: v.id("workouts"),
    exerciseId: v.id("exercises"),
    order: v.number(),
    group: v.optional(v.string()),
    repLow: v.optional(v.number()),
    repHigh: v.optional(v.number()),
    restSec: v.number(),
    notes: v.optional(v.string()),
  }).index("by_workoutId_and_order", ["workoutId", "order"]),

  sets: defineTable({
    userId: v.id("users"),
    workoutId: v.id("workouts"),
    workoutExerciseId: v.id("workoutExercises"),
    exerciseId: v.id("exercises"),
    order: v.number(),
    kind: setKind,
    weightKg: v.optional(v.number()),
    reps: v.optional(v.number()),
    durationSec: v.optional(v.number()),
    rir: v.optional(v.number()), // reps in reserve: 0 = failure
    done: v.boolean(),
    doneAt: v.optional(v.number()),
    isPr: v.optional(v.boolean()),
  })
    .index("by_workoutExerciseId_and_order", ["workoutExerciseId", "order"])
    .index("by_workoutId", ["workoutId"])
    .index("by_userId_and_exerciseId_and_doneAt", ["userId", "exerciseId", "doneAt"])
    .index("by_userId_and_doneAt", ["userId", "doneAt"]),

  // One row per user × exercise. Cheap "previous" + PR lookups.
  exerciseStats: defineTable({
    userId: v.id("users"),
    exerciseId: v.id("exercises"),
    lastWorkoutId: v.optional(v.id("workouts")),
    lastDoneAt: v.optional(v.number()),
    lastSets: v.array(
      v.object({
        weightKg: v.optional(v.number()),
        reps: v.optional(v.number()),
        durationSec: v.optional(v.number()),
        rir: v.optional(v.number()),
      }),
    ),
    bestE1rmKg: v.optional(v.number()),
    bestScore: v.optional(v.number()),
    bestWeightKg: v.optional(v.number()),
    bestReps: v.optional(v.number()),
    bestSetAt: v.optional(v.number()),
    totalSets: v.number(),
  }).index("by_userId_and_exerciseId", ["userId", "exerciseId"]),

  bodyMetrics: defineTable({
    userId: v.id("users"),
    kind: v.string(), // weight | bodyFat | waist …
    value: v.number(),
    unit: v.string(),
    measuredAt: v.number(),
    notes: v.optional(v.string()),
    source: actor,
  }).index("by_userId_and_kind_and_measuredAt", ["userId", "kind", "measuredAt"]),

  // Personal access tokens for MCP / agent tools.
  apiTokens: defineTable({
    userId: v.id("users"),
    name: v.string(),
    tokenHash: v.string(),
    prefix: v.string(),
    scopes: v.array(v.string()),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_userId", ["userId"]),

  // Audit trail of every command, by whom. Lets agents explain and undo.
  activity: defineTable({
    userId: v.id("users"),
    actor,
    actorName: v.optional(v.string()),
    command: v.string(),
    summary: v.string(),
    at: v.number(),
  }).index("by_userId_and_at", ["userId", "at"]),
});
