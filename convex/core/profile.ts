import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { defineMutation, defineQuery } from "../lib/commands";
import type { Ctx } from "../lib/util";

export async function getProfile(ctx: Ctx, userId: Id<"users">) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export async function ensureProfileFor(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await getProfile(ctx, userId);
  if (existing) return existing;
  const user = await ctx.db.get(userId);
  const id = await ctx.db.insert("profiles", {
    userId,
    displayName: user?.name?.split(" ")[0] ?? undefined,
    unit: "kg",
    weekStartsOn: 0,
    defaultRestSec: 120,
  });
  return (await ctx.db.get(id))!;
}

export const me = defineQuery({
  name: "get_profile",
  description: "Who the user is: name, email, preferences (unit kg/lb, week start, default rest) and whether onboarding is complete.",
  args: {},
  run: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    const profile = await getProfile(ctx, userId);
    const active = await ctx.db
      .query("workouts")
      .withIndex("by_userId_and_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first();
    return {
      userId,
      name: profile?.displayName ?? user?.name ?? null,
      email: user?.email ?? null,
      image: user?.image ?? null,
      profile,
      activeWorkout: active ? { _id: active._id, title: active.title, startedAt: active.startedAt, restEndsAt: active.restEndsAt ?? null } : null,
    };
  },
});

export const ensureProfile = defineMutation({
  name: "ensure_profile",
  description: "Create the user's profile with defaults if it does not exist.",
  args: {},
  run: async (ctx, { userId }) => (await ensureProfileFor(ctx, userId))._id,
});

export const updateProfile = defineMutation({
  name: "update_profile",
  description: "Update preferences: display name, unit (kg|lb), week start (0=Sun,1=Mon), default rest seconds, body weight (kg).",
  args: {
    displayName: v.optional(v.string()),
    unit: v.optional(v.union(v.literal("kg"), v.literal("lb"))),
    weekStartsOn: v.optional(v.number()),
    defaultRestSec: v.optional(v.number()),
    timezone: v.optional(v.string()),
    bodyweightKg: v.optional(v.number()),
  },
  run: async (ctx, { userId }, patch) => {
    const profile = await ensureProfileFor(ctx, userId);
    await ctx.db.patch(profile._id, patch);
    return null;
  },
});
