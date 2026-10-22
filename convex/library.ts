import * as c from "./core/library";
import { userMutation, userQuery } from "./lib/commands";

export const search = userQuery(c.searchExercises);
export const recent = userQuery(c.recentExercises);
export const get = userQuery(c.getExercise);
export const create = userMutation(c.createExercise);
