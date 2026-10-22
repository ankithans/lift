import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { TOOL_BY_NAME, TOOLS } from "./tools/registry";
import { objectSchema, runMutationCommand, validateArgs } from "./lib/commands";

export function toolListing() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: objectSchema(t.args),
    annotations: { readOnlyHint: t.kind === "query", destructiveHint: /delete|remove/.test(t.name) },
  }));
}

export const resolveToken = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const token = await ctx.db
      .query("apiTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!token || token.revokedAt) return null;
    return { tokenId: token._id, userId: token.userId, name: token.name, lastUsedAt: token.lastUsedAt ?? 0 };
  },
});

export const touchToken = internalMutation({
  args: { tokenId: v.id("apiTokens") },
  handler: async (ctx, { tokenId }) => {
    await ctx.db.patch(tokenId, { lastUsedAt: Date.now() });
    return null;
  },
});

export const runQueryTool = internalQuery({
  args: { userId: v.id("users"), tool: v.string(), args: v.any() },
  handler: async (ctx, { userId, tool, args }) => {
    const cmd = TOOL_BY_NAME.get(tool);
    if (!cmd || cmd.kind !== "query") throw new Error(`Unknown query tool ${tool}`);
    const err = validateArgs(cmd.args, args ?? {});
    if (err) throw new Error(err);
    return await cmd.run(ctx, { userId, actor: "agent" }, args ?? {});
  },
});

export const runMutationTool = internalMutation({
  args: { userId: v.id("users"), actorName: v.string(), tool: v.string(), args: v.any() },
  handler: async (ctx, { userId, actorName, tool, args }) => {
    const cmd = TOOL_BY_NAME.get(tool);
    if (!cmd || cmd.kind !== "mutation") throw new Error(`Unknown mutation tool ${tool}`);
    const err = validateArgs(cmd.args, args ?? {});
    if (err) throw new Error(err);
    return await runMutationCommand(ctx, cmd, { userId, actor: "agent", actorName }, args ?? {});
  },
});
