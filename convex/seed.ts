import { internalMutation } from "./_generated/server";
import exercises from "./data/exercises.json";

type Row = (typeof exercises)[number];

/** Upsert the shared exercise library from convex/data/exercises.json. Idempotent. */
export const syncLibrary = internalMutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    let updated = 0;
    for (const row of exercises as Row[]) {
      const doc = {
        slug: row.slug,
        name: row.name,
        aliases: row.aliases,
        muscles: row.muscles as { name: string; group: string; role: "primary" | "secondary" }[],
        primaryGroups: row.primaryGroups,
        secondaryGroups: row.secondaryGroups,
        categories: row.categories,
        equipment: row.equipment,
        kind: row.kind,
        movement: row.movement ?? undefined,
        tracking: row.tracking as "weight_reps" | "reps" | "duration" | "weighted_bodyweight",
        unilateral: row.unilateral,
        steps: row.steps,
        cues: row.cues,
        tips: row.tips ?? undefined,
        videoUrl: row.videoUrl ?? undefined,
        thumbnailUrl: row.thumbnailUrl ?? undefined,
        defaults: row.defaults,
        listed: row.listed,
        searchText: [row.name, ...row.aliases, ...row.primaryGroups, ...row.equipment, ...row.muscles.map((m) => m.name)].join(" "),
        source: row.source,
      };
      const existing = await ctx.db
        .query("exercises")
        .withIndex("by_slug", (q) => q.eq("slug", row.slug))
        .first();
      if (existing) {
        await ctx.db.replace(existing._id, doc);
        updated++;
      } else {
        await ctx.db.insert("exercises", doc);
        inserted++;
      }
    }
    return { inserted, updated };
  },
});
