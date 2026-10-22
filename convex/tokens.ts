import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, mutation, query } from "./_generated/server";

export async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `lift_${b64}`;
}

/** Create a personal access token for MCP / agent tools. The plaintext is returned once. */
export const create = action({
  args: { name: v.string() },
  handler: async (ctx, { name }): Promise<{ token: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const token = randomToken();
    await ctx.runMutation(internal.tokens.store, {
      userId,
      name: name.trim().slice(0, 60) || "Agent",
      tokenHash: await sha256Hex(token),
      prefix: token.slice(0, 10),
    });
    return { token };
  },
});

export const store = internalMutation({
  args: { userId: v.id("users"), name: v.string(), tokenHash: v.string(), prefix: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("apiTokens", { ...args, scopes: ["all"] });
    return null;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("apiTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(50);
    return rows
      .filter((t) => !t.revokedAt)
      .map((t) => ({ _id: t._id, name: t.name, prefix: t.prefix, createdAt: t._creationTime, lastUsedAt: t.lastUsedAt ?? null }));
  },
});

export const revoke = mutation({
  args: { tokenId: v.id("apiTokens") },
  handler: async (ctx, { tokenId }) => {
    const userId = await getAuthUserId(ctx);
    const token = await ctx.db.get(tokenId);
    if (!userId || !token || token.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(tokenId, { revokedAt: Date.now() });
    return null;
  },
});
