/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as auth from "../auth.js";
import type * as core_library from "../core/library.js";
import type * as core_profile from "../core/profile.js";
import type * as core_programs from "../core/programs.js";
import type * as core_progress from "../core/progress.js";
import type * as core_workouts from "../core/workouts.js";
import type * as data_templates from "../data/templates.js";
import type * as http from "../http.js";
import type * as importer from "../importer.js";
import type * as lib_commands from "../lib/commands.js";
import type * as lib_time from "../lib/time.js";
import type * as lib_util from "../lib/util.js";
import type * as library from "../library.js";
import type * as profile from "../profile.js";
import type * as programs from "../programs.js";
import type * as progress from "../progress.js";
import type * as seed from "../seed.js";
import type * as tokens from "../tokens.js";
import type * as tools_registry from "../tools/registry.js";
import type * as workouts from "../workouts.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  auth: typeof auth;
  "core/library": typeof core_library;
  "core/profile": typeof core_profile;
  "core/programs": typeof core_programs;
  "core/progress": typeof core_progress;
  "core/workouts": typeof core_workouts;
  "data/templates": typeof data_templates;
  http: typeof http;
  importer: typeof importer;
  "lib/commands": typeof lib_commands;
  "lib/time": typeof lib_time;
  "lib/util": typeof lib_util;
  library: typeof library;
  profile: typeof profile;
  programs: typeof programs;
  progress: typeof progress;
  seed: typeof seed;
  tokens: typeof tokens;
  "tools/registry": typeof tools_registry;
  workouts: typeof workouts;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
