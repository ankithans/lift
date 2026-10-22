import * as c from "./core/programs";
import { userMutation, userQuery } from "./lib/commands";

export const active = userQuery(c.getActiveProgram);
export const day = userQuery(c.getProgramDay);
export const week = userQuery(c.getWeek);
export const templates = userQuery(c.listTemplates);
export const startFromTemplate = userMutation(c.startProgram);
export const createEmpty = userMutation(c.createEmptyProgram);
export const updateDay = userMutation(c.updateDay);
export const addExercise = userMutation(c.addSlot);
export const updateExercise = userMutation(c.updateSlot);
export const removeExercise = userMutation(c.removeSlot);
export const swapExercise = userMutation(c.swapSlot);
export const moveExercise = userMutation(c.moveSlot);
