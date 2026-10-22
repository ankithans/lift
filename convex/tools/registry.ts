/**
 * The tool surface exposed to AI agents (MCP). Every entry is a command that
 * the app UI also uses, so agents can do anything a person can in the app.
 */
import type { AnyCommand } from "../lib/commands";
import * as library from "../core/library";
import * as profile from "../core/profile";
import * as programs from "../core/programs";
import * as progress from "../core/progress";
import * as workouts from "../core/workouts";

export const TOOLS: AnyCommand[] = [
  profile.me,
  profile.updateProfile,

  library.searchExercises,
  library.getExercise,
  library.createExercise,

  programs.getActiveProgram,
  programs.getProgramDay,
  programs.getWeek,
  programs.listTemplates,
  programs.startProgram,
  programs.createEmptyProgram,
  programs.renameProgram,
  programs.updateDay,
  programs.arrangeWeek,
  programs.addSlot,
  programs.updateSlot,
  programs.removeSlot,
  programs.swapSlot,
  programs.moveSlot,

  workouts.getActiveWorkout,
  workouts.getWorkout,
  workouts.listWorkouts,
  workouts.startWorkout,
  workouts.addWorkoutExercise,
  workouts.removeWorkoutExercise,
  workouts.swapWorkoutExercise,
  workouts.updateWorkoutExercise,
  workouts.addSet,
  workouts.updateSet,
  workouts.completeSet,
  workouts.uncompleteSet,
  workouts.removeSet,
  workouts.setRest,
  workouts.finishWorkout,
  workouts.discardWorkout,
  workouts.updateWorkout,
  workouts.logWorkout,

  progress.muscleVolume,
  progress.trainingSummary,
  progress.recentPrs,
  progress.listBodyMetrics,
  progress.logBodyMetric,
  progress.deleteBodyMetric,
  progress.recentActivity,
];

export const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));
