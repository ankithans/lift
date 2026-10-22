import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction, type ActionCtx } from "./_generated/server";
import { toolListing } from "./agent";
import { auth } from "./auth";
import { TOOL_BY_NAME } from "./tools/registry";
import { sha256Hex } from "./tokens";

import { callback as whoopCallback, webhook as whoopWebhook } from "./whoopHttp";
import { spotifyCallback, youtubeCallback } from './musicHttp';

const http = httpRouter();
http.route({ path: '/spotify/callback', method: 'GET', handler: spotifyCallback });
http.route({ path: '/youtube/callback', method: 'GET', handler: youtubeCallback });
http.route({ path: "/whoop/callback", method: "GET", handler: whoopCallback });
http.route({ path: "/whoop/webhook", method: "POST", handler: whoopWebhook });
auth.addHttpRoutes(http);

// ---------------------------------------------------------------------------
// MCP (Model Context Protocol) over Streamable HTTP, JSON responses.
// Auth: `Authorization: Bearer lift_…` personal access token (Settings → AI access).

const SERVER_INFO = { name: "lift", title: "Lift — workout tracker", version: "1.0.0" };
const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const INSTRUCTIONS = `Lift is the user's strength-training log and program.
- Weights are always kilograms; RIR = reps in reserve (0 = failure).
- Find exercise ids with search_exercises before adding/swapping exercises.
- get_week / get_program show the plan; list_workouts + get_workout show history; get_exercise shows per-exercise history and PRs.
- Changes you make are recorded in the activity log (list_activity) and attributed to this token.
- Be conservative with destructive tools (delete_workout, remove_*). Confirm with the user first.`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS, ...extra } });

const rpcError = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function authenticate(ctx: ActionCtx, req: Request) {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token.startsWith("lift_")) return null;
  const found = await ctx.runQuery(internal.agent.resolveToken, { tokenHash: await sha256Hex(token) });
  if (found && Date.now() - found.lastUsedAt > 10 * 60 * 1000) {
    await ctx.runMutation(internal.agent.touchToken, { tokenId: found.tokenId });
  }
  return found;
}

async function handle(
  ctx: ActionCtx,
  caller: { userId: string; name: string },
  msg: RpcRequest,
): Promise<object | null> {
  const { id, method, params } = msg;
  const isNotification = id === undefined;
  switch (method) {
    case "initialize": {
      const requested = String(params?.protocolVersion ?? "");
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: toolListing() } };
    case "tools/call": {
      const name = String(params?.name ?? "");
      const args = (params?.arguments ?? {}) as Record<string, unknown>;
      const tool = TOOL_BY_NAME.get(name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${name}`);
      try {
        const result =
          tool.kind === "query"
            ? await ctx.runQuery(internal.agent.runQueryTool, { userId: caller.userId as never, tool: name, args })
            : await ctx.runMutation(internal.agent.runMutationTool, {
                userId: caller.userId as never,
                actorName: caller.name,
                tool: name,
                args,
              });
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify(result ?? null) }], isError: false },
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const data = (e as { data?: unknown }).data;
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: typeof data === "string" ? data : message }], isError: true },
        };
      }
    }
    default:
      if (isNotification) return null;
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

const mcp = httpAction(async (ctx, req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method === "GET") return json({ error: "SSE stream not supported; POST JSON-RPC messages." }, 405, { Allow: "POST" });
  const caller = await authenticate(ctx, req);
  if (!caller) {
    return json(rpcError(null, -32001, "Missing or invalid token. Create one in Lift → Settings → AI access."), 401, {
      "WWW-Authenticate": 'Bearer realm="lift"',
    });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }
  const messages = Array.isArray(body) ? body : [body];
  const responses: object[] = [];
  for (const m of messages) {
    if (typeof m !== "object" || m === null || typeof (m as RpcRequest).method !== "string") {
      responses.push(rpcError(null, -32600, "Invalid request"));
      continue;
    }
    const out = await handle(ctx, { userId: caller.userId, name: caller.name }, m as RpcRequest);
    if (out) responses.push(out);
  }
  if (responses.length === 0) return new Response(null, { status: 202, headers: CORS });
  return json(Array.isArray(body) ? responses : responses[0]);
});

for (const method of ["POST", "GET", "OPTIONS"] as const) {
  http.route({ path: "/mcp", method, handler: mcp });
}

// ---------------------------------------------------------------------------
// Admin operations (seeding, imports). Requires the ADMIN_SECRET env var.

const ADMIN_OPS = {
  whoopStatus: internal.whoopStore.diagnostics,
  syncLibrary: internal.seed.syncLibrary,
  importHistory: internal.importer.importHistory,
  rebuildStats: internal.importer.rebuildStats,
  deleteUserData: internal.importer.deleteUserData,
} as const;

http.route({
  path: "/admin",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.ADMIN_SECRET;
    const given = req.headers.get("x-admin-secret") ?? "";
    if (!secret || secret.length < 24 || given.length !== secret.length || (await sha256Hex(given)) !== (await sha256Hex(secret))) {
      return new Response("Forbidden", { status: 403 });
    }
    const body = (await req.json()) as { op?: unknown; args?: unknown };
    const op = typeof body.op === "string" ? body.op : "";
    if (op === "whoopRefresh") {
      const result = await ctx.runAction(internal.whoopSync.forceRefresh, (body.args ?? {}) as never);
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
    }
    if (!(op in ADMIN_OPS)) return new Response("Unknown op", { status: 400 });
    const result = await ctx.runMutation(ADMIN_OPS[op as keyof typeof ADMIN_OPS] as never, (body.args ?? {}) as never);
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  }),
});

export default http;
