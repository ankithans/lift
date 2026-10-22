/**
 * The command layer.
 *
 * Every capability of Lift is a `Command`: a named, described, validated verb
 * that runs for a user. The same command object is exposed
 *   - to the app UI as a Convex query/mutation (auth via Convex Auth session), and
 *   - to AI agents as an MCP tool (auth via personal access token).
 *
 * Adding a feature = defining one command. Agents get it for free.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import type { RegisteredMutation, RegisteredQuery } from "convex/server";
import type {
  GenericValidator,
  ObjectType,
  PropertyValidators,
} from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { fail } from "./util";

export type Actor = "user" | "agent" | "import" | "system";
export type Caller = { userId: Id<"users">; actor: Actor; actorName?: string };

type Base<A extends PropertyValidators> = {
  name: string;
  description: string;
  args: A;
};

// Method syntax keeps `run` bivariant so commands fit the `AnyCommand` registry type.
export type QueryCommand<A extends PropertyValidators, R> = Base<A> & {
  kind: "query";
  run(ctx: QueryCtx, caller: Caller, args: ObjectType<A>): Promise<R>;
};

export type MutationCommand<A extends PropertyValidators, R> = Base<A> & {
  kind: "mutation";
  /** Write an activity row for user-initiated calls too (agents are always audited). */
  audit?: boolean;
  run(ctx: MutationCtx, caller: Caller, args: ObjectType<A>): Promise<R>;
  summarize?(args: ObjectType<A>, result: R): string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyCommand = QueryCommand<any, any> | MutationCommand<any, any>;

export function defineQuery<A extends PropertyValidators, R>(
  spec: Omit<QueryCommand<A, R>, "kind">,
): QueryCommand<A, R> {
  return { kind: "query", ...spec };
}

export function defineMutation<A extends PropertyValidators, R>(
  spec: Omit<MutationCommand<A, R>, "kind">,
): MutationCommand<A, R> {
  return { kind: "mutation", ...spec };
}

export async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) fail("Not signed in");
  return userId;
}

/**
 * Public query for the signed-in user. When signed out it resolves to null at
 * runtime; the app never renders signed-in screens then, so it is typed as R.
 */
export function userQuery<A extends PropertyValidators, R>(cmd: QueryCommand<A, R>) {
  return query({
    args: cmd.args as PropertyValidators,
    handler: async (ctx: QueryCtx, args: ObjectType<A>): Promise<R | null> => {
      const userId = await getAuthUserId(ctx);
      if (!userId) return null;
      return cmd.run(ctx, { userId, actor: "user" }, args);
    },
  } as never) as RegisteredQuery<"public", ObjectType<A>, Promise<R>>;
}

/** Public mutation for the signed-in user. */
export function userMutation<A extends PropertyValidators, R>(cmd: MutationCommand<A, R>) {
  return mutation({
    args: cmd.args as PropertyValidators,
    handler: async (ctx: MutationCtx, args: ObjectType<A>): Promise<R> => {
      const userId = await requireUserId(ctx);
      return runMutationCommand(ctx, cmd, { userId, actor: "user" }, args);
    },
  } as never) as RegisteredMutation<"public", ObjectType<A>, Promise<R>>;
}

export async function runMutationCommand<A extends PropertyValidators, R>(
  ctx: MutationCtx,
  cmd: MutationCommand<A, R>,
  caller: Caller,
  args: ObjectType<A>,
): Promise<R> {
  const result = await cmd.run(ctx, caller, args);
  if (caller.actor !== "user" || cmd.audit) {
    await ctx.db.insert("activity", {
      userId: caller.userId,
      actor: caller.actor,
      actorName: caller.actorName,
      command: cmd.name,
      summary: (cmd.summarize?.(args, result) ?? cmd.name).slice(0, 500),
      at: Date.now(),
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Validator → JSON Schema (for MCP tool listings) and runtime arg validation.

type JsonSchema = Record<string, unknown>;

export function toJsonSchema(validator: GenericValidator): JsonSchema {
  switch (validator.kind) {
    case "string":
      return { type: "string" };
    case "id":
      return { type: "string", description: `${validator.tableName} id` };
    case "float64":
      return { type: "number" };
    case "int64":
      return { type: "integer" };
    case "boolean":
      return { type: "boolean" };
    case "null":
      return { type: "null" };
    case "literal":
      return { const: validator.value };
    case "array":
      return { type: "array", items: toJsonSchema(validator.element) };
    case "object":
      return objectSchema(validator.fields);
    case "record":
      return { type: "object", additionalProperties: toJsonSchema(validator.value) };
    case "union": {
      const members = validator.members as GenericValidator[];
      if (members.every((m) => m.kind === "literal")) {
        return { type: "string", enum: members.map((m) => (m as { value: unknown }).value) };
      }
      return { anyOf: members.map(toJsonSchema) };
    }
    default:
      return {};
  }
}

export function objectSchema(fields: PropertyValidators): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const [key, v] of Object.entries(fields)) {
    properties[key] = toJsonSchema(v);
    if (v.isOptional !== "optional") required.push(key);
  }
  return { type: "object", properties, required, additionalProperties: false };
}

/** Validate untrusted args (from agents) against command validators. Returns error or null. */
export function validateArgs(fields: PropertyValidators, value: unknown): string | null {
  return checkObject(fields, value, "args");
}

function checkObject(fields: PropertyValidators, value: unknown, path: string): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return `${path} must be an object`;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!(key in fields)) return `${path}.${key} is not a known argument`;
  }
  for (const [key, v] of Object.entries(fields)) {
    const present = record[key] !== undefined;
    if (!present) {
      if (v.isOptional === "optional") continue;
      return `${path}.${key} is required`;
    }
    const err = check(v, record[key], `${path}.${key}`);
    if (err) return err;
  }
  return null;
}

function check(v: GenericValidator, value: unknown, path: string): string | null {
  switch (v.kind) {
    case "string":
    case "id":
      return typeof value === "string" ? null : `${path} must be a string`;
    case "float64":
      return typeof value === "number" && Number.isFinite(value) ? null : `${path} must be a number`;
    case "int64":
      return typeof value === "bigint" || Number.isInteger(value) ? null : `${path} must be an integer`;
    case "boolean":
      return typeof value === "boolean" ? null : `${path} must be a boolean`;
    case "null":
      return value === null ? null : `${path} must be null`;
    case "literal":
      return value === v.value ? null : `${path} must be ${JSON.stringify(v.value)}`;
    case "array": {
      if (!Array.isArray(value)) return `${path} must be an array`;
      for (let i = 0; i < value.length; i++) {
        const err = check(v.element, value[i], `${path}[${i}]`);
        if (err) return err;
      }
      return null;
    }
    case "object":
      return checkObject(v.fields, value, path);
    case "record": {
      if (typeof value !== "object" || value === null) return `${path} must be an object`;
      for (const [k, item] of Object.entries(value)) {
        const err = check(v.value, item, `${path}.${k}`);
        if (err) return err;
      }
      return null;
    }
    case "union": {
      const members = v.members as GenericValidator[];
      return members.some((m) => check(m, value, path) === null)
        ? null
        : `${path} does not match any allowed shape`;
    }
    default:
      return null;
  }
}
