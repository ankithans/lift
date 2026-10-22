import * as c from "./core/progress";
import { userMutation, userQuery } from "./lib/commands";

export const muscles = userQuery(c.muscleVolume);
export const summary = userQuery(c.trainingSummary);
export const prs = userQuery(c.recentPrs);
export const bodyMetrics = userQuery(c.listBodyMetrics);
export const logBodyMetric = userMutation(c.logBodyMetric);
export const deleteBodyMetric = userMutation(c.deleteBodyMetric);
export const activity = userQuery(c.recentActivity);
