import * as c from "./core/profile";
import { userMutation, userQuery } from "./lib/commands";

export const me = userQuery(c.me);
export const ensure = userMutation(c.ensureProfile);
export const update = userMutation(c.updateProfile);
